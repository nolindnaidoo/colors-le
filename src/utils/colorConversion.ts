import type { ColorFormat } from '../types';
import { parseModernColor } from './cssColor';
import { NAMED_COLOR_RGB } from './namedColors';

/**
 * Which of (c, x, 0) lands in r, g and b, per 60-degree hue sector.
 */
const HUE_SECTOR_CHANNELS = Object.freeze([
	[0, 1, 2],
	[1, 0, 2],
	[2, 0, 1],
	[2, 1, 0],
	[1, 2, 0],
	[0, 2, 1],
] as const);

export interface RgbColor {
	readonly r: number;
	readonly g: number;
	readonly b: number;
	readonly a?: number | undefined;
}

export interface HslColor {
	readonly h: number;
	readonly s: number;
	readonly l: number;
	readonly a?: number | undefined;
}

/**
 * Read any notation the extractor reports: hex in 3, 4, 6 or 8 digits, the
 * legacy comma syntax of rgb()/rgba()/hsl()/hsla() in either case, the CSS
 * keywords with `transparent`, and the CSS Color 4 syntax `cssColor.ts`
 * reads. Validate, Filter, Analyze and Convert all read through here, so
 * what Extract finds, each of them can judge.
 */
export function parseColor(colorValue: string): RgbColor | null {
	const trimmed = colorValue.trim().toLowerCase();

	// Hex colors
	if (trimmed.startsWith('#')) {
		return parseHex(trimmed);
	}

	// RGB/RGBA colors
	if (trimmed.startsWith('rgb')) {
		return parseRgb(trimmed) ?? parseModernColor(trimmed);
	}

	// HSL/HSLA colors
	if (trimmed.startsWith('hsl')) {
		return parseHsl(trimmed) ?? parseModernColor(trimmed);
	}

	return parseNamed(trimmed) ?? parseModernColor(trimmed);
}

/**
 * `transparent` is the one keyword with alpha. The table is a frozen plain
 * object, so a prototype name is looked up with `hasOwn` rather than read
 * off it: `constructor` is not a colour.
 */
function parseNamed(name: string): RgbColor | null {
	if (name === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
	if (!Object.hasOwn(NAMED_COLOR_RGB, name)) return null;
	const rgb = NAMED_COLOR_RGB[name];
	return rgb ? { r: rgb[0], g: rgb[1], b: rgb[2] } : null;
}

function parseHex(hex: string): RgbColor | null {
	const digits = hex.slice(1);
	if (!/^[0-9a-f]+$/.test(digits)) return null;

	// A 3- or 4-digit hex doubles each digit: #rgb[a] is #rrggbb[aa].
	const full =
		digits.length === 3 || digits.length === 4
			? digits.replace(/./g, (digit) => digit + digit)
			: digits;

	if (full.length !== 6 && full.length !== 8) return null;

	const r = parseInt(full.substring(0, 2), 16);
	const g = parseInt(full.substring(2, 4), 16);
	const b = parseInt(full.substring(4, 6), 16);
	if (full.length === 8) {
		return { r, g, b, a: parseInt(full.substring(6, 8), 16) / 255 };
	}
	return { r, g, b };
}

function parseRgb(rgb: string): RgbColor | null {
	const match = rgb.match(
		/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/,
	);
	if (!match) return null;

	const r = parseInt(match[1] ?? '0', 10);
	const g = parseInt(match[2] ?? '0', 10);
	const b = parseInt(match[3] ?? '0', 10);
	const a = match[4] ? parseFloat(match[4]) : undefined;

	return { r, g, b, a };
}

function parseHsl(hsl: string): RgbColor | null {
	const match = hsl.match(
		/hsla?\s*\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%(?:\s*,\s*([\d.]+))?\s*\)/,
	);
	if (!match) return null;

	const h = parseInt(match[1] ?? '0', 10);
	const s = parseInt(match[2] ?? '0', 10);
	const l = parseInt(match[3] ?? '0', 10);
	const a = match[4] ? parseFloat(match[4]) : undefined;

	return hslToRgb({ h, s, l, a });
}

