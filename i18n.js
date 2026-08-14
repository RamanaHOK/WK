/* ============================================
   PREVAILER MATATU JOURNEY — i18n.js
   Generic, data-driven translation engine.

   - Content lives in i18n/<lang>.json, never in HTML or JS.
   - Any element with class "text-panel" and an id is auto-wired to
     panels[id] in the active language's JSON.
   - Any element with a data-i18n="path.to.key" attribute is wired to
     that key (uses textContent, or innerHTML if data-i18n-html is present).
   - Missing/blank keys in a non-English language fall back to English
     automatically, so partial translations never show empty text.
   - Adding a language: add "<code>": "LABEL" to I18N_LABELS below and
     drop a matching i18n/<code>.json file next to en.json.
   ============================================ */

const I18N_LABELS  = { en: 'ENGLISH', sw: 'KISWAHILI', ti: 'ትግርኛ' };
const I18N_DEFAULT = 'en';
const I18N_STORAGE_KEY = 'prevailerLang';

let i18nCurrent = I18N_DEFAULT;
const i18nCache = {};

async function i18nLoad(lang) {
  if (i18nCache[lang]) return i18nCache[lang];
  const res  = await fetch(`i18n/${lang}.json`);
  const data = await res.json();
  i18nCache[lang] = data;
  return data;
}

function i18nGet(lang, path) {
  let cur = i18nCache[lang];
  for (const key of path.split('.')) {
    if (cur == null) return undefined;
    cur = cur[key];
  }
  return cur;
}

// String lookup (panels/ui): blank or missing → fall back to English.
function t(path) {
  const val = i18nGet(i18nCurrent, path);
  if (val !== undefined && val !== null && val !== '') return val;
  return i18nGet(I18N_DEFAULT, path);
}

// Character-bubble lookup: merges per-field, so a partial translation
// (e.g. only "dialogue" filled in) still falls back field-by-field.
function tChar(key) {
  const en  = i18nGet(I18N_DEFAULT, `chars.${key}`) || {};
  const cur = i18nGet(i18nCurrent, `chars.${key}`) || {};
  const merged = Object.assign({}, en);
  Object.keys(cur).forEach(k => { if (cur[k]) merged[k] = cur[k]; });
  return merged;
}

function i18nRenderDOM() {
  document.querySelectorAll('.text-panel[id]').forEach(el => {
    const html = t(`panels.${el.id}`);
    if (html != null) el.innerHTML = html;
  });

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const val = t(el.dataset.i18n);
    if (val == null) return;
    if (el.dataset.i18nHtml !== undefined) el.innerHTML = val;
    else el.textContent = val;
  });

  document.documentElement.lang = i18nCurrent;
  document.dispatchEvent(new CustomEvent('i18n:rendered'));
}

async function setLanguage(lang) {
  if (!I18N_LABELS[lang]) lang = I18N_DEFAULT;
  await i18nLoad(I18N_DEFAULT);
  if (lang !== I18N_DEFAULT) await i18nLoad(lang);
  i18nCurrent = lang;
  window.i18nCurrentLang = lang; // exposed so non-module scripts (scroll.js) can read the active language
  localStorage.setItem(I18N_STORAGE_KEY, lang);
  i18nRenderDOM();
}

async function i18nInit() {
  const saved = localStorage.getItem(I18N_STORAGE_KEY) || I18N_DEFAULT;
  await setLanguage(saved);
}

i18nInit();
