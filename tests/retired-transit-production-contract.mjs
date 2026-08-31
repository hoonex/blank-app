import fs from 'node:fs';

const metrics = fs.readFileSync('school-metrics.js', 'utf8');
const worker = fs.readFileSync('cloudflare-worker.mjs', 'utf8');
const vercel = fs.readFileSync('vercel.json', 'utf8');

if (!metrics.includes("host!=='127.0.0.1'&&host!=='localhost'")) {
  throw new Error('School Transit must remain localhost-lab-only');
}
if (worker.includes("'/transit':'/index.html'")) {
  throw new Error('Cloudflare must not expose the retired /transit clean route');
}
if (/"source"\s*:\s*"\/transit"/.test(vercel)) {
  throw new Error('Vercel must not expose the retired /transit clean route');
}

const retiredWorkflows = [
  '.github/workflows/school-transit-audit.yml',
  '.github/workflows/school-transit-focus-audit.yml',
  '.github/workflows/transit-kric-probe.yml',
  '.github/workflows/transit-live-freshness-audit.yml',
  '.github/workflows/transit-live-map-audit.yml',
  '.github/workflows/transit-mixed-audit.yml',
];
for (const file of retiredWorkflows) {
  if (fs.existsSync(file)) throw new Error(`Retired Transit workflow must stay removed: ${file}`);
}

console.log('Retired Transit production contract is clean');
