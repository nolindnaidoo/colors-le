//! One file end to end — the only path either surface calls.
//!
//! `cli.rs` and `mcp/` both come through here, so a rule can only be
//! written once. `tests/contracts.rs` asserts the two agree.

use std::path::{Path as StdPath, PathBuf};

use serde::Serialize;

use crate::extract::{self, FALLBACK_FORMAT, Found, Palette, resolve_format};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub(crate) struct Diagnostic {
    pub(crate) severity: String,
    pub(crate) code: String,
    pub(crate) message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub(crate) struct Summary {
    pub(crate) colors: usize,
    /// How many colours are not in the palette.
    ///
    /// Always present, and zero when no palette was given — a count is
    /// not a verdict, and a reader piping the JSON should not have to
    /// branch on whether the field exists.
    #[serde(rename = "outsidePalette")]
    pub(crate) outside_palette: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub(crate) struct FileReport {
    pub(crate) file: String,
    pub(crate) format: String,
    pub(crate) colors: Vec<Found>,
    pub(crate) diagnostics: Vec<Diagnostic>,
    pub(crate) summary: Summary,
}

impl FileReport {
    pub(crate) fn is_unreadable(&self) -> bool {
        self.diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "unreadable")
    }
}

#[derive(Debug, Clone, Default)]
pub(crate) struct ScanOptions {
    pub(crate) dedupe: bool,
    /// A format the caller forced, instead of one inferred per file.
    pub(crate) format: Option<&'static str>,
    /// The approved palette, when one was given.
    pub(crate) palette: Option<Palette>,
}

pub(crate) fn scan_file(path: &PathBuf, options: &ScanOptions) -> Option<FileReport> {
    let file = path.to_string_lossy().into_owned();
    let format = options.format.unwrap_or_else(|| format_of(path));

    match std::fs::read(path) {
        // A file that is not UTF-8 holds no stylesheet to read. Failing
        // on each would make the tool unusable in a repository with
        // images in it.
        Ok(bytes) => String::from_utf8(bytes)
            .ok()
            .map(|content| scan_content(&content, file, format, options)),
        Err(error) => Some(FileReport {
            file,
            format: format.to_string(),
            colors: Vec::new(),
            diagnostics: vec![Diagnostic {
                severity: "error".to_string(),
                code: "unreadable".to_string(),
                message: format!("could not be read: {error}"),
            }],
            summary: Summary {
                colors: 0,
                outside_palette: 0,
            },
        }),
    }
}

fn format_of(path: &StdPath) -> &'static str {
    resolve_format(None, path.file_name().and_then(|name| name.to_str()))
}

pub(crate) fn scan_content(
    content: &str,
    file: String,
    format: &str,
    options: &ScanOptions,
) -> FileReport {
    let mut colors = match &options.palette {
        Some(palette) => extract::extract_against(content, format, palette),
        None => extract::extract(content, format),
    };

    if options.dedupe {
        // By value, which is the only sense in which a colour repeats.
        // Two spellings of the same colour are two findings for a
        // reviewer: `#FFF` and `#ffffff` are the same pixel and a
        // different inconsistency.
        let mut seen = std::collections::HashSet::new();
        colors.retain(|found| seen.insert(found.value.clone()));
    }

    let mut diagnostics = Vec::new();
    if format == FALLBACK_FORMAT {
        diagnostics.push(Diagnostic {
            severity: "warning".to_string(),
            code: "unknown-format".to_string(),
            message: "no extractor for this format, so nothing was read".to_string(),
        });
    }

    let outside_palette = colors
        .iter()
        .filter(|found| found.in_palette == Some(false))
        .count();

    FileReport {
        file,
        format: format.to_string(),
        summary: Summary {
            colors: colors.len(),
            outside_palette,
        },
        colors,
        diagnostics,
    }
}

/// 0 colours found and none outside the palette · 1 none found, **or** a
/// colour outside the palette · 2 could not answer.
///
/// That 1 carries two meanings is deliberate and follows grep. Without a
/// palette this is an extractor and 1 means "none found"; with one it is
/// a check and 1 means "a violation". A run cannot be both, because a
/// run with a palette that found nothing has nothing to violate.
pub(crate) fn exit_code(reports: &[FileReport]) -> u8 {
    if reports.iter().any(FileReport::is_unreadable) {
        return 2;
    }
    let outside: usize = reports
        .iter()
        .map(|report| report.summary.outside_palette)
        .sum();
    if outside > 0 {
        return 1;
    }
    u8::from(!reports.iter().any(|report| report.summary.colors > 0))
}

