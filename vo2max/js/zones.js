/*
 * Heart-rate zone math. Both models are computed live from the editable
 * settings (LTHR, resting HR, max HR) rather than baked in as fixed bpm.
 */

// LTHR model: each zone is a plain percentage of lactate threshold HR.
export const LTHR_ZONES = [
  { key: 'active-recovery', name: 'Active recovery', low: 65, high: 80 },
  { key: 'fat-burning', name: 'Efficient fat burning', low: 81, high: 87 },
  { key: 'aerobic-endurance', name: 'Aerobic endurance', low: 88, high: 92 },
  { key: 'lactate-threshold', name: 'Lactate threshold', low: 93, high: 98 },
  { key: 'anaerobic-endurance', name: 'Anaerobic endurance', low: 99, high: 109, target: true },
];

// RHR model: Karvonen heart-rate-reserve percentages against resting/max HR.
export const RHR_ZONES = [
  { key: 'zone-1', name: 'Zone 1', low: 50, high: 60 },
  { key: 'zone-2', name: 'Zone 2', low: 61, high: 70 },
  { key: 'zone-3', name: 'Zone 3', low: 71, high: 80 },
  { key: 'zone-4', name: 'Zone 4', low: 81, high: 90 },
  { key: 'zone-5', name: 'Zone 5', low: 91, high: 100, target: true },
];

// Zones are contiguous bands: a zone's upper bound is the next zone's lower
// bound minus one, so the table reads as one unbroken bpm scale with no gaps
// or overlaps (this is how the source zone tables were built, and it's why
// e.g. 87% of an LTHR of 181 lands on a displayed high of 158, not 157).
function buildTable(defs, bpmForPercent) {
  const lows = defs.map((z) => Math.floor(bpmForPercent(z.low)));
  return defs.map((z, i) => ({
    ...z,
    bpmLow: lows[i],
    bpmHigh: i < defs.length - 1 ? lows[i + 1] - 1 : Math.floor(bpmForPercent(z.high)),
  }));
}

export function lthrZoneTable(settings) {
  const { lthr } = settings;
  return buildTable(LTHR_ZONES, (pct) => (lthr * pct) / 100);
}

export function rhrZoneTable(settings) {
  const { restingHR, maxHR } = settings;
  const reserve = maxHR - restingHR;
  return buildTable(RHR_ZONES, (pct) => restingHR + (reserve * pct) / 100);
}

export function zoneTable(settings, model) {
  return model === 'rhr' ? rhrZoneTable(settings) : lthrZoneTable(settings);
}

/** The interval target zone (top zone) for whichever model is primary. */
export function targetZone(settings) {
  const table = zoneTable(settings, settings.primaryZoneModel);
  return table.find((z) => z.target) || table[table.length - 1];
}

/** Which zone (if any) a given HR falls in, for a model's table. */
export function zoneForHR(hr, table) {
  if (hr == null || Number.isNaN(hr)) return null;
  return table.find((z) => hr >= z.bpmLow && hr <= z.bpmHigh) || null;
}
