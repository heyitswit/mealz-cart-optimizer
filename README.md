# mealz-cart-optimizer

An MCP server that lets an AI agent (Claude, ChatGPT or any MCP client) turn a
weekly menu into a priced shopping basket at a given store, and swap products
that are out of stock. It is built against the contract of Mealz's public SDK.

I built it as a portfolio project for my application to the Software Engineer
(Ruby / TypeScript) role at [Mealz](https://www.mealz.ai). Two of the five open
topics in the job post are about agentic features and about exposing tools to
every AI provider through MCP. This project works on that layer.

The server never calls Mealz's private API. The tools depend on a `MealzSource`
interface. For the demo, a fake adapter implements it over open data. A real
adapter would implement the same interface against the Mealz API.

## What Mealz already does, and what this adds

I read the public SDK (`webc-miam@10.9.0` on npm) before designing the tools.
Mealz already covers several parts of the problem:

- A basket entry can serve several recipes (`recipe-ids`), so shared
  ingredients are already merged.
- Each entry lists candidate products (`basket-entries-items`), and the UI lets
  the shopper replace one. Entries carry `unavailable` and `out_of_stock`
  statuses.
- The meals planner calls `recipes/plan` with a budget, a number of guests and
  a recipe count.

The job post says Mealz is building its own MCP server and agents. This
project is my proposal for what three of those tools could look like, with
typed inputs and outputs, explicit reporting of what is missing, and a cart
delta in the SDK's format. It also adds one step that the SDK does not show.
For each ingredient, it picks among the equivalent products the pack size with
the best trade-off between price and leftover food.

## The tools

| Tool                   | Input                                                                | Output                                                                                                                                         |
| ---------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `compose_menu`         | point of sale, number of meals, optional keyword                     | recipes with their servings and ingredients                                                                                                    |
| `optimize_week_basket` | point of sale, recipe ids, optional servings and waste penalty       | basket lines, total cost, waste cost, unmatched and out-of-stock ingredients, warnings, and a cart delta in Mealz's `ComparableProduct` format |
| `suggest_substitute`   | point of sale, ingredient key, product to replace, optional quantity | in-stock alternatives, ranked by the cost of covering that quantity when it is given                                                           |

Every tool validates its input with Zod and declares an output schema. The
server returns the result as `structuredContent`, which the MCP SDK checks
against that schema, and as JSON text for clients that ignore it.

A typical agent session calls `compose_menu`, then `optimize_week_basket` with
the chosen recipe ids. If the shopper rejects a product, or an ingredient comes
back in `unavailable`, the agent passes the line's `ingredientKey` to
`suggest_substitute`. The `cartDelta` can go straight to the retailer cart,
like the SDK's `basketSync` callbacks do.

## Example

This is the basket for the seven demo recipes at a test store, as returned by
`optimize_week_basket` (abridged):

```
egg      1 × Œufs de poules élevées en plein air [15 piece]  need 14 piece   5.49 €  (6 recipes)
flour    1 × Farine Fluide sans Grumeaux [1000 g]           need 975 g      0.56 €  (5 recipes)
butter   2 × Beurre à teneur réduite en M.G. (60%) doux [250 g]  need 300 g  3.86 €  (4 recipes)
onion    1 × Oignons Jaunes Filet [1000 g]                  need 550 g      0.69 €  (3 recipes)
...
total 26.27 €, of which 5.23 € is leftover
warnings: "butter: 4 piece left out, no conversion to g"
```

The warning comes from a recipe that asks for "3 noix de beurre". The server
cannot turn that into grams, so it says so and leaves it out of the total.

## Architecture

```
agent
  │  MCP over stdio
  ▼
src/mcp/server.ts          registers the three tools with their schemas
src/mcp/handlers.ts        converts between Mealz shapes and the optimizer
  ├── src/optimizer/       basket optimizer and unit conversion
  ├── src/matching/        ingredient profiles and product scoring
  └── src/mealz/
        MealzSource.ts       the interface the tools depend on
        FakeMealzSource.ts   demo adapter over the open data snapshots
```

`buildServer` takes the `MealzSource` as a parameter. The entry point passes
the fake adapter. A real adapter would replace it there, and the recipes,
products, prices, stock, alternatives and piece weights would then all come
from Mealz. The open data catalog, the ingredient profiles, the matcher and
the Wikibooks parser exist only to make the demo work. Mealz already computes
how many packs each basket entry needs (`quantity`). With Mealz plugged in, the
optimizer becomes an alternative way to choose among the entry's candidate
products.

`MealzSource` uses short field names. Each one maps to a field of the Mealz API:

| `MealzSource`                           | Mealz API                                               |
| --------------------------------------- | ------------------------------------------------------- |
| `MealzRecipe.servings`                  | recipe `number-of-guests`                               |
| `MealzRecipe.preparationTime`           | recipe `preparation-time`                               |
| `MealzRecipeIngredient.products`        | basket entry `basket-entries-items`, best first         |
| `MatchedProduct.externalId`             | item `ext-id`                                           |
| `MatchedProduct.packAmount`, `packUnit` | item `capacity-volume`, `capacity-unit`                 |
| `MatchedProduct.pricePerPack`           | item `unit-price`                                       |
| `MatchedProduct.available`              | entry status other than `unavailable` or `out_of_stock` |
| `ComparableProduct`                     | the SDK's `ComparableProduct`, same shape               |

## How the optimizer picks products

The optimizer first sums the needs of all recipes per ingredient. It keeps one
total per dimension (mass, volume, count), so the result does not depend on
the order of the recipes. For each candidate product, it converts the totals
into the product's unit. Pieces and grams convert through an average weight per
ingredient (110 g per onion, 5 g per garlic clove). Volume and mass never
convert, because that would need a density table. A quantity that cannot be
converted becomes a warning.

Each ingredient is then independent, so the optimizer chooses per ingredient.
It scores every in-stock candidate with:

```
score = price of the packs + wastePenalty × unused fraction of the last pack
```

`wastePenalty` defaults to 1 € and the agent can change it. Products with a
known price win over products without one, so a missing price never looks
free. The optimizer buys several packs of one product per ingredient. It does
not mix two products, such as 500 g + 250 g of butter. Within that model the
per-ingredient choice is optimal, because ingredients do not interact. The
waste penalty applies to the unused fraction of the last pack. It does not
apply to the value of the leftover, so 200 g left in a 250 g pack costs more
than 450 g left in a 1 kg pack. Both points are listed in the next steps.

## How products are matched

The demo catalog comes from Open Food Facts. For each ingredient, a profile
lists the Open Food Facts categories to fetch (`en:fresh-onions`,
`en:wheat-flours`...). It also lists the words and categories that reject a
product, such as fried onions or garlic powder. The scorer adds 0.6 for an
expected category and 0.2 when the name contains the ingredient. It removes
0.9 for a rejected category and 0.5 for a rejected word. It keeps products
scoring 0.5 or more, and each score comes with its reasons.

The fake adapter offers the optimizer every product in the best score tier.
Mealz matches against a retailer's real assortment, which is a harder problem
with better data. This matcher only makes the demo catalog usable.

## Data and licences

| Data                                | Source                                                                        | Licence  |
| ----------------------------------- | ----------------------------------------------------------------------------- | -------- |
| Products, pack sizes, categories    | [Open Food Facts](https://world.openfoodfacts.org)                            | ODbL     |
| Prices (median of EUR observations) | [Open Prices](https://prices.openfoodfacts.org)                               | ODbL     |
| Recipes                             | [Wikibooks, Livre de cuisine](https://fr.wikibooks.org/wiki/Livre_de_cuisine) | CC BY-SA |

The snapshots in `src/**/fixtures/` keep the demo fast and deterministic. Each
recipe keeps its Wikibooks URL for attribution. These scripts regenerate them:

```bash
pnpm tsx scripts/fetchProducts.ts   # products from Open Food Facts categories
pnpm tsx scripts/enrichPrices.ts    # prices from Open Prices
pnpm tsx scripts/ingestRecipes.ts   # recipes from Wikibooks
```

## Limitations

- Prices come from crowd-sourced observations. 57 % of the 508 products in the
  snapshot have one. In production, the price would come from the retailer
  through Mealz (`unit-price`).
- Stock is simulated. The fake adapter marks about one product in seven as out
  of stock, with a deterministic hash.
- The demo has seven recipes. Wikibooks has few recipes with structured
  quantities, and the parser only reads the first tagged ingredient on a line.
- Recipe quantities like "3 noix de beurre" have no weight, so they show up as
  warnings.

## Run it

Requires Node 22.13 or later and pnpm.

```bash
pnpm install
pnpm test          # 55 tests, including an end-to-end run over the MCP server
pnpm mcp           # starts the MCP server on stdio
```

Claude Desktop configuration:

```json
{
  "mcpServers": {
    "mealz-cart": {
      "command": "pnpm",
      "args": ["tsx", "src/mcp/server.ts"],
      "cwd": "/path/to/mealz-cart-optimizer"
    }
  }
}
```

## Next steps

- Write a real `MealzSource` adapter against the Mealz API (`api.miam.tech`).
- Add a `budget` to `compose_menu` and back it with `recipes/plan`.
- Let the optimizer mix pack sizes of different products for one ingredient.
- Penalize the value of the leftover instead of the unused fraction of a pack.
- Return the match confidence, so the agent can ask the shopper when a match is
  weak.
- Add an LP variant once the basket has a global budget constraint.

## Reference files

`reference/mealz-sdk-public/` holds two interface files copied unchanged from
the public `webc-miam@10.9.0` npm package. They document how `MealzSource` was
aligned with the SDK. No project code imports them. They are licensed under
GNU GPL v3 (https://www.gnu.org/licenses/gpl-3.0.html), separately from the MIT
licence of the rest of the project.
