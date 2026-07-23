const path = require('path');
const axios = require('axios');
const { PRODUCTS, urlFor } = require('./products');
const { parse } = require('./parse');
const { mergeAndWrite } = require('./merge');
const { BROWSER_HEADERS, AGENT } = require('./fetcher');

const DATA_DIR = path.join(__dirname, '..', 'data');
const REQUEST_TIMEOUT_MS = 20_000;
const DELAY_BETWEEN_REQUESTS_MS = 500;
const MAX_ATTEMPTS = 3;

// Optional escape hatch for when the runner's own IP is blocked by Cloudflare. Set the
// SCRAPE_PROXY_URL secret to an https proxy with Vietnamese egress and every request goes
// through it instead. Unset (the normal local case) means a direct connection.
const PROXY_URL = process.env.SCRAPE_PROXY_URL || '';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestConfig() {
  const config = {
    timeout: REQUEST_TIMEOUT_MS,
    headers: BROWSER_HEADERS,
    validateStatus: (status) => status === 200,
    httpsAgent: AGENT,
  };
  if (PROXY_URL) {
    const url = new URL(PROXY_URL);
    config.proxy = {
      protocol: url.protocol.replace(':', ''),
      host: url.hostname,
      port: Number(url.port) || (url.protocol === 'https:' ? 443 : 80),
      ...(url.username ? { auth: { username: url.username, password: url.password } } : {}),
    };
    delete config.httpsAgent;
  }
  return config;
}

async function fetchProduct(productKey) {
  const cfg = PRODUCTS[productKey];
  const url = urlFor(productKey);

  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await axios.get(url, requestConfig());
      return parse(response.data, cfg);
    } catch (err) {
      lastError = err;
      // A 403 is Cloudflare deciding it doesn't like this IP - retrying the same request
      // from the same runner will not change its mind, so don't burn time on it.
      if (err.response && err.response.status === 403) throw err;
      if (attempt < MAX_ATTEMPTS) await sleep(1000 * 2 ** (attempt - 1) + Math.random() * 500);
    }
  }
  throw lastError;
}

async function main() {
  const productKeys = Object.keys(PRODUCTS);
  let successCount = 0;
  let changedCount = 0;
  const failures = [];

  for (const productKey of productKeys) {
    try {
      const results = await fetchProduct(productKey);
      if (results.length === 0) {
        failures.push(`${productKey}: parsed 0 results (selectors may be stale)`);
        continue;
      }

      const { changed, total, fullTotal } = mergeAndWrite(productKey, results, DATA_DIR);
      successCount += 1;
      if (changed) changedCount += 1;
      console.log(
        `[ok] ${productKey}: scraped ${results.length}, ${changed ? 'updated' : 'no change'} (latest: ${total}, full archive: ${fullTotal})`
      );
    } catch (err) {
      const status = err.response ? err.response.status : null;
      const hint =
        status === 403
          ? ' (Cloudflare is blocking this runner\'s IP - see README "Cloudflare 403 on CI")'
          : '';
      failures.push(`${productKey}: ${err.message}${hint}`);
    }

    await sleep(DELAY_BETWEEN_REQUESTS_MS);
  }

  if (failures.length > 0) {
    console.warn(`\n${failures.length} product(s) failed:`);
    failures.forEach((f) => console.warn(`  - ${f}`));
  }

  console.log(`\nDone: ${successCount}/${productKeys.length} products ok, ${changedCount} updated.`);

  // Only fail the workflow run if literally nothing could be scraped - a handful of
  // individual product failures shouldn't block committing the ones that succeeded.
  if (successCount === 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exitCode = 1;
});
