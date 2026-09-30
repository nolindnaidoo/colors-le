/**
 * CSS Color 4 functional syntax: what is a colour, and which sRGB pixel it
 * is.
 *
 * Extraction uses it to decide whether a modern call is a colour at all;
 * convert, analyze and validate use it to read one. The crate's
 * `extract/css_color.rs` is the same grammar and the same arithmetic, and
 * the shared corpus holds the two equal.
 *
 * Grammar, per the spec's modern syntax: `name(c1 c2 c3)` or
 * `name(c1 c2 c3 / alpha)`, whitespace-separated, where a component is a
 * number, a percentage, `none`, or for a hue an angle in deg, rad, grad or
 * turn. `color()` takes a colour space first. Comma syntax is the legacy
 * form and is read by the callers' own legacy parsers first; relative
 * colours (`rgb(from …)`), `calc()` and `var()` are not colours this can
 * read and are refused.
 *
 * Arithmetic follows the spec's sample code: Lab and LCH are D50, OKLab
 * and OKLCH go through LMS, the RGB spaces through XYZ. A colour outside
 * sRGB is clipped per channel, which is what a hex conversion has to do.
 */

export interface CssRgb {
	/** 0–255, rounded. */
	readonly r: number;
	readonly g: number;
	readonly b: number;
	/** 0–1. */
	readonly a: number;
}

export const MODERN_FUNCTIONS = Object.freeze([
	'rgb',
	'rgba',
	'hsl',
	'hsla',
	'hwb',
	'lab',
	'lch',
	'oklab',
	'oklch',
	'color',
] as const);

export const COLOR_SPACES = Object.freeze([
	'srgb',
	'srgb-linear',
	'display-p3',
	'a98-rgb',
	'prophoto-rgb',
	'rec2020',
	'xyz',
	'xyz-d50',
	'xyz-d65',
] as const);

type Kind = 'number' | 'hue';
type Vec3 = readonly [number, number, number];

const NUMBER = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;
const HUE_UNITS: Readonly<Record<string, number>> = Object.freeze({
	deg: 1,
	grad: 0.9,
	rad: 180 / Math.PI,
	turn: 360,
});

/** Whether `value` is a modern-syntax colour this reads. */
export function isModernColor(value: string): boolean {
	return parseModernColor(value) !== null;
}

/**
 * A modern-syntax colour as an sRGB pixel, or null when the value is not
 * one. Case and surrounding whitespace are ignored; `value` is a whole
 * call and nothing else.
 */
