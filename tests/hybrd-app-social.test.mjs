import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidUsername, parseFirebaseConfigInput, mergeFeed } from '../hybrd-app/js/social.js';

test('isValidUsername accepts 3-20 lowercase letters/digits/underscore', () => {
  assert.equal(isValidUsername('davien'), true);
  assert.equal(isValidUsername('Davien_99'), true); // normalized to lowercase before checking
  assert.equal(isValidUsername('ab'), false); // too short
  assert.equal(isValidUsername('a'.repeat(21)), false); // too long
  assert.equal(isValidUsername('has space'), false);
  assert.equal(isValidUsername('has-dash'), false);
  assert.equal(isValidUsername(''), false);
});

test('parseFirebaseConfigInput reads the console-pasted snippet verbatim', () => {
  const raw = `const firebaseConfig = {
    apiKey: "AIzaExample",
    authDomain: "example.firebaseapp.com",
    projectId: "example",
    storageBucket: "example.appspot.com",
    messagingSenderId: "123",
    appId: "1:123:web:abc"
  };`;
  const config = parseFirebaseConfigInput(raw);
  assert.equal(config.apiKey, 'AIzaExample');
  assert.equal(config.projectId, 'example');
  assert.equal(config.appId, '1:123:web:abc');
});

test('parseFirebaseConfigInput accepts the full console snippet (imports, comments, and code after the object)', () => {
  const raw = `// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAig6TTmhteMVaMNgb8fexC_DemXSfbv0g",
  authDomain: "hybrd-app-e50c4.firebaseapp.com",
  projectId: "hybrd-app-e50c4",
  storageBucket: "hybrd-app-e50c4.firebasestorage.app",
  messagingSenderId: "42353936182",
  appId: "1:42353936182:web:659c753a2e49dff0439597",
  measurementId: "G-023HVE12P2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);`;
  const config = parseFirebaseConfigInput(raw);
  assert.equal(config.apiKey, 'AIzaSyAig6TTmhteMVaMNgb8fexC_DemXSfbv0g');
  assert.equal(config.projectId, 'hybrd-app-e50c4');
  assert.equal(config.appId, '1:42353936182:web:659c753a2e49dff0439597');
});

test('parseFirebaseConfigInput also accepts a bare object literal', () => {
  const config = parseFirebaseConfigInput('{ apiKey: "x", authDomain: "x", projectId: "x", appId: "x" }');
  assert.equal(config.apiKey, 'x');
});

test('parseFirebaseConfigInput rejects a config missing required fields', () => {
  assert.throws(() => parseFirebaseConfigInput('{ apiKey: "x" }'), /Missing/);
});

test('parseFirebaseConfigInput rejects unparsable input', () => {
  assert.throws(() => parseFirebaseConfigInput('not an object at all ='), /paste the whole/);
});

test('parseFirebaseConfigInput rejects empty input', () => {
  assert.throws(() => parseFirebaseConfigInput(''), /Paste the firebaseConfig/);
});

test('mergeFeed sorts every followed person\'s workouts together, newest first', () => {
  const feed = mergeFeed([
    [{ id: 'a', date: '2026-08-20', ownerUsername: 'alice' }],
    [
      { id: 'b', date: '2026-08-22', ownerUsername: 'bob' },
      { id: 'c', date: '2026-08-18', ownerUsername: 'bob' },
    ],
  ]);
  assert.deepEqual(feed.map((w) => w.id), ['b', 'a', 'c']);
});

test('mergeFeed breaks a same-date tie by publishedAt, newest first', () => {
  const feed = mergeFeed([
    [
      { id: 'earlier', date: '2026-08-20', publishedAt: '2026-08-20T08:00:00.000Z' },
      { id: 'later', date: '2026-08-20', publishedAt: '2026-08-20T20:00:00.000Z' },
    ],
  ]);
  assert.deepEqual(feed.map((w) => w.id), ['later', 'earlier']);
});

test('mergeFeed returns an empty list when following no one', () => {
  assert.deepEqual(mergeFeed([]), []);
});
