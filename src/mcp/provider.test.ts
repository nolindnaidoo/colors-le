// The mock has no `vscode.lm`, which is how the lifecycle test reads a host
// without agent mode, so both shapes of the host are supplied here.
import { describe, expect, it, vi } from 'vitest';

const registered: Array<{
	id: string;
	provider: { provideMcpServerDefinitions: () => unknown[] };
}> = [];
const lm = {
	registerMcpServerDefinitionProvider: (id: string, provider: never) => {
		registered.push({ id, provider });
		return { dispose: () => {} };
	},
};
let withLm = true;

vi.mock('vscode', async (original) => {
	const actual = (await original()) as Record<string, unknown>;
	return {
		...actual,
		get lm() {
			return withLm ? lm : undefined;
		},
		McpStdioServerDefinition: class {
			constructor(
				readonly label: string,
				readonly command: string,
				readonly args: string[],
				readonly env: Record<string, string>,
				readonly version: string,
			) {}
		},
	};
});

const { registerMcpProvider } = await import('./provider');

const context = () =>
	({
		subscriptions: [] as unknown[],
		asAbsolutePath: (relative: string) => `/ext/${relative}`,
		extension: { packageJSON: { version: '9.9.9' } },
	}) as never;

describe('the MCP provider', () => {
	it('registers nothing, and says nothing, on a host without agent mode', () => {
		withLm = false;
		expect(registerMcpProvider(context())).toBeUndefined();
		withLm = true;
	});

	it('launches the bundled server with the editor binary as Node', () => {
		registered.length = 0;
		registerMcpProvider(context());
		expect(registered.map((r) => r.id)).toEqual(['colors-le']);
		const [definition] =
			(registered[0]?.provider.provideMcpServerDefinitions() ?? []) as Array<{
				command: string;
				args: string[];
				env: Record<string, string>;
				version: string;
			}>;
		expect(definition).toMatchObject({
			command: process.execPath,
			args: ['/ext/dist/mcp-server.js'],
			env: { ELECTRON_RUN_AS_NODE: '1' },
			version: '9.9.9',
		});
	});
});
