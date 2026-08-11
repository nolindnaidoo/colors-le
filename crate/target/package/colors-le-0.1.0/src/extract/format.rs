//! Which extractor reads a document.
//!
//! **An unresolved format is not an error.** Every other crate in this
//! family refuses a name it does not recognise; this one falls through
//! to quoted-string extraction, because that is what the extension does
//! and because it is the case that matters most. A `.ts` file is not a
//! format this parses, and its quoted strings are exactly the
//! user-facing copy a reviewer came for.

/// Every name a caller might send, mapped to the extractor key it means.
/// Ported from the extension's `ALIASES` rather than re-derived: two
/// frontends disagreeing about whether `conf` is INI is two frontends
/// reading the same file differently.
/// Every name a caller might send, mapped to the extractor key it means.
///
/// Ported verbatim from the extension's own table. **`typescript` and
/// `xml` are their own keys**, even though they read exactly like
/// `javascript` and `html`: the key is user-visible as `fileType` in
/// every MCP answer, so collapsing them would have the two servers
/// disagree about what they just read. The corpus caught that on its
/// first run.
const ALIASES: [(&str, &str); 24] = [
    ("css", "css"),
    ("scss", "scss"),
    ("sass", "scss"),
    ("less", "less"),
    ("stylus", "stylus"),
    ("styl", "stylus"),
    ("html", "html"),
    ("htm", "html"),
    ("xhtml", "html"),
    ("vue", "html"),
    ("svelte", "html"),
    ("javascript", "javascript"),
    ("js", "javascript"),
    ("jsx", "javascript"),
    ("mjs", "javascript"),
    ("cjs", "javascript"),
    ("javascriptreact", "javascript"),
    ("typescript", "typescript"),
    ("ts", "typescript"),
    ("tsx", "typescript"),
    ("mts", "typescript"),
    ("cts", "typescript"),
    ("svg", "svg"),
    ("xml", "xml"),
];

/// The formats a caller can name, for the tool schema's enum. Held equal
/// to the alias table by a test, so a format can never be offered and
/// then not resolve.
pub(crate) const SUPPORTED_FORMATS: [&str; 9] = [
    "css",
    "scss",
    "less",
    "stylus",
    "html",
    "javascript",
    "typescript",
    "svg",
    "xml",
];

/// What the engine uses when it recognises nothing.
///
/// **`unknown`, not `fallback`.** The extension names it that and the
/// name is user-visible: it is the `fileType` every MCP answer carries,
/// so the two servers would disagree on a field that is right there in
/// the response. The corpus caught it on the first run.
/// What the engine uses when it recognises nothing.
///
/// **A refusal, not a fallback.** Unlike string-le and numbers-le, there
/// is no useful thing to do with an unknown document here: a colour only
/// means something in a place where a colour can appear, and without a
/// format there is no such place. Scanning raw text would find every
/// three-letter word that happens to be hex and every `#anchor` in a
/// README.
pub(crate) const FALLBACK_FORMAT: &str = "unknown";

fn normalise(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .trim_start_matches('.')
        .to_string()
}

/// The extractor key for an already-canonical format name, or
/// `fallback`. Used on the hot path, where the caller has resolved once.
pub(crate) fn canonical(format: &str) -> &'static str {
    ALIASES
        .iter()
        .find(|(alias, _)| *alias == format)
        .map_or(FALLBACK_FORMAT, |(_, key)| *key)
}

/// Resolve an extractor key from an explicit format, else from a
/// filename, else `fallback`.
///
/// A caller who knows nothing about a document still gets its strings —
/// which is the difference between a tool a reviewer can point at a
/// repository and one they have to describe it to first.
pub(crate) fn resolve_format(format: Option<&str>, filename: Option<&str>) -> &'static str {
    if let Some(name) = format {
        let direct = canonical(&normalise(name));
        if direct != FALLBACK_FORMAT {
            return direct;
        }
    }

    let Some(filename) = filename else {
        return FALLBACK_FORMAT;
    };

    // A dotfile like `.env` has no extension to split on; its whole name
    // is the type.
    let whole = canonical(&normalise(filename));
    if whole != FALLBACK_FORMAT {
        return whole;
    }

    filename
        .rsplit_once('.')
        .map_or(FALLBACK_FORMAT, |(_, extension)| {
            canonical(&normalise(extension))
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_offered_format_resolves_to_itself() {
        for format in SUPPORTED_FORMATS {
            assert_eq!(resolve_format(Some(format), None), format, "{format}");
        }
    }

    #[test]
    fn the_extensions_aliases_are_honoured() {
        for (alias, expected) in [
            ("sass", "scss"),
            ("styl", "stylus"),
            ("htm", "html"),
            ("js", "javascript"),
            ("ts", "typescript"),
            ("tsx", "typescript"),
            ("vue", "html"),
        ] {
            assert_eq!(resolve_format(Some(alias), None), expected, "{alias}");
        }
    }

    #[test]
    fn a_name_is_normalised_before_it_is_matched() {
        assert_eq!(resolve_format(Some("  CSS "), None), "css");
        assert_eq!(resolve_format(Some(".scss"), None), "scss");
    }

    #[test]
    fn a_filename_supplies_the_format_when_none_is_named() {
        assert_eq!(resolve_format(None, Some("theme.css")), "css");
        assert_eq!(resolve_format(None, Some("icon.SVG")), "svg");
        assert_eq!(resolve_format(None, Some("app.tsx")), "typescript");
        assert_eq!(resolve_format(None, Some("notes.md")), FALLBACK_FORMAT);
    }

    /// **A refusal, not a fallback.** There is no useful thing to do
    /// with an unknown document: a colour only means something where a
    /// colour can appear, and a raw scan would report every `#anchor` in
    /// a README.
    #[test]
    fn anything_unrecognised_is_unknown() {
        for name in ["python", "markdown", "", "wat"] {
            assert_eq!(resolve_format(Some(name), None), FALLBACK_FORMAT, "{name}");
        }
        assert_eq!(resolve_format(None, Some("README.md")), FALLBACK_FORMAT);
        assert_eq!(resolve_format(None, None), FALLBACK_FORMAT);
    }

    #[test]
    fn an_unresolved_format_defers_to_the_filename() {
        assert_eq!(resolve_format(Some("nonsense"), Some("a.scss")), "scss");
    }

    #[test]
    fn the_offered_list_matches_the_alias_table() {
        for format in SUPPORTED_FORMATS {
            assert!(
                ALIASES.iter().any(|(_, key)| *key == format),
                "{format} is offered but no alias produces it"
            );
        }
        for (_, key) in ALIASES {
            assert!(
                SUPPORTED_FORMATS.contains(&key),
                "{key} is produced but not offered"
            );
        }
    }
}
