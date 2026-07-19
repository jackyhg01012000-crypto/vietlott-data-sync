const path = require('path');
const axios = require('axios');
const { PRODUCTS, urlFor } = require('./products');
const { parse } = require('./parse');
const { mergeAndWrite } = require('./merge');

const DATA_DIR = path.join(__dirname, '..', 'data');
const REQUEST_TIMEOUT_MS = 20_000;
const DELAY_BETWEEN_REQUESTS_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchProduct(productKey) {
  const cfg = PRODUCTS[productKey];
  const url = urlFor(productKey);

  const response = await axios.get(url, {
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept-Language': 'vi-VN,vi;q=0.9',
    },
    validateStatus: (status) => status === 200,
  });

  return parse(response.data, cfg);
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

      const { changed, total } = mergeAndWrite(productKey, results, DATA_DIR);
      successCount += 1;
      if (changed) changedCount += 1;
      console.log(
        `[ok] ${productKey}: scraped ${results.length}, ${changed ? 'updated' : 'no change'} (total cached: ${total})`
      );
    } catch (err) {
      failures.push(`${productKey}: ${err.message}`);
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
