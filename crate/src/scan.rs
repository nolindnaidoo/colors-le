//! One file end to end — the only path either surface calls.
//!
//! `cli.rs` and `mcp/` both come through here, so a rule can only be
//! written once. `tests/contracts.rs` asserts the two agree.

use std::path::{Path as StdPath, PathBuf};

use serde::Serialize;

use crate::extract::{self, Found, Palette, resolve_format};

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
    /// Whether this file looked like text and could not be read anyway —
    /// invalid UTF-8, or no permission to open it.
    ///
    /// Reported rather than swallowed, because a report that quietly
    /// skipped a file would be claiming coverage it does not have. It
    /// does **not** fail the run on its own; `--strict` is there for a
    /// pipeline that wants zero tolerance. A binary file never reaches
    /// this: it is not a text candidate, so it is not a shortfall. See
    /// `Examined`.
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

/// What reading one file produced.
///
/// The distinction is the point: a PNG was never a text candidate, while
/// a `.css` that turns out to hold invalid UTF-8 is a file this was
/// supposed to read and could not. Only the second is a shortfall, and
/// only the second is worth failing `--strict` over.
#[derive(Debug, Clone)]
pub(crate) enum Examined {
    /// Text, read and reported — findings, or a `skipped` diagnostic
    /// naming why the text could not be read.
    Text(FileReport),
    /// Binary, and therefore never a text candidate. No report line, no
    /// effect on the exit code; counted in the summary so the reader can
    /// still see that coverage was narrower than the tree.
    Binary,
}

pub(crate) fn scan_file(path: &PathBuf, options: &ScanOptions) -> Examined {
    let file = reported_path(path);
    let format = options.format.unwrap_or_else(|| format_of(path));

    match std::fs::read(path) {
        Ok(bytes) if looks_binary(&bytes) => Examined::Binary,
        Ok(bytes) => Examined::Text(match String::from_utf8(bytes) {
            Ok(content) => scan_content(without_bom(&content), file, format, options),
            // Named rather than dropped. A file that vanishes from the
            // report is a file the reader believes was covered — and
            // this one had no NUL byte, so it looked like text.
            Err(_) => skipped(file, format, "not UTF-8 text"),
        }),
        // An unopenable file is a shortfall whatever it holds: nothing
        // read it, so nothing knows whether it was text.
        Err(error) => Examined::Text(skipped(file, format, &error.to_string())),
    }
}

/// The path as the report carries it: separators are always `/`.
///
/// stdout is protocol. A report whose paths change shape with the
/// operating system cannot be diffed between two machines, and the
/// consumer downstream of it — a shell, a diff, a dashboard — has to
/// learn which platform produced it before it can split a path. A
/// sibling shipped `\` on Windows for a release and nobody noticed until
/// CI asserted it.
///
/// Only where `\` **is** the separator. On Unix a backslash is an
/// ordinary character in a file name, and rewriting it would report a
/// path that does not exist.
fn reported_path(path: &StdPath) -> String {
    let raw = path.to_string_lossy().into_owned();
    if std::path::MAIN_SEPARATOR != '\\' {
        return raw;
    }
    raw.replace('\\', "/")
}

