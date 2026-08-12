//! What differs by operating system, asserted rather than hoped.
//!
//! Everything here is a fact about the platform that a test running on
//! one machine cannot see. A sibling shipped `\` in its report paths for
//! a whole release because only Linux ran the assertion; a stdin test
//! raced the refusal it was asserting and went red on the runner that
//! happened to be slower. Both are pinned below, on all three.
//!
//! Cases the platform cannot express are skipped **by name**, printed,
//! and never counted as coverage.

use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicUsize, Ordering};

const BINARY: &str = env!("CARGO_BIN_EXE_colors-le");
static COUNTER: AtomicUsize = AtomicUsize::new(0);

struct Tree {
    root: PathBuf,
}

impl Tree {
    fn new(name: &str) -> Self {
        let unique = COUNTER.fetch_add(1, Ordering::Relaxed);
        let root = std::env::temp_dir().join(format!(
            "colors-le-platform-{name}-{}-{unique}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).expect("a temporary directory");
        Self {
            root: std::fs::canonicalize(&root).expect("a canonical directory"),
        }
    }

    fn path(&self) -> &Path {
        &self.root
    }

    fn write(&self, relative: &str, contents: &str) -> PathBuf {
        let target = self.root.join(relative);
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent).expect("a parent directory");
        }
        std::fs::write(&target, contents).expect("a file");
        target
    }
}

impl Drop for Tree {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

struct Run {
    code: Option<i32>,
    stdout: String,
    stderr: String,
}

fn run_with(args: &[&str], timezone: Option<&str>) -> Run {
    let mut command = Command::new(BINARY);
    command.args(args);
    match timezone {
        Some(zone) => command.env("TZ", zone),
        None => command.env_remove("TZ"),
    };
    let output = command.output().expect("the binary runs");
    Run {
        code: output.status.code(),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    }
}

fn run(args: &[&str]) -> Run {
    run_with(args, None)
}

fn reports(run: &Run) -> Vec<serde_json::Value> {
    run.stdout
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| serde_json::from_str(line).expect("stdout carries only JSON"))
        .collect()
}

fn skipped(case: &str, why: &str) {
    println!("platform SKIPPED here: {case} — {why}");
}

/// A nested tree, so the assertion is about separators and not about a
/// single flat directory that has none.
fn nested(name: &str) -> Tree {
    let tree = Tree::new(name);
    tree.write("theme.css", ".a { color: #1a2b3c }\n");
    tree.write("src/deep/nested/app.ts", "const brand = \"#f0a\";\n");
    tree.write("src/deep/tokens.json", "{ \"brand\": \"#250\" }\n");
    tree
}

/// **Every path in the report uses `/`.** stdout is protocol: a report
/// whose paths change shape with the operating system cannot be diffed
/// between two machines.
#[test]
fn every_reported_path_uses_forward_slashes() {
    let tree = nested("slashes");
    let run = run(&[&tree.path().to_string_lossy()]);
    let files: Vec<String> = reports(&run)
        .iter()
        .filter_map(|report| report["file"].as_str().map(str::to_string))
        .collect();

    assert_eq!(files.len(), 3, "{files:?}");
    for file in &files {
        assert!(
            !file.contains('\\'),
            "a report path carries a backslash: {file}"
        );
    }
    assert!(
        files.iter().any(|file| file.contains("src/deep/nested/")),
        "the nested path lost its separators: {files:?}"
    );
    // stderr is the same projection, so it cannot disagree.
    assert!(
        !run.stderr.contains('\\'),
        "the human summary carries a backslash: {}",
        run.stderr
    );
}

/// **`TZ` independence.** Windows ignores the variable entirely, so a
/// suite that depends on it passes on two platforms and fails on the
/// third. Nothing here reads a clock; this is the assertion that says so.
#[test]
fn the_answer_does_not_depend_on_the_timezone() {
    let tree = nested("timezone");
    let root = tree.path().to_string_lossy().into_owned();

    let unset = run_with(&[&root], None);
    let utc = run_with(&[&root], Some("UTC"));
    let kiritimati = run_with(&[&root], Some("Pacific/Kiritimati"));

    assert_eq!(unset.stdout, utc.stdout, "TZ=UTC changed the report");
    assert_eq!(
        unset.stdout, kiritimati.stdout,
        "a timezone fourteen hours ahead changed the report"
    );
    assert_eq!(unset.code, utc.code);
    assert_eq!(unset.stderr, utc.stderr);
}

