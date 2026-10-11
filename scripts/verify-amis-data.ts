import {
  AMIS_TOMATO_PRICES,
  AMIS_TOMATO_REPORT_DATE,
  AMIS_TOMATO_PRICE_UNIT_CONFIDENCE,
} from '../lib/data/amis-tomato-prices';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`AMIS data verification failed: ${message}`);
}

assert(AMIS_TOMATO_REPORT_DATE === '10 October 2026', 'report date must match the supplied PDF');
assert(AMIS_TOMATO_PRICES.length === 67, 'expected 67 market rows extracted from the two-page AMIS report');
assert(AMIS_TOMATO_PRICE_UNIT_CONFIDENCE === 'assumed', 'price-unit uncertainty must remain explicit');

const lahore = AMIS_TOMATO_PRICES.find((row) => row.city === 'Lahore');
assert(lahore?.min === 12000 && lahore.max === 13000 && lahore.fqp === 12500, 'Lahore values must match the PDF');
assert(lahore.fqp / 100 === 125, 'assumed Rs/100 kg conversion should yield Rs 125/kg for Lahore');
assert(AMIS_TOMATO_PRICES.filter((row) => row.fqp === null).length === 5, 'five markets have no reported prices');

for (const row of AMIS_TOMATO_PRICES) {
  for (const value of [row.min, row.max, row.fqp]) {
    assert(value === null || (Number.isFinite(value) && value >= 0), `invalid price value for ${row.city}`);
  }
  if (row.min !== null && row.max !== null) {
    assert(row.min <= row.max, `minimum exceeds maximum for ${row.city}`);
  }
}

console.log(`AMIS tomato dataset checks passed: ${AMIS_TOMATO_PRICES.length} rows; 5 markets without prices; unit assumption remains explicit.`);
