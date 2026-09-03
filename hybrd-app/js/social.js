/*
 * Client-only social feed: follow people, see their workouts. No backend
 * *I* run - the browser talks to Firebase directly (Auth + Firestore).
 * Unlike gcal.js/intervals.js, this is NOT "bring your own project": Social
 * only works if everyone lands in the same Firestore project (otherwise
 * nobody could ever follow anyone else), so the project + OAuth client
 * below are fixed and shared by everyone using this app.
 *
 * These values aren't secrets - a Firebase web config is meant to be public
 * (see Firebase's own docs); what actually protects the data is the
 * Firestore Security Rules (see the README) plus Google Sign-In.
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

export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAig6TTmhteMVaMNgb8fexC_DemXSfbv0g',
  authDomain: 'hybrd-app-e50c4.firebaseapp.com',
  projectId: 'hybrd-app-e50c4',
  storageBucket: 'hybrd-app-e50c4.firebasestorage.app',
  messagingSenderId: '42353936182',
  appId: '1:42353936182:web:659c753a2e49dff0439597',
};

export const DEFAULT_GOOGLE_CLIENT_ID = '42353936182-n6m4l21strlsfqqqqjaqllbc1qvv6u9n.apps.googleusercontent.com';

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

const GIS_SRC = 'https://accounts.google.com/gsi/client';
let gisLoadPromise = null;

function loadGis() {
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) { resolve(); return; }
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

/** Renders Google's own "Sign in with Google" button into the element at
 *  `containerId`. Deliberately NOT using Firebase's own signInWithPopup/
 *  signInWithRedirect - both route the OAuth handshake through
 *  <project>.firebaseapp.com as an intermediary, and that cross-origin hop
 *  is unreliable in an installed iOS Home Screen app (confirmed live,
 *  twice): Safari's storage partitioning for the hop breaks the handoff
 *  back to the app, as either a popup or a full redirect. Google's own
 *  Identity Services button completes the whole exchange between this
 *  origin and accounts.google.com directly, with no Firebase-hosted page
 *  in the loop - the ID token it returns is then handed to Firebase
 *  locally via signInWithCredential, a plain in-memory call with no
 *  navigation of its own.
 * @param {string} googleClientId Google OAuth Web Client ID - NOT the
 *   Firebase config; find it at Firebase Console -> Authentication ->
 *   Sign-in method -> Google -> Web SDK configuration (see the README).
 * @param {string} containerId id of an empty element for Google to render
 *   its button into.
 * @param {(user: {uid, displayName, photoURL}) => void} onSuccess
 * @param {(err: Error) => void} onError */
export async function renderGoogleSignInButton(googleClientId, containerId, onSuccess, onError) {
  requireInit();
  await loadGis();
  window.google.accounts.id.initialize({
    client_id: googleClientId,
    callback: async (response) => {
      try {
        if (!response?.credential) throw new Error('Google sign-in did not return a credential');
        const credential = authMod.GoogleAuthProvider.credential(response.credential);
        const { user } = await authMod.signInWithCredential(auth, credential);
        onSuccess({ uid: user.uid, displayName: user.displayName, photoURL: user.photoURL });
      } catch (err) {
        onError(err);
      }
    },
  });
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  window.google.accounts.id.renderButton(container, { type: 'standard', theme: 'outline', size: 'large', width: 300 });
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
 *  each exercise's own name/muscles/equipment (not just its id) so a
 *  follower's app can render it correctly even for a custom exercise they
 *  don't have locally - same problem/fix as the watch sync's
 *  registerWatchCustomExercises (see app.js). equipment specifically is
 *  needed for a follower's feed to compute volume/exercise rows the same
 *  way the owner's own device would (see app.js's buildFeedWorkoutShareData)
 *  - without it, a Bodyweight-equipment exercise's weightless sets would
 *  silently be treated as not logged at all. */
