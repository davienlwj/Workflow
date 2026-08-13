/*
 * Workflow - Malaysian public holidays.
 *
 * Colour follows whether the day is actually a holiday for you, in Selangor:
 *
 *   red     national holidays, and state holidays Selangor observes
 *   yellow  holidays that only apply to other states
 *
 * Change HOME_STATE below to re-colour the calendar for another state; nothing
 * else needs touching.
 *
 * Each entry is { date, name, states }, where states is either the string
 * 'national' or an array of state codes. To add a year, append its entries and
 * keep the list sorted by date - tests/holidays.test.mjs checks the shape.
 */

export const HOME_STATE = 'SGR';

export const STATES = {
  JHR: 'Johor', KDH: 'Kedah', KTN: 'Kelantan', MLK: 'Melaka', NSN: 'Negeri Sembilan',
  PHG: 'Pahang', PNG: 'Penang', PRK: 'Perak', PLS: 'Perlis', SBH: 'Sabah',
  SWK: 'Sarawak', SGR: 'Selangor', TRG: 'Terengganu',
  KUL: 'Kuala Lumpur', LBN: 'Labuan', PJY: 'Putrajaya',
};

/**
 * 2026. Dates set by moon sighting (marked `lunar`) are the published
 * estimates and are occasionally shifted by a day when confirmed officially.
 */
export const HOLIDAYS = [
  { date: '2026-01-01', name: "New Year's Day", states: 'national' },
  { date: '2026-01-14', name: "Yang di-Pertuan Besar of Negeri Sembilan's Birthday", states: ['NSN'] },
  { date: '2026-02-01', name: 'Thaipusam', states: ['SGR', 'KUL', 'PJY', 'PNG', 'PRK', 'NSN', 'JHR', 'KDH'], lunar: true },
  { date: '2026-02-01', name: 'Federal Territory Day', states: ['KUL', 'PJY', 'LBN'] },
  { date: '2026-02-17', name: 'Chinese New Year', states: 'national', lunar: true },
  { date: '2026-02-18', name: 'Chinese New Year (2nd day)', states: 'national', lunar: true },
  { date: '2026-03-07', name: 'Nuzul Al-Quran', states: ['SGR', 'KUL', 'PJY', 'LBN', 'PNG', 'PRK', 'PHG', 'TRG', 'KTN', 'PLS', 'SBH'], lunar: true },
  { date: '2026-03-21', name: 'Hari Raya Aidilfitri', states: 'national', lunar: true },
  { date: '2026-03-22', name: 'Hari Raya Aidilfitri (2nd day)', states: 'national', lunar: true },
  { date: '2026-03-23', name: "Sultan of Johor's Birthday", states: ['JHR'] },
  { date: '2026-04-03', name: 'Good Friday', states: ['SBH', 'SWK'] },
  { date: '2026-04-15', name: 'Declaration of Melaka as a Historical City', states: ['MLK'] },
  { date: '2026-04-26', name: "Sultan of Terengganu's Birthday", states: ['TRG'] },
  { date: '2026-05-01', name: 'Labour Day', states: 'national' },
  { date: '2026-05-17', name: "Raja of Perlis's Birthday", states: ['PLS'] },
  { date: '2026-05-27', name: 'Hari Raya Haji', states: 'national', lunar: true },
  { date: '2026-05-30', name: 'Kaamatan Harvest Festival', states: ['SBH', 'LBN'] },
  { date: '2026-05-31', name: 'Kaamatan Harvest Festival (2nd day)', states: ['SBH', 'LBN'] },
  { date: '2026-05-31', name: 'Wesak Day', states: 'national', lunar: true },
  { date: '2026-06-01', name: "Yang di-Pertuan Agong's Birthday", states: 'national' },
  { date: '2026-06-01', name: 'Gawai Dayak', states: ['SWK'] },
  { date: '2026-06-02', name: 'Gawai Dayak (2nd day)', states: ['SWK'] },
  { date: '2026-06-17', name: 'Awal Muharram', states: 'national', lunar: true },
  { date: '2026-06-21', name: "Sultan of Kedah's Birthday", states: ['KDH'] },
  { date: '2026-07-11', name: "Governor of Penang's Birthday", states: ['PNG'] },
  { date: '2026-07-22', name: 'Sarawak Day', states: ['SWK'] },
  { date: '2026-07-30', name: "Sultan of Pahang's Birthday", states: ['PHG'] },
  { date: '2026-08-24', name: "Governor of Melaka's Birthday", states: ['MLK'] },
  { date: '2026-08-25', name: 'Maulidur Rasul', states: 'national', lunar: true },
  { date: '2026-08-31', name: 'Merdeka Day', states: 'national' },
  { date: '2026-09-16', name: 'Malaysia Day', states: 'national' },
  { date: '2026-10-03', name: "Governor of Sabah's Birthday", states: ['SBH'] },
  { date: '2026-10-10', name: "Governor of Sarawak's Birthday", states: ['SWK'] },
  { date: '2026-11-08', name: 'Deepavali', states: 'national', lunar: true },
  { date: '2026-12-11', name: "Sultan of Selangor's Birthday", states: ['SGR'] },
  { date: '2026-12-25', name: 'Christmas Day', states: 'national' },
];

/** Does this holiday apply where you are? */
export function appliesTo(holiday, state = HOME_STATE) {
  return holiday.states === 'national' || holiday.states.includes(state);
}

/** 'local' paints red, 'other' paints yellow. */
export function toneOf(holiday, state = HOME_STATE) {
  return appliesTo(holiday, state) ? 'local' : 'other';
}

/** Who observes it, in words: "National", "Selangor", "Sabah, Sarawak". */
export function statesLabel(holiday) {
  if (holiday.states === 'national') return 'National';
  return holiday.states.map((code) => STATES[code] || code).join(', ');
}

/**
 * The one-line version for the list. Your own state leads and the rest are
 * counted, so a holiday you get reads "Selangor + 7 others" rather than a
 * paragraph of state names.
 */
export function observedLabel(holiday, state = HOME_STATE) {
  if (holiday.states === 'national') return 'National holiday';

  const names = holiday.states.map((code) => STATES[code] || code);
  if (holiday.states.includes(state)) {
    const others = names.length - 1;
    if (!others) return STATES[state];
    return `${STATES[state]} + ${others} other state${others > 1 ? 's' : ''}`;
  }
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} + ${names.length - 2} more`;
}

export function holidaysOn(iso) {
  return HOLIDAYS.filter((h) => h.date === iso);
}

export function holidaysBetween(startISO, endISO) {
  return HOLIDAYS.filter((h) => h.date >= startISO && h.date <= endISO);
}

/**
 * ISO date -> the tones to show on that day's calendar cell, red first so a
 * day that is a holiday for you always reads red even if it also carries a
 * holiday for somewhere else.
 */
export function tonesByDate(state = HOME_STATE) {
  const map = new Map();
  for (const h of HOLIDAYS) {
    const tone = toneOf(h, state);
    const tones = map.get(h.date) || [];
    if (!tones.includes(tone)) tones.push(tone);
    map.set(h.date, tones.sort((a, b) => (a === 'local' ? -1 : 1)));
  }
  return map;
}

/** The years the bundled data covers, for the "no data yet" notice. */
export function coveredYears() {
  return [...new Set(HOLIDAYS.map((h) => h.date.slice(0, 4)))].sort();
}
