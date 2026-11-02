#!/usr/bin/env python3
"""One-time import of November 1 packet. Does not modify archived articles."""
import json, re, pathlib, hashlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
source=(ROOT/"tmp/nov-01-ready-43.md").read_text(encoding="utf8")
legacy=json.loads((ROOT/"content/articles.json").read_text(encoding="utf8"))
categories=json.loads((ROOT/"content/categories.json").read_text(encoding="utf8"))
category_by_id={c["id"]:c for c in categories}
article_dir=ROOT/"content/articles"
existing=[json.loads(p.read_text(encoding="utf8")) for p in article_dir.glob("*.json")]
published={a.get("slug") for a in legacy+existing if a.get("status")=="published"}
all_articles=legacy+existing
mapping={
1:("wall-finish-comparison","oboi"),2:("solar-garden-lights","naruzhnoe-osveshchenie"),3:("solar-garden-lights","naruzhnoe-osveshchenie"),
4:("wall-finish-comparison","pokraska-sten"),5:("tile-material-comparison","zatirka-shvov"),
6:("garden-beds-landscaping","klumby-i-tsvetniki"),7:("garden-pathways","bordyury-i-osnovaniya-pokrytiy"),
8:("floor-skirting-materials","plintusy-i-porogi"),9:("garden-pathways","sadovye-dorozhki"),
10:("wall-finish-comparison","oboi"),11:("wall-finish-comparison","pokraska-sten"),12:("garden-beds-landscaping","gazony"),
13:("wall-finish-comparison","pokraska-sten"),14:("garden-beds-landscaping","klumby-i-tsvetniki"),15:("garden-beds-landscaping","klumby-i-tsvetniki"),
16:("wall-finish-comparison","pokraska-sten"),17:("garden-beds-landscaping","klumby-i-tsvetniki"),
18:("wall-finish-comparison","pokraska-sten"),19:("garden-beds-landscaping","landshaftnyy-dizayn"),
20:("tile-material-comparison","keramicheskaya-plitka"),21:("garden-beds-landscaping","klumby-i-tsvetniki"),
22:("tile-material-comparison","keramogranit"),23:("garden-pathways","sadovye-dorozhki"),
24:("floor-skirting-materials","plintusy-i-porogi"),25:("garden-beds-landscaping","landshaftnyy-dizayn"),
26:("bedroom-furniture","spalni-i-gostinye"),27:("garden-beds-landscaping","klumby-i-tsvetniki"),
28:("garden-beds-landscaping","landshaftnyy-dizayn"),29:("floor-skirting-materials","plintusy-i-porogi"),
30:("floor-skirting-materials","plintusy-i-porogi"),31:("garden-rest-zones","patio"),32:("garden-beds-landscaping","klumby-i-tsvetniki"),
33:("ceiling-finish-choice","pokraska-potolkov"),34:("garden-beds-landscaping","klumby-i-tsvetniki"),
35:("tile-material-comparison","zatirka-shvov"),36:("floor-skirting-materials","plintusy-i-porogi")
}
for cid,title,group in [
    ("garden-beds-landscaping","Озеленение и цветники","landscape-landshaft-i-ozelenenie"),
    ("garden-pathways","Садовые дорожки и мощение","landscape-dorozhki-i-ploshchadki"),
    ("garden-rest-zones","Зоны отдыха на участке","landscape-terrasy-i-zony-otdyha")
]:
    if cid not in category_by_id:
        cat={"id":cid,"title":title,"groupId":group,"articles":[]}
        categories.append(cat);category_by_id[cid]=cat

def normalize_text(text):
    text=re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)",r"\1",text)
    text=re.sub(r"\[([^\]]+)\]\(/article/([^)]+)/\)",r"\1",text)
    text=re.sub(r"(?m)^#{3,6}\s+", "",text)
    text=re.sub(r"\*\*([^*]+)\*\*",r"\1",text)
    text=re.sub(r"\*([^*]+)\*",r"\1",text)
    text=re.sub(r"(?m)^[-*]\s+", "• ",text)
    return text.strip()

