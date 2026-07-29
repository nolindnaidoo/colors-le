import { beforeEach, describe, expect, it } from 'vitest';
import { _resetMockState } from '../__mocks__/vscode';
import { registerCodeActions } from './codeActions';

beforeEach(() => _resetMockState());

describe('registerCodeActions', () => {
	it('registers providers without throwing', () => {
		const context = { subscriptions: [] as Array<{ dispose(): void }> };
		registerCodeActions(context as never);
		expect(context.subscriptions.length).toBeGreaterThan(0);
	});
});
