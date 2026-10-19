// Builds the product snapshot from Open Food Facts categories (ODbL). Run: pnpm tsx scripts/fetchProducts.ts
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CatalogSnapshot,
  OpenFoodFactsClient,
} from '../src/catalog/openFoodFacts';
import { INGREDIENT_PROFILES } from '../src/matching/ingredientProfiles';

const here = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = join(here, '../src/catalog/fixtures/off-products.json');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= 3) throw e;
      await sleep(2000 * (attempt + 1));
    }
  }
}

async function main() {
  const client = new OpenFoodFactsClient();
  const snapshot: CatalogSnapshot = {};

  for (const profile of Object.values(INGREDIENT_PROFILES)) {
    const byCode = new Map<string, CatalogSnapshot[string][number]>();
    for (const category of profile.offCategories) {
      for (const p of await withRetry(() => client.searchCategory(category))) {
        if (!byCode.has(p.externalId)) byCode.set(p.externalId, p);
      }
      await sleep(1000);
    }
    snapshot[profile.key] = [...byCode.values()];
    console.log(`${profile.key}: ${byCode.size} products`);
  }

  writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(`Wrote ${SNAPSHOT}. Next: pnpm tsx scripts/enrichPrices.ts`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
