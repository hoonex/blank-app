import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const manifestPath=path.join(root,'supabase/functions/edge-secrets.json');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));

const requiredContract={
  'school-data':['NEIS_KEY','KAKAO_REST_KEY'],
  'school-logo':['KAKAO_REST_KEY'],
  'university-campus':['KAKAO_REST_KEY'],
  'university-data':['DATA_GO_KR_SERVICE_KEY'],
  'transit-data':['DATA_GO_KR_SERVICE_KEY','KAKAO_REST_KEY','SUPABASE_SERVICE_ROLE_KEY'],
  'transit-data-core':['DATA_GO_KR_SERVICE_KEY','KAKAO_REST_KEY'],
  'transit-map':['DATA_GO_KR_SERVICE_KEY'],
  'transit-rail':['KAKAO_REST_KEY'],
};

for(const [fn,names] of Object.entries(requiredContract)){
  const actual=manifest?.[fn]?.required;
  if(!Array.isArray(actual))throw new Error(`${fn}: required secret contract missing`);
  for(const name of names){
    if(!actual.includes(name))throw new Error(`${fn}: ${name} missing from secret contract`);
  }
}
if(manifest?.['university-data']?.entrypoint!=='bootstrap.ts')throw new Error('university-data: shared-key bootstrap entrypoint missing');
if(manifest?.['transit-data-core']?.access!=='service-role-jwt-only')throw new Error('transit-data-core: protected access contract missing');

const sourceFiles=[];
function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full);
    else if(entry.isFile()&&entry.name.endsWith('.ts'))sourceFiles.push(full);
  }
}
walk(path.join(root,'supabase/functions'));

const combined=new Map(sourceFiles.map(file=>[
  path.relative(root,file).replaceAll('\\','/'),
  fs.readFileSync(file,'utf8'),
]));

function requireEnv(file,name){
  const text=combined.get(file)||'';
  if(!text.includes(`Deno.env.get("${name}")`)&&!text.includes(`Deno.env.get('${name}')`)){
    throw new Error(`${file}: must read ${name} from Deno.env`);
  }
}

requireEnv('supabase/functions/school-data/index.ts','NEIS_KEY');
requireEnv('supabase/functions/school-data/index.ts','KAKAO_REST_KEY');
requireEnv('supabase/functions/school-logo/index.ts','KAKAO_REST_KEY');
requireEnv('supabase/functions/university-campus/config.ts','KAKAO_REST_KEY');
requireEnv('supabase/functions/university-data/bootstrap.ts','DATA_GO_KR_SERVICE_KEY');
requireEnv('supabase/functions/transit-data/index.ts','DATA_GO_KR_SERVICE_KEY');
requireEnv('supabase/functions/transit-data/index.ts','KAKAO_REST_KEY');
requireEnv('supabase/functions/transit-data/index.ts','SUPABASE_SERVICE_ROLE_KEY');
requireEnv('supabase/functions/transit-data-core/index.ts','DATA_GO_KR_SERVICE_KEY');
requireEnv('supabase/functions/transit-data-core/index.ts','KAKAO_REST_KEY');
requireEnv('supabase/functions/transit-map/index.ts','DATA_GO_KR_SERVICE_KEY');
requireEnv('supabase/functions/transit-rail/index.ts','KAKAO_REST_KEY');

const transitGate=combined.get('supabase/functions/transit-data/index.ts')||'';
for(const expected of ['OUT_OF_SERVICE_AREA','daegu-only-source+destination','service-role-jwt-only','SUPABASE_SERVICE_ROLE_KEY','Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`']){
  if(!transitGate.includes(expected))throw new Error(`transit-data: protected Daegu gate contract ${expected} missing`);
}
if(/ODSAY_API_KEY|api\.odsay\.com/.test(transitGate))throw new Error('transit-data: ODsay dependency must not be required');

const transitCore=combined.get('supabase/functions/transit-data-core/index.ts')||'';
if(/ODSAY_API_KEY|api\.odsay\.com/.test(transitCore))throw new Error('transit-data-core: ODsay dependency must not be required');
for(const expected of ['getCrdntPrxmtSttnList','getSttnThrghRouteList','getRouteAcctoThrghSttnList','getSttnAcctoArvlPrearngeInfoList']){
  if(!transitCore.includes(expected))throw new Error(`transit-data-core: public routing operation ${expected} missing`);
}
const transitMap=combined.get('supabase/functions/transit-map/index.ts')||'';
for(const expected of ['getSttnThrghRouteList','getRouteAcctoThrghSttnList','getRouteAcctoBusLcList']){
  if(!transitMap.includes(expected))throw new Error(`transit-map: public map operation ${expected} missing`);
}
const transitRail=combined.get('supabase/functions/transit-rail/index.ts')||'';
for(const expected of ['SW8','KRIC-snapshot+Kakao-SW8','Daegu-1-2-3','2026-06-30','subway-direct','subway-one-transfer']){
  if(!transitRail.includes(expected))throw new Error(`transit-rail: rail routing contract ${expected} missing`);
}
if(/openapi\.kric\.go\.kr|KRIC_API_KEY|KRIC_SERVICE_KEY/.test(transitRail))throw new Error('transit-rail: unapproved runtime KRIC key dependency must not be introduced');

const university=combined.get('supabase/functions/university-data/index.ts')||'';
const compatibilityRoutes={
  SchoolInfoService:'UNIVERSITY_SCHOOL_INFO_KEY',
  SchoolMajorInfoService:'UNIVERSITY_MAJOR_INFO_KEY',
  FinancesService:'UNIVERSITY_FINANCES_KEY',
  EducationConditionService:'UNIVERSITY_EDUCATION_CONDITION_KEY',
};
for(const [service,key] of Object.entries(compatibilityRoutes)){
  const pattern=new RegExp(`${service}\\s*:\\s*Deno\\.env\\.get\\(["']${key}["']\\)`);
  if(!pattern.test(university))throw new Error(`university-data: compatibility route ${service} -> ${key} missing`);
}
const universityBootstrap=combined.get('supabase/functions/university-data/bootstrap.ts')||'';
if(!universityBootstrap.includes('Deno.env.set("UNIVERSITY_DATA_KEY"'))throw new Error('university-data: shared key is not bridged to compatibility alias');

const sensitiveAssignment=/(?:const|let|var)\s+(?:[A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN))\s*=\s*["'][^"'\n]{12,}["']/g;
for(const [file,text] of combined){
  const hits=[...text.matchAll(sensitiveAssignment)];
  if(hits.length)throw new Error(`${file}: hardcoded credential-like assignment detected`);
}

console.log(JSON.stringify({
  ok:true,
  functions:Object.keys(requiredContract),
  transitProvider:'TAGO-public-data + Daegu rail snapshot',
  transitAccess:'Daegu gate + service-role-jwt-only core',
  universityCompatibilityRoutes:compatibilityRoutes,
  scannedFiles:sourceFiles.length,
},null,2));
