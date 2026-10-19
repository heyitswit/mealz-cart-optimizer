import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Spawns the real server and talks to it over stdio, like any MCP host would.

const here = dirname(fileURLToPath(import.meta.url));
const serverEntry = join(here, '../src/mcp/server.ts');
const pos = { externalId: 'drive-lille-01', name: 'Drive Lille' };

let client: Client;

beforeAll(async () => {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', serverEntry],
  });
  client = new Client({ name: 'e2e-test', version: '0.0.1' });
  await client.connect(transport);
}, 60_000);

afterAll(async () => {
  await client?.close();
});

function parse(result: unknown): any {
  const content = (result as { content: Array<{ text: string }> }).content;
  return JSON.parse(content[0]!.text);
}

describe('MCP server (e2e over stdio)', () => {
  it('exposes the three agentic tools', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      'compose_menu',
      'optimize_week_basket',
      'suggest_substitute',
    ]);
  });

  it('composes a menu, then optimizes it into a priced basket', async () => {
    const menuRes = await client.callTool({
      name: 'compose_menu',
      arguments: { pos, mealsCount: 3 },
    });
    const menu = parse(menuRes);
    expect(menu.recipes.length).toBeGreaterThan(0);

    const ids = menu.recipes.map((r: { id: string }) => r.id);
    const basketRes = await client.callTool({
      name: 'optimize_week_basket',
      arguments: { pos, recipeIds: ids },
    });
    const basket = parse(basketRes);

    expect(basket.lines.length).toBeGreaterThan(0);
    for (const d of basket.cartDelta) {
      expect(typeof d.id).toBe('string');
      expect(typeof d.quantity).toBe('number');
    }
    expect(basket.totalCost).toBeGreaterThan(0);
    expect(
      (basketRes as { structuredContent?: unknown }).structuredContent,
    ).toEqual(basket);
  });

  it('rejects invalid input via the Zod boundary', async () => {
    const res = await client.callTool({
      name: 'compose_menu',
      arguments: { pos, mealsCount: 0 },
    });
    expect((res as { isError?: boolean }).isError).toBe(true);
  });
});
