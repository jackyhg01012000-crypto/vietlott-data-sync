const cheerio = require('cheerio');

const DRAW_HEADER_RE = /Kỳ quay thưởng\s*#?(\d+)\s*ngày\s*(\d{1,2}\/\d{1,2}\/\d{4})/;
const DATE_RE = /(\d{1,2}\/\d{1,2}\/\d{4})/;
const ID_RE = /#(\d+)/;

function normalizeDate(ddmmyyyy) {
  const [d, m, y] = ddmmyyyy.split('/');
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function findDrawHeader($) {
  let drawId = null;
  let date = null;
  $('h5').each((_, el) => {
    const match = $(el).text().match(DRAW_HEADER_RE);
    if (match) {
      drawId = match[1];
      date = match[2];
    }
  });
  return { drawId, date };
}

// 655 / 645 / 535: single latest draw, all balls in one .day_so_ket_qua_v2 block.
function parseTypeA(html, cfg) {
  const $ = cheerio.load(html);
  const { drawId, date } = findDrawHeader($);
  if (!drawId || !date) return [];

  const balls = [];
  $(`.day_so_ket_qua_v2 span.${cfg.ballClass}`).each((_, el) => {
    const text = $(el).text().trim();
    if (text !== '') balls.push(parseInt(text, 10));
  });
  if (balls.length < cfg.ballCount) return [];

  const numbers = balls.slice(0, cfg.ballCount);
  const bonusNumber = cfg.hasBonus && balls.length > cfg.ballCount ? balls[cfg.ballCount] : null;

  return [{ drawId, date: normalizeDate(date), numbers, bonusNumber, jackpot: null }];
}

// Max 3D / Max 3D Pro: single latest draw, digits shown as two 3-digit groups under
// "Giai Dac biet" - we only keep the first group.
function parseTypeB(html, cfg) {
  const $ = cheerio.load(html);
  const { drawId, date } = findDrawHeader($);
  if (!drawId || !date) return [];

  const numbers = [];
  $('.day_so_ket_qua_v2').first().find(`span.${cfg.ballClass}`).each((_, el) => {
    const text = $(el).text().trim();
    if (text !== '') numbers.push(parseInt(text, 10));
  });
  if (numbers.length < cfg.ballCount) return [];

  return [{ drawId, date: normalizeDate(date), numbers: numbers.slice(0, cfg.ballCount), bonusNumber: null, jackpot: null }];
}

// Keno / Bingo18: the page already lists several recent rows in a table.
function parseTypeC(html, cfg) {
  const $ = cheerio.load(html);
  const results = [];

  $('tr').each((_, row) => {
    const $row = $(row);
    const rowText = $row.text();
    const dateMatch = rowText.match(DATE_RE);
    const idMatch = rowText.match(ID_RE);
    if (!dateMatch || !idMatch) return;

    const balls = [];
    $row.find(`span.${cfg.ballClass}`).each((_, el) => {
      const text = $(el).text().trim();
      if (text !== '') balls.push(parseInt(text, 10));
    });
    if (balls.length < cfg.ballCount) return;

    results.push({
      drawId: idMatch[1],
      date: normalizeDate(dateMatch[1]),
      numbers: balls.slice(0, cfg.ballCount),
      bonusNumber: null,
      jackpot: null,
    });
  });

  return results;
}

function parse(html, cfg) {
  if (cfg.type === 'A') return parseTypeA(html, cfg);
  if (cfg.type === 'B') return parseTypeB(html, cfg);
  if (cfg.type === 'C') return parseTypeC(html, cfg);
  throw new Error(`Unknown parser type: ${cfg.type}`);
}

module.exports = { parse, normalizeDate };