/// `README.md` and `readme.md` are one file on macOS and Windows and two
/// on Linux. Either is fine; reporting one file twice is not.
#[test]
fn a_case_insensitive_filesystem_does_not_report_one_file_twice() {
    let tree = Tree::new("case");
    tree.write("README.md", "The paper is #FFF.\n");
    tree.write("readme.md", "The ink is #abc.\n");

    let run = run(&[&tree.path().to_string_lossy()]);
    let files: Vec<String> = reports(&run)
        .iter()
        .filter_map(|report| report["file"].as_str().map(str::to_string))
        .collect();

    let mut folded: Vec<String> = files.iter().map(|file| file.to_lowercase()).collect();
    folded.sort();
    let distinct = {
        folded.dedup();
        folded.len()
    };
    assert_eq!(
        distinct,
        files.len(),
        "the walk reported the same file twice: {files:?}"
    );

    match files.len() {
        1 => println!("platform note: this filesystem folds case, so README.md is one file"),
        2 => println!("platform note: this filesystem is case-sensitive, so README.md is two"),
        other => panic!("{other} report lines for two names: {files:?}"),
    }
}

/// `CON`, `PRN`, `AUX`, `NUL` and `COM1` are device names on Windows and
/// ordinary names everywhere else. The walk has to survive whichever it
/// gets — the test asserts the run, not that the files exist.
#[test]
fn reserved_windows_names_do_not_stop_the_walk() {
    let tree = Tree::new("reserved");
    tree.write("theme.css", ".a { color: #1a2b3c }\n");

    let mut created = Vec::new();
    for name in ["CON", "PRN", "AUX", "NUL", "COM1"] {
        match std::fs::write(tree.path().join(name), "color: #f0a\n") {
            Ok(()) => created.push(name),
            Err(_) => skipped(
                &format!("a file named {name}"),
                "this platform reserves the name",
            ),
        }
    }

    let run = run(&[&tree.path().to_string_lossy()]);
    assert!(
        matches!(run.code, Some(0..=2)),
        "the walk exited {:?} over reserved names\n{}",
        run.code,
        run.stderr
    );
    assert_eq!(run.code, Some(0), "{}", run.stderr);
    assert!(
        reports(&run).len() > created.len(),
        "created {created:?} but the report has {} lines",
        reports(&run).len()
    );
}

/// **Assert the exit code, never the write.** The refusal can land
/// before the write does, closing the pipe under it — that race is the
/// behaviour, not a failure of it, and asserting the write cost a red CI
/// once already.
#[test]
fn a_child_that_refuses_immediately_does_not_race_the_write() {
    for _ in 0..5 {
        let mut child = Command::new(BINARY)
            .args(["--stdin"]) // no --format: refused before it reads
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .expect("the binary runs");
        let _ = child
            .stdin
            .as_mut()
            .expect("stdin")
            .write_all(b".a { color: #1a2b3c }");
        let output = child.wait_with_output().expect("finishes");
        assert_eq!(output.status.code(), Some(2));
    }
}

/// The other half: a document that *is* read from stdin comes back the
/// same on every platform, line endings included.
#[test]
fn a_document_on_stdin_reads_the_same_with_either_line_ending() {
    let answer = |document: &[u8]| -> String {
        let mut child = Command::new(BINARY)
            .args(["--stdin", "--format", "css"])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .expect("the binary runs");
        child
            .stdin
            .as_mut()
            .expect("stdin")
            .write_all(document)
            .expect("written");
        let output = child.wait_with_output().expect("finishes");
        assert_eq!(output.status.code(), Some(0));
        String::from_utf8_lossy(&output.stdout).into_owned()
    };

    let unix = answer(b".a {\n  color: #1a2b3c;\n}\n");
    let windows = answer(b".a {\r\n  color: #1a2b3c;\r\n}\r\n");
    let value = |report: &str| -> serde_json::Value {
        let parsed: serde_json::Value = serde_json::from_str(report.trim()).expect("JSON");
        parsed["colors"][0].clone()
    };
    assert_eq!(
        value(&unix),
        value(&windows),
        "the line ending moved the colour"
    );
}
