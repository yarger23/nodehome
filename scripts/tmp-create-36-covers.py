#!/usr/bin/env python3
import argparse, hashlib, io, json, os, pathlib, random, time
import requests
from PIL import Image, ImageFilter, ImageStat

ROOT=pathlib.Path(__file__).resolve().parents[1]
PROMPTS={
1:"On a work table in a sunlit modern apartment, two tasteful wallpaper rolls side by side, one delicate printed paper wallpaper and one subtle textured nonwoven wallpaper, realistic texture close-up, painting swatch book and scissors aside",
2:"Photorealistic landscape architecture at dusk, row of several small discreet solar garden lamps along beautiful curved garden path among shrubs and flowers, soft warm light, natural garden, private country house",
3:"Editorial macro photograph of a clean hand-held garden solar stake light next to soft microfiber cloth and a replaceable battery on an outdoor wooden garden table, authentic photovoltaic panel",
4:"An elegantly decorated living room wall with adjacent painted sample rectangles showing MATTE, satin, and semi-gloss finishes without any text; oblique daylight reveals differences in sheen; renovation photography",
6:"Close realistic photograph of beautifully mulched flower bed using pine bark chips around young perennials, small separate patch of dark compost and wood chips, realistic garden soil textures, daytime",
7:"Careful close-up of durable stone edging installed beside a garden paving stone walkway with grass and flower bed, realistic drainage foundation, modern landscaped country garden",
9:"An elegant private garden featuring three clearly recognizable distinct pathway finishes from foreground to background: gravel, paving slabs, natural stone, realistic architectural landscape photography",
11:"Calm empty children's room interior with soft neutral washable paint walls, safe closed paint tins, small color samples on table, wooden toys, beautiful soft daylight, clean and realistic",
12:"Low-maintenance dense creeping thyme and other flowering groundcover plants carpeting a landscaped garden section instead of lawn, realistic natural garden in sunlight",
13:"Sunlit elegant light apartment interior with painted white sample swatches from warm ivory to cool neutral white on one wall, wood floor and white doors, photorealistic room",
14:"Beautiful naturally layered mixed garden border with hydrangea shrubs, flowering perennials, ornamental grasses and varied foliage heights, mature landscaped country property",
15:"Neatly designed garden stepping stone pathway surrounded by varied low flowering border plants, ornamental grasses and neat shrubs, natural sunlight, professional real garden",
16:"Contemporary apartment interior design, harmonious palette of muted warm beige walls, natural oak floor and matching off-white wood doors, carefully balanced daylight, photorealistic",
17:"Editorial outdoor garden scene with a gardener's wheelbarrow full of mature crumbly compost beside raised vegetable beds, carefully spread compost as dark organic soil amendment, no people",
18:"Small bright apartment room with light creamy paint swatches on wall and ample sunlight, compact sofa and pale wood furniture, professional realistic architecture editorial photograph",
19:"Professional landscape design of a compact private yard zoned with narrow winding path, green planting beds, simple seating area and lawn without clutter, natural summer sunlight",
20:"Realistic compact apartment bathroom with elegant medium-format porcelain tile, functional walk-in shower and simple sink, beautiful accurate tile grout, bright neutral light",
21:"Shady garden corner beneath mature trees planted with lush ferns and hostas, variegated leaves, soft moss and a winding stone path, believable real garden photography",
22:"Modern residential bathroom with realistic wood-look porcelain floor tiles combined with pale neutral large-format wall tiles and a subtle gray stone niche, crisp details",
23:"Wide and comfortable paved pedestrian garden path through lush garden allowing two persons to pass, no people, clear realistic proportions, natural landscape photo",
24:"Close interior detail of refined white skirting board and matching white door casing against tasteful warm neutral walls and wood flooring, crisp real-life carpentry photography",
25:"Eye-level garden composition with single striking tree as focal point at the end of subtly curved stone path framed by flower borders and shrubs, natural photographic landscape",
26:"Interior window treatment scene with long off-white textured curtains hanging from ceiling track beside large daylight-filled window, sewing measuring tape on window ledge, realistic",
27:"Beautiful mixed perennial flowerbed in part shade with hostas, coral bells, astilbes, ferns and subtle shade-loving blooms, balanced heights and realistic outdoor light",
28:"Front garden landscaping of inviting modern country house entrance path with layered shrubs, restrained flowering borders, ornamental grasses and attractive doorway, no people",
29:"Architectural macro interior detail where oak wood floor meets smooth white wall with elegant recessed shadow-gap baseboard and short sample conventional baseboard, precise realistic finish",
30:"Close interior flooring detail showing neat aligned transition from wood plank flooring to large-format ceramic tile with slim subtle transition profile, real home photographed in daylight",
31:"Attractive comfortable outdoor relaxation area under dappled tree shade in private country garden with wooden terrace chairs and low table overlooking flowering border, landscape photography",
32:"Beautiful lush layered flower garden with clearly distinguishable low foreground plants, medium flowering perennials and tall shrubs in background, soft sun and mature country garden",
33:"Bright apartment living room showing freshly painted white ceiling, paint tray with small matte and satin finish sample boards on protective surface, clean renovation photographs",
34:"Garden grass lawn meeting a colourful flower border in a sharp tidy curved metal edging line, healthy turf, mulch and planting, authentic landscape macro",
35:"Realistic modern apartment bathroom, detailed close-up of accurate ceramic tile grout lines on off-white wall and gray floor, clean durable tiling without water damage"
}
SKIP={5,8,10,36}
parser=argparse.ArgumentParser()
parser.add_argument('--batch',type=int,required=True)
args=parser.parse_args()
source=(ROOT/"tmp/nov-01-ready-43.md").read_text(encoding="utf8")
import re
blocks=re.split(r"(?m)^## (\d+)\. ([^\n]+)\n",source)[1:]
items=[]
for j in range(0,36*3,3):
    n=int(blocks[j]); info=blocks[j+2]
    slug=re.search(r"\*\*Slug:\*\* \`([^\`]+)\`",info).group(1)
    a=json.loads((ROOT/"content/articles"/(slug+".json")).read_text(encoding="utf8"))
    if a["status"]=="published":
        items.append((n,slug))
