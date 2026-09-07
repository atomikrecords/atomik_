/* =========================================================================
   SafeBite — personal food safety scanner
   - Profile persisted in localStorage
   - Product data from the Open Food Facts public API (real, free, no key)
   - Barcode scanning via device camera (html5-qrcode)
   - Hand-built vector icon set (no emoji, no external icon requests)
   ========================================================================= */

const OFF_PRODUCT_URL = code => `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=code,product_name,brands,image_front_small_url,image_front_url,ingredients_text,ingredients_text_en,lang,allergens_tags,traces_tags,labels_tags,categories_tags,categories,nutriments,quantity`;
const OFF_SEARCH_URL = q => `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&fields=code,product_name,brands,image_front_small_url,quantity`;
const OFF_CATEGORY_URL = tag => `https://world.openfoodfacts.org/api/v2/search?categories_tags=${encodeURIComponent(tag)}&page_size=40&fields=code,product_name,brands,image_front_small_url,ingredients_text,ingredients_text_en,lang,allergens_tags,traces_tags,labels_tags,categories_tags,categories,nutriments`;

const STORAGE_KEY = 'safebite_profile_v1';
const RECENTS_KEY = 'safebite_recents_v1';

/* ---------------------------------------------------------------------
   Vector icon set — hand-built, stroke-based line icons (24x24, MIT-style
   free use, no external requests, no emoji). Each entry is inner-SVG markup.
   --------------------------------------------------------------------- */
