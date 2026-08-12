pub(crate) mod corpus;
pub(crate) mod format;
pub(crate) mod formats;
pub(crate) mod heuristics;
pub(crate) mod palette;
pub(crate) mod position;

use serde::Serialize;

pub(crate) use format::{FALLBACK_FORMAT, SUPPORTED_FORMATS, resolve_format};
pub(crate) use heuristics::Notation;
pub(crate) use palette::Palette;
pub(crate) use position::Position;

use formats::{ShortHex, StylesheetOptions, settle};
use position::PositionIndex;

/// One extracted colour, and where it was found.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub(crate) struct Found {
    pub(crate) value: String,
    pub(crate) notation: Notation,
    #[serde(flatten)]
    pub(crate) position: Position,
    /// Whether the colour is in the palette.
    ///
    /// **Absent entirely when no palette was given.** A field that was
    /// always `true` would read as a verdict nobody asked for, and this
    /// is the one part of the report that is a judgment rather than an
    /// observation.
    #[serde(rename = "inPalette", skip_serializing_if = "Option::is_none")]
    pub(crate) in_palette: Option<bool>,
}

/// Every colour in a document, in document order.
pub(crate) fn extract(content: &str, format: &str) -> Vec<Found> {
    // Dispatched on the extractor name rather than the format, so the
    // mapping the extension is held to is the mapping this actually
    // runs. See `format::extractor_of`.
    let matches = match format::extractor_of(format) {
        "css" => formats::stylesheet(
            content,
            StylesheetOptions {
                line_comments: false,
                equals_delimiter: false,
            },
        ),
        // SCSS and LESS take `//` line comments; Stylus takes those and
        // `=` as a declaration delimiter. One extractor, three settings.
        "scss" | "less" => formats::stylesheet(
            content,
            StylesheetOptions {
                line_comments: true,
                equals_delimiter: false,
            },
        ),
        "stylus" => formats::stylesheet(
            content,
            StylesheetOptions {
                line_comments: true,
                equals_delimiter: true,
            },
        ),
        "html" => formats::html(content),
        // `xml` runs this too, and keeps its own name: the name is
        // user-visible in every MCP answer, the extractor is not.
        "svg" => formats::svg(content),
        "javascript" => formats::javascript(content),
        // Structured formats carry design tokens, so a bare `#250` in
        // one is a colour and is read as written.
        "text-tokens" => formats::text(content, ShortHex::Counts),
        // Markdown, plain text, and every format with no extractor of
        // its own. Reading them beats refusing them — a colour in a
        // Python constant is still a colour — but a short all-digit hex
        // here is an issue reference far more often than a colour, so it
        // has to carry an `a`-`f`.
        _ => formats::text(content, ShortHex::NeedsALetter),
    };

    let index = PositionIndex::new(content);
    settle(matches)
        .into_iter()
        .map(|found| Found {
            value: found.value,
            notation: found.notation,
            position: index.at(found.start),
            in_palette: None,
        })
        .collect()
}

