import assert from 'node:assert/strict';
import {discoverOfficialDgeMark,dgeSchoolHost,officialMarkFromHtml,symbolLinks} from '../supabase/functions/_shared/school-media-parser.js';

const home='https://jeongdong.dge.hs.kr/jeongdongh/main.do';
const host='jeongdong.dge.hs.kr';

assert.equal(dgeSchoolHost(host),true);
assert.equal(dgeSchoolHost('school.example.com'),false);

const homeHtml=`<!doctype html><html><body>
  <a href="/jeongdongh/ss/schulSymbol/selectSongSymbolInfo.do?mi=12345">학교상징</a>
  <a href="https://evil.example/symbol">교표</a>
  <img alt="메인 배너" src="/upload/banner.jpg">
</body></html>`;
const links=symbolLinks(homeHtml,home,host);
assert.deepEqual(links,['https://jeongdong.dge.hs.kr/jeongdongh/ss/schulSymbol/selectSongSymbolInfo.do?mi=12345']);

const symbolHtml=`<!doctype html><html><body>
  <img alt="교화 장미" src="/upload/flower.png">
  <img alt="교목 소나무" src="/upload/tree.png">
  <img alt="교기" src="/upload/flag.png">
  <img alt="교표" src="/upload/school-symbol.png">
</body></html>`;
assert.equal(officialMarkFromHtml(symbolHtml,home,host),'https://jeongdong.dge.hs.kr/upload/school-symbol.png');

const externalOnly=`<img alt="교표" src="https://cdn.example.com/fake-logo.png">`;
assert.equal(officialMarkFromHtml(externalOnly,home,host),'');

const direct=`<img alt="학교 로고" src="/images/logo.png">`;
assert.equal(officialMarkFromHtml(direct,home,host),'https://jeongdong.dge.hs.kr/images/logo.png');

const requests=[];
const fetchFixture=async(url)=>{
  requests.push(String(url));
  return new Response(symbolHtml,{status:200,headers:{'content-type':'text/html; charset=utf-8'}});
};
const discovered=await discoverOfficialDgeMark(homeHtml,home,fetchFixture);
assert.equal(discovered,'https://jeongdong.dge.hs.kr/upload/school-symbol.png');
assert.deepEqual(requests,links);

let called=false;
const nonDge=await discoverOfficialDgeMark('<a href="/symbol">학교상징</a>','https://school.example.com/',async()=>{called=true;return new Response('')});
assert.equal(nonDge,'');
assert.equal(called,false);

const dataSrc=`<img alt="교표" data-src="/upload/lazy-symbol.webp">`;
assert.equal(officialMarkFromHtml(dataSrc,home,host),'https://jeongdong.dge.hs.kr/upload/lazy-symbol.webp');

console.log(JSON.stringify({ok:true,links,discovered,requests},null,2));