export function parseModernColor(value: string): CssRgb | null {
	const text = value.trim().toLowerCase();
	const open = text.indexOf('(');
	if (open <= 0 || !text.endsWith(')')) return null;
	const name = text.slice(0, open);
	if (!(MODERN_FUNCTIONS as readonly string[]).includes(name)) return null;
	const inner = text.slice(open + 1, -1);
	if (inner.includes(',') || inner.includes('(')) return null;

	const tokens = inner.replace(/\//g, ' / ').split(/\s+/).filter(Boolean);
	let space: string | undefined;
	if (name === 'color') {
		space = tokens.shift();
		if (!space || !(COLOR_SPACES as readonly string[]).includes(space)) {
			return null;
		}
	}
	const slash = tokens.indexOf('/');
	const channels = slash === -1 ? tokens : tokens.slice(0, slash);
	const alphaTokens = slash === -1 ? [] : tokens.slice(slash + 1);
	if (channels.length !== 3) return null;
	if (slash !== -1 && alphaTokens.length !== 1) return null;

	const kinds = channelKinds(name);
	const scales = percentScales(name);
	const values: number[] = [];
	for (let index = 0; index < 3; index++) {
		const parsed = component(
			channels[index] as string,
			kinds[index] as Kind,
			scales[index] as number,
		);
		if (parsed === null) return null;
		values.push(parsed);
	}
	const alpha =
		alphaTokens.length === 0
			? 1
			: component(alphaTokens[0] as string, 'number', 1);
	if (alpha === null) return null;

	const linear = toLinearSrgb(name, space, values as unknown as Vec3);
	const [r, g, b] = linear.map((channel) =>
		Math.round(clamp01(gammaEncode(channel)) * 255),
	) as unknown as Vec3;
	return Object.freeze({ r, g, b, a: clamp01(alpha) });
}

function channelKinds(name: string): readonly Kind[] {
	switch (name) {
		case 'hsl':
		case 'hsla':
		case 'hwb':
			return ['hue', 'number', 'number'];
		case 'lch':
		case 'oklch':
			return ['number', 'number', 'hue'];
		default:
			return ['number', 'number', 'number'];
	}
}

/** What 100% means for each channel. A hue takes no percentage. */
function percentScales(name: string): Vec3 {
	switch (name) {
		case 'rgb':
		case 'rgba':
			return [255, 255, 255];
		case 'hsl':
		case 'hsla':
		case 'hwb':
			return [0, 100, 100];
		case 'lab':
			return [100, 125, 125];
		case 'lch':
			return [100, 150, 0];
		case 'oklab':
			return [1, 0.4, 0.4];
		case 'oklch':
			return [1, 0.4, 0];
		default:
			return [1, 1, 1];
	}
}

function component(token: string, kind: Kind, percent: number): number | null {
	if (token === 'none') return 0;
	if (kind === 'hue') {
		const unit = Object.keys(HUE_UNITS).find((u) => token.endsWith(u));
		const digits = unit ? token.slice(0, -unit.length) : token;
		if (!NUMBER.test(digits)) return null;
		return Number(digits) * (unit ? (HUE_UNITS[unit] as number) : 1);
	}
	if (token.endsWith('%')) {
		const digits = token.slice(0, -1);
		if (!NUMBER.test(digits) || percent === 0) return null;
		return (Number(digits) / 100) * percent;
	}
	return NUMBER.test(token) ? Number(token) : null;
}

function toLinearSrgb(name: string, space: string | undefined, c: Vec3): Vec3 {
	switch (name) {
		case 'rgb':
		case 'rgba':
			return c.map((v) => gammaDecode(v / 255)) as unknown as Vec3;
		case 'hsl':
		case 'hsla':
			return hslToSrgb(c[0], c[1] / 100, c[2] / 100).map(
				gammaDecode,
			) as unknown as Vec3;
		case 'hwb':
			return hwbToSrgb(c[0], c[1] / 100, c[2] / 100).map(
				gammaDecode,
			) as unknown as Vec3;
		case 'lab':
			return xyzD65ToLinearSrgb(d50ToD65(labToXyzD50(c)));
		case 'lch':
			return xyzD65ToLinearSrgb(d50ToD65(labToXyzD50(polarToRect(c))));
		case 'oklab':
			return oklabToLinearSrgb(c);
		case 'oklch':
			return oklabToLinearSrgb(polarToRect(c));
		default:
			return colorSpaceToLinearSrgb(space as string, c);
	}
}

function colorSpaceToLinearSrgb(space: string, c: Vec3): Vec3 {
	switch (space) {
		case 'srgb':
			return c.map(gammaDecode) as unknown as Vec3;
		case 'srgb-linear':
			return c;
		case 'display-p3':
			return xyzD65ToLinearSrgb(
				multiply(P3_TO_XYZ, c.map(gammaDecode) as unknown as Vec3),
			);
		case 'a98-rgb':
			return xyzD65ToLinearSrgb(
				multiply(
					A98_TO_XYZ,
					c.map(
						(v) => Math.sign(v) * Math.abs(v) ** (563 / 256),
					) as unknown as Vec3,
				),
			);
		case 'prophoto-rgb':
			return xyzD65ToLinearSrgb(
				d50ToD65(
					multiply(
						PROPHOTO_TO_XYZ_D50,
						c.map((v) =>
							Math.abs(v) <= 16 / 512
								? v / 16
								: Math.sign(v) * Math.abs(v) ** 1.8,
						) as unknown as Vec3,
					),
				),
			);
		case 'rec2020':
			return xyzD65ToLinearSrgb(
				multiply(REC2020_TO_XYZ, c.map(rec2020Decode) as unknown as Vec3),
			);
		case 'xyz-d50':
			return xyzD65ToLinearSrgb(d50ToD65(c));
		default:
			return xyzD65ToLinearSrgb(c);
	}
}

function hslToSrgb(hue: number, s: number, l: number): Vec3 {
	const h = (((hue % 360) + 360) % 360) / 30;
	const a = s * Math.min(l, 1 - l);
	const f = (n: number) => {
		const k = (n + h) % 12;
		return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
	};
	return [f(0), f(8), f(4)];
}

function hwbToSrgb(hue: number, white: number, black: number): Vec3 {
	if (white + black >= 1) {
		const gray = white / (white + black);
		return [gray, gray, gray];
	}
	return hslToSrgb(hue, 1, 0.5).map(
		(v) => v * (1 - white - black) + white,
	) as unknown as Vec3;
}

function polarToRect([l, chroma, hue]: Vec3): Vec3 {
	const radians = (hue * Math.PI) / 180;
	return [l, chroma * Math.cos(radians), chroma * Math.sin(radians)];
}

const D50_WHITE: Vec3 = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];

function labToXyzD50([l, a, b]: Vec3): Vec3 {
	const kappa = 24389 / 27;
	const epsilon = 216 / 24389;
	const fy = (l + 16) / 116;
	const fx = a / 500 + fy;
	const fz = fy - b / 200;
	const x = fx ** 3 > epsilon ? fx ** 3 : (116 * fx - 16) / kappa;
	const y = l > kappa * epsilon ? ((l + 16) / 116) ** 3 : l / kappa;
	const z = fz ** 3 > epsilon ? fz ** 3 : (116 * fz - 16) / kappa;
	return [x * D50_WHITE[0], y * D50_WHITE[1], z * D50_WHITE[2]];
}

