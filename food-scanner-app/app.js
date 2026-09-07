/* =========================================================================
   SafeBite — personal food safety scanner
   - Profile persisted in localStorage
   - Product data from the Open Food Facts public API (real, free, no key)
   - Barcode scanning via device camera (html5-qrcode)
   ========================================================================= */

const OFF_PRODUCT_URL = code => `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=code,product_name,brands,image_front_small_url,image_front_url,ingredients_text,ingredients_text_en,lang,allergens_tags,traces_tags,labels_tags,categories_tags,categories,nutriments,quantity`;
const OFF_SEARCH_URL = q => `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&fields=code,product_name,brands,image_front_small_url,quantity`;

const STORAGE_KEY = 'safebite_profile_v1';
const RECENTS_KEY = 'safebite_recents_v1';

/* ---------------------------------------------------------------------
   Reference data: allergens & diets, with keyword fallbacks used when
   Open Food Facts hasn't tagged a product but the ingredient text
   mentions the substance in plain language.
   --------------------------------------------------------------------- */
const ALLERGENS = [
  { id: 'milk', label: '🥛 Dairy / Milk', offTag: 'en:milk', keywords: ['milk', 'cream', 'butter', 'cheese', 'whey', 'casein', 'lactose', 'yogurt', 'ghee'] },
  { id: 'eggs', label: '🥚 Eggs', offTag: 'en:eggs', keywords: ['egg', 'albumin', 'ovalbumin', 'mayonnaise'] },
  { id: 'fish', label: '🐟 Fish', offTag: 'en:fish', keywords: ['fish', 'anchovy', 'cod', 'salmon', 'tuna', 'gelatin (fish)'] },
  { id: 'shellfish', label: '🦐 Shellfish', offTag: 'en:crustaceans', keywords: ['shrimp', 'prawn', 'crab', 'lobster', 'crustacean', 'shellfish'] },
  { id: 'molluscs', label: '🦪 Molluscs', offTag: 'en:molluscs', keywords: ['mussel', 'oyster', 'squid', 'clam', 'snail', 'mollusc'] },
  { id: 'tree-nuts', label: '🌰 Tree Nuts', offTag: 'en:nuts', keywords: ['almond', 'hazelnut', 'walnut', 'cashew', 'pistachio', 'pecan', 'macadamia', 'brazil nut'] },
  { id: 'peanuts', label: '🥜 Peanuts', offTag: 'en:peanuts', keywords: ['peanut', 'groundnut', 'arachis'] },
  { id: 'wheat', label: '🌾 Wheat', offTag: 'en:gluten', keywords: ['wheat', 'flour', 'semolina', 'spelt', 'durum'] },
  { id: 'soy', label: '🫘 Soy', offTag: 'en:soybeans', keywords: ['soy', 'soya', 'edamame', 'tofu'] },
  { id: 'sesame', label: '◯ Sesame', offTag: 'en:sesame-seeds', keywords: ['sesame', 'tahini'] },
  { id: 'mustard', label: '🌭 Mustard', offTag: 'en:mustard', keywords: ['mustard'] },
  { id: 'celery', label: '🥬 Celery', offTag: 'en:celery', keywords: ['celery', 'celeriac'] },
  { id: 'sulphites', label: '🍷 Sulphites', offTag: 'en:sulphur-dioxide-and-sulphites', keywords: ['sulphite', 'sulfite', 'so2'] },
  { id: 'lupin', label: '🌱 Lupin', offTag: 'en:lupin', keywords: ['lupin', 'lupine'] },
];

const DIETS = [
  { id: 'gluten-free', label: '🚫🌾 Gluten-Free', type: 'gluten-free' },
  { id: 'vegan', label: '🌿 Vegan', type: 'vegan' },
  { id: 'vegetarian', label: '🥕 Vegetarian', type: 'vegetarian' },
  { id: 'dairy-free', label: '🚫🥛 Dairy-Free', type: 'dairy-free' },
  { id: 'halal', label: '☪️ Halal', type: 'halal' },
  { id: 'kosher', label: '✡️ Kosher', type: 'kosher' },
  { id: 'keto', label: '🥑 Keto / Low-Carb', type: 'keto' },
  { id: 'low-sodium', label: '🧂 Low-Sodium', type: 'low-sodium' },
  { id: 'paleo', label: '🍖 Paleo', type: 'paleo' },
  { id: 'nut-free', label: '🚫🥜 Nut-Free (all)', type: 'nut-free' },
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
   Navigation
   --------------------------------------------------------------------- */
const views = document.querySelectorAll('.view');
function showView(id) {
  views.forEach(v => v.classList.toggle('active', v.id === id));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.nav === id));
  window.scrollTo(0, 0);
  if (id !== 'view-scanner') stopScanner();
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.nav === 'view-scanner-open') { openScanner(); }
    else showView(btn.dataset.nav);
  });
});
document.getElementById('profileBtn').addEventListener('click', () => { renderProfileForm(); showView('view-profile'); });
document.getElementById('closeProfileBtn').addEventListener('click', () => showView('view-home'));
document.getElementById('closeScannerBtn').addEventListener('click', () => showView('view-home'));
document.getElementById('backFromResultBtn').addEventListener('click', () => showView('view-home'));
document.getElementById('openScannerBtn').addEventListener('click', openScanner);

