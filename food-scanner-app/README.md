# SafeBite — Personal Food Safety Scanner

A mobile-first web app that lets you build a dietary profile once, then scan a barcode or search a product to instantly see whether it's safe for you — with a clear explanation of *why*.

## Features

- **Profile setup** (localStorage, no account needed): allergies (peanuts, dairy, shellfish, tree nuts, gluten, soy, sesame, and more), diet types (vegan, vegetarian, halal, kosher, keto, paleo, low-sodium, nut-free, gluten-free), custom ingredients to avoid, custom foods/brands to avoid, and optional nutrition limits (sugar/sodium/saturated fat).
- **Barcode scanning** using the device camera (`html5-qrcode`), or manual barcode entry.
- **Text search** for products by name.
- **Real product data** from the [Open Food Facts](https://world.openfoodfacts.org) open database — ingredients, allergen tags, labels, and nutrition facts for millions of real products, no API key required.
- **Clear verdicts**: ✅ Safe / ⚠️ Check carefully / ❌ Not suitable, each with a specific, itemized reason (e.g. "Contains Tree Nuts — labeled by the manufacturer").
- **Graceful uncertainty**: if a product isn't in the database, or its ingredient list is missing/in another language, the app tells you so and returns "check carefully" rather than falsely claiming safety.
- **Recently checked** history for quick re-lookup.

## Running it

No build step or backend required — it's a static site.

```bash
cd food-scanner-app
python3 -m http.server 8765
# open http://localhost:8765
```

Or deploy the folder as-is to any static host (GitHub Pages, Netlify, Vercel, etc). Camera-based scanning requires HTTPS (or `localhost`) per browser security rules.

## How the safety engine works

For each check (allergy, diet, custom ingredient/food, nutrition limit), the app:

1. First checks Open Food Facts' structured `allergens_tags` / `traces_tags` / `labels_tags` / `categories_tags` — these are manufacturer-declared and language-independent.
2. Falls back to keyword matching against the ingredient text when structured data is absent.
3. If ingredient text is missing entirely, or is in a language other than English (for free-text avoid-lists), the app flags **"check carefully"** instead of guessing — it never claims something is safe without evidence.

All logic lives in `app.js` (`evaluateProduct`), which is a plain synchronous function — easy to unit test or extend with more allergens/diets.

## Data & privacy

Your profile and recent-scan history are stored only in your browser's `localStorage`. Nothing is sent anywhere except product lookups to the public Open Food Facts API.
