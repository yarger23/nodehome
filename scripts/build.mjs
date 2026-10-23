import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "site");
const BASE_URL = "https://nodehome.ru";
const CSS_VERSION = createHash("sha256")
  .update(await readFile(path.join(ROOT, "assets", "site.css")))
  .digest("hex")
  .slice(0, 12);

const YANDEX_METRIKA_HEAD = `<!-- Yandex.Metrika counter -->
<script type="text/javascript">
    (function(m,e,t,r,i,k,a){
        m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
    })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=113679491', 'ym');

    ym(113679491, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
</script>
<!-- /Yandex.Metrika counter -->`;
const YANDEX_METRIKA_NOSCRIPT = `<noscript><div><img src="https://mc.yandex.ru/watch/113679491" style="position:absolute; left:-9999px;" alt="" /></div></noscript>`;

const readJson = async (file) =>
  JSON.parse(await readFile(path.join(ROOT, "content", file), "utf8"));

const [site, categories, articleRecords, sections] = await Promise.all([
  readJson("site.json"),
  readJson("categories.json"),
  readJson("articles.json"),
  readJson("sections.json")
]);

// Independent articles live in content/articles/, alongside the original catalog.
const articlesDirectory = path.join(ROOT, "content", "articles");
const articleFiles = await readdir(articlesDirectory).catch((error) => {
  if (error.code === "ENOENT") return [];
  throw error;
});
const extraArticleRecords = await Promise.all(articleFiles
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) => readJson(path.join("articles", name))));
const articles = [...articleRecords, ...extraArticleRecords].filter((item) => item.status === "published");
const categoryById = Object.fromEntries(categories.map((item) => [item.id, item]));
const articleById = Object.fromEntries(articles.map((item) => [item.id, item]));
const sectionById = Object.fromEntries(sections.map((item) => [item.id, item]));
if (sections.length !== 5) throw new Error("Catalog data must define exactly five main sections.");
if (new Set(sections.map((section) => section.id)).size !== sections.length) {
  throw new Error("Main section IDs must be unique.");
}
if (new Set(categories.map((category) => category.id)).size !== categories.length) {
  throw new Error("Category IDs must be unique.");
}
if (new Set(articles.map((article) => article.id)).size !== articles.length) {
  throw new Error("Published article IDs must be unique.");
}
const categorySectionById = Object.fromEntries(categories.map((category) =>
  [category.id, sectionById[category.sectionId]]));
const groupById = Object.fromEntries(sections.flatMap((section) =>
  section.groups.map((group) => [group.id, { ...group, sectionId: section.id, section }])));
const sectionGroupIds = sections.flatMap((section) => section.groups.map((group) => group.id));
const repeatedGroupIds = sectionGroupIds.filter((id, index) => sectionGroupIds.indexOf(id) !== index);
if (repeatedGroupIds.length) throw new Error("Duplicate group ID: " + [...new Set(repeatedGroupIds)].join(", "));
const invalidGroupIds = Object.values(groupById).filter((group) =>
  !group.id.startsWith(group.sectionId + "-")
);
if (invalidGroupIds.length) {
  throw new Error("Group IDs must start with their section ID: " + invalidGroupIds.map((group) => group.id).join(", "));
}
const groupSlug = (group) => group.id.slice(group.sectionId.length + 1);
const groupRoute = (group) => group.section.route + groupSlug(group) + "/";
const legacyGroupRoute = (group) => "/catalog/groups/" + group.id + "/";
const topicRoute = (group, topic) => groupRoute(group) + topic.id + "/";
const topicRecords = Object.values(groupById).flatMap((group) =>
  group.topics.map((topic) => ({ topic, group })));
const invalidTopicIds = topicRecords.filter(({ topic }) =>
  !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topic.id)
);
if (invalidTopicIds.length) {
  throw new Error("Topic IDs must be stable URL slugs: " +
    invalidTopicIds.map(({ group, topic }) => group.id + "/" + topic.id).join(", "));
}
const topicRoutes = topicRecords.map(({ group, topic }) => topicRoute(group, topic));
if (new Set(topicRoutes).size !== topicRoutes.length) {
  throw new Error("Generated topic routes must be unique.");
}
const topicByRoute = Object.fromEntries(topicRecords.map((record) =>
  [topicRoute(record.group, record.topic), record]));
const PAGE_SIZE = 15;
const invalidCategories = categories.filter((category) =>
  !sectionById[category.sectionId] || !groupById[category.groupId] ||
  groupById[category.groupId]?.sectionId !== category.sectionId
);
if (invalidCategories.length) {
  throw new Error("Categories must point to an existing group in their section: " +
    invalidCategories.map((category) => category.id).join(", "));
}
const missingNavigationSections = site.navigation.map((item) => item.sectionId)
  .filter((id) => !sectionById[id]);
if (missingNavigationSections.length) {
  throw new Error("Unknown section ID in navigation: " + missingNavigationSections.join(", "));
}
if (site.navigation.length !== 5 || new Set(site.navigation.map((item) => item.sectionId)).size !== 5) {
  throw new Error("Navigation must contain five unique main sections.");
}
const invalidPublishedArticles = articles.filter((article) =>
  !Array.isArray(article.categoryIds) || article.categoryIds.length !== 1 ||
  !categoryById[article.categoryIds[0]]
);
if (invalidPublishedArticles.length) {
  throw new Error("Each published article must have exactly one existing primary category: " +
    invalidPublishedArticles.map((article) => article.id).join(", "));
}
const invalidTopicAssignments = articles.filter((article) => {
  if (!article.topicId) return false;
  const category = categoryById[article.categoryIds[0]];
  const group = category && groupById[category.groupId];
  return !group?.topics.some((topic) => topic.id === article.topicId);
});
if (invalidTopicAssignments.length) {
  throw new Error("Article topic IDs must belong to the article's primary category group: " +
    invalidTopicAssignments.map((article) => article.id).join(", "));
}
for (const category of categories) {
  const expectedArticles = articles.filter((article) => article.categoryIds[0] === category.id).map((article) => article.id);
  const declaredArticles = category.articles || [];
  if (expectedArticles.length !== declaredArticles.length ||
      expectedArticles.some((id) => !declaredArticles.includes(id)) ||
      declaredArticles.some((id) => !articleById[id])) {
    throw new Error("Category article list does not match primary article categories: " + category.id);
  }
}

