import fs from 'node:fs';

const source = fs.readFileSync('school-metrics.js','utf8');

const required = [
  ['localhost-only host predicate', /function isTransitLabHost\(hostname=location\.hostname\)\{\s*return hostname==='localhost' \|\| hostname==='127\.0\.0\.1';\s*\}/],
  ['lab flag', /const transitLabEnabled = isTransitLabHost\(\);/],
  ['production dormant marker', /if\(!transitLabEnabled\) document\.body\.dataset\.flowTransitSurface = 'dormant';/],
  ['production import short-circuit', /const transitPromise = !transitLabEnabled\s*\? Promise\.resolve\(null\)\s*:\s*import\('\.\/school-transit\.js'\)\.catch\(\(\)=>null\);/],
  ['destination install production guard', /function installTransitDestination\(\)\{\s*if\(!transitLabEnabled\) return;/],
  ['lab map lazy import', /await import\('\.\/school-transit-map\.js'\)/],
  ['lab focus lazy import', /await import\('\.\/school-transit-focus\.js'\)/],
];

for (const [label, pattern] of required) {
  if (!pattern.test(source)) throw new Error(`School Transit retirement contract missing: ${label}`);
}

if (/^\s*import\s+['"]\.\/school-transit/m.test(source)) {
  throw new Error('Production School still has a static Transit import');
}

const transitImports = source.match(/import\('\.\/school-transit\.js'\)/g) || [];
if (transitImports.length !== 1) {
  throw new Error(`Expected exactly one localhost-gated Transit entry import, found ${transitImports.length}`);
}

const dormantIndex = source.indexOf("document.body.dataset.flowTransitSurface = 'dormant'");
const importIndex = source.indexOf("import('./school-transit.js')");
if (dormantIndex < 0 || importIndex < 0 || dormantIndex > importIndex) {
  throw new Error('Transit dormant production state must be established before the lab-only import expression');
}

console.log(JSON.stringify({
  ok: true,
  production: 'transit-dormant',
  labHosts: ['localhost','127.0.0.1'],
  entryImports: transitImports.length,
}, null, 2));