const ICONS = {
  shield: '<path d="M12 2.5 19.5 5.5V11c0 5.2-3.4 9.5-7.5 11-4.1-1.5-7.5-5.8-7.5-11V5.5Z"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5c0-3.9 3.4-6 7.5-6s7.5 2.1 7.5 6"/>',
  camera: '<path d="M4 8.5h3.2l1.6-2h6.4l1.6 2H20v10.5H4Z"/><circle cx="12" cy="13.2" r="3.4"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="M19.5 19.5 15.3 15.3"/>',
  home: '<path d="M4 11 12 4l8 7"/><path d="M6 9.8V20h12V9.8"/><path d="M10 20v-5h4v5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="M5 13l4.5 4.5L19 8"/>',
  chevronLeft: '<path d="M15 4.5 8 12l7 7.5"/>',
  chevronRight: '<path d="M9 4.5 16 12l-7 7.5"/>',
  alertTriangle: '<path d="M12 3 22 20.5H2Z"/><path d="M12 9.5v5"/><circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M7.8 12.3l2.8 2.8L16.4 9"/>',
  xCircle: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11.2v5.3"/><circle cx="12" cy="7.6" r=".9" fill="currentColor" stroke="none"/>',
  sparkles: '<path d="M11.5 3c.9 3.4 2.1 4.6 5.5 5.5-3.4.9-4.6 2.1-5.5 5.5-.9-3.4-2.1-4.6-5.5-5.5C9.4 7.6 10.6 6.4 11.5 3Z"/><path d="M18.3 14c.5 1.8 1.1 2.4 2.9 2.9-1.8.5-2.4 1.1-2.9 2.9-.5-1.8-1.1-2.4-2.9-2.9 1.8-.5 2.4-1.1 2.9-2.9Z"/>',
  milk: '<path d="M9.3 2h5.4v3l1.9 2.8V21a1 1 0 0 1-1 1H8.4a1 1 0 0 1-1-1V7.8L9.3 5Z"/><path d="M7.4 12h9.2"/>',
  egg: '<path d="M12 22c4.4 0 7.2-4 7.2-8.4C19.2 8.6 16 2 12 2S4.8 8.6 4.8 13.6C4.8 18 7.6 22 12 22Z"/>',
  fish: '<path d="M2.5 12.5c3.3-4.2 8.6-6.2 13.7-4.2 2.1.8 4 2.2 5.3 4.2-1.3 2-3.2 3.4-5.3 4.2-5.1 2-10.4 0-13.7-4.2Z"/><circle cx="16" cy="11" r=".7" fill="currentColor" stroke="none"/><path d="M2.5 12.5.8 9.6m1.7 2.9-1.7 3"/>',
  shrimp: '<path d="M5 15c-1-5.5 2.2-11 8-11 2.6 0 4.5 1.7 4.5 4 0 3.4-3 4.3-3.6 7.4-.4 2.2.6 3.6 1.6 4.1" /><circle cx="13.2" cy="6" r="1"/><path d="M4.5 16.5 3 18"/>',
  nut: '<path d="M12 2.3c4.3 2 6.6 6 6.6 10 0 5.3-3.2 9.7-6.6 9.7S5.4 17.6 5.4 12.3c0-4 2.3-8 6.6-10Z"/><path d="M12 6.5v11"/>',
  wheat: '<path d="M12 2v20"/><path d="M12 5.5 9.3 7.3l2.7 1.8 2.7-1.8L12 5.5Z"/><path d="M12 10.5 9.3 12.3l2.7 1.8 2.7-1.8-2.7-1.8Z"/><path d="M12 15.5 9.3 17.3l2.7 1.8 2.7-1.8-2.7-1.8Z"/>',
  bean: '<path d="M6.2 16.4C2.9 12.3 4 5.9 9 3.8c4.3-1.7 8.6 1 8.6 5.4 0 5.4-4.3 6.4-6.4 9.6-1.6 2.4-3.7 1.1-5-2.4Z"/>',
  circleDot: '<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/>',
  bottle: '<path d="M10.2 2h3.6v2.7l2 2.3V21a1 1 0 0 1-1 1H9.2a1 1 0 0 1-1-1V7l2-2.3Z"/><path d="M8.7 11h6.6"/>',
  leaf: '<path d="M20 4C10 4 4 10 4 18c8 0 14-6 14-14Z"/><path d="M6.5 17.5 18 6"/>',
  wine: '<path d="M7.2 3h9.6l-1 6.2a4.3 4.3 0 0 1-7.6 0Z"/><path d="M12 13.3V20M8 21.6h8"/>',
  sprout: '<path d="M12 22v-9.4"/><path d="M12 12.6C6.8 12.6 3.6 9.4 3.6 4c5.4 0 8.6 3.2 8.6 8.6Z"/><path d="M12 10.2c0-4.3 3-6.7 8.4-6.7 0 4.3-2 7.5-8.4 6.7Z"/>',
  crescent: '<path d="M15.5 3.2A9 9 0 1 0 20.8 15a7 7 0 0 1-5.3-11.8Z"/>',
  award: '<circle cx="12" cy="8.3" r="5"/><path d="M9 12.6 7.2 21.5 12 18.7l4.8 2.8L15 12.6"/>',
  flame: '<path d="M12 2.3c1.3 4-2.9 5.4-2.9 9.3a4.9 4.9 0 0 0 9.8 0c0-2-1-3.2-2-4 0 2-1 2.2-1 2.2.6-3.4-1.2-5.4-3.9-7.5Z"/>',
  droplet: '<path d="M12 2.3c4 6 7 9.7 7 13.2a7 7 0 0 1-14 0c0-3.5 3-7.2 7-13.2Z"/>',
  candy: '<path d="M8.3 8.3 10.6 6l7.4 7.4-2.3 2.3Z"/><path d="M16 16 18.3 13.7M6 6 8.3 3.7M3.7 11.9 6 9.6M11.9 20.3l2.3-2.3"/>',
  percent: '<path d="M5 19 19 5"/><circle cx="7.2" cy="7.2" r="2.2"/><circle cx="16.8" cy="16.8" r="2.2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.2h5V7"/><path d="M6.5 7 7.5 20h9l1-13"/>',
  barcode: '<path d="M3.5 5v14M7 5v14M9.7 5v14M13 5v14M15.7 5v14M18 5v14M20.5 5v14"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="M5.8 5.8 18.2 18.2"/>',
  arrowRight: '<path d="M4.5 12h15M13.5 6l6 6-6 6"/>',
  package: '<path d="M21 8 12 3.3 3 8l9 4.7 9-4.7Z"/><path d="M3 8v8.3l9 4.7 9-4.7V8"/><path d="M12 12.7V21"/>',
  history: '<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v4.5h4.5"/><path d="M12 8v4.5l3.2 2"/>',
  spinner: '<circle cx="12" cy="12" r="9" opacity="0.2"/><path d="M21 12a9 9 0 0 0-9-9"/>',
};
function iconSvg(name, cls) {
  const inner = ICONS[name] || ICONS.info;
  return `<svg class="icon${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}
function mountIcons(root) {
  (root || document).querySelectorAll('[data-icon]').forEach(el => {
    el.innerHTML = iconSvg(el.dataset.icon);
    el.classList.add('icon-slot');
  });
}

/* Icons representing each allergen / diet, used across chips, reasons, tags */
const ALLERGEN_ICON = { milk: 'milk', eggs: 'egg', fish: 'fish', shellfish: 'shrimp', molluscs: 'shrimp', 'tree-nuts': 'nut', peanuts: 'nut', wheat: 'wheat', soy: 'bean', sesame: 'circleDot', mustard: 'bottle', celery: 'leaf', sulphites: 'wine', lupin: 'sprout' };
const DIET_ICON = { 'gluten-free': 'wheat', vegan: 'sprout', vegetarian: 'leaf', 'dairy-free': 'milk', halal: 'crescent', kosher: 'award', keto: 'flame', 'low-sodium': 'droplet', paleo: 'package', 'nut-free': 'nut' };

/* ---------------------------------------------------------------------
   Reference data: allergens & diets, with keyword fallbacks used when
   Open Food Facts hasn't tagged a product but the ingredient text
   mentions the substance in plain language.
   --------------------------------------------------------------------- */
const ALLERGENS = [
  { id: 'milk', label: 'Dairy / Milk', offTag: 'en:milk', keywords: ['milk', 'cream', 'butter', 'cheese', 'whey', 'casein', 'lactose', 'yogurt', 'ghee'] },
  { id: 'eggs', label: 'Eggs', offTag: 'en:eggs', keywords: ['egg', 'albumin', 'ovalbumin', 'mayonnaise'] },
  { id: 'fish', label: 'Fish', offTag: 'en:fish', keywords: ['fish', 'anchovy', 'cod', 'salmon', 'tuna', 'gelatin (fish)'] },
  { id: 'shellfish', label: 'Shellfish', offTag: 'en:crustaceans', keywords: ['shrimp', 'prawn', 'crab', 'lobster', 'crustacean', 'shellfish'] },
  { id: 'molluscs', label: 'Molluscs', offTag: 'en:molluscs', keywords: ['mussel', 'oyster', 'squid', 'clam', 'snail', 'mollusc'] },
  { id: 'tree-nuts', label: 'Tree Nuts', offTag: 'en:nuts', keywords: ['almond', 'hazelnut', 'walnut', 'cashew', 'pistachio', 'pecan', 'macadamia', 'brazil nut'] },
  { id: 'peanuts', label: 'Peanuts', offTag: 'en:peanuts', keywords: ['peanut', 'groundnut', 'arachis'] },
  { id: 'wheat', label: 'Wheat', offTag: 'en:gluten', keywords: ['wheat', 'flour', 'semolina', 'spelt', 'durum'] },
  { id: 'soy', label: 'Soy', offTag: 'en:soybeans', keywords: ['soy', 'soya', 'edamame', 'tofu'] },
  { id: 'sesame', label: 'Sesame', offTag: 'en:sesame-seeds', keywords: ['sesame', 'tahini'] },
  { id: 'mustard', label: 'Mustard', offTag: 'en:mustard', keywords: ['mustard'] },
  { id: 'celery', label: 'Celery', offTag: 'en:celery', keywords: ['celery', 'celeriac'] },
  { id: 'sulphites', label: 'Sulphites', offTag: 'en:sulphur-dioxide-and-sulphites', keywords: ['sulphite', 'sulfite', 'so2'] },
  { id: 'lupin', label: 'Lupin', offTag: 'en:lupin', keywords: ['lupin', 'lupine'] },
];

const DIETS = [
  { id: 'gluten-free', label: 'Gluten-Free', type: 'gluten-free' },
  { id: 'vegan', label: 'Vegan', type: 'vegan' },
  { id: 'vegetarian', label: 'Vegetarian', type: 'vegetarian' },
  { id: 'dairy-free', label: 'Dairy-Free', type: 'dairy-free' },
  { id: 'halal', label: 'Halal', type: 'halal' },
  { id: 'kosher', label: 'Kosher', type: 'kosher' },
  { id: 'keto', label: 'Keto / Low-Carb', type: 'keto' },
  { id: 'low-sodium', label: 'Low-Sodium', type: 'low-sodium' },
  { id: 'paleo', label: 'Paleo', type: 'paleo' },
  { id: 'nut-free', label: 'Nut-Free (all)', type: 'nut-free' },
];

const NON_VEGAN_KEYWORDS = ['milk', 'cream', 'butter', 'cheese', 'whey', 'casein', 'egg', 'honey', 'gelatin', 'gelatine', 'meat', 'beef', 'pork', 'chicken', 'fish', 'lard', 'anchovy', 'shellac', 'carmine'];
const NON_VEGETARIAN_KEYWORDS = ['gelatin', 'gelatine', 'meat', 'beef', 'pork', 'chicken', 'lard', 'fish', 'anchovy', 'shrimp', 'squid', 'rennet'];
const GLUTEN_KEYWORDS = ['wheat', 'barley', 'rye', 'malt', 'semolina', 'spelt', 'durum', 'triticale', 'flour'];
const HARAM_KEYWORDS = ['pork', 'lard', 'bacon', 'gelatin', 'gelatine', 'alcohol', 'wine', 'rum', 'ethanol'];

/* ---------------------------------------------------------------------
   Profile storage
   --------------------------------------------------------------------- */
function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProfile();
    return { ...defaultProfile(), ...JSON.parse(raw) };
  } catch (e) { return defaultProfile(); }
}
function defaultProfile() {
  return { allergies: [], diets: [], avoidIngredients: [], avoidFoods: [], limits: { sugar: null, sodium: null, satFat: null } };
}
function saveProfile(p) { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }

function loadRecents() {
  try { return JSON.parse(localStorage.getItem(RECENTS_KEY)) || []; } catch (e) { return []; }
}
function pushRecent(entry) {
  const list = loadRecents();
  const filtered = list.filter(r => r.code !== entry.code);
  filtered.unshift(entry);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(filtered.slice(0, 8)));
}

let profile = loadProfile();

/* ---------------------------------------------------------------------
   Navigation + view transitions
   --------------------------------------------------------------------- */
const views = document.querySelectorAll('.view');
const ANIM_CLASSES = ['anim-slide-in-right', 'anim-slide-in-left', 'anim-modal-in', 'anim-fade'];

function showView(id, transition) {
  const current = document.querySelector('.view.active');
  if (current && current.id === id) return;

  let anim = transition;
  if (!anim) {
    // sensible defaults so callers that don't specify still animate nicely
    if (id === 'view-home') anim = 'anim-slide-in-left';
    else if (id === 'view-result') anim = 'anim-slide-in-right';
    else anim = 'anim-modal-in';
  }

  views.forEach(v => v.classList.toggle('active', v.id === id));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.nav === id));
  moveNavIndicator(id);

  const target = document.getElementById(id);
  ANIM_CLASSES.forEach(c => target.classList.remove(c));
  // force reflow so the animation restarts even if the same class was used last time
  void target.offsetWidth;
  target.classList.add(anim);

  window.scrollTo(0, 0);
  if (id !== 'view-scanner') stopScanner();
}

function moveNavIndicator(id) {
  const map = { 'view-home': 0, 'view-scanner-open': 1, 'view-profile': 2 };
  const indicator = document.getElementById('navIndicator');
  if (!indicator) return;
  const idx = id === 'view-scanner' ? 1 : map[id];
  if (idx === undefined) return;
  indicator.style.transform = `translateX(${idx * 100}%)`;
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.nav === 'view-scanner-open') { openScanner(); moveNavIndicator('view-scanner-open'); }
    else showView(btn.dataset.nav, btn.dataset.nav === 'view-home' ? 'anim-fade' : 'anim-modal-in');
  });
});
document.getElementById('profileBtn').addEventListener('click', () => { renderProfileForm(); showView('view-profile', 'anim-modal-in'); });
document.getElementById('closeProfileBtn').addEventListener('click', () => showView('view-home', 'anim-fade'));
document.getElementById('closeScannerBtn').addEventListener('click', () => showView('view-home', 'anim-fade'));
document.getElementById('backFromResultBtn').addEventListener('click', () => showView('view-home', 'anim-slide-in-left'));
document.getElementById('openScannerBtn').addEventListener('click', () => { openScanner(); moveNavIndicator('view-scanner-open'); });

/* ---------------------------------------------------------------------
   Profile form rendering
   --------------------------------------------------------------------- */
function renderChipGrid(container, items, selectedIds, iconMap, onToggle) {
  container.innerHTML = '';
  items.forEach((item, i) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (selectedIds.includes(item.id) ? ' selected' : '');
    chip.style.animationDelay = (i * 25) + 'ms';
    chip.innerHTML = `${iconSvg(iconMap[item.id] || 'info', 'chip-icon')}<span>${escapeHtml(item.label)}</span>`;
    chip.addEventListener('click', () => {
      const nowSelected = !chip.classList.contains('selected');
      chip.classList.toggle('selected', nowSelected);
      if (nowSelected) bounce(chip);
      onToggle(item.id, nowSelected);
    });
    container.appendChild(chip);
  });
}
function bounce(el) {
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}

function renderTagInput(container, tags, onChange) {
  container.innerHTML = '';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Type and press Enter…';

  function redraw() {
    container.querySelectorAll('.tag-pill').forEach(p => p.remove());
    tags.slice().reverse().forEach((tag, idxRev) => {
      const idx = tags.length - 1 - idxRev;
      const pill = document.createElement('span');
      pill.className = 'tag-pill pop';
      pill.innerHTML = `${iconSvg('ban', 'tag-icon')}<span></span><button type="button" aria-label="Remove">${iconSvg('x')}</button>`;
      pill.querySelector('span').textContent = tag;
      pill.querySelector('button').addEventListener('click', () => {
        tags.splice(idx, 1);
        onChange(tags);
        redraw();
      });
      container.insertBefore(pill, input);
    });
  }
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = input.value.trim();
      if (v && !tags.includes(v.toLowerCase())) {
        tags.push(v.toLowerCase());
        onChange(tags);
        input.value = '';
        redraw();
      }
    }
  });
  container.appendChild(input);
  redraw();
}

let workingProfile;
function renderProfileForm() {
  workingProfile = JSON.parse(JSON.stringify(profile));
  renderChipGrid(document.getElementById('allergyGrid'), ALLERGENS, workingProfile.allergies, ALLERGEN_ICON, (id, on) => {
    workingProfile.allergies = on ? [...new Set([...workingProfile.allergies, id])] : workingProfile.allergies.filter(a => a !== id);
  });
  renderChipGrid(document.getElementById('dietGrid'), DIETS, workingProfile.diets, DIET_ICON, (id, on) => {
    workingProfile.diets = on ? [...new Set([...workingProfile.diets, id])] : workingProfile.diets.filter(d => d !== id);
  });
  renderTagInput(document.getElementById('ingredientTagInput'), workingProfile.avoidIngredients, (t) => { workingProfile.avoidIngredients = t; });
  renderTagInput(document.getElementById('foodTagInput'), workingProfile.avoidFoods, (t) => { workingProfile.avoidFoods = t; });
  document.getElementById('limitSugar').value = workingProfile.limits.sugar ?? '';
  document.getElementById('limitSodium').value = workingProfile.limits.sodium ?? '';
  document.getElementById('limitSatFat').value = workingProfile.limits.satFat ?? '';
  document.getElementById('savedToast').classList.add('hidden');
}

function commitProfileForm() {
  workingProfile.limits.sugar = parseFloatOrNull(document.getElementById('limitSugar').value);
  workingProfile.limits.sodium = parseFloatOrNull(document.getElementById('limitSodium').value);
  workingProfile.limits.satFat = parseFloatOrNull(document.getElementById('limitSatFat').value);
  profile = workingProfile;
  saveProfile(profile);
  renderProfileSummary();
}
function parseFloatOrNull(v) { const n = parseFloat(v); return isNaN(n) ? null : n; }

document.getElementById('profileForm').addEventListener('submit', (e) => {
  e.preventDefault();
  commitProfileForm();
  const toast = document.getElementById('savedToast');
  toast.classList.remove('hidden');
  toast.classList.remove('toast-in'); void toast.offsetWidth; toast.classList.add('toast-in');
  setTimeout(() => showView('view-home', 'anim-fade'), 550);
});
document.getElementById('saveProfileTopBtn').addEventListener('click', () => {
  commitProfileForm();
  showView('view-home', 'anim-fade');
});

function renderProfileSummary() {
  const card = document.getElementById('profileSummaryCard');
  const hasAny = profile.allergies.length || profile.diets.length || profile.avoidIngredients.length || profile.avoidFoods.length;
  if (!hasAny) {
    card.innerHTML = `
      <h3>Your Profile</h3>
      <p class="empty-hint">You haven't set up a dietary profile yet. Add allergies, diets, and ingredients to avoid — it takes under a minute.</p>
      <button class="link-btn" id="setupProfileNow">Set up now ${iconSvg('arrowRight')}</button>`;
    card.querySelector('#setupProfileNow').addEventListener('click', () => { renderProfileForm(); showView('view-profile', 'anim-modal-in'); });
    return;
  }
  const chips = [];
  profile.allergies.forEach(id => { const a = ALLERGENS.find(x => x.id === id); if (a) chips.push({ icon: ALLERGEN_ICON[id], label: a.label }); });
  profile.diets.forEach(id => { const d = DIETS.find(x => x.id === id); if (d) chips.push({ icon: DIET_ICON[id], label: d.label }); });
  profile.avoidIngredients.forEach(t => chips.push({ icon: 'ban', label: t }));
  profile.avoidFoods.forEach(t => chips.push({ icon: 'ban', label: t }));
  card.innerHTML = `<h3>Your Profile</h3><div class="chips">${chips.map(c => `<span class="chip-mini">${iconSvg(c.icon, 'chip-mini-icon')}${escapeHtml(c.label)}</span>`).join('')}</div>`;
}

/* ---------------------------------------------------------------------
   Barcode scanner (html5-qrcode)
   --------------------------------------------------------------------- */
let html5QrCode = null;
function openScanner() {
  showView('view-scanner', 'anim-modal-in');
  const statusEl = document.getElementById('scannerStatus');
  statusEl.textContent = 'Starting camera…';
  if (!window.Html5Qrcode) {
    statusEl.textContent = 'Camera library failed to load. Check your connection.';
    return;
  }
  html5QrCode = new Html5Qrcode('qr-reader', { formatsToSupport: [
    Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.UPC_A, Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.CODE_128
  ], verbose: false });

  const config = { fps: 10, qrbox: { width: 260, height: 160 }, aspectRatio: 1.6 };
  html5QrCode.start(
    { facingMode: 'environment' },
    config,
    (decodedText) => {
      statusEl.textContent = 'Found: ' + decodedText;
      handleBarcode(decodedText);
    },
    () => { /* per-frame scan failure, ignore */ }
  ).then(() => {
    statusEl.textContent = 'Point your camera at a barcode';
  }).catch((err) => {
    statusEl.textContent = 'Camera unavailable: ' + (err?.message || err) + '. Try manual entry instead.';
  });
}
function stopScanner() {
  if (html5QrCode) {
    html5QrCode.stop().then(() => html5QrCode.clear()).catch(() => {});
    html5QrCode = null;
  }
}
let scanLock = false;
function handleBarcode(code) {
  if (scanLock) return;
  scanLock = true;
  stopScanner();
  lookupAndShow(code).finally(() => { scanLock = false; });
}

/* Manual barcode entry */
document.getElementById('showManualEntry').addEventListener('click', () => {
  document.getElementById('manualBarcodeForm').classList.toggle('hidden');
});
document.getElementById('manualBarcodeForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = document.getElementById('manualBarcodeInput').value.trim();
  if (v) lookupAndShow(v);
});

/* ---------------------------------------------------------------------
   Search
   --------------------------------------------------------------------- */
document.getElementById('searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = document.getElementById('searchInput').value.trim();
  if (q) runSearch(q);
});

async function runSearch(query) {
  const resultsEl = document.getElementById('homeResults');
  resultsEl.innerHTML = skeletonRows(4);
  try {
    const res = await fetch(OFF_SEARCH_URL(query));
    if (!res.ok) throw new Error('Search request failed (' + res.status + ')');
    const data = await res.json();
    const products = (data.products || []).filter(p => p.product_name);
    if (!products.length) {
      resultsEl.innerHTML = emptyState('search', 'No products found for "' + escapeHtml(query) + '". Try a different name or scan the barcode instead.');
      return;
    }
    resultsEl.innerHTML = '';
    products.forEach((p, i) => resultsEl.appendChild(renderSearchRow(p, i)));
  } catch (err) {
    resultsEl.innerHTML = errorBox('Couldn\'t reach the food database. Check your internet connection and try again.');
  }
}

function renderSearchRow(p, i) {
  const row = document.createElement('div');
  row.className = 'result-row stagger-in';
  row.style.animationDelay = (i * 35) + 'ms';
  const img = p.image_front_small_url
    ? `<img src="${p.image_front_small_url}" alt="">`
    : `<div class="ph">${iconSvg('package')}</div>`;
  row.innerHTML = `${img}<div class="rr-text"><div class="rr-title">${escapeHtml(p.product_name)}</div><div class="rr-sub">${escapeHtml(p.brands || 'Unknown brand')}${p.quantity ? ' · ' + escapeHtml(p.quantity) : ''}</div></div><span class="rr-chevron">${iconSvg('chevronRight')}</span>`;
  row.addEventListener('click', () => lookupAndShow(p.code));
  return row;
}

/* ---------------------------------------------------------------------
   Product lookup + rendering result
   --------------------------------------------------------------------- */
async function lookupAndShow(code) {
  showView('view-result', 'anim-slide-in-right');
  const el = document.getElementById('resultContent');
  el.innerHTML = resultSkeleton();
  try {
    const res = await fetch(OFF_PRODUCT_URL(code));
    if (!res.ok) throw new Error('Lookup failed (' + res.status + ')');
    const data = await res.json();
    if (data.status !== 1 || !data.product) {
      el.innerHTML = `
        <div class="result-banner rb-caution">
          <span class="rb-icon">${iconSvg('info')}</span>
          <h2>Product not found</h2>
          <p>Barcode ${escapeHtml(code)} isn't in the Open Food Facts database yet.</p>
        </div>
        <div class="reason-item sev-caution stagger-in">
          <div class="ri-icon">${iconSvg('alertTriangle')}</div>
          <div><div class="ri-title">We can't verify this product</div>
          <div class="ri-detail">Without ingredient data we cannot confirm it's safe. Check the physical label carefully, or search for it by name.</div></div>
        </div>`;
      return;
    }
    const product = data.product;
    pushRecent({ code, name: product.product_name || code, image: product.image_front_small_url || '' });
    renderResult(product, code);
    renderRecents();
  } catch (err) {
    el.innerHTML = errorBox('Couldn\'t reach the food database. Check your internet connection and try again.');
  }
}

function renderResult(product, code) {
  const verdict = evaluateProduct(product, profile);
  const el = document.getElementById('resultContent');

  const bannerClass = verdict.level === 'safe' ? 'rb-safe' : verdict.level === 'caution' ? 'rb-caution' : 'rb-danger';
  const bannerIcon = verdict.level === 'safe' ? 'checkCircle' : verdict.level === 'caution' ? 'alertTriangle' : 'xCircle';
  const bannerTitle = verdict.level === 'safe' ? 'Safe for your profile' : verdict.level === 'caution' ? 'Check carefully' : 'Not suitable for you';

  const img = product.image_front_url || product.image_front_small_url;
  const productImgHtml = img ? `<img src="${img}" alt="">` : `<div class="ph">${iconSvg('package')}</div>`;

  const reasonsHtml = verdict.reasons.length
    ? verdict.reasons.map((r, i) => `
        <li class="reason-item sev-${r.level} stagger-in" style="animation-delay:${i * 45}ms">
          <div class="ri-icon">${iconSvg(r.level === 'danger' ? 'xCircle' : r.level === 'caution' ? 'alertTriangle' : 'checkCircle')}</div>
          <div><div class="ri-title">${escapeHtml(r.title)}</div><div class="ri-detail">${escapeHtml(r.detail)}</div></div>
        </li>`).join('')
    : `<li class="reason-item sev-safe stagger-in"><div class="ri-icon">${iconSvg('checkCircle')}</div><div><div class="ri-title">No conflicts found</div><div class="ri-detail">Nothing in this product matched your allergies, diets, or avoid-lists.</div></div></li>`;

  const ingredientsText = product.ingredients_text_en || product.ingredients_text;
  const nutriments = product.nutriments || {};

  el.innerHTML = `
    <div class="result-banner ${bannerClass}">
      <span class="rb-icon">${iconSvg(bannerIcon)}</span>
      <h2>${bannerTitle}</h2>
      <p>${escapeHtml(verdict.summary)}</p>
    </div>

    <div class="product-card">
      ${productImgHtml}
      <div>
        <div class="pc-title">${escapeHtml(product.product_name || 'Unknown product')}</div>
        <div class="pc-sub">${escapeHtml(product.brands || 'Unknown brand')}${product.quantity ? ' · ' + escapeHtml(product.quantity) : ''}</div>
        <div class="pc-sub">Barcode: ${escapeHtml(code)}</div>
      </div>
    </div>

    <div class="section-title">Why</div>
    <ul class="reason-list">${reasonsHtml}</ul>

    ${nutriments && Object.keys(nutriments).length ? `
    <div class="section-title">Nutrition (per 100g)</div>
    <div class="nutri-grid">
      ${nutriCell('candy', 'Sugar', nutriments['sugars_100g'], 'g')}
      ${nutriCell('droplet', 'Sodium', nutriments['sodium_100g'] != null ? nutriments['sodium_100g'] * 1000 : null, 'mg')}
      ${nutriCell('percent', 'Sat. Fat', nutriments['saturated-fat_100g'], 'g')}
      ${nutriCell('flame', 'Energy', nutriments['energy-kcal_100g'], 'kcal')}
    </div>` : ''}

    <div class="section-title">Ingredients</div>
    <div class="ingredients-box">${ingredientsText ? escapeHtml(ingredientsText) : 'No ingredient list available for this product.'}</div>

    ${verdict.level !== 'safe' ? `<div id="altSection"></div>` : ''}
  `;

  if (verdict.level !== 'safe') {
    renderAlternatives(product);
  }
}
function nutriCell(icon, label, val, unit) {
  return `<div class="nutri-cell">${iconSvg(icon, 'nutri-icon')}<div><div class="nc-val">${val != null ? Math.round(val * 10) / 10 + unit : '—'}</div><div class="nc-label">${label}</div></div></div>`;
}

/* ---------------------------------------------------------------------
   SAFER ALTERNATIVES — recommends other real products in the same
   category that pass this user's specific profile.
   --------------------------------------------------------------------- */
async function renderAlternatives(product) {
  const section = document.getElementById('altSection');
  if (!section) return;
  section.innerHTML = `
    <div class="section-title alt-title">${iconSvg('sparkles', 'alt-title-icon')}Safer Alternatives For You</div>
    <div class="alt-loading">${skeletonRows(2)}</div>`;

  const alts = await fetchAlternatives(product, profile);
  const loadingEl = section.querySelector('.alt-loading');
  if (!loadingEl) return; // user navigated away

  if (!alts.length) {
    loadingEl.innerHTML = emptyState('sparkles', "We couldn't find a safer alternative in this category yet — try searching manually.");
    return;
  }
  loadingEl.innerHTML = alts.map((p, i) => `
    <div class="result-row alt-row stagger-in" data-code="${escapeHtml(p.code)}" style="animation-delay:${i * 50}ms">
      ${p.image_front_small_url ? `<img src="${p.image_front_small_url}" alt="">` : `<div class="ph">${iconSvg('package')}</div>`}
      <div class="rr-text"><div class="rr-title">${escapeHtml(p.product_name)}</div><div class="rr-sub">${escapeHtml(p.brands || 'Unknown brand')}</div></div>
      <span class="badge badge-safe">${iconSvg('checkCircle')} Safe</span>
    </div>`).join('');
  loadingEl.querySelectorAll('.alt-row').forEach(row => {
    row.addEventListener('click', () => lookupAndShow(row.dataset.code));
  });
}

async function fetchAlternatives(product, profile) {
  const catTags = (product.categories_tags || []).slice();
  if (!catTags.length) return [];
  const tagsToTry = catTags.slice(Math.max(0, catTags.length - 3)).reverse(); // most specific first
  for (const tag of tagsToTry) {
    try {
      const res = await fetch(OFF_CATEGORY_URL(tag));
      if (!res.ok) continue;
      const data = await res.json();
      const candidates = (data.products || []).filter(p => p.code && p.code !== product.code && p.product_name);
      const safe = [];
      for (const c of candidates) {
        if (evaluateProduct(c, profile).level === 'safe') {
          safe.push(c);
          if (safe.length >= 3) break;
        }
      }
      if (safe.length) return safe;
    } catch (e) { /* try the next, broader category tag */ }
  }
  return [];
}

/* ---------------------------------------------------------------------
   THE SAFETY ENGINE
   Returns { level: 'safe'|'caution'|'danger', summary, reasons:[{level,title,detail}] }
   --------------------------------------------------------------------- */
function evaluateProduct(product, profile) {
  const reasons = [];
  const ingredientsText = (product.ingredients_text_en || product.ingredients_text || '').toLowerCase();
  const hasIngredientText = ingredientsText.trim().length > 0;
  const allergenTags = product.allergens_tags || [];
  const traceTags = product.traces_tags || [];
  const labelTags = product.labels_tags || [];
  const categoriesText = (product.categories || '').toLowerCase();
  const productName = (product.product_name || '').toLowerCase();
  const nutriments = product.nutriments || {};

  function textHasAny(text, words) { return words.some(w => text.includes(w)); }

  /* --- Allergies --- */
  profile.allergies.forEach(id => {
    const a = ALLERGENS.find(x => x.id === id);
    if (!a) return;
    if (allergenTags.includes(a.offTag)) {
      reasons.push({ level: 'danger', title: `Contains ${a.label}`, detail: `Labeled by the manufacturer as containing this allergen.` });
      return;
    }
    if (traceTags.includes(a.offTag)) {
      reasons.push({ level: 'caution', title: `May contain traces of ${a.label}`, detail: `The manufacturer warns this product may contain traces due to shared equipment/facilities.` });
      return;
    }
    if (hasIngredientText && textHasAny(ingredientsText, a.keywords)) {
      const hit = a.keywords.find(k => ingredientsText.includes(k));
      reasons.push({ level: 'danger', title: `Contains ${a.label}`, detail: `Ingredient list mentions "${hit}".` });
      return;
    }
    if (!hasIngredientText) {
      reasons.push({ level: 'caution', title: `Can't verify ${a.label}`, detail: `No ingredient list is available to confirm this is free of your allergen.` });
    }
  });

  /* --- Diets --- */
  profile.diets.forEach(id => {
    const d = DIETS.find(x => x.id === id);
    if (!d) return;
    switch (d.type) {
      case 'gluten-free': {
        if (labelTags.includes('en:gluten-free')) {
          reasons.push({ level: 'safe', title: 'Certified gluten-free', detail: 'Labeled gluten-free by the manufacturer.' });
        } else if (allergenTags.includes('en:gluten') || (hasIngredientText && textHasAny(ingredientsText, GLUTEN_KEYWORDS))) {
          const hit = GLUTEN_KEYWORDS.find(k => ingredientsText.includes(k)) || 'gluten';
          reasons.push({ level: 'danger', title: 'Contains gluten', detail: `Ingredient list mentions "${hit}", not suitable for a gluten-free diet.` });
        } else if (!hasIngredientText) {
          reasons.push({ level: 'caution', title: 'Gluten content unverified', detail: 'No ingredient list available — cannot confirm gluten-free status.' });
        }
        break;
      }
      case 'vegan': {
        const nonVeganTags = ['en:milk', 'en:eggs', 'en:fish', 'en:crustaceans', 'en:molluscs'];
        const tagHit = nonVeganTags.find(t => allergenTags.includes(t));
        const categoryHit = ['en:meats', 'en:poultry', 'en:fishes', 'en:seafood'].find(t => (product.categories_tags || []).includes(t));
        if (tagHit || categoryHit) {
          const label = tagHit ? tagHit.replace('en:', '') : categoryHit.replace('en:', '');
          reasons.push({ level: 'danger', title: 'Not vegan', detail: `Product data indicates it contains ${label}, an animal-derived ingredient or category.` });
        } else if (labelTags.includes('en:vegan')) {
          reasons.push({ level: 'safe', title: 'Certified vegan', detail: 'Labeled vegan by the manufacturer.' });
        } else if (hasIngredientText && textHasAny(ingredientsText, NON_VEGAN_KEYWORDS)) {
          const hit = NON_VEGAN_KEYWORDS.find(k => ingredientsText.includes(k));
          reasons.push({ level: 'danger', title: 'Not vegan', detail: `Ingredient list mentions "${hit}", an animal-derived ingredient.` });
        } else if (!hasIngredientText) {
          reasons.push({ level: 'caution', title: 'Vegan status unverified', detail: 'No ingredient list available to confirm this contains no animal products.' });
        } else {
          reasons.push({ level: 'safe', title: 'Looks vegan', detail: 'No animal-derived ingredients detected in the ingredient list.' });
        }
        break;
      }
      case 'vegetarian': {
        const nonVegTags = ['en:fish', 'en:crustaceans', 'en:molluscs'];
        const tagHit = nonVegTags.find(t => allergenTags.includes(t));
        const categoryHit = ['en:meats', 'en:poultry', 'en:fishes', 'en:seafood'].find(t => (product.categories_tags || []).includes(t));
        if (tagHit || categoryHit) {
          const label = tagHit ? tagHit.replace('en:', '') : categoryHit.replace('en:', '');
          reasons.push({ level: 'danger', title: 'Not vegetarian', detail: `Product data indicates it contains ${label}, derived from meat or fish.` });
        } else if (labelTags.includes('en:vegetarian')) {
          reasons.push({ level: 'safe', title: 'Certified vegetarian', detail: 'Labeled vegetarian by the manufacturer.' });
        } else if (hasIngredientText && textHasAny(ingredientsText, NON_VEGETARIAN_KEYWORDS)) {
          const hit = NON_VEGETARIAN_KEYWORDS.find(k => ingredientsText.includes(k));
          reasons.push({ level: 'danger', title: 'Not vegetarian', detail: `Ingredient list mentions "${hit}", derived from meat or fish.` });
        } else if (!hasIngredientText) {
          reasons.push({ level: 'caution', title: 'Vegetarian status unverified', detail: 'No ingredient list available to confirm this contains no meat or fish.' });
        }
        break;
      }
      case 'dairy-free': {
        const milk = ALLERGENS.find(a => a.id === 'milk');
        if (allergenTags.includes('en:milk') || (hasIngredientText && textHasAny(ingredientsText, milk.keywords))) {
          reasons.push({ level: 'danger', title: 'Contains dairy', detail: 'Ingredient list or allergen data indicates dairy content.' });
        } else if (!hasIngredientText) {
          reasons.push({ level: 'caution', title: "Dairy content unverified", detail: 'No ingredient list available.' });
        }
        break;
      }
      case 'halal': {
        if (labelTags.includes('en:halal')) {
          reasons.push({ level: 'safe', title: 'Certified halal', detail: 'Labeled halal by the manufacturer.' });
        } else if (hasIngredientText && textHasAny(ingredientsText, HARAM_KEYWORDS)) {
          const hit = HARAM_KEYWORDS.find(k => ingredientsText.includes(k));
          reasons.push({ level: 'danger', title: 'Likely not halal', detail: `Ingredient list mentions "${hit}".` });
        } else {
          reasons.push({ level: 'caution', title: 'No halal certification found', detail: 'This product is not labeled halal-certified — verify packaging in-store.' });
        }
        break;
      }
      case 'kosher': {
        if (labelTags.includes('en:kosher')) {
          reasons.push({ level: 'safe', title: 'Certified kosher', detail: 'Labeled kosher by the manufacturer.' });
        } else {
          reasons.push({ level: 'caution', title: 'No kosher certification found', detail: 'This product is not labeled kosher-certified — verify packaging in-store.' });
        }
        break;
      }
      case 'keto': {
        const carbs = nutriments['carbohydrates_100g'];
        if (carbs != null) {
          if (carbs > 20) reasons.push({ level: 'danger', title: 'High-carb', detail: `${carbs}g net carbs per 100g is high for a keto diet.` });
          else if (carbs > 10) reasons.push({ level: 'caution', title: 'Moderate carbs', detail: `${carbs}g carbs per 100g — consume in moderation on keto.` });
          else reasons.push({ level: 'safe', title: 'Low-carb', detail: `${carbs}g carbs per 100g fits a keto diet.` });
        }
        break;
      }
      case 'low-sodium': {
        const sodium = nutriments['sodium_100g'] != null ? nutriments['sodium_100g'] * 1000 : null;
        if (sodium != null) {
          if (sodium > 400) reasons.push({ level: 'danger', title: 'High sodium', detail: `${Math.round(sodium)}mg sodium per 100g is high.` });
          else if (sodium > 120) reasons.push({ level: 'caution', title: 'Moderate sodium', detail: `${Math.round(sodium)}mg sodium per 100g.` });
          else reasons.push({ level: 'safe', title: 'Low sodium', detail: `${Math.round(sodium)}mg sodium per 100g.` });
        }
        break;
      }
      case 'paleo': {
        const paleoBad = ['wheat', 'flour', 'sugar', 'corn syrup', 'soy', 'dairy', 'milk', 'legume', 'bean'];
        if (hasIngredientText && textHasAny(ingredientsText, paleoBad)) {
          const hit = paleoBad.find(k => ingredientsText.includes(k));
          reasons.push({ level: 'caution', title: 'May not be paleo-friendly', detail: `Ingredient list mentions "${hit}".` });
        }
        break;
      }
      case 'nut-free': {
        const nutWords = [...ALLERGENS.find(a => a.id === 'tree-nuts').keywords, ...ALLERGENS.find(a => a.id === 'peanuts').keywords];
        if (allergenTags.includes('en:nuts') || allergenTags.includes('en:peanuts') || (hasIngredientText && textHasAny(ingredientsText, nutWords))) {
          reasons.push({ level: 'danger', title: 'Contains nuts', detail: 'Ingredient list or allergen data indicates tree nuts or peanuts.' });
        } else if (traceTags.includes('en:nuts') || traceTags.includes('en:peanuts')) {
          reasons.push({ level: 'caution', title: 'May contain traces of nuts', detail: 'Manufacturer warns of possible cross-contamination.' });
        } else if (!hasIngredientText) {
          reasons.push({ level: 'caution', title: 'Nut content unverified', detail: 'No ingredient list available.' });
        }
        break;
      }
    }
  });

  /* --- Custom avoided ingredients --- */
  let anyIngredientTermMatched = false;
  profile.avoidIngredients.forEach(term => {
    if (hasIngredientText && ingredientsText.includes(term.toLowerCase())) {
      anyIngredientTermMatched = true;
      reasons.push({ level: 'danger', title: `Contains "${term}"`, detail: `You asked to avoid this ingredient and it appears in the ingredient list.` });
    }
  });
  if (profile.avoidIngredients.length && !anyIngredientTermMatched && hasIngredientText && product.lang && product.lang !== 'en') {
    reasons.push({ level: 'caution', title: 'Ingredient list is not in English', detail: `This product's ingredients are listed in "${product.lang}". Automatic matching against your avoid-list may miss items listed under a non-English name — double-check the label.` });
  }

  /* --- Custom avoided foods/brands --- */
  profile.avoidFoods.forEach(term => {
    const t = term.toLowerCase();
    if (productName.includes(t) || categoriesText.includes(t) || (product.brands || '').toLowerCase().includes(t)) {
      reasons.push({ level: 'danger', title: `Matches avoided item "${term}"`, detail: `This product's name, brand, or category matches something you chose to avoid.` });
    }
  });

  /* --- Nutrition limits --- */
  if (profile.limits.sugar != null && nutriments['sugars_100g'] != null && nutriments['sugars_100g'] > profile.limits.sugar) {
    reasons.push({ level: 'caution', title: 'Exceeds your sugar limit', detail: `${nutriments['sugars_100g']}g sugar per 100g exceeds your ${profile.limits.sugar}g limit.` });
  }
  if (profile.limits.sodium != null && nutriments['sodium_100g'] != null && nutriments['sodium_100g'] * 1000 > profile.limits.sodium) {
    reasons.push({ level: 'caution', title: 'Exceeds your sodium limit', detail: `${Math.round(nutriments['sodium_100g'] * 1000)}mg sodium per 100g exceeds your ${profile.limits.sodium}mg limit.` });
  }
  if (profile.limits.satFat != null && nutriments['saturated-fat_100g'] != null && nutriments['saturated-fat_100g'] > profile.limits.satFat) {
    reasons.push({ level: 'caution', title: 'Exceeds your saturated fat limit', detail: `${nutriments['saturated-fat_100g']}g saturated fat per 100g exceeds your ${profile.limits.satFat}g limit.` });
  }

  /* --- Aggregate verdict --- */
  const hasDanger = reasons.some(r => r.level === 'danger');
  const hasCaution = reasons.some(r => r.level === 'caution');
  let level = 'safe';
  let summary = 'Nothing in your profile conflicts with this product.';
  if (hasDanger) { level = 'danger'; summary = 'This product conflicts with your dietary profile.'; }
  else if (hasCaution) { level = 'caution'; summary = 'We found some things worth double-checking before consuming.'; }

  // sort danger first, then caution, then safe
  const order = { danger: 0, caution: 1, safe: 2 };
  reasons.sort((a, b) => order[a.level] - order[b.level]);

  return { level, summary, reasons };
}

