#!/usr/bin/env python3
from pathlib import Path
import json
base=Path('content/articles')
prefix={
'akkumulyatornyy-ili-setevoy-shurupovert':'Разберём, как тип питания влияет на повседневное использование, мобильность, стоимость комплекта и хранение. Это поможет выбрать инструмент под собственные задачи, а не по одному техническому параметру.',
'drel-ili-shurupovert-chto-vybrat':'Сравним, какие работы удобнее выполнять дрелью, а какие шуруповёртом, и в каких условиях универсального решения недостаточно. Перед выбором важно учесть материалы, крепёж и частоту работ.',
'instrument-dlya-dekorativnoy-shtukaturki':'Результат отделки зависит не только от самого покрытия, но и от формы, гибкости и состояния рабочего инструмента. Разберём, чем отличаются варианты и что стоит проверить на пробном образце.',
'krutyashchiy-moment-shurupoverta':'Число ньютон-метров на коробке не равно универсальной настройке для любого крепежа. Объясним, как соотносить данные производителя, работу муфты и реальные задачи без опасных упрощений.',
'shtukaturnye-shpateli-vybor':'Небольшие отличия в ширине полотна, жёсткости и качестве кромки влияют на удобство работы. Сравним инструменты под разные этапы отделки и разберём, когда не стоит выбирать самый широкий вариант.'}
slugs=[
'akkumulyatornyy-ili-setevoy-shurupovert','drel-ili-shurupovert-chto-vybrat',
'instrument-dlya-dekorativnoy-shtukaturki','krutyashchiy-moment-shurupoverta',
'shtukaturnye-shpateli-vybor','cut-porcelain-stoneware-tools',
'kelma-i-shtukaturnaya-lopatka','pravilo-dlya-shtukaturki-kak-vybrat','terki-i-poluterki-dlya-shtukaturki']
for slug in slugs:
    f=base/(slug+'.json')
    a=json.loads(f.read_text(encoding='utf8'))
    changes=[]
    if not a.get('seoTitle') or len(a.get('seoTitle','').strip())<20:
        title=a['title']
        a['seoTitle']=title if len(title)<=85 else title[:82].rsplit(' ',1)[0]
        changes.append('seoTitle')
    if len(a.get('intro','').strip())<120:
        assert slug in prefix,slug
        a['intro']=a['intro'].strip()+' '+prefix[slug]
        changes.append('intro')
    if changes:
        f.write_text(json.dumps(a,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(slug,changes,len(a.get('intro','')),len(a.get('seoTitle','')))
