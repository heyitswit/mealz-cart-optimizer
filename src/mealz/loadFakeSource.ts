import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FakeMealzSource, FixtureRecipe } from './FakeMealzSource';
import { CatalogSnapshot } from '../catalog/openFoodFacts';

export function loadFakeSource(): FakeMealzSource {
  const here = dirname(fileURLToPath(import.meta.url));
  const recipesPath = join(here, '../recipes/fixtures/recipes.json');
  const catalogPath = join(here, '../catalog/fixtures/off-products.json');

  const recipes = JSON.parse(
    readFileSync(recipesPath, 'utf8'),
  ) as FixtureRecipe[];
  const catalog = JSON.parse(
    readFileSync(catalogPath, 'utf8'),
  ) as CatalogSnapshot;

  return new FakeMealzSource(recipes, catalog);
}
