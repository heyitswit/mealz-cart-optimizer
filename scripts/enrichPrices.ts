// Adds median EUR prices from Open Prices to the product snapshot. Run: pnpm tsx scripts/enrichPrices.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CatalogSnapshot } from '../src/catalog/openFoodFacts';

const here = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = join(here, '../src/catalog/fixtures/off-products.json');
const API = 'https://prices.openfoodfacts.org/api/v1/prices';
const USER_AGENT = 'mealz-cart-optimizer/0.1 (portfolio project; github)';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

async function fetchEurPrice(code: string): Promise<number | null> {
  const url = `${API}?product_code=${encodeURIComponent(code)}&currency=EUR&size=20`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (res.ok) {
        const data = (await res.json()) as {
          items?: Array<{ price?: number; currency?: string }>;
        };
        const prices = (data.items ?? [])
          .filter((i) => i.currency === 'EUR' && typeof i.price === 'number')
          .map((i) => i.price as number)
          .filter((p) => p > 0 && p < 100);
        if (prices.length === 0) return null;
        return +median(prices).toFixed(2);
      }
    } catch {
      // retried below
    }
    await sleep(800 * (attempt + 1));
  }
  return null;
}

async function main() {
  const snapshot = JSON.parse(
    readFileSync(SNAPSHOT, 'utf8'),
  ) as CatalogSnapshot;

  let fetched = 0;
  let priced = 0;
  for (const [term, products] of Object.entries(snapshot)) {
    for (const p of products) {
      if (p.pricePerPack !== undefined) continue; // resumable: skip already-priced products
      const price = await fetchEurPrice(p.externalId);
      fetched++;
      if (price !== null) {
        p.pricePerPack = price;
        priced++;
      }
      await sleep(250);
      if (fetched % 10 === 0) {
        writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2) + '\n');
        process.stdout.write(`  fetched ${fetched}, priced ${priced}\r`);
      }
    }
    console.log(`\n${term}: done`);
  }

  writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(`\nFetched ${fetched} products, ${priced} got a EUR price.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