export async function publishWorkout(uid, workout, exerciseById) {
  requireInit();
  const exercises = workout.exercises.map((e) => {
    const ex = exerciseById(e.exerciseId);
    return {
      ...e,
      exercise: ex ? {
        id: ex.id, name: ex.name, muscles: ex.muscles || [], equipment: ex.equipment || null,
      } : null,
    };
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

/** Publishes a run/ride/swim/etc. session as-is - unlike a workout, a
 *  session has no local-only reference data (no exercise ids to resolve),
 *  so every field on it is already safe to store verbatim. `id` becomes the
 *  doc id instead of a field, and the two sync-linkage ids are dropped
 *  (meaningless to anyone but the owner's own device). */
export async function publishRun(uid, session) {
  requireInit();
  const { id, intervalsActivityId, gcalEventId, ...rest } = session;
  await fsMod.setDoc(fsMod.doc(db, 'users', uid, 'runs', session.id), {
    ...rest,
    publishedAt: new Date().toISOString(),
  });
}

export async function unpublishRun(uid, runId) {
  requireInit();
  await fsMod.deleteDoc(fsMod.doc(db, 'users', uid, 'runs', runId));
}

function activityCollection(kind) {
  return kind === 'run' ? 'runs' : 'workouts';
}

/** Pure merge/sort step, split out from fetchFeed so it's testable without
 *  a live Firestore connection - see tests/hybrd-app-social.test.mjs. */
export function mergeFeed(perPersonArrays) {
  return perPersonArrays
    .flat()
    .sort((a, b) => b.date.localeCompare(a.date) || (b.publishedAt || '').localeCompare(a.publishedAt || ''));
}

/** Fetches the most recent workouts AND run/ride/swim/etc. sessions from
 *  everyone `myUid` follows, merged newest-first and tagged with `kind` so
 *  the feed can render/open each appropriately. Two queries per followed
 *  person (one per collection), merged client-side rather than a fan-out
 *  feed collection - simple, and plenty for a personal friend-group scale. */
export async function fetchFeed(myUid) {
  requireInit();
  const following = await fetchFollowing(myUid);
  const perPerson = await Promise.all(
    following.map(async (person) => {
      const owner = { ownerUid: person.uid, ownerUsername: person.username, ownerDisplayName: person.displayName };
      // Each collection fetched independently, failures swallowed to an
      // empty array rather than left to reject - e.g. someone who hasn't
      // pasted the newer Security Rules yet still has a working feed for
      // workouts even though the newer `runs` collection 404s/permission-
      // denies for everyone until they do. Without this, one bad query for
      // one followed person's one activity kind would blank the *entire*
      // feed (Promise.all rejects the whole batch on a single rejection).
      const fetchKind = async (kind) => {
        try {
          const q = fsMod.query(
            fsMod.collection(db, 'users', person.uid, activityCollection(kind)),
            fsMod.orderBy('date', 'desc'),
            fsMod.limit(FEED_LIMIT_PER_PERSON),
          );
          const snap = await fsMod.getDocs(q);
          return snap.docs.map((d) => ({ id: d.id, kind, ...owner, ...d.data() }));
        } catch (err) {
          console.error(`feed fetch failed for ${person.uid}/${kind}`, err);
          return [];
        }
      };
      const [workoutItems, runItems] = await Promise.all([fetchKind('workout'), fetchKind('run')]);
      return [...workoutItems, ...runItems];
    }),
  );
  return mergeFeed(perPerson);
}

/** True if `myUid` has already liked this activity - checked only when its
 *  detail sheet opens (not per feed card, to keep the feed list itself
 *  cheap - see countLikesAndComments for the card-level counts). */
export async function isLikedByMe(ownerUid, kind, activityId, myUid) {
  requireInit();
  const snap = await fsMod.getDoc(fsMod.doc(db, 'users', ownerUid, activityCollection(kind), activityId, 'likes', myUid));
  return snap.exists();
}

export async function likeActivity(ownerUid, kind, activityId, myUid) {
  requireInit();
  await fsMod.setDoc(fsMod.doc(db, 'users', ownerUid, activityCollection(kind), activityId, 'likes', myUid), {
    likedAt: new Date().toISOString(),
  });
}

export async function unlikeActivity(ownerUid, kind, activityId, myUid) {
  requireInit();
  await fsMod.deleteDoc(fsMod.doc(db, 'users', ownerUid, activityCollection(kind), activityId, 'likes', myUid));
}

/** Oldest-first, for a normal chat-like comment thread. */
export async function fetchComments(ownerUid, kind, activityId) {
  requireInit();
  const q = fsMod.query(
    fsMod.collection(db, 'users', ownerUid, activityCollection(kind), activityId, 'comments'),
    fsMod.orderBy('createdAt', 'asc'),
  );
  const snap = await fsMod.getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addComment(ownerUid, kind, activityId, author, text) {
  requireInit();
  const ref = fsMod.doc(fsMod.collection(db, 'users', ownerUid, activityCollection(kind), activityId, 'comments'));
  await fsMod.setDoc(ref, {
    authorUid: author.uid,
    authorUsername: author.username,
    text,
    createdAt: new Date().toISOString(),
  });
  return ref.id;
}

export async function deleteComment(ownerUid, kind, activityId, commentId) {
  requireInit();
  await fsMod.deleteDoc(fsMod.doc(db, 'users', ownerUid, activityCollection(kind), activityId, 'comments', commentId));
}

/** Live like/comment counts for one activity, via count() aggregation
 *  queries rather than fetching every doc - cheap regardless of how many
 *  likes/comments pile up. Used to show counts on each feed card without
 *  needing denormalized counters (which would need followers to have
 *  field-scoped write access to someone else's activity doc - not worth
 *  the security-rules complexity at this scale). */
export async function countLikesAndComments(ownerUid, kind, activityId) {
  requireInit();
  const activityRef = fsMod.doc(db, 'users', ownerUid, activityCollection(kind), activityId);
  const [likes, comments] = await Promise.all([
    fsMod.getCountFromServer(fsMod.collection(activityRef, 'likes')),
    fsMod.getCountFromServer(fsMod.collection(activityRef, 'comments')),
  ]);
  return { likeCount: likes.data().count, commentCount: comments.data().count };
}
