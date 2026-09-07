// SafeBite — product search proxy.
//
// Open Food Facts' current search API (search.openfoodfacts.org) sends no
// Access-Control-Allow-Origin header, so browsers silently block reading the
// response even though it works fine server-to-server. Their older
// cgi/search.pl endpoint does allow CORS but has been intermittently
// returning 503s. Routing both through our own function sidesteps the CORS
// gap entirely and lets us retry across both upstreams server-side.
const MODERN_URL = q => `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=20&fields=code,product_name,brands,image_front_small_url,quantity`;
const LEGACY_URL = q => `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&fields=code,product_name,brands,image_front_small_url,quantity`;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  const q = (event.queryStringParameters || {}).q;
  if (!q || !q.trim()) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing search query.' }) };
  }

  const modern = await tryFetch(MODERN_URL(q), 'hits');
  if (modern) return { statusCode: 200, headers, body: JSON.stringify({ products: modern }) };

  const legacy = await tryFetch(LEGACY_URL(q), 'products');
  if (legacy) return { statusCode: 200, headers, body: JSON.stringify({ products: legacy }) };

  return { statusCode: 502, headers, body: JSON.stringify({ error: 'Both search upstreams failed.' }) };
};

async function tryFetch(url, listKey) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'SafeBite/1.0 (+https://bitesafesite.netlify.app)' } });
    if (!res.ok) return null;
    const data = await res.json();
    const list = data[listKey];
    return Array.isArray(list) ? normalize(list) : null;
  } catch (e) { return null; }
}

// The two upstreams shape `brands` differently (string vs array) — normalize
// to what the client renders.
function normalize(list) {
  return list.map(p => ({
    code: p.code,
    product_name: p.product_name,
    brands: Array.isArray(p.brands) ? p.brands.join(', ') : p.brands,
    image_front_small_url: p.image_front_small_url,
    quantity: p.quantity,
  }));
}
