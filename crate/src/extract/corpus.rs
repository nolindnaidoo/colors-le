//! The shared corpus, embedded and run as unit tests.
//!
//! `fixtures/` is the contract between this crate and the extension.
//! Embedding it means `cargo test` on the published tarball runs every
//! case, so whoever installed this can check the parity claim in the
//! README instead of trusting it.
//!
//! The palette has no entry here: the extension has no equivalent, so
//! there is nothing for it to drift from.
//!
//! The extension's side is checked by
//! `../scripts/check-extraction-parity.ts`.

#[cfg_attr(not(test), expect(dead_code, reason = "the corpus is a test fixture"))]
pub(crate) fn document(name: &str) -> &'static str {
    match name {
        "theme.css" => include_str!("../../fixtures/documents/theme.css"),
        "theme.scss" => include_str!("../../fixtures/documents/theme.scss"),
        "page.html" => include_str!("../../fixtures/documents/page.html"),
        "theme.ts" => include_str!("../../fixtures/documents/theme.ts"),
        "icon.svg" => include_str!("../../fixtures/documents/icon.svg"),
        "plain.less" => include_str!("../../fixtures/documents/plain.less"),
        "notes.md" => include_str!("../../fixtures/documents/notes.md"),
        "tokens.json" => include_str!("../../fixtures/documents/tokens.json"),
        other => panic!("the corpus has no document named {other}"),
    }
}

#[cfg(test)]
mod tests {
    use serde::Deserialize;

    use super::document;
    use crate::extract::{Notation, extract};

    const CORPUS: &str = include_str!("../../fixtures/extraction.json");

    #[derive(Debug, Deserialize)]
    struct Corpus {
        documents: Vec<Case>,
    }

    #[derive(Debug, Deserialize)]
    struct Case {
        name: String,
        file: String,
        #[serde(rename = "fileType")]
        file_type: String,
        expected: Vec<Expected>,
    }

    #[derive(Debug, Deserialize, PartialEq)]
    struct Expected {
        value: String,
        format: Notation,
        line: usize,
        column: usize,
    }

    fn corpus() -> Corpus {
        serde_json::from_str(CORPUS).expect("the corpus is valid JSON")
    }

    /// Every colour, in the extension's order, at the extension's
    /// positions.
    #[test]
    fn every_corpus_document_reproduces() {
        let corpus = corpus();
        assert!(!corpus.documents.is_empty(), "the corpus is empty");

        for case in corpus.documents {
            let actual: Vec<Expected> = extract(document(&case.file), &case.file_type)
                .into_iter()
                .map(|found| Expected {
                    value: found.value,
                    format: found.notation,
                    line: found.position.line,
                    column: found.position.column,
                })
                .collect();
            assert_eq!(actual, case.expected, "{}", case.name);
        }
    }

    #[test]
    fn the_corpus_covers_every_format() {
        let corpus = corpus();
        for format in [
            "css",
            "scss",
            "less",
            "html",
            "svg",
            "typescript",
            "markdown",
            "json",
        ] {
            assert!(
                corpus.documents.iter().any(|case| case.file_type == format),
                "no corpus case reads {format}"
            );
        }
    }

    /// The cases that are easy to get wrong, kept where a change would
    /// have to notice them.
    #[test]
    fn the_corpus_still_pins_the_awkward_cases() {
        let corpus = corpus();
        let values: Vec<&str> = corpus
            .documents
            .iter()
            .flat_map(|case| case.expected.iter())
            .map(|found| found.value.as_str())
            .collect();
        assert!(
            values.contains(&"rgb(17, 34, 51)"),
            "the multiline call is no longer pinned"
        );
        assert!(values.contains(&"white"), "no named colour is pinned");
        assert!(
            !values
                .iter()
                .any(|value| value.len() == 6 && value.starts_with('#')),
            "a five-digit hex is being reported"
        );

        // The prose rule, from both directions: an issue reference in
        // Markdown is not a colour, and the same digits in a token file
        // are one.
        let prose: Vec<&str> = corpus
            .documents
            .iter()
            .filter(|case| case.file_type == "markdown")
            .flat_map(|case| case.expected.iter())
            .map(|found| found.value.as_str())
            .collect();
        assert!(
            !prose.contains(&"#250"),
            "an issue reference is being reported as a colour"
        );
        assert!(
            prose.contains(&"#FFF"),
            "a short hex with letters in it is no longer pinned as a colour"
        );
        assert!(
            values.contains(&"#250"),
            "no corpus case pins a short all-digit hex that IS a colour"
        );
    }
}
