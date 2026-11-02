#!/usr/bin/env python3
# One-time NodeHome backlog editorial completion.
from pathlib import Path
import json, re, datetime
root=Path(__file__).resolve().parents[1]
d=root/'content/articles'
slugs=[
'shtukaturnye-shpateli-vybor','kelma-i-shtukaturnaya-lopatka','pravilo-dlya-shtukaturki-kak-vybrat',
'terki-i-poluterki-dlya-shtukaturki','instrument-dlya-dekorativnoy-shtukaturki',
'cut-porcelain-stoneware-tools','kak-vybrat-shurupovert-dlya-doma','drel-ili-shurupovert-chto-vybrat',
'akkumulyatornyy-ili-setevoy-shurupovert','krutyashchiy-moment-shurupoverta',
'derevyannaya-obshivka-fasada-vybor','konditsioner-ventilyatsiya-osushitel-ochistitel',
'lazernyy-dalnomer-dlya-remonta-vybor','datchik-co2-dlya-doma','akkumulyatornaya-platforma-instrumenta',
'planirovka-kladovoy-v-dome','fibrocementnaya-oblicovka-kriterii-vybora',
'organayzer-keys-ili-sumka-dlya-instrumenta']
faqs={
'shtukaturnye-shpateli-vybor':[
('Можно ли одним шпателем выполнять всю отделку?','Для локальных операций иногда хватает одного инструмента, но под разные этапы удобнее выбирать отдельные размеры и жёсткость полотна. Сравнивайте ровность кромки и удобство хвата.')],
'kelma-i-shtukaturnaya-lopatka':[
('Что важнее при выборе кельмы: форма или рукоять?','Форма рабочей части определяет назначение инструмента, но рукоять важна для контроля движения. Выбирайте изделие под материал и задачу, оценивая баланс и качество соединения.')],
'pravilo-dlya-shtukaturki-kak-vybrat':[
('Нужно ли самое длинное правило для маленькой стены?','Не обязательно. Длина должна соответствовать площади и доступному месту для движения. Очень длинным правилом неудобно работать в ограниченном пространстве.')],
'terki-i-poluterki-dlya-shtukaturki':[
('Можно ли теркой исправить большие перепады стены?','Тёрка предназначена прежде всего для обработки поверхности подходящего слоя, а не для исправления больших геометрических отклонений. Серьёзные неровности устраняют по выбранной штукатурной системе.')],
'instrument-dlya-dekorativnoy-shtukaturki':[
('Нужна ли отдельная кельма для каждого декоративного эффекта?','Не всегда. Но форма, гибкость и состояние кромки заметно влияют на фактуру. Перед основной стеной стоит сделать пробный образец с конкретным составом.')],
'cut-porcelain-stoneware-tools':[
('Можно ли выбрать резак только по максимальной длине реза?','Нет. Важны также толщина и тип плитки, точность направляющих, жёсткость основания и рекомендации изготовителя. Для сложных вырезов может понадобиться другое оборудование.'),
('Почему у керамогранита скалывается край?','Причины различаются: свойства конкретной плитки, неподходящий инструмент, изношенная режущая оснастка или нарушение рекомендаций изготовителя. Не стоит пытаться компенсировать проблему опасным усилием.')],
'kak-vybrat-shurupovert-dlya-doma':[
('Нужен ли ударный режим шуруповёрту для сборки мебели?','Для обычной сборки мебели ударный режим обычно не требуется. Важнее плавная регулировка оборотов, корректная настройка муфты и удобство удержания инструмента.'),
('Можно ли выбирать шуруповёрт только по вольтам?','Нет. Напряжение аккумулятора само по себе не показывает реальную производительность или качество. Сравнивайте назначение, эргономику, батареи и данные производителя.')],
'drel-ili-shurupovert-chto-vybrat':[
('Подойдёт ли обычная дрель для закручивания саморезов?','Некоторые дрели технически позволяют заворачивать крепёж, но отсутствие подходящей муфты и балансировки может мешать точности. Для частой сборки удобнее шуруповёрт.'),
('Заменит ли шуруповёрт ударную дрель?','Не во всех задачах. Способность сверлить конкретный материал зависит от конструкции инструмента и оснастки. Для твёрдых оснований ориентируйтесь на указания производителя.')],
'akkumulyatornyy-ili-setevoy-shurupovert':[
('Когда сетевой шуруповёрт удобнее аккумуляторного?','Сетевая модель может подойти для длительной работы рядом с розеткой, когда мобильность не важна. При этом необходимо учитывать кабель и рабочее место.'),
('Что выгоднее при редком использовании?','Сравните цену всего комплекта, включая аккумулятор и зарядное устройство, возможность дальнейшего использования батарей и удобство хранения. Универсального ответа нет.')],
'krutyashchiy-moment-shurupoverta':[
('Чем отличается максимальный момент от настройки муфты?','Максимальный заявленный момент характеризует возможности модели в условиях измерения производителя, а муфта помогает ограничивать усилие при выполнении отдельных операций.'),
('Почему высокий крутящий момент не всегда полезен?','Для небольшого крепежа избыточное усилие повышает риск повреждения головки, резьбы или материала. Важны плавность и регулировка, а не только максимальные ньютон-метры.')],
'derevyannaya-obshivka-fasada-vybor':[
('Нужно ли красить любую деревянную облицовку?','Не всегда. Существуют изделия для естественного изменения цвета, а также заводские окрашенные фасадные системы. Выбор зависит от продукта, архитектуры и допустимого режима ухода.')],
'konditsioner-ventilyatsiya-osushitel-ochistitel':[],
'lazernyy-dalnomer-dlya-remonta-vybor':[],
'datchik-co2-dlya-doma':[
('Что делать, если датчик CO₂ постоянно показывает высокое значение?','Сначала проверьте корректность прибора и условия измерения. Если показания устойчиво высокие при присутствии людей, оцените приток наружного воздуха и работу вентиляции.')],
'akkumulyatornaya-platforma-instrumenta':[
('Можно ли использовать аккумулятор одного бренда с любым его инструментом?','Не обязательно. Совместимость зависит от конкретной платформы, серии и ограничений изготовителя. Проверяйте официальную таблицу совместимости до покупки.')],
'planirovka-kladovoy-v-dome':[
('Какая глубина полок удобна для кладовой?','Единого размера нет: измерьте реальные коробки и продукты, учитывайте доступность заднего ряда и проход. Слишком глубокие сплошные полки усложняют использование.')],
'fibrocementnaya-oblicovka-kriterii-vybora':[
('Можно ли выбрать панели без проекта подсистемы?','Не стоит. Конструкция крепления, ветровые нагрузки, зазоры и совместимость элементов определяются фасадной системой и проектной документацией.')],
'organayzer-keys-ili-sumka-dlya-instrumenta':[
('Что выбрать для небольшого набора ручного инструмента?','Для мелкого крепежа удобен органайзер с ячейками, для разного ручного инструмента может подойти сумка, а для перевозки и защиты — жёсткий кейс. Сравнивайте реальные габариты.')]}
extra={
'kak-vybrat-shurupovert-dlya-doma':('Пример выбора для домашней мастерской',
['Представьте, что инструмент нужен для сборки шкафа, установки полок и редкого сверления древесины. В этом случае удобство удержания, небольшая масса и точная регулировка на малых оборотах могут быть полезнее рекордных показателей крутящего момента. Сначала перечислите реальные задачи и только затем сравнивайте комплектации.',
'Если рядом уже есть инструмент определённой аккумуляторной системы, посчитайте полную стоимость покупки с учётом совместимой батареи и зарядного устройства. При редком использовании отдельный дешёвый комплект может казаться выгоднее, но доступность расходников и дальнейшего сервиса тоже важна.']),
'drel-ili-shurupovert-chto-vybrat':('Как выбрать комплект из двух инструментов',
['При регулярной сборке мебели и частом сверлении иногда удобнее иметь два специализированных инструмента: шуруповёрт для крепежа и дрель для предусмотренных ею материалов. Это упрощает переключение между битой и сверлом, но означает дополнительные расходы и место хранения.',
'Для нескольких несложных домашних задач покупка обоих устройств может быть избыточной. Составьте перечень работ на ближайший год и сверьте его с перечнем допустимых материалов и операций в инструкции конкретной модели.']),
'akkumulyatornyy-ili-setevoy-shurupovert':('Практический сценарий: мебельная сборка и работа в мастерской',
['Если основная задача — сборка мебели в разных комнатах, возможность перемещаться без кабеля часто оказывается важнее продолжительности непрерывной работы. Но не забывайте о массе аккумулятора, удобстве хранения и необходимости периодически проверять заряд.',
'Если инструмент используется на постоянном рабочем месте с доступной розеткой, сетевая модель может оказаться подходящей. Кабель не должен проходить через место, где его могут повредить или зацепить. Выбирайте не по типу питания в отрыве от задач, а по всему рабочему сценарию.']),
'krutyashchiy-moment-shurupoverta':('Пример настройки для разных материалов',
['При работе с мягким древесным материалом чрезмерное усилие может быстро утопить головку крепежа или повредить место соединения. Более точная регулировка и контролируемый пуск в таких ситуациях полезнее максимального паспортного момента.',
'При работе с плотным материалом задача другая: инструмент должен соответствовать крепежу и условиям, указанным производителем. Настройку полезно сначала проверять на ненужном образце, а не на готовой видимой поверхности мебели.'])}
photoSlugs=set(slugs[5:6]+slugs[10:])
publishedAt="2026-11-03"
cats=json.loads((root/'content/categories.json').read_text(encoding='utf8'))
byid={c['id']:c for c in cats}
allarticles=[json.loads(p.read_text(encoding='utf8')) for p in d.glob('*.json')]
legacy=json.loads((root/'content/articles.json').read_text(encoding='utf8'))
allarticles+=legacy
approved=set(slugs)
published={x.get('slug') for x in allarticles if x.get('status')=='published'}|approved
results=[]
for slug in slugs:
    path=d/(slug+'.json'); a=json.loads(path.read_text(encoding='utf8'))
    assert a['status']=='draft',('article not draft',slug)
    a['status']='published'
    a['publishedAt']=publishedAt
    a['minutes']=max(5,round((len(a.get('intro','').split())+sum(len(" ".join(s['paragraphs']).split()) for s in a['sections']))/185))
    if slug=='cut-porcelain-stoneware-tools':
        a['topicId']='plitochnyy-instrument'
        a['imageAlt']='Ручной плиткорез, резка керамогранита на устойчивом рабочем столе'
    if slug=='lazernyy-dalnomer-dlya-remonta-vybor':a['topicId']='stolyarnyy-instrument'
    if slug in photoSlugs:
        a['image']=slug+'-hero.webp'
    if len(a['sections'])<6:
        assert slug in extra,slug
        name,paras=extra[slug]
        a['sections'].append({'id':'prakticheskiy-primer-vybora','title':name,'paragraphs':paras})
    # Remove tiny H2s by retaining all their content in next section
    i=0
    while i<len(a['sections']):
        section=a['sections'][i]
        body=" ".join(section.get('paragraphs',[]))
        if len(section.get('paragraphs',[]))<2 or len(body)<180:
            if i+1<len(a['sections']):
                a['sections'][i+1]['paragraphs']=section['paragraphs']+a['sections'][i+1]['paragraphs']
                a['sections'].pop(i)
            else:
                a['sections'][i-1]['paragraphs']+=section['paragraphs']
                a['sections'].pop(i)
            continue
        i+=1
    assert len(a['sections'])>=6,(slug,len(a['sections']))
    faq=a.setdefault('faqs',[])
    for q,ans in faqs[slug]:
        if not any(q.lower()==f.get('question',f.get('q','')).lower() for f in faq):
            faq.append({'question':q,'answer':ans})
    assert len(faq)>=4,(slug,len(faq))
    # Add only verified relevant internal links from already-published or this batch.
    catid=a['categoryIds'][0];category=byid[catid]
    related=[x for x in allarticles if x.get('slug') in published and x.get('slug')!=slug and catid in x.get('categoryIds',[])]
    if not related:
        related=[x for x in allarticles if x.get('slug') in approved and x.get('slug')!=slug and byid[x['categoryIds'][0]]['groupId']==category['groupId']]
    existing=a['sections'][-1].setdefault('links',[])
    linked={x['href'] for x in existing}
    for old in related:
        if len(existing)>=3:break
        link='/article/'+old['slug']+'/'
        if link not in linked:
            existing.append({'href':link,'label':old['title']})
            linked.add(link)
    if not existing:a['sections'][-1].pop('links',None)
    assert a['id'] not in [x for c in cats if c['id']!=catid for x in c.get('articles',[])],('id in foreign category',slug)
    if a['id'] not in category['articles']:category['articles'].append(a['id'])
    if not a.get('imageAlt'):a['imageAlt']='Иллюстрация к статье: '+a['title']
    path.write_text(json.dumps(a,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    results.append((slug,len(a['sections']),len(faq),a['image'],len(a['sections'][-1].get('links',[]))))
(root/'content/categories.json').write_text(json.dumps(cats,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('Prepared',len(results),'published article JSONs')
for row in results:print(*row,sep=' | ')
