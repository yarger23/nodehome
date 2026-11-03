# Публикация 20 статей Nodehome через GitHub

**Только GitHub, без ZIP и ручных скриптов на VPS.** Настроено в `.github/workflows/build-site.yml` и `scripts/publish-engineering-20.mjs`.

## Статус на 4 ноября 2026

- Первые 5 статей уже имеют `status: published` и собранные HTML-страницы в `main`.
- Ещё 15 материалов готовы текстом, но остаются `draft` до загрузки фото.
- Все 15 нужных имён файлов:

- `assets/images/dogovor-obsluzhivaniya-gazovogo-oborudovaniya-hero.webp`
- `assets/images/podgotovka-inzhenernyh-sistem-k-zime-hero.webp`
- `assets/images/datchik-protechki-ili-sistema-zashchity-hero.webp`
- `assets/images/dokumenty-pri-priemke-elektromontazha-hero.webp`
- `assets/images/stoimost-otopleniya-chastnogo-doma-sravnenie-hero.webp`
- `assets/images/pritochnaya-ventilyatsiya-ili-provetrivanie-hero.webp`
- `assets/images/kak-snizit-rashody-na-otoplenie-bez-zameny-kotla-hero.webp`
- `assets/images/ochistka-vody-po-rezultatam-analiza-hero.webp`
- `assets/images/kondensat-na-oknah-prichiny-i-chto-proverit-hero.webp`
- `assets/images/skolko-elektroenergii-potreblyaet-chastnyy-dom-hero.webp`
- `assets/images/priznaki-neispravnosti-otopleniya-kogda-vyzyvat-mastera-hero.webp`
- `assets/images/elektrobezopasnost-vannoy-voprosy-proektirovshchiku-hero.webp`
- `assets/images/kak-vybrat-organizaciyu-po-obsluzhivaniyu-gaza-hero.webp`
- `assets/images/perepady-davleniya-vody-v-chastnom-dome-hero.webp`
- `assets/images/vydelennaya-elektricheskaya-moshchnost-dlya-doma-hero.webp`

## GitHub-only процесс

1. Коммитить **каждую одобренную фотографию** непосредственно в `main`, папку `assets/images/`; использовать только точное имя файла выше.
2. GitHub Actions автоматически проверит фотографию: WebP, реальное разрешение минимум 1200×800, размер не меньше 25 KB, отсутствие идентичных файлов среди уже опубликованных обложек.
3. Если фото прошло проверку, обработчик переведёт соответствующий готовый `draft` в `published`, зарегистрирует его в `content/categories.json`, проверит структуру статьи, ссылки и качество текста, соберёт HTML и скопирует изображения в `site/`.
4. Только после успешной сборки GitHub Actions сделает коммит подготовленного сайта обратно в `main`. При ошибке публикация не происходит.
5. Для обновления **живого VPS** после изменения `main` по-прежнему нужны `git pull --ff-only origin main` и `cp -a site/. /var/www/nodehome/`, пока не настроен отдельный автоматический деплой на сервер.

**Редакционный стандарт:** изображения должны быть отдельными релевантными качественными фотографиями без коллажей, текста и явных артефактов. Автоматическая техническая проверка не заменяет визуальную оценку. Скрипт НЕ генерирует обложки из старых картинок и НЕ публикует статьи без фото.

## Ограничение

Текущее подключение GitHub в чате умеет коммитить UTF-8-файлы и Git-объекты с переданным содержимым, но не имеет прямой передачи локальных WebP-файлов из рабочей среды. Для 15 фото нужен способ записи **непосредственно в GitHub**, например загрузка бинарных файлов через интерфейс GitHub либо подключённый рабочий процесс с доступом к этим файлам. Обходных ZIP-процедур нет.
