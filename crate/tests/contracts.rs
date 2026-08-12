//! The exit codes and the stdout contract, driven against the built
//! binary.
//!
//! These are the API: a shell branches on the exit code and parses
//! stdout, so both are pinned here rather than inferred from unit tests
//! of the functions behind them. Nothing here needs a network or a
//! privileged filesystem operation, so it runs everywhere on every push.
//!
//! A new refusal adds its case here.

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
            "colors-le-contract-{name}-{}-{unique}",
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
    code: i32,
    stdout: String,
    stderr: String,
}

fn run(args: &[&str]) -> Run {
    let output = Command::new(BINARY)
        .args(args)
        .output()
        .expect("the binary runs");
    Run {
        code: output.status.code().expect("an exit code"),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    }
}

/// Every line of stdout, parsed. Doubles as the assertion that stdout
/// is JSON Lines and nothing else — a stray human message there would
/// fail to parse.
fn reports(run: &Run) -> Vec<serde_json::Value> {
    run.stdout
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| serde_json::from_str(line).expect("stdout carries only JSON"))
        .collect()
}

/// A stylesheet, a source file, and a README whose `#anchor` must not
/// be read as a colour.
fn audit_tree(name: &str) -> Tree {
    let tree = Tree::new(name);
    tree.write("theme.css", ":root { --brand: #1a2b3c; --paper: white; }\n");
    tree.write(
        "src/theme.ts",
        "export const accent = \"rgb(255, 0, 0)\";\n",
    );
    // Both short hex, and only one of them is a colour: `#abc` has
    // letters in it, `#250` is an issue reference.
    tree.write("README.md", "see #abc below, closes #250\n");
    tree
}

fn palette_file(tree: &Tree, colours: &str) -> String {
    tree.write("palette.txt", colours)
        .to_string_lossy()
        .into_owned()
}

#[test]
fn a_tree_with_colours_exits_zero() {
    let tree = audit_tree("found");
    let run = run(&[&tree.path().to_string_lossy()]);
    assert_eq!(run.code, 0, "{}", run.stderr);
    let total: u64 = reports(&run)
        .iter()
        .filter_map(|report| report["summary"]["colors"].as_u64())
        .sum();
    assert_eq!(total, 4, "the README's #250 is not a colour, its #abc is");
}

/// Changed deliberately in 0.2.0: the walk had a format filter and never
/// opened the README. It opens everything now — a design system keeps
/// its tokens in a `.json` — and the short-hex rule is what keeps an
/// issue reference out of the results.
#[test]
fn every_file_in_the_tree_is_read() {
    let tree = audit_tree("filter");
    let files: Vec<String> = reports(&run(&[&tree.path().to_string_lossy()]))
        .iter()
        .filter_map(|report| report["file"].as_str().map(str::to_string))
        .collect();
    assert_eq!(files.len(), 3, "{files:?}");
    assert!(
        files.iter().any(|file| file.ends_with("README.md")),
        "{files:?}"
    );
}

/// A PNG is not a text file that failed to be read; it was never a text
/// candidate. It gets no report line and cannot reach the exit code —
/// which is what makes `--strict` usable at all, since widening the walk
/// put fourteen images in front of the reader on one real repository.
#[test]
fn a_binary_file_is_passed_over_silently_and_never_fails_strict() {
    let tree = Tree::new("binary");
    tree.write("theme.css", ".a { color: #1a2b3c }\n");
    std::fs::write(
        tree.path().join("logo.png"),
        [0x89, b'P', b'N', b'G', 0x00, 0x1a, 0x0a],
    )
    .expect("a file");

    let run = run(&["--strict", &tree.path().to_string_lossy()]);
    let parsed = reports(&run);
    let files: Vec<&str> = parsed
        .iter()
        .filter_map(|report| report["file"].as_str())
        .collect();
    assert_eq!(files.len(), 1, "{files:?}");
    assert!(files[0].ends_with("theme.css"), "{files:?}");
    assert_eq!(run.code, 0, "{}", run.stderr);
    // Passed over, not hidden: the reader still learns coverage was
    // narrower than the tree.
    assert!(
        run.stderr.contains("1 binary file skipped"),
        "{}",
        run.stderr
    );
}

