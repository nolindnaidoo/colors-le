import type { Color } from '../types';
// Single source of truth for RGB->HSL. This module used to carry its own
// byte-identical copy under a parallel type vocabulary (ColorSpace/HSLSpace vs
// RgbColor/HslColor); the two were verified equivalent across the 8-bit cube
// before the duplicate was removed. The interfaces differ only by `readonly`,
// which TypeScript ignores for assignability.
import {
	parseColor,
	rgbToHsl as sharedRgbToHsl,
} from '../utils/colorConversion';
import { srgbToOklch } from '../utils/cssColor';

export interface ColorConversionOptions {
	readonly targetFormat: 'hex' | 'rgb' | 'rgba' | 'hsl' | 'hsla' | 'oklch';
	readonly preserveAlpha?: boolean | undefined;
	readonly roundValues?: boolean | undefined;
	readonly uppercase?: boolean | undefined;
	readonly shortHex?: boolean | undefined;
}

export interface ColorConversionResult {
	readonly original: Color;
	readonly converted: string;
	readonly format: string;
	readonly timestamp: number;
	readonly success: boolean;
	readonly error?: string | undefined;
}

export interface ColorSpace {
	readonly r: number;
	readonly g: number;
	readonly b: number;
	readonly a?: number | undefined;
}

export interface HSLSpace {
	readonly h: number;
	readonly s: number;
	readonly l: number;
	readonly a?: number | undefined;
}

export interface OKLCHSpace {
	readonly l: number;
	readonly c: number;
	readonly h: number;
	readonly a?: number | undefined;
}

/**
 * Convert a single color to the target format
 */
export function convertColor(
	color: Color,
	options: ColorConversionOptions,
): ColorConversionResult {
	try {
		const rgb = readColor(color.value);
		if (!rgb) {
			return Object.freeze({
				original: color,
				converted: color.value,
				format: options.targetFormat,
				timestamp: Date.now(),
				success: false,
				error: `Unable to parse color: ${color.value}`,
			});
		}

		let converted: string;
		switch (options.targetFormat) {
			case 'hex':
				converted = rgbToHex(rgb, options);
				break;
			case 'rgb':
				converted = rgbToRgbString(rgb, options);
				break;
			case 'rgba':
				converted = rgbToRgbaString(rgb, options);
				break;
			case 'hsl':
				converted = rgbToHslString(rgb, options);
				break;
			case 'hsla':
				converted = rgbToHslaString(rgb, options);
				break;
			case 'oklch':
				converted = rgbToOklchString(rgb, options);
				break;
			default:
				throw new Error(`Unsupported target format: ${options.targetFormat}`);
		}

		return Object.freeze({
			original: color,
			converted,
			format: options.targetFormat,
			timestamp: Date.now(),
			success: true,
		});
	} catch (error) {
		return Object.freeze({
			original: color,
			converted: color.value,
			format: options.targetFormat,
			timestamp: Date.now(),
			success: false,
			error:
				error instanceof Error ? error.message : 'Unknown conversion error',
		});
	}
}

/**
 * Convert multiple colors to the target format
 */
export function convertColors(
	colors: readonly Color[],
	options: ColorConversionOptions,
): readonly ColorConversionResult[] {
	return Object.freeze(colors.map((color) => convertColor(color, options)));
}

/**
 * Get available color formats for conversion
 */
/** The formats convertColor can actually emit. */
export type TargetFormat = ColorConversionOptions['targetFormat'];

export function getAvailableFormats(): readonly TargetFormat[] {
	// Declared as the union rather than string[] so the choice stays typed all
	// the way from the quick-pick to convertColor; returning string[] here is
	// what forced an unchecked cast back to the union at the call site.
	return Object.freeze(['hex', 'rgb', 'rgba', 'hsl', 'hsla', 'oklch'] as const);
}

/**
 * The one reader every command uses, so Convert and Validate's contrast
 * cannot read a colour differently from Extract, Filter and Analyze. An
 * alpha of 1 is opaque, so it is dropped rather than written as `ff`.
 */
function readColor(value: string): ColorSpace | null {
	const rgb = parseColor(value);
	if (rgb === null) return null;
	return rgb.a === 1 ? { r: rgb.r, g: rgb.g, b: rgb.b } : rgb;
}

/**
 * Convert RGB to hex
 */
