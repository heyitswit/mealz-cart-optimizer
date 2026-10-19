import { MealzSource, MealzRecipe, MatchedProduct } from '../mealz/MealzSource';
import { PieceWeights, Product, Recipe, Unit } from '../domain/types';
import { coverWith, optimizeBasket } from '../optimizer/optimizeBasket';
import { convertAcrossDimension } from '../optimizer/units';
import {
  ComposeMenuInputT,
  ComposeMenuOutputT,
  OptimizeWeekBasketInputT,
  OptimizeWeekBasketOutputT,
  SuggestSubstituteInputT,
  SuggestSubstituteOutputT,
} from './toolSchemas';

function toUnit(u: string): Unit {
  if (u === 'g' || u === 'kg' || u === 'ml' || u === 'l' || u === 'piece') {
    return u;
  }
  // Unknown units fall back to piece; the optimizer warns if it can't convert them.
  return 'piece';
}

function toProduct(ingredientKey: string, m: MatchedProduct): Product {
  return {
    id: m.externalId,
    name: m.name,
    ingredientKey,
    packSize: { amount: m.packAmount, unit: toUnit(m.packUnit) },
    pricePerPack: m.pricePerPack,
  };
}

function pieceWeightsFor(
  source: MealzSource,
  keys: Iterable<string>,
): PieceWeights {
  const weights: PieceWeights = {};
  for (const key of keys) {
    const w = source.pieceWeightG(key);
    if (w !== undefined) weights[key] = w;
  }
  return weights;
}

function toOptimizerInputs(
  mealzRecipes: MealzRecipe[],
  servings: number | undefined,
): {
  recipes: Recipe[];
  productsByIngredient: Map<string, Product[]>;
  unavailable: string[];
} {
  const recipes: Recipe[] = [];
  const productsByIngredient = new Map<string, Product[]>();
  const outOfStock = new Set<string>();

  for (const mr of mealzRecipes) {
    const scale = servings ? servings / mr.servings : 1;
    recipes.push({
      id: mr.id,
      title: mr.title,
      servings: servings ?? mr.servings,
      ingredients: mr.ingredients.map((ing) => ({
        key: ing.key,
        label: ing.label,
        needed: {
          amount: ing.neededAmount * scale,
          unit: toUnit(ing.neededUnit),
        },
      })),
    });

    for (const ing of mr.ingredients) {
      const list = productsByIngredient.get(ing.key) ?? [];
      for (const m of ing.products) {
        if (m.available && !list.some((p) => p.id === m.externalId)) {
          list.push(toProduct(ing.key, m));
        }
      }
      productsByIngredient.set(ing.key, list);
      if (ing.products.length > 0 && !ing.products.some((m) => m.available)) {
        outOfStock.add(ing.key);
      }
    }
  }

  // An ingredient is out of stock only if no recipe brought an available product for it.
  const unavailable = [...outOfStock].filter(
    (key) => (productsByIngredient.get(key) ?? []).length === 0,
  );
  return { recipes, productsByIngredient, unavailable };
}

export async function handleComposeMenu(
  source: MealzSource,
  input: ComposeMenuInputT,
): Promise<ComposeMenuOutputT> {
  const recipes = await source.listRecipes(input.pos, {
    text: input.search,
    limit: input.mealsCount,
  });

  return {
    recipes: recipes.map((r) => ({
      id: r.id,
      title: r.title,
      servings: r.servings,
      preparationTime: r.preparationTime,
      ingredients: r.ingredients.map((i) => i.label),
    })),
  };
}

export async function handleOptimizeWeekBasket(
  source: MealzSource,
  input: OptimizeWeekBasketInputT,
): Promise<OptimizeWeekBasketOutputT> {
  const mealzRecipes: MealzRecipe[] = [];
  const unknownRecipeIds: string[] = [];
  for (const id of input.recipeIds) {
    const r = await source.getRecipe(input.pos, id);
    if (r) mealzRecipes.push(r);
    else unknownRecipeIds.push(id);
  }

  const { recipes, productsByIngredient, unavailable } = toOptimizerInputs(
    mealzRecipes,
    input.servings,
  );
  const result = optimizeBasket(recipes, productsByIngredient, {
    wastePenalty: input.wastePenalty,
    pieceWeights: pieceWeightsFor(source, productsByIngredient.keys()),
  });

  const lines = result.lines.map((l) => ({
    ingredientKey: l.product.ingredientKey,
    productExternalId: l.product.id,
    productName: l.product.name,
    packSize: `${l.product.packSize.amount} ${l.product.packSize.unit}`,
    packs: l.packs,
    requiredAmount: +l.required.amount.toFixed(1),
    providedAmount: +l.provided.amount.toFixed(1),
    unit: l.provided.unit,
    leftover: +l.leftover.toFixed(1),
    cost: l.cost,
    usedBy: l.usedBy,
  }));

  // Cart delta in Mealz's ComparableProduct shape, ready for basketSync.
  const cartDelta = result.lines.map((l) => ({
    id: l.product.id,
    quantity: l.packs,
    additionalInfos: { ingredientKey: l.product.ingredientKey },
  }));

  return {
    lines,
    totalCost: result.totalCost,
    wasteCost: result.wasteCost,
    linesWithoutPrice: result.linesWithoutPrice,
    unmatched: result.unmatched.filter((k) => !unavailable.includes(k)),
    unavailable,
    warnings: result.warnings,
    unknownRecipeIds,
    cartDelta,
  };
}

export async function handleSuggestSubstitute(
  source: MealzSource,
  input: SuggestSubstituteInputT,
): Promise<SuggestSubstituteOutputT> {
  const found = await source.findAlternatives(
    input.pos,
    input.ingredientKey,
    input.unavailableExternalId,
  );
  if (found.length === 0) {
    return {
      alternatives: [],
      note: `No available product for ingredient "${input.ingredientKey}" at this point of sale.`,
    };
  }

  const required = input.required;
  type Alternative = SuggestSubstituteOutputT['alternatives'][number];
  const alternatives = found.map((a): Alternative => {
    const base = {
      externalId: a.externalId,
      name: a.name,
      packAmount: a.packAmount,
      packUnit: a.packUnit,
      pricePerPack: a.pricePerPack,
    };
    const pack = `${a.packAmount} ${a.packUnit}`;
    if (!required) {
      return {
        ...base,
        rationale: `same ingredient, available here, pack ${pack}`,
      };
    }
    const product = toProduct(input.ingredientKey, a);
    const need = convertAcrossDimension(
      required,
      product.packSize.unit,
      input.ingredientKey,
      pieceWeightsFor(source, [input.ingredientKey]),
    );
    if (!need) {
      return {
        ...base,
        rationale: `pack ${pack} cannot be compared to ${required.amount} ${required.unit}`,
      };
    }
    const cover = coverWith(product, need);
    const price =
      cover.cost !== undefined
        ? `, ${cover.cost.toFixed(2)} €`
        : ', price unknown';
    return {
      ...base,
      packs: cover.packs,
      cost: cover.cost,
      rationale: `${cover.packs} × ${pack} covers ${required.amount} ${required.unit}${price}`,
    };
  });

  // With a required quantity, rank by covering cost (priced first); otherwise keep match order.
  if (required) {
    const group = (a: Alternative) =>
      a.cost !== undefined ? 0 : a.packs !== undefined ? 1 : 2;
    alternatives.sort(
      (a, b) => group(a) - group(b) || (a.cost ?? 0) - (b.cost ?? 0),
    );
  }

  return { alternatives: alternatives.slice(0, 5) };
}
