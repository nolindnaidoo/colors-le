//! The format extractors, and the one rule each of them applies.
//!
//! Every extractor answers the same question — *where in this document
//! may a colour appear* — and then hands the same matchers the segments
//! it found. That is why a hex in a comment is missed identically in
//! CSS, SCSS, HTML and TypeScript rather than in four different ways.

use super::heuristics::{
    ColorMatch, CommentSyntax, Notation, Segment, blank_comments, classify,
    find_declaration_values, find_literals, find_literals_in_prose, find_named,
    find_string_literals, is_named_color,
};

/// HTML's presentational colour attributes.
const HTML_COLOR_ATTRIBUTES: [&str; 2] = ["bgcolor", "color"];

/// SVG's. Ported as a list rather than guessed: `stop-color` and
/// `flood-color` are easy to forget and carry real brand colours.
const SVG_COLOR_ATTRIBUTES: [&str; 6] = [
    "fill",
    "stroke",
    "stop-color",
    "flood-color",
    "lighting-color",
    "color",
];

#[derive(Debug, Clone, Copy)]
pub(crate) struct StylesheetOptions {
    /// `//` line comments are valid — SCSS, LESS, Stylus.
    pub(crate) line_comments: bool,
    /// `=` also starts a declaration value — Stylus.
    pub(crate) equals_delimiter: bool,
}

/// The CSS family. Literals anywhere outside comments; named colours
/// only inside declaration values.
pub(crate) fn stylesheet(content: &str, options: StylesheetOptions) -> Vec<ColorMatch> {
    let syntax = if options.line_comments {
        CommentSyntax::CssLine
    } else {
        CommentSyntax::Css
    };
    let blanked = blank_comments(content, syntax);
    let segments = find_declaration_values(&blanked, options.equals_delimiter);

    let mut matches = find_literals(&blanked);
    matches.extend(find_named(&blanked, Some(&segments)));
    matches
}

/// Whether a bare `#250` in this document is a colour.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ShortHex {
    /// It is. The document has a syntax where a colour belongs — JSON,
    /// YAML and TOML carry design tokens, and `#250` is a valid one.
    Counts,
    /// It is not, unless it contains an `a`-`f`. Prose, and anything
    /// with no extractor of its own. See `is_issue_reference`.
    NeedsALetter,
}

/// Everything else: a raw scan of the whole document.
///
/// Reading a file this has no parser for beats refusing it — design
/// tokens live in JSON, and a colour in a Python constant is still a
/// colour.
///
/// Comments are not blanked, because there is no syntax to blank them
/// in. A hex in a `#` comment is reported, which is the honest answer
/// for a document whose language is unknown.
pub(crate) fn text(content: &str, short_hex: ShortHex) -> Vec<ColorMatch> {
    let mut matches = match short_hex {
        ShortHex::Counts => find_literals(content),
        ShortHex::NeedsALetter => find_literals_in_prose(content),
    };
    // `=` as well as `:`, because this one arm covers TOML, INI and
    // source as well as prose.
    matches.extend(
        find_declaration_values(content, true)
            .into_iter()
            .filter_map(|segment| named_value(content, segment)),
    );
    matches
}

/// The named colour a declaration value **is**, rather than one it
/// mentions.
///
/// The whole-value rule, the same one markup applies to an attribute and
/// JavaScript applies to a string literal — and the one that makes this
/// extractor usable on prose. Measured on two real repositories: taking
/// every named keyword inside a declaration value turned a paragraph
/// reading "brand-orange focus ring", a shields.io badge ending
/// `-red)`, and a Tailwind `className="… text-white …"` into findings,
/// 35 of them against 19 real colours. Requiring the value to be the
/// colour drops all 35 and keeps `"paper": "white"`.
///
/// Quotes and a trailing comma are stripped first, because a value in
/// JSON, YAML, TOML or source arrives wearing them.
fn named_value(content: &str, segment: Segment) -> Option<ColorMatch> {
    let end = segment.end.min(content.len());
    if segment.start >= end {
        return None;
    }
    let slice = &content[segment.start..end];
    let trimmed = slice
        .trim()
        .trim_end_matches([',', ';'])
        .trim()
        .trim_matches(['"', '\'', '`'])
        .trim();
    if !is_named_color(trimmed) {
        return None;
    }
    // The position is the colour's, not the value's: a reader opening
    // the file has to land on the word.
    let offset = slice.find(trimmed)?;
    Some(ColorMatch {
        value: trimmed.to_string(),
        start: segment.start + offset,
        notation: Notation::Named,
    })
}

