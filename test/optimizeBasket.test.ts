import { describe, it, expect } from 'vitest';
import {
  optimizeBasket,
  aggregateDemand,
} from '../src/optimizer/optimizeBasket';
import { Product, Recipe } from '../src/domain/types';

const onionProduct: Product = {
  id: 'onion-1kg',
  name: 'Oignons jaunes 1 kg',
  ingredientKey: 'onion',
  packSize: { amount: 1, unit: 'kg' },
  pricePerPack: 1.5,
};

const butter250: Product = {
  id: 'butter-250g',
  name: 'Beurre doux 250 g',
  ingredientKey: 'butter',
  packSize: { amount: 250, unit: 'g' },
  pricePerPack: 2.0,
};

const butter500: Product = {
  id: 'butter-500g',
  name: 'Beurre doux 500 g',
  ingredientKey: 'butter',
  packSize: { amount: 500, unit: 'g' },
  pricePerPack: 3.2,
};

function recipe(
  id: string,
  title: string,
  ings: Recipe['ingredients'],
): Recipe {
  return { id, title, servings: 2, ingredients: ings };
}

describe('aggregateDemand — mutualization', () => {
  it('sums the same ingredient across several recipes', () => {
    const recipes = [
      recipe('r1', 'Soupe', [
        { key: 'onion', label: 'oignon', needed: { amount: 2, unit: 'piece' } },
      ]),
      recipe('r2', 'Tarte', [
        { key: 'onion', label: 'oignon', needed: { amount: 3, unit: 'piece' } },
      ]),
    ];
    const demand = aggregateDemand(recipes);
    expect(demand.get('onion')?.totals.count).toBe(5);
    expect(demand.get('onion')?.usedBy).toEqual(['Soupe', 'Tarte']);
  });

  it('converts units when aggregating (kg + g)', () => {
    const recipes = [
      recipe('r1', 'A', [
        { key: 'butter', label: 'beurre', needed: { amount: 0.2, unit: 'kg' } },
      ]),
      recipe('r2', 'B', [
        { key: 'butter', label: 'beurre', needed: { amount: 100, unit: 'g' } },
      ]),
    ];
    const demand = aggregateDemand(recipes);
    expect(demand.get('butter')?.totals.mass).toBe(300);
  });
});

describe('optimizeBasket — pack coverage', () => {
  it('buys enough packs to cover demand, never fewer', () => {
    const recipes = [
      recipe('r1', 'Gratin', [
        { key: 'butter', label: 'beurre', needed: { amount: 300, unit: 'g' } },
      ]),
    ];
    const byIngredient = new Map<string, Product[]>([['butter', [butter250]]]);
    const result = optimizeBasket(recipes, byIngredient);
    const line = result.lines.find(
      (l) => l.product.ingredientKey === 'butter',
    )!;
    expect(line.packs).toBe(2);
    expect(line.leftover).toBe(200);
    expect(line.cost).toBe(4.0);
  });

  it('always buys at least one pack even for a tiny need', () => {
    const recipes = [
      recipe('r1', 'Noisette', [
        { key: 'butter', label: 'beurre', needed: { amount: 10, unit: 'g' } },
      ]),
    ];
    const byIngredient = new Map<string, Product[]>([['butter', [butter250]]]);
    const result = optimizeBasket(recipes, byIngredient);
    expect(result.lines[0]!.packs).toBe(1);
  });
});

describe('optimizeBasket — choosing between pack sizes (waste vs price)', () => {
  it('prefers the larger pack when it wastes far less for a big need', () => {
    const recipes = [
      recipe('r1', 'Fournée', [
        { key: 'butter', label: 'beurre', needed: { amount: 480, unit: 'g' } },
      ]),
    ];
    // Same 20 g waste either way, but one 500 g pack (3.20 €) beats two 250 g packs (4.00 €).
    const byIngredient = new Map<string, Product[]>([
      ['butter', [butter250, butter500]],
    ]);
    const result = optimizeBasket(recipes, byIngredient);
    expect(result.lines[0]!.product.id).toBe('butter-500g');
  });

  it('prefers the smaller pack when the large one wastes a lot', () => {
    const recipes = [
      recipe('r1', 'Lichette', [
        { key: 'butter', label: 'beurre', needed: { amount: 250, unit: 'g' } },
      ]),
    ];
    const byIngredient = new Map<string, Product[]>([
      ['butter', [butter250, butter500]],
    ]);
    const result = optimizeBasket(recipes, byIngredient);
    expect(result.lines[0]!.product.id).toBe('butter-250g');
    expect(result.lines[0]!.leftover).toBe(0);
  });
});