// A legacy catalog category is redundant when it contains exactly the same
// published articles as one hierarchical topic. Keep its URL as a redirect.
const canonicalTopicByCategoryId = Object.fromEntries(categories.map((category) => {
  const categoryArticles = articles.filter((article) => article.categoryIds[0] === category.id);
  const group = groupById[category.groupId];
  const matchingTopic = group?.topics.find((topic) => {
    const topicArticles = articles.filter((article) =>
      categoryById[article.categoryIds[0]]?.groupId === group.id && article.topicId === topic.id
    );
    return topicArticles.length === categoryArticles.length && categoryArticles.length > 0 &&
      categoryArticles.every((article) => topicArticles.some((item) => item.id === article.id));
  });
  return [category.id, matchingTopic ? topicRoute(group, matchingTopic) : ""];
}));
const categoryRoute = (category) => canonicalTopicByCategoryId[category.id] || "/catalog/" + category.id + "/";

const categoriesForGroup = (group) => categories.filter((category) =>
  category.groupId === group.id && !canonicalTopicByCategoryId[category.id] &&
  (category.articles || []).some((id) => articleById[id])
);
const articlesForGroup = (group) => articles.filter((article) =>
  categoryById[article.categoryIds[0]]?.groupId === group.id
);
const articlesForSection = (section) => articles.filter((article) =>
  categoryById[article.categoryIds[0]]?.sectionId === section.id
);
const sectionHasArticles = (section) => categories.some((category) =>
  category.sectionId === section.id && (category.articles || []).some((id) => articleById[id])
);

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function routeFile(route) {
  const clean = route.replace(/^\/+|\/+$/g, "");
  return clean ? path.join(OUTPUT, clean, "index.html") : path.join(OUTPUT, "index.html");
}

async function writeRoute(route, html) {
  const file = routeFile(route);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html, "utf8");
}

function schemaScript(data) {
  if (!data || !data.length) return "";
  return '<script type="application/ld+json">' + safeJson(data) + "</script>";
}

function breadcrumb(items, contained = false) {
  const links = [{ label: "Главная", href: "/" }, ...items];
  const classes = contained ? "breadcrumbs container" : "breadcrumbs";
  return '<nav class="' + classes + '" aria-label="Хлебные крошки"><ol>' +
    links.map((item, index) => {
      const content = item.href && index !== links.length - 1
        ? '<a href="' + escapeHtml(item.href) + '">' + escapeHtml(item.label) + "</a>"
        : '<span aria-current="page">' + escapeHtml(item.label) + "</span>";
      return "<li>" + content + "</li>";
    }).join("") +
    "</ol></nav>";
}

function breadcrumbSchema(items, route) {
  const links = [{ label: "Главная", href: "/" }, ...items];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: links.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: BASE_URL + (item.href || route)
    }))
  };
}

function header(active = "") {
  const currentArticle = articles.find((article) => active === "/article/" + article.slug + "/");
  const currentCategoryId = active.match(/^\/catalog\/([^/]+)\/$/)?.[1] || "";
  const currentTopic = topicByRoute[active] || topicRecords.find(({ group, topic }) =>
    active.startsWith(topicRoute(group, topic))
  );
  const currentGroup = currentTopic?.group ||
    Object.values(groupById).find((group) => active.startsWith(groupRoute(group)));
  const articleCategory = currentArticle ? categoryById[currentArticle.categoryIds[0]] : null;
  const activeCategory = categoryById[currentCategoryId] || articleCategory;
  const activeSectionId = currentGroup?.sectionId || activeCategory?.sectionId ||
    sections.find((section) => section.route === active)?.id || "";
  const activeGroupId = currentGroup?.id || activeCategory?.groupId || "";
  const sectionIsCurrent = (section) => activeSectionId === section.id;
  const navLink = (item, route, className = "nav-link") => {
    const current = (item.activePrefixes || [item.href]).some((prefix) =>
      route === prefix || route.startsWith(prefix)
    );
    return '<a class="' + className + '" href="' + escapeHtml(item.href) + '"' +
      (current ? ' aria-current="page"' : "") + ">" + escapeHtml(item.label) + "</a>";
  };
  const groupLinkMarkup = (group, className) => {
    const href = groupRoute(groupById[group.id]);
    return '<a class="' + className + '" href="' + escapeHtml(href) + '"' +
      (activeGroupId === group.id ? ' aria-current="page"' : "") + ">" +
      escapeHtml(group.title) + "</a>";
  };
  const desktopNav = site.navigation.map((item) => {
    const section = sectionById[item.sectionId];
    const current = sectionIsCurrent(section);
    const exact = active === section.route;
    const submenuId = "submenu-" + section.id;
    const groupLinks = section.groups.map((group) => groupLinkMarkup(group, "nav-submenu-link")).join("");
    return '<div class="nav-item"' + (current ? ' data-current="true"' : "") + ">" +
      '<div class="nav-item-row"><a class="nav-parent" id="nav-parent-' + section.id + '" href="' + escapeHtml(section.route) + '"' +
      (exact ? ' aria-current="page"' : "") + ">" + escapeHtml(section.title) + "</a>" +
      '<button class="nav-disclosure" type="button" aria-label="Открыть подрубрики: ' + escapeHtml(section.title) +
      '" aria-expanded="false" aria-controls="' + submenuId + '"><span class="nav-chevron" aria-hidden="true"></span></button></div>' +
      '<div class="nav-submenu" id="' + submenuId + '" aria-labelledby="nav-parent-' + section.id + '" hidden>' +
      groupLinks + '</div></div>';
  }).join("") + site.navigationTools.map((item) => navLink(item, active, "nav-tool")).join("");
  const mobileNav = site.navigation.map((item) => {
    const section = sectionById[item.sectionId];
    const exact = active === section.route;
    const groupLinks = section.groups.map((group) => groupLinkMarkup(group, "mobile-nav-link")).join("");
    const expanded = activeSectionId === section.id;
    return '<section class="mobile-nav-group"><h2 class="mobile-nav-heading"><a href="' +
      escapeHtml(section.route) + '"' + (exact ? ' aria-current="page"' : "") + ">" +
      escapeHtml(section.title) + '</a></h2><div class="mobile-nav-links"><details class="mobile-nav-accordion"' +
      (expanded ? " open" : "") + '><summary>Рубрики направления</summary><div class="mobile-nav-accordion-content">' +
      groupLinks + "</div></details></div></section>";
  }).join("");
  const mobileTools = site.navigationTools
    .map((item) => navLink(item, active, "mobile-nav-tool")).join("");

  return '<header class="site-header"><div class="header-inner container">' +
    '<a class="brand" href="/" aria-label="Nodehome — главная страница">' +
    '<span class="brand-mark" aria-hidden="true">N</span>' +
    '<span class="brand-name">NODEHOME</span></a>' +
    '<a class="header-search" href="' + escapeHtml(site.searchHref || "/search/") + '" aria-label="Поиск по сайту">' +
    '<svg class="search-icon" aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.3"></circle><path d="m15.5 15.5 4.2 4.2"></path></svg>' +
    '<span>Поиск</span></a>' +
    '<button class="mobile-menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-nav">' +
    '<span class="menu-icon" aria-hidden="true"></span><span>Меню</span></button>' +
    '</div><div class="nav-band"><nav class="desktop-nav container" aria-label="Разделы сайта">' +
    desktopNav + '</nav></div><nav class="mobile-nav container" id="mobile-nav" aria-label="Мобильная навигация" hidden>' +
    mobileNav + '<div class="mobile-nav-tools">' + mobileTools + '<a class="mobile-nav-tool" href="' +
    escapeHtml(site.searchHref || "/search/") + '"><svg class="search-icon" aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.3"></circle><path d="m15.5 15.5 4.2 4.2"></path></svg><span>Поиск</span></a></div></nav></header>';
}