/// JavaScript and TypeScript: colours live in string and template
/// literals only.
///
/// A literal *inside* a string is found — a styled-component template is
/// the case that matters — but a named colour counts only when the whole
/// string is the colour. `"orange juice"` is not orange.
pub(crate) fn javascript(content: &str) -> Vec<ColorMatch> {
    let mut matches = Vec::new();

    for span in find_string_literals(content) {
        let end = span.end.min(content.len());
        if span.start >= end {
            continue;
        }
        let slice = &content[span.start..end];

        for found in find_literals(slice) {
            matches.push(ColorMatch {
                start: span.start + found.start,
                ..found
            });
        }

        let trimmed = slice.trim();
        if is_named_color(trimmed)
            && let Some(offset) = slice.find(trimmed)
        {
            matches.push(ColorMatch {
                value: trimmed.to_string(),
                start: span.start + offset,
                notation: Notation::Named,
            });
        }
    }

    matches
}

/// HTML and SVG. Colours are recognised in three places and nowhere
/// else: a `style` attribute, a `<style>` block, and the presentational
/// attributes — where the **whole** attribute value must be one colour.
///
/// That last rule is what keeps `href="#section"` out of the results. A
/// fragment identifier looks exactly like a three-digit hex.
pub(crate) fn markup(content: &str, attributes: &[&str]) -> Vec<ColorMatch> {
    let blanked = blank_comments(content, CommentSyntax::Html);
    let mut matches = Vec::new();

    for (start, length) in style_attributes(&blanked) {
        matches.extend(scan_css_segment(&blanked, start, length));
    }
    for (start, length) in style_blocks(&blanked) {
        matches.extend(scan_css_segment(&blanked, start, length));
    }
    for (value, start) in attribute_values(&blanked, attributes) {
        if let Some(found) = attribute_color(&value, start) {
            matches.push(found);
        }
    }

    matches
}

pub(crate) fn html(content: &str) -> Vec<ColorMatch> {
    markup(content, &HTML_COLOR_ATTRIBUTES)
}

pub(crate) fn svg(content: &str) -> Vec<ColorMatch> {
    markup(content, &SVG_COLOR_ATTRIBUTES)
}

/// The colour an attribute value carries, or nothing.
///
/// The whole value must be the colour. A value that merely *contains* a
/// literal is not one, which is the guard that keeps ids and fragments
/// out.
fn attribute_color(value: &str, start: usize) -> Option<ColorMatch> {
    let notation = classify(value);
    match notation {
        Notation::Unknown => None,
        Notation::Named => is_named_color(value).then(|| ColorMatch {
            value: value.to_string(),
            start,
            notation,
        }),
        _ => {
            let literals = find_literals(value);
            let single = literals.len() == 1 && literals[0].value.len() == value.len();
            single.then(|| ColorMatch {
                value: value.to_string(),
                start,
                notation,
            })
        }
    }
}

fn scan_css_segment(blanked: &str, start: usize, length: usize) -> Vec<ColorMatch> {
    let end = (start + length).min(blanked.len());
    if start >= end {
        return Vec::new();
    }
    let slice = &blanked[start..end];
    let segments = find_declaration_values(slice, false);

    let mut matches = find_literals(slice);
    matches.extend(find_named(slice, Some(&segments)));
    for found in &mut matches {
        found.start += start;
    }
    matches
}