function oklabToLinearSrgb([l, a, b]: Vec3): Vec3 {
	const lms = [
		(l + 0.3963377774 * a + 0.2158037573 * b) ** 3,
		(l - 0.1055613458 * a - 0.0638541728 * b) ** 3,
		(l - 0.0894841775 * a - 1.291485548 * b) ** 3,
	] as const;
	return [
		4.0767416621 * lms[0] - 3.3077115913 * lms[1] + 0.2309699292 * lms[2],
		-1.2684380046 * lms[0] + 2.6097574011 * lms[1] - 0.3413193965 * lms[2],
		-0.0041960863 * lms[0] - 0.7034186147 * lms[1] + 1.707614701 * lms[2],
	];
}

type Matrix = readonly [Vec3, Vec3, Vec3];

function multiply(m: Matrix, v: Vec3): Vec3 {
	return m.map(
		(row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2],
	) as unknown as Vec3;
}

const XYZ_TO_LINEAR_SRGB: Matrix = [
	[3.2409699419045226, -1.537383177570094, -0.4986107602930034],
	[-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
	[0.05563007969699366, -0.20397695888897652, 1.0569715142428786],
];
const D50_TO_D65: Matrix = [
	[0.955473421488075, -0.02309845494876471, 0.06325924320057072],
	[-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
	[0.012314014864481998, -0.020507649298898964, 1.330365926242124],
];
const P3_TO_XYZ: Matrix = [
	[0.4865709486482162, 0.26566769316909306, 0.1982172852343625],
	[0.2289745640697488, 0.6917385218365064, 0.079286914093745],
	[0, 0.04511338185890264, 1.043944368900976],
];
const A98_TO_XYZ: Matrix = [
	[0.5766690429101305, 0.1855582379065463, 0.1882286462349947],
	[0.29734497525053605, 0.6273635662554661, 0.07529145849399788],
	[0.02703136138641234, 0.07068885253582723, 0.9913375368376388],
];
const PROPHOTO_TO_XYZ_D50: Matrix = [
	[0.7977604896723027, 0.13518583717574031, 0.0313493495815248],
	[0.2880711282292934, 0.7118432178101014, 0.00008565396060525902],
	[0, 0, 0.8251046025104601],
];
const REC2020_TO_XYZ: Matrix = [
	[0.6369580483012914, 0.14461690358620832, 0.1688809751641721],
	[0.2627002120112671, 0.6779980715188708, 0.05930171646986196],
	[0, 0.028072693049087428, 1.060985057710791],
];

function xyzD65ToLinearSrgb(xyz: Vec3): Vec3 {
	return multiply(XYZ_TO_LINEAR_SRGB, xyz);
}

function d50ToD65(xyz: Vec3): Vec3 {
	return multiply(D50_TO_D65, xyz);
}

function gammaDecode(v: number): number {
	const abs = Math.abs(v);
	return abs <= 0.04045
		? v / 12.92
		: Math.sign(v) * ((abs + 0.055) / 1.055) ** 2.4;
}

function gammaEncode(v: number): number {
	const abs = Math.abs(v);
	return abs <= 0.0031308
		? v * 12.92
		: Math.sign(v) * (1.055 * abs ** (1 / 2.4) - 0.055);
}

function rec2020Decode(v: number): number {
	const alpha = 1.09929682680944;
	const beta = 0.018053968510807;
	const abs = Math.abs(v);
	return abs < beta * 4.5
		? v / 4.5
		: Math.sign(v) * ((abs + alpha - 1) / alpha) ** (1 / 0.45);
}

function clamp01(v: number): number {
	return Number.isNaN(v) ? 0 : Math.min(1, Math.max(0, v));
}

export interface Oklch {
	/** 0–1. */
	readonly l: number;
	readonly c: number;
	/** Degrees, 0–360; 0 when the colour is achromatic. */
	readonly h: number;
}

/** An 8-bit sRGB colour as OKLCH, through linear sRGB, LMS and OKLab. */
export function srgbToOklch(r: number, g: number, b: number): Oklch {
	const [lr, lg, lb] = [r, g, b].map((v) =>
		gammaDecode(v / 255),
	) as unknown as Vec3;
	const lms = [
		Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb),
		Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb),
		Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb),
	] as const;
	const l =
		0.2104542553 * lms[0] + 0.793617785 * lms[1] - 0.0040720468 * lms[2];
	const a =
		1.9779984951 * lms[0] - 2.428592205 * lms[1] + 0.4505937099 * lms[2];
	const bb =
		0.0259040371 * lms[0] + 0.7827717662 * lms[1] - 0.808675766 * lms[2];
	const c = Math.hypot(a, bb);
	// Below this the hue is rounding noise, and a grey has none.
	const h = c < 1e-4 ? 0 : ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
	return { l, c, h };
}