pub(crate) fn describe(report: &FileReport, found: &Found) -> String {
    let mark = match found.in_palette {
        Some(false) => "  ← not in palette",
        _ => "",
    };
    format!(
        "{}:{}:{}  {}{mark}",
        report.file, found.position.line, found.position.column, found.value
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testing::TempTree;

    fn plain() -> ScanOptions {
        ScanOptions::default()
    }

    fn values(report: &FileReport) -> Vec<&str> {
        report.colors.iter().map(|c| c.value.as_str()).collect()
    }

    #[test]
    fn a_document_with_colours_exits_zero() {
        let report = scan_content(".a{color:#1a2b3c}", "a.css".into(), "css", &plain());
        assert_eq!(values(&report), ["#1a2b3c"]);
        assert_eq!(exit_code(&[report]), 0);
    }

    #[test]
    fn a_document_with_none_exits_one() {
        let report = scan_content(".a{display:block}", "a.css".into(), "css", &plain());
        assert_eq!(report.summary.colors, 0);
        assert_eq!(exit_code(&[report]), 1);
    }

    #[test]
    fn nothing_to_scan_exits_one() {
        assert_eq!(exit_code(&[]), 1);
    }

    #[test]
    fn an_unreadable_file_ends_the_run_at_two() {
        let tree = TempTree::new("scan-unreadable");
        let report = scan_file(&tree.path().join("gone.css"), &plain()).expect("a report");
        assert!(report.is_unreadable());
        assert_eq!(exit_code(&[report]), 2);
    }

    #[test]
    fn a_binary_file_is_skipped_rather_than_failed() {
        let tree = TempTree::new("scan-binary");
        let file = tree.path().join("logo.css");
        std::fs::write(&file, [0x89, 0x50, 0xff, 0xfe]).expect("a file");
        assert!(scan_file(&file, &plain()).is_none());
    }

    #[test]
    fn the_format_comes_from_the_file_name() {
        let tree = TempTree::new("scan-format");
        let file = tree.write("theme.scss", "// #deadbe\n.a{color:#1a2b3c}\n");
        let report = scan_file(&file, &plain()).expect("a report");
        assert_eq!(report.format, "scss");
        assert_eq!(values(&report), ["#1a2b3c"], "the line comment is skipped");
    }

    /// An unknown format finds nothing and says why, rather than
    /// scanning raw text and reporting every `#anchor`.
    #[test]
    fn an_unknown_format_reads_nothing_and_says_so() {
        let report = scan_content("see #abc below", "a.md".into(), "unknown", &plain());
        assert_eq!(report.summary.colors, 0);
        assert_eq!(report.diagnostics[0].code, "unknown-format");
    }

    #[test]
    fn dedupe_collapses_repeats_to_the_first() {
        let content = ".a{color:#1a2b3c}\n.b{color:#1a2b3c}\n.c{color:#ffffff}";
        let kept = scan_content(content, "a.css".into(), "css", &plain());
        assert_eq!(kept.summary.colors, 3);
        let deduped = scan_content(
            content,
            "a.css".into(),
            "css",
            &ScanOptions {
                dedupe: true,
                ..plain()
            },
        );
        assert_eq!(values(&deduped), ["#1a2b3c", "#ffffff"]);
    }

    /// Two spellings of the same colour are two findings: same pixel,
    /// different inconsistency.
    #[test]
    fn dedupe_is_by_text_not_by_colour() {
        let content = ".a{color:#FFF}\n.b{color:#ffffff}";
        let deduped = scan_content(
            content,
            "a.css".into(),
            "css",
            &ScanOptions {
                dedupe: true,
                ..plain()
            },
        );
        assert_eq!(deduped.summary.colors, 2);
    }

    #[test]
    fn without_a_palette_no_colour_carries_a_verdict() {
        let report = scan_content(".a{color:#1a2b3c}", "a.css".into(), "css", &plain());
        assert_eq!(report.colors[0].in_palette, None);
        let rendered = serde_json::to_string(&report).expect("serializes");
        assert!(!rendered.contains("inPalette"), "{rendered}");
    }

    #[test]
    fn a_palette_turns_an_unapproved_colour_into_a_finding() {
        let options = ScanOptions {
            palette: Some(Palette::parse("#1a2b3c").0),
            ..plain()
        };
        let report = scan_content(
            ".a{color:#1a2b3c}\n.b{color:#ff0000}",
            "a.css".into(),
            "css",
            &options,
        );
        assert_eq!(report.colors[0].in_palette, Some(true));
        assert_eq!(report.colors[1].in_palette, Some(false));
        assert_eq!(report.summary.outside_palette, 1);
        assert_eq!(exit_code(&[report]), 1);
    }

    /// The palette matches by colour, so a violation written in another
    /// notation is still caught.
    #[test]
    fn a_palette_matches_across_notations() {
        let options = ScanOptions {
            palette: Some(Palette::parse("#ffffff").0),
            ..plain()
        };
        let report = scan_content(
            ".a{color:rgb(255, 255, 255)}",
            "a.css".into(),
            "css",
            &options,
        );
        assert_eq!(report.colors[0].in_palette, Some(true));
        assert_eq!(exit_code(&[report]), 0);
    }

    #[test]
    fn the_human_line_marks_a_violation() {
        let options = ScanOptions {
            palette: Some(Palette::parse("#1a2b3c").0),
            ..plain()
        };
        let report = scan_content(".a{color:#ff0000}", "a.css".into(), "css", &options);
        assert!(describe(&report, &report.colors[0]).contains("not in palette"));
    }

    #[test]
    fn the_human_line_is_plain_without_a_palette() {
        let report = scan_content(".a{color:#1a2b3c}", "a.css".into(), "css", &plain());
        assert_eq!(describe(&report, &report.colors[0]), "a.css:1:10  #1a2b3c");
    }
}