function footer() {
  return '<footer class="site-footer"><div class="container footer-main">' +
    '<div class="footer-brand"><a class="brand brand-light" href="/"><span class="brand-mark" aria-hidden="true">N</span><span class="brand-name">NODEHOME</span></a>' +
    '<p>Практический справочник по строительству и ремонту.</p></div>' +
    '<div class="footer-links"><h2>Материалы</h2><a href="/catalog/">Все разделы</a><a href="/catalog/land/">Подготовка участка</a><a href="/article/screed/">Стяжка пола</a><a href="/article/plaster/">Расход штукатурки</a></div>' +
    '<div class="footer-links"><h2>Инструменты</h2><a href="/calculators/">Калькуляторы</a><a href="/calculators/plaster/">Штукатурка</a><a href="/calculators/screed/">Стяжка</a><a href="/search/">Поиск</a></div>' +
    "</div><div class=\"container footer-bottom\"><span>© Nodehome</span><span>Материалы носят справочный характер. Решения по проекту принимайте с профильными специалистами.</span></div></footer>";
}

function layout(options) {
  const title = options.title === site.siteName
    ? site.siteName + " — строительство и ремонт"
    : options.title + " — Nodehome";
  const canonical = options.canonicalUrl || BASE_URL + options.route;
  const image = options.image ? BASE_URL + "/assets/images/" + options.image : "";
  const socialImage = image || (options.ogType === "article" ? "" : BASE_URL + "/assets/images/hero-house.webp");
  const robots = options.robots || "index,follow";
  const redirect = options.redirectTo
    ? '<meta http-equiv="refresh" content="0;url=' + escapeHtml(options.redirectTo) + '">\n'
    : "";

  return '<!doctype html>\n<html lang="ru">\n<head>\n' +
    '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<meta name="theme-color" content="#f6f5f2">\n<meta name="description" content="' + escapeHtml(options.description) + '">\n' +
    '<meta name="robots" content="' + robots + '">\n' + redirect + '<link rel="canonical" href="' + canonical + '">\n' +
    '<meta property="og:type" content="' + (options.ogType || "website") + '">\n' +
    '<meta property="og:site_name" content="Nodehome">\n<meta property="og:title" content="' + escapeHtml(title) + '">\n' +
    '<meta property="og:description" content="' + escapeHtml(options.description) + '">\n' +
    '<meta property="og:url" content="' + canonical + '">\n' +
    (socialImage ? '<meta property="og:image" content="' + socialImage + '">\n' : "") +
    '<title>' + escapeHtml(title) + "</title>\n" +
    (options.preload ? '<link rel="preload" as="image" href="/assets/images/' + escapeHtml(options.preload) + '" fetchpriority="high">\n' : "") +
        '<link rel="icon" href="/favicon.ico" sizes="32x32">\n' +
    '<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">\n' +
    '<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" sizes="180x180">\n' +
    '<link rel="stylesheet" href="/assets/site.css?v=' + CSS_VERSION + '">\n' +
    schemaScript(options.schema) + '\n' +
    YANDEX_METRIKA_HEAD + '\n' +
    '<script src="/assets/site.js" defer></script>\n</head>\n<body>\n' +
    YANDEX_METRIKA_NOSCRIPT + '\n' +
    header(options.active || options.route || "") + '<main id="main-content">' + options.body + "</main>" +
    footer() + '\n</body>\n</html>';
}

function sectionHeading(kicker, title, lead = "", headingId = "") {
  return '<div class="section-heading"><p class="eyebrow">' + escapeHtml(kicker) + "</p>" +
    "<h2" + (headingId ? ' id="' + escapeHtml(headingId) + '"' : "") + ">" + escapeHtml(title) + "</h2>" +
    (lead ? '<p class="section-lead">' + escapeHtml(lead) + "</p>" : "") + "</div>";
}

function sectionCard(section, index) {
  return '<a class="category-card section-card" href="' + escapeHtml(section.route) + '">' +
    '<span class="category-number">' + String(index + 1).padStart(2, "0") + "</span>" +
    '<span class="category-arrow" aria-hidden="true">↗</span>' +
    "<h3>" + escapeHtml(section.title) + "</h3>" +
    "<p>" + escapeHtml(section.description) + "</p></a>";
}

function groupTopicLink(group) {
  const route = groupRoute(groupById[group.id]);
  return '<a class="topic-chip section-topic-chip" href="' + escapeHtml(route) + '"><span>' +
    escapeHtml(group.title) + '</span><span class="section-topic-count">' + group.topics.length + " тем</span></a>";
}

function articleCard(article) {
  const primaryCategory = categoryById[article.categoryIds[0]];
  const imageMarkup = article.image
    ? '<a class="article-card-image" href="/article/' + escapeHtml(article.slug) +
      '/" tabindex="-1" aria-hidden="true"><img src="/assets/images/' + escapeHtml(article.image) +
      '" alt="" width="1200" height="800" loading="lazy" decoding="async"></a>'
    : "";
  return '<article class="article-card' + (article.image ? '' : ' article-card--text-only') + '">' +
    imageMarkup +
    '<div class="article-card-body"><div class="article-card-meta"><span>' +
    escapeHtml(primaryCategory ? primaryCategory.cardTitle : "Материал") + "</span><span>" +
    escapeHtml(article.minutes) + " мин</span></div>" +
    '<h3><a href="/article/' + escapeHtml(article.slug) + '/">' + escapeHtml(article.title) + "</a></h3>" +
    "<p>" + escapeHtml(article.description) + "</p>" +
    '<a class="text-link" href="/article/' + escapeHtml(article.slug) + '/">Читать материал <span aria-hidden="true">→</span></a></div></article>';
}

function latestArticles(items) {
  // Prefer explicit publication dates. Older records without dates keep their
  // stable append order, with the latest appended item shown first.
  return items.map((article, index) => ({ article, index }))
    .sort((left, right) => {
      const leftDate = Date.parse(left.article.publishedAt || "") || 0;
      const rightDate = Date.parse(right.article.publishedAt || "") || 0;
      return rightDate - leftDate || right.index - left.index;
    })
    .map(({ article }) => article);
}