/// ripgrep's heuristic, and deliberately the same one: a NUL byte in the
/// first 8 KB means binary.
///
/// Widening the walk to every file put fourteen PNGs, an `.ico` and a
/// `.jpg` in front of the reader on one real repository, each as a
/// `skipped` diagnostic — which made `--strict` exit 2 on any repository
/// containing an image, and so made `--strict` useless. Answering "what
/// does ripgrep consider binary" keeps this the same answer a person
/// auditing a repository already has in their head.
fn looks_binary(bytes: &[u8]) -> bool {
    const WINDOW: usize = 8 * 1024;
    bytes[..bytes.len().min(WINDOW)].contains(&0)
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

    // No `unknown-format` diagnostic any more: it said "nothing was
    // read", and something is read now. The `format` field already
    // carries `unknown`, which is the same information without a warning
    // per Python file — on a real repository that was most of stderr.
    let diagnostics = Vec::new();

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
    use crate::extract::FALLBACK_FORMAT;
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

    /// The text half of every `scan_file` test below: a binary file has
    /// no report to examine, which is the whole point of `Examined`.
    fn text(examined: Examined) -> FileReport {
        match examined {
            Examined::Text(report) => report,
            Examined::Binary => panic!("this file was expected to be a text candidate"),
        }
    }

    /// Changed deliberately: a file that could not be read is reported
    /// and does not fail the run, because every repository has one and
    /// exiting 2 on it meant the tool never got run in CI at all.
    #[test]
    fn an_unreadable_file_is_reported_and_does_not_end_the_run() {
        let tree = TempTree::new("scan-unreadable");
        let report = text(scan_file(&tree.path().join("gone.css"), &plain()));
        assert!(report.was_skipped());
        assert_eq!(report.diagnostics[0].severity, "warning");
        assert_eq!(exit_code(std::slice::from_ref(&report), false), 1);
        assert_eq!(exit_code(&[report], true), 2, "--strict is opt-in");
    }

    /// Invalid UTF-8 with no NUL byte in it: this looked like text, so
    /// failing to read it is a shortfall and `--strict` says so.
    #[test]
    fn a_text_file_that_is_not_utf8_is_named_rather_than_dropped() {
        let tree = TempTree::new("scan-notutf8");
        let file = tree.path().join("logo.css");
        std::fs::write(&file, [0x89, 0x50, 0xff, 0xfe]).expect("a file");
        // It used to vanish from the report entirely, which reads to
        // whoever runs this as "that file was clean".
        let report = text(scan_file(&file, &plain()));
        assert!(report.was_skipped());
        assert_eq!(report.diagnostics[0].message, "not UTF-8 text");
        assert_eq!(exit_code(std::slice::from_ref(&report), false), 1);
        assert_eq!(exit_code(&[report], true), 2);
    }

    /// A PNG is not a file that failed to be read; it was never a text
    /// candidate. It produces no report at all, so it cannot reach the
    /// exit code — which is what makes `--strict` usable on a repository
    /// that contains images.
    #[test]
    fn a_binary_file_is_passed_over_without_a_report() {
        let tree = TempTree::new("scan-binary");
        let file = tree.path().join("logo.png");
        std::fs::write(&file, [0x89, b'P', b'N', b'G', 0x00, 0x1a, 0x0a]).expect("a file");
        assert!(matches!(scan_file(&file, &plain()), Examined::Binary));
    }

    /// ripgrep's rule, and the reason it is ripgrep's: a NUL byte past
    /// the first 8 KB is not worth reading a whole file to find.
    #[test]
    fn binary_is_a_nul_byte_in_the_first_8kb() {
        assert!(looks_binary(b"a\0b"));
        assert!(!looks_binary(b".a{color:#fff}"));
        assert!(!looks_binary(&[]));
        let mut late = vec![b'a'; 9000];
        late.push(0);
        assert!(!looks_binary(&late), "past the window, so still text");
    }

    #[test]
    fn the_format_comes_from_the_file_name() {
        let tree = TempTree::new("scan-format");
        let file = tree.write("theme.scss", "// #deadbe\n.a{color:#1a2b3c}\n");
        let report = text(scan_file(&file, &plain()));
        assert_eq!(report.format, "scss");
        assert_eq!(values(&report), ["#1a2b3c"], "the line comment is skipped");
    }

    /// Changed deliberately in 0.2.0: an unknown format is read as raw
    /// text rather than refused, and the `format` field is what tells
    /// the reader which it was. The warning that used to say "nothing
    /// was read" is gone because it is no longer true.
    #[test]
    fn an_unknown_format_is_read_as_raw_text() {
        let report = scan_content("see #abc below", "a.md".into(), "unknown", &plain());
        assert_eq!(report.format, FALLBACK_FORMAT);
        assert_eq!(report.summary.colors, 1);
        assert!(report.diagnostics.is_empty(), "{:?}", report.diagnostics);
    }

    /// The rule that makes reading everything safe. `#250` is an issue
    /// reference in prose and a colour in a stylesheet, and both answers
    /// are correct.
    #[test]
    fn a_short_all_digit_hex_is_a_colour_only_where_one_belongs() {
        let prose = scan_content("fixed in #250", "notes.md".into(), "markdown", &plain());
        assert_eq!(prose.summary.colors, 0);
        let sheet = scan_content(".a{color:#250}", "a.css".into(), "css", &plain());
        assert_eq!(sheet.summary.colors, 1);
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

    /// stdout is protocol, so a path in it has one shape everywhere.
    #[test]
    fn a_reported_path_always_uses_forward_slashes() {
        let path = StdPath::new("src").join("theme.css");
        assert_eq!(reported_path(&path), "src/theme.css");
        assert!(!reported_path(&path).contains('\\'));
    }

    /// On Unix a backslash is a legal character in a file name, and a
    /// path this rewrote would name a file that does not exist.
    #[cfg(unix)]
    #[test]
    fn a_backslash_in_a_unix_file_name_survives() {
        assert_eq!(
            reported_path(StdPath::new("odd\\name.css")),
            "odd\\name.css"
        );
    }

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
