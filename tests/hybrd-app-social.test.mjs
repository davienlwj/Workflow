import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidUsername, mergeFeed, DEFAULT_FIREBASE_CONFIG, DEFAULT_GOOGLE_CLIENT_ID } from '../hybrd-app/js/social.js';

test('isValidUsername accepts 3-20 lowercase letters/digits/underscore', () => {
  assert.equal(isValidUsername('davien'), true);
  assert.equal(isValidUsername('Davien_99'), true); // normalized to lowercase before checking
  assert.equal(isValidUsername('ab'), false); // too short
  assert.equal(isValidUsername('a'.repeat(21)), false); // too long
  assert.equal(isValidUsername('has space'), false);
  assert.equal(isValidUsername('has-dash'), false);
  assert.equal(isValidUsername(''), false);
});

test('DEFAULT_FIREBASE_CONFIG carries every field Firebase requires to init', () => {
  for (const key of ['apiKey', 'authDomain', 'projectId', 'appId']) {
    assert.equal(typeof DEFAULT_FIREBASE_CONFIG[key], 'string');
    assert.ok(DEFAULT_FIREBASE_CONFIG[key].length > 0);
  }
});

test('DEFAULT_GOOGLE_CLIENT_ID is a non-empty string', () => {
  assert.equal(typeof DEFAULT_GOOGLE_CLIENT_ID, 'string');
  assert.ok(DEFAULT_GOOGLE_CLIENT_ID.length > 0);
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
