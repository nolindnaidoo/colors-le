//! Comparing a colour against an approved palette.
//!
//! **This is the addition.** The extension has no equivalent, so it is
//! outside parity scope — there is nothing for it to disagree with. It
//! exists because "here is the palette, tell me what is not in it" is
//! the job a design-system owner actually has, and extraction alone
//! answers only the other half of it.
//!
//! Comparison is **by colour, not by text**. A palette written in hex
//! must still catch a violation written in `rgb()`, or the check is a
//! spelling test.

use std::collections::HashSet;

use super::heuristics::{Notation, classify, is_named_color};

/// An approved palette, as the set of colours it contains.
#[derive(Debug, Clone, Default)]
pub(crate) struct Palette {
    /// Resolved colours, as 8-bit RGBA.
    swatches: HashSet<[u8; 4]>,
    /// Named keywords, kept as text.
    ///
    /// **A named colour is only equal to itself.** `white` and `#ffffff`
    /// are the same pixel and not the same decision: one is a keyword
    /// nobody approved and the other may be the brand's paper colour.
    /// Resolving keywords to RGB would quietly launder the first into
    /// the second, which is the opposite of what an enforcement check is
    /// for.
    names: HashSet<String>,
}

impl Palette {
    /// Read a palette from text: one colour per line, a JSON array, or a
    /// flat JSON object's values.
    ///
    /// Three shapes because a palette is written by hand as often as it
    /// is exported, and refusing the one someone has is a tax with no
    /// benefit. Anything that is not a colour is reported rather than
    /// skipped — a typo in a palette silently approving nothing is the
    /// worst outcome available.
    pub(crate) fn parse(text: &str) -> (Self, Vec<String>) {
        let mut palette = Self::default();
        let mut rejected = Vec::new();

        for entry in entries(text) {
            let trimmed = entry.trim().trim_matches('"').trim();
            if trimmed.is_empty() || trimmed.starts_with('#') && trimmed.len() == 1 {
                continue;
            }
            if !palette.insert(trimmed) {
                rejected.push(trimmed.to_string());
            }
        }

        (palette, rejected)
    }

    fn insert(&mut self, value: &str) -> bool {
        match classify(value) {
            Notation::Named => {
                if is_named_color(value) {
                    self.names.insert(value.to_lowercase());
                    true
                } else {
                    false
                }
            }
            Notation::Unknown => false,
            _ => match resolve(value) {
                Some(rgba) => {
                    self.swatches.insert(rgba);
                    true
                }
                None => false,
            },
        }
    }

    pub(crate) fn is_empty(&self) -> bool {
        self.swatches.is_empty() && self.names.is_empty()
    }

    /// Whether an extracted colour is approved.
    ///
    /// A colour this cannot resolve is **not** treated as approved. The
    /// safe direction for an enforcement check is to surface it: a
    /// notation nobody can read is exactly what a reviewer should look
    /// at.
    pub(crate) fn contains(&self, value: &str) -> bool {
        if classify(value) == Notation::Named {
            return self.names.contains(&value.to_lowercase());
        }
        resolve(value).is_some_and(|rgba| self.swatches.contains(&rgba))
    }
}

fn entries(text: &str) -> Vec<String> {
    let trimmed = text.trim();
    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(trimmed) {
        if let Some(array) = parsed.as_array() {
            return array
                .iter()
                .filter_map(|item| item.as_str().map(str::to_string))
                .collect();
        }
        if let Some(object) = parsed.as_object() {
            return object
                .values()
                .filter_map(|item| item.as_str().map(str::to_string))
                .collect();
        }
    }
    text.lines()
        .map(|line| {
            // A trailing comma survives copy-paste from a token file;
            // stripping it is cheaper than making someone tidy the list.
            line.split('#')
                .next()
                .filter(|_| !line.trim_start().starts_with('#'))
                .map_or(line, |_| line)
                .trim()
                .trim_end_matches(',')
                .to_string()
        })
        .filter(|line| !line.is_empty() && !line.starts_with("//"))
        .collect()
}

