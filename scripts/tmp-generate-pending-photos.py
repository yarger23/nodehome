#!/usr/bin/env python3
import requests,io,pathlib,hashlib,time,argparse
from PIL import Image,ImageFilter,ImageStat
root=pathlib.Path(__file__).resolve().parents[1]
prompts=[
("cut-porcelain-stoneware-tools","A real professional large manual ceramic tile cutter on a secure workbench next to realistic porcelain stoneware tiles, precise straight cuts, clean contractor workshop, authentic editorial photography, no people"),
("derevyannaya-obshivka-fasada-vybor","Photorealistic modern Russian private house with beautiful natural thermowood vertical wood cladding, clean timber joints, dark window frames, landscaped lawn, soft outdoor afternoon sunlight, architectural editorial photography"),
("konditsioner-ventilyatsiya-osushitel-ochistitel","Minimalist bright apartment living room showing a wall mounted air conditioner clearly and a floor standing air purifier and compact dehumidifier apart from each other, correct appliance shapes and comfortable uncluttered interior photo"),
("lazernyy-dalnomer-dlya-remonta-vybor","Photorealistic close up of compact laser distance measuring device on a sturdy work bench next to carpenter measuring tape and pencil, real unfinished interior wall in background, sharply detailed real-life product photography with no legible text"),
("datchik-co2-dlya-doma","An elegant indoor air quality CO2 monitor sitting on light wooden desk near window of airy apartment, realistic compact screen with simple bar graph but no legible numbers, close-up camera photo, living houseplants softly out of focus"),
("akkumulyatornaya-platforma-instrumenta","A cohesive set of battery powered professional home workshop tools with compatible black and yellow battery packs, cordless drill driver and jigsaw and charger laid neatly on light workshop bench, realistic product photography, no brand logos"),
("planirovka-kladovoy-v-dome","Photorealistic spacious but compact home pantry with organized wooden shelves, neatly stored dry foods in clear jars and sealed boxes, baskets and small appliances, good practical lighting, no people, architectural interior photo"),
("fibrocementnaya-oblicovka-kriterii-vybora","Beautiful contemporary private house facade covered in horizontal matte dark grey fibre cement cladding panels, crisp horizontal joints and natural garden landscaping, clean detailed real architectural photograph"),
("organayzer-keys-ili-sumka-dlya-instrumenta","Three realistic storage solutions for hand tools placed together on one wooden workshop bench: hard plastic compartment organizer with screws, open practical nylon tool bag with hammers and screwdrivers, sturdy closed tool case, sharp documentary product photography, no logos")
]
p=argparse.ArgumentParser();p.add_argument('--batch',type=int,required=True);n=p.parse_args().batch
selected=prompts[n*3:(n+1)*3];assert len(selected)==3
out=root/'generated-pending-covers';out.mkdir(exist_ok=True)
uri='https://stable-diffusion-xl.endpoints.kepler.ai.cloud.ovh.net/api/text2image'
for idx,(slug,desc) in enumerate(selected,1):
    prompt=desc+'. High quality realistic 35mm camera photo, photorealistic material textures, magazine editorial photo, horizontal 3:2 composition, one single scene, no watermark, no texts or labels, no collage.'
    payload={'prompt':prompt,'negative_prompt':'text, captions, words, typography, text overlay, cartoon, digital painting, graphic rendering, split screen, collage, watermark, blurry, distorted material'}
    resp=None
    for attempt in range(5):
        try: resp=requests.post(uri,json=payload,headers={'Content-Type':'application/json','Accept':'application/octet-stream'},timeout=160)
        except requests.RequestException as e:
            print('Network retry:',str(e)[:120],flush=True);time.sleep(15+attempt*12);continue
        if resp.status_code==200:break
        print('Provider status:',resp.status_code,resp.text[:160],flush=True)
        if resp.status_code in (400,401,402,403,404):raise RuntimeError('Provider rejected request')
        time.sleep(20+attempt*12)
    if not resp or resp.status_code!=200:raise RuntimeError('Photo generation failed: '+slug)
    img=Image.open(io.BytesIO(resp.content)).convert('RGB')
    w,h=img.size
    if min(w,h)<768:raise RuntimeError('Native photo too small '+str(img.size))
    if w/h>=1.5:
        nw=int(h*1.5);l=(w-nw)//2;img=img.crop((l,0,l+nw,h))
    else:
        nh=int(w/1.5);t=(h-nh)//2;img=img.crop((0,t,w,t+nh))
    img=img.resize((1600,1067),Image.Resampling.LANCZOS)
    img=img.filter(ImageFilter.UnsharpMask(radius=1.2,percent=100,threshold=2))
    std=ImageStat.Stat(img).stddev
    if sum(std)/3<12:raise RuntimeError('Image lacks visual detail '+slug)
    path=out/(slug+'-hero.webp')
    img.save(path,format='WEBP',quality=86,method=6)
    data=path.read_bytes()
    if len(data)<25000 or len(data)>1200000:raise RuntimeError('Suspicious size '+slug+': '+str(len(data)))
    print('Prepared',idx,'/',len(selected),slug,img.size,len(data),hashlib.sha256(data).hexdigest()[:12],flush=True)
    if idx<len(selected):time.sleep(5)
