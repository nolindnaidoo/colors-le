import * as vscode from 'vscode';
import type { Color, Draft } from '../types';
import type { ColorFilterOptions } from './filterTypes';

/**
 * Prompt user for filter options
 */
export async function promptForFilterOptions(
	colors: readonly Color[],
): Promise<ColorFilterOptions | undefined> {
	const options: Draft<ColorFilterOptions> = {};

	// Get available formats from the colors
	const availableFormats = [...new Set(colors.map((c) => c.format))].sort();

	// Format filtering
	const formatAction = await vscode.window.showQuickPick(
		[
			{
				label: vscode.l10n.t('Include specific formats'),
				description: vscode.l10n.t('Only keep selected formats'),
				value: 'include',
			},
			{
				label: vscode.l10n.t('Exclude specific formats'),
				description: vscode.l10n.t('Remove selected formats'),
				value: 'exclude',
			},
			{
				label: vscode.l10n.t('Keep all formats'),
				description: vscode.l10n.t('No format filtering'),
				value: 'none',
			},
		],
		{
			placeHolder: vscode.l10n.t('How do you want to filter by format?'),
		},
	);

	if (formatAction === undefined) return undefined;

	if (formatAction.value === 'include') {
		const selectedFormats = await vscode.window.showQuickPick(
			availableFormats.map((format) => ({
				label: format.toUpperCase(),
				description: `${colors.filter((c) => c.format === format).length} colors`,
				picked: true,
			})),
			{
				placeHolder: vscode.l10n.t('Select formats to include'),
				canPickMany: true,
			},
		);

		if (selectedFormats === undefined) return undefined;
		options.formats = selectedFormats.map((f) => f.label.toLowerCase());
	} else if (formatAction.value === 'exclude') {
		const selectedFormats = await vscode.window.showQuickPick(
			availableFormats.map((format) => ({
				label: format.toUpperCase(),
				description: `${colors.filter((c) => c.format === format).length} colors`,
				picked: false,
			})),
			{
				placeHolder: vscode.l10n.t('Select formats to exclude'),
				canPickMany: true,
			},
		);

		if (selectedFormats === undefined) return undefined;
		options.excludeFormats = selectedFormats.map((f) => f.label.toLowerCase());
	}

	// Lightness filtering
	const lightnessFilter = await vscode.window.showQuickPick(
		[
			{
				label: vscode.l10n.t('No lightness filter'),
				description: vscode.l10n.t('Keep all lightness values'),
				value: 'none',
			},
			{
				label: vscode.l10n.t('Dark colors only'),
				description: vscode.l10n.t('Lightness < 30%'),
				value: 'dark',
			},
			{
				label: vscode.l10n.t('Light colors only'),
				description: vscode.l10n.t('Lightness > 70%'),
				value: 'light',
			},
			{
				label: vscode.l10n.t('Medium colors only'),
				description: vscode.l10n.t('30% ≤ Lightness ≤ 70%'),
				value: 'medium',
			},
			{
				label: vscode.l10n.t('Custom range'),
				description: vscode.l10n.t('Specify min/max lightness'),
				value: 'custom',
			},
		],
		{
			placeHolder: vscode.l10n.t('Filter by lightness?'),
		},
	);

	if (lightnessFilter === undefined) return undefined;

	switch (lightnessFilter.value) {
		case 'dark': {
			options.maxLightness = 30;
			break;
		}
		case 'light': {
			options.minLightness = 70;
			break;
		}
		case 'medium': {
			options.minLightness = 30;
			options.maxLightness = 70;
			break;
		}
		case 'custom': {
			const minLightness = await vscode.window.showInputBox({
				prompt: vscode.l10n.t('Minimum lightness (0-100)'),
				value: '0',
				validateInput: (value) => {
					const num = Number.parseInt(value, 10);
					return Number.isNaN(num) || num < 0 || num > 100
						? vscode.l10n.t('Enter a number between 0 and 100')
						: undefined;
				},
			});
			if (minLightness === undefined) return undefined;

			const maxLightness = await vscode.window.showInputBox({
				prompt: vscode.l10n.t('Maximum lightness (0-100)'),
				value: '100',
				validateInput: (value) => {
					const num = Number.parseInt(value, 10);
					return Number.isNaN(num) || num < 0 || num > 100
						? vscode.l10n.t('Enter a number between 0 and 100')
						: undefined;
				},
			});
			if (maxLightness === undefined) return undefined;

			options.minLightness = Number.parseInt(minLightness, 10);
			options.maxLightness = Number.parseInt(maxLightness, 10);
			break;
		}
	}

	// Saturation filtering
	const saturationFilter = await vscode.window.showQuickPick(
		[
			{
				label: vscode.l10n.t('No saturation filter'),
				description: vscode.l10n.t('Keep all saturation values'),
				value: 'none',
			},
			{
				label: vscode.l10n.t('Vibrant colors only'),
				description: vscode.l10n.t('Saturation > 70%'),
				value: 'vibrant',
			},
			{
				label: vscode.l10n.t('Muted colors only'),
				description: vscode.l10n.t('Saturation < 30%'),
				value: 'muted',
			},
			{
				label: vscode.l10n.t('Custom range'),
				description: vscode.l10n.t('Specify min/max saturation'),
				value: 'custom',
			},
		],
		{
			placeHolder: vscode.l10n.t('Filter by saturation?'),
		},
	);

	if (saturationFilter === undefined) return undefined;

	switch (saturationFilter.value) {
		case 'vibrant': {
			options.minSaturation = 70;
			break;
		}
		case 'muted': {
			options.maxSaturation = 30;
			break;
		}
		case 'custom': {
			const minSaturation = await vscode.window.showInputBox({
				prompt: vscode.l10n.t('Minimum saturation (0-100)'),
				value: '0',
				validateInput: (value) => {
					const num = Number.parseInt(value, 10);
					return Number.isNaN(num) || num < 0 || num > 100
						? vscode.l10n.t('Enter a number between 0 and 100')
						: undefined;
				},
			});
			if (minSaturation === undefined) return undefined;

			const maxSaturation = await vscode.window.showInputBox({
				prompt: vscode.l10n.t('Maximum saturation (0-100)'),
				value: '100',
				validateInput: (value) => {
					const num = Number.parseInt(value, 10);
					return Number.isNaN(num) || num < 0 || num > 100
						? vscode.l10n.t('Enter a number between 0 and 100')
						: undefined;
				},
			});
			if (maxSaturation === undefined) return undefined;

			options.minSaturation = Number.parseInt(minSaturation, 10);
			options.maxSaturation = Number.parseInt(maxSaturation, 10);
			break;
		}
	}

	// Additional filters
	// Bound once and reused for both the item and the identity check below.
	// showQuickPick returns the item, and these are matched by label — a
	// comparison against an English literal silently selects nothing in every
	// other language.
	const dupesLabel = vscode.l10n.t('Exclude duplicates');
	const invalidLabel = vscode.l10n.t('Exclude invalid colors');
	const transparentLabel = vscode.l10n.t('Exclude transparent');

	const additionalFilters = await vscode.window.showQuickPick(
		[
			{
				label: dupesLabel,
				description: vscode.l10n.t('Remove duplicate color values'),
				picked: false,
			},
			{
				label: invalidLabel,
				description: vscode.l10n.t('Remove malformed colors'),
				picked: false,
			},
			{
				label: transparentLabel,
				description: vscode.l10n.t('Remove transparent/alpha colors'),
				picked: false,
			},
		],
		{
			placeHolder: vscode.l10n.t('Additional filters (optional)'),
			canPickMany: true,
		},
	);

	if (additionalFilters === undefined) return undefined;

	options.excludeDuplicates = additionalFilters.some(
		(f) => f.label === dupesLabel,
	);
	options.excludeInvalid = additionalFilters.some(
		(f) => f.label === invalidLabel,
	);
	options.excludeTransparent = additionalFilters.some(
		(f) => f.label === transparentLabel,
	);

	return options;
}