/// A colour as 8-bit RGBA, so two notations of the same colour compare
/// equal.
///
/// Alpha is part of the identity: `rgba(0, 0, 0, 0.5)` is not black. A
/// palette that approved the first would otherwise approve every
/// translucent overlay in the codebase.
fn resolve(value: &str) -> Option<[u8; 4]> {
    let value = value.trim();
    match classify(value) {
        Notation::Hex => resolve_hex(value),
        Notation::Rgb | Notation::Rgba => resolve_rgb(value),
        Notation::Hsl | Notation::Hsla => resolve_hsl(value),
        Notation::Named | Notation::Unknown => None,
    }
}

fn resolve_hex(value: &str) -> Option<[u8; 4]> {
    let digits = value.strip_prefix('#')?;
    let expand = |slice: &str| u8::from_str_radix(slice, 16).ok();
    match digits.len() {
        3 | 4 => {
            let mut parts = [255u8; 4];
            for (index, character) in digits.chars().enumerate() {
                let doubled = format!("{character}{character}");
                parts[index] = expand(&doubled)?;
            }
            Some(parts)
        }
        6 | 8 => {
            let mut parts = [255u8; 4];
            for index in 0..digits.len() / 2 {
                parts[index] = expand(&digits[index * 2..index * 2 + 2])?;
            }
            Some(parts)
        }
        _ => None,
    }
}

fn components(value: &str) -> Vec<String> {
    let inner = value.split_once('(').map_or(value, |(_, rest)| rest);
    inner
        .trim_end_matches(')')
        .split(',')
        .map(|part| part.trim().to_string())
        .collect()
}

fn resolve_rgb(value: &str) -> Option<[u8; 4]> {
    let parts = components(value);
    if parts.len() < 3 {
        return None;
    }
    let channel = |index: usize| parts[index].parse::<u16>().ok().map(|n| n.min(255) as u8);
    Some([
        channel(0)?,
        channel(1)?,
        channel(2)?,
        parts.get(3).map_or(Some(255), |alpha| to_alpha(alpha))?,
    ])
}

fn resolve_hsl(value: &str) -> Option<[u8; 4]> {
    let parts = components(value);
    if parts.len() < 3 {
        return None;
    }
    let hue = parts[0].parse::<f64>().ok()? / 360.0;
    let saturation = parts[1].trim_end_matches('%').parse::<f64>().ok()? / 100.0;
    let lightness = parts[2].trim_end_matches('%').parse::<f64>().ok()? / 100.0;
    let alpha = parts.get(3).map_or(Some(255), |alpha| to_alpha(alpha))?;

    if saturation == 0.0 {
        let grey = round_channel(lightness * 255.0);
        return Some([grey, grey, grey, alpha]);
    }
    let q = if lightness < 0.5 {
        lightness * (1.0 + saturation)
    } else {
        lightness + saturation - lightness * saturation
    };
    let p = 2.0 * lightness - q;
    Some([
        round_channel(hue_to_rgb(p, q, hue + 1.0 / 3.0) * 255.0),
        round_channel(hue_to_rgb(p, q, hue) * 255.0),
        round_channel(hue_to_rgb(p, q, hue - 1.0 / 3.0) * 255.0),
        alpha,
    ])
}

fn hue_to_rgb(p: f64, q: f64, mut t: f64) -> f64 {
    if t < 0.0 {
        t += 1.0;
    }
    if t > 1.0 {
        t -= 1.0;
    }
    if t < 1.0 / 6.0 {
        return p + (q - p) * 6.0 * t;
    }
    if t < 1.0 / 2.0 {
        return q;
    }
    if t < 2.0 / 3.0 {
        return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
    }
    p
}

/// JavaScript's `Math.round` rounds half toward positive infinity; Rust's
/// `f64::round` rounds half away from zero. They differ only on negative
/// halves, which a colour channel never is — but the extension's
/// converter rounds this way and matching it costs one line.
fn round_channel(value: f64) -> u8 {
    let clamped = value.clamp(0.0, 255.0);
    (clamped + 0.5).floor() as u8
}

