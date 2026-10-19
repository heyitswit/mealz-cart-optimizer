export interface ParsedIngredient {
  rawLabel: string;
  amount: number;
  unit: string;
  // True when no quantity could be read and amount defaulted to 1.
  amountUncertain: boolean;
  // The whole line as plain text, used to disambiguate the label ("fleurs de courgette").
  text: string;
}

export interface ParsedRecipe {
  title: string;
  servings: number;
  ingredients: ParsedIngredient[];
}

const WORD_NUMBERS: Record<string, number> = {
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  douze: 12,
};

const UNIT_WORDS: Array<{ re: RegExp; unit: string; factor: number }> = [
  { re: /\bkg\b|kilogrammes?/, unit: 'g', factor: 1000 },
  { re: /\bg\b|grammes?/, unit: 'g', factor: 1 },
  { re: /\bcl\b/, unit: 'ml', factor: 10 },
  { re: /\bl\b(?!')|litres?/, unit: 'ml', factor: 1000 },
  { re: /\bml\b/, unit: 'ml', factor: 1 },
];

// Label of an {{i|...}} template: the last argument that isn't a "'=..." flag.
function templateLabel(inner: string): string | undefined {
  return inner
    .split('|')
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith("'="))
    .pop();
}

// Replace templates and wiki links by their visible text, so numbers inside them aren't read as quantities.
function plainText(line: string): string {
  return line
    .replace(
      /\{\{i\|([^}]*)\}\}/g,
      (_, inner: string) => templateLabel(inner) ?? '',
    )
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/^[*\s]+/, '')
    .trim();
}

export function parseServings(wikitext: string): number {
  const m = wikitext.match(/pour\s+(\d+)\s+personnes?/i);
  return m ? parseInt(m[1]!, 10) : 4;
}

// Recipes use either "== Ingrédients ==" or "=== Ingrédients ==="; the first one wins.
export function extractIngredientsSection(wikitext: string): string {
  const m = wikitext.match(
    /(={2,3})\s*Ingr[ée]dients\s*\1\s*([\s\S]*?)(?=\n=|$)/i,
  );
  return m ? m[2]! : '';
}

export function parseIngredientLine(line: string): ParsedIngredient | null {
  // Wikibooks tags ingredients with {{i|...|label}}; untagged lines are not ingredients.
  const tpl = line.match(/\{\{i\|([^}]*)\}\}/);
  if (!tpl) return null;
  const label = templateLabel(tpl[1]!);
  if (!label) return null;

  const plain = plainText(line);
  const text = plain.toLowerCase();

  let amount = 1;
  let amountUncertain = true;

  const numeric = text.match(/(\d+(?:[.,]\d+)?)\s*(?:\/\s*(\d+))?/);
  if (numeric) {
    if (numeric[2]) {
      amount = parseFloat(numeric[1]!) / parseFloat(numeric[2]!);
    } else {
      amount = parseFloat(numeric[1]!.replace(',', '.'));
    }
    amountUncertain = false;
  } else {
    const firstWord = text.split(/\s+/)[0] ?? '';
    if (WORD_NUMBERS[firstWord] !== undefined) {
      amount = WORD_NUMBERS[firstWord]!;
      amountUncertain = false;
    }
  }
  if (/\bquarts? de\b/.test(text)) amount *= 0.25;
  else if (/\bdemi-/.test(text)) amount *= 0.5;

  let unit = 'piece';
  for (const u of UNIT_WORDS) {
    if (u.re.test(text)) {
      unit = u.unit;
      amount = amount * u.factor;
      break;
    }
  }

  return { rawLabel: label, amount, unit, amountUncertain, text: plain };
}

export function parseWikibooksRecipe(
  title: string,
  wikitext: string,
): ParsedRecipe {
  const servings = parseServings(wikitext);
  const section = extractIngredientsSection(wikitext);
  const ingredients: ParsedIngredient[] = [];

  for (const rawLine of section.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('*')) continue;
    const parsed = parseIngredientLine(line);
    if (parsed) ingredients.push(parsed);
  }

  const cleanTitle = title.replace(/^Livre de cuisine\//, '');
  return { title: cleanTitle, servings, ingredients };
}
