import {
  BasketLine,
  BasketResult,
  PieceWeights,
  Product,
  Quantity,
  Recipe,
  Unit,
} from '../domain/types';
import {
  BASE_UNIT,
  Dimension,
  baseUnitOf,
  convertAcrossDimension,
  dimensionOf,
  toBase,
} from './units';

export interface OptimizeOptions {
  // Euros charged per full pack of leftover: higher trades cost for less waste.
  wastePenalty?: number;
  pieceWeights?: PieceWeights;
}

const DEFAULT_WASTE_PENALTY = 1.0;

export interface Demand {
  ingredientKey: string;
  // Summed per dimension, in base units, so the result never depends on recipe order.
  totals: Partial<Record<Dimension, number>>;
  usedBy: string[];
}

export function aggregateDemand(recipes: Recipe[]): Map<string, Demand> {
  const demand = new Map<string, Demand>();

  for (const recipe of recipes) {
    for (const ing of recipe.ingredients) {
      let d = demand.get(ing.key);
      if (!d) {
        d = { ingredientKey: ing.key, totals: {}, usedBy: [] };
        demand.set(ing.key, d);
      }
      const dim = dimensionOf(ing.needed.unit);
      d.totals[dim] = (d.totals[dim] ?? 0) + toBase(ing.needed);
      if (!d.usedBy.includes(recipe.title)) d.usedBy.push(recipe.title);
    }
  }

  return demand;
}

// Express the whole demand in the given unit's dimension; parts with no bridge come back as `uncovered`.
export function demandIn(
  d: Demand,
  unit: Unit,
  pieceWeights: PieceWeights,
): { need: Quantity; uncovered: Quantity[] } {
  const target = BASE_UNIT[dimensionOf(unit)];
  let amount = 0;
  const uncovered: Quantity[] = [];
  for (const [dim, base] of Object.entries(d.totals) as [Dimension, number][]) {
    const part: Quantity = { amount: base, unit: BASE_UNIT[dim] };
    const bridged = convertAcrossDimension(
      part,
      target,
      d.ingredientKey,
      pieceWeights,
    );
    if (bridged) amount += toBase(bridged);
    else uncovered.push(part);
  }
  return { need: { amount, unit: target }, uncovered };
}

// `need` must already be in the product's dimension.
export function coverWith(
  product: Product,
  need: Quantity,
): { packs: number; provided: Quantity; leftover: number; cost?: number } {
  const requiredBase = toBase(need);
  const packBase = toBase(product.packSize);
  const packs = Math.max(1, Math.ceil(requiredBase / packBase));
  const providedBase = packs * packBase;
  return {
    packs,
    provided: { amount: providedBase, unit: baseUnitOf(need.unit) },
    leftover: providedBase - requiredBase,
    cost:
      product.pricePerPack !== undefined
        ? +(product.pricePerPack * packs).toFixed(2)
        : undefined,
  };
}

// score = price of packs + wastePenalty × unused fraction of the last pack.
function scoreCandidate(
  product: Product,
  cover: { leftover: number; cost?: number },
  wastePenalty: number,
): number {
  const packBase = toBase(product.packSize);
  const leftoverFraction = packBase > 0 ? cover.leftover / packBase : 0;
  return (cover.cost ?? 0) + wastePenalty * leftoverFraction;
}

function formatQuantity(q: Quantity): string {
  return `${+q.amount.toFixed(1)} ${q.unit}`;
}

// Ingredients are independent once aggregated; per ingredient this is optimal among single-product baskets (no 500 g + 250 g mixes).
export function optimizeBasket(
  recipes: Recipe[],
  productsByIngredient: Map<string, Product[]>,
  options: OptimizeOptions = {},
): BasketResult {
  const wastePenalty = options.wastePenalty ?? DEFAULT_WASTE_PENALTY;
  const pieceWeights = options.pieceWeights ?? {};
  const demand = aggregateDemand(recipes);

  const lines: BasketLine[] = [];
  const unmatched: string[] = [];
  const warnings: string[] = [];

  for (const [key, d] of demand) {
    const candidates = (productsByIngredient.get(key) ?? [])
      .map((product) => ({
        product,
        ...demandIn(d, product.packSize.unit, pieceWeights),
      }))
      .filter((c) => c.need.amount > 0);

    if (candidates.length === 0) {
      unmatched.push(key);
      continue;
    }

    // Prefer products covering every part of the demand, then priced ones: an unknown price must not look free.
    const fewestUncovered = Math.min(
      ...candidates.map((c) => c.uncovered.length),
    );
    let pool = candidates.filter((c) => c.uncovered.length === fewestUncovered);
    if (pool.some((c) => c.product.pricePerPack !== undefined)) {
      pool = pool.filter((c) => c.product.pricePerPack !== undefined);
    }

    const best = pool
      .map((c) => {
        const cover = coverWith(c.product, c.need);
        return {
          ...c,
          cover,
          score: scoreCandidate(c.product, cover, wastePenalty),
        };
      })
      .reduce((a, b) => (b.score < a.score ? b : a));

    lines.push({
      product: best.product,
      packs: best.cover.packs,
      provided: best.cover.provided,
      required: best.need,
      leftover: best.cover.leftover,
      cost: best.cover.cost,
      usedBy: d.usedBy,
    });
    for (const part of best.uncovered) {
      warnings.push(
        `${key}: ${formatQuantity(part)} left out, no conversion to ${best.need.unit}`,
      );
    }
  }

  // Totals cover priced lines only; linesWithoutPrice tells the caller the total is partial.
  const pricedLines = lines.filter((l) => l.cost !== undefined);
  const linesWithoutPrice = lines.length - pricedLines.length;

  const totalCost =
    pricedLines.length > 0
      ? +pricedLines.reduce((sum, l) => sum + (l.cost ?? 0), 0).toFixed(2)
      : undefined;

  const wasteCost =
    pricedLines.length > 0
      ? +pricedLines
          .reduce((sum, l) => {
            const packBase = toBase(l.product.packSize);
            const perBase =
              l.product.pricePerPack !== undefined && packBase > 0
                ? l.product.pricePerPack / packBase
                : 0;
            return sum + perBase * l.leftover;
          }, 0)
          .toFixed(2)
      : undefined;

  return {
    lines,
    totalCost,
    wasteCost,
    unmatched,
    linesWithoutPrice,
    warnings,
  };
}