function articleListing(route, items, page, title, kicker = "Новые публикации") {
  const ordered = latestArticles(items);
  const baseRoute = route.replace(/page\/\d+\/$/, "");
  const pageCount = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const pageItems = ordered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pagination = pageCount > 1
    ? '<nav class="article-pagination" aria-label="Страницы материалов">' +
      (safePage > 1 ? '<a class="pagination-link" href="' + escapeHtml(safePage - 1 === 1 ? baseRoute : baseRoute + "page/" + (safePage - 1) + "/") + '" rel="prev">← Назад</a>' : '<span class="pagination-link is-disabled">← Назад</span>') +
      '<span class="pagination-status">Страница ' + safePage + ' из ' + pageCount + '</span>' +
      (safePage < pageCount ? '<a class="pagination-link" href="' + escapeHtml(baseRoute + "page/" + (safePage + 1) + "/") + '" rel="next">Дальше →</a>' : '<span class="pagination-link is-disabled">Дальше →</span>') +
      '</nav>'
    : "";
  return '<section class="section container listing-section"><div class="section-heading compact"><p class="eyebrow">' +
    escapeHtml(kicker) + '</p><h2>' + escapeHtml(title) + '</h2>' +
    '<p class="section-lead">Сначала показаны недавно опубликованные материалы.</p></div>' +
    (pageItems.length ? '<div class="article-grid">' + pageItems.map(articleCard).join("") + '</div>' :
      '<div class="empty-note"><strong>Материалы по этому разделу пока готовятся.</strong><p>Выберите соседнюю тему или вернитесь позже.</p></div>') +
    pagination + '</section>';
}

function topicNavigation(group, currentRoute = "") {
  const links = group.topics.map((topic) => {
    const href = topicRoute(group, topic);
    const current = href === currentRoute;
    return '<a class="topic-chip' + (current ? ' is-current' : '') + '" href="' + escapeHtml(href) + '"' +
      (current ? ' aria-current="page"' : '') + '>' + escapeHtml(topic.title) + '</a>';
  }).join("");
  return '<nav class="topic-navigation" aria-label="Темы раздела"><span class="topic-navigation-label">Темы раздела</span>' + links + '</nav>';
}

function homePage() {
  const sectionsHtml = sections.map(sectionCard).join("");
  const featured = site.featuredArticles.map((id) => articleById[id]).filter(Boolean).map(articleCard).join("");
  const faq = site.homeFaq.map((item) =>
    '<details class="faq-item"><summary>' + escapeHtml(item.question) + '</summary><p>' +
    escapeHtml(item.answer) + "</p></details>").join("");
  const body = '<section class="hero-section container"><div class="hero-copy">' +
    '<p class="eyebrow"><span class="eyebrow-dot"></span> Практический справочник</p>' +
    "<h1>" + escapeHtml(site.heroTitle) + "</h1>" +
    '<p class="hero-lead">' + escapeHtml(site.heroLead) + "</p>" +
    '<div class="hero-actions"><a class="button button-dark" href="/catalog/">Открыть материалы <span aria-hidden="true">↗</span></a>' +
    '<a class="button button-light" href="/calculators/">Калькуляторы</a></div>' +
    '<form class="hero-search" action="/search/" method="get" role="search">' +
    '<label class="visually-hidden" for="home-search">Найти материал</label>' +
    '<input id="home-search" name="q" type="search" placeholder="Например, стяжка пола" autocomplete="off">' +
    '<button type="submit" aria-label="Искать">Найти <span aria-hidden="true">→</span></button></form>' +
    '<p class="hero-search-hint">Ищите инструкции, расчёты и разборы материалов</p></div>' +
    '<figure class="hero-visual"><img src="/assets/images/hero-house.webp" alt="Строительство загородного дома: деревянный каркас, материалы и чертёж" width="1200" height="800" fetchpriority="high" decoding="async">' +
    '<figcaption><span class="photo-mark"></span> От участка до готового дома</figcaption></figure></section>' +
    '<section class="section container" aria-labelledby="topics-title">' +
    sectionHeading("Выберите раздел", "С чего начинается ваш проект?", "Пять направлений каталога: от строительства дома до инструмента и работ на участке.", "topics-title") +
    '<div class="category-grid">' + sectionsHtml + "</div></section>" +
    '<section class="section section-muted"><div class="container">' +
    sectionHeading("Полезные материалы", "Разобраться перед началом работ", "Короткие и практичные инструкции с расчётами и проверочными списками.") +
    '<div class="article-grid">' + featured + '</div><div class="section-more"><a class="text-link" href="/catalog/">Все материалы <span aria-hidden="true">→</span></a></div>' +
    "</div></section>" +
    '<section class="section container calculators-promo"><div class="promo-copy"><p class="eyebrow">Инструменты</p>' +
    "<h2>Сначала посчитайте.<br>Потом покупайте.</h2>" +
    '<p>Подставьте свои размеры и расход с упаковки. Калькулятор покажет формулу и предварительный результат.</p>' +
    '<a class="button button-light" href="/calculators/">Открыть калькуляторы <span aria-hidden="true">↗</span></a></div>' +
    '<div class="promo-list"><a href="/calculators/plaster/"><span>01</span><strong>Расход штукатурки</strong><span aria-hidden="true">↗</span></a>' +
    '<a href="/calculators/screed/"><span>02</span><strong>Объём стяжки</strong><span aria-hidden="true">↗</span></a>' +
    '<a href="/calculators/paint/"><span>03</span><strong>Количество краски</strong><span aria-hidden="true">↗</span></a></div></section>' +
    '<section class="section container faq-section"><div class="faq-intro"><p class="eyebrow">Частые вопросы</p><h2>Ответы перед стартом</h2><p>Общие ориентиры, которые помогут собрать исходные данные.</p></div>' +
    '<div class="faq-list">' + faq + "</div></section>";

  const schema = [{
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.siteName,
    url: BASE_URL + "/",
    description: site.description,
    inLanguage: "ru-RU"
  }];
  return layout({
    title: site.siteName,
    description: site.description,
    route: "/",
    body,
    preload: "hero-house.webp",
    schema
  });
}