/// `style="…"` values, as (offset, length) into the blanked content.
fn style_attributes(blanked: &str) -> Vec<(usize, usize)> {
    attribute_spans(blanked, &["style"])
}

fn style_blocks(blanked: &str) -> Vec<(usize, usize)> {
    let lower = blanked.to_lowercase();
    let mut spans = Vec::new();
    let mut cursor = 0;
    while let Some(open) = lower[cursor..].find("<style") {
        let tag_start = cursor + open;
        let Some(gt) = lower[tag_start..].find('>') else {
            break;
        };
        let inner_start = tag_start + gt + 1;
        let Some(close) = lower[inner_start..].find("</style") else {
            break;
        };
        spans.push((inner_start, close));
        cursor = inner_start + close;
    }
    spans
}

/// Attribute values for the named attributes, as (value, offset).
fn attribute_values(blanked: &str, attributes: &[&str]) -> Vec<(String, usize)> {
    attribute_spans(blanked, attributes)
        .into_iter()
        .map(|(start, length)| {
            let end = (start + length).min(blanked.len());
            (blanked[start..end].trim().to_string(), start)
        })
        .filter(|(value, _)| !value.is_empty())
        .collect()
}

/// Hand-scanned rather than a regex, because the name must be preceded
/// by whitespace or `<` — `data-fill="…"` is not `fill="…"`, and a
/// regex with an alternation of six names and a lookbehind is harder to
/// read than the scan it replaces.
fn attribute_spans(blanked: &str, attributes: &[&str]) -> Vec<(usize, usize)> {
    let lower = blanked.to_lowercase();
    let bytes = lower.as_bytes();
    let mut spans = Vec::new();

    for name in attributes {
        let mut cursor = 0;
        while let Some(at) = lower[cursor..].find(name) {
            let start = cursor + at;
            cursor = start + name.len();

            let preceded_ok = start == 0
                || matches!(bytes[start - 1], b'<' | b' ' | b'\t' | b'\n' | b'\r' | b'/');
            if !preceded_ok {
                continue;
            }

            let mut index = start + name.len();
            while index < bytes.len() && bytes[index].is_ascii_whitespace() {
                index += 1;
            }
            if index >= bytes.len() || bytes[index] != b'=' {
                continue;
            }
            index += 1;
            while index < bytes.len() && bytes[index].is_ascii_whitespace() {
                index += 1;
            }
            let Some(quote) = bytes.get(index).copied() else {
                continue;
            };
            if quote != b'"' && quote != b'\'' {
                continue;
            }
            let value_start = index + 1;
            let Some(length) = bytes[value_start..].iter().position(|&byte| byte == quote) else {
                continue;
            };
            spans.push((value_start, length));
            cursor = value_start + length;
        }
    }

    spans.sort_unstable();
    spans
}

/// Deduplicate by start offset and sort, which is how two matchers
/// finding the same run at the same place become one colour.
pub(crate) fn settle(matches: Vec<ColorMatch>) -> Vec<ColorMatch> {
    let mut seen: Vec<usize> = Vec::new();
    let mut settled: Vec<ColorMatch> = Vec::new();
    for found in matches {
        if seen.contains(&found.start) {
            continue;
        }
        seen.push(found.start);
        settled.push(found);
    }
    settled.sort_by_key(|found| found.start);
    settled
}

#[cfg(test)]
mod tests {
    use super::*;

    fn values(matches: Vec<ColorMatch>) -> Vec<String> {
        settle(matches)
            .into_iter()
            .map(|found| found.value)
            .collect()
    }

    fn css() -> StylesheetOptions {
        StylesheetOptions {
            line_comments: false,
            equals_delimiter: false,
        }
    }

    #[test]
    fn a_stylesheet_finds_literals_and_named_values() {
        let document = ".a { color: #1a2b3c; background: white; }";
        assert_eq!(values(stylesheet(document, css())), ["#1a2b3c", "white"]);
    }

