#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ARTICLES_DIR = 'content/articles';
const errors = [];
const forbidden = [
  'Хорошее решение начинается с условий конкретного помещения или участка, а не с универсального рецепта.',
  'Сравнивайте варианты по функции, проверяйте рекомендации для выбранных материалов и растений и оставляйте запас на реальные условия эксплуатации.'
];
const normalize = (s) => String(s || '').toLocaleLowerCase('ru-RU').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const texts = new Map();

for (const name of readdirSync(ARTICLES_DIR).filter((n) => n.endsWith('.json'))) {
  const file = path.join(ARTICLES_DIR, name);
  const a = JSON.parse(readFileSync(file, 'utf8'));
  if (a.status !== 'published' || String(a.publishedAt || '') < '2026-11-03') continue;
  const label = a.slug || name;

  if (String(a.imageAlt || '').startsWith('Реалистичное тематическое фото:')) {
    errors.push(`${label}: template imageAlt`);
  }
  const desc = String(a.description || '').trim();
  if (/\s[\p{L}]$/u.test(desc)) errors.push(`${label}: description appears truncated: ${desc.slice(-24)}`);

  const candidates = [];
  for (const s of a.sections || []) for (const p of s.paragraphs || []) candidates.push(p);
  for (const f of a.faqs || []) candidates.push(f.answer || f.a || '');

  for (const text of candidates) {
    if (forbidden.includes(text)) errors.push(`${label}: forbidden editorial placeholder`);
    const key = normalize(text);
    if (key.length < 220) continue;
    const arr = texts.get(key) || [];
    arr.push({ label, text });
    texts.set(key, arr);
  }
}

for (const arr of texts.values()) {
  const labels = [...new Set(arr.map((x) => x.label))];
  if (labels.length > 1) {
    errors.push(`duplicate long paragraph in ${labels.join(', ')}: ${arr[0].text.slice(0, 120)}…`);
  }
}

if (errors.length) {
  for (const e of errors) console.error('[editorial-quality] ERROR:', e);
  console.error('[editorial-quality] FAILED:', errors.length, 'problem(s)');
  process.exit(1);
}
console.log('[editorial-quality] PASS: no template alts, truncated descriptions, forbidden placeholders or duplicate long paragraphs in current publications');
