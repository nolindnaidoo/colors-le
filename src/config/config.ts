import * as vscode from 'vscode';
import type { Configuration, SortMode } from '../types';

/**
 * Fallback values, kept identical to the defaults declared in
 * package.json contributes.configuration. A unit test asserts parity so
 * the two can never drift again.
 */
export const CONFIG_DEFAULTS = Object.freeze({
	copyToClipboardEnabled: false,
	dedupeEnabled: false,
	notificationsLevel: 'silent' as const,
	openResultsSideBySide: true,
	safetyEnabled: true,
	safetyFileSizeWarnBytes: 1_000_000,
	safetyLargeOutputLinesThreshold: 50_000,
	sortMode: 'off' as const,
	statusBarEnabled: true,
	telemetryEnabled: false,
});

export function getConfiguration(): Configuration {
	const config = vscode.workspace.getConfiguration('colors-le');

	return Object.freeze({
		copyToClipboardEnabled: readBoolean(
			config,
			'copyToClipboardEnabled',
			CONFIG_DEFAULTS.copyToClipboardEnabled,
		),
		dedupeEnabled: readBoolean(
			config,
			'dedupeEnabled',
			CONFIG_DEFAULTS.dedupeEnabled,
		),
		notificationsLevel: readNotificationLevel(config),
		openResultsSideBySide: readBoolean(
			config,
			'openResultsSideBySide',
			CONFIG_DEFAULTS.openResultsSideBySide,
		),
		safetyEnabled: readBoolean(
			config,
			'safety.enabled',
			CONFIG_DEFAULTS.safetyEnabled,
		),
		safetyFileSizeWarnBytes: readNumber(
			config,
			'safety.fileSizeWarnBytes',
			CONFIG_DEFAULTS.safetyFileSizeWarnBytes,
			1000,
		),
		safetyLargeOutputLinesThreshold: readNumber(
			config,
			'safety.largeOutputLinesThreshold',
			CONFIG_DEFAULTS.safetyLargeOutputLinesThreshold,
			100,
		),
		sortMode: readSortMode(config),
		statusBarEnabled: readBoolean(
			config,
			'statusBar.enabled',
			CONFIG_DEFAULTS.statusBarEnabled,
		),
		telemetryEnabled: readBoolean(
			config,
			'telemetryEnabled',
			CONFIG_DEFAULTS.telemetryEnabled,
		),
	});
}

function readBoolean(
	config: vscode.WorkspaceConfiguration,
	key: string,
	defaultValue: boolean,
): boolean {
	const value = config.get(key, defaultValue);
	return typeof value === 'boolean' ? value : defaultValue;
}

function readNumber(
	config: vscode.WorkspaceConfiguration,
	key: string,
	defaultValue: number,
	minValue: number,
): number {
	const value = Number(config.get(key, defaultValue));
	if (!Number.isFinite(value)) {
		return defaultValue;
	}
	return Math.max(minValue, value);
}

export type NotificationLevel = 'all' | 'important' | 'silent';

export function isValidNotificationLevel(v: unknown): v is NotificationLevel {
	return v === 'all' || v === 'important' || v === 'silent';
}

function readNotificationLevel(
	config: vscode.WorkspaceConfiguration,
): NotificationLevel {
	const raw = config.get<string>(
		'notificationsLevel',
		CONFIG_DEFAULTS.notificationsLevel,
	);
	return isValidNotificationLevel(raw)
		? raw
		: CONFIG_DEFAULTS.notificationsLevel;
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

function readSortMode(config: vscode.WorkspaceConfiguration): SortMode {
	const raw = config.get<string>('sortMode', CONFIG_DEFAULTS.sortMode);
	return isValidSortMode(raw) ? raw : CONFIG_DEFAULTS.sortMode;
}
