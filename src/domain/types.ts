export type Unit = 'g' | 'kg' | 'ml' | 'l' | 'piece';

export interface Quantity {
  amount: number;
  unit: Unit;
}

// Average grams per countable unit, to bridge recipes counting pieces with products sold by weight.
export type PieceWeights = Record<string, number>;

export interface RecipeIngredient {
  key: string;
  label: string;
  needed: Quantity;
}

export interface Recipe {
  id: string;
  title: string;
  servings: number;
  ingredients: RecipeIngredient[];
}

export interface Product {
  id: string;
  name: string;
  ingredientKey: string;
  packSize: Quantity;
  pricePerPack?: number;
}

export interface BasketLine {
  product: Product;
  packs: number;
  provided: Quantity;
  required: Quantity;
  leftover: number;
  cost?: number;
  usedBy: string[];
}

export interface BasketResult {
  lines: BasketLine[];
  totalCost?: number;
  wasteCost?: number;
  unmatched: string[];
  linesWithoutPrice: number;
  warnings: string[];
}
