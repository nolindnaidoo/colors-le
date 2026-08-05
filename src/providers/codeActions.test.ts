import { beforeEach, describe, expect, it } from 'vitest';
import type * as vscode from 'vscode';
import { _resetMockState } from '../__mocks__/vscode';
import {
	createExtractColorsProvider,
	registerCodeActions,
	SUPPORTED_LANGUAGES,
} from './codeActions';

beforeEach(() => _resetMockState());

/** The only thing the provider reads off a document. */
function document(text: string): vscode.TextDocument {
	return { getText: () => text } as unknown as vscode.TextDocument;
}

// provideCodeActions also receives a range, a context and a token; none are
// read, so they are passed through a narrow cast rather than mocked at length.
function actionsFor(text: string): vscode.CodeAction[] | undefined {
	const provider = createExtractColorsProvider();
	return provider.provideCodeActions(
		document(text),
		undefined as never,
		undefined as never,
		undefined as never,
	) as vscode.CodeAction[] | undefined;
}

const CSS = '.a { color: #ff0000; }';

describe('registerCodeActions', () => {
	it('registers one provider per supported language', () => {
		const context = { subscriptions: [] as Array<{ dispose(): void }> };
		registerCodeActions(context as never);
		expect(context.subscriptions).toHaveLength(SUPPORTED_LANGUAGES.length);
	});

	it('covers the stylesheet and markup languages colours appear in', () => {
		// A language missing from the list makes the Quick Fix invisible rather
		// than broken, which is the harder failure to notice.
		expect(SUPPORTED_LANGUAGES).toEqual(
			expect.arrayContaining(['css', 'scss', 'less', 'html', 'javascript']),
		);
	});
});

describe('extract colours quick fix', () => {
	it('offers nothing for an empty document', () => {
		expect(actionsFor('')).toBeUndefined();
	});

	it('offers nothing for a whitespace-only document', () => {
		// Guards the trim() branch specifically: blank lines give a non-zero
		// length with nothing to extract.
		expect(actionsFor('   \n\t\n  ')).toBeUndefined();
	});

	it('offers exactly one action when the document has content', () => {
		expect(actionsFor(CSS)).toHaveLength(1);
	});

	it('wires the action to the extract command', () => {
		const [action] = actionsFor(CSS) ?? [];
		expect(action?.command?.command).toBe('colors-le.extractColors');
	});

	it('marks the action preferred so it surfaces first', () => {
		const [action] = actionsFor(CSS) ?? [];
		expect(action?.isPreferred).toBe(true);
	});

	it('uses one title for both the menu label and the command', () => {
		// The constructor argument is what the lightbulb renders; command.title is
		// not. These drifted once — the visible label was hard-coded English while
		// the invisible one was localized.
		const [action] = actionsFor(CSS) ?? [];
		expect(action?.title).toBeTruthy();
		expect(action?.title).toBe(action?.command?.title);
	});
});