/// The other half of the same distinction: a file that *looked* like
/// text and could not be read is a shortfall, keeps its named
/// diagnostic, and still fails `--strict`.
#[test]
fn a_text_file_that_cannot_be_read_still_fails_strict() {
    let tree = Tree::new("unreadable");
    tree.write("theme.css", ".a { color: #1a2b3c }\n");
    // Invalid UTF-8, no NUL byte: this is not binary by ripgrep's rule.
    std::fs::write(tree.path().join("broken.css"), [0xff, 0xfe, b'a']).expect("a file");

    let run = run(&["--strict", &tree.path().to_string_lossy()]);
    assert_eq!(reports(&run).len(), 2);
    assert_eq!(run.code, 2, "{}", run.stderr);
    assert!(run.stderr.contains("not UTF-8 text"), "{}", run.stderr);
}

/// grep's convention, without a palette.
#[test]
fn a_tree_with_none_exits_one() {
    let tree = Tree::new("none");
    tree.write("a.css", ".a { display: block }\n");
    let run = run(&[&tree.path().to_string_lossy()]);
    assert_eq!(run.code, 1);
}

/// **The enforcement case.** With a palette, 1 means a violation.
#[test]
fn a_colour_outside_the_palette_exits_one() {
    let tree = Tree::new("palette");
    tree.write("a.css", ".a { color: #1a2b3c; }\n.b { color: #ff0000; }\n");
    let palette = palette_file(&tree, "#1a2b3c\n");

    let run = run(&["--palette", &palette, &tree.path().to_string_lossy()]);
    assert_eq!(run.code, 1, "{}", run.stderr);
    let report = &reports(&run)[0];
    assert_eq!(report["colors"][0]["inPalette"], true);
    assert_eq!(report["colors"][1]["inPalette"], false);
    assert_eq!(report["summary"]["outsidePalette"], 1);
    assert!(run.stderr.contains("not in the palette"), "{}", run.stderr);
}

/// The palette matches by colour, so a violation written in another
/// notation is still caught — and a match in another notation is still
/// approved.
#[test]
fn the_palette_matches_across_notations() {
    let tree = Tree::new("notations");
    tree.write("a.css", ".a { color: rgb(255, 255, 255); }\n");
    let palette = palette_file(&tree, "#ffffff\n");
    let run = run(&["--palette", &palette, &tree.path().to_string_lossy()]);
    assert_eq!(run.code, 0, "{}", run.stderr);
}

/// Without a palette there is no verdict at all, not a verdict of true.
#[test]
fn no_palette_means_no_verdict_in_the_report() {
    let tree = audit_tree("noverdict");
    let run = run(&[&tree.path().to_string_lossy()]);
    assert!(!run.stdout.contains("inPalette"), "{}", run.stdout);
}

/// A typo in a palette silently approving nothing is the worst outcome
/// available, so it is named.
#[test]
fn an_entry_that_is_not_a_colour_is_named() {
    let tree = Tree::new("badpalette");
    tree.write("a.css", ".a { color: #1a2b3c; }\n");
    let palette = palette_file(&tree, "#1a2b3c\nnot-a-colour\n");
    let run = run(&["--palette", &palette, &tree.path().to_string_lossy()]);
    assert_eq!(run.code, 0);
    assert!(run.stderr.contains("not-a-colour"), "{}", run.stderr);
}

#[test]
fn a_palette_with_nothing_readable_is_refused() {
    let tree = Tree::new("emptypalette");
    tree.write("a.css", ".a { color: #1a2b3c; }\n");
    let palette = palette_file(&tree, "nonsense\n");
    let run = run(&["--palette", &palette, &tree.path().to_string_lossy()]);
    assert_eq!(run.code, 2);
}

#[test]
fn values_only_prints_colours_and_no_json() {
    let tree = audit_tree("values");
    let run = run(&["--values", "--dedupe", &tree.path().to_string_lossy()]);
    assert_eq!(run.code, 0);
    assert!(!run.stdout.contains('{'), "{}", run.stdout);
    assert_eq!(run.stdout.lines().count(), 4, "{}", run.stdout);
}

#[test]
fn an_unreadable_input_exits_two() {
    assert_eq!(run(&["/no/such/place-xyz"]).code, 2);
}

#[test]
fn an_unknown_flag_exits_two_and_names_itself() {
    let tree = audit_tree("badflag");
    let run = run(&["--dedup", &tree.path().to_string_lossy()]);
    assert_eq!(run.code, 2);
    assert!(run.stderr.contains("--dedup"), "{}", run.stderr);
    assert!(run.stdout.is_empty(), "a refusal writes no report");
}

