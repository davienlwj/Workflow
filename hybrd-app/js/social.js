/*
 * Client-only social feed: follow people, see their workouts. No backend
 * *I* run - the browser talks to Firebase directly (Auth + Firestore),
 * using a Firebase project the user creates and owns themselves (same
 * "bring your own project" shape as gcal.js's OAuth Client ID and
 * intervals.js's API key - see the README for the setup steps and the
 * exact Firestore Security Rules to paste into the Firebase console).
 *
 * A published workout is visible only to its owner and to whoever is in
 * that owner's `followers` subcollection - never public to the internet.
 * This file assumes the Security Rules from the README are in place and
 * doesn't re-check permissions client-side; Firestore itself enforces it.
 */

const SDK_VERSION = '10.14.1';
const SDK_BASE = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;
const FEED_LIMIT_PER_PERSON = 20;
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

let appMod, authMod, fsMod;
let app = null;
let auth = null;
let db = null;
let activeConfigJSON = null;

async function ensureSdk() {
  if (appMod) return;
  [appMod, authMod, fsMod] = await Promise.all([
    import(/* @vite-ignore */ `${SDK_BASE}/firebase-app.js`),
    import(/* @vite-ignore */ `${SDK_BASE}/firebase-auth.js`),
    import(/* @vite-ignore */ `${SDK_BASE}/firebase-firestore.js`),
  ]);
}

/** Initializes (or re-initializes, if the config object actually changed)
 *  the Firebase app from the user's pasted config. Safe to call on every
 *  app load - re-inits only when needed. */
export async function initApp(firebaseConfig) {
  await ensureSdk();
  const json = JSON.stringify(firebaseConfig);
  if (app && json === activeConfigJSON) return;
  if (app) await appMod.deleteApp(app);
  app = appMod.initializeApp(firebaseConfig);
  auth = authMod.getAuth(app);
  db = fsMod.getFirestore(app);
  activeConfigJSON = json;
}

function requireInit() {
  if (!app) throw new Error('Firebase not configured yet');
}

/** Parses the config object as shown verbatim in the Firebase console
 *  ("const firebaseConfig = { apiKey: \"...\", ... };") - not valid JSON
 *  (unquoted keys, a variable declaration wrapped around it), so this
 *  strips the wrapper and evaluates the object literal itself rather than
 *  asking the user to hand-convert it to JSON. Trusted input (the user's
 *  own paste into their own local app), same trust level as every other
 *  settings field. */
export function parseFirebaseConfigInput(raw) {
  const body = (raw || '')
    .trim()
    .replace(/^(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*/, '')
    .replace(/;\s*$/, '');
  if (!body) throw new Error('Paste the firebaseConfig object from your Firebase project settings.');
  let config;
  try {
    // eslint-disable-next-line no-new-func
    config = Function(`"use strict"; return (${body});`)();
  } catch {
    throw new Error("Couldn't read that - paste the whole firebaseConfig object, e.g. { apiKey: \"...\", ... }.");
  }
  const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const missing = required.filter((k) => !config || typeof config[k] !== 'string' || !config[k]);
  if (missing.length > 0) throw new Error(`Missing ${missing.join(', ')} in that config.`);
  return config;
}

export async function signInWithGoogle() {
  requireInit();
  const provider = new authMod.GoogleAuthProvider();
  const { user } = await authMod.signInWithPopup(auth, provider);
  return { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL };
}

export async function signOutSocial() {
  if (!auth) return;
  await authMod.signOut(auth);
}

/** Resolves with the current user (or null) once Firebase has restored
 *  its own persisted session (IndexedDB-backed, separate from this app's
 *  own settings) - used at startup to confirm a previously-connected
 *  session is still valid before trusting settings.social.enabled. */
export function getRestoredUser() {
  requireInit();
  return new Promise((resolve) => {
    const unsubscribe = authMod.onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user ? { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL } : null);
    });
  });
}

function normalizeUsername(raw) {
  return (raw || '').trim().toLowerCase();
}

export function isValidUsername(raw) {
  return USERNAME_RE.test(normalizeUsername(raw));
}

/** Atomically claims a username for uid - fails if it's already taken by
 *  someone else, via a transaction so two people racing for the same name
 *  can't both "win" (a plain read-then-write couldn't guarantee that). */
export async function claimUsername(uid, rawUsername, profile) {
  requireInit();
  const name = normalizeUsername(rawUsername);
  if (!USERNAME_RE.test(name)) throw new Error('Usernames are 3-20 characters: letters, numbers, underscore only.');
  const nameRef = fsMod.doc(db, 'usernames', name);
  const userRef = fsMod.doc(db, 'users', uid);
  await fsMod.runTransaction(db, async (tx) => {
    const existing = await tx.get(nameRef);
    if (existing.exists() && existing.data().uid !== uid) throw new Error('That username is taken.');
    tx.set(nameRef, { uid });
    tx.set(userRef, { username: name, ...profile, updatedAt: new Date().toISOString() }, { merge: true });
  });
  return name;
}

