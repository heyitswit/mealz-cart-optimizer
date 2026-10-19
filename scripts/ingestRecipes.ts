// Builds the recipe fixture from Wikibooks (CC BY-SA). Run: pnpm tsx scripts/ingestRecipes.ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { parseWikibooksRecipe } from '../src/recipes/parseWikibooks';
import { resolveIngredientKey } from '../src/matching/ingredientProfiles';

const API = 'https://fr.wikibooks.org/w/api.php';
const USER_AGENT =
  'mealz-cart-optimizer/0.1 (portfolio project; contact via github)';

const CATEGORIES = [
  'Catégorie:Recettes de cuisine à base de spaghetti',
  'Catégorie:Recettes de cuisine à base de lard fumé',
  'Catégorie:Recettes de cuisine à base de fromage',
  'Catégorie:Recettes de cuisine à base de beurre',
  "Catégorie:Recettes de cuisine à base d'œuf",
  'Catégorie:Recettes de cuisine à base de farine',
  'Catégorie:Recettes de cuisine à base de lait',
  "Catégorie:Recettes de cuisine à base d'oignon",
  'Catégorie:Recettes de cuisine à base de tomate',
  'Catégorie:Recettes de cuisine à base de carotte',
  'Catégorie:Recettes de cuisine à base de pomme de terre',
];

const MIN_MATCHED = 3;
const MAX_RECIPES = 15;
const MAX_CANDIDATES = 120;
const BATCH = 2;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Milk and cream are sold by volume; everything else is a mass or a count.
const VOLUME_INGREDIENTS = new Set(['milk', 'cream']);

function isPlausibleUnit(key: string, unit: string, amount: number): boolean {
  if (VOLUME_INGREDIENTS.has(key)) return unit === 'ml';
  if (unit === 'ml') return false;
  if (unit === 'piece') return Number.isInteger(amount);
  return true;
}

async function apiGet(params: Record<string, string>): Promise<any> {
  const url = `${API}?${new URLSearchParams({ ...params, format: 'json' })}`;
  let status = 'network error';
  for (let attempt = 0; attempt < 5; attempt++) {
    let wait = 2000 * (attempt + 1);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (res.ok) return await res.json();
      status = `HTTP ${res.status}`;
      wait = Math.max(wait, Number(res.headers.get('retry-after') ?? 0) * 1000);
    } catch {
      // retried below
    }
    await sleep(wait);
  }
  throw new Error(
    `MediaWiki API failed (${status}): ${JSON.stringify(params)}`,
  );
}

async function listCategory(cat: string): Promise<string[]> {
  const data = await apiGet({
    action: 'query',
    list: 'categorymembers',
    cmtitle: cat,
    cmlimit: '40',
    cmtype: 'page',
  });
  return (data.query?.categorymembers ?? []).map((m: any) => m.title);
}

async function fetchWikitext(title: string): Promise<string> {
  const data = await apiGet({
    action: 'parse',
    page: title,
    prop: 'wikitext',
  });
  return data.parse?.wikitext?.['*'] ?? '';
}

interface IngestedRecipe {
  id: string;
  title: string;
  servings: number;
  sourceUrl: string;
  ingredients: Array<{
    key: string;
    label: string;
    amount: number;
    unit: string;
    amountUncertain: boolean;
  }>;
}

async function main() {
  const seen = new Set<string>();
  const titles: string[] = [];
  for (const cat of CATEGORIES) {
    try {
      for (const t of await listCategory(cat)) {
        if (!seen.has(t)) {
          seen.add(t);
          titles.push(t);
        }
      }
    } catch (e) {
      console.warn('skip category', cat, (e as Error).message);
    }
    await sleep(600);
  }
  const candidates = titles.slice(0, MAX_CANDIDATES);
  console.log(
    `Collected ${titles.length} pages; processing ${candidates.length} candidates`,
  );

  const kept: IngestedRecipe[] = [];
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (title) => {
        try {
          const wikitext = await fetchWikitext(title);
          return { title, wikitext };
        } catch (e) {
          console.warn('\nskip page', (e as Error).message);
          return null;
        }
      }),
    );

    for (const r of results) {
      if (!r) continue;
      const parsed = parseWikibooksRecipe(r.title, r.wikitext);
      const resolved = parsed.ingredients
        .map((ing) => {
          const key = resolveIngredientKey(ing.rawLabel, ing.text);
          return key
            ? {
                key,
                label: ing.rawLabel,
                amount: ing.amount,
                unit: ing.unit,
                amountUncertain: ing.amountUncertain,
              }
            : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        // Drop lines the parser read with an implausible unit, so the demo basket stays clean.
        .filter((x) => isPlausibleUnit(x.key, x.unit, x.amount));

      const byKey = new Map<string, (typeof resolved)[number]>();
      for (const x of resolved) if (!byKey.has(x.key)) byKey.set(x.key, x);
      const unique = [...byKey.values()];
      if (unique.length < MIN_MATCHED) continue;

      // Sub-pages of unrelated books show up in categories; skip them.
      const cleanTitle = parsed.title;
      if (cleanTitle.includes('/')) continue;

      kept.push({
        id: r.title
          .replace(/^Livre de cuisine\//, '')
          .replace(/\s+/g, '-')
          .toLowerCase(),
        title: cleanTitle,
        servings: parsed.servings,
        sourceUrl: `https://fr.wikibooks.org/wiki/${encodeURIComponent(r.title)}`,
        ingredients: unique,
      });
    }
    process.stdout.write(
      `  …${Math.min(i + BATCH, candidates.length)}/${candidates.length}\r`,
    );
    await sleep(400);
  }

  kept.sort((a, b) => b.ingredients.length - a.ingredients.length);
  const recipes = kept.slice(0, MAX_RECIPES);
  console.log('\nKept recipes (richest first):');
  for (const r of recipes) {
    console.log(
      `  ${r.ingredients.length}  ${r.title}  [${r.ingredients.map((i) => i.key).join(', ')}]`,
    );
  }

  mkdirSync('src/recipes/fixtures', { recursive: true });
  writeFileSync(
    'src/recipes/fixtures/recipes.json',
    JSON.stringify(recipes, null, 2),
  );
  console.log(
    `\nWrote ${recipes.length} recipes to src/recipes/fixtures/recipes.json`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
