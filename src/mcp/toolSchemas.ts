import { z } from 'zod';

export const PointOfSaleInput = z.object({
  externalId: z.string().min(1).describe('Retailer ext-id of the drive/store'),
  name: z.string().optional(),
});

export const ComparableProductSchema = z.object({
  id: z.string().describe('Retailer ext-id of the product'),
  quantity: z.number().describe('Positive to add, negative to remove'),
  additionalInfos: z.record(z.unknown()).optional(),
});

const UnitSchema = z.enum(['g', 'kg', 'ml', 'l', 'piece']);

export const ComposeMenuInput = z.object({
  pos: PointOfSaleInput,
  mealsCount: z
    .number()
    .int()
    .min(1)
    .max(21)
    .describe('How many meals to plan for the week'),
  search: z
    .string()
    .optional()
    .describe(
      'Keyword matched against recipe titles and ingredients, e.g. "courgette", "oeuf"',
    ),
});

export const ComposeMenuOutput = z.object({
  recipes: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      servings: z.number(),
      preparationTime: z.number().optional(),
      ingredients: z.array(z.string()),
    }),
  ),
});

export const OptimizeWeekBasketInput = z.object({
  pos: PointOfSaleInput,
  recipeIds: z
    .array(z.string().min(1))
    .min(1)
    .describe('Recipes to turn into one optimized weekly basket'),
  servings: z
    .number()
    .int()
    .min(1)
    .max(12)
    .optional()
    .describe(
      'Scale every recipe to this many servings (default: each recipe as written)',
    ),
  wastePenalty: z
    .number()
    .min(0)
    .optional()
    .describe('Euros of penalty per pack-worth of waste (default 1.0)'),
});

export const BasketLineOutput = z.object({
  ingredientKey: z
    .string()
    .describe('Pass to suggest_substitute to swap this product'),
  productExternalId: z.string(),
  productName: z.string(),
  packSize: z.string(),
  packs: z.number(),
  requiredAmount: z.number(),
  providedAmount: z.number(),
  unit: z.string(),
  leftover: z.number(),
  cost: z.number().optional(),
  usedBy: z.array(z.string()).describe('Recipes that drew on this ingredient'),
});

export const OptimizeWeekBasketOutput = z.object({
  lines: z.array(BasketLineOutput),
  totalCost: z.number().optional(),
  wasteCost: z.number().optional(),
  linesWithoutPrice: z
    .number()
    .describe('Lines excluded from the total for lack of a price'),
  unmatched: z
    .array(z.string())
    .describe('Ingredients with no matching product'),
  unavailable: z
    .array(z.string())
    .describe(
      'Ingredients whose matched products are all out of stock: call suggest_substitute',
    ),
  warnings: z
    .array(z.string())
    .describe('Quantities that could not be converted to the product unit'),
  unknownRecipeIds: z.array(z.string()),
  cartDelta: z.array(ComparableProductSchema),
});

export const SuggestSubstituteInput = z.object({
  pos: PointOfSaleInput,
  ingredientKey: z
    .string()
    .min(1)
    .describe('ingredientKey from an optimize_week_basket line'),
  unavailableExternalId: z
    .string()
    .min(1)
    .describe('Ext-id of the product to replace'),
  required: z
    .object({ amount: z.number().positive(), unit: UnitSchema })
    .optional()
    .describe(
      'Quantity to cover; when given, alternatives are ranked by the cost of covering it',
    ),
});

export const SuggestSubstituteOutput = z.object({
  alternatives: z.array(
    z.object({
      externalId: z.string(),
      name: z.string(),
      packAmount: z.number(),
      packUnit: z.string(),
      pricePerPack: z.number().optional(),
      packs: z.number().optional(),
      cost: z.number().optional(),
      rationale: z.string(),
    }),
  ),
  note: z.string().optional(),
});

export type ComposeMenuInputT = z.infer<typeof ComposeMenuInput>;
export type ComposeMenuOutputT = z.infer<typeof ComposeMenuOutput>;
export type OptimizeWeekBasketInputT = z.infer<typeof OptimizeWeekBasketInput>;
export type OptimizeWeekBasketOutputT = z.infer<
  typeof OptimizeWeekBasketOutput
>;
export type SuggestSubstituteInputT = z.infer<typeof SuggestSubstituteInput>;
export type SuggestSubstituteOutputT = z.infer<typeof SuggestSubstituteOutput>;