/// Refused, not fallen back — the opposite of string-le and numbers-le,
/// and for a reason: a silent nothing would read as a clean run.
#[test]
fn an_unknown_format_exits_two() {
    let tree = audit_tree("badformat");
    let run = run(&["--format", "python", &tree.path().to_string_lossy()]);
    assert_eq!(run.code, 2);
    assert!(run.stderr.contains("python"), "{}", run.stderr);
}

/// The tool has no opinion beyond the palette it is handed.
#[test]
fn no_flag_asks_for_a_judgment() {
    let tree = audit_tree("nojudgment");
    for attempt in ["--contrast", "--wcag", "--convert", "--to", "--fix"] {
        assert_eq!(
            run(&[attempt, &tree.path().to_string_lossy()]).code,
            2,
            "{attempt} was accepted"
        );
    }
}

#[test]
fn dedupe_collapses_repeats() {
    let tree = Tree::new("dedupe");
    tree.write("a.css", ".a{color:#fff}\n.b{color:#fff}\n");
    let kept: u64 = reports(&run(&[&tree.path().to_string_lossy()]))[0]["summary"]["colors"]
        .as_u64()
        .expect("a count");
    let deduped: u64 =
        reports(&run(&["--dedupe", &tree.path().to_string_lossy()]))[0]["summary"]["colors"]
            .as_u64()
            .expect("a count");
    assert_eq!((kept, deduped), (2, 1));
}

#[test]
fn version_and_help_exit_clear() {
    let version = run(&["--version"]);
    assert_eq!(version.code, 0);
    assert!(version.stdout.contains("colors-le"));
    let help = run(&["--help"]);
    assert_eq!(help.code, 0);
    assert!(help.stdout.contains("usage: colors-le"));
    assert!(
        help.stdout.contains("palette"),
        "the palette is unexplained"
    );
}

#[test]
fn stdout_carries_only_reports_and_stderr_only_the_summary() {
    let tree = audit_tree("streams");
    let run = run(&[&tree.path().to_string_lossy()]);
    assert!(!reports(&run).is_empty());
    assert!(!run.stderr.contains('{'), "{}", run.stderr);
    assert!(run.stderr.contains("colors in"), "{}", run.stderr);
}

#[test]
fn a_document_on_stdin_is_scanned() {
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
        .write_all(b".a { color: #1a2b3c }")
        .expect("written");
    let output = child.wait_with_output().expect("finishes");
    assert_eq!(output.status.code(), Some(0));
    let report: serde_json::Value =
        serde_json::from_slice(&output.stdout).expect("stdout carries JSON");
    assert_eq!(report["file"], "<stdin>");
    assert_eq!(report["colors"][0]["value"], "#1a2b3c");
}

/// There is no filename to infer from and no useful default, so stdin
/// must name a format.
#[test]
fn stdin_without_a_format_exits_two() {
    let mut child = Command::new(BINARY)
        .args(["--stdin"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("the binary runs");
    child
        .stdin
        .as_mut()
        .expect("stdin")
        // A refusal happens before this write lands, so the pipe may
        // already be closed. That race is the behaviour under test, not
        // a failure of it — the exit code below is what is being
        // asserted.
        .write_all(b".a { color: #fff }")
        .ok();
    assert_eq!(
        child.wait_with_output().expect("finishes").status.code(),
        Some(2)
    );
}

/// **The cross-surface contract.** Both surfaces call one entry point,
/// so they must answer identically for the same tree.
#[test]
fn the_cli_and_the_mcp_server_report_the_same_thing() {
    let tree = audit_tree("agreement");
    let cli = run(&[&tree.path().to_string_lossy()]);
    let from_cli = reports(&cli);

    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": "colors_le_scan",
            "arguments": { "path": tree.path().to_string_lossy() },
        },
    });
    let mut child = Command::new(BINARY)
        .arg("mcp")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("the server starts");
    writeln!(child.stdin.as_mut().expect("stdin"), "{request}").expect("written");
    let output = child.wait_with_output().expect("finishes");
    let response: serde_json::Value = serde_json::from_slice(
        output
            .stdout
            .split(|byte| *byte == b'\n')
            .next()
            .expect("a line"),
    )
    .expect("the reply is JSON");

    let from_mcp = response["result"]["structuredContent"]["data"]["reports"]
        .as_array()
        .expect("reports")
        .clone();
    assert_eq!(from_mcp, from_cli, "the two surfaces disagree");
}
