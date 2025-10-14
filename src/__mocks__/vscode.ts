// Mock VS Code API for testing
const mockFn = () => Promise.resolve();

export const window = {
	activeTextEditor: undefined,
	showInformationMessage: mockFn,
	showWarningMessage: mockFn,
	showErrorMessage: mockFn,
	createStatusBarItem: () => ({
		text: '',
		tooltip: '',
		command: '',
		show: mockFn,
		hide: mockFn,
		dispose: mockFn,
	}),
	createOutputChannel: () => ({
		appendLine: mockFn,
		dispose: mockFn,
	}),
	withProgress: mockFn,
};

export const workspace = {
	openTextDocument: mockFn,
	applyEdit: mockFn,
	getConfiguration: mockFn,
};

export const commands = {
	registerCommand: mockFn,
	executeCommand: mockFn,
};

export const env = {
	clipboard: {
		writeText: mockFn,
	},
};

export const ViewColumn = {
	Beside: 2,
};

export const StatusBarAlignment = {
	Left: 1,
	Right: 2,
};

export const ProgressLocation = {
	Notification: 15,
};

export const Range = class Range {
	constructor(
		public startLine: number,
		public startCharacter: number,
		public endLine: number,
		public endCharacter: number,
	) {}
};

export const WorkspaceEdit = class WorkspaceEdit {
	replace(uri: any, range: any, text: string) {}
};
