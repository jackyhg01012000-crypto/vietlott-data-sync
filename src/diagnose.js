// Probe script: tries several fetch strategies against vietlott.vn and reports which ones
// come back 200. Meant to be run ON a GitHub Actions runner (via the `diagnose` workflow),
// because that is the environment where Cloudflare returns 403 - it always passes locally
// from a Vietnamese IP, so running it here tells you nothing.
//
//   npm run diagnose
//
// Read the summary table at the end of the job log and adopt whichever strategy wins.

const https = require('https');
const axios = require('axios');
const { BROWSER_HEADERS, CHROME_UA, chromeAgent } = require('./fetcher');

const TARGET = 'https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/655';
const TIMEOUT = 25_000;

// A response only counts as a real win if it actually contains draw data - Cloudflare
// interstitials and "sorry" pages can still come back as 200.
function looksLikeResults(body) {
  return typeof body === 'string' && /Kỳ quay thưởng/.test(body);
}

function describe(body) {
  if (typeof body !== 'string') return `non-string body (${typeof body})`;
  const cf = /cf-browser-verification|challenge-platform|Just a moment|Attention Required/i.test(body);
  return `${body.length} bytes${cf ? ' [cloudflare challenge page]' : ''}`;
}

async function viaAxios(label, { headers, agent }) {
  const res = await axios.get(TARGET, {
    timeout: TIMEOUT,
    headers,
    httpsAgent: agent,
    validateStatus: () => true,
    decompress: true,
  });
  return { label, status: res.status, ok: res.status === 200 && looksLikeResults(res.data), note: describe(res.data) };
}

async function viaNativeFetch(label, headers, agent) {
  // Node's built-in fetch (undici) has a different TLS/ALPN profile than axios' http(s)
  // module path - notably it negotiates HTTP/2-style ALPN, which sometimes matters.
  const res = await fetch(TARGET, {
    headers,
    signal: AbortSignal.timeout(TIMEOUT),
    ...(agent ? { dispatcher: agent } : {}),
  });
  const body = await res.text();
  return { label, status: res.status, ok: res.status === 200 && looksLikeResults(body), note: describe(body) };
}

async function viaProxy(label, buildUrl) {
  const res = await axios.get(buildUrl(TARGET), {
    timeout: TIMEOUT,
    headers: { 'User-Agent': CHROME_UA },
    validateStatus: () => true,
  });
  const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  return { label, status: res.status, ok: res.status === 200 && looksLikeResults(body), note: describe(body) };
}

const STRATEGIES = [
  {
    name: '1. baseline (what scrape.js does today)',
    run: () =>
      viaAxios('1. baseline', {
        headers: { 'User-Agent': CHROME_UA, 'Accept-Language': 'vi-VN,vi;q=0.9' },
        agent: undefined,
      }),
  },
  {
    name: '2. full browser headers, default Node TLS',
    run: () => viaAxios('2. browser headers', { headers: BROWSER_HEADERS, agent: undefined }),
  },
  {
    name: '3. full browser headers + Chrome TLS fingerprint',
    run: () => viaAxios('3. browser headers + Chrome TLS', { headers: BROWSER_HEADERS, agent: chromeAgent() }),
  },
  {
    name: '4. Node native fetch + browser headers',
    run: () => viaNativeFetch('4. native fetch', BROWSER_HEADERS),
  },
  {
    name: '5. browser headers + Referer (from vietlott.vn homepage)',
    run: () =>
      viaAxios('5. browser headers + Referer', {
        headers: {
          ...BROWSER_HEADERS,
          Referer: 'https://vietlott.vn/vi',
          'Sec-Fetch-Site': 'same-origin',
        },
        agent: chromeAgent(),
      }),
  },
  {
    name: '6. IPv4 only (some ASN blocks are v6-specific)',
    run: () =>
      viaAxios('6. IPv4 only', {
        headers: BROWSER_HEADERS,
        agent: new https.Agent({ family: 4, keepAlive: true }),
      }),
  },
  {
    name: '7. public CORS proxy (allorigins)',
    run: () => viaProxy('7. allorigins proxy', (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`),
  },
  {
    name: '8. public reader proxy (codetabs)',
    run: () =>
      viaProxy('8. codetabs proxy', (u) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`),
  },
];

async function main() {
  console.log(`Target: ${TARGET}`);
  console.log(`Node: ${process.version}\n`);

  const results = [];
  for (const strategy of STRATEGIES) {
    process.stdout.write(`Trying ${strategy.name} ... `);
    try {
      const result = await strategy.run();
      results.push(result);
      console.log(`HTTP ${result.status} ${result.ok ? 'PARSEABLE' : 'not usable'} (${result.note})`);
    } catch (err) {
      results.push({ label: strategy.name, status: 'ERR', ok: false, note: err.message });
      console.log(`ERROR ${err.message}`);
    }
  }

  console.log('\n================ SUMMARY ================');
  for (const r of results) {
    console.log(`${r.ok ? 'WORKS  ' : 'blocked'}  ${String(r.status).padEnd(5)}  ${r.label}`);
  }

  const winners = results.filter((r) => r.ok);
  console.log(`\n${winners.length} of ${results.length} strategies returned usable HTML.`);
  if (winners.length === 0) {
    console.log('None worked from this runner - a Vietnam-side egress (self-hosted runner or proxy) is required.');
  }
  // Always exit 0: this is a probe, a fully blocked result is information, not a build break.
}

main().catch((err) => {
  console.error('Fatal:', err);
});