assert len(items)==32,len(items)
for n,slug in items:
    assert n in PROMPTS,f"No prompt for {n}"
batch_size=8
batch_items=items[args.batch*batch_size:(args.batch+1)*batch_size]
assert len(batch_items)==8
out=ROOT/"generated-covers"
out.mkdir(exist_ok=True)
uri="https://stable-diffusion-xl.endpoints.kepler.ai.cloud.ovh.net/api/text2image"
for index,(n,slug) in enumerate(batch_items):
    prompt=PROMPTS[n]+". Authentic high resolution realistic camera photograph, editorial home and garden magazine quality, landscape composition 3:2, crisp fine details, realistic proportions, no people, no writing, no collage, no watermark, no screenshot."
    body={'prompt':prompt,'negative_prompt':'letters, labels, text, watermark, collage, grid, split screen, illustration, computer generated render, deformed shapes, badly drawn details, low resolution, blurry, poster, vector'}
    print(f"batch={args.batch}: generate {index+1}/8, article #{n} {slug}",flush=True)
    resp=None
    for attempt in range(6):
        try: resp=requests.post(uri,json=body,headers={'Content-Type':'application/json','Accept':'application/octet-stream'},timeout=150)
        except requests.RequestException as e:
            print("Network issue",str(e)[:150],flush=True)
            time.sleep(15+attempt*8)
            continue
        if resp.status_code==200:break
        print(f"Provider responded {resp.status_code}: {resp.text[:100]}",flush=True)
        if resp.status_code in (400,401,402,403,404):raise RuntimeError("Image provider unavailable for article "+slug)
        time.sleep(15+attempt*10)
    if resp is None or resp.status_code!=200:raise RuntimeError("Failed generating "+slug)
    img=Image.open(io.BytesIO(resp.content)).convert("RGB")
    w,h=img.size
    if min(w,h)<768:raise RuntimeError(f"Original image too small: {img.size} {slug}")
    if w/h>=1.5:
        nw=int(h*1.5); left=(w-nw)//2;img=img.crop((left,0,left+nw,h))
    else:
        nh=int(w/1.5);top=(h-nh)//2;img=img.crop((0,top,w,top+nh))
    img=img.resize((1600,1067),Image.Resampling.LANCZOS)
    img=img.filter(ImageFilter.UnsharpMask(radius=1.1,percent=95,threshold=2))
    f=out/(slug+"-hero.webp")
    img.save(f,format="WEBP",quality=86,method=6)
    data=f.read_bytes();size=len(data)
    if size<25000 or size>1200000:raise RuntimeError(f"Bad image size {size} for {slug}")
    extrema=ImageStat.Stat(img).stddev
    if sum(extrema)/3<12:raise RuntimeError(f"Image lacks detail {slug}")
    print(f"Saved {f.name}: {size} bytes; SHA256 {hashlib.sha256(data).hexdigest()[:16]}",flush=True)
    time.sleep(5 if index<7 else 0)
print(f"Batch {args.batch} completed {len(batch_items)} new images",flush=True)