/// The same colours, each marked against a palette.
pub(crate) fn extract_against(content: &str, format: &str, palette: &Palette) -> Vec<Found> {
    extract(content, format)
        .into_iter()
        .map(|found| Found {
            in_palette: Some(palette.contains(&found.value)),
            ..found
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn values(found: Vec<Found>) -> Vec<String> {
        found.into_iter().map(|item| item.value).collect()
    }

    #[test]
    fn every_format_reaches_its_extractor() {
        for (format, document, expected) in [
            ("css", ".a{color:#1a2b3c}", "#1a2b3c"),
            ("scss", "// x\n.a{color:#1a2b3c}", "#1a2b3c"),
            ("less", ".a{color:#1a2b3c}", "#1a2b3c"),
            ("stylus", "a\n  color = #1a2b3c", "#1a2b3c"),
            ("html", "<div style=\"color:#1a2b3c\"></div>", "#1a2b3c"),
            // `xml` reaches the SVG extractor, not the HTML one. It
            // reached the HTML one until 0.2.0, which is why this line
            // is a `fill` attribute now: `fill` is in the SVG allow-list
            // and not the HTML one, so only the right extractor finds
            // it. The extension always read `xml` this way.
            ("xml", "<rect fill=\"#1a2b3c\"/>", "#1a2b3c"),
            ("svg", "<rect fill=\"#1a2b3c\"/>", "#1a2b3c"),
            // `bgcolor` is in the SVG list too, so routing `xml` there
            // costs nothing it used to find as markup-HTML.
            ("xml", "<chart bgcolor=\"#1a2b3c\"/>", "#1a2b3c"),
            ("html", "<table bgcolor=\"#1a2b3c\"></table>", "#1a2b3c"),
            ("javascript", "const a = \"#1a2b3c\";", "#1a2b3c"),
            ("typescript", "const a: string = \"#1a2b3c\";", "#1a2b3c"),
        ] {
            assert_eq!(values(extract(document, format)), [expected], "{format}");
        }
    }

    /// Changed deliberately in 0.2.0: a format with no extractor of its
    /// own is read as raw text rather than refused. The rule that makes
    /// that safe is about short hex, not about which files get opened.
    #[test]
    fn an_unknown_format_is_read_as_raw_text() {
        assert_eq!(values(extract("see #abc below", FALLBACK_FORMAT)), ["#abc"]);
    }

    /// The prose rule, in the three places it has to be right.
    #[test]
    fn a_short_all_digit_hex_counts_only_where_a_colour_belongs() {
        let document = "closes #250 and #FFF is the paper";
        assert_eq!(values(extract(document, "markdown")), ["#FFF"]);
        assert_eq!(values(extract(document, "plaintext")), ["#FFF"]);
        assert_eq!(values(extract(document, FALLBACK_FORMAT)), ["#FFF"]);
        // A stylesheet is untouched by it: there, `#250` is a colour.
        assert_eq!(values(extract(".a{color:#250}", "css")), ["#250"]);
        // So is a structured format, which is where design tokens live.
        assert_eq!(values(extract("{ \"gray\": \"#250\" }", "json")), ["#250"]);
    }

    /// Every new format reads, and a named colour in one still counts
    /// only where a value is expected.
    #[test]
    fn the_structured_formats_read_their_tokens() {
        for (format, document) in [
            (
                "json",
                "{\n  \"brand\": \"#1a2b3c\",\n  \"paper\": \"white\"\n}",
            ),
            ("yaml", "brand: \"#1a2b3c\"\npaper: white\n"),
            ("toml", "brand = \"#1a2b3c\"\npaper = \"white\"\n"),
        ] {
            assert_eq!(
                values(extract(document, format)),
                ["#1a2b3c", "white"],
                "{format}"
            );
        }
    }

    /// The documented cost of scanning rather than parsing: a value
    /// segment runs to the end of the line, so two tokens on one line
    /// are one segment and neither is wholly a colour. Hex survives —
    /// it is matched as a literal, not as a value — and a token file
    /// written by a formatter has one token per line.
    #[test]
    fn two_tokens_on_one_line_cost_the_named_one() {
        let document = "{ \"brand\": \"#1a2b3c\", \"paper\": \"white\" }";
        assert_eq!(values(extract(document, "json")), ["#1a2b3c"]);
    }

    /// Without the whole-value rule every sentence mentioning a fruit is
    /// a finding, and the fallback reads more prose than anything else
    /// here. Both of these came off real repositories.
    #[test]
    fn a_named_colour_prose_merely_mentions_is_not_a_colour() {
        for document in [
            "the orange was ripe",
            "**Vocabulary:** `outline-focus` (brand-orange focus ring)",
            "className=\"border-t border-white/10 px-6 text-white\"",
        ] {
            assert!(extract(document, "markdown").is_empty(), "{document}");
        }
        assert_eq!(
            values(extract("Brand: orange", "markdown")),
            ["orange"],
            "a value that IS the colour still counts"
        );
    }

    #[test]
    fn a_palette_marks_each_colour() {
        let palette = Palette::parse("#1a2b3c").0;
        let found = extract_against(".a{color:#1a2b3c}\n.b{color:#ff0000}", "css", &palette);
        assert_eq!(found[0].in_palette, Some(true));
        assert_eq!(found[1].in_palette, Some(false));
    }

    #[test]
    fn without_a_palette_there_is_no_verdict() {
        let found = extract(".a{color:#1a2b3c}", "css");
        assert_eq!(found[0].in_palette, None);
    }
}
