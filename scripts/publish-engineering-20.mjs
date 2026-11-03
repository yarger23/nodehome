#!/usr/bin/env node
/**
 * Github-only release of the 20 existing Nodehome engineering articles.
 * No ZIP, no VPS access, no cover substitution. Only original WebP files
 * uploaded to assets/images/<slug>-hero.webp can unlock publication.
 *
 * Called by .github/workflows/build-site.yml before the editorial preflight.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const slugs = [
  "datchiki-dyma-ugarnogo-i-bytovogo-gaza",
  "obsluzhivanie-inzhenernyh-sistem-chastnogo-doma",
  "analiz-vody-iz-skvazhiny-pokazateli-i-chastota",
  "uzo-ili-difavtomat-v-chem-raznica",
  "vlazhnost-i-plesen-v-dome-chto-proverit",
  "dogovor-obsluzhivaniya-gazovogo-oborudovaniya",
  "podgotovka-inzhenernyh-sistem-k-zime",
  "datchik-protechki-ili-sistema-zashchity",
  "dokumenty-pri-priemke-elektromontazha",
  "stoimost-otopleniya-chastnogo-doma-sravnenie",
  "pritochnaya-ventilyatsiya-ili-provetrivanie",
  "kak-snizit-rashody-na-otoplenie-bez-zameny-kotla",
  "ochistka-vody-po-rezultatam-analiza",
  "kondensat-na-oknah-prichiny-i-chto-proverit",
  "skolko-elektroenergii-potreblyaet-chastnyy-dom",
  "priznaki-neispravnosti-otopleniya-kogda-vyzyvat-mastera",
  "elektrobezopasnost-vannoy-voprosy-proektirovshchiku",
  "kak-vybrat-organizaciyu-po-obsluzhivaniyu-gaza",
  "perepady-davleniya-vody-v-chastnom-dome",
  "vydelennaya-elektricheskaya-moshchnost-dlya-doma"
];

const root = process.cwd();
const load = p => JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
const filename = slug => "content/articles/" + slug + ".json";
const categoriesFile = "content/categories.json";
const categories = load(categoriesFile);
const sections = load("content/sections.json");
const groups = new Map(sections.flatMap(s => (s.groups || []).map(g => [g.id,g])));
const categoryById = new Map(categories.map(c=>[c.id,c]));
const articles = new Map();
for (const slug of slugs) {
  const file=filename(slug);
  if (!fs.existsSync(file)) throw new Error("Missing article: "+file);
  const a=load(file);
  if(a.slug!==slug || !a.id) throw new Error("Bad slug/id in "+file);
  articles.set(slug,a);
}
const all = fs.readdirSync("content/articles").filter(x=>x.endsWith(".json")).map(n=>load("content/articles/"+n));
const currentPublished = [
  ...load("content/articles.json"),
  ...all
].filter(a=>a.status==="published");
const publishedSlugs = new Set(currentPublished.map(x=>x.slug));
const usedBytes = new Set();
for(const a of currentPublished) {
  const p=path.join("assets/images",a.image || "");
  if(a.image && fs.existsSync(p)){
    usedBytes.add(crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex"));
  }
}
const reserved = new Set(usedBytes);

function webpSize(bytes) {
  if(bytes.length<30 || bytes.toString("ascii",0,4)!=="RIFF" || bytes.toString("ascii",8,12)!=="WEBP") return null;
  const type=bytes.toString("ascii",12,16);
  if(type==="VP8X") return [bytes.readUIntLE(24,3)+1, bytes.readUIntLE(27,3)+1];
  if(type==="VP8 " && bytes[23]===0x9d && bytes[24]===0x01 && bytes[25]===0x2a) return [bytes.readUInt16LE(26)&16383,bytes.readUInt16LE(28)&16383];
  if(type==="VP8L" && bytes[20]===0x2f){
    const [a,b,c,d]=[bytes[21],bytes[22],bytes[23],bytes[24]];
    return [1+(a|((b&63)<<8)),1+((b>>6)|(c<<2)|((d&15)<<10))];
  }
  return null;
}
function validate(a) {
  if(typeof a.title!=="string"||a.title.trim().length<25)throw Error("title");
  if(typeof a.seoTitle!=="string"||a.seoTitle.trim().length<20)throw Error("seoTitle");
  if(typeof a.description!=="string"||a.description.trim().length<70||a.description.length>320)throw Error("description");
  if(typeof a.intro!=="string"||a.intro.trim().length<120)throw Error("intro");
  if(!Array.isArray(a.sections)||a.sections.length<6||a.sections.some(x=>!x.id||!x.title||!Array.isArray(x.paragraphs)||x.paragraphs.length<2||x.paragraphs.join(" ").length<180))throw Error("sections");
  if(!Array.isArray(a.faqs)||a.faqs.length<4||a.faqs.some(x=>!(x.question||x.q)||String(x.answer||x.a||"").length<35))throw Error("FAQs");
  const id=a.categoryIds?.[0];
  const cat=categoryById.get(id);
  if(!cat)throw Error("Unknown category: "+id);
  const group=groups.get(cat.groupId);
  if(!group?.topics.some(t=>t.id===a.topicId))throw Error("Topic not in category group: "+a.topicId);
  if(!a.imageAlt||a.imageAlt.length<15)throw Error("imageAlt");
}
const eligible = new Map();
const skipped = [];
for(const slug of slugs) {
  const a=articles.get(slug);
  if(a.status==="published"){continue;}
  if(a.status!=="draft")throw Error("Unexpected status of "+slug+": "+a.status);
  const expected=slug+"-hero.webp";
  if(a.image!==expected)throw Error("Unexpected image name for "+slug+": "+a.image);
  const file=path.join("assets/images",expected);
  if(!fs.existsSync(file)){skipped.push(slug+" [waiting for original cover]");continue;}
  const bytes=fs.readFileSync(file),wh=webpSize(bytes);
  if(bytes.length<25000 || !wh || wh[0]<1200 || wh[1]<800)throw Error("Bad cover: "+file+" (must be real >=1200x800 WebP, >=25KB)");
  const hash=crypto.createHash("sha256").update(bytes).digest("hex");
  if(reserved.has(hash))throw Error("Reused image bytes: "+file);
  reserved.add(hash);
  validate(a);
  eligible.set(slug,a);
}
let changed=true;
while(changed){
  changed=false;
  for(const [slug,a] of eligible){
    const matches=[...JSON.stringify(a).matchAll(/\/article\/([a-z0-9-]+)\//g)].map(x=>x[1]);
    const missing=matches.filter(other=>!publishedSlugs.has(other)&&!eligible.has(other));
    if(missing.length){
      skipped.push(slug+" [unpublished internal references: "+[...new Set(missing)].join(",")+"]");
      eligible.delete(slug);changed=true;
    }
  }
}
const promoted=[];
for(const [slug,a] of eligible) {
  const c=categoryById.get(a.categoryIds[0]);
  c.articles=Array.isArray(c.articles)?[...new Set(c.articles)]:[];
  if(!c.articles.includes(a.id))c.articles.push(a.id);
  a.status="published";
  // Use actual release day rather than the draft creation date.
  a.publishedAt=new Date().toISOString().slice(0,10);
  fs.writeFileSync(filename(slug),JSON.stringify(a,null,2)+"\n");
  promoted.push(filename(slug));
}
if(promoted.length)fs.writeFileSync(categoriesFile,JSON.stringify(categories,null,2)+"\n");
const promotionList=path.join(process.env.RUNNER_TEMP||"/tmp","nodehome-engineering-promoted.txt");
fs.writeFileSync(promotionList,promoted.join("\n")+(promoted.length?"\n":""));
console.log("[nodehome publish] Promoted:",promoted.length,"of",slugs.length);
console.log("[nodehome publish] Waiting:",slugs.length-promoted.length-currentPublished.filter(a=>slugs.includes(a.slug)).length);
for(const line of skipped)console.log("[nodehome publish] Pending:",line);
console.log("[nodehome publish] QA list:",promotionList);
