import * as vscode from 'vscode';
import type { Draft } from '../types';
import { isValidColorFormat } from '../utils/colorConversion';
import type { ColorValidationOptions } from './validateTypes';

/**
 * Prompt user for validation options
 */
export async function promptForValidationOptions(): Promise<
	ColorValidationOptions | undefined
> {
	const options: Draft<ColorValidationOptions> = {};

	// Basic validation checks
	// Bound once and reused for both the item and the identity check below.
	// showQuickPick returns the item, and these are matched by label — a
	// comparison against an English literal silently selects nothing in every
	// other language.
	const formatLabel = vscode.l10n.t('Format validation');
	const a11yLabel = vscode.l10n.t('Accessibility validation');
	const contrastLabel = vscode.l10n.t('Contrast validation');
	const blindnessLabel = vscode.l10n.t('Color blindness check');

	const basicChecks = await vscode.window.showQuickPick(
		[
			{
				label: formatLabel,
				description: vscode.l10n.t('Check color format validity'),
				picked: true,
			},
			{
				label: a11yLabel,
				description: vscode.l10n.t('Check accessibility compliance'),
				picked: true,
			},
			{
				label: contrastLabel,
				description: vscode.l10n.t('Check contrast ratios'),
				picked: false,
			},
			{
				label: blindnessLabel,
				description: vscode.l10n.t('Check color blindness compatibility'),
				picked: false,
			},
		],
		{
			placeHolder: vscode.l10n.t('Select validation checks'),
			canPickMany: true,
		},
	);

	if (basicChecks === undefined) return undefined;

	options.checkFormat = basicChecks.some((c) => c.label === formatLabel);
	options.checkAccessibility = basicChecks.some((c) => c.label === a11yLabel);
	options.checkContrast = basicChecks.some((c) => c.label === contrastLabel);
	options.checkColorBlindness = basicChecks.some(
		(c) => c.label === blindnessLabel,
	);

	// Contrast validation options
	if (options.checkContrast) {
		const background = await vscode.window.showInputBox({
			prompt: vscode.l10n.t(
				'Background color for contrast checking (default: #ffffff)',
			),
			value: '#ffffff',
			validateInput: (value) => {
				return isValidColorFormat(value)
					? undefined
					: vscode.l10n.t('Enter a valid color (hex, rgb, hsl, etc.)');
			},
		});

		if (background === undefined) return undefined;
		options.contrastBackground = background;

		const contrastLevel = await vscode.window.showQuickPick(
			[
				{
					label: vscode.l10n.t('WCAG AA'),
					description: vscode.l10n.t(
						'Minimum 4.5:1 for normal text, 3:1 for large text',
					),
					value: 'AA',
				},
				{
					label: vscode.l10n.t('WCAG AAA'),
					description: vscode.l10n.t(
						'Minimum 7:1 for normal text, 4.5:1 for large text',
					),
					value: 'AAA',
				},
				{
					label: vscode.l10n.t('Custom'),
					description: vscode.l10n.t('Specify custom contrast ratios'),
					value: 'custom',
				},
			],
			{
				placeHolder: vscode.l10n.t('Select contrast level'),
			},
		);

		if (contrastLevel === undefined) return undefined;

		if (contrastLevel.value === 'AA') {
			options.minContrastAA = 4.5;
		}
		if (contrastLevel.value === 'AAA') {
			options.minContrastAAA = 7.0;
		}
		if (contrastLevel.value === 'custom') {
			const minAA = await vscode.window.showInputBox({
				prompt: vscode.l10n.t('Minimum contrast ratio for AA compliance'),
				value: '4.5',
				validateInput: (value) => {
					const num = Number.parseFloat(value);
					return Number.isNaN(num) || num <= 0
						? vscode.l10n.t('Enter a positive number')
						: undefined;
				},
			});

			if (minAA === undefined) return undefined;
			options.minContrastAA = Number.parseFloat(minAA);

			const minAAA = await vscode.window.showInputBox({
				prompt: vscode.l10n.t('Minimum contrast ratio for AAA compliance'),
				value: '7.0',
				validateInput: (value) => {
					const num = Number.parseFloat(value);
					return Number.isNaN(num) || num <= 0
						? vscode.l10n.t('Enter a positive number')
						: undefined;
				},
			});

			if (minAAA === undefined) return undefined;
			options.minContrastAAA = Number.parseFloat(minAAA);
		}
	}

	// Format restrictions
	if (options.checkFormat) {
		const formatRestriction = await vscode.window.showQuickPick(
			[
				{
					label: vscode.l10n.t('Allow all formats'),
					description: vscode.l10n.t('No format restrictions'),
					value: 'all',
				},
				{
					label: vscode.l10n.t('Hex only'),
					description: vscode.l10n.t('Only allow hexadecimal colors'),
					value: 'hex',
				},
				{
					label: vscode.l10n.t('RGB/RGBA only'),
					description: vscode.l10n.t('Only allow RGB functional notation'),
					value: 'rgb',
				},
				{
					label: vscode.l10n.t('HSL/HSLA only'),
					description: vscode.l10n.t('Only allow HSL functional notation'),
					value: 'hsl',
				},
				{
					label: vscode.l10n.t('Custom selection'),
					description: vscode.l10n.t('Choose specific formats'),
					value: 'custom',
				},
			],
			{
				placeHolder: vscode.l10n.t('Format restrictions'),
			},
		);

		if (formatRestriction === undefined) return undefined;

		switch (formatRestriction.value) {
			case 'hex':
				options.allowedFormats = ['hex'];
				break;
			case 'rgb':
				options.allowedFormats = ['rgb', 'rgba'];
				break;
			case 'hsl':
				options.allowedFormats = ['hsl', 'hsla'];
				break;
			case 'custom': {
				const selectedFormats = await vscode.window.showQuickPick(
					[
						{
							label: 'HEX',
							description: vscode.l10n.t('#ff0000'),
							picked: true,
						},
						{
							label: 'RGB',
							description: vscode.l10n.t('rgb(255, 0, 0)'),
							picked: true,
						},
						{
							label: 'RGBA',
							description: vscode.l10n.t('rgba(255, 0, 0, 1)'),
							picked: true,
						},
						{
							label: 'HSL',
							description: vscode.l10n.t('hsl(0, 100%, 50%)'),
							picked: true,
						},
						{
							label: 'HSLA',
							description: vscode.l10n.t('hsla(0, 100%, 50%, 1)'),
							picked: true,
						},
						{
							label: vscode.l10n.t('Named'),
							description: vscode.l10n.t('red, blue, etc.'),
							picked: true,
						},
					],
					{
						placeHolder: vscode.l10n.t('Select allowed formats'),
						canPickMany: true,
					},
				);

				if (selectedFormats === undefined) return undefined;
				options.allowedFormats = selectedFormats.map((f) =>
					f.label.toLowerCase(),
				);
				break;
			}
		}
	}

	return options;
}
