//! CSS Color 4 functional syntax: what is a colour, and which sRGB pixel
//! it is — the port of the extension's `src/utils/cssColor.ts`.
//!
//! Extraction uses it to decide whether a modern call is a colour at all,
//! so the grammar is part of the contract `fixtures/` holds equal; the
//! palette check uses the arithmetic to compare a colour by pixel.
//!
//! Grammar: `name(c1 c2 c3)` or `name(c1 c2 c3 / alpha)`,
//! whitespace-separated, where a component is a number, a percentage,
//! `none`, or for a hue an angle in deg, rad, grad or turn. `color()`
//! takes a colour space first. Comma syntax is the legacy form, read
//! elsewhere; relative colours, `calc()` and `var()` are refused.
//!
//! Arithmetic follows the spec's sample code. A colour outside sRGB is
//! clipped per channel.

use super::js::is_js_whitespace;

/// An sRGB pixel: channels 0–255, alpha 0–1.
#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct CssRgb {
    pub(crate) r: u8,
    pub(crate) g: u8,
    pub(crate) b: u8,
    pub(crate) a: f64,
}

const MODERN_FUNCTIONS: [&str; 10] = [
    "rgb", "rgba", "hsl", "hsla", "hwb", "lab", "lch", "oklab", "oklch", "color",
];

const COLOR_SPACES: [&str; 9] = [
    "srgb",
    "srgb-linear",
    "display-p3",
    "a98-rgb",
    "prophoto-rgb",
    "rec2020",
    "xyz",
    "xyz-d50",
    "xyz-d65",
];

type Vec3 = [f64; 3];
type Matrix = [Vec3; 3];

#[derive(Clone, Copy, PartialEq)]
enum Kind {
    Number,
    Hue,
}

/// Whether `value` is a modern-syntax colour this reads.
pub(crate) fn is_modern_color(value: &str) -> bool {
    parse_modern_color(value).is_some()
}

/// A modern-syntax colour as an sRGB pixel. Case and surrounding
/// whitespace are ignored; `value` is a whole call and nothing else.
pub(crate) fn parse_modern_color(value: &str) -> Option<CssRgb> {
    let text = super::js::trim(value).to_ascii_lowercase();
    let open = text.find('(')?;
    if open == 0 || !text.ends_with(')') {
        return None;
    }
    let name = &text[..open];
    if !MODERN_FUNCTIONS.contains(&name) {
        return None;
    }
    let inner = &text[open + 1..text.len() - 1];
    if inner.contains(',') || inner.contains('(') {
        return None;
    }

    let spaced = inner.replace('/', " / ");
    let mut tokens: Vec<&str> = spaced
        .split(is_js_whitespace)
        .filter(|token| !token.is_empty())
        .collect();
    let mut space = None;
    if name == "color" {
        if tokens.is_empty() {
            return None;
        }
        let first = tokens.remove(0);
        if !COLOR_SPACES.contains(&first) {
            return None;
        }
        space = Some(first);
    }
    let slash = tokens.iter().position(|token| *token == "/");
    let (channels, alpha_tokens) = match slash {
        Some(index) => (&tokens[..index], &tokens[index + 1..]),
        None => (&tokens[..], &tokens[tokens.len()..]),
    };
    if channels.len() != 3 || (slash.is_some() && alpha_tokens.len() != 1) {
        return None;
    }

    let kinds = channel_kinds(name);
    let scales = percent_scales(name);
    let mut values = [0.0; 3];
    for index in 0..3 {
        values[index] = component(channels[index], kinds[index], scales[index])?;
    }
    let alpha = match alpha_tokens.first() {
        Some(token) => component(token, Kind::Number, 1.0)?,
        None => 1.0,
    };

    let linear = to_linear_srgb(name, space, values);
    let [r, g, b] = linear.map(|channel| to_byte(clamp01(gamma_encode(channel))));
    Some(CssRgb {
        r,
        g,
        b,
        a: clamp01(alpha),
    })
}

fn channel_kinds(name: &str) -> [Kind; 3] {
    match name {
        "hsl" | "hsla" | "hwb" => [Kind::Hue, Kind::Number, Kind::Number],
        "lch" | "oklch" => [Kind::Number, Kind::Number, Kind::Hue],
        _ => [Kind::Number; 3],
    }
}