/* ---------------------------------------------------------------------
   Profile form rendering
   --------------------------------------------------------------------- */
function renderChipGrid(container, items, selectedIds, onToggle) {
  container.innerHTML = '';
  items.forEach(item => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (selectedIds.includes(item.id) ? ' selected' : '');
    chip.textContent = item.label;
    chip.addEventListener('click', () => {
      chip.classList.toggle('selected');
      onToggle(item.id, chip.classList.contains('selected'));
    });
    container.appendChild(chip);
  });
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
      pill.className = 'tag-pill';
      pill.innerHTML = `<span></span><button type="button" aria-label="Remove">✕</button>`;
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
  renderChipGrid(document.getElementById('allergyGrid'), ALLERGENS, workingProfile.allergies, (id, on) => {
    workingProfile.allergies = on ? [...new Set([...workingProfile.allergies, id])] : workingProfile.allergies.filter(a => a !== id);
  });
  renderChipGrid(document.getElementById('dietGrid'), DIETS, workingProfile.diets, (id, on) => {
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
  setTimeout(() => showView('view-home'), 500);
});
document.getElementById('saveProfileTopBtn').addEventListener('click', () => {
  commitProfileForm();
  showView('view-home');
});

function renderProfileSummary() {
  const card = document.getElementById('profileSummaryCard');
  const hasAny = profile.allergies.length || profile.diets.length || profile.avoidIngredients.length || profile.avoidFoods.length;
  if (!hasAny) {
    card.innerHTML = `
      <h3>Your Profile</h3>
      <p class="empty-hint">You haven't set up a dietary profile yet. Tap 👤 above to add allergies, diets, and ingredients to avoid — it takes under a minute.</p>
      <button class="link-btn" id="setupProfileNow">Set up now →</button>`;
    card.querySelector('#setupProfileNow').addEventListener('click', () => { renderProfileForm(); showView('view-profile'); });
    return;
  }
  const chips = [];
  profile.allergies.forEach(id => chips.push(ALLERGENS.find(a => a.id === id)?.label));
  profile.diets.forEach(id => chips.push(DIETS.find(d => d.id === id)?.label));
  profile.avoidIngredients.forEach(t => chips.push('🚫 ' + t));
  profile.avoidFoods.forEach(t => chips.push('🙅 ' + t));
  card.innerHTML = `<h3>Your Profile</h3><div class="chips">${chips.map(c => `<span class="chip-mini">${escapeHtml(c)}</span>`).join('')}</div>`;
}

/* ---------------------------------------------------------------------
   Barcode scanner (html5-qrcode)
   --------------------------------------------------------------------- */
let html5QrCode = null;
function openScanner() {
  showView('view-scanner');
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
  resultsEl.innerHTML = loadingRow('Searching products…');
  try {
    const res = await fetch(OFF_SEARCH_URL(query));
    if (!res.ok) throw new Error('Search request failed (' + res.status + ')');
    const data = await res.json();
    const products = (data.products || []).filter(p => p.product_name);
    if (!products.length) {
      resultsEl.innerHTML = emptyState('🔍', 'No products found for "' + escapeHtml(query) + '". Try a different name or scan the barcode instead.');
      return;
    }
    resultsEl.innerHTML = '';
    products.forEach(p => resultsEl.appendChild(renderSearchRow(p)));
  } catch (err) {
    resultsEl.innerHTML = errorBox('Couldn\'t reach the food database. Check your internet connection and try again.');
  }
}

function renderSearchRow(p) {
  const row = document.createElement('div');
  row.className = 'result-row';
  const img = p.image_front_small_url
    ? `<img src="${p.image_front_small_url}" alt="">`
    : `<div class="ph">🍽️</div>`;
  row.innerHTML = `${img}<div class="rr-text"><div class="rr-title">${escapeHtml(p.product_name)}</div><div class="rr-sub">${escapeHtml(p.brands || 'Unknown brand')}${p.quantity ? ' · ' + escapeHtml(p.quantity) : ''}</div></div><span>›</span>`;
  row.addEventListener('click', () => lookupAndShow(p.code));
  return row;
}

/* ---------------------------------------------------------------------
   Product lookup + rendering result
   --------------------------------------------------------------------- */
