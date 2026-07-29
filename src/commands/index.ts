import type * as vscode from 'vscode';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { registerAnalyzeCommand } from './analyze';
import { registerConvertCommand } from './convert';
import { registerDedupeCommand } from './dedupe';
import { registerExtractCommand } from './extract';
import { registerFilterCommand } from './filter';
import { registerHelpCommand } from './help';
import { registerSortCommand } from './sort';
import { registerValidateCommand } from './validate';

export function registerCommands(
	context: vscode.ExtensionContext,
	deps: Readonly<{
		telemetry: Telemetry;
		notifier: Notifier;
		statusBar: StatusBar;
	}>,
): void {
	registerExtractCommand(context, deps);
	registerAnalyzeCommand(context);
	registerConvertCommand(context);
	registerFilterCommand(context);
	registerValidateCommand(context);
	registerDedupeCommand(context, deps);
	registerSortCommand(context, deps);
	registerHelpCommand(context, deps);
}
