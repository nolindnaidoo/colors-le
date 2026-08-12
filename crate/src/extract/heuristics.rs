//! What counts as a colour, and where a colour may appear.
//!
//! Ported from `heuristics.ts`, which is already the single source the
//! extension's six format extractors share.
//!
//! The rejections matter as much as the matches. A five-digit hex is not
//! a colour, `rgb(1, 2)` is not a colour, and a bare `orange` in prose
//! is not a colour — without that last rule every sentence mentioning a
//! fruit would be a finding.

use std::sync::LazyLock;

use regex::Regex;
use serde::{Deserialize, Serialize};

use super::js::{JS_SPACE_CLASS, is_js_whitespace};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum Notation {
    Hex,
    Rgb,
    Rgba,
    Hsl,
    Hsla,
    Named,
    Unknown,
}

/// The CSS named-colour keywords, plus `transparent`. Ported as a list
/// rather than re-derived: a second implementation guessing at which
/// keywords count is how two frontends start disagreeing about what is
/// even a colour.
pub(crate) const NAMED_COLORS: [&str; 142] = [
    "aliceblue",
    "antiquewhite",
    "aqua",
    "aquamarine",
    "azure",
    "beige",
    "bisque",
    "black",
    "blanchedalmond",
    "blue",
    "blueviolet",
    "brown",
    "burlywood",
    "cadetblue",
    "chartreuse",
    "chocolate",
    "coral",
    "cornflowerblue",
    "cornsilk",
    "crimson",
    "cyan",
    "darkblue",
    "darkcyan",
    "darkgoldenrod",
    "darkgray",
    "darkgreen",
    "darkkhaki",
    "darkmagenta",
    "darkolivegreen",
    "darkorange",
    "darkorchid",
    "darkred",
    "darksalmon",
    "darkseagreen",
    "darkslateblue",
    "darkslategray",
    "darkturquoise",
    "darkviolet",
    "deeppink",
    "deepskyblue",
    "dimgray",
    "dodgerblue",
    "firebrick",
    "floralwhite",
    "forestgreen",
    "fuchsia",
    "gainsboro",
    "ghostwhite",
    "gold",
    "goldenrod",
    "gray",
    "green",
    "greenyellow",
    "honeydew",
    "hotpink",
    "indianred",
    "indigo",
    "ivory",
    "khaki",
    "lavender",
    "lavenderblush",
    "lawngreen",
    "lemonchiffon",
    "lightblue",
    "lightcoral",
    "lightcyan",
    "lightgoldenrodyellow",
    "lightgray",
    "lightgreen",
    "lightpink",
    "lightsalmon",
    "lightseagreen",
    "lightskyblue",
    "lightslategray",
    "lightsteelblue",
    "lightyellow",
    "lime",
    "limegreen",
    "linen",
    "magenta",
    "maroon",
    "mediumaquamarine",
    "mediumblue",
    "mediumorchid",
    "mediumpurple",
    "mediumseagreen",
    "mediumslateblue",
    "mediumspringgreen",
    "mediumturquoise",
    "mediumvioletred",
    "midnightblue",
    "mintcream",
    "mistyrose",
    "moccasin",
    "navajowhite",
    "navy",
    "oldlace",
    "olive",
    "olivedrab",
    "orange",
    "orangered",
    "orchid",
    "palegoldenrod",
    "palegreen",
    "paleturquoise",
    "palevioletred",
    "papayawhip",
    "peachpuff",
    "peru",
    "pink",
    "plum",
    "powderblue",
    "purple",
    "rebeccapurple",
    "red",
    "rosybrown",
    "royalblue",
    "saddlebrown",
    "salmon",
    "sandybrown",
    "seagreen",
    "seashell",
    "sienna",
    "silver",
    "skyblue",
    "slateblue",
    "slategray",
    "snow",
    "springgreen",
    "steelblue",
    "tan",
    "teal",
    "thistle",
    "tomato",
    "transparent",
    "turquoise",
    "violet",
    "wheat",
    "white",
    "whitesmoke",
    "yellow",
    "yellowgreen",
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ColorMatch {
    pub(crate) value: String,
    pub(crate) start: usize,
    pub(crate) notation: Notation,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct Segment {
    pub(crate) start: usize,
    pub(crate) end: usize,
}

/// **These patterns are ASCII on purpose.**
///
/// The reference implementation's regexes run without JavaScript's `u`
/// flag, where `\b`, `\d` and `[a-z]` mean ASCII; Rust's mean Unicode,
/// and the differential generator found all three ways that ends:
/// `#abcé` was a colour there and not here (`é` is a word character to
/// Unicode, so the boundary never closed), `rgb(١, 2, 3)` was a colour
/// here and not there (`\d` matched an Arabic-Indic digit), and
/// `whiteK` — with the Kelvin sign — was `white` there and one long
/// word here (`(?i)[a-z]` folds U+212A to `k`). Every one of those is a
/// shared MCP tool giving two answers. Spelled out rather than left to
/// a flag, because the flag is the thing that was wrong.
///
/// The whitespace class is the mirror image, and lives in `js` with the
/// trimmer that has to agree with it: JavaScript's `\s` is wider than
/// Rust's `char::is_whitespace` at U+FEFF and narrower at U+0085.
/// 3, 4, 6 or 8 digits, and nothing else. The alternation is ordered
/// longest-first so `#rrggbbaa` is not read as `#rrggbb` with two
/// characters left over.
static HEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?-u:\b)")
        .expect("a constant pattern compiles")
});