async function lookupAndShow(code) {
  showView('view-result');
  const el = document.getElementById('resultContent');
  el.innerHTML = loadingRow('Looking up product…');
  try {
    const res = await fetch(OFF_PRODUCT_URL(code));
    if (!res.ok) throw new Error('Lookup failed (' + res.status + ')');
    const data = await res.json();
    if (data.status !== 1 || !data.product) {
      el.innerHTML = `
        <div class="result-banner rb-caution">
          <span class="emoji">❓</span>
          <h2>Product not found</h2>
          <p>Barcode ${escapeHtml(code)} isn't in the Open Food Facts database yet.</p>
        </div>
        <div class="reason-item sev-caution">
          <div class="ri-icon">⚠️</div>
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
  const bannerEmoji = verdict.level === 'safe' ? '✅' : verdict.level === 'caution' ? '⚠️' : '❌';
  const bannerTitle = verdict.level === 'safe' ? 'Safe for your profile' : verdict.level === 'caution' ? 'Check carefully' : 'Not suitable for you';

  const img = product.image_front_url || product.image_front_small_url;
  const productImgHtml = img ? `<img src="${img}" alt="">` : `<div class="ph">🍽️</div>`;

  const reasonsHtml = verdict.reasons.length
    ? verdict.reasons.map(r => `
        <li class="reason-item sev-${r.level}">
          <div class="ri-icon">${r.level === 'danger' ? '❌' : r.level === 'caution' ? '⚠️' : '✅'}</div>
          <div><div class="ri-title">${escapeHtml(r.title)}</div><div class="ri-detail">${escapeHtml(r.detail)}</div></div>
        </li>`).join('')
    : `<li class="reason-item sev-safe"><div class="ri-icon">✅</div><div><div class="ri-title">No conflicts found</div><div class="ri-detail">Nothing in this product matched your allergies, diets, or avoid-lists.</div></div></li>`;

  const ingredientsText = product.ingredients_text_en || product.ingredients_text;
  const nutriments = product.nutriments || {};

  el.innerHTML = `
    <div class="result-banner ${bannerClass}">
      <span class="emoji">${bannerEmoji}</span>
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
      ${nutriCell('Sugar', nutriments['sugars_100g'], 'g')}
      ${nutriCell('Sodium', nutriments['sodium_100g'] != null ? nutriments['sodium_100g'] * 1000 : null, 'mg')}
      ${nutriCell('Sat. Fat', nutriments['saturated-fat_100g'], 'g')}
      ${nutriCell('Energy', nutriments['energy-kcal_100g'], 'kcal')}
    </div>` : ''}

    <div class="section-title">Ingredients</div>
    <div class="ingredients-box">${ingredientsText ? escapeHtml(ingredientsText) : 'No ingredient list available for this product.'}</div>
  `;
}
function nutriCell(label, val, unit) {
  return `<div class="nutri-cell"><div class="nc-val">${val != null ? Math.round(val * 10) / 10 + unit : '—'}</div><div class="nc-label">${label}</div></div>`;
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
      reasons.push({ level: 'danger', title: `Contains ${a.label.replace(/^\S+\s/, '')}`, detail: `Labeled by the manufacturer as containing this allergen.` });
      return;
    }
    if (traceTags.includes(a.offTag)) {
      reasons.push({ level: 'caution', title: `May contain traces of ${a.label.replace(/^\S+\s/, '')}`, detail: `The manufacturer warns this product may contain traces due to shared equipment/facilities.` });
      return;
    }
    if (hasIngredientText && textHasAny(ingredientsText, a.keywords)) {
      const hit = a.keywords.find(k => ingredientsText.includes(k));
      reasons.push({ level: 'danger', title: `Contains ${a.label.replace(/^\S+\s/, '')}`, detail: `Ingredient list mentions "${hit}".` });
      return;
    }
    if (!hasIngredientText) {
      reasons.push({ level: 'caution', title: `Can't verify ${a.label.replace(/^\S+\s/, '')}`, detail: `No ingredient list is available to confirm this is free of your allergen.` });
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
  el.innerHTML = `<h3>Recently Checked</h3><div class="results-list">${list.map(r => `
    <div class="result-row" data-code="${escapeHtml(r.code)}">
      ${r.image ? `<img src="${r.image}" alt="">` : `<div class="ph">🍽️</div>`}
      <div class="rr-text"><div class="rr-title">${escapeHtml(r.name)}</div><div class="rr-sub">Barcode ${escapeHtml(r.code)}</div></div>
      <span>›</span>
    </div>`).join('')}</div>`;
  el.querySelectorAll('.result-row').forEach(row => {
    row.addEventListener('click', () => lookupAndShow(row.dataset.code));
  });
}

function loadingRow(text) { return `<div class="loading-row"><div class="spinner"></div>${escapeHtml(text)}</div>`; }
function emptyState(emoji, text) { return `<div class="empty-state"><span class="es-emoji">${emoji}</span>${escapeHtml(text)}</div>`; }
function errorBox(text) { return `<div class="error-box">⚠️ ${escapeHtml(text)}</div>`; }
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

/* ---------------------------------------------------------------------
   Init
   --------------------------------------------------------------------- */
renderProfileSummary();
renderRecents();

if (!('serviceWorker' in navigator)) { /* offline caching not critical to core function */ }
