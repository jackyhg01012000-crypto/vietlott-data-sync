// Product config reverse-engineered from https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/*
// on 2026-07-19. Slugs and ball CSS classes are the fragile part - if a scrape starts
// returning 0 results for a product, check the slug/selectors here first.
//
// type A: single latest draw, numbers rendered as <span class="bong_tron"> inside
//         .day_so_ket_qua_v2, optionally followed by a bonus ball after <i>|</i>.
//         Used by the 3 "ball" products (655/645/535). Only 655 and 535 have a bonus ball.
// type B: single latest draw, digit-style (Max 3D / Max 3D Pro). Two 3-digit groups are
//         shown under "Giai Dac biet"; we take the first group as the draw's numbers.
// type C: a table of several recent rows already rendered on the page (Keno/Bingo18),
//         each row has its own date/drawId and ball spans - no need to page through history.
const PRODUCTS = {
  power_655: {
    slug: '655',
    type: 'A',
    ballCount: 6,
    hasBonus: true,
    ballClass: 'bong_tron',
  },
  power_645: {
    slug: '645',
    type: 'A',
    ballCount: 6,
    hasBonus: false,
    ballClass: 'bong_tron',
  },
  power_535: {
    slug: '535',
    type: 'A',
    ballCount: 5,
    hasBonus: true,
    ballClass: 'bong_tron',
  },
  '3d': {
    slug: 'max-3d',
    type: 'B',
    ballCount: 3,
    hasBonus: false,
    ballClass: 'bong_tron',
  },
  '3d_pro': {
    slug: 'max-3dpro',
    type: 'B',
    ballCount: 3,
    hasBonus: false,
    ballClass: 'bong_tron',
  },
  keno: {
    slug: 'winning-number-keno',
    type: 'C',
    ballCount: 20,
    hasBonus: false,
    ballClass: 'bong_tron',
  },
  bingo18: {
    slug: 'winning-number-bingo18',
    type: 'C',
    ballCount: 3,
    hasBonus: false,
    ballClass: 'bong_tron_bingo',
  },
};

const BASE_URL = 'https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong';

function urlFor(productKey) {
  return `${BASE_URL}/${PRODUCTS[productKey].slug}`;
}

module.exports = { PRODUCTS, urlFor };