function catalogPage() {
  const body = breadcrumb([{ label: "Материалы", href: "/catalog/" }], true) +
    '<section class="page-intro container"><p class="eyebrow">Библиотека Nodehome</p>' +
    "<h1>Материалы о строительстве и ремонте</h1>" +
    '<p class="page-lead">Выберите направление, чтобы открыть тематические группы и опубликованные инструкции.</p></section>' +
    '<section class="section container catalog-section"><div class="category-grid">' +
    sections.map(sectionCard).join("") + "</div></section>" +
    '<section class="catalog-index container"><p class="eyebrow">Структура каталога</p><p>Полный список тем сгруппирован на страницах направлений. Ссылки ведут только на опубликованные рубрики и материалы.</p></section>' +
    '<section class="section section-muted"><div class="container">' +
    sectionHeading("В редакции", "Популярные инструкции", "Проверяйте условия своего объекта и данные на упаковке материала.") +
    '<div class="article-grid">' + site.featuredArticles.map((id) => articleById[id]).filter(Boolean).map(articleCard).join("") + "</div></div></section>";
  return layout({
    title: "Материалы о строительстве и ремонте",
    description: "Пять направлений каталога Nodehome: строительство дома, ремонт и отделка, инженерные системы, участок и постройки, инструменты и техника.",
    route: "/catalog/",
    body,
    active: "/catalog/",
    schema: [breadcrumbSchema([{ label: "Материалы" }], "/catalog/")]
  });
}

function sectionPage(section, page = 1, route = section.route) {
  const groupTopics = section.groups.map(groupTopicLink).join("");
  const hasArticles = sectionHasArticles(section);
  const body = breadcrumb([
    { label: "Материалы", href: "/catalog/" },
    { label: section.title }
  ], true) +
    '<section class="page-intro section-page-intro container"><p class="eyebrow">Раздел Nodehome</p>' +
    "<h1>" + escapeHtml(section.title) + "</h1>" +
    '<p class="page-lead">' + escapeHtml(section.intro) + "</p></section>" +
    '<section class="section container section-topics section-page-topics"><div class="section-heading compact"><p class="eyebrow">Основные рубрики</p>' +
    '<h2>Выберите тему</h2><p class="section-lead">Каждая рубрика открывает отдельную страницу со списком подтем и материалов.</p></div>' +
    '<nav class="section-topic-navigation" aria-label="Темы раздела">' + groupTopics + '</nav></section>' +
    articleListing(route, articlesForSection(section), page, "Последние материалы раздела") +
    (!hasArticles ? '<section class="container section-empty-note"><p>Раздел уже доступен. Материалы будут добавляться по мере подготовки публикаций.</p></section>' : "");
  return layout({
    title: section.title,
    description: section.description,
    route,
    body,
    active: section.route,
    robots: hasArticles ? "index,follow" : "noindex,follow",
    schema: [breadcrumbSchema([
      { label: "Материалы", href: "/catalog/" },
      { label: section.title }
    ], section.route)]
  });
}

function groupPage(group, page = 1, route = groupRoute(group)) {
  const groupArticles = articlesForGroup(group);
  const breadcrumbItems = [
    { label: "Материалы", href: "/catalog/" },
    { label: group.section.title, href: group.section.route },
    { label: group.title }
  ];
  const body = breadcrumb(breadcrumbItems, true) +
    '<section class="page-intro container"><p class="eyebrow">' + escapeHtml(group.section.title) +
    '</p><h1>' + escapeHtml(group.title) +
    '</h1><p class="page-lead">Выберите тему или откройте последние опубликованные материалы этого направления.</p></section>' +
    topicNavigation(group) +
    articleListing(route, groupArticles, page, "Последние материалы раздела", "Опубликованные материалы");
  return layout({
    title: group.title,
    description: "Подтемы раздела «" + group.title + "» и опубликованные материалы Nodehome.",
    route,
    body,
    active: route,
    robots: groupArticles.length ? "index,follow" : "noindex,follow",
    schema: [breadcrumbSchema(breadcrumbItems, route)]
  });
}

function topicPage(group, topic, page = 1, route = topicRoute(group, topic)) {
  const related = articlesForGroup(group).filter((article) => article.topicId === topic.id);
  const breadcrumbItems = [
    { label: "Материалы", href: "/catalog/" },
    { label: group.section.title, href: group.section.route },
    { label: group.title, href: groupRoute(group) },
    { label: topic.title }
  ];
  const body = breadcrumb(breadcrumbItems, true) +
    '<section class="page-intro container"><p class="eyebrow">' + escapeHtml(group.title) + '</p><h1>' +
    escapeHtml(topic.title) + '</h1><p class="page-lead">Инструкции и разборы Nodehome по теме «' +
    escapeHtml(topic.title) + '».</p></section>' + topicNavigation(group, route) +
    articleListing(route, related, page, "Материалы по теме", "Инструкции");
  return layout({
    title: topic.title,
    description: "Статьи и инструкции Nodehome по теме «" + topic.title + "».",
    route,
    body,
    active: route,
    robots: related.length ? "index,follow" : "noindex,follow",
    schema: [breadcrumbSchema(breadcrumbItems, route)]
  });
}

function redirectPage(route, destination, label) {
  const body = '<section class="page-intro container error-page"><p class="eyebrow">Адрес раздела обновлён</p>' +
    "<h1>" + escapeHtml(label) + "</h1>" +
    '<p class="page-lead">Страница теперь доступна по новому адресу.</p>' +
    '<a class="button button-dark" href="' + escapeHtml(destination) + '">Перейти в раздел</a></section>';
  return layout({
    title: label,
    description: label + " доступен по новому адресу Nodehome.",
    route,
    canonicalUrl: BASE_URL + destination,
    redirectTo: destination,
    robots: "noindex,follow",
    active: destination,
    body
  });
}

function categoryPage(category, page = 1, route = "/catalog/" + category.id + "/") {
  const related = category.articles.map((id) => articleById[id]).filter(Boolean);
  const parentSection = categorySectionById[category.id];
  const parentGroup = groupById[category.groupId];
  const groupHasPublishedPage = categoriesForGroup(parentGroup).length > 0;
  const breadcrumbItems = [
    { label: "Материалы", href: "/catalog/" },
    { label: parentSection.title, href: parentSection.route },
    ...(groupHasPublishedPage ? [{ label: parentGroup.title, href: groupRoute(parentGroup) }] : []),
    { label: category.title }
  ];
  const body = breadcrumb(breadcrumbItems, true) +
    '<section class="page-intro container"><p class="eyebrow">Раздел материалов</p>' +
    "<h1>" + escapeHtml(category.title) + "</h1>" +
    '<p class="page-lead">' + escapeHtml(category.intro) + "</p></section>" +
    topicNavigation(parentGroup) +
    '<section class="container category-start"><div><p class="eyebrow">С чего начать</p><h2>Соберите исходные данные</h2>' +
    '<p>Перед выбором решения проверьте условия объекта, проект и инструкции к материалам.</p></div>' +
    "<ol>" + category.start.map((item) => "<li>" + escapeHtml(item) + "</li>").join("") + "</ol></section>" +
    articleListing(route, related, page, "Материалы раздела", "Инструкции");
  return layout({
    title: category.title,
    description: category.description,
    route,
    body,
    active: route,
    robots: related.length ? "index,follow" : "noindex,follow",
    schema: [breadcrumbSchema(breadcrumbItems, route)]
  });
}