/// A loose shape, validated component-wise afterwards. Whitespace —
/// newlines included — is allowed anywhere inside the call, which is
/// what finds a declaration split across four lines.
static FUNCTIONAL: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(&format!(
        r"(?-u:\b)(?i-u:rgba?|hsla?)\([{JS_SPACE_CLASS}]*[0-9.,%{JS_SPACE_CLASS}]*?\)"
    ))
    .expect("a constant pattern compiles")
});

// The four validity patterns run on a call with every space already
// removed, so `\s*` there can only ever match nothing. It is kept
// because the reference implementation writes it, and a pattern that
// reads differently from the one it is held equal to is the drift these
// comments exist to prevent.
static RGB_VALID: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^rgb\(\s*[0-9]{1,3}\s*,\s*[0-9]{1,3}\s*,\s*[0-9]{1,3}\s*\)$")
        .expect("a constant pattern compiles")
});
static RGBA_VALID: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"^rgba\(\s*[0-9]{1,3}\s*,\s*[0-9]{1,3}\s*,\s*[0-9]{1,3}\s*,\s*(?:[0-9]*\.)?[0-9]+\s*\)$",
    )
    .expect("a constant pattern compiles")
});
static HSL_VALID: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^hsl\(\s*[0-9]{1,3}\s*,\s*[0-9]{1,3}%\s*,\s*[0-9]{1,3}%\s*\)$")
        .expect("a constant pattern compiles")
});
static HSLA_VALID: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"^hsla\(\s*[0-9]{1,3}\s*,\s*[0-9]{1,3}%\s*,\s*[0-9]{1,3}%\s*,\s*(?:[0-9]*\.)?[0-9]+\s*\)$",
    )
    .expect("a constant pattern compiles")
});

static WORD: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"[a-zA-Z]+").expect("a constant pattern compiles"));

pub(crate) fn is_named_color(word: &str) -> bool {
    NAMED_COLORS.contains(&word.to_lowercase().as_str())
}

pub(crate) fn classify(value: &str) -> Notation {
    let value = super::js::trim(value).to_lowercase();
    if value.starts_with('#') {
        Notation::Hex
    } else if value.starts_with("rgba(") {
        Notation::Rgba
    } else if value.starts_with("rgb(") {
        Notation::Rgb
    } else if value.starts_with("hsla(") {
        Notation::Hsla
    } else if value.starts_with("hsl(") {
        Notation::Hsl
    } else if is_named_color(&value) {
        Notation::Named
    } else {
        Notation::Unknown
    }
}

fn is_valid_functional(value: &str) -> bool {
    let collapsed = value.to_lowercase();
    if collapsed.starts_with("rgba") {
        RGBA_VALID.is_match(&collapsed)
    } else if collapsed.starts_with("rgb") {
        RGB_VALID.is_match(&collapsed)
    } else if collapsed.starts_with("hsla") {
        HSLA_VALID.is_match(&collapsed)
    } else if collapsed.starts_with("hsl") {
        HSL_VALID.is_match(&collapsed)
    } else {
        false
    }
}

/// Hex and functional literals anywhere in `content`, in document order.
///
/// A multiline call is **normalised to single spaces in the reported
/// value**, while `start` still points at its first character in the
/// source. The reader gets something they can paste and a place to look.
pub(crate) fn find_literals(content: &str) -> Vec<ColorMatch> {
    let mut matches: Vec<ColorMatch> = HEX
        .find_iter(content)
        .map(|found| ColorMatch {
            value: found.as_str().to_string(),
            start: found.start(),
            notation: Notation::Hex,
        })
        .collect();

    for found in FUNCTIONAL.find_iter(content) {
        let raw = found.as_str();
        // Validation runs on the call with *all* whitespace removed, so
        // a multiline one is judged by its components rather than its
        // layout. Whitespace means JavaScript's, or a call holding a
        // U+FEFF is valid on one server and not the other.
        let bare: String = raw.chars().filter(|c| !is_js_whitespace(*c)).collect();
        if !is_valid_functional(&bare) {
            continue;
        }
        let normalised = normalise_whitespace(raw);
        matches.push(ColorMatch {
            notation: classify(&normalised),
            value: normalised,
            start: found.start(),
        });
    }

    matches.sort_by_key(|found| found.start);
    matches
}

