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

  const id = ((event.queryStringParameters || {}).id || '').toUpperCase();
  if (!ID_PATTERN.test(id)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid or missing BiteID.' }) };
  }

  const store = getStore('bite-profiles');

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
