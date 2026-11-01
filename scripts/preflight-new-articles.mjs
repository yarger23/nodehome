#!/usr/bin/env node
/**
 * Nodehome editorial preflight.
 * Checks ONLY new/changed independent articles, never rewrites archived content.
 * Usage: node scripts/preflight-new-articles.mjs [--verify-built]
 * Set NODEHOME_BASE_SHA to github.event.before; otherwise compare HEAD^ and HEAD.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VERIFY_BUILT = process.argv.includes("--verify-built");
const errors = [];
const warn = (...msg) => console.warn("[preflight]", ...msg);
const fail = (label, issue) => errors.push(label + ": " + issue);
const load = (name) => JSON.parse(readFileSync(path.join(ROOT, name), "utf8"));
const exists = (name) => existsSync(path.join(ROOT, name));
const asText = (v) => typeof v === "string" ? v.trim() : "";
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const normalize = (s) => String(s || "").toLocaleLowerCase("ru-RU").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function changedFiles() {
  const before = (process.env.NODEHOME_BASE_SHA || "").trim();
  const validBefore = /^[0-9a-f]{40}$/.test(before) && !/^0+$/.test(before);
  try {
    if (validBefore) {
      return execFileSync("git", ["diff", "--name-only", "--diff-filter=ACMR", before, "HEAD", "--", "content/articles/"], { cwd: ROOT, encoding: "utf8" }).trim().split("\n").filter(Boolean);
    }
    return execFileSync("git", ["diff-tree", "--no-commit-id", "--name-only", "--diff-filter=ACMR", "-r", "HEAD", "--", "content/articles/"], { cwd: ROOT, encoding: "utf8" }).trim().split("\n").filter(Boolean);
  } catch (error) {
    throw new Error("Unable to discover changed articles; refusing to silently skip validation. " + error.message);
  }
}

const articleFlag = process.argv.indexOf("--article");
const selectedFiles = articleFlag >= 0 ? [process.argv[articleFlag + 1]] : changedFiles();
const changed = [...new Set(selectedFiles)].filter((p) => /^content\/articles\/[a-z0-9-]+\.json$/.test(p) && exists(p));
console.log("[preflight] Changed independent articles:", changed.length);
if (changed.length === 0) {
  console.log("[preflight] No changed articles; full site validation remains in build.mjs.");
  process.exit(0);
}

const categories = load("content/categories.json");
const sections = load("content/sections.json");
const legacy = load("content/articles.json");
const categoryById = new Map(categories.map((c) => [c.id, c]));
const groups = new Map(sections.flatMap((s) => (s.groups || []).map((g) => [g.id, g])));
const extraFiles = readdirSync(path.join(ROOT, "content/articles")).filter((p) => p.endsWith(".json"));
const all = [...legacy, ...extraFiles.map((f) => load("content/articles/" + f))];
const published = all.filter((a) => a.status === "published");
const ids = new Map(), slugs = new Map(), titles = new Map(), images = new Map();
const photoHashes = new Map();
for (const a of published) {
  for (const [map, val] of [[ids, a.id], [slugs, a.slug], [titles, normalize(a.title)], [images, a.image]]) {
    if (!val) continue;
    map.set(val, [...(map.get(val) || []), a.id]);
  }
}
// Compare decoded source-photo bytes, not just filenames: reused images are disallowed.
for (const article of published) {
  if (!article.image) continue;
  const photoPath = path.join(ROOT, "assets/images", article.image);
  if (!existsSync(photoPath)) continue; // build.mjs handles historic missing assets.
  const hash = createHash("sha256").update(readFileSync(photoPath)).digest("hex");
  photoHashes.set(hash, [...(photoHashes.get(hash) || []), article.id]);
}
function one(label, key, map) {
  const matches = map.get(key) || [];
  if (matches.length !== 1) fail(label, "Duplicate or missing " + key + " (" + matches.length + " published occurrences)");
}
function imageLooksValid(bytes, extension) {
  if (bytes.length < 10000) return false;
  if (extension === "webp") return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (extension === "avif") return bytes.toString("ascii", 4, 8) === "ftyp" && /avif|avis/.test(bytes.toString("ascii", 8, 20));
  return false;
}
function checkArticle(file) {
  const a = load(file);
  const label = file;
  if (a.status !== "published") {
    warn(label, "status is not published, not counted as a publication");
    return;
  }
  const expectedSlug = path.basename(file, ".json");
  if (!slugPattern.test(a.slug) || a.slug !== expectedSlug) fail(label, "slug must exactly match its filename and be URL-safe");
  if (!asText(a.id)) fail(label, "Missing stable id");
  one(label, a.id, ids);
  one(label, a.slug, slugs);
  one(label, normalize(a.title), titles);
  if (!asText(a.title) || asText(a.title).length < 25) fail(label, "Title missing or too short");
  if (!asText(a.seoTitle) || asText(a.seoTitle).length < 20) fail(label, "seoTitle missing or too short");
  if (!asText(a.description) || asText(a.description).length < 70 || asText(a.description).length > 320) fail(label, "Description must be substantive (70-320 chars)");
  if (!asText(a.intro) || asText(a.intro).length < 120) fail(label, "Intro too short");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asText(a.publishedAt)) || !Number.isFinite(Date.parse(a.publishedAt))) fail(label, "Invalid publication date");
  if (!Array.isArray(a.categoryIds) || a.categoryIds.length !== 1) fail(label, "Exactly one primary categoryId required");
  const category = categoryById.get(a.categoryIds?.[0]);
  if (!category) fail(label, "Primary category not found in content/categories.json");
  if (category) {
    if (!Array.isArray(category.articles) || category.articles.filter((id) => id === a.id).length !== 1) fail(label, "Article must be registered exactly once in category.articles BEFORE the commit");
    const group = groups.get(category.groupId);
    if (!group) fail(label, "Category groupId does not exist");
    if (!asText(a.topicId) || !group?.topics?.some((t) => t.id === a.topicId)) fail(label, "topicId not found in category group topics");
  }
  if (!Array.isArray(a.sections) || a.sections.length < 6) fail(label, "Need at least 6 substantive H2 sections");
  else {
    const secIds = new Set();
    for (const [i, s] of a.sections.entries()) {
      if (!slugPattern.test(s.id || "") || secIds.has(s.id)) fail(label, "Invalid/duplicate section id at " + i);
      secIds.add(s.id);
      if (!asText(s.title) || !Array.isArray(s.paragraphs) || s.paragraphs.length < 2 ||
          s.paragraphs.join(" ").length < 180) fail(label, "Section " + i + " is too short or missing H2/paragraphs");
    }
  }
  if (!Array.isArray(a.faqs) || a.faqs.length < 4 ||
      a.faqs.some((f) => !asText(f.question || f.q) || asText(f.answer || f.a).length < 35)) fail(label, "At least 4 meaningful FAQs required");
  if (!asText(a.image) || !new RegExp("^" + a.slug + "-hero\\.(webp|avif)$").test(a.image)) fail(label, "Unique original photo must use slug-hero.webp/avif");
  else {
    one(label, a.image, images);
    const imagePath = "assets/images/" + a.image;
    if (!exists(imagePath)) fail(label, "Missing source photo: " + imagePath);
    else {
      const bytes = readFileSync(path.join(ROOT, imagePath));
      const ext = a.image.split(".").at(-1);
      if (!imageLooksValid(bytes, ext)) fail(label, "Image file is too small or has invalid WebP/AVIF header");
      const sha = createHash("sha256").update(bytes).digest("hex");
      if ((photoHashes.get(sha) || []).length !== 1) fail(label, "Source photograph bytes reused in other published article(s)");
    }
  }
  if (!asText(a.imageAlt) || a.imageAlt.length < 15) fail(label, "Image alt missing/too short");
  const references = JSON.stringify(a).matchAll(/\/article\/([a-z0-9-]+)\//g);
  for (const m of references) if (!slugs.has(m[1])) fail(label, "Internal article link has no published target: " + m[1]);

  if (VERIFY_BUILT) {
    const htmlPath = "site/article/" + a.slug + "/index.html";
    const builtImage = "site/assets/images/" + a.image;
    if (!exists(htmlPath)) fail(label, "Generated HTML missing: " + htmlPath);
    else {
      const html = readFileSync(path.join(ROOT, htmlPath), "utf8");
      if (!html.includes('https://nodehome.ru/article/' + a.slug + '/')) fail(label, "Incorrect or missing canonical in built HTML");
      if (!html.includes('/assets/images/' + a.image)) fail(label, "Photo not referenced in built HTML");
    }
    if (!exists(builtImage)) fail(label, "Generated photo missing: " + builtImage);
    else if (readFileSync(path.join(ROOT, builtImage)).compare(readFileSync(path.join(ROOT, "assets/images", a.image))) !== 0) fail(label, "Generated photo differs from approved source bytes");
  }
}
for (const file of changed) {
  try { checkArticle(file); }
  catch (error) { fail(file, "Could not validate JSON: " + error.message); }
}
if (errors.length) {
  for (const error of errors) console.error("[preflight] ERROR:", error);
  console.error("[preflight] FAILED:", errors.length, "problem(s); do not publish.");
  process.exit(1);
}
console.log("[preflight] PASS:", changed.length, "changed JSON file(s)", VERIFY_BUILT ? "and generated outputs" : "before build");
