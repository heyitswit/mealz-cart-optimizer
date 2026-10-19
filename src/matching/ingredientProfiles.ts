export interface IngredientProfile {
  key: string;
  frenchAliases: string[];
  // Context words that veto ("fleurs de courgette") or are required ("bœuf" only when "haché").
  excludeContextWords?: string[];
  requireContextWords?: string[];
  offCategories: string[];
  nameTerms: string[];
  expectCategories: string[];
  // Broad tags (e.g. "vegetables") that only count when the product name also contains the term.
  weakCategories?: string[];
  rejectCategories: string[];
  rejectNameWords: string[];
  pieceWeightG?: number;
}

export const INGREDIENT_PROFILES: Record<string, IngredientProfile> = {
  butter: {
    key: 'butter',
    frenchAliases: ['beurre'],
    offCategories: ['en:butters'],
    nameTerms: ['beurre'],
    expectCategories: ['butters'],
    rejectCategories: [
      'nut-butters',
      'peanut-butters',
      'margarines',
      'biscuits',
      'viennoiseries',
      'chocolate',
    ],
    rejectNameWords: [
      'cacahuete',
      'peanut',
      'brioche',
      'biscuit',
      'chocolat',
      'margarine',
    ],
  },
  onion: {
    key: 'onion',
    frenchAliases: ['oignon', 'oignons', 'échalote', 'échalotes'],
    offCategories: ['en:fresh-onions', 'en:yellow-onions'],
    nameTerms: ['oignon', 'oignons'],
    expectCategories: ['fresh-onions', 'yellow-onions'],
    weakCategories: ['onions'],
    rejectCategories: ['fried-onions', 'crisps', 'salty-snacks', 'pickles'],
    rejectNameWords: ['frit', 'frits', 'chips', 'vinaigre', 'confit'],
    pieceWeightG: 110,
  },
  pasta: {
    key: 'pasta',
    frenchAliases: [
      'pâtes',
      'spaghetti',
      'spaghettis',
      'penne',
      'macaroni',
      'tagliatelle',
      'tagliatelles',
      'lasagne',
      'lasagnes',
    ],
    offCategories: ['en:dry-pastas'],
    nameTerms: [
      'pates',
      'spaghetti',
      'penne',
      'tagliatelle',
      'fusilli',
      'macaroni',
      'lasagne',
      'lasagnes',
    ],
    expectCategories: ['dry-pastas'],
    weakCategories: ['pastas'],
    rejectCategories: ['meals', 'sauces', 'stuffed-pastas'],
    rejectNameWords: ['sauce', 'cuisine', 'farci', 'farcies'],
  },
  rice: {
    key: 'rice',
    frenchAliases: ['riz'],
    offCategories: ['en:rices'],
    nameTerms: ['riz'],
    expectCategories: ['rices'],
    rejectCategories: ['meals', 'prepared', 'desserts', 'rice-cakes', 'puffed'],
    rejectNameWords: [
      'gateau',
      'dessert',
      'au lait',
      'souffle',
      'galette',
      'cuisine',
      'tomate',
    ],
  },
  tomato: {
    key: 'tomato',
    frenchAliases: ['tomate', 'tomates'],
    offCategories: ['en:fresh-tomatoes'],
    nameTerms: ['tomate', 'tomates'],
    expectCategories: ['fresh-tomatoes', 'cherry-tomatoes'],
    weakCategories: ['tomatoes'],
    rejectCategories: [
      'sauces',
      'ketchup',
      'soups',
      'juices',
      'canned',
      'tomato-pastes',
      'dried',
    ],
    rejectNameWords: [
      'ketchup',
      'sauce',
      'soupe',
      'jus',
      'concentre',
      'coulis',
      'sechee',
      'sechees',
    ],
    pieceWeightG: 120,
  },
  cream: {
    key: 'cream',
    frenchAliases: ['crème fraîche', 'crème'],
    offCategories: ['fr:cremes-fraiches', 'en:sour-creams'],
    nameTerms: ['creme'],
    expectCategories: ['cremes-fraiches', 'sour-creams'],
    weakCategories: ['creams'],
    rejectCategories: [
      'desserts',
      'ice-creams',
      'whipped-creams',
      'plant-based',
    ],
    rejectNameWords: [
      'dessert',
      'glace',
      'vanille',
      'chantilly',
      'soja',
      'avoine',
    ],
  },
  lardon: {
    key: 'lardon',
    frenchAliases: ['lardon', 'lardons', 'lard fumé'],
    offCategories: ['en:lardons'],
    nameTerms: ['lardon', 'lardons', 'allumettes'],
    expectCategories: ['lardons', 'smoked-bacon-lardons'],
    rejectCategories: ['meat-analogues', 'meat-alternatives'],
    rejectNameWords: ['vegetal', 'vegetaux', 'veggie', 'sans viande'],
  },
  chicken: {
    key: 'chicken',
    frenchAliases: ['poulet', 'blanc de poulet', 'escalope de poulet'],
    offCategories: ['en:chicken-breasts'],
    nameTerms: ['poulet'],
    expectCategories: ['chicken-breasts'],
    rejectCategories: [
      'meat-analogues',
      'soups',
      'broths',
      'sandwiches',
      'meals',
    ],
    rejectNameWords: [
      'roti',
      'tranche',
      'tranches',
      'curry',
      'fume',
      'saveur',
      'bouillon',
      'vegetal',
    ],
  },
  egg: {
    key: 'egg',
    frenchAliases: ['oeuf', 'oeufs'],
    offCategories: ['en:chicken-eggs'],
    nameTerms: ['oeuf', 'oeufs'],
    expectCategories: ['chicken-eggs', 'fresh-eggs'],
    weakCategories: ['eggs'],
    rejectCategories: ['chocolates', 'pastas', 'quail-eggs'],
    rejectNameWords: ['chocolat', 'paques', 'kinder', 'caille', 'nouilles'],
    pieceWeightG: 60,
  },
  milk: {
    key: 'milk',
    frenchAliases: ['lait'],
    offCategories: ['en:semi-skimmed-milks'],
    nameTerms: ['lait'],
    expectCategories: ['semi-skimmed-milks', 'whole-milks', 'skimmed-milks'],
    weakCategories: ['milks'],
    rejectCategories: [
      'chocolate',
      'desserts',
      'plant-based',
      'flavoured-milks',
      'powdered',
      'condensed',
      'fermented',
      'cheeses',
    ],
    rejectNameWords: [
      'chocolat',
      'dessert',
      'soja',
      'amande',
      'avoine',
      'fraise',
      'vanille',
      'poudre',
      'concentre',
    ],
  },
  flour: {
    key: 'flour',
    frenchAliases: ['farine'],
    offCategories: ['en:wheat-flours'],
    nameTerms: ['farine'],
    expectCategories: ['wheat-flours'],
    weakCategories: ['flours'],
    rejectCategories: ['prepared-mixes', 'cakes', 'breads'],
    rejectNameWords: ['preparation', 'gateau', 'pancake', 'crepe', 'pain'],
  },
  carrot: {
    key: 'carrot',
    frenchAliases: ['carotte', 'carottes'],
    offCategories: ['en:fresh-carrots'],
    nameTerms: ['carotte', 'carottes'],
    expectCategories: ['fresh-carrots'],
    weakCategories: ['carrots'],
    rejectCategories: ['juices', 'cakes', 'soups', 'baby-food', 'salads'],
    rejectNameWords: ['jus', 'gateau', 'soupe', 'bebe', 'rapee', 'rapees'],
    pieceWeightG: 125,
  },
  zucchini: {
    key: 'zucchini',
    frenchAliases: ['courgette', 'courgettes'],
    excludeContextWords: ['fleur', 'fleurs'],
    offCategories: ['en:fresh-zucchini'],
    nameTerms: ['courgette', 'courgettes'],
    expectCategories: ['fresh-zucchini'],
    weakCategories: ['zucchini'],
    rejectCategories: ['prepared', 'meals', 'soups', 'canned'],
    rejectNameWords: [
      'soupe',
      'cuisinee',
      'cuisinees',
      'poelee',
      'farcie',
      'farcies',
      'provencale',
    ],
    pieceWeightG: 200,
  },
  parmesan: {
    key: 'parmesan',
    frenchAliases: ['parmesan', 'parmigiano'],
    offCategories: ['en:parmigiano-reggiano'],
    nameTerms: ['parmesan', 'parmigiano', 'parmesano'],
    expectCategories: ['parmigiano-reggiano'],
    rejectCategories: ['sauces', 'crisps', 'meals'],
    rejectNameWords: ['sauce', 'chips', 'tuile'],
  },
  garlic: {
    key: 'garlic',
    frenchAliases: ['ail', "gousse d'ail", "gousses d'ail"],
    offCategories: ['en:fresh-garlic', 'en:garlic'],
    nameTerms: ['ail'],
    expectCategories: ['fresh-garlic'],
    weakCategories: ['garlic'],
    rejectCategories: [
      'meals',
      'sauces',
      'spreads',
      'cheeses',
      'oils',
      'fermented',
    ],
    rejectNameWords: [
      'semoule',
      'poudre',
      'huile',
      'sauce',
      'tartare',
      'herbes',
      'pain',
      'beurre',
      'confit',
      'ours',
      'marine',
      'noir',
    ],
    // Recipes count garlic in cloves, not heads.
    pieceWeightG: 5,
  },
  potato: {
    key: 'potato',
    frenchAliases: ['pomme de terre', 'pommes de terre', 'patate', 'patates'],
    offCategories: ['en:fresh-potatoes', 'en:potatoes'],
    nameTerms: ['pomme de terre', 'pommes de terre'],
    expectCategories: ['fresh-potatoes'],
    weakCategories: ['potatoes'],
    rejectCategories: [
      'meals',
      'frozen',
      'fries',
      'crisps',
      'prepared',
      'mashed',
    ],
    rejectNameWords: [
      'rissolee',
      'poelee',
      'ecrase',
      'frites',
      'chips',
      'puree',
      'cuisinee',
    ],
    pieceWeightG: 150,
  },
  beef: {
    key: 'beef',
    frenchAliases: ['bœuf', 'viande hachée', 'steak haché', 'steaks hachés'],
    requireContextWords: ['hache', 'haches', 'hachee', 'hachees'],
    offCategories: ['en:ground-meats', 'en:beef-patties'],
    nameTerms: ['boeuf'],
    expectCategories: ['ground-meats', 'beef-patties'],
    rejectCategories: ['veal', 'poultry', 'meat-analogues'],
    rejectNameWords: [
      'veau',
      'porc',
      'paupiette',
      'paupiettes',
      'poulet',
      'vegetal',
      'oignon',
    ],
  },
};

// Lowercase, strip accents (NFD + drop combining marks) and expand "œ", which NFD leaves intact.
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Word-boundary match so the alias "oeuf" doesn't hit "boeuf".
export function matchesWholeWord(text: string, term: string): boolean {
  const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}($|[^a-z0-9])`);
  return re.test(text);
}

// Longest alias wins, so "crème fraîche" beats "crème"; `context` is the full recipe line.
export function resolveIngredientKey(
  label: string,
  context: string = label,
): string | null {
  const n = normalize(label);
  const ctx = normalize(context);
  const hasWord = (w: string) => matchesWholeWord(ctx, normalize(w));
  let best: { key: string; len: number } | null = null;
  for (const profile of Object.values(INGREDIENT_PROFILES)) {
    if (profile.excludeContextWords?.some(hasWord)) continue;
    if (
      profile.requireContextWords &&
      !profile.requireContextWords.some(hasWord)
    ) {
      continue;
    }
    for (const alias of profile.frenchAliases) {
      const na = normalize(alias);
      if (matchesWholeWord(n, na) && (!best || na.length > best.len)) {
        best = { key: profile.key, len: na.length };
      }
    }
  }
  return best ? best.key : null;
}
