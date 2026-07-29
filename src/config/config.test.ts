import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFIG_DEFAULTS } from './config';

/**
 * CONFIG_DEFAULTS must stay identical to the defaults declared in
 * package.json contributes.configuration — v1.x shipped with the two
 * silently disagreeing (openResultsSideBySide read a false fallback
 * while the manifest declared true).
 */
describe('config defaults parity with package.json', () => {
	const manifest = JSON.parse(
		readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'),
	) as {
		contributes: {
			configuration: { properties: Record<string, { default: unknown }> };
		};
	};
	const props = manifest.contributes.configuration.properties;

	const KEY_MAP: Record<string, keyof typeof CONFIG_DEFAULTS> = {
		'colors-le.copyToClipboardEnabled': 'copyToClipboardEnabled',
		'colors-le.dedupeEnabled': 'dedupeEnabled',
		'colors-le.notificationsLevel': 'notificationsLevel',
		'colors-le.openResultsSideBySide': 'openResultsSideBySide',
		'colors-le.safety.enabled': 'safetyEnabled',
		'colors-le.safety.fileSizeWarnBytes': 'safetyFileSizeWarnBytes',
		'colors-le.safety.largeOutputLinesThreshold':
			'safetyLargeOutputLinesThreshold',
		'colors-le.sortMode': 'sortMode',
		'colors-le.statusBar.enabled': 'statusBarEnabled',
		'colors-le.telemetryEnabled': 'telemetryEnabled',
	};

	it('covers every declared setting', () => {
		expect(Object.keys(props).sort()).toEqual(Object.keys(KEY_MAP).sort());
	});

	for (const [manifestKey, defaultsKey] of Object.entries(KEY_MAP)) {
		it(`${manifestKey} default matches`, () => {
			expect(CONFIG_DEFAULTS[defaultsKey]).toBe(props[manifestKey]?.default);
		});
	}
});