function articleBody(article) {
  return article.sections.map((section) => {
    let html = '<section id="' + escapeHtml(section.id) + '"><h2>' + escapeHtml(section.title) + "</h2>";
    html += (section.paragraphs || []).map((paragraph) => "<p>" + escapeHtml(paragraph) + "</p>").join("");
    if (section.bullets) {
      html += "<ul>" + section.bullets.map((item) => "<li>" + escapeHtml(item) + "</li>").join("") + "</ul>";
    }
    if (section.table) {
      const headerCells = (section.table.headers || []).map((value) => "<th scope=\"col\">" + escapeHtml(value) + "</th>").join("");
      const rows = (section.table.rows || []).map((row) =>
        "<tr>" + row.map((value, index) =>
          (index === 0 ? "<th scope=\"row\">" : "<td>") + escapeHtml(value) + (index === 0 ? "</th>" : "</td>")
        ).join("") + "</tr>").join("");
      html += '<div class="article-table-scroll" role="region" aria-label="Сравнение материалов" tabindex="0"><table class="article-comparison-table"><thead><tr>' +
        headerCells + "</tr></thead><tbody>" + rows + "</tbody></table></div>";
    }
    if (section.image) {
      html += '<figure class="article-figure"><img src="/assets/images/' + escapeHtml(section.image) +
        '" alt="' + escapeHtml(section.imageAlt || "") + '" width="1200" height="800" loading="lazy" decoding="async">' +
        (section.imageCaption ? '<figcaption>' + escapeHtml(section.imageCaption) + "</figcaption>" : "") + "</figure>";
    }
    if (section.links && section.links.length) {
      html += '<p class="article-inline-links">' + section.links.map((link) =>
        '<a href="' + escapeHtml(link.href) + '">' + escapeHtml(link.label) + ' <span aria-hidden="true">→</span></a>'
      ).join("") + "</p>";
    }
    if (section.callout) {
      html += '<aside class="article-callout"><span class="callout-mark" aria-hidden="true">i</span><p>' +
        escapeHtml(section.callout) + "</p></aside>";
    }
    return html + "</section>";
  }).join("");
}

function articlePage(article) {
  const primaryCategory = categoryById[article.categoryIds[0]];
  const parentSection = primaryCategory ? categorySectionById[primaryCategory.id] : null;
  const parentGroup = primaryCategory ? groupById[primaryCategory.groupId] : null;
  const articleTopic = parentGroup?.topics.find((topic) => topic.id === article.topicId);
  const toc = article.sections.map((section) =>
    '<li><a href="#' + escapeHtml(section.id) + '">' + escapeHtml(section.title) + "</a></li>").join("");
  const related = articles.filter((other) => other.id !== article.id &&
    other.categoryIds.some((id) => article.categoryIds.includes(id))).slice(0, 2);
  const faqs = article.faqs.map((item) =>
    '<details class="faq-item"><summary>' + escapeHtml(item.question) + '</summary><p>' +
    escapeHtml(item.answer) + "</p></details>").join("");
  const pathItems = [
    { label: "Материалы", href: "/catalog/" },
    ...(parentSection ? [{ label: parentSection.title, href: parentSection.route }] : []),
    ...(parentGroup ? [{ label: parentGroup.title, href: groupRoute(parentGroup) }] : []),
    ...(articleTopic ? [{ label: articleTopic.title, href: topicRoute(parentGroup, articleTopic) }] : []),
    ...(primaryCategory && !(articleTopic && (
      categoryRoute(primaryCategory) === topicRoute(parentGroup, articleTopic) ||
      primaryCategory.title === articleTopic.title
    )) ? [{ label: primaryCategory.title, href: categoryRoute(primaryCategory) }] : []),
    ...(!primaryCategory ? [{ label: "Статья", href: "/catalog/" }] : []),
    { label: article.title }
  ];
  const body = '<article class="article-shell container">' + breadcrumb(pathItems) +
    '<header class="article-head"><p class="eyebrow">' + escapeHtml(primaryCategory ? primaryCategory.title : "Инструкция") + "</p>" +
    "<h1>" + escapeHtml(article.title) + "</h1><p class=\"article-lead\">" + escapeHtml(article.intro) + "</p>" +
    '<div class="article-meta"><span>' + escapeHtml(article.minutes) + " минут чтения</span><span>Практическая инструкция</span></div></header>" +
    (article.image ? '<img class="article-cover" src="/assets/images/' + escapeHtml(article.image) +
      '" alt="' + escapeHtml(article.imageAlt || "") +
      '" width="1200" height="800" fetchpriority="high" decoding="async">' : "") +
    '<details class="article-toc"><summary>Содержание статьи <span>' + article.sections.length + " раздела</span></summary><ol>" + toc + "</ol></details>" +
    '<div class="article-reading"><div class="article-content">' + articleBody(article) +
    (faqs ? '<section class="article-faq"><h2>Частые вопросы</h2>' + faqs + "</section>" : "") +
    '<p class="source-note">Материал носит справочный характер. Условия работ, допустимые слои и сроки проверяйте по проекту и инструкции производителя.</p>' +
    "</div></div></article>" +
    (related.length ? '<section class="section section-muted related-section"><div class="container">' +
      sectionHeading("Продолжить", "Материалы по теме") + '<div class="article-grid">' +
      related.map(articleCard).join("") + "</div></div></section>" : "");
  const schema = [
    breadcrumbSchema(pathItems, "/article/" + article.slug + "/"),
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: article.title,
      description: article.description,
      ...(article.image ? { image: BASE_URL + "/assets/images/" + article.image } : {}),
      ...(article.publishedAt ? { datePublished: article.publishedAt } : {}),
      mainEntityOfPage: BASE_URL + "/article/" + article.slug + "/",
      inLanguage: "ru-RU",
      publisher: { "@type": "Organization", name: site.siteName, url: BASE_URL }
    }
  ];
  return layout({
    title: article.title,
    description: article.description,
    route: "/article/" + article.slug + "/",
    body,
    image: article.image,
    ogType: "article",
    schema
  });
}