/// What 100% means for each channel. A hue takes no percentage.
fn percent_scales(name: &str) -> Vec3 {
    match name {
        "rgb" | "rgba" => [255.0; 3],
        "hsl" | "hsla" | "hwb" => [0.0, 100.0, 100.0],
        "lab" => [100.0, 125.0, 125.0],
        "lch" => [100.0, 150.0, 0.0],
        "oklab" => [1.0, 0.4, 0.4],
        "oklch" => [1.0, 0.4, 0.0],
        _ => [1.0; 3],
    }
}

/// `^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$`, in ASCII digits.
fn number(token: &str) -> Option<f64> {
    let unsigned = token.strip_prefix(['+', '-']).unwrap_or(token);
    let (whole, fraction) = match unsigned.split_once('.') {
        Some((whole, fraction)) => (whole, Some(fraction)),
        None => (unsigned, None),
    };
    let digits = |part: &str| !part.is_empty() && part.bytes().all(|b| b.is_ascii_digit());
    let valid = match fraction {
        None => digits(whole),
        Some(fraction) => digits(fraction) && (whole.is_empty() || digits(whole)),
    };
    if !valid {
        return None;
    }
    token.parse().ok()
}

fn component(token: &str, kind: Kind, percent: f64) -> Option<f64> {
    if token == "none" {
        return Some(0.0);
    }
    if kind == Kind::Hue {
        for (unit, factor) in [
            ("deg", 1.0),
            ("grad", 0.9),
            ("rad", 180.0 / std::f64::consts::PI),
            ("turn", 360.0),
        ] {
            if let Some(digits) = token.strip_suffix(unit) {
                return number(digits).map(|value| value * factor);
            }
        }
        return number(token);
    }
    if let Some(digits) = token.strip_suffix('%') {
        if percent == 0.0 {
            return None;
        }
        return number(digits).map(|value| value / 100.0 * percent);
    }
    number(token)
}

fn to_linear_srgb(name: &str, space: Option<&str>, c: Vec3) -> Vec3 {
    match name {
        "rgb" | "rgba" => c.map(|v| gamma_decode(v / 255.0)),
        "hsl" | "hsla" => hsl_to_srgb(c[0], c[1] / 100.0, c[2] / 100.0).map(gamma_decode),
        "hwb" => hwb_to_srgb(c[0], c[1] / 100.0, c[2] / 100.0).map(gamma_decode),
        "lab" => multiply(
            &XYZ_TO_LINEAR_SRGB,
            multiply(&D50_TO_D65, lab_to_xyz_d50(c)),
        ),
        "lch" => multiply(
            &XYZ_TO_LINEAR_SRGB,
            multiply(&D50_TO_D65, lab_to_xyz_d50(polar_to_rect(c))),
        ),
        "oklab" => oklab_to_linear_srgb(c),
        "oklch" => oklab_to_linear_srgb(polar_to_rect(c)),
        _ => color_space_to_linear_srgb(space.unwrap_or("srgb"), c),
    }
}

fn color_space_to_linear_srgb(space: &str, c: Vec3) -> Vec3 {
    let xyz_d65 = match space {
        "srgb" => return c.map(gamma_decode),
        "srgb-linear" => return c,
        "display-p3" => multiply(&P3_TO_XYZ, c.map(gamma_decode)),
        "a98-rgb" => multiply(
            &A98_TO_XYZ,
            c.map(|v| v.signum() * v.abs().powf(563.0 / 256.0)),
        ),
        "prophoto-rgb" => multiply(
            &D50_TO_D65,
            multiply(
                &PROPHOTO_TO_XYZ_D50,
                c.map(|v| {
                    if v.abs() <= 16.0 / 512.0 {
                        v / 16.0
                    } else {
                        v.signum() * v.abs().powf(1.8)
                    }
                }),
            ),
        ),
        "rec2020" => multiply(&REC2020_TO_XYZ, c.map(rec2020_decode)),
        "xyz-d50" => multiply(&D50_TO_D65, c),
        _ => c,
    };
    multiply(&XYZ_TO_LINEAR_SRGB, xyz_d65)
}