    #[test]
    fn a_commented_declaration_is_not_a_colour() {
        assert_eq!(
            values(stylesheet("/* color: #deadbe; */", css())),
            Vec::<String>::new()
        );
    }

    #[test]
    fn a_line_comment_only_counts_where_the_syntax_has_them() {
        let document = "// color: #deadbe\n.a { color: #1a2b3c }";
        let scss = StylesheetOptions {
            line_comments: true,
            equals_delimiter: false,
        };
        assert_eq!(values(stylesheet(document, scss)), ["#1a2b3c"]);
        assert_eq!(
            values(stylesheet(document, css())),
            ["#deadbe", "#1a2b3c"],
            "plain CSS has no line comments, so that one is a colour"
        );
    }

    /// The rule that keeps prose out of the results.
    #[test]
    fn a_named_colour_outside_a_declaration_is_not_a_colour() {
        assert_eq!(
            values(stylesheet("/* nothing */ .orange { }", css())),
            Vec::<String>::new()
        );
    }

    #[test]
    fn a_multiline_call_is_found_and_normalised() {
        let document = ".a {\n  color: rgb(\n    17,\n    34,\n    51\n  );\n}";
        assert_eq!(values(stylesheet(document, css())), ["rgb(17, 34, 51)"]);
    }

    #[test]
    fn javascript_reads_strings_and_not_code() {
        let document = "const a = \"#1a2b3c\";\nconst orange = 1;\n// #deadbe\n";
        assert_eq!(values(javascript(document)), ["#1a2b3c"]);
    }

    #[test]
    fn a_named_colour_must_be_the_whole_string() {
        assert_eq!(values(javascript("const a = \"white\";")), ["white"]);
        assert_eq!(
            values(javascript("const a = \"orange juice\";")),
            Vec::<String>::new()
        );
    }

    #[test]
    fn a_template_literal_is_plain_text() {
        assert_eq!(
            values(javascript("const s = `color: hsl(210, 50%, 40%);`;")),
            ["hsl(210, 50%, 40%)"]
        );
    }

    #[test]
    fn markup_reads_style_attributes_and_blocks() {
        let document = "<div style=\"color: #1a2b3c\"></div><style>.a{color:white}</style>";
        assert_eq!(values(html(document)), ["#1a2b3c", "white"]);
    }

    #[test]
    fn an_html_comment_is_not_a_colour() {
        assert_eq!(
            values(html("<!-- <div style=\"color:#deadbe\"></div> -->")),
            Vec::<String>::new()
        );
    }

    #[test]
    fn svg_reads_its_presentational_attributes() {
        let document = "<rect fill=\"#1a2b3c\" stroke=\"rgb(1, 2, 3)\"/>";
        assert_eq!(values(svg(document)), ["#1a2b3c", "rgb(1, 2, 3)"]);
    }

    /// A fragment identifier looks exactly like a three-digit hex, and
    /// the whole-value rule is what keeps it out.
    #[test]
    fn a_fragment_identifier_is_not_a_colour() {
        assert_eq!(values(html("<a href=\"#abc\">x</a>")), Vec::<String>::new());
    }

    #[test]
    fn an_attribute_value_that_merely_contains_a_colour_is_not_one() {
        assert_eq!(
            values(svg("<rect fill=\"url(#grad) #fff\"/>")),
            Vec::<String>::new()
        );
    }

    /// `data-fill` is not `fill`.
    #[test]
    fn a_prefixed_attribute_name_does_not_match() {
        assert_eq!(
            values(svg("<rect data-fill=\"#1a2b3c\"/>")),
            Vec::<String>::new()
        );
    }

    #[test]
    fn two_matchers_finding_the_same_run_produce_one_colour() {
        let document = ".a { color: white }";
        let settled = settle(stylesheet(document, css()));
        assert_eq!(settled.len(), 1);
    }
}