const calculatorData = {
  plaster: {
    title: "Расчёт штукатурки",
    intro: "Оцените массу сухой смеси и число мешков по площади, среднему слою и расходу, указанному производителем.",
    formula: "Площадь × средняя толщина × расход на 1 м² и 1 мм. Затем добавляется выбранный запас.",
    fields: [
      { name: "area", label: "Площадь стен", unit: "м²", step: "0.1", value: "20", min: "0.1" },
      { name: "rate", label: "Расход с упаковки", unit: "кг/м² на 1 мм", step: "0.01", value: "0.9", min: "0.01" },
      { name: "thickness", label: "Средняя толщина слоя", unit: "мм", step: "1", value: "10", min: "1" },
      { name: "bag", label: "Масса одного мешка", unit: "кг", step: "1", value: "25", min: "1" },
      { name: "reserve", label: "Запас", unit: "%", step: "1", value: "0", min: "0" }
    ],
    note: "Расход, толщину и фасовку берите с упаковки выбранной смеси. Результат не заменяет обмер поверхности."
  },
  screed: {
    title: "Расчёт объёма стяжки",
    intro: "Оцените геометрический объём слоя по площади и средней толщине. Калькулятор не переводит объём в мешки, поскольку выход смеси зависит от продукта.",
    formula: "Площадь × средняя толщина слоя в метрах. Для перевода миллиметров в метры разделите толщину на 1000.",
    fields: [
      { name: "area", label: "Площадь пола", unit: "м²", step: "0.1", value: "20", min: "0.1" },
      { name: "thickness", label: "Средняя толщина слоя", unit: "мм", step: "1", value: "50", min: "1" },
      { name: "reserve", label: "Запас на неровности", unit: "%", step: "1", value: "0", min: "0" }
    ],
    note: "Средняя толщина должна учитывать перепады основания. Для расчёта сухой смеси используйте выход готового раствора с упаковки."
  },
  paint: {
    title: "Расчёт краски",
    intro: "Посчитайте ориентировочный объём краски по площади, числу слоёв и укрывистости выбранного продукта.",
    formula: "Площадь × число слоёв ÷ укрывистость на упаковке. После этого можно добавить запас.",
    fields: [
      { name: "area", label: "Площадь окрашивания", unit: "м²", step: "0.1", value: "20", min: "0.1" },
      { name: "coats", label: "Количество слоёв", unit: "слоя", step: "1", value: "2", min: "1" },
      { name: "coverage", label: "Укрывистость с упаковки", unit: "м²/л", step: "0.1", value: "10", min: "0.1" },
      { name: "reserve", label: "Запас", unit: "%", step: "1", value: "0", min: "0" }
    ],
    note: "Фактический расход зависит от основания, способа нанесения, цвета и инструмента. Сверьтесь с инструкцией производителя."
  }
};

function calculatorForm(id, data) {
  const fields = data.fields.map((field) =>
    '<label class="form-field"><span>' + escapeHtml(field.label) + '</span><span class="input-with-unit">' +
    '<input type="number" name="' + escapeHtml(field.name) + '" min="' + escapeHtml(field.min) +
    '" step="' + escapeHtml(field.step) + '" value="' + escapeHtml(field.value) + '" required>' +
    '<span>' + escapeHtml(field.unit) + "</span></span></label>").join("");
  return '<form class="calculator-form" data-material-calculator="' + escapeHtml(id) + '">' +
    '<div class="calculator-fields">' + fields + "</div>" +
    '<button class="button button-dark" type="submit">Рассчитать</button>' +
    '<div class="calc-result" aria-live="polite" hidden></div></form>';
}

function calculatorsPage() {
  const items = Object.entries(calculatorData);
  const cards = items.map(([id, data], index) =>
    '<a class="tool-card" href="/calculators/' + id + '/"><span class="category-number">' +
    String(index + 1).padStart(2, "0") + '</span><div><h3>' + escapeHtml(data.title) +
    "</h3><p>" + escapeHtml(data.intro) + '</p></div><span class="category-arrow" aria-hidden="true">↗</span></a>').join("");
  const body = breadcrumb([{ label: "Калькуляторы" }], true) +
    '<section class="page-intro container"><p class="eyebrow">Инструменты</p><h1>Строительные калькуляторы</h1>' +
    '<p class="page-lead">Подставьте параметры своего объекта и проверьте, как получается результат. Для расхода материалов используйте данные производителя.</p></section>' +
    '<section class="section container calculator-list"><div class="tool-grid">' + cards + "</div></section>" +
    '<section class="container calculator-note"><strong>Результат — предварительная оценка.</strong><p>Калькуляторы выполняют арифметический расчёт и не заменяют проект, обмеры и техническую документацию продукта.</p></section>';
  return layout({
    title: "Строительные калькуляторы",
    description: "Калькуляторы Nodehome для предварительного расчёта штукатурки, объёма стяжки и краски по параметрам объекта.",
    route: "/calculators/",
    body,
    active: "/calculators/",
    schema: [breadcrumbSchema([{ label: "Калькуляторы" }], "/calculators/")]
  });
}

function calculatorPage(id, data) {
  const body = breadcrumb([
    { label: "Калькуляторы", href: "/calculators/" },
    { label: data.title }
  ], true) +
    '<section class="page-intro container"><p class="eyebrow">Калькулятор Nodehome</p><h1>' +
    escapeHtml(data.title) + "</h1><p class=\"page-lead\">" + escapeHtml(data.intro) + "</p></section>" +
    '<section class="container calculator-page-layout"><div class="calculator-panel">' +
    calculatorForm(id, data) + "</div><aside class=\"formula-panel\"><p class=\"eyebrow\">Формула</p><h2>Как считается результат</h2>" +
    "<p>" + escapeHtml(data.formula) + "</p><p>" + escapeHtml(data.note) + "</p></aside></section>" +
    '<section class="container calculator-note"><a class="text-link" href="/calculators/">← Все калькуляторы</a></section>';
  return layout({
    title: data.title,
    description: data.intro,
    route: "/calculators/" + id + "/",
    body,
    active: "/calculators/",
    schema: [breadcrumbSchema([
      { label: "Калькуляторы", href: "/calculators/" },
      { label: data.title }
    ], "/calculators/" + id + "/")]
  });
}