def paragraphs(body):
    parts=[normalize_text(x) for x in re.split(r"\n\s*\n",body.strip())]
    parts=[p for p in parts if p and p!="---"]
    if len(parts)==1 and len(parts[0])>180:
        lines=parts[0].splitlines()
        if len(lines)>1:
            mid=max(1,len(lines)//2)
            parts=[" ".join(lines[:mid]).strip()," ".join(lines[mid:]).strip()]
        else:
            sentences=re.split(r"(?<=[.!?])\s+",parts[0])
            if len(sentences)>1:
                pivot=max(1,len(sentences)//2)
                parts=[" ".join(sentences[:pivot])," ".join(sentences[pivot:])]
    return parts

def clean_id(s):
    tr=str.maketrans({'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'})
    return re.sub(r"(^-+|-+$)","",re.sub(r"[^a-z0-9]+","-",s.lower().translate(tr)))[:58] or "section"

def answer(text):
    text=re.sub(r"\s+"," ",normalize_text(text)).strip()
    if len(text)>290:
        arr=re.split(r"(?<=[.!?])\s+",text)
        ans=""
        for sent in arr:
            if ans and len(ans)+len(sent)>280:break
            ans=(ans+" "+sent).strip()
        text=ans or text[:275].rsplit(" ",1)[0]+"."
    return text

def faq_question(title):
    t=title.strip(" ?.!:")
    return (t+"?") if re.match(r"(?i)^(как|когда|почему|где|что|какие|какой|нужно|можно|зачем|чем|сколько)\b",t) else "Что важно учитывать: "+t[0].lower()+t[1:]+"?"

blocks=re.split(r"(?m)^## (\d+)\. ([^\n]+)\n",source)[1:]
assert len(blocks)==43*3,len(blocks)
reserved={5:"topic_duplicate: tsvet-zatirki-dlya-plitki-v-ton-ili-kontrast",8:"topic_overlap: napolnyy-plintus-mdf-pvh-ili-dyuropolimer",10:"topic_duplicate: rapport-oboev-kak-vybrat-risunok-i-rasschitat-rulony",36:"topic_duplicate: tsvet-plintusa-pod-pol-steny-ili-dveri"}
report=[]
for i in range(0,36*3,3):
    n,title,block=blocks[i:i+3];n=int(n)
    slug=re.search(r"\*\*Slug:\*\* \`([^\`]+)\`",block).group(1)
    if (article_dir/(slug+".json")).exists():raise RuntimeError("Existing article file: "+slug)
    full=block.split("### Полный текст",1)[1].strip().removesuffix("---").strip()
    segments=re.split(r"(?m)^## (.+)\s*$",full)
    intro=normalize_text(segments[0]).strip()
    if len(intro)<120:raise RuntimeError(f"Intro too short #{n}")
    sections=[];faqs=[];related=[]
    for k in range(1,len(segments),2):
        heading=segments[k].strip();body=segments[k+1].strip()
        if heading.casefold() in ("faq","частые вопросы","вопросы и ответы"):
            f=re.split(r"(?m)^### (.+)\s*$",body)[1:]
            for j in range(0,len(f),2):
                q=f[j].strip();a=answer(f[j+1])
                if len(a)>=35:faqs.append({"question":q,"answer":a})
            continue
        if re.search(r"(?i)^(вывод|итоги|читайте также|внутренние ссылки|полезные материалы|полезные материалы nodehome)",heading):
            related+=re.findall(r"/article/([a-z0-9-]+)/",body)
            if heading.casefold() in ("вывод","итоги") and sections:
                ps=paragraphs(body)
                if len(ps)>=2 and len(" ".join(ps))>=180:
                    sections.append({"id":"vyvod","title":"Вывод","paragraphs":ps})
                else:
                    sections[-1]["paragraphs"]+=ps
            continue
        p=paragraphs(body)
        if len(p)<2 or len(" ".join(p))<180:
            if sections:sections[-1]["paragraphs"]+=p
            continue
        idx=clean_id(heading)
        ids={s["id"] for s in sections}
        while idx in ids:idx+="-more"
        sections.append({"id":idx,"title":heading,"paragraphs":p})
        related+=re.findall(r"/article/([a-z0-9-]+)/",body)
    if len(sections)<6: raise RuntimeError(f"Only {len(sections)} H2 sections in #{n} {slug}")
    if len(faqs)<4:
        for sec in sections:
            q=faq_question(sec["title"])
            if any(f["question"]==q for f in faqs):continue
            a=answer(" ".join(sec["paragraphs"][:2]))
            if len(a)<35:continue
            faqs.append({"question":q,"answer":a})
            if len(faqs)>=4:break
    if len(faqs)<4:raise RuntimeError("Missing FAQ "+slug)
    for sec in sections:
        for j,p in enumerate(sec["paragraphs"]):
            if re.search(r"/article/([a-z0-9-]+)/",p):
                sec["paragraphs"][j]=re.sub(r"\[([^\]]+)\]\(/article/([a-z0-9-]+)/\)",r"\1",p)
    links=[]
    for target in related:
        if target in published and target!=slug and target not in [l["href"].split("/")[-2] for l in links]:
            label=next((a.get("title") for a in all_articles if a.get("slug")==target),target)
            links.append({"href":"/article/"+target+"/","label":label})
    catid,topic=mapping[n];cat=category_by_id[catid]
    if len(links)<2:
        for old in all_articles:
            if old.get("status")!="published" or old.get("slug")==slug or catid not in old.get("categoryIds",[]):continue
            if old.get("slug") not in [l["href"].split("/")[-2] for l in links]:
                links.append({"href":"/article/"+old["slug"]+"/","label":old.get("title","Подробнее")})
            if len(links)>=2:break
    if links: sections[-1]["links"]=links[:3]
    status="draft" if n in reserved else "published"
    obj={
      "id":"nov-01-seo-"+str(n).zfill(2)+"-"+hashlib.sha1(slug.encode()).hexdigest()[:8],
      "slug":slug,"status":status,
      "publishedAt":"2026-11-03",
      "seoTitle":title[:79] if len(title)>79 else title,
      "title":title,"description":answer(intro[:260])[:260],
      "intro":intro,"categoryIds":[catid],"topicId":topic,
      "image":slug+"-hero.webp","imageAlt":"Реалистичное тематическое фото: "+title,
      "minutes":max(5,round(len(full.split())/175)),
      "sections":sections,"faqs":faqs[:6]
    }
    if status=="published" and obj["id"] not in cat["articles"]:cat["articles"].append(obj["id"])
    (article_dir/(slug+".json")).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    report.append({"n":n,"slug":slug,"title":title,"status":status,"reason":reserved.get(n,""),"category":catid,"sections":len(sections),"faqs":len(faqs),"text_chars":len(full),"source_links":len(links)})
(ROOT/"content/categories.json").write_text(json.dumps(categories,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
(ROOT/"tmp/nov-01-import-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print("Imported",len(report),"published",sum(a["status"]=="published" for a in report),"draft",sum(a["status"]=="draft" for a in report))
for r in report:print(r["n"],r["slug"],r["status"],r["sections"],r["faqs"])
