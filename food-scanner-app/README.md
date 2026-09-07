# SafeBite — Personal Food Safety Scanner

A mobile-first web app that lets you build a dietary profile once, then scan a barcode or search a product to instantly see whether it's safe for you (and everyone you shop for) — with a clear explanation of *why*.

## Features

- **Profile setup** (no account needed): allergies (peanuts, dairy, shellfish, tree nuts, gluten, soy, sesame, and more), diet types (vegan, vegetarian, halal, kosher, keto, paleo, low-sodium, nut-free, gluten-free), custom ingredients to avoid, custom foods/brands to avoid, and optional nutrition limits (sugar/sodium/saturated fat).
- **Barcode scanning** using the device camera (`html5-qrcode`, with the browser's native BarcodeDetector used when available for a much larger scan-tolerance area), or manual barcode entry.
- **Text search** for products by name.
- **Real product data** from the [Open Food Facts](https://world.openfoodfacts.org) open database — ingredients, allergen tags, labels, and nutrition facts for millions of real products, no API key required.
- **Clear verdicts**: ✅ Safe / ⚠️ Check carefully / ❌ Not suitable, each with a specific, itemized reason (e.g. "Contains Tree Nuts — labeled by the manufacturer").
- **Safer Alternatives**: when a product is flagged, the app searches the same category on Open Food Facts and re-runs the safety engine against candidates to surface real products that actually pass your profile.
- **BiteID — shared family/friend profiles**: every user gets a short shareable code (e.g. `K7F3-QXN2`). Add someone else's BiteID and every scan result also shows whether that product is safe for *them*, right alongside your own verdict — so the person doing the shopping can check for everyone at once.
- **Recall & reformulation alerts**: cross-references your own Recently Checked list against the FDA's public food-recall feed and surfaces an active recall as soon as you open the app.
- **Graceful uncertainty**: if a product isn't in the database, its ingredient list is missing/in another language, or a connection's profile can't be reached, the app says so plainly rather than guessing.
- **Recently checked** history for quick re-lookup.

## Architecture

- **Frontend**: static HTML/CSS/JS, no build step, no framework.
- **BiteID backend**: a single Netlify Function (`netlify/functions/bite-profile.js`) backed by Netlify Blobs — a tiny, free, zero-config key/value store included with Netlify. It stores *only* the dietary-preference fields (allergies, diets, avoid-lists, nutrition limits) under a random ID; no name, email, or account of any kind. Sharing a BiteID is like sharing a link to a document — anyone with the code can read that profile's food preferences.
- **Recall alerts**: entirely client-side, querying `api.fda.gov`'s public food-enforcement endpoint against your own local scan history. No backend involved.
- **Everything else** (profile, recents, connections list) lives in the browser's `localStorage`, per device.

## Running it

### Full app (with BiteID sharing) — deploy via Git

BiteID sync needs the serverless function, which only runs on a real Netlify deploy connected to your Git repo (not a drag-and-drop single file):

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. In Netlify: **Add new site → Import an existing project**, pick this repo.
3. Netlify reads `netlify.toml` at the repo root automatically — no manual build settings needed (it points Netlify at the `food-scanner-app` folder and its `netlify/functions` directory).
4. Deploy. Netlify Blobs works automatically on any Netlify site, no extra setup or account needed.

### Local development / testing

```bash
cd food-scanner-app
python3 -m http.server 8765
# open http://localhost:8765
```

This works for everything except BiteID sync (there's no serverless function to talk to locally unless you run it via the Netlify CLI: `netlify dev`).

### Single-file version (no BiteID sync)

`index-standalone.html` bundles the HTML/CSS/JS into one file for the simplest possible drag-and-drop deploy anywhere. Profile, scanning, search, alternatives, and recall alerts all still work — BiteID/Connections will show sync as unavailable since there's no backend to reach.

Camera-based scanning requires HTTPS (or `localhost`) per browser security rules, on either deployment path.

## How the safety engine works

For each check (allergy, diet, custom ingredient/food, nutrition limit), the app:

1. First checks Open Food Facts' structured `allergens_tags` / `traces_tags` / `labels_tags` / `categories_tags` — these are manufacturer-declared and language-independent.
2. Falls back to keyword matching against the ingredient text when structured data is absent.
3. If ingredient text is missing entirely, or is in a language other than English (for free-text avoid-lists), the app flags **"check carefully"** instead of guessing — it never claims something is safe without evidence.

The same engine (`evaluateProduct` in `app.js`) runs once for your own profile and again for each connected BiteID, so "affects Corey"-style messaging uses the exact same logic as your own results.

## Data & privacy

Your profile, connections list, and scan history are stored in your browser's `localStorage`. The only things that leave your device are: product lookups to Open Food Facts, your own dietary-preference fields synced to your BiteID (so people you share it with can see your restrictions), read-only lookups of BiteIDs you've explicitly added, and recall lookups against api.fda.gov for products in your own recent history.
