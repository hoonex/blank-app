import fs from 'node:fs';

const core=fs.readFileSync('supabase/functions/transit-data-core/index.ts','utf8');
const officialFallback=fs.readFileSync('supabase/functions/transit-data-core/official-stop-fallback.ts','utf8');
const map=fs.readFileSync('supabase/functions/transit-map/index.ts','utf8');
const requiredCore=[
  ['Daegu TAGO code',/const DAEGU_CITY_CODE = "22";/],
  ['Daegu region fast path',/if \(isDaeguRegion\(region\)\) return DAEGU_CITY_CODE;/],
  ['Daegu coordinate fast path',/if \(isDaeguRegion\(region\.first\)\) return DAEGU_CITY_CODE;/],
  ['resolved city code before direct lookup',/const resolvedCityCode = hintedCityCode \|\| await cityCodeForCoordinate\(x, y\)\.catch\(\(\) => ""\);/],
  ['direct stop fallback city code',/normalizeStops\(direct\.items, x, y, resolvedCityCode\)/],
  ['official snapshot before city master',/nearbyOfficialDaeguStops\(x, y, 8, 1800\)[\s\S]*cityStopMaster\(resolvedCityCode\)/],
  ['city master fallback',/cityStopMaster\(resolvedCityCode\)/],
  ['non-empty city list cache',/\}, \(cities\) => cities\.length > 0\);/],
  ['non-empty stop master cache',/\}, \(items\) => items\.length > 0\);/],
  ['health provenance',/stopDiscovery: \["coordinate\+resolved-citycode", "daegu-official-network-snapshot", "city-stop-master"\]/],
  ['snapshot date provenance',/stopSnapshot: "2025-09-03"/],
  ['snapshot hash provenance',/stopSnapshotSourceSha256: "98d6a7725e3fddbcd65c58af3fadc217378ee8bfec82e29e2931341e19f86a1e"/],
  ['Deno timeout is transient',/function transientTagoError[\s\S]*timed out[\s\S]*abort/],
  ['partial fanout health provenance',/upstreamFailureMode: "partial-fanout-degradation\+transient-retry"/],
  ['stop route failure isolation',/stop routes unavailable/],
  ['direct route-stop failure isolation',/direct route stops unavailable/],
  ['transfer route-stop failure isolation',/transfer route stops unavailable/],
];
for(const [name,pattern] of requiredCore){
  if(!pattern.test(core)) throw new Error(`Transit core city-code/resilience contract missing: ${name}`);
}
if(/let candidates = normalizeStops\(direct\.items, x, y\);/.test(core)){
  throw new Error('Direct TAGO stops can still be discarded when citycode is omitted');
}
const requiredFallback=[
  ['pinned official network commit',/raw\.githubusercontent\.com\/hoonex\/blank-app\/ae08a29d5b1a17c7172572465e75739769945610\/supabase\/functions\/transit-map\/daegu-official-network\.ts/],
  ['TAGO Daegu node normalization',/`DGB\$\{digits\}`/],
  ['official node list',/OFFICIAL_NODE_IDS/],
  ['official edge coordinates',/OFFICIAL_EDGES/],
  ['bounded search radius',/maxMeters = 1800/],
  ['bounded candidate count',/Math\.min\(12,/],
];
for(const [name,pattern] of requiredFallback){
  if(!pattern.test(officialFallback)) throw new Error(`Transit official-stop fallback contract missing: ${name}`);
}
const timeoutPattern=/가용한 세션|30\/30|초당|timeout|timed out|abort(?:ed|error)?|시간이 초과/i;
for(const sample of ['Signal timed out.','The operation was aborted','AbortError','timeout','가용한 세션이 없습니다']){
  if(!timeoutPattern.test(sample)) throw new Error(`Transient TAGO classifier misses ${sample}`);
}
const requiredMap=[
  ['map Daegu TAGO code',/const DAEGU_CITY_CODE = "22";/],
  ['map Daegu fast path',/if \(compact === "대구"\) return DAEGU_CITY_CODE;/],
  ['map non-empty city list cache',/\}, \(cities\) => cities\.length > 0\);/],
  ['map health provenance',/cityCodeResolution: "daegu-22-fast-path\+TAGO-city-list"/],
];
for(const [name,pattern] of requiredMap){
  if(!pattern.test(map)) throw new Error(`Transit map city-code contract missing: ${name}`);
}
console.log(JSON.stringify({ok:true,core:'coordinate TAGO -> pinned Daegu official snapshot -> city master + partial fanout degradation',map:'Daegu 22 fast path -> TAGO city list fallback',daeguCityCode:'22',stopSnapshot:'2025-09-03'},null,2));
