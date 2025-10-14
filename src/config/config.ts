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
