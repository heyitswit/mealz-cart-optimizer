import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadFakeSource } from '../mealz/loadFakeSource';
import { MealzSource } from '../mealz/MealzSource';
import {
  ComposeMenuInput,
  ComposeMenuOutput,
  OptimizeWeekBasketInput,
  OptimizeWeekBasketOutput,
  SuggestSubstituteInput,
  SuggestSubstituteOutput,
} from './toolSchemas';
import {
  handleComposeMenu,
  handleOptimizeWeekBasket,
  handleSuggestSubstitute,
} from './handlers';

// structuredContent is validated against outputSchema; the text copy serves clients that ignore it.
function toolResult(payload: Record<string, unknown>) {
  return {
    content: [
      { type: 'text' as const, text: JSON.stringify(payload, null, 2) },
    ],
    structuredContent: payload,
  };
}

export function buildServer(source: MealzSource): McpServer {
  const server = new McpServer({
    name: 'mealz-cart-optimizer',
    version: '0.1.0',
  });

  server.registerTool(
    'compose_menu',
    {
      description:
        'List recipes available at a point of sale for a weekly menu, ' +
        'optionally filtered by a keyword found in titles or ingredients.',
      inputSchema: ComposeMenuInput.shape,
      outputSchema: ComposeMenuOutput.shape,
    },
    async (args) => toolResult(await handleComposeMenu(source, args)),
  );

  server.registerTool(
    'optimize_week_basket',
    {
      description:
        'Turn a set of recipes into one shopping basket: needs are summed per ' +
        'ingredient, and for each one the in-stock product with the best ' +
        'price/waste trade-off is picked. Reports unmatched or out-of-stock ' +
        "ingredients and returns a cart delta in Mealz's ComparableProduct format.",
      inputSchema: OptimizeWeekBasketInput.shape,
      outputSchema: OptimizeWeekBasketOutput.shape,
    },
    async (args) => toolResult(await handleOptimizeWeekBasket(source, args)),
  );

  server.registerTool(
    'suggest_substitute',
    {
      description:
        'Suggest in-stock replacements for a product at a point of sale. ' +
        'Given a required quantity, ranks them by the cost of covering it.',
      inputSchema: SuggestSubstituteInput.shape,
      outputSchema: SuggestSubstituteOutput.shape,
    },
    async (args) => toolResult(await handleSuggestSubstitute(source, args)),
  );

  return server;
}

async function main() {
  // The demo runs on open data; a real MealzSource adapter plugs in here with no change to the tools.
  const server = buildServer(loadFakeSource());
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout carries the MCP protocol, so logs go to stderr.
  process.stderr.write('mealz-cart-optimizer MCP server running on stdio\n');
}

main().catch((e) => {
  process.stderr.write(`Fatal: ${(e as Error).message}\n`);
  process.exit(1);
});
