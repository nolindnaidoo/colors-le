//! Which extractor reads a document.
//!
//! **An unresolved format is read, not refused.** It used to be refused,
//! on the reasoning that a colour only means something where a colour
//! can appear. The reasoning was sound and the conclusion was wrong: it
//! left this unable to open a `.json`, which is where a design system
//! keeps its tokens, and a reviewer pointing it at a repository got an
//! audit of the stylesheets and silence about everything else.
//!
//! What the refusal was really protecting against is one collision —
//! `#250` in prose is an issue reference, not a colour — and that is
//! answered by a rule about short hex rather than by declining to read
//! the file. See `heuristics::is_issue_reference`.

/// Every name a caller might send, mapped to the extractor key it means.
///
/// Ported verbatim from the extension's own table. **`typescript` and
/// `xml` are their own keys**, even though they read exactly like
/// `javascript` and `svg`: the key is user-visible as `fileType` in
/// every MCP answer, so collapsing them would have the two servers
/// disagree about what they just read. The corpus caught that on its
/// first run. Which extractor a key runs is a separate question, and
/// `extractor_of` answers it.
///
/// The table is also held in `fixtures/aliases.json`, which both
/// frontends check themselves against. Ported-by-hand twice is how
/// `typescriptreact` came to be accepted by the extension and refused
/// here: no error, no colours, for the caller most likely to send a VS
/// Code language id.
const ALIASES: [(&str, &str); 34] = [
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
    ("typescriptreact", "typescript"),
    ("svg", "svg"),
    ("xml", "xml"),
    ("json", "json"),
    ("jsonc", "json"),
    ("yaml", "yaml"),
    ("yml", "yaml"),
    ("toml", "toml"),
    ("markdown", "markdown"),
    ("md", "markdown"),
    ("plaintext", "plaintext"),
    ("txt", "plaintext"),
];

/// The formats a caller can name, for the tool schema's enum. Held equal
/// to the alias table by a test, so a format can never be offered and
/// then not resolve.
///
/// It is not the list of formats this *reads* — that list is every
/// format, because anything absent here is read by the raw scan. It is
/// the list a caller gets a named answer for.
pub(crate) const SUPPORTED_FORMATS: [&str; 14] = [
    "css",
    "scss",
    "less",
    "stylus",
    "html",
    "javascript",
    "typescript",
    "svg",
    "xml",
    "json",
    "yaml",
    "toml",
    "markdown",
    "plaintext",
];

/// What the engine reports when it recognises nothing.
///
/// **`unknown`, not `fallback`.** The extension names it that and the
/// name is user-visible: it is the `fileType` every MCP answer carries,
/// so the two servers would disagree on a field that is right there in
/// the response. The corpus caught it on the first run.
///
/// The document is still read — by the raw scan, with the short-hex rule
/// applied. `unknown` names how much this knew about the file, not
/// whether it opened it, and it is the one signal a reader has that the
/// answer came from a scan rather than a parser.
pub(crate) const FALLBACK_FORMAT: &str = "unknown";

/// Which extractor a resolved format runs, by name.
///
/// Named rather than left inline in `extract()`, because the extension
/// makes this same choice in `determineFileType` and
/// `extractColorsByFileType`, and two copies of a mapping drift. This
/// one already did: `xml` ran the markup-HTML extractor here and the
/// markup-SVG one there, so `<rect fill="#1a2b3c"/>` was found by the
/// extension and **missed** by this crate — a shared MCP tool giving
/// two answers, in the under-reporting direction. `fixtures/aliases.json`
/// holds both sides to this table now; the alias check could not see it,
/// because the divergence is a layer below the alias.
///
/// The names are the extractor families, not the formats: `scss` and
/// `less` read identically and say so by sharing one.
pub(crate) fn extractor_of(format: &str) -> &'static str {
    match canonical(format) {
        "css" => "css",
        "scss" => "scss",
        "less" => "less",
        "stylus" => "stylus",
        "html" => "html",
        // An XML document is not required to be SVG, but the SVG
        // attribute list is a superset of the HTML one, so reading it as
        // markup-SVG finds strictly more and loses nothing.
        "xml" | "svg" => "svg",
        "javascript" | "typescript" => "javascript",
        "json" | "yaml" | "toml" => "text-tokens",
        _ => "text-prose",
    }
}

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
/// filename, else `unknown`.
///
/// `unknown` is an answer, not a failure: the document is read by the
/// raw scan. That is the difference between a tool a reviewer can point
/// at a repository and one they have to describe it to first.
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
    use std::collections::BTreeMap;

    use serde::Deserialize;

    use super::*;

    /// The alias table, as both frontends must hold it.
    ///
    /// Embedded rather than read, because `extract/` touches no
    /// filesystem and because the published tarball has to be able to
    /// run this check on its own.
    const SHARED: &str = include_str!("../../fixtures/aliases.json");

    #[derive(Debug, Deserialize)]
    struct Shared {
        aliases: BTreeMap<String, String>,
        extractors: BTreeMap<String, String>,
        formats: Vec<String>,
    }

    /// Two hand-ported copies of one table drift, and the drift is
    /// silent: the extension accepted `typescriptreact` while this
    /// returned `{"colors": [], "fileType": "unknown"}` — no error, no
    /// colours, for the caller most likely to send a VS Code language
    /// id. `scripts/check-extraction-parity.ts` holds the extension to
    /// the same file.
    #[test]
    fn the_alias_table_matches_the_one_the_extension_is_held_to() {
        let shared: Shared = serde_json::from_str(SHARED).expect("the shared table is valid JSON");
        let ours: BTreeMap<String, String> = ALIASES
            .iter()
            .map(|(alias, key)| ((*alias).to_string(), (*key).to_string()))
            .collect();

        assert_eq!(ours, shared.aliases);
        assert_eq!(SUPPORTED_FORMATS.to_vec(), shared.formats);
        assert_eq!(
            ours.len(),
            ALIASES.len(),
            "an alias is listed twice, so one of them is dead"
        );
    }

    /// The layer below the alias, and the one that shipped a divergence
    /// the alias check could not see: both frontends resolved `xml` to
    /// `xml`, and then ran different extractors on it — markup-HTML here
    /// and markup-SVG there — so `fill="#1a2b3c"` was missed by this
    /// crate alone. Every format the caller can name is pinned, plus the
    /// fallback, because the fallback is a document nobody named.
    #[test]
    fn the_extractor_each_format_runs_matches_the_extension() {
        let shared: Shared = serde_json::from_str(SHARED).expect("the shared table is valid JSON");
        let ours: BTreeMap<String, String> = SUPPORTED_FORMATS
            .iter()
            .chain(std::iter::once(&FALLBACK_FORMAT))
            .map(|format| ((*format).to_string(), extractor_of(format).to_string()))
            .collect();

        assert_eq!(ours, shared.extractors);
    }

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
            // The one that was missing here and present there.
            ("typescriptreact", "typescript"),
            ("javascriptreact", "javascript"),
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
        assert_eq!(resolve_format(None, Some("notes.md")), "markdown");
        assert_eq!(resolve_format(None, Some("tokens.json")), "json");
        assert_eq!(resolve_format(None, Some("compose.yml")), "yaml");
    }

    /// `unknown` is what this knew about the file, not whether it opened
    /// it: the raw scan reads the document either way.
    #[test]
    fn anything_unrecognised_is_unknown() {
        for name in ["python", "rust", "", "wat"] {
            assert_eq!(resolve_format(Some(name), None), FALLBACK_FORMAT, "{name}");
        }
        assert_eq!(resolve_format(None, Some("main.py")), FALLBACK_FORMAT);
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
