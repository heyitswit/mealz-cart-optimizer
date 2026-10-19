// Minimal contract the MCP tools need from Mealz; trailing comments give the Mealz API field each one maps to.

// Same shape as ComparableProduct in Mealz's public SDK: quantity > 0 adds, < 0 removes.
export interface ComparableProduct {
  id: string;
  quantity: number;
  additionalInfos?: Record<string, unknown>;
}

export interface PointOfSale {
  externalId: string; // pos ext-id, as passed to pos.load()
  name?: string;
}

export interface MealzRecipe {
  id: string;
  title: string;
  servings: number; // number-of-guests
  preparationTime?: number; // preparation-time
  ingredients: MealzRecipeIngredient[];
}

export interface MealzRecipeIngredient {
  key: string;
  label: string;
  neededAmount: number;
  neededUnit: string;
  products: MatchedProduct[]; // ranked best first, like basket-entries-items; empty when nothing matches
}

export interface MatchedProduct {
  externalId: string; // item ext-id
  name: string;
  packAmount: number; // capacity-volume
  packUnit: string; // capacity-unit
  pricePerPack?: number; // unit-price
  available: boolean; // basket entry status is not unavailable / out_of_stock
}

export interface MealzSource {
  listRecipes(pos: PointOfSale, query?: RecipeQuery): Promise<MealzRecipe[]>;
  getRecipe(pos: PointOfSale, recipeId: string): Promise<MealzRecipe | null>;

  findAlternatives(
    pos: PointOfSale,
    ingredientKey: string,
    excludeExternalId: string,
  ): Promise<MatchedProduct[]>;

  // Average grams per piece, to compare recipes counting pieces with products sold by weight.
  pieceWeightG(ingredientKey: string): number | undefined;
}

export interface RecipeQuery {
  text?: string;
  limit?: number;
}
