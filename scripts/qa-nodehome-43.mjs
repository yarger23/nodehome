#!/usr/bin/env node
// Focused QA for the 43 Nodehome articles from 2026-11-01.
// Reports actual editorial blockers; does not change or publish the website.
import fs from 'node:fs';
import path from 'node:path';
const slugs=[
  "flizelinovye-ili-bumazhnye-oboi-kak-vybrat",
  "kak-razmestit-solnechnye-sadovye-svetilniki",
  "uhod-za-solnechnymi-sadovymi-svetilnikami",
  "kak-vybrat-stepen-bleska-kraski-dlya-sten",
  "kak-vybrat-tsvet-zatirki-dlya-plitki",
  "mulcha-dlya-klumb-kora-shchepa-kompost",
  "bordyur-dlya-sadovoy-dorozhki-kak-vybrat",
  "kak-vybrat-plintus-dlya-pola",
  "sadovaya-dorozhka-graviy-plitka-kamen",
  "kak-rasschitat-kolichestvo-oboev-s-raportom",
  "kraska-dlya-detskoy-komnaty-kak-vybrat",
  "pochvopokrovnye-rasteniya-vmesto-gazona",
  "belaya-kraska-dlya-sten-teplyy-ili-holodnyy-ottenok",
  "kak-splanirovat-miksborder-kustarniki-mnogoletniki",
  "rasteniya-vdol-sadovoy-dorozhki-kak-podobrat",
  "kak-sochetat-tsvet-sten-pola-i-dverey",
  "kompost-kak-uluchshitel-pochvy-i-mulcha",
  "tsvet-sten-dlya-malenkoy-komnaty-kak-vybrat",
  "kak-zonirovat-nebolshoy-uchastok",
  "plitka-dlya-malenkoy-vannoy-kak-vybrat",
  "tenistyy-ugolok-sada-kak-podobrat-rasteniya",
  "plitka-pod-derevo-v-vannoy-kak-sochetat",
  "shirina-sadovoy-dorozhki-kak-splanirovat",
  "tsvet-plintusov-i-nalichnikov-kak-sochetat-so-stenami",
  "fokusnaya-tochka-v-sadu-kak-napravit-vzglyad",
  "kak-podobrat-shirinu-i-dlinu-shtor",
  "klumba-v-poluteni-kak-sobrat-kompozitsiyu",
  "palisadnik-pered-domom-kak-splanirovat",
  "primykanie-pola-k-stene-plintus-ili-tenevoi-shov",
  "styk-napolnyh-pokrytiy-profil-ili-bez-porozhka",
  "gde-razmestit-zonu-otdyha-v-sadu",
  "kak-splanirovat-klumbu-po-vysote-rasteniy",
  "matovaya-ili-satinovaya-kraska-dlya-potolka",
  "bordyur-mezhdu-gazonom-i-klumboy-kak-vybrat",
  "shvy-plitki-tsvet-zatirki-i-uhod",
  "tsvet-plintusa-pod-steny-ili-pol",
  "derevyannaya-obshivka-fasada-vybor",
  "konditsioner-ventilyatsiya-osushitel-ochistitel",
  "lazernyy-dalnomer-dlya-remonta-vybor",
  "akkumulyatornaya-platforma-instrumenta",
  "datchik-co2-dlya-doma",
  "planirovka-kladovoy-v-dome",
  "fibrocementnaya-oblicovka-kriterii-vybora"
];
const root=process.cwd();
const read=(p)=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const cats=read('content/categories.json');
const allFiles=fs.readdirSync('content/articles').filter(x=>x.endsWith('.json'));
const all=[...read('content/articles.json'),...allFiles.map(x=>read('content/articles/'+x))];
const published=new Set(all.filter(x=>x.status==='published').map(x=>x.slug));
const categoryById=new Map(cats.map(x=>[x.id,x]));
const normalize=(s)=>String(s||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function webpDimensions(b){
 if(b.length<30||b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WEBP')return null;
 const kind=b.toString('ascii',12,16);
 if(kind==='VP8X')return {width:1+b.readUIntLE(24,3),height:1+b.readUIntLE(27,3)};
 if(kind==='VP8 '&&b[23]===0x9d&&b[24]===0x01&&b[25]===0x2a)return {width:b.readUInt16LE(26)&0x3fff,height:b.readUInt16LE(28)&0x3fff};
 if(kind==='VP8L'&&b[20]===0x2f){
  const [a,c,d,e]=[b[21],b[22],b[23],b[24]];
  return {width:1+(a|((c&0x3f)<<8)),height:1+((c>>6)|(d<<2)|((e&0x0f)<<10))};
 }
 return null;
}
const allTitles=new Map();
for(const a of all){const n=normalize(a.title);allTitles.set(n,[...(allTitles.get(n)||[]),a.slug]);}
const errors=[],warns=[],records=[];
for(const slug of slugs){
const filepath='content/articles/'+slug+'.json';
if(!fs.existsSync(filepath)){errors.push(slug+': JSON source missing');continue;}
const a=read(filepath);
const title=String(a.title||''),meta=String(a.description||'');
const body=[a.intro||'',...(a.sections||[]).flatMap(x=>x.paragraphs||[])].join(' ');
const words=body.trim().split(/\s+/).length;
if(a.slug!==slug||typeof a.id!=='string'||!a.id.trim())errors.push(slug+': invalid slug or missing stable id');
if(!['published','draft'].includes(a.status))errors.push(slug+': invalid status');
if(title.length<25||String(a.seoTitle||'').length<20||String(a.seoTitle||'').length>80)errors.push(slug+': title/seoTitle size');
if(meta.length<90||meta.length>175)errors.push(slug+': meta description 90-175 characters');
if(String(a.intro||'').length<120)errors.push(slug+': short introduction');
if((a.sections||[]).length<6)errors.push(slug+': fewer than 6 H2 sections');
if((a.faqs||[]).length<4)errors.push(slug+': fewer than 4 FAQs');
if(new Set((a.sections||[]).map(x=>x.id)).size!==(a.sections||[]).length)errors.push(slug+': duplicate section IDs');
if(!a.sections?.every(x=>x.title&&Array.isArray(x.paragraphs)&&x.paragraphs.length>=2&&x.paragraphs.join(' ').length>=180))errors.push(slug+': sparse H2 section');
if(!Array.isArray(a.categoryIds)||a.categoryIds.length!==1||!categoryById.has(a.categoryIds[0]))errors.push(slug+': category not found');
if((allTitles.get(normalize(title))||[]).length>1)errors.push(slug+': exact duplicate title');
for(const s of [...body.matchAll(/\/article\/([a-z0-9-]+)\//g)].map(m=>m[1]))if(!published.has(s))errors.push(slug+': unresolved inline link '+s);
for(const s of a.sections||[])for(const link of s.links||[]){const m=String(link.href||'').match(/^\/article\/([a-z0-9-]+)\/$/);if(m&&!published.has(m[1]))errors.push(slug+': unpublished linked article '+m[1]);}
if(words<550)warns.push(slug+': brief copy '+words+' words, review topical depth');
const imagePath='assets/images/'+a.image;
if(!a.image||!fs.existsSync(imagePath))errors.push(slug+': cover missing '+a.image);
else {
 const bytes=fs.readFileSync(imagePath);
 if(bytes.length<25000)errors.push(slug+': cover under 25 KB ('+bytes.length+')');
 const dimensions=webpDimensions(bytes);
 if(!dimensions||dimensions.width<1200||dimensions.height<800)errors.push(slug+': cover image must be a readable WebP at least 1200x800 ('+(dimensions?dimensions.width+'x'+dimensions.height:'invalid header')+')');
}
if(a.status==='published'&&!categoryById.get(a.categoryIds?.[0])?.articles?.includes(a.id))errors.push(slug+': absent in category article list');
if(a.status==='draft')errors.push(slug+': still a draft; not release-ready');
records.push({slug,status:a.status,words,metaChars:meta.length,sections:a.sections?.length,faq:a.faqs?.length});
}
console.log('[Nodehome-43 QA] Checked',records.length,'articles');
console.log('[Nodehome-43 QA] Published',records.filter(x=>x.status==='published').length,'Drafts',records.filter(x=>x.status==='draft').length);
console.log('[Nodehome-43 QA] Warnings',warns.length);
for(const w of warns)console.warn('WARN:',w);
console.log('[Nodehome-43 QA] Blockers',errors.length);
for(const e of errors)console.error('BLOCKER:',e);
if(errors.length)process.exitCode=1;