function searchPage() {
  const searchable = [
    ...categories.filter((category) => !canonicalTopicByCategoryId[category.id] &&
      (category.articles || []).some((id) => articleById[id])).map((category) => ({
      title: category.title,
      description: category.description,
      href: categoryRoute(category),
      type: "Раздел"
    })),
    ...articles.map((article) => ({
      title: article.title,
      description: article.description,
      href: "/article/" + article.slug + "/",
      type: "Материал"
    })),
    ...Object.entries(calculatorData).map(([id, calculator]) => ({
      title: calculator.title,
      description: calculator.intro,
      href: "/calculators/" + id + "/",
      type: "Калькулятор"
    }))
  ];
  const results = searchable.map((item) =>
    '<article class="search-result" data-search-item data-search-text="' +
    escapeHtml((item.title + " " + item.description + " " + item.type).toLowerCase()) + '">' +
    '<span class="eyebrow">' + escapeHtml(item.type) + "</span><h2><a href=\"" +
    escapeHtml(item.href) + "\">" + escapeHtml(item.title) + "</a></h2><p>" +
    escapeHtml(item.description) + "</p></article>").join("");
  const body = '<section class="page-intro container search-page" data-search-page><p class="eyebrow">Поиск по сайту</p>' +
    "<h1>Найти материал</h1><form class=\"search-page-form\" action=\"/search/\" method=\"get\" role=\"search\">" +
    '<label class="visually-hidden" for="search-query">Введите тему</label>' +
    '<input id="search-query" name="q" type="search" placeholder="Например, штукатурка" autocomplete="off">' +
    '<button class="button button-dark" type="submit">Искать</button></form><p class="search-status" aria-live=\"polite\"></p>' +
    '<div class="search-results">' + results + "</div></section>";
  return layout({
    title: "Поиск материалов",
    description: "Поиск по инструкциям и разделам Nodehome.",
    route: "/search/",
    body,
    robots: "noindex,follow"
  });
}

async function main() {
  await rm(OUTPUT, { recursive: true, force: true });
  await mkdir(OUTPUT, { recursive: true });
  await cp(path.join(ROOT, "assets"), path.join(OUTPUT, "assets"), { recursive: true });
  await cp(path.join(ROOT, "assets", "favicon.ico"), path.join(OUTPUT, "favicon.ico"));

  const routes = ["/", "/catalog/", "/calculators/", "/search/"];
  const sitemapRoutes = ["/", "/catalog/", "/calculators/"];
  await writeRoute("/", homePage());
  await writeRoute("/catalog/", catalogPage());
  await writeRoute("/calculators/", calculatorsPage());
  await writeRoute("/search/", searchPage());

  for (const section of sections) {
    routes.push(section.route);
    if (sectionHasArticles(section)) sitemapRoutes.push(section.route);
    await writeRoute(section.route, sectionPage(section));
    const sectionPageCount = Math.ceil(articlesForSection(section).length / PAGE_SIZE);
    for (let page = 2; page <= sectionPageCount; page++) {
      const pageRoute = section.route + "page/" + page + "/";
      routes.push(pageRoute);
      sitemapRoutes.push(pageRoute);
      await writeRoute(pageRoute, sectionPage(section, page, pageRoute));
    }
    const legacyRoute = "/catalog/" + section.id + "/";
    routes.push(legacyRoute);
    await writeRoute(legacyRoute, redirectPage(legacyRoute, section.route, section.title));
  }

  for (const group of Object.values(groupById)) {
    const route = groupRoute(group);
    routes.push(route);
    if (articlesForGroup(group).length) sitemapRoutes.push(route);
    await writeRoute(route, groupPage(group));
    const groupPageCount = Math.ceil(articlesForGroup(group).length / PAGE_SIZE);
    for (let page = 2; page <= groupPageCount; page++) {
      const pageRoute = route + "page/" + page + "/";
      routes.push(pageRoute);
      sitemapRoutes.push(pageRoute);
      await writeRoute(pageRoute, groupPage(group, page, pageRoute));
    }
    if (articlesForGroup(group).length) {
      const legacyRoute = legacyGroupRoute(group);
      routes.push(legacyRoute);
      await writeRoute(legacyRoute, redirectPage(legacyRoute, route, group.title));
    }
  }

  for (const { group, topic } of topicRecords) {
    const route = topicRoute(group, topic);
    const hasArticles = articlesForGroup(group).some((article) => article.topicId === topic.id);
    routes.push(route);
    if (hasArticles) sitemapRoutes.push(route);
    await writeRoute(route, topicPage(group, topic));
    const topicArticleCount = articlesForGroup(group).filter((article) => article.topicId === topic.id).length;
    const topicPageCount = Math.ceil(topicArticleCount / PAGE_SIZE);
    for (let page = 2; page <= topicPageCount; page++) {
      const pageRoute = route + "page/" + page + "/";
      routes.push(pageRoute);
      sitemapRoutes.push(pageRoute);
      await writeRoute(pageRoute, topicPage(group, topic, page, pageRoute));
    }
  }

  for (const category of categories) {
    const route = "/catalog/" + category.id + "/";
    routes.push(route);
    const canonicalTopic = canonicalTopicByCategoryId[category.id];
    if (canonicalTopic) {
      await writeRoute(route, redirectPage(route, canonicalTopic, category.title));
      continue;
    }
    const categoryArticles = category.articles.map((id) => articleById[id]).filter(Boolean);
    if (categoryArticles.length) sitemapRoutes.push(route);
    await writeRoute(route, categoryPage(category));
    const categoryPageCount = Math.ceil(categoryArticles.length / PAGE_SIZE);
    for (let page = 2; page <= categoryPageCount; page++) {
      const pageRoute = route + "page/" + page + "/";
      routes.push(pageRoute);
      sitemapRoutes.push(pageRoute);
      await writeRoute(pageRoute, categoryPage(category, page, pageRoute));
    }
  }

  for (const article of articles) {
    const route = "/article/" + article.slug + "/";
    routes.push(route);
    sitemapRoutes.push(route);
    await writeRoute(route, articlePage(article));
  }

  for (const [id, data] of Object.entries(calculatorData)) {
    const route = "/calculators/" + id + "/";
    routes.push(route);
    sitemapRoutes.push(route);
    await writeRoute(route, calculatorPage(id, data));
  }

  if (new Set(routes).size !== routes.length) throw new Error("Generated page routes must be unique.");

  await writeFile(path.join(OUTPUT, "404.html"), layout({
    title: "Страница не найдена",
    description: "Запрошенная страница не найдена.",
    route: "/404.html",
    robots: "noindex,follow",
    body: '<section class="page-intro container error-page"><p class="eyebrow">Ошибка 404</p><h1>Такой страницы нет</h1>' +
      '<p class="page-lead">Проверьте адрес или вернитесь к материалам Nodehome.</p>' +
      '<a class="button button-dark" href="/">На главную</a> <a class="button button-light" href="/catalog/">Открыть каталог</a></section>'
  }), "utf8");

  const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    sitemapRoutes.map((route) =>
      "  <url><loc>" + BASE_URL + route + "</loc></url>").join("\n") +
    "\n</urlset>\n";
  await writeFile(path.join(OUTPUT, "sitemap.xml"), sitemap, "utf8");
  await writeFile(path.join(OUTPUT, "robots.txt"),
    "User-agent: *\nAllow: /\nDisallow: /search/\n\nSitemap: " + BASE_URL + "/sitemap.xml\n",
    "utf8");

  console.log("Built " + routes.length + " static routes in site/");
}

await main();
