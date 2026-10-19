import { describe, it, expect } from 'vitest';
import {
  parseServings,
  extractIngredientsSection,
  parseIngredientLine,
  parseWikibooksRecipe,
} from '../src/recipes/parseWikibooks';
import { resolveIngredientKey } from '../src/matching/ingredientProfiles';

const SAMPLE = `{{livre de cuisine}}

Un plat de test.

=== Ingrédients ===
Pour 2 personnes.

* Une {{i|tomate}} fraîche
* Six {{i|N'drowa|n'drowas}}
* Un {{i|'=1|oignon}}
* 1/4 l d'{{i|'=oui|huile}}
* Du sel

=== Préparation ===
* Mélanger.
`;

describe('parseServings', () => {
  it('reads "Pour N personnes"', () => {
    expect(parseServings('bla\nPour 2 personnes.\nbla')).toBe(2);
  });
  it('defaults to 4 when absent', () => {
    expect(parseServings('no servings here')).toBe(4);
  });
});

describe('extractIngredientsSection', () => {
  it('isolates the ingredients block only', () => {
    const section = extractIngredientsSection(SAMPLE);
    expect(section).toContain('tomate');
    expect(section).not.toContain('Mélanger');
  });
});

describe('parseIngredientLine', () => {
  it('reads a worded quantity', () => {
    const r = parseIngredientLine("* Six {{i|N'drowa|n'drowas}}");
    expect(r?.amount).toBe(6);
    expect(r?.rawLabel).toBe("n'drowas");
  });
  it('reads a fraction with a litre unit', () => {
    const r = parseIngredientLine("* 1/4 l d'{{i|'=oui|huile}}");
    expect(r?.unit).toBe('ml');
    expect(r?.amount).toBe(250);
  });
  it('ignores lines with no {{i}} template', () => {
    expect(parseIngredientLine('* Du sel')).toBeNull();
  });
});

describe('parseIngredientLine — real Wikibooks quirks', () => {
  it('reads "1 quart de litre" as 250 ml', () => {
    const r = parseIngredientLine('* {{i|lait|Lait}} (1 quart de litre)');
    expect(r?.amount).toBe(250);
    expect(r?.unit).toBe('ml');
  });
  it('ignores digits inside template arguments', () => {
    const r = parseIngredientLine("* {{i|'=1|oignon}}");
    expect(r?.amountUncertain).toBe(true);
  });
  it('reads a level-2 "== Ingrédients ==" heading', () => {
    const section = extractIngredientsSection(
      '== Ingrédients ==\n* 500 g de {{i|bœuf}} haché\n== Préparation ==\n* cuire',
    );
    expect(section).toContain('bœuf');
    expect(section).not.toContain('cuire');
  });
});

describe('parseWikibooksRecipe', () => {
  it('parses title, servings and tagged ingredients', () => {
    const r = parseWikibooksRecipe('Livre de cuisine/Test', SAMPLE);
    expect(r.title).toBe('Test');
    expect(r.servings).toBe(2);
    const labels = r.ingredients.map((i) => i.rawLabel);
    expect(labels).toContain('tomate');
    expect(labels).toContain('oignon');
    expect(labels).not.toContain('sel');
  });
});

describe('resolveIngredientKey — whole-word matching', () => {
  it('maps French labels to canonical keys', () => {
    expect(resolveIngredientKey('oignon')).toBe('onion');
    expect(resolveIngredientKey('crème fraîche')).toBe('cream');
    expect(resolveIngredientKey('courgettes')).toBe('zucchini');
  });
  it('does NOT mistake "bœuf" for "œuf" (regression)', () => {
    expect(resolveIngredientKey('Bœuf')).toBeNull();
    expect(resolveIngredientKey('bœuf haché')).toBe('beef');
    expect(resolveIngredientKey('œuf')).toBe('egg');
  });
  it('uses the whole line to disambiguate the label', () => {
    expect(
      resolveIngredientKey('courgette', '3 douzaines de fleurs de courgettes'),
    ).toBeNull();
    expect(
      resolveIngredientKey('Bœuf', 'Bœuf pour pot-au-feu, haché (600 g)'),
    ).toBe('beef');
  });
  it('returns null for uncovered ingredients', () => {
    expect(resolveIngredientKey('igname')).toBeNull();
  });
});
