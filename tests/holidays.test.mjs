import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOLIDAYS, STATES, HOME_STATE, appliesTo, toneOf, statesLabel, observedLabel,
  holidaysOn, holidaysBetween, tonesByDate, coveredYears,
} from '../js/holidays.js';

test('every entry is well formed', () => {
  for (const h of HOLIDAYS) {
    assert.match(h.date, /^\d{4}-\d{2}-\d{2}$/, `bad date on ${h.name}`);
    // Round-trips through Date, so no 31 February slipping in.
    const [y, m, d] = h.date.split('-').map(Number);
    const parsed = new Date(y, m - 1, d);
    assert.equal(parsed.getMonth(), m - 1, `impossible date: ${h.date}`);
    assert.equal(parsed.getDate(), d, `impossible date: ${h.date}`);

    assert.ok(h.name && typeof h.name === 'string', 'every holiday needs a name');
    assert.ok(h.states === 'national' || Array.isArray(h.states), `bad states on ${h.name}`);
    if (Array.isArray(h.states)) {
      assert.ok(h.states.length > 0, `${h.name} lists no states`);
      for (const code of h.states) {
        assert.ok(STATES[code], `unknown state code "${code}" on ${h.name}`);
      }
    }
  }
});

test('the list is sorted and free of duplicates', () => {
  const dates = HOLIDAYS.map((h) => h.date);
  assert.deepEqual(dates, [...dates].sort(), 'entries must be in date order');

  const seen = new Set();
  for (const h of HOLIDAYS) {
    const key = `${h.date}|${h.name}`;
    assert.ok(!seen.has(key), `duplicate entry: ${key}`);
    seen.add(key);
  }
});

test('national and Selangor holidays are red, other states yellow', () => {
  const national = HOLIDAYS.find((h) => h.name === 'Merdeka Day');
  const selangor = HOLIDAYS.find((h) => h.name === "Sultan of Selangor's Birthday");
  const elsewhere = HOLIDAYS.find((h) => h.name === 'Sarawak Day');

  assert.equal(toneOf(national), 'local');
  assert.equal(toneOf(selangor), 'local');
  assert.equal(toneOf(elsewhere), 'other');

  assert.ok(appliesTo(national));
  assert.ok(appliesTo(selangor));
  assert.ok(!appliesTo(elsewhere));
});

test('the home state is Selangor and it drives the colour', () => {
  assert.equal(HOME_STATE, 'SGR');
  const sarawakOnly = HOLIDAYS.find((h) => h.name === 'Sarawak Day');
  assert.equal(toneOf(sarawakOnly, 'SGR'), 'other');
  assert.equal(toneOf(sarawakOnly, 'SWK'), 'local'); // same data, different state
});

test('a day carrying two holidays reports red first', () => {
  // 1 Feb 2026: Thaipusam (Selangor observes) and Federal Territory Day (does not).
  const both = holidaysOn('2026-02-01');
  assert.equal(both.length, 2);
  assert.deepEqual(tonesByDate().get('2026-02-01'), ['local', 'other']);

  // 22 Jul 2026: Sarawak Day only.
  assert.deepEqual(tonesByDate().get('2026-07-22'), ['other']);
});

test('ranges pick up the right holidays', () => {
  const feb = holidaysBetween('2026-02-01', '2026-02-28');
  assert.deepEqual(feb.map((h) => h.name).sort(), [
    'Chinese New Year', 'Chinese New Year (2nd day)', 'Federal Territory Day', 'Thaipusam',
  ]);
  assert.equal(holidaysBetween('2026-04-16', '2026-04-25').length, 0);
  assert.equal(holidaysBetween('2027-01-01', '2027-12-31').length, 0);
});

test('states read as words', () => {
  assert.equal(statesLabel({ states: 'national' }), 'National');
  assert.equal(statesLabel({ states: ['SGR'] }), 'Selangor');
  assert.equal(statesLabel({ states: ['SBH', 'SWK'] }), 'Sabah, Sarawak');
});

test('the list label leads with your own state', () => {
  assert.equal(observedLabel({ states: 'national' }), 'National holiday');
  assert.equal(observedLabel({ states: ['SGR'] }), 'Selangor');
  assert.equal(observedLabel({ states: ['SGR', 'KUL'] }), 'Selangor + 1 other state');
  assert.equal(
    observedLabel({ states: ['SGR', 'KUL', 'PJY', 'PNG'] }),
    'Selangor + 3 other states',
  );
  // Somewhere else entirely: short lists in full, long ones trimmed.
  assert.equal(observedLabel({ states: ['SBH', 'SWK'] }), 'Sabah, Sarawak');
  assert.equal(observedLabel({ states: ['KUL', 'PJY', 'LBN'] }), 'Kuala Lumpur, Putrajaya, Labuan');
  assert.equal(
    observedLabel({ states: ['JHR', 'KDH', 'KTN', 'MLK'] }),
    'Johor, Kedah + 2 more',
  );
});

test('the big national holidays are all present in 2026', () => {
  const byName = new Map(HOLIDAYS.map((h) => [h.name, h]));
  for (const name of [
    "New Year's Day", 'Chinese New Year', 'Hari Raya Aidilfitri', 'Labour Day',
    'Hari Raya Haji', 'Wesak Day', "Yang di-Pertuan Agong's Birthday", 'Awal Muharram',
    'Maulidur Rasul', 'Merdeka Day', 'Malaysia Day', 'Deepavali', 'Christmas Day',
  ]) {
    assert.ok(byName.has(name), `missing national holiday: ${name}`);
    assert.equal(byName.get(name).states, 'national', `${name} should be national`);
  }
  assert.deepEqual(coveredYears(), ['2026']);
});