/** Looks up a user's own profile doc by uid - used right after sign-in to
 *  detect a username already claimed on a previous device/browser, rather
 *  than prompting to pick a new one every time. */
export async function getUserProfile(uid) {
  requireInit();
  const snap = await fsMod.getDoc(fsMod.doc(db, 'users', uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

export async function findUserByUsername(rawUsername) {
  requireInit();
  const name = normalizeUsername(rawUsername);
  const nameSnap = await fsMod.getDoc(fsMod.doc(db, 'usernames', name));
  if (!nameSnap.exists()) return null;
  const uid = nameSnap.data().uid;
  const userSnap = await fsMod.getDoc(fsMod.doc(db, 'users', uid));
  if (!userSnap.exists()) return null;
  return { uid, ...userSnap.data() };
}

/** Follows `target` ({uid, username, displayName, photoURL}), writing both
 *  my own `following` entry and their `followers` entry in one batch - the
 *  latter is what the Security Rules check to decide whether I can read
 *  their workouts, so the two must never go out of sync. */
export async function followUser(myUid, target) {
  requireInit();
  const batch = fsMod.writeBatch(db);
  const followedAt = new Date().toISOString();
  batch.set(fsMod.doc(db, 'users', myUid, 'following', target.uid), {
    username: target.username,
    displayName: target.displayName ?? null,
    photoURL: target.photoURL ?? null,
    followedAt,
  });
  batch.set(fsMod.doc(db, 'users', target.uid, 'followers', myUid), { followedAt });
  await batch.commit();
}

export async function unfollowUser(myUid, targetUid) {
  requireInit();
  const batch = fsMod.writeBatch(db);
  batch.delete(fsMod.doc(db, 'users', myUid, 'following', targetUid));
  batch.delete(fsMod.doc(db, 'users', targetUid, 'followers', myUid));
  await batch.commit();
}

export async function fetchFollowing(myUid) {
  requireInit();
  const snap = await fsMod.getDocs(fsMod.collection(db, 'users', myUid, 'following'));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

/** Publishes one workout to the signed-in user's cloud profile, embedding
 *  each exercise's own name/muscles (not just its id) so a follower's app
 *  can render it correctly even for a custom exercise they don't have
 *  locally - same problem/fix as the watch sync's
 *  registerWatchCustomExercises (see app.js). */
export async function publishWorkout(uid, workout, exerciseById) {
  requireInit();
  const exercises = workout.exercises.map((e) => {
    const ex = exerciseById(e.exerciseId);
    return { ...e, exercise: ex ? { id: ex.id, name: ex.name, muscles: ex.muscles || [] } : null };
  });
  await fsMod.setDoc(fsMod.doc(db, 'users', uid, 'workouts', workout.id), {
    date: workout.date,
    name: workout.name || '',
    notes: workout.notes || '',
    durationMs: workout.durationMs ?? null,
    exercises,
    publishedAt: new Date().toISOString(),
  });
}

export async function unpublishWorkout(uid, workoutId) {
  requireInit();
  await fsMod.deleteDoc(fsMod.doc(db, 'users', uid, 'workouts', workoutId));
}

/** Pure merge/sort step, split out from fetchFeed so it's testable without
 *  a live Firestore connection - see tests/hybrd-app-social.test.mjs. */
export function mergeFeed(perPersonArrays) {
  return perPersonArrays
    .flat()
    .sort((a, b) => b.date.localeCompare(a.date) || (b.publishedAt || '').localeCompare(a.publishedAt || ''));
}

/** Fetches the most recent workouts from everyone `myUid` follows, merged
 *  newest-first. One query per followed person, merged client-side rather
 *  than a fan-out feed collection - simple, and plenty for a personal
 *  friend-group scale. */
export async function fetchFeed(myUid) {
  requireInit();
  const following = await fetchFollowing(myUid);
  const perPerson = await Promise.all(
    following.map(async (person) => {
      const q = fsMod.query(
        fsMod.collection(db, 'users', person.uid, 'workouts'),
        fsMod.orderBy('date', 'desc'),
        fsMod.limit(FEED_LIMIT_PER_PERSON),
      );
      const snap = await fsMod.getDocs(q);
      return snap.docs.map((d) => ({
        id: d.id,
        ownerUid: person.uid,
        ownerUsername: person.username,
        ownerDisplayName: person.displayName,
        ...d.data(),
      }));
    }),
  );
  return mergeFeed(perPerson);
}