fn hsl_to_srgb(hue: f64, saturation: f64, lightness: f64) -> Vec3 {
    let sector = (hue % 360.0 + 360.0) % 360.0 / 30.0;
    let amplitude = saturation * lightness.min(1.0 - lightness);
    let channel = |offset: f64| {
        let position = (offset + sector) % 12.0;
        lightness - amplitude * (position - 3.0).min(9.0 - position).clamp(-1.0, 1.0)
    };
    [channel(0.0), channel(8.0), channel(4.0)]
}

fn hwb_to_srgb(hue: f64, white: f64, black: f64) -> Vec3 {
    if white + black >= 1.0 {
        let gray = white / (white + black);
        return [gray; 3];
    }
    hsl_to_srgb(hue, 1.0, 0.5).map(|v| v * (1.0 - white - black) + white)
}

fn polar_to_rect([l, chroma, hue]: Vec3) -> Vec3 {
    let radians = hue * std::f64::consts::PI / 180.0;
    [l, chroma * radians.cos(), chroma * radians.sin()]
}

fn lab_to_xyz_d50([lightness, green_red, blue_yellow]: Vec3) -> Vec3 {
    let kappa = 24389.0 / 27.0;
    let epsilon = 216.0 / 24389.0;
    let white = [0.3457 / 0.3585, 1.0, (1.0 - 0.3457 - 0.3585) / 0.3585];
    let f_y = (lightness + 16.0) / 116.0;
    let f_x = green_red / 500.0 + f_y;
    let f_z = f_y - blue_yellow / 200.0;
    let inverse = |f: f64| {
        if f.powi(3) > epsilon {
            f.powi(3)
        } else {
            (116.0 * f - 16.0) / kappa
        }
    };
    let relative_y = if lightness > kappa * epsilon {
        f_y.powi(3)
    } else {
        lightness / kappa
    };
    [
        inverse(f_x) * white[0],
        relative_y * white[1],
        inverse(f_z) * white[2],
    ]
}

fn oklab_to_linear_srgb([l, a, b]: Vec3) -> Vec3 {
    let lms = [
        (l + 0.396_337_777_4 * a + 0.215_803_757_3 * b).powi(3),
        (l - 0.105_561_345_8 * a - 0.063_854_172_8 * b).powi(3),
        (l - 0.089_484_177_5 * a - 1.291_485_548 * b).powi(3),
    ];
    [
        4.076_741_662_1 * lms[0] - 3.307_711_591_3 * lms[1] + 0.230_969_929_2 * lms[2],
        -1.268_438_004_6 * lms[0] + 2.609_757_401_1 * lms[1] - 0.341_319_396_5 * lms[2],
        -0.004_196_086_3 * lms[0] - 0.703_418_614_7 * lms[1] + 1.707_614_701 * lms[2],
    ]
}

fn multiply(m: &Matrix, v: Vec3) -> Vec3 {
    m.map(|row| row[0] * v[0] + row[1] * v[1] + row[2] * v[2])
}

const XYZ_TO_LINEAR_SRGB: Matrix = [
    [
        3.240_969_941_904_522_6,
        -1.537_383_177_570_094,
        -0.498_610_760_293_003_4,
    ],
    [
        -0.969_243_636_280_879_6,
        1.875_967_501_507_720_2,
        0.041_555_057_407_175_59,
    ],
    [
        0.055_630_079_696_993_66,
        -0.203_976_958_888_976_52,
        1.056_971_514_242_878_6,
    ],
];
const D50_TO_D65: Matrix = [
    [
        0.955_473_421_488_075,
        -0.023_098_454_948_764_71,
        0.063_259_243_200_570_72,
    ],
    [
        -0.028_369_709_333_863_7,
        1.009_995_398_081_304_1,
        0.021_041_441_191_917_323,
    ],
    [
        0.012_314_014_864_481_998,
        -0.020_507_649_298_898_964,
        1.330_365_926_242_124,
    ],
];
const P3_TO_XYZ: Matrix = [
    [
        0.486_570_948_648_216_2,
        0.265_667_693_169_093_06,
        0.198_217_285_234_362_5,
    ],
    [
        0.228_974_564_069_748_8,
        0.691_738_521_836_506_4,
        0.079_286_914_093_745,
    ],
    [0.0, 0.045_113_381_858_902_64, 1.043_944_368_900_976],
];
const A98_TO_XYZ: Matrix = [
    [
        0.576_669_042_910_130_5,
        0.185_558_237_906_546_3,
        0.188_228_646_234_994_7,
    ],
    [
        0.297_344_975_250_536_05,
        0.627_363_566_255_466_1,
        0.075_291_458_493_997_88,
    ],
    [
        0.027_031_361_386_412_34,
        0.070_688_852_535_827_23,
        0.991_337_536_837_638_8,
    ],
];
const PROPHOTO_TO_XYZ_D50: Matrix = [
    [
        0.797_760_489_672_302_7,
        0.135_185_837_175_740_31,
        0.031_349_349_581_524_8,
    ],
    [
        0.288_071_128_229_293_4,
        0.711_843_217_810_101_4,
        0.000_085_653_960_605_259_02,
    ],
    [0.0, 0.0, 0.825_104_602_510_460_1],
];
const REC2020_TO_XYZ: Matrix = [
    [
        0.636_958_048_301_291_4,
        0.144_616_903_586_208_32,
        0.168_880_975_164_172_1,
    ],
    [
        0.262_700_212_011_267_1,
        0.677_998_071_518_870_8,
        0.059_301_716_469_861_96,
    ],
    [0.0, 0.028_072_693_049_087_428, 1.060_985_057_710_791],
];

