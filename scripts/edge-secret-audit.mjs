import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const manifestPath=path.join(root,'supabase/functions/edge-secrets.json');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));

const requiredContract={
  'school-data':['NEIS_KEY','KAKAO_REST_KEY'],
  'school-logo':['KAKAO_REST_KEY'],
  'university-campus':['KAKAO_REST_KEY'],
  'university-data':[
    'UNIVERSITY_SCHOOL_INFO_KEY',
    'UNIVERSITY_MAJOR_INFO_KEY',
    'UNIVERSITY_FINANCES_KEY',
    'UNIVERSITY_EDUCATION_CONDITION_KEY',
  ],
};

for(const [fn,names] of Object.entries(requiredContract)){
  const actual=manifest?.[fn]?.required;
  if(!Array.isArray(actual))throw new Error(`${fn}: required secret contract missing`);
  for(const name of names){
    if(!actual.includes(name))throw new Error(`${fn}: ${name} missing from secret contract`);
  }
}

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
for(const name of requiredContract['university-data'])requireEnv('supabase/functions/university-data/index.ts',name);

const university=combined.get('supabase/functions/university-data/index.ts')||'';
const routes={
  SchoolInfoService:'UNIVERSITY_SCHOOL_INFO_KEY',
  SchoolMajorInfoService:'UNIVERSITY_MAJOR_INFO_KEY',
  FinancesService:'UNIVERSITY_FINANCES_KEY',
  EducationConditionService:'UNIVERSITY_EDUCATION_CONDITION_KEY',
};
for(const [service,key] of Object.entries(routes)){
  const pattern=new RegExp(`${service}\\s*:\\s*Deno\\.env\\.get\\(["']${key}["']\\)`);
  if(!pattern.test(university))throw new Error(`university-data: ${service} is not routed to ${key}`);
}

const sensitiveAssignment=/(?:const|let|var)\s+(?:NEIS_KEY|KAKAO_REST_KEY|DATA_KEY|UNIVERSITY_[A-Z_]*KEY)\s*=\s*["'][^"'\n]{12,}["']/g;
for(const [file,text] of combined){
  const hits=[...text.matchAll(sensitiveAssignment)];
  if(hits.length)throw new Error(`${file}: hardcoded credential-like assignment detected`);
}

console.log(JSON.stringify({
  ok:true,
  functions:Object.keys(requiredContract),
  universityRoutes:routes,
  scannedFiles:sourceFiles.length,
},null,2));
