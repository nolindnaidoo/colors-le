import type { ColorFormat } from '../types';

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
	r: number;
	g: number;
	b: number;
	a?: number | undefined;
}

export interface HslColor {
	h: number;
	s: number;
	l: number;
	a?: number | undefined;
}

export function parseColor(colorValue: string): RgbColor | null {
	const trimmed = colorValue.trim();

	// Hex colors
	if (trimmed.startsWith('#')) {
		return parseHex(trimmed);
	}

	// RGB/RGBA colors
	if (trimmed.startsWith('rgb')) {
		return parseRgb(trimmed);
	}

	// HSL/HSLA colors
	if (trimmed.startsWith('hsl')) {
		return parseHsl(trimmed);
	}

	return null;
}

function parseHex(hex: string): RgbColor | null {
	const cleanHex = hex.replace('#', '');

	if (cleanHex.length === 3) {
		// Short hex format (#RGB)
		const r = parseInt((cleanHex[0] ?? '0') + (cleanHex[0] ?? '0'), 16);
		const g = parseInt((cleanHex[1] ?? '0') + (cleanHex[1] ?? '0'), 16);
		const b = parseInt((cleanHex[2] ?? '0') + (cleanHex[2] ?? '0'), 16);
		return { r, g, b };
	}

	if (cleanHex.length === 6) {
		// Full hex format (#RRGGBB)
		const r = parseInt(cleanHex.substring(0, 2), 16);
		const g = parseInt(cleanHex.substring(2, 4), 16);
		const b = parseInt(cleanHex.substring(4, 6), 16);
		return { r, g, b };
	}

	if (cleanHex.length === 8) {
		// Hex with alpha (#RRGGBBAA)
		const r = parseInt(cleanHex.substring(0, 2), 16);
		const g = parseInt(cleanHex.substring(2, 4), 16);
		const b = parseInt(cleanHex.substring(4, 6), 16);
		const a = parseInt(cleanHex.substring(6, 8), 16) / 255;
		return { r, g, b, a };
	}

	return null;
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
		h: Math.round(h * 360),
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

	return 'unknown';
}

/**
 * Whether a string is a syntactically valid CSS colour in a format this
 * extension understands. Used by the validate command and by the input-box
 * validators, which is why it lives here rather than inside either of them.
 */
export function isValidColorFormat(color: string): boolean {
	const patterns = [
		/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i,
		/^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i,
		/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/i,
		/^hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)$/i,
		/^hsla\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*,\s*[\d.]+\s*\)$/i,
	];

	return patterns.some((pattern) => pattern.test(color));
}

/**
 * Parse a hex colour to HSL. Returns null for anything that is not a 6-digit
 * hex value.
 */
export function hexToHSL(
	hex: string,
): { h: number; s: number; l: number } | null {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	if (!result?.[1] || !result[2] || !result[3]) return null;

	const rgb: RgbColor = {
		r: Number.parseInt(result[1], 16),
		g: Number.parseInt(result[2], 16),
		b: Number.parseInt(result[3], 16),
	};
	const { h, s, l } = rgbToHsl(rgb);
	return { h, s, l };
}

/**
 * Parse a hex or hsl() colour to HSL components.
 *
 * The analyse, filter and validate commands each carried their own copy of
 * this; they were behaviourally identical but had already drifted in their
 * comments, and a lightness threshold that disagreed between filtering and
 * reporting would have been very hard to spot.
 */
export function parseColorToHSL(
	color: string,
): { h: number; s: number; l: number } | null {
	if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) {
		return hexToHSL(color);
	}

	const hsl = color.match(/hsl\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/i);
	if (hsl?.[1] && hsl[2] && hsl[3]) {
		return {
			h: Number.parseInt(hsl[1], 10),
			s: Number.parseInt(hsl[2], 10),
			l: Number.parseInt(hsl[3], 10),
		};
	}

	return null;
}
