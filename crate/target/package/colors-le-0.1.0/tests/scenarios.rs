//! The tier that needs a document far larger than any editor opens.
//!
//! Gated behind `COLORS_LE_SCENARIOS` and run by CI. Nothing here
//! substitutes for the unit tests, which run everywhere on every push.
//!
//! **A skipped scenario is never reported as a pass.**

use std::fmt::Write as _;
use std::io::Write as _;

fn enabled(name: &str) -> bool {
    if std::env::var_os("COLORS_LE_SCENARIOS").is_some() {
        return true;
    }
    eprintln!("SKIPPED {name}: set COLORS_LE_SCENARIOS to run it");
    false
}

fn scan(content: &str, format: &str) -> serde_json::Value {
    let output = std::process::Command::new(env!("CARGO_BIN_EXE_colors-le"))
        .args(["--stdin", "--format", format])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .and_then(|mut child| {
            child
                .stdin
                .as_mut()
                .expect("stdin")
                .write_all(content.as_bytes())?;
            child.wait_with_output()
        })
        .expect("the binary runs");
    serde_json::from_slice(&output.stdout).expect("stdout carries JSON")
}

/// A design system's compiled stylesheet is the real shape: tens of
/// thousands of declarations, most of them colours. Settling matches
/// deduplicates by start offset, which is the step that goes quadratic
/// if it is written the obvious way.
#[test]
fn a_large_stylesheet_completes() {
    if !enabled("a_large_stylesheet_completes") {
        return;
    }
    let mut content = String::new();
    for index in 0..40_000 {
        let _ = writeln!(
            content,
            ".c{index} {{ color: #{:06x}; }}",
            index * 7 % 0x00ff_ffff
        );
    }
    let report = scan(&content, "css");
    assert_eq!(report["summary"]["colors"], 40_000);
}

/// A minified bundle is one very long line. Column lookup counts UTF-16
/// units from the line start, which is what turns quadratic when the
/// line never ends.
#[test]
fn a_single_long_line_completes() {
    if !enabled("a_single_long_line_completes") {
        return;
    }
    let mut content = String::new();
    for index in 0..30_000 {
        let _ = write!(content, ".c{index}{{color:#1a2b3c}}");
    }
    let report = scan(&content, "css");
    assert_eq!(report["summary"]["colors"], 30_000);
}

/// Comment blanking walks the document character by character. A file
/// that is mostly comment is the worst case for it, and a stylesheet
/// with a licence header on every rule is not unusual in a build output.
#[test]
fn a_document_that_is_mostly_comment_completes() {
    if !enabled("a_document_that_is_mostly_comment_completes") {
        return;
    }
    let mut content = String::new();
    for index in 0..20_000 {
        let _ = writeln!(
            content,
            "/* rule {index}: do not use #deadbe here */\n.c{index} {{ color: #1a2b3c; }}"
        );
    }
    let report = scan(&content, "css");
    assert_eq!(
        report["summary"]["colors"], 20_000,
        "every commented colour stays out"
    );
}
