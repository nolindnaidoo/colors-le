import * as vscode from 'vscode';
import type { Configuration, SortMode } from '../types';

export function getConfiguration(): Configuration {
	const config = vscode.workspace.getConfiguration('colors-le');

	// Backward-compat: support both `notificationLevel` (preferred) and legacy `notificationsLevel`
	const notifRaw = config.get(
		'notificationLevel',
		config.get('notificationsLevel', 'silent'),
	) as unknown as string;
	const notificationsLevel = isValidNotificationLevel(notifRaw)
		? notifRaw
		: 'silent';

	const sortModeRaw = config.get('sortMode', 'off');
	const sortMode = isValidSortMode(sortModeRaw) ? sortModeRaw : 'off';

	const presetsDefaultPresetRaw = config.get(
		'presets.defaultPreset',
		'balanced',
	);
	const presetsDefaultPreset = isValidPreset(presetsDefaultPresetRaw)
		? presetsDefaultPresetRaw
		: 'balanced';

	return Object.freeze({
		copyToClipboardEnabled: Boolean(
			config.get('copyToClipboardEnabled', false),
		),
		dedupeEnabled: Boolean(config.get('dedupeEnabled', false)),
		notificationsLevel,
		openResultsSideBySide: Boolean(config.get('openResultsSideBySide', false)),
		safetyEnabled: Boolean(config.get('safety.enabled', true)),
		safetyFileSizeWarnBytes: Math.max(
			1000,
			Number(config.get('safety.fileSizeWarnBytes', 1000000)),
		),
		safetyLargeOutputLinesThreshold: Math.max(
			100,
			Number(config.get('safety.largeOutputLinesThreshold', 50000)),
		),
		safetyManyDocumentsThreshold: Math.max(
			1,
			Number(config.get('safety.manyDocumentsThreshold', 8)),
		),
		showParseErrors: Boolean(config.get('showParseErrors', false)),
		sortEnabled: Boolean(config.get('sortEnabled', false)),
		sortMode,
		statusBarEnabled: Boolean(config.get('statusBar.enabled', true)),
		telemetryEnabled: Boolean(config.get('telemetryEnabled', false)),
		csvStreamingEnabled: Boolean(config.get('csv.streamingEnabled', false)),
		postProcessOpenInNewFile: Boolean(
			config.get('postProcess.openInNewFile', true),
		),
		analysisEnabled: Boolean(config.get('analysis.enabled', true)),
		analysisIncludeStats: Boolean(config.get('analysis.includeStats', true)),
		performanceEnabled: Boolean(config.get('performance.enabled', true)),
		performanceMaxDuration: Math.max(
			1000,
			Number(config.get('performance.maxDuration', 5000)),
		),
		performanceMaxMemoryUsage: Math.max(
			1048576,
			Number(config.get('performance.maxMemoryUsage', 104857600)),
		),
		performanceMaxCpuUsage: Math.max(
			100000,
			Number(config.get('performance.maxCpuUsage', 1000000)),
		),
		performanceMinThroughput: Math.max(
			100,
			Number(config.get('performance.minThroughput', 1000)),
		),
		performanceMaxCacheSize: Math.max(
			100,
			Number(config.get('performance.maxCacheSize', 1000)),
		),
		keyboardShortcutsEnabled: Boolean(
			config.get('keyboard.shortcuts.enabled', true),
		),
		keyboardExtractShortcut: String(
			config.get('keyboard.extractShortcut', 'ctrl+alt+c'),
		),
		keyboardDedupeShortcut: String(
			config.get('keyboard.dedupeShortcut', 'ctrl+alt+d'),
		),
		keyboardSortShortcut: String(
			config.get('keyboard.sortShortcut', 'ctrl+alt+s'),
		),
		presetsEnabled: Boolean(config.get('presets.enabled', true)),
		presetsDefaultPreset,
	});
}

export type NotificationLevel = 'all' | 'important' | 'silent';

export function isValidNotificationLevel(v: unknown): v is NotificationLevel {
	return v === 'all' || v === 'important' || v === 'silent';
}

export function isValidSortMode(v: unknown): v is SortMode {
	return (
		v === 'off' ||
		v === 'hue-asc' ||
		v === 'hue-desc' ||
		v === 'saturation-asc' ||
		v === 'saturation-desc' ||
		v === 'lightness-asc' ||
		v === 'lightness-desc' ||
		v === 'hex-asc' ||
		v === 'hex-desc'
	);
}

export type Preset =
	| 'minimal'
	| 'balanced'
	| 'comprehensive'
	| 'performance'
	| 'colors';

export function isValidPreset(v: unknown): v is Preset {
	return (
		v === 'minimal' ||
		v === 'balanced' ||
		v === 'comprehensive' ||
		v === 'performance' ||
		v === 'colors'
	);
}
