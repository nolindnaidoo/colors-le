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

use formats::{StylesheetOptions, settle};
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
    let matches = match format::canonical(format) {
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
        // `xml` reads as markup and keeps its own name, because the
        // name is user-visible in every MCP answer.
        "html" | "xml" => formats::html(content),
        "svg" => formats::svg(content),
        "javascript" | "typescript" => formats::javascript(content),
        // An unknown format finds nothing rather than guessing. See
        // `format::FALLBACK_FORMAT`.
        _ => Vec::new(),
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
            ("xml", "<a style=\"color:#1a2b3c\"/>", "#1a2b3c"),
            ("svg", "<rect fill=\"#1a2b3c\"/>", "#1a2b3c"),
            ("javascript", "const a = \"#1a2b3c\";", "#1a2b3c"),
            ("typescript", "const a: string = \"#1a2b3c\";", "#1a2b3c"),
        ] {
            assert_eq!(values(extract(document, format)), [expected], "{format}");
        }
    }

    /// A format with no extractor finds nothing rather than guessing.
    #[test]
    fn an_unknown_format_finds_nothing() {
        assert!(extract("see #abc below", FALLBACK_FORMAT).is_empty());
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
