import {
  MealzSource,
  MealzRecipe,
  MatchedProduct,
  PointOfSale,
  RecipeQuery,
} from './MealzSource';
import { CatalogProduct, CatalogSnapshot } from '../catalog/openFoodFacts';
import { INGREDIENT_PROFILES, normalize } from '../matching/ingredientProfiles';
import { rankCandidates } from '../matching/matchProduct';

export interface FixtureRecipe {
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

export interface FakeMealzOptions {
  unavailableEvery?: number;
}

export class FakeMealzSource implements MealzSource {
  private readonly recipes: FixtureRecipe[];
  private readonly unavailableEvery: number;
  private readonly ranked = new Map<
    string,
    Array<CatalogProduct & { score: number }>
  >();

  constructor(
    recipes: FixtureRecipe[],
    catalog: CatalogSnapshot,
    options: FakeMealzOptions = {},
  ) {
    this.recipes = recipes;
    this.unavailableEvery = options.unavailableEvery ?? 7;

    for (const profile of Object.values(INGREDIENT_PROFILES)) {
      const products = catalog[profile.key] ?? [];
      const byId = new Map(products.map((p) => [p.externalId, p]));
      const ranked = rankCandidates(
        products.map((p) => ({ ...p, hasPrice: p.pricePerPack !== undefined })),
        profile,
      );
      this.ranked.set(
        profile.key,
        ranked.map((r) => ({ ...byId.get(r.externalId)!, score: r.score })),
      );
    }
  }

  // Deterministic hash so ~1 in N products is unavailable, to exercise substitution.
  private isAvailable(externalId: string): boolean {
    let hash = 0;
    for (const ch of externalId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return hash % this.unavailableEvery !== 0;
  }

  private toMatched(p: CatalogProduct): MatchedProduct {
    return {
      externalId: p.externalId,
      name: p.name,
      packAmount: p.packAmount,
      packUnit: p.packUnit,
      pricePerPack: p.pricePerPack,
      available: this.isAvailable(p.externalId),
    };
  }

  // Only the best-scoring tier is offered, so the optimizer arbitrates between equally good matches.
  private productsFor(ingredientKey: string): MatchedProduct[] {
    const ranked = this.ranked.get(ingredientKey) ?? [];
    const top = ranked[0]?.score;
    return ranked.filter((r) => r.score === top).map((r) => this.toMatched(r));
  }

  private toMealzRecipe(fixture: FixtureRecipe): MealzRecipe {
    return {
      id: fixture.id,
      title: fixture.title,
      servings: fixture.servings,
      ingredients: fixture.ingredients.map((ing) => ({
        key: ing.key,
        label: ing.label,
        neededAmount: ing.amount,
        neededUnit: ing.unit,
        products: this.productsFor(ing.key),
      })),
    };
  }

  async listRecipes(
    _pos: PointOfSale,
    query: RecipeQuery = {},
  ): Promise<MealzRecipe[]> {
    let recipes = this.recipes.map((r) => this.toMealzRecipe(r));

    if (query.text) {
      const q = normalize(query.text);
      recipes = recipes.filter(
        (r) =>
          normalize(r.title).includes(q) ||
          r.ingredients.some((i) => normalize(i.label).includes(q)),
      );
    }
    if (query.limit) recipes = recipes.slice(0, query.limit);
    return recipes;
  }

  async getRecipe(
    _pos: PointOfSale,
    recipeId: string,
  ): Promise<MealzRecipe | null> {
    const fixture = this.recipes.find((r) => r.id === recipeId);
    return fixture ? this.toMealzRecipe(fixture) : null;
  }

  pieceWeightG(ingredientKey: string): number | undefined {
    return INGREDIENT_PROFILES[ingredientKey]?.pieceWeightG;
  }

  async findAlternatives(
    _pos: PointOfSale,
    ingredientKey: string,
    excludeExternalId: string,
  ): Promise<MatchedProduct[]> {
    return (this.ranked.get(ingredientKey) ?? [])
      .filter((p) => p.externalId !== excludeExternalId)
      .map((p) => this.toMatched(p))
      .filter((p) => p.available);
  }
}
