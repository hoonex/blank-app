import fs from 'node:fs';

const core=fs.readFileSync('supabase/functions/transit-data-core/index.ts','utf8');
const map=fs.readFileSync('supabase/functions/transit-map/index.ts','utf8');
const requiredCore=[
  ['Daegu TAGO code',/const DAEGU_CITY_CODE = "22";/],
  ['Daegu region fast path',/if \(isDaeguRegion\(region\)\) return DAEGU_CITY_CODE;/],
  ['Daegu coordinate fast path',/if \(isDaeguRegion\(region\.first\)\) return DAEGU_CITY_CODE;/],
  ['resolved city code before direct lookup',/const resolvedCityCode = hintedCityCode \|\| await cityCodeForCoordinate\(x, y\)\.catch\(\(\) => ""\);/],
  ['direct stop fallback city code',/normalizeStops\(direct\.items, x, y, resolvedCityCode\)/],
  ['city master fallback',/cityStopMaster\(resolvedCityCode\)/],
  ['non-empty city list cache',/\}, \(cities\) => cities\.length > 0\);/],
  ['non-empty stop master cache',/\}, \(items\) => items\.length > 0\);/],
  ['health provenance',/stopDiscovery: \["coordinate\+resolved-citycode", "city-stop-master"\]/],
];
for(const [name,pattern] of requiredCore){
  if(!pattern.test(core)) throw new Error(`Transit core city-code contract missing: ${name}`);
}
if(/let candidates = normalizeStops\(direct\.items, x, y\);/.test(core)){
  throw new Error('Direct TAGO stops can still be discarded when citycode is omitted');
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
console.log(JSON.stringify({ok:true,core:'coordinate+resolved-citycode -> direct TAGO -> city master fallback',map:'Daegu 22 fast path -> TAGO city list fallback',daeguCityCode:'22'},null,2));
