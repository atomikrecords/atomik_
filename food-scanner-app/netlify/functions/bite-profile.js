// SafeBite — BiteID profile store.
// Stores only dietary-preference fields under a random, unguessable ID.
// No accounts, no PII: the ID itself is the shareable "key" a person hands
// to family/friends, similar in spirit to a shared-document link.
const { getStore } = require('@netlify/blobs');

const ID_PATTERN = /^[A-Z2-9]{6,12}$/;
const MAX_LIST_LEN = 60;
const MAX_TAG_LEN = 80;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  // TEMPORARY diagnostic — never exposes the actual values, only whether
  // they're present and how long they are, to debug why the function
  // can't see them. Remove once BiteID sync is confirmed working.
  if ((event.queryStringParameters || {}).debugEnv === '1') {
    return {
      statusCode: 200, headers, body: JSON.stringify({
        hasSiteId: !!process.env.BLOBS_SITE_ID,
        siteIdLength: (process.env.BLOBS_SITE_ID || '').length,
        hasToken: !!process.env.BLOBS_TOKEN,
        tokenLength: (process.env.BLOBS_TOKEN || '').length,
        netlifyContext: process.env.CONTEXT || null,
        netlifyBlobsContextPresent: !!process.env.NETLIFY_BLOBS_CONTEXT,
      }),
    };
  }

  const id = ((event.queryStringParameters || {}).id || '').toUpperCase();
  if (!ID_PATTERN.test(id)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid or missing BiteID.' }) };
  }

  const store = getBlobStore();

  if (event.httpMethod === 'GET') {
    const data = await store.get(id, { type: 'json' });
    if (!data) return { statusCode: 404, headers, body: JSON.stringify({ found: false }) };
    return { statusCode: 200, headers, body: JSON.stringify({ found: true, profile: data }) };
  }

  if (event.httpMethod === 'PUT') {
    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch (e) { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Malformed JSON body.' }) }; }

    const clean = sanitizeProfile(body);
    await store.setJSON(id, { ...clean, updatedAt: Date.now() });
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed.' }) };
};

// Netlify Blobs is supposed to auto-configure on any live deploy — no
// action needed most of the time. If that automatic detection doesn't work
// for a given site (some accounts/plans need it spelled out explicitly),
// set BLOBS_SITE_ID and BLOBS_TOKEN as environment variables in Netlify
// (Site configuration → Environment variables) and this falls back to
// using them: BLOBS_SITE_ID is your Site ID (Site configuration → General
// → Site details), BLOBS_TOKEN is a Personal Access Token (User settings
// → Applications → New access token).
function getBlobStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: 'bite-profiles', siteID, token });
  }
  return getStore('bite-profiles');
}

function sanitizeProfile(body) {
  return {
    allergies: cleanStringArray(body.allergies),
    diets: cleanStringArray(body.diets),
    avoidIngredients: cleanStringArray(body.avoidIngredients),
    avoidFoods: cleanStringArray(body.avoidFoods),
    limits: {
      sugar: numOrNull(body.limits && body.limits.sugar),
      sodium: numOrNull(body.limits && body.limits.sodium),
      satFat: numOrNull(body.limits && body.limits.satFat),
    },
  };
}
function cleanStringArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(x => typeof x === 'string')
    .map(x => x.slice(0, MAX_TAG_LEN))
    .slice(0, MAX_LIST_LEN);
}
function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