describe('optimizeBasket — piece/weight bridge', () => {
  it('satisfies a by-the-piece need with a by-weight product', () => {
    const recipes = [
      recipe('r1', 'Soupe', [
        { key: 'onion', label: 'oignon', needed: { amount: 3, unit: 'piece' } },
      ]),
    ];
    const byIngredient = new Map<string, Product[]>([
      ['onion', [onionProduct]],
    ]);
    const result = optimizeBasket(recipes, byIngredient, {
      pieceWeights: { onion: 110 },
    });
    expect(result.unmatched).toHaveLength(0);
    expect(result.lines[0]!.packs).toBe(1);
  });

  it('marks the ingredient unmatched when no piece weight is known', () => {
    const recipes = [
      recipe('r1', 'Soupe', [
        { key: 'onion', label: 'oignon', needed: { amount: 3, unit: 'piece' } },
      ]),
    ];
    const byIngredient = new Map<string, Product[]>([
      ['onion', [onionProduct]],
    ]);
    const result = optimizeBasket(recipes, byIngredient);
    expect(result.unmatched).toContain('onion');
  });
});

describe('optimizeBasket — totals and unmatched', () => {
  it('reports unmatched ingredients instead of inventing a product', () => {
    const recipes = [
      recipe('r1', 'Mystère', [
        { key: 'saffron', label: 'safran', needed: { amount: 1, unit: 'g' } },
      ]),
    ];
    const result = optimizeBasket(recipes, new Map());
    expect(result.unmatched).toContain('saffron');
    expect(result.lines).toHaveLength(0);
  });

  it('computes total and waste cost when all lines are priced', () => {
    const recipes = [
      recipe('r1', 'Plat', [
        { key: 'onion', label: 'oignon', needed: { amount: 3, unit: 'piece' } },
        { key: 'butter', label: 'beurre', needed: { amount: 300, unit: 'g' } },
      ]),
    ];
    const byIngredient = new Map<string, Product[]>([
      ['onion', [onionProduct]],
      ['butter', [butter250]],
    ]);
    const result = optimizeBasket(recipes, byIngredient, {
      pieceWeights: { onion: 110 },
    });
    expect(result.totalCost).toBeDefined();
    expect(result.wasteCost).toBeDefined();
    expect(result.totalCost).toBe(5.5);
  });
});

describe('optimizeBasket — mixed units and missing prices', () => {
  const lasagnes = recipe('r1', 'Lasagnes', [
    { key: 'butter', label: 'beurre', needed: { amount: 1, unit: 'piece' } },
  ]);
  const hachis = recipe('r2', 'Hachis', [
    { key: 'butter', label: 'beurre', needed: { amount: 100, unit: 'g' } },
  ]);
  const byIngredient = new Map<string, Product[]>([['butter', [butter250]]]);

  it('gives the same basket whatever the recipe order', () => {
    const a = optimizeBasket([lasagnes, hachis], byIngredient);
    const b = optimizeBasket([hachis, lasagnes], byIngredient);
    expect(a.lines[0]!.required).toEqual({ amount: 100, unit: 'g' });
    expect(b.lines[0]!.required).toEqual(a.lines[0]!.required);
  });

  it('warns about a quantity it cannot convert instead of dropping it silently', () => {
    const result = optimizeBasket([lasagnes, hachis], byIngredient);
    expect(result.warnings).toEqual([
      'butter: 1 piece left out, no conversion to g',
    ]);
  });

  it('does not treat an unknown price as free', () => {
    const cheapLooking: Product = {
      ...butter500,
      id: 'no-price',
      pricePerPack: undefined,
    };
    const result = optimizeBasket(
      [hachis],
      new Map([['butter', [cheapLooking, butter250]]]),
    );
    expect(result.lines[0]!.product.id).toBe('butter-250g');
  });
});