function hslToRgb(hsl: HslColor): RgbColor {
	const { h, s, l } = hsl;
	const hNorm = h / 360;
	const sNorm = s / 100;
	const lNorm = l / 100;

	const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
	const x = c * (1 - Math.abs(((hNorm * 6) % 2) - 1));
	const m = lNorm - c / 2;

	// Each hue sector is the same three values (c, x, 0) in a different order,
	// which the six-arm chain this replaced restated one channel at a time.
	const channels = [c, x, 0] as const;
	const sector = Math.min(5, Math.floor(hNorm * 6));
	const [ri, gi, bi] = HUE_SECTOR_CHANNELS[sector] ?? [0, 1, 2];
	const r = channels[ri];
	const g = channels[gi];
	const b = channels[bi];

	return {
		r: Math.round((r + m) * 255),
		g: Math.round((g + m) * 255),
		b: Math.round((b + m) * 255),
		a: hsl.a,
	};
}

export function rgbToHex(rgb: RgbColor): string {
	const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
	const hex = `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;

	if (rgb.a !== undefined && rgb.a < 1) {
		const alphaHex = Math.round(rgb.a * 255)
			.toString(16)
			.padStart(2, '0');
		return hex + alphaHex;
	}

	return hex;
}

export function rgbToHsl(rgb: RgbColor): HslColor {
	const { r, g, b } = rgb;
	const rNorm = r / 255;
	const gNorm = g / 255;
	const bNorm = b / 255;

	const max = Math.max(rNorm, gNorm, bNorm);
	const min = Math.min(rNorm, gNorm, bNorm);
	const diff = max - min;

	let h = 0;
	let s = 0;
	const l = (max + min) / 2;

	if (diff !== 0) {
		s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);

		switch (max) {
			case rNorm:
				h = ((gNorm - bNorm) / diff + (gNorm < bNorm ? 6 : 0)) / 6;
				break;
			case gNorm:
				h = ((bNorm - rNorm) / diff + 2) / 6;
				break;
			case bNorm:
				h = ((rNorm - gNorm) / diff + 4) / 6;
				break;
		}
	}

	return {
		// A hue just under 360 rounds to 360, which no sector of the wheel
		// includes; it is 0.
		h: Math.round(h * 360) % 360,
		s: Math.round(s * 100),
		l: Math.round(l * 100),
		a: rgb.a,
	};
}

export function rgbToRgbString(rgb: RgbColor): string {
	if (rgb.a !== undefined) {
		return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${rgb.a})`;
	}
	return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

export function rgbToHslString(rgb: RgbColor): string {
	const hsl = rgbToHsl(rgb);
	if (hsl.a !== undefined) {
		return `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${hsl.a})`;
	}
	return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}

export function detectColorFormat(colorValue: string): ColorFormat {
	const trimmed = colorValue.trim();

	if (trimmed.startsWith('#')) {
		return 'hex';
	}

	if (trimmed.startsWith('rgb(')) {
		return 'rgb';
	}

	if (trimmed.startsWith('rgba(')) {
		return 'rgba';
	}

	if (trimmed.startsWith('hsl(')) {
		return 'hsl';
	}

	if (trimmed.startsWith('hsla(')) {
		return 'hsla';
	}

	for (const name of [
		'hwb',
		'lab',
		'lch',
		'oklab',
		'oklch',
		'color',
	] as const) {
		if (trimmed.startsWith(`${name}(`)) return name;
	}

	return 'unknown';
}

/**
 * Whether a string is a colour this extension can read: exactly the
 * notations `parseColor` reads, so Validate cannot call a keyword or a
 * 4-digit hex invalid after Extract reported it. Used by the validate
 * command and by the input-box validators, which is why it lives here
 * rather than inside either of them.
 */
export function isValidColorFormat(color: string): boolean {
	return parseColor(color) !== null;
}

/**
 * Parse any colour this reads to HSL components.
 *
 * The analyse, filter and validate commands each carried their own copy of
 * this; they were behaviourally identical but had already drifted in their
 * comments, and a lightness threshold that disagreed between filtering and
 * reporting would have been very hard to spot. It then read a 6-digit hex,
 * a legacy hsl() and modern syntax alone, so an rgb(), an hsla(), a short
 * hex or a keyword had no lightness and passed every filter untested.
 */
export function parseColorToHSL(
	color: string,
): { h: number; s: number; l: number } | null {
	const rgb = parseColor(color);
	if (!rgb) return null;
	const { h, s, l } = rgbToHsl(rgb);
	return { h, s, l };
}
