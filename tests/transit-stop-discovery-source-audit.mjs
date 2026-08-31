import fs from 'node:fs';

const source=fs.readFileSync('supabase/functions/transit-data-core/index.ts','utf8');
const required=[
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
for(const [name,pattern] of required){
  if(!pattern.test(source)) throw new Error(`Transit stop-discovery contract missing: ${name}`);
}
if(/let candidates = normalizeStops\(direct\.items, x, y\);/.test(source)){
  throw new Error('Direct TAGO stops can still be discarded when citycode is omitted');
}
console.log(JSON.stringify({ok:true,contract:'coordinate+resolved-citycode -> direct TAGO -> city master fallback',daeguCityCode:'22'},null,2));