/* ---------------------------------------------------------------------
   Recents + helpers
   --------------------------------------------------------------------- */
function renderRecents() {
  const list = loadRecents();
  const el = document.getElementById('recentScans');
  if (!list.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<h3>${iconSvg('history', 'section-h-icon')}Recently Checked</h3><div class="results-list">${list.map((r, i) => `
    <div class="result-row stagger-in" style="animation-delay:${i * 35}ms" data-code="${escapeHtml(r.code)}">
      ${r.image ? `<img src="${r.image}" alt="">` : `<div class="ph">${iconSvg('package')}</div>`}
      <div class="rr-text"><div class="rr-title">${escapeHtml(r.name)}</div><div class="rr-sub">Barcode ${escapeHtml(r.code)}</div></div>
      <span class="rr-chevron">${iconSvg('chevronRight')}</span>
    </div>`).join('')}</div>`;
  el.querySelectorAll('.result-row').forEach(row => {
    row.addEventListener('click', () => lookupAndShow(row.dataset.code));
  });
}

function skeletonRows(n) {
  return `<div class="results-list">${Array.from({ length: n }).map(() => `
    <div class="result-row skeleton-row">
      <div class="ph skeleton"></div>
      <div class="rr-text"><div class="skeleton skeleton-line" style="width:70%"></div><div class="skeleton skeleton-line" style="width:40%"></div></div>
    </div>`).join('')}</div>`;
}
function resultSkeleton() {
  return `
    <div class="result-banner rb-skeleton skeleton"></div>
    <div class="product-card"><div class="ph skeleton"></div><div style="flex:1"><div class="skeleton skeleton-line" style="width:60%"></div><div class="skeleton skeleton-line" style="width:40%"></div></div></div>
    <div class="skeleton skeleton-block"></div>
    <div class="skeleton skeleton-block"></div>`;
}
function emptyState(icon, text) { return `<div class="empty-state">${iconSvg(icon, 'es-icon')}${escapeHtml(text)}</div>`; }
function errorBox(text) { return `<div class="error-box">${iconSvg('alertTriangle')} ${escapeHtml(text)}</div>`; }
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

/* ---------------------------------------------------------------------
   Init
   --------------------------------------------------------------------- */
mountIcons();
renderProfileSummary();
renderRecents();
moveNavIndicator('view-home');
