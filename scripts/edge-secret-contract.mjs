import fs from 'node:fs';

const source=fs.readFileSync('supabase/functions/university-data/index.ts','utf8');
const docs=fs.readFileSync('supabase/functions/README.md','utf8');
const universityKeys=[
  'UNIVERSITY_SCHOOL_INFO_KEY',
  'UNIVERSITY_MAJOR_INFO_KEY',
  'UNIVERSITY_FINANCES_KEY',
  'UNIVERSITY_EDUCATION_CONDITION_KEY',
];
const allKeys=['KAKAO_REST_KEY','NEIS_KEY',...universityKeys];

for(const key of universityKeys){
  if(!source.includes(`Deno.env.get(envName)`) || !source.includes(key))throw new Error(`university-data missing env contract for ${key}`);
}
for(const key of allKeys){
  if(!docs.includes(`\`${key}\``))throw new Error(`secret contract docs missing ${key}`);
}
for(const forbidden of [
  /const\s+DATA_KEY\s*=\s*["']/,
  /serviceKey=\$\{DATA_KEY\}/,
  /UNIVERSITY_DATA_KEY/,
]){
  if(forbidden.test(source))throw new Error(`forbidden shared/hardcoded university key pattern: ${forbidden}`);
}
if(!source.includes('serviceKey(service)'))throw new Error('service-specific credential selection is missing');
if(!source.includes('/%[0-9A-Fa-f]{2}/.test(value) ? value : encodeURIComponent(value)'))throw new Error('encoded/decoded data.go.kr key normalization is missing');

console.log('edge secret contract: ok');
