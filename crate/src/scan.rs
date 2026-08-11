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
    /// Whether this file was not read at all — not text, or not
    /// openable.
    ///
    /// Reported rather than swallowed, because a report that quietly
    /// skipped a file would be claiming coverage it does not have. It
    /// does **not** fail the run on its own: every repository has a PNG
    /// and a zip in it, and exiting 2 on those makes the tool unusable
    /// in CI, which is the one place it is most worth running.
    /// `--strict` is there for a pipeline that wants zero tolerance.
    pub(crate) fn was_skipped(&self) -> bool {
        self.diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "skipped")
    }

    /// Whether the scan of this file gave up part way. Unlike a skip
    /// this **does** fail the run: reporting no findings when a
    /// detector stopped early would overstate coverage, which is the
    /// one thing an audit tool must never do.
    pub(crate) fn is_incomplete(&self) -> bool {
        self.diagnostics
            .iter()
            .any(|diagnostic| diagnostic.severity == "error")
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

pub(crate) fn scan_file(path: &PathBuf, options: &ScanOptions) -> FileReport {
    let file = path.to_string_lossy().into_owned();
    let format = options.format.unwrap_or_else(|| format_of(path));

    match std::fs::read(path) {
        Ok(bytes) => match String::from_utf8(bytes) {
            Ok(content) => scan_content(without_bom(&content), file, format, options),
            // Named rather than dropped. A file that vanishes from the
            // report is a file the reader believes was covered.
            Err(_) => skipped(file, format, "not UTF-8 text"),
        },
        Err(error) => skipped(file, format, &error.to_string()),
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
pub(crate) fn exit_code(reports: &[FileReport], strict: bool) -> u8 {
    // A scan that gave up part way always fails: it would otherwise
    // report "nothing found" for a file it never finished reading.
    if reports.iter().any(FileReport::is_incomplete) {
        return 2;
    }
    if strict && reports.iter().any(FileReport::was_skipped) {
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
        assert_eq!(exit_code(&[report], false), 0);
    }

    #[test]
    fn a_document_with_none_exits_one() {
        let report = scan_content(".a{display:block}", "a.css".into(), "css", &plain());
        assert_eq!(report.summary.colors, 0);
        assert_eq!(exit_code(&[report], false), 1);
    }

    #[test]
    fn nothing_to_scan_exits_one() {
        assert_eq!(exit_code(&[], false), 1);
    }

    /// Changed deliberately: a file that could not be read is reported
    /// and does not fail the run, because every repository has one and
    /// exiting 2 on it meant the tool never got run in CI at all.
    #[test]
    fn an_unreadable_file_is_reported_and_does_not_end_the_run() {
        let tree = TempTree::new("scan-unreadable");
        let report = scan_file(&tree.path().join("gone.css"), &plain());
        assert!(report.was_skipped());
        assert_eq!(report.diagnostics[0].severity, "warning");
        assert_eq!(exit_code(std::slice::from_ref(&report), false), 1);
        assert_eq!(exit_code(&[report], true), 2, "--strict is opt-in");
    }

    #[test]
    fn a_binary_file_is_named_rather_than_dropped() {
        let tree = TempTree::new("scan-binary");
        let file = tree.path().join("logo.css");
        std::fs::write(&file, [0x89, 0x50, 0xff, 0xfe]).expect("a file");
        // It used to vanish from the report entirely, which reads to
        // whoever runs this as "that file was clean".
        let report = scan_file(&file, &plain());
        assert!(report.was_skipped());
        assert_eq!(report.diagnostics[0].message, "not UTF-8 text");
        assert_eq!(exit_code(std::slice::from_ref(&report), false), 1);
        assert_eq!(exit_code(&[report], true), 2);
    }

    #[test]
    fn the_format_comes_from_the_file_name() {
        let tree = TempTree::new("scan-format");
        let file = tree.write("theme.scss", "// #deadbe\n.a{color:#1a2b3c}\n");
        let report = scan_file(&file, &plain());
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
        assert_eq!(exit_code(&[report], false), 1);
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
        assert_eq!(exit_code(&[report], false), 0);
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

/// The report for a file that was not read: named, warned about, and
/// not a failure by itself.
fn skipped(file: String, format: &'static str, reason: &str) -> FileReport {
    FileReport {
        file,
        format: format.to_string(),
        colors: Vec::new(),
        diagnostics: vec![Diagnostic {
            severity: "warning".to_string(),
            code: "skipped".to_string(),
            message: reason.to_string(),
        }],
        summary: Summary {
            colors: 0,
            outside_palette: 0,
        },
    }
}

/// Drop a leading byte-order mark.
///
/// No editor shows it and VS Code strips it before the extension ever
/// sees a document, so without this the two frontends read the same file
/// differently the moment anything on Windows saves it — Notepad, Excel,
/// a PowerShell redirect. Three invisible bytes shift every column on
/// the first line, and in a structured format they can lose the
/// document entirely.
pub(crate) fn without_bom(content: &str) -> &str {
    content.strip_prefix('\u{feff}').unwrap_or(content)
}

#[cfg(test)]
mod hazards {
    use super::*;

    /// Three invisible bytes that Notepad, Excel and a PowerShell
    /// redirect all add, and that VS Code strips before the extension
    /// ever sees a document — so without this the two frontends read
    /// the same file differently.
    #[test]
    fn a_byte_order_mark_is_not_part_of_the_document() {
        assert_eq!(without_bom("\u{feff}abc"), "abc");
        assert_eq!(without_bom("abc"), "abc");
        // Only a leading one: elsewhere it is a zero-width no-break
        // space and belongs to the text.
        assert_eq!(without_bom("a\u{feff}b"), "a\u{feff}b");
    }
}