function rgbToHex(rgb: ColorSpace, options: ColorConversionOptions): string {
	const toHex = (value: number): string => {
		const hex = Math.round(Math.max(0, Math.min(255, value))).toString(16);
		return hex.length === 1 ? `0${hex}` : hex;
	};

	let hex = `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;

	if (rgb.a !== undefined && options.preserveAlpha) {
		hex += toHex(rgb.a * 255);
	}

	if (options.shortHex && hex.length === 7) {
		// Try to convert to short hex if possible
		const r = hex.slice(1, 3);
		const g = hex.slice(3, 5);
		const b = hex.slice(5, 7);
		if (r[0] === r[1] && g[0] === g[1] && b[0] === b[1]) {
			hex = `#${r[0]}${g[0]}${b[0]}`;
		}
	}

	return options.uppercase ? hex.toUpperCase() : hex;
}

/**
 * Convert RGB to RGB string
 */
function rgbToRgbString(
	rgb: ColorSpace,
	options: ColorConversionOptions,
): string {
	const r = options.roundValues ? Math.round(rgb.r) : rgb.r;
	const g = options.roundValues ? Math.round(rgb.g) : rgb.g;
	const b = options.roundValues ? Math.round(rgb.b) : rgb.b;

	return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Convert RGB to RGBA string
 */
function rgbToRgbaString(
	rgb: ColorSpace,
	options: ColorConversionOptions,
): string {
	const r = options.roundValues ? Math.round(rgb.r) : rgb.r;
	const g = options.roundValues ? Math.round(rgb.g) : rgb.g;
	const b = options.roundValues ? Math.round(rgb.b) : rgb.b;
	const a = rgb.a !== undefined ? rgb.a : 1;

	return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Convert RGB to HSL string
 */
function rgbToHslString(
	rgb: ColorSpace,
	options: ColorConversionOptions,
): string {
	const hsl = sharedRgbToHsl(rgb);
	const h = options.roundValues ? Math.round(hsl.h) : hsl.h;
	const s = options.roundValues ? Math.round(hsl.s) : hsl.s;
	const l = options.roundValues ? Math.round(hsl.l) : hsl.l;

	return `hsl(${h}, ${s}%, ${l}%)`;
}

/**
 * Convert RGB to HSLA string
 */
function rgbToHslaString(
	rgb: ColorSpace,
	options: ColorConversionOptions,
): string {
	const hsl = sharedRgbToHsl(rgb);
	const h = options.roundValues ? Math.round(hsl.h) : hsl.h;
	const s = options.roundValues ? Math.round(hsl.s) : hsl.s;
	const l = options.roundValues ? Math.round(hsl.l) : hsl.l;
	const a = rgb.a !== undefined ? rgb.a : 1;

	return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

/**
 * Convert RGB to OKLCH string. This used to relabel HSL as OKLCH, which put
 * every hue and lightness in the wrong place: red came out `oklch(0.5 0.4 0)`
 * rather than `oklch(0.628 0.258 29.23)`.
 */
function rgbToOklchString(
	rgb: ColorSpace,
	options: ColorConversionOptions,
): string {
	const { l, c, h } = srgbToOklch(rgb.r, rgb.g, rgb.b);

	const lVal = options.roundValues ? Math.round(l * 1000) / 1000 : l;
	const cVal = options.roundValues ? Math.round(c * 1000) / 1000 : c;
	const hVal = options.roundValues ? Math.round(h * 100) / 100 : h;
	const alpha =
		options.preserveAlpha && rgb.a !== undefined && rgb.a < 1
			? ` / ${rgb.a}`
			: '';

	return `oklch(${lVal} ${cVal} ${hVal}${alpha})`;
}

/**
 * The WCAG contrast ratio between two colours, or null when either cannot
 * be read. It answered 1 for an unreadable colour, and 1 is a real answer,
 * "the same colour", so Validate printed "Contrast ratio 1.00:1 fails WCAG
 * AA" for a value it had never read.
 */
export function getContrastRatio(
	color1: string,
	color2: string,
): number | null {
	const rgb1 = readColor(color1);
	const rgb2 = readColor(color2);

	if (!rgb1 || !rgb2) return null;

	const luminance1 = getRelativeLuminance(rgb1);
	const luminance2 = getRelativeLuminance(rgb2);

	const lighter = Math.max(luminance1, luminance2);
	const darker = Math.min(luminance1, luminance2);

	return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Calculate relative luminance
 */
function getRelativeLuminance(rgb: ColorSpace): number {
	const sRGB = (value: number): number => {
		value = value / 255;
		return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	};

	return 0.2126 * sRGB(rgb.r) + 0.7152 * sRGB(rgb.g) + 0.0722 * sRGB(rgb.b);
}
