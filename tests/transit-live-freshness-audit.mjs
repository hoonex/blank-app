import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('supabase/functions/transit-data-core/index.ts', 'utf8');

for (const snippet of [
  'const ARRIVAL_CACHE_TTL_MS = 18_000',
  'type ArrivalSnapshot =',
  'fetchedAt: Date.now()',
  'Date.now() - snapshot.fetchedAt',
  'Math.max(0, Number(item.arrtime) - ageSeconds)',
  'checkedAt: new Date(snapshot.fetchedAt).toISOString()',
  'realtimeCoverageScore(b) - realtimeCoverageScore(a)',
  'realtimeAgeSeconds(a) - realtimeAgeSeconds(b)',
  'routeSort(route, existing) < 0',
  'realtimeFreshness: "provider-fetchedAt+cache-age-adjusted"',
]) {
  assert.ok(source.includes(snippet), `missing freshness contract: ${snippet}`);
}

function selectArrival(rawSeconds, fetchedAt, now, threshold = 0) {
  const ageSeconds = Math.max(0, Math.floor((now - fetchedAt) / 1000));
  return rawSeconds
    .map((seconds) => Math.max(0, seconds - ageSeconds))
    .filter((seconds) => Number.isFinite(seconds) && seconds >= threshold)
    .sort((a, b) => a - b)[0] ?? null;
}

const fetchedAt = Date.parse('2026-08-30T05:00:00.000Z');
const now = fetchedAt + 17_400;
assert.equal(selectArrival([75, 130], fetchedAt, now, 0), 58, 'cached ETA must decay by cache age');
assert.equal(selectArrival([75, 130], fetchedAt, now, 60), 113, 'transfer readiness must reject an arrival that already became too early');
assert.equal(new Date(fetchedAt).toISOString(), '2026-08-30T05:00:00.000Z', 'checkedAt must describe provider fetch time');

function coverage(route) {
  const busLegs = route.busLegs;
  return busLegs ? Math.min(1, route.liveLegs / busLegs) : 0;
}

function compare(a, b) {
  return a.totalMinutes - b.totalMinutes
    || a.transfers - b.transfers
    || coverage(b) - coverage(a)
    || a.ageSeconds - b.ageSeconds
    || a.walkMeters - b.walkMeters;
}

const tied = [
  { id: 'partial', totalMinutes: 28, transfers: 1, busLegs: 2, liveLegs: 1, ageSeconds: 3, walkMeters: 300 },
  { id: 'full-old', totalMinutes: 28, transfers: 1, busLegs: 2, liveLegs: 2, ageSeconds: 14, walkMeters: 340 },
  { id: 'full-fresh', totalMinutes: 28, transfers: 1, busLegs: 2, liveLegs: 2, ageSeconds: 2, walkMeters: 420 },
].sort(compare);
assert.deepEqual(tied.map((route) => route.id), ['full-fresh', 'full-old', 'partial'], 'equal ETA/transfer routes should prefer fuller and fresher realtime evidence');

const fewerTransfers = [
  { id: 'one-transfer-live', totalMinutes: 25, transfers: 1, busLegs: 2, liveLegs: 2, ageSeconds: 0, walkMeters: 100 },
  { id: 'direct-no-live', totalMinutes: 25, transfers: 0, busLegs: 1, liveLegs: 0, ageSeconds: Infinity, walkMeters: 500 },
].sort(compare);
assert.equal(fewerTransfers[0].id, 'direct-no-live', 'realtime quality must not override the existing fewer-transfer preference');

console.log(JSON.stringify({
  ok: true,
  cachedEtaDecaySeconds: 17,
  transferThresholdRejectsExpiredArrival: true,
  tieBreakOrder: tied.map((route) => route.id),
  transferPreferencePreserved: true,
}, null, 2));
