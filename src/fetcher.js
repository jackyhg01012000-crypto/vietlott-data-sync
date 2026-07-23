const https = require('https');
const axios = require('axios');

// vietlott.vn is behind Cloudflare. From a Vietnamese residential IP a plain axios request
// sails through; from a GitHub Actions runner (Azure datacenter ASN) Cloudflare returns a
// flat 403 with no challenge page. Two things give the default axios request away:
//   1. Headers - axios sends `Accept: application/json, text/plain, */*` and none of the
//      sec-fetch-*/sec-ch-ua hints a real Chrome sends on a document navigation.
//   2. TLS fingerprint - Node's default cipher/curve order produces a JA3 hash that does
//      not match any browser.
// We fix both. This is not guaranteed to beat Cloudflare from a blocked ASN, which is why
// scrape.js keeps a proxy escape hatch.

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const BROWSER_HEADERS = {
  'User-Agent': CHROME_UA,
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'max-age=0',
  'Sec-Ch-Ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

// Chrome's TLS 1.3 + 1.2 cipher order, so the JA3 fingerprint looks like a browser rather
// than like Node's OpenSSL defaults.
const CHROME_CIPHERS = [
  'TLS_AES_128_GCM_SHA256',
  'TLS_AES_256_GCM_SHA384',
  'TLS_CHACHA20_POLY1305_SHA256',
  'ECDHE-ECDSA-AES128-GCM-SHA256',
  'ECDHE-RSA-AES128-GCM-SHA256',
  'ECDHE-ECDSA-AES256-GCM-SHA384',
  'ECDHE-RSA-AES256-GCM-SHA384',
  'ECDHE-ECDSA-CHACHA20-POLY1305',
  'ECDHE-RSA-CHACHA20-POLY1305',
  'ECDHE-RSA-AES128-SHA',
  'ECDHE-RSA-AES256-SHA',
  'AES128-GCM-SHA256',
  'AES256-GCM-SHA384',
  'AES128-SHA',
  'AES256-SHA',
].join(':');

function chromeAgent() {
  return new https.Agent({
    keepAlive: true,
    minVersion: 'TLSv1.2',
    ciphers: CHROME_CIPHERS,
    ecdhCurve: 'X25519:P-256:P-384',
    honorCipherOrder: false,
  });
}

// Shared across calls so we reuse the TLS session, like a browser would.
const AGENT = chromeAgent();

module.exports = { CHROME_UA, BROWSER_HEADERS, CHROME_CIPHERS, chromeAgent, AGENT, axios };
