const fs = require('fs');
const path = require('path');

const LATEST_MAX_ENTRIES = 300;

function loadExisting(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed.results) ? parsed.results : [];
  } catch {
    return [];
  }
}

function sortKey(result) {
  // date is already YYYY-MM-DD so lexicographic sort is chronological; drawId as a
  // number breaks ties when two draws land on the same date (e.g. Keno).
  return `${result.date}#${String(result.drawId).padStart(10, '0')}`;
}

function writeMerged(productKey, filePath, existing, freshResults, maxEntries, forceWrite) {
  const byDrawId = new Map(existing.map((r) => [String(r.drawId), r]));
  let changed = false;

  for (const result of freshResults) {
    const key = String(result.drawId);
    const prev = byDrawId.get(key);
    if (!prev || JSON.stringify(prev) !== JSON.stringify(result)) {
      byDrawId.set(key, result);
      changed = true;
    }
  }

  if (!changed && !forceWrite) return { changed: false, total: existing.length };

  let merged = [...byDrawId.values()].sort((a, b) => (sortKey(a) < sortKey(b) ? 1 : -1));
  if (maxEntries) merged = merged.slice(0, maxEntries);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        product: productKey,
        updatedAt: new Date().toISOString(),
        results: merged,
      },
      null,
      2
    )
  );

  return { changed: true, total: merged.length };
}

// Merges freshly scraped results into two files for this product:
//   - latest.json: capped at LATEST_MAX_ENTRIES, small and cheap to poll every ~15 min.
//   - full.json: uncapped, the complete record since this repo started scraping. New app
//     installs bulk-load this (alongside the older vietvudanh/vietlott-data mirror) so they
//     don't end up missing whatever this repo has already collected.
// De-duplicates by drawId. Returns whether anything changed (so the caller can skip a
// no-op git commit).
function mergeAndWrite(productKey, freshResults, dataDir) {
  const productDir = path.join(dataDir, productKey);
  const latestPath = path.join(productDir, 'latest.json');
  const fullPath = path.join(productDir, 'full.json');

  const existingLatest = loadExisting(latestPath);
  const latestResult = writeMerged(productKey, latestPath, existingLatest, freshResults, LATEST_MAX_ENTRIES, false);

  // First time full.json is written: seed it with whatever latest.json already has, so we
  // don't throw away entries this repo already collected before full.json existed. Force the
  // write even if the fresh scrape adds nothing new - otherwise the seed itself never lands
  // on disk when nothing changed this run.
  const fullAlreadyExists = fs.existsSync(fullPath);
  const existingFull = fullAlreadyExists ? loadExisting(fullPath) : existingLatest;
  const fullResult = writeMerged(productKey, fullPath, existingFull, freshResults, null, !fullAlreadyExists);

  return {
    changed: latestResult.changed || fullResult.changed,
    total: latestResult.total,
    fullTotal: fullResult.total,
  };
}

module.exports = { mergeAndWrite };
