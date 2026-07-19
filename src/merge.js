const fs = require('fs');
const path = require('path');

const MAX_ENTRIES = 300;

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

// Merges freshly scraped results into whatever is already on disk for this product,
// de-duplicating by drawId, keeping only the most recent MAX_ENTRIES, and reporting
// whether anything actually changed (so the caller can skip a no-op git commit).
function mergeAndWrite(productKey, freshResults, dataDir) {
  const productDir = path.join(dataDir, productKey);
  const filePath = path.join(productDir, 'latest.json');

  const existing = loadExisting(filePath);
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

  if (!changed) return { changed: false, total: existing.length };

  const merged = [...byDrawId.values()]
    .sort((a, b) => (sortKey(a) < sortKey(b) ? 1 : -1))
    .slice(0, MAX_ENTRIES);

  fs.mkdirSync(productDir, { recursive: true });
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

module.exports = { mergeAndWrite };
