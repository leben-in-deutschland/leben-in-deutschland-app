#!/usr/bin/env node
/**
 * split-questions.js
 *
 * Splits the monolithic question.json (4.4MB) into:
 *   - data/questions-core.json           (~165KB) — statically imported at build time
 *   - public/data/context/de.json        (~280KB) — lazy-loaded after answer
 *   - public/data/context/{lang}.json    (~280KB each) — lazy-loaded after answer
 *   - public/data/translations/{lang}.json (~340KB each) — lazy-loaded on demand
 *
 * Run: node scripts/split-questions.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "data", "question.json");
const CORE_OUT = path.join(ROOT, "data", "questions-core.json");
const CONTEXT_DIR = path.join(ROOT, "public", "data", "context");
const TRANSLATION_DIR = path.join(ROOT, "public", "data", "translations");

const TRANSLATION_LANGS = ["en", "tr", "ru", "fr", "ar", "uk", "hi"];

// Read source
const questions = JSON.parse(fs.readFileSync(SOURCE, "utf8"));

// ---------- 1. Core questions (statically imported) ----------
const core = questions.map((q) => ({
  num: q.num,
  question: q.question,
  a: q.a,
  b: q.b,
  c: q.c,
  d: q.d,
  solution: q.solution,
  image: q.image,
  category: q.category,
  id: q.id,
}));

fs.writeFileSync(CORE_OUT, JSON.stringify(core), "utf8");
console.log(`  questions-core.json: ${(fs.statSync(CORE_OUT).size / 1024).toFixed(1)} KB`);

// ---------- 2. German context ----------
fs.mkdirSync(CONTEXT_DIR, { recursive: true });

const deContext = {};
for (const q of questions) {
  if (q.context) {
    deContext[q.num] = q.context;
  }
}
const deContextPath = path.join(CONTEXT_DIR, "de.json");
fs.writeFileSync(deContextPath, JSON.stringify(deContext), "utf8");
console.log(`  context/de.json: ${(fs.statSync(deContextPath).size / 1024).toFixed(1)} KB`);

// ---------- 3. Translation contexts ----------
for (const lang of TRANSLATION_LANGS) {
  const langContext = {};
  for (const q of questions) {
    if (q.translation && q.translation[lang] && q.translation[lang].context) {
      langContext[q.num] = q.translation[lang].context;
    }
  }
  const langContextPath = path.join(CONTEXT_DIR, `${lang}.json`);
  fs.writeFileSync(langContextPath, JSON.stringify(langContext), "utf8");
  console.log(`  context/${lang}.json: ${(fs.statSync(langContextPath).size / 1024).toFixed(1)} KB`);
}

// ---------- 4. Full translations (question + a-d, keyed by num) ----------
fs.mkdirSync(TRANSLATION_DIR, { recursive: true });

for (const lang of TRANSLATION_LANGS) {
  const langTranslation = {};
  for (const q of questions) {
    if (q.translation && q.translation[lang]) {
      const t = q.translation[lang];
      langTranslation[q.num] = {
        question: t.question,
        a: t.a,
        b: t.b,
        c: t.c,
        d: t.d,
      };
    }
  }
  const langTransPath = path.join(TRANSLATION_DIR, `${lang}.json`);
  fs.writeFileSync(langTransPath, JSON.stringify(langTranslation), "utf8");
  console.log(`  translations/${lang}.json: ${(fs.statSync(langTransPath).size / 1024).toFixed(1)} KB`);
}

console.log("\nDone! Split complete.");