/// The same literals, minus the short hex that prose gets wrong far more
/// often than it gets right.
///
/// For markdown, plain text, and any format with no extractor of its
/// own — never for a stylesheet, where `#250` is a colour.
pub(crate) fn find_literals_in_prose(content: &str) -> Vec<ColorMatch> {
    find_literals(content)
        .into_iter()
        .filter(|found| !is_issue_reference(&found.value))
        .collect()
}

/// A 3- or 4-digit hex with no `a`-`f` in it: `#250`, `#3050`.
///
/// Measured, not guessed. Across 1,988 real Markdown files there were
/// 377 unambiguous colours and 56 bare 3/4-digit hex. Fifty of the 56
/// were all-digit — `#250`, `#3050`, `#7077`, `#2378`, every one an
/// issue or PR reference — and six contained an `a`-`f` — `#FFF`,
/// `#abc`, every one a real colour. The rule costs six-hundredths of the
/// colours in the sample and buys fifty false findings back.
///
/// Heading anchors are not the collision, whatever the shape suggests:
/// `#configuration` and `#faq` cannot match a hex pattern at all,
/// because `o` and `q` are not hex digits.
fn is_issue_reference(value: &str) -> bool {
    let Some(digits) = value.strip_prefix('#') else {
        return false;
    };
    matches!(digits.len(), 3 | 4) && digits.bytes().all(|byte| byte.is_ascii_digit())
}

/// Collapse runs of whitespace to one space, then tighten the brackets:
/// `rgb( 1, 2, 3 )` reads as `rgb(1, 2, 3)`.
fn normalise_whitespace(raw: &str) -> String {
    let mut collapsed = String::with_capacity(raw.len());
    let mut in_space = false;
    for character in raw.chars() {
        if is_js_whitespace(character) {
            if !in_space {
                collapsed.push(' ');
                in_space = true;
            }
        } else {
            collapsed.push(character);
            in_space = false;
        }
    }
    collapsed.replacen("( ", "(", 1).replacen(" )", ")", 1)
}

/// Named-colour keywords inside the given segments, or the whole content
/// when none are given.
///
/// The segments are the whole point. A named colour is only a colour
/// where a value is expected — a declaration value, an attribute value,
/// a whole string literal — because `orange` in a sentence is a fruit.
pub(crate) fn find_named(content: &str, segments: Option<&[Segment]>) -> Vec<ColorMatch> {
    let whole = [Segment {
        start: 0,
        end: content.len(),
    }];
    let spans = segments.unwrap_or(&whole);

    let mut matches = Vec::new();
    for span in spans {
        let end = span.end.min(content.len());
        if span.start >= end {
            continue;
        }
        let slice = &content[span.start..end];
        for word in WORD.find_iter(slice) {
            if is_named_color(word.as_str()) {
                matches.push(ColorMatch {
                    value: word.as_str().to_string(),
                    start: span.start + word.start(),
                    notation: Notation::Named,
                });
            }
        }
    }
    matches.sort_by_key(|found| found.start);
    matches
}

