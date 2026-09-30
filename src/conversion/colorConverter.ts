import type { Color } from '../types';
// Single source of truth for RGB->HSL. This module used to carry its own
// byte-identical copy under a parallel type vocabulary (ColorSpace/HSLSpace vs
// RgbColor/HslColor); the two were verified equivalent across the 8-bit cube
// before the duplicate was removed. The interfaces differ only by `readonly`,
// which TypeScript ignores for assignability.
import { rgbToHsl as sharedRgbToHsl } from '../utils/colorConversion';
import { parseModernColor, srgbToOklch } from '../utils/cssColor';
import { NAMED_COLOR_RGB } from '../utils/namedColors';

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
		const rgb = parseColorToRGB(color.value);
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
 * Parse a color string to RGB values
 */
function parseColorToRGB(colorString: string): ColorSpace | null {
	const color = colorString.trim().toLowerCase();

	// Hex colors
	const hexMatch = color.match(/^#([0-9a-f]{3,8})$/i);
	if (hexMatch?.[1]) {
		return parseHexToRGB(hexMatch[1]);
	}

	// RGB colors
	const rgbMatch = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
	if (rgbMatch?.[1] && rgbMatch[2] && rgbMatch[3]) {
		return {
			r: Number.parseInt(rgbMatch[1], 10),
			g: Number.parseInt(rgbMatch[2], 10),
			b: Number.parseInt(rgbMatch[3], 10),
		};
	}

	// RGBA colors
	const rgbaMatch = color.match(
		/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/,
	);
	if (rgbaMatch?.[1] && rgbaMatch[2] && rgbaMatch[3] && rgbaMatch[4]) {
		return {
			r: Number.parseInt(rgbaMatch[1], 10),
			g: Number.parseInt(rgbaMatch[2], 10),
			b: Number.parseInt(rgbaMatch[3], 10),
			a: Number.parseFloat(rgbaMatch[4]),
		};
	}

	// HSL colors
	const hslMatch = color.match(
		/^hsl\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)$/,
	);
	if (hslMatch?.[1] && hslMatch[2] && hslMatch[3]) {
		const h = Number.parseInt(hslMatch[1], 10);
		const s = Number.parseInt(hslMatch[2], 10);
		const l = Number.parseInt(hslMatch[3], 10);
		return hslToRgb(h, s, l);
	}

	// HSLA colors
	const hslaMatch = color.match(
		/^hsla\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*,\s*([\d.]+)\s*\)$/,
	);
	if (hslaMatch?.[1] && hslaMatch[2] && hslaMatch[3] && hslaMatch[4]) {
		const h = Number.parseInt(hslaMatch[1], 10);
		const s = Number.parseInt(hslaMatch[2], 10);
		const l = Number.parseInt(hslaMatch[3], 10);
		const a = Number.parseFloat(hslaMatch[4]);
		const rgb = hslToRgb(h, s, l);
		return rgb ? { ...rgb, a } : null;
	}

	// Named colors
	const namedColor = getNamedColorRGB(color);
	if (namedColor) {
		return namedColor;
	}

	// CSS Color 4: space-separated rgb()/hsl(), hwb(), lab(), lch(),
	// oklab(), oklch(), color().
	const modern = parseModernColor(color);
	if (modern) {
		return modern.a === 1 ? { r: modern.r, g: modern.g, b: modern.b } : modern;
	}

	return null;
}

/**
 * Parse hex string to RGB
 */
function parseHexToRGB(hex: string): ColorSpace | null {
	if (hex.length === 3) {
		// Short hex: #rgb -> #rrggbb
		hex = hex
			.split('')
			.map((char) => char + char)
			.join('');
	}

	if (hex.length === 6) {
		// Standard hex: #rrggbb
		return {
			r: Number.parseInt(hex.slice(0, 2), 16),
			g: Number.parseInt(hex.slice(2, 4), 16),
			b: Number.parseInt(hex.slice(4, 6), 16),
		};
	}

	if (hex.length === 8) {
		// Hex with alpha: #rrggbbaa
		return {
			r: Number.parseInt(hex.slice(0, 2), 16),
			g: Number.parseInt(hex.slice(2, 4), 16),
			b: Number.parseInt(hex.slice(4, 6), 16),
			a: Number.parseInt(hex.slice(6, 8), 16) / 255,
		};
	}

	return null;
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): ColorSpace | null {
	h = h / 360;
	s = s / 100;
	l = l / 100;

	const hue2rgb = (p: number, q: number, t: number): number => {
		if (t < 0) t += 1;
		if (t > 1) t -= 1;
		if (t < 1 / 6) return p + (q - p) * 6 * t;
		if (t < 1 / 2) return q;
		if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
		return p;
	};

	if (s === 0) {
		// Achromatic
		const value = Math.round(l * 255);
		return { r: value, g: value, b: value };
	}

	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;

	return {
		r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
		g: Math.round(hue2rgb(p, q, h) * 255),
		b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
	};
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
 * Get RGB values for named colors
 */
function getNamedColorRGB(colorName: string): ColorSpace | null {
	if (colorName === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
	const rgb = NAMED_COLOR_RGB[colorName];
	return rgb ? { r: rgb[0], g: rgb[1], b: rgb[2] } : null;
}

/**
 * Validate color format
 */
export function validateColorFormat(color: string, format: string): boolean {
	const rgb = parseColorToRGB(color);
	if (!rgb) return false;

	switch (format) {
		case 'hex':
			return /^#[0-9a-f]{3,8}$/i.test(color);
		case 'rgb':
			return /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i.test(color);
		case 'rgba':
			return /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/i.test(
				color,
			);
		case 'hsl':
			return /^hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)$/i.test(color);
		case 'hsla':
			return /^hsla\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*,\s*[\d.]+\s*\)$/i.test(
				color,
			);
		default:
			return false;
	}
}

/**
 * Get contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
	const rgb1 = parseColorToRGB(color1);
	const rgb2 = parseColorToRGB(color2);

	if (!rgb1 || !rgb2) return 1;

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
