/**
 * Comparing a colour against an approved palette, ported from the crate's
 * `extract/palette.rs`.
 *
 * Comparison is by colour, not by text: a palette written in hex must still
 * catch a violation written in `rgb()`. A named colour is only equal to
 * itself, because resolving `white` to `#ffffff` would launder a keyword
 * nobody approved into the brand's paper colour.
 *
 * Number parsing follows Rust's `str::parse`, not `Number()`, because the
 * crate is the reference here and `Number('')` is 0 where Rust refuses.
 */
import { classifyColorFormat, isNamedColor } from '../extraction/heuristics';
import { parseModernColor } from '../utils/cssColor';
import { withoutBom } from './ioError';

export interface Palette {
	readonly swatches: ReadonlySet<string>;
	readonly names: ReadonlySet<string>;
}

export interface ParsedPalette {
	readonly palette: Palette;
	readonly rejected: readonly string[];
}

type Rgba = readonly [number, number, number, number];

const RUST_FLOAT = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
const RUST_SPECIAL_FLOAT = /^[+-]?(?:inf|infinity|nan)$/i;
const RUST_U16 = /^\+?\d+$/;

export function parsePalette(text: string): ParsedPalette {
	const swatches = new Set<string>();
	const names = new Set<string>();
	const rejected: string[] = [];

	for (const entry of entries(withoutBom(text))) {
		const trimmed = trimQuotes(entry.trim()).trim();
		if (!trimmed || trimmed === '#') continue;
		if (!insert(trimmed, swatches, names)) rejected.push(trimmed);
	}

	return Object.freeze({
		palette: Object.freeze({ swatches, names }),
		rejected: Object.freeze(rejected),
	});
}

export function isEmptyPalette(palette: Palette): boolean {
	return palette.swatches.size === 0 && palette.names.size === 0;
}

/**
 * A colour this cannot resolve is not approved: a notation nobody can read is
 * exactly what a reviewer should look at.
 */
export function paletteContains(palette: Palette, value: string): boolean {
	if (classifyColorFormat(value) === 'named') {
		return palette.names.has(value.toLowerCase());
	}
	const rgba = resolve(value);
	if (!rgba) return false;
	return palette.swatches.has(rgba.join(','));
}

function insert(
	value: string,
	swatches: Set<string>,
	names: Set<string>,
): boolean {
	const notation = classifyColorFormat(value);
	if (notation === 'unknown') return false;
	if (notation === 'named') {
		if (!isNamedColor(value)) return false;
		names.add(value.toLowerCase());
		return true;
	}
	const rgba = resolve(value);
	if (!rgba) return false;
	swatches.add(rgba.join(','));
	return true;
}

/** Rust's `trim_matches('"')`: every leading and trailing quote. */
function trimQuotes(value: string): string {
	return value.replace(/^"+|"+$/g, '');
}

function entries(text: string): readonly string[] {
	const fromJson = jsonEntries(text.trim());
	if (fromJson) return fromJson;
	return text
		.split(/\r?\n/)
		.map((line) => line.trim().replace(/,+$/, ''))
		.filter((line) => line && !line.startsWith('//'));
}

function jsonEntries(text: string): readonly string[] | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		// Not JSON, so it is the one-per-line shape. That is an answer, not a
		// failure: the caller falls through to it.
		return null;
	}
	if (Array.isArray(parsed))
		return parsed.filter((item) => typeof item === 'string');
	if (typeof parsed !== 'object' || parsed === null) return null;
	// serde_json's map is a BTreeMap, so the crate reads an object's values in
	// byte order of their keys, and that order is the order rejected entries
	// are named on stderr. Object.values would put integer-like keys first.
	return Object.entries(parsed)
		.sort(([left], [right]) =>
			Buffer.compare(Buffer.from(left), Buffer.from(right)),
		)
		.map(([, item]) => item)
		.filter((item): item is string => typeof item === 'string');
}

function resolve(raw: string): Rgba | null {
	const value = raw.trim();
	const notation = classifyColorFormat(value);
	if (notation === 'hex') return resolveHex(value);
	if (notation === 'rgb' || notation === 'rgba')
		return resolveRgb(value) ?? resolveModern(value);
	if (notation === 'hsl' || notation === 'hsla')
		return resolveHsl(value) ?? resolveModern(value);
	if (notation === 'named' || notation === 'unknown') return null;
	return resolveModern(value);
}

function resolveModern(value: string): Rgba | null {
	const pixel = parseModernColor(value);
	if (!pixel) return null;
	return [pixel.r, pixel.g, pixel.b, roundChannel(pixel.a * 255)];
}

