import { describe, it, expect, beforeAll } from 'vitest';
import { FakeMealzSource } from '../src/mealz/FakeMealzSource';
import {
  handleComposeMenu,
  handleOptimizeWeekBasket,
  handleSuggestSubstitute,
} from '../src/mcp/handlers';

const pos = { externalId: 'pos-1', name: 'Test drive' };

const catalog = {
  butter: [
    {
      externalId: 'butter-250',
      name: 'Beurre doux 250g',
      packAmount: 250,
      packUnit: 'g',
      categoriesTags: ['en:butters'],
      pricePerPack: 2.0,
    },
    {
      externalId: 'butter-500',
      name: 'Beurre doux 500g',
      packAmount: 500,
      packUnit: 'g',
      categoriesTags: ['en:butters'],
      pricePerPack: 3.2,
    },
  ],
  onion: [
    {
      externalId: 'onion-1kg',
      name: 'Oignons 1kg',
      packAmount: 1000,
      packUnit: 'g',
      categoriesTags: ['en:onions'],
      pricePerPack: 1.5,
    },
  ],
};

const recipes = [
  {
    id: 'r1',
    title: 'Recette A',
    servings: 2,
    sourceUrl: 'https://example.org/a',
    ingredients: [
      {
        key: 'butter',
        label: 'beurre',
        amount: 300,
        unit: 'g',
        amountUncertain: false,
      },
      {
        key: 'onion',
        label: 'oignon',
        amount: 2,
        unit: 'piece',
        amountUncertain: false,
      },
    ],
  },
  {
    id: 'r2',
    title: 'Recette B',
    servings: 2,
    sourceUrl: 'https://example.org/b',
    ingredients: [
      {
        key: 'butter',
        label: 'beurre',
        amount: 100,
        unit: 'g',
        amountUncertain: false,
      },
    ],
  },
];

let source: FakeMealzSource;
beforeAll(() => {
  source = new FakeMealzSource(recipes, catalog, { unavailableEvery: 10_000 });
});

describe('handleComposeMenu', () => {
  it('lists recipes available at the POS', async () => {
    const out = await handleComposeMenu(source, {
      pos,
      mealsCount: 5,
    });
    expect(out.recipes.map((r) => r.id)).toEqual(['r1', 'r2']);
  });

  it('respects the mealsCount limit', async () => {
    const out = await handleComposeMenu(source, {
      pos,
      mealsCount: 1,
    });
    expect(out.recipes).toHaveLength(1);
  });
});

describe('handleOptimizeWeekBasket', () => {
  it('mutualizes butter across both recipes', async () => {
    const out = await handleOptimizeWeekBasket(source, {
      pos,
      recipeIds: ['r1', 'r2'],
    });
    const butterLine = out.lines.find((l) => l.productName.includes('Beurre'))!;
    expect(butterLine.usedBy).toEqual(['Recette A', 'Recette B']);
    expect(butterLine.requiredAmount).toBe(400);
  });

  it('returns a cart delta in ComparableProduct shape', async () => {
    const out = await handleOptimizeWeekBasket(source, {
      pos,
      recipeIds: ['r1'],
    });
    for (const d of out.cartDelta) {
      expect(typeof d.id).toBe('string');
      expect(typeof d.quantity).toBe('number');
    }
  });

  it('computes a total cost from known prices', async () => {
    const out = await handleOptimizeWeekBasket(source, {
      pos,
      recipeIds: ['r1', 'r2'],
    });
    expect(out.totalCost).toBeGreaterThan(0);
    expect(out.linesWithoutPrice).toBe(0);
  });
});

describe('handleOptimizeWeekBasket — reporting', () => {
  it('picks the pack size that wastes least across both recipes', async () => {
    const out = await handleOptimizeWeekBasket(source, {
      pos,
      recipeIds: ['r1', 'r2'],
    });
    const butter = out.lines.find((l) => l.ingredientKey === 'butter')!;
    expect(butter.productExternalId).toBe('butter-500');
    expect(butter.packs).toBe(1);
  });

  it('scales quantities to the requested servings', async () => {
    const out = await handleOptimizeWeekBasket(source, {
      pos,
      recipeIds: ['r2'],
      servings: 4,
    });
    expect(out.lines[0]!.requiredAmount).toBe(200);
  });

  it('reports unknown recipe ids instead of ignoring them', async () => {
    const out = await handleOptimizeWeekBasket(source, {
      pos,
      recipeIds: ['r1', 'nope'],
    });
    expect(out.unknownRecipeIds).toEqual(['nope']);
  });

  it('reports an ingredient with no matching product as unmatched', async () => {
    const withSaffron = new FakeMealzSource(
      [
        {
          ...recipes[1]!,
          id: 'r3',
          ingredients: [
            {
              key: 'saffron',
              label: 'safran',
              amount: 1,
              unit: 'g',
              amountUncertain: false,
            },
          ],
        },
      ],
      catalog,
      { unavailableEvery: 10_000 },
    );
    const out = await handleOptimizeWeekBasket(withSaffron, {
      pos,
      recipeIds: ['r3'],
    });
    expect(out.unmatched).toEqual(['saffron']);
  });

  it('flags an ingredient whose products are all out of stock', async () => {
    const allOut = new FakeMealzSource(recipes, catalog, {
      unavailableEvery: 1,
    });
    const out = await handleOptimizeWeekBasket(allOut, {
      pos,
      recipeIds: ['r1'],
    });
    expect(out.unavailable.sort()).toEqual(['butter', 'onion']);
    expect(out.cartDelta).toEqual([]);
  });
});

describe('handleSuggestSubstitute', () => {
  it('offers an alternative butter, excluding the unavailable one', async () => {
    const out = await handleSuggestSubstitute(source, {
      pos,
      ingredientKey: 'butter',
      unavailableExternalId: 'butter-250',
    });
    const ids = out.alternatives.map((a) => a.externalId);
    expect(ids).toContain('butter-500');
    expect(ids).not.toContain('butter-250');
  });

  it('ranks alternatives by the cost of covering a required quantity', async () => {
    const out = await handleSuggestSubstitute(source, {
      pos,
      ingredientKey: 'butter',
      unavailableExternalId: 'none',
      required: { amount: 400, unit: 'g' },
    });
    expect(out.alternatives[0]!.externalId).toBe('butter-500');
    expect(out.alternatives[0]!.cost).toBe(3.2);
  });

  it('explains an empty result for an unknown ingredient', async () => {
    const out = await handleSuggestSubstitute(source, {
      pos,
      ingredientKey: 'beurre',
      unavailableExternalId: 'x',
    });
    expect(out.alternatives).toEqual([]);
    expect(out.note).toContain('beurre');
  });
});