fn gamma_decode(v: f64) -> f64 {
    let abs = v.abs();
    if abs <= 0.040_45 {
        v / 12.92
    } else {
        v.signum() * ((abs + 0.055) / 1.055).powf(2.4)
    }
}

fn gamma_encode(v: f64) -> f64 {
    let abs = v.abs();
    if abs <= 0.003_130_8 {
        v * 12.92
    } else {
        v.signum() * (1.055 * abs.powf(1.0 / 2.4) - 0.055)
    }
}

fn rec2020_decode(v: f64) -> f64 {
    let alpha = 1.099_296_826_809_44;
    let beta = 0.018_053_968_510_807;
    let abs = v.abs();
    if abs < beta * 4.5 {
        v / 4.5
    } else {
        v.signum() * ((abs + alpha - 1.0) / alpha).powf(1.0 / 0.45)
    }
}

fn clamp01(v: f64) -> f64 {
    if v.is_nan() { 0.0 } else { v.clamp(0.0, 1.0) }
}

/// `Math.round(v * 255)` for `v` in 0–1, written as JavaScript defines it.
fn to_byte(v: f64) -> u8 {
    (v * 255.0 + 0.5).floor() as u8
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pixel(value: &str) -> Option<(u8, u8, u8, f64)> {
        parse_modern_color(value).map(|c| (c.r, c.g, c.b, c.a))
    }

    #[test]
    fn every_modern_form_of_red_is_red() {
        for value in [
            "rgb(255 0 0)",
            "RGB(100% 0% 0%)",
            "hsl(0deg 100% 50%)",
            "hwb(0 0% 0%)",
            "lab(54.29 80.8 69.89)",
            "lch(54.29% 106.84 40.85)",
            "oklab(0.628 0.2249 0.1258)",
            "oklch(62.8% 0.2577 29.23)",
            "color(srgb 1 0 0)",
            "color(display-p3 1 0 0)",
            "color(xyz-d65 0.4124 0.2126 0.0193)",
        ] {
            assert_eq!(pixel(value), Some((255, 0, 0, 1.0)), "{value}");
        }
    }

    #[test]
    fn alpha_hue_units_and_none_are_read() {
        assert_eq!(pixel("rgb(255 0 0 / 50%)"), Some((255, 0, 0, 0.5)));
        assert_eq!(
            pixel("hsl(0.5turn 50% 50% / .3)"),
            Some((64, 191, 191, 0.3))
        );
        assert_eq!(pixel("oklch(none 0 0)"), Some((0, 0, 0, 1.0)));
    }

    #[test]
    fn what_is_not_a_modern_colour_is_refused() {
        for value in [
            "rgb(255, 0, 0)",
            "rgb(255 0 0 0)",
            "rgb(from red r g b)",
            "rgb(var(--x) 0 0)",
            "lab(1 2)",
            "color(1 2 3)",
            "color(cmyk 1 2 3)",
            "hsl(0 100% 50% /)",
            "rgb(1.2.3 0 0)",
            "lch(50 50 40%)",
            "",
        ] {
            assert_eq!(pixel(value), None, "{value}");
        }
    }
}