function resolveHex(value: string): Rgba | null {
	const digits = value.slice(1);
	// Lengths in UTF-8 bytes, as the crate measures them, so a multi-byte
	// character cannot make a five-character value look like a six-digit one.
	const length = Buffer.byteLength(digits);
	const short = length === 3 || length === 4;
	const long = length === 6 || length === 8;
	if (!short && !long) return null;
	const pairs = short
		? [...digits].map((digit) => digit + digit)
		: (digits.match(/../g) ?? []);
	const channels = pairs.map(parseHexPair);
	if (channels.some((channel) => channel === null)) return null;
	const parts = [255, 255, 255, 255];
	channels.forEach((channel, index) => {
		parts[index] = channel as number;
	});
	return parts as unknown as Rgba;
}

/** `u8::from_str_radix(pair, 16)`, which takes a leading `+`. */
function parseHexPair(pair: string): number | null {
	if (!/^\+?[0-9a-fA-F]+$/.test(pair)) return null;
	return Number.parseInt(pair, 16);
}

function components(value: string): readonly string[] {
	const open = value.indexOf('(');
	const inner = open === -1 ? value : value.slice(open + 1);
	return inner
		.replace(/\)+$/, '')
		.split(',')
		.map((part) => part.trim());
}

function resolveRgb(value: string): Rgba | null {
	const parts = components(value);
	if (parts.length < 3) return null;
	const channels = parts.slice(0, 3).map(parseChannel);
	const alpha = parts[3] === undefined ? 255 : toAlpha(parts[3]);
	if (channels.some((channel) => channel === null) || alpha === null)
		return null;
	return [...(channels as number[]), alpha] as unknown as Rgba;
}

function resolveHsl(value: string): Rgba | null {
	const parts = components(value);
	if (parts.length < 3) return null;
	const hue = parseRustFloat(parts[0] ?? '');
	const saturation = parseRustFloat(stripPercent(parts[1] ?? ''));
	const lightness = parseRustFloat(stripPercent(parts[2] ?? ''));
	if (hue === null || saturation === null || lightness === null) return null;
	const alpha = parts[3] === undefined ? 255 : toAlpha(parts[3]);
	if (alpha === null) return null;
	return hslToRgba(hue / 360, saturation / 100, lightness / 100, alpha);
}

function hslToRgba(
	hue: number,
	saturation: number,
	lightness: number,
	alpha: number,
): Rgba {
	if (saturation === 0) {
		const grey = roundChannel(lightness * 255);
		return [grey, grey, grey, alpha];
	}
	const q =
		lightness < 0.5
			? lightness * (1 + saturation)
			: lightness + saturation - lightness * saturation;
	const p = 2 * lightness - q;
	return [
		roundChannel(hueToRgb(p, q, hue + 1 / 3) * 255),
		roundChannel(hueToRgb(p, q, hue) * 255),
		roundChannel(hueToRgb(p, q, hue - 1 / 3) * 255),
		alpha,
	];
}

function hueToRgb(p: number, q: number, shift: number): number {
	const t = wrapUnit(shift);
	if (t < 1 / 6) return p + (q - p) * 6 * t;
	if (t < 1 / 2) return q;
	if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
	return p;
}

/** One step either way, as the crate does: it is not a modulo. */
function wrapUnit(t: number): number {
	if (t < 0) return t + 1;
	if (t > 1) return t - 1;
	return t;
}

function stripPercent(value: string): string {
	return value.replace(/%+$/, '');
}

function parseChannel(raw: string): number | null {
	if (!RUST_U16.test(raw)) return null;
	const parsed = Number(raw);
	if (parsed > 65535) return null;
	return Math.min(parsed, 255);
}

function toAlpha(raw: string): number | null {
	const alpha = parseRustFloat(raw);
	if (alpha === null) return null;
	return roundChannel(Math.min(Math.max(alpha, 0), 1) * 255);
}

function parseRustFloat(raw: string): number | null {
	if (RUST_SPECIAL_FLOAT.test(raw)) return rustSpecialFloat(raw);
	if (!RUST_FLOAT.test(raw)) return null;
	return Number(raw);
}

function rustSpecialFloat(raw: string): number {
	if (/nan/i.test(raw)) return Number.NaN;
	return raw.startsWith('-')
		? Number.NEGATIVE_INFINITY
		: Number.POSITIVE_INFINITY;
}

/**
 * The crate clamps, then rounds half up. Rust's `f64::clamp` passes NaN
 * through and the `as u8` cast turns it into 0, which `Math.min/max` would
 * not: NaN is handled by name so the two agree.
 */
function roundChannel(value: number): number {
	if (Number.isNaN(value)) return 0;
	const clamped = Math.min(Math.max(value, 0), 255);
	return Math.floor(clamped + 0.5);
}