/// The spans a declaration value occupies: after a `:` (and `=` for
/// Stylus) up to the next `;`, brace or newline.
pub(crate) fn find_declaration_values(content: &str, equals_delimiter: bool) -> Vec<Segment> {
    let bytes = content.as_bytes();
    let mut segments = Vec::new();
    let mut index = 0;

    while index < bytes.len() {
        let byte = bytes[index];
        let is_delimiter = byte == b':' || (equals_delimiter && byte == b'=');
        if !is_delimiter {
            index += 1;
            continue;
        }
        let mut end = index + 1;
        while end < bytes.len() && !matches!(bytes[end], b';' | b'{' | b'}' | b'\n') {
            end += 1;
        }
        if end > index + 1 {
            segments.push(Segment {
                start: index + 1,
                end,
            });
        }
        index = end.max(index + 1);
    }
    segments
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CommentSyntax {
    Css,
    CssLine,
    Js,
    Html,
}

/// Replace comment contents with spaces, **preserving newlines and byte
/// length**, so every offset into the result is still an offset into the
/// original.
///
/// The byte length is the part that bites. JavaScript replaces a
/// character with a space and the string keeps its length, because it
/// counts UTF-16 units; Rust replaces a multi-byte `char` with a
/// one-byte space and every offset after it shifts. A single accented
/// character in a comment was enough to slide the offsets, and far
/// enough to slice mid-character and panic. Blanking pads by
/// `len_utf8()` so that cannot happen.
///
/// Blanking rather than removing is what lets the matchers run on the
/// cleaned text and still report positions in the real file. String
/// literals are respected: a `/*` inside quotes does not open a comment.
pub(crate) fn blank_comments(content: &str, syntax: CommentSyntax) -> String {
    if syntax == CommentSyntax::Html {
        return blank_html(content);
    }

    let allow_line = matches!(syntax, CommentSyntax::CssLine | CommentSyntax::Js);
    let quotes: &[char] = if syntax == CommentSyntax::Js {
        &['\'', '"', '`']
    } else {
        &['\'', '"']
    };

    let chars: Vec<char> = content.chars().collect();
    let mut index = 0;
    let mut quote: Option<char> = None;
    // Which character positions were blanked. Applied at the end so a
    // multi-byte character becomes that many spaces rather than one.
    let mut blanked = vec![false; chars.len()];

    while index < chars.len() {
        let character = chars[index];

        if let Some(open) = quote {
            if character == '\\' {
                index += 2;
                continue;
            }
            if character == open || (character == '\n' && open != '`') {
                quote = None;
            }
            index += 1;
            continue;
        }

        if quotes.contains(&character) {
            quote = Some(character);
            index += 1;
            continue;
        }

        if character == '/' && chars.get(index + 1) == Some(&'*') {
            let mut end = index + 2;
            while end < chars.len() {
                if chars[end] == '*' && chars.get(end + 1) == Some(&'/') {
                    end += 2;
                    break;
                }
                end += 1;
            }
            let stop = end.min(chars.len());
            for position in index..stop {
                if chars[position] != '\n' {
                    blanked[position] = true;
                }
            }
            index = end;
            continue;
        }

        if allow_line && character == '/' && chars.get(index + 1) == Some(&'/') {
            let mut end = index;
            while end < chars.len() && chars[end] != '\n' {
                blanked[end] = true;
                end += 1;
            }
            index = end;
            continue;
        }

        index += 1;
    }

    let mut out = String::with_capacity(content.len());
    for (position, character) in chars.into_iter().enumerate() {
        if blanked[position] {
            // As many spaces as the character had bytes, so every offset
            // after this point still points where it did.
            for _ in 0..character.len_utf8() {
                out.push(' ');
            }
        } else {
            out.push(character);
        }
    }
    debug_assert_eq!(out.len(), content.len(), "blanking changed the byte length");
    out
}

fn blank_html(content: &str) -> String {
    let mut out = String::with_capacity(content.len());
    let mut rest = content;
    while let Some(open) = rest.find("<!--") {
        out.push_str(&rest[..open]);
        let after = &rest[open..];
        let close = after.find("-->").map_or(after.len(), |at| at + 3);
        for character in after[..close].chars() {
            if character == '\n' {
                out.push('\n');
            } else {
                for _ in 0..character.len_utf8() {
                    out.push(' ');
                }
            }
        }
        rest = &after[close..];
    }
    out.push_str(rest);
    debug_assert_eq!(out.len(), content.len(), "blanking changed the byte length");
    out
}

/// Spans of string-literal contents, quotes excluded, comment-aware.
///
/// Template literals are treated as plain text — good enough to find a
/// colour in a styled-component, and interpolation is not re-scanned.
pub(crate) fn find_string_literals(content: &str) -> Vec<Segment> {
    let blanked = blank_comments(content, CommentSyntax::Js);
    let chars: Vec<char> = blanked.chars().collect();
    // Character index to byte offset, so spans are usable on the
    // original string.
    let offsets: Vec<usize> = blanked
        .char_indices()
        .map(|(offset, _)| offset)
        .chain(std::iter::once(blanked.len()))
        .collect();

    let mut spans = Vec::new();
    let mut index = 0;
    let mut quote: Option<char> = None;
    let mut start = 0;

    while index < chars.len() {
        let character = chars[index];
        if let Some(open) = quote {
            if character == '\\' {
                index += 2;
                continue;
            }
            if character == open || (character == '\n' && open != '`') {
                spans.push(Segment {
                    start: offsets[start],
                    end: offsets[index],
                });
                quote = None;
            }
            index += 1;
            continue;
        }
        if matches!(character, '\'' | '"' | '`') {
            quote = Some(character);
            start = index + 1;
            index += 1;
            continue;
        }
        index += 1;
    }

    if quote.is_some() {
        spans.push(Segment {
            start: offsets[start.min(chars.len())],
            end: blanked.len(),
        });
    }
    spans
}

/// The four ways Rust's regex defaults answered differently from the
/// reference implementation's, each found by the `differential` job
/// generating a document nobody had thought to write down.
#[cfg(test)]
mod javascript_semantics {
    use super::*;

    /// `é` is a word character to Unicode and not to JavaScript, so a
    /// Unicode `\b` never closed and the hex before it was missed here
    /// and found there.
    #[test]
    fn a_word_boundary_is_ascii_like_the_reference() {
        let found = find_literals("#abc\u{e9}");
        assert_eq!(found.len(), 1, "{found:?}");
        assert_eq!(found[0].value, "#abc");
        assert_eq!(find_literals("\u{e9}#abc")[0].value, "#abc");
    }

    /// The mirror image: `\d` is every Unicode decimal digit in Rust and
    /// `[0-9]` in JavaScript, so an Arabic-Indic digit made a call valid
    /// here and not there.
    #[test]
    fn a_digit_is_ascii_like_the_reference() {
        assert!(
            find_literals("rgb(\u{661}, 2, 3)").is_empty(),
            "a non-ASCII digit is not a component"
        );
        assert_eq!(find_literals("rgb(1, 2, 3)")[0].value, "rgb(1, 2, 3)");
    }

    /// `(?i)[a-z]` folds U+212A (the Kelvin sign) to `k` in Unicode
    /// mode, so `whiteK` was one long word here and `white` followed by
    /// a symbol there.
    #[test]
    fn a_letter_is_ascii_like_the_reference() {
        let found = find_named("white\u{212a}", None);
        assert_eq!(found.len(), 1, "{found:?}");
        assert_eq!(found[0].value, "white");
    }

    /// U+FEFF is whitespace to JavaScript and not to Rust, and the call
    /// is validated after its whitespace is stripped — so this was a
    /// colour on one server and nothing on the other.
    #[test]
    fn whitespace_is_javascripts_set_in_both_directions() {
        let found = find_literals("rgb(1,\u{feff}2, 3)");
        assert_eq!(found.len(), 1, "{found:?}");
        assert_eq!(found[0].value, "rgb(1, 2, 3)");
        // U+0085 goes the other way: Unicode calls it whitespace and
        // JavaScript does not, so it is not a separator here either.
        assert!(
            find_literals("rgb(1,\u{85}2, 3)").is_empty(),
            "U+0085 is not whitespace to the reference implementation"
        );
    }
}

#[cfg(test)]
mod byte_length {
    use super::*;

    /// The regression a real repository found and the corpus could not:
    /// every corpus document is ASCII, and this only goes wrong when a
    /// comment holds a character wider than one byte.
    #[test]
    fn blanking_preserves_byte_length_with_multibyte_characters() {
        for (content, syntax) in [
            ("/* café ☕ */ .a{color:#fff}", CommentSyntax::Css),
            ("// café ☕\n.a{color:#fff}", CommentSyntax::CssLine),
            ("// café ☕\nconst a = \"#fff\";", CommentSyntax::Js),
            (
                "<!-- café ☕ --><div style=\"color:#fff\">",
                CommentSyntax::Html,
            ),
        ] {
            let blanked = blank_comments(content, syntax);
            assert_eq!(
                blanked.len(),
                content.len(),
                "{syntax:?} changed the byte length of {content:?}"
            );
        }
    }

    /// The offsets have to survive the blanking, or a position points at
    /// the wrong character — or at half of one.
    #[test]
    fn an_offset_after_a_multibyte_comment_still_points_at_the_colour() {
        let content = "/* café */ .a { color: #1a2b3c }";
        let blanked = blank_comments(content, CommentSyntax::Css);
        let found = &find_literals(&blanked)[0];
        assert_eq!(&content[found.start..found.start + 7], "#1a2b3c");
    }

    /// A string span taken from blanked text is sliced out of the
    /// original, so a multi-byte character anywhere before it must not
    /// shift the span.
    #[test]
    fn a_string_span_survives_a_multibyte_character_before_it() {
        let content = "const note = \"café\";\nconst brand = \"#1a2b3c\";";
        let spans = find_string_literals(content);
        let last = spans.last().expect("a span");
        assert_eq!(&content[last.start..last.end], "#1a2b3c");
    }
}
