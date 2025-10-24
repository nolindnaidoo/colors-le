import type * as vscode from 'vscode';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import type { PerformanceMonitor } from '../utils/performance';
import { registerAnalyzeCommand } from './analyze';
import { registerConvertCommand } from './convert';
import { registerDedupeCommand } from './dedupe';
import { registerExtractCommand } from './extract';
import { registerFilterCommand } from './filter';
import { registerHelpCommand } from './help';
import { registerSortCommand } from './sort';
import { registerToggleCsvStreamingCommand } from './toggleCsvStreaming';
import { registerValidateCommand } from './validate';

export function registerCommands(
	context: vscode.ExtensionContext,
	deps: Readonly<{
		telemetry: Telemetry;
		notifier: Notifier;
		statusBar: StatusBar;
		performanceMonitor: PerformanceMonitor;
	}>,
): void {
	// Create a simple adapter for the performance monitor
	const performanceAdapter = {
		startTimer: (operation: string) => {
			const startTime = performance.now();
			deps.performanceMonitor.start(operation, 0);
			return { id: operation, startTime };
		},
		endTimer: (timer: { id: string; startTime: number }) => {
			const result = deps.performanceMonitor.end(0, 0, 0, 0);
			return {
				duration: result?.duration || performance.now() - timer.startTime,
				memoryUsage: result?.memoryUsage || 0,
			};
		},
	};

	registerExtractCommand(context, deps);
	registerAnalyzeCommand(context, {
		performanceMonitor: performanceAdapter,
	});
	registerConvertCommand(context, {
		performanceMonitor: performanceAdapter,
	});
	registerFilterCommand(context, {
		performanceMonitor: performanceAdapter,
	});
	registerValidateCommand(context, {
		performanceMonitor: performanceAdapter,
	});
	registerDedupeCommand(context, deps);
	registerSortCommand(context, deps);
	registerHelpCommand(context, deps);
	registerToggleCsvStreamingCommand(context, deps.telemetry);
}