fn to_alpha(raw: &str) -> Option<u8> {
    let alpha = raw.parse::<f64>().ok()?;
    Some(round_channel(alpha.clamp(0.0, 1.0) * 255.0))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn palette(text: &str) -> Palette {
        Palette::parse(text).0
    }

    #[test]
    fn a_line_per_colour_is_a_palette() {
        let approved = palette("#1a2b3c\n#ffffff\n");
        assert!(approved.contains("#1a2b3c"));
        assert!(!approved.contains("#000000"));
    }

    #[test]
    fn a_json_array_is_a_palette() {
        let approved = palette("[\"#1a2b3c\", \"#ffffff\"]");
        assert!(approved.contains("#1a2b3c"));
    }

    #[test]
    fn a_flat_json_object_is_a_palette() {
        let approved = palette("{ \"brand\": \"#1a2b3c\", \"paper\": \"#ffffff\" }");
        assert!(approved.contains("#1a2b3c"));
        assert!(
            !approved.contains("brand"),
            "the keys are names, not colours"
        );
    }

    /// The whole reason comparison is by colour: a palette written in
    /// hex has to catch a violation written in rgb.
    #[test]
    fn a_colour_is_matched_across_notations() {
        let approved = palette("#ffffff\n");
        assert!(approved.contains("#fff"));
        assert!(approved.contains("#FFFFFF"));
        assert!(approved.contains("rgb(255, 255, 255)"));
        assert!(approved.contains("hsl(0, 0%, 100%)"));
    }

    #[test]
    fn a_short_hex_expands_the_way_css_expands_it() {
        let approved = palette("#1122ff\n");
        assert!(approved.contains("#12f"));
    }

    /// Alpha is part of the identity, or a palette approving black would
    /// approve every translucent overlay in the codebase.
    #[test]
    fn alpha_is_part_of_the_colour() {
        let approved = palette("#000000\n");
        assert!(approved.contains("rgb(0, 0, 0)"));
        assert!(!approved.contains("rgba(0, 0, 0, 0.5)"));
    }

    /// The deliberate exception. `white` and `#ffffff` are the same
    /// pixel and not the same decision.
    #[test]
    fn a_named_colour_is_only_equal_to_itself() {
        let by_name = palette("white\n");
        assert!(by_name.contains("white"));
        assert!(by_name.contains("WHITE"), "the keyword is case-insensitive");
        assert!(!by_name.contains("#ffffff"));

        let by_hex = palette("#ffffff\n");
        assert!(!by_hex.contains("white"));
    }

    /// A typo in a palette silently approving nothing is the worst
    /// outcome available, so it is reported.
    #[test]
    fn an_entry_that_is_not_a_colour_is_reported() {
        let (approved, rejected) = Palette::parse("#1a2b3c\nnot-a-colour\n#12345\n");
        assert!(approved.contains("#1a2b3c"));
        assert_eq!(rejected, ["not-a-colour", "#12345"]);
    }

    #[test]
    fn comments_and_trailing_commas_survive_a_copy_paste() {
        let approved = palette("// brand\n#1a2b3c,\n\n#ffffff,\n");
        assert!(approved.contains("#1a2b3c"));
        assert!(approved.contains("#ffffff"));
    }

    /// The safe direction: a notation nobody can read is exactly what a
    /// reviewer should be shown.
    #[test]
    fn an_unresolvable_colour_is_never_approved() {
        let approved = palette("#1a2b3c\n");
        assert!(!approved.contains("color(display-p3 1 0 0)"));
    }

    #[test]
    fn an_empty_palette_says_so() {
        assert!(Palette::default().is_empty());
        assert!(!palette("#1a2b3c").is_empty());
    }

    /// The expected values are the extension's own converter's answers,
    /// not this implementation's arithmetic — which makes this a parity
    /// check rather than a restatement.
    #[test]
    fn hsl_resolves_the_way_the_extensions_converter_does() {
        for (hsl, hex) in [
            ("hsl(210, 50%, 50%)", "#407fbf"),
            ("hsl(0, 0%, 100%)", "#ffffff"),
            ("hsl(210, 50%, 40%)", "#336699"),
        ] {
            assert!(palette(hex).contains(hsl), "{hsl} should resolve to {hex}");
        }
    }
}
