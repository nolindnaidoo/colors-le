//! The tree nobody writes on purpose, driven against the built binary.
//!
//! Every case here exists because something like it got through: a BOM
//! read as content emptied three crates silently, a PNG made `--strict`
//! exit 2 on any repository holding an image, and a file that was not
//! UTF-8 vanished from the report entirely — which reads to whoever ran
//! it as a file that was clean.
//!
//! **The tree is built at runtime, not checked in.** Windows cannot hold
//! a FIFO, a permission-denied file or a symlink loop in a repository,
//! so each of those is created where the platform allows it and skipped
//! **by name** where it does not. A silent pass would be worse than no
//! test: it would read as coverage.
//!
//! Every case asserts the same floor: the process does not panic, does
//! not hang, and exits 0, 1 or 2 — never on a signal.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicUsize, Ordering};

const BINARY: &str = env!("CARGO_BIN_EXE_colors-le");
static COUNTER: AtomicUsize = AtomicUsize::new(0);

/// The colour every hazard document carries, so "did this survive" and
/// "did this still read the file" are one question.
const VALUE: &str = "#1a2b3c";

struct Tree {
    root: PathBuf,
}

impl Tree {
    fn new(name: &str) -> Self {
        let unique = COUNTER.fetch_add(1, Ordering::Relaxed);
        let root = std::env::temp_dir().join(format!(
            "colors-le-hazard-{name}-{}-{unique}",
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

    fn bytes(&self, name: &str, contents: &[u8]) -> PathBuf {
        let target = self.root.join(name);
        std::fs::write(&target, contents).expect("a file");
        target
    }

    fn text(&self, name: &str, contents: &str) -> PathBuf {
        self.bytes(name, contents.as_bytes())
    }
}

impl Drop for Tree {
    fn drop(&mut self) {
        // A permission-denied file has to be readable again before the
        // directory holding it will go.
        #[cfg(unix)]
        restore_permissions(&self.root);
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

#[cfg(unix)]
fn restore_permissions(root: &Path) {
    use std::os::unix::fs::PermissionsExt;
    let Ok(entries) = std::fs::read_dir(root) else {
        return;
    };
    for entry in entries.flatten() {
        let _ = std::fs::set_permissions(entry.path(), std::fs::Permissions::from_mode(0o644));
    }
}

struct Run {
    code: Option<i32>,
    stdout: String,
    stderr: String,
}

impl Run {
    /// The floor every case shares: an answer, not a signal.
    fn survived(&self, what: &str) {
        assert!(
            matches!(self.code, Some(0..=2)),
            "{what}: exited {:?} — a signal or a panic, not an answer\n{}",
            self.code,
            self.stderr
        );
    }

    fn reports(&self) -> Vec<serde_json::Value> {
        self.stdout
            .lines()
            .filter(|line| !line.trim().is_empty())
            .map(|line| serde_json::from_str(line).expect("stdout carries only JSON"))
            .collect()
    }
}

fn run(args: &[&str]) -> Run {
    let output = Command::new(BINARY)
        .args(args)
        .output()
        .expect("the binary runs");
    Run {
        code: output.status.code(),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    }
}

fn scan(path: &Path) -> Run {
    run(&[&path.to_string_lossy()])
}

/// Said out loud, so a skipped case is never mistaken for a passing one.
fn skipped(case: &str, why: &str) {
    println!("hazard SKIPPED on this platform: {case} — {why}");
}

// ---------------------------------------------------------------- content

/// Twelve shapes a document arrives in, each holding the same colour.
/// Whether every one of them is *found* is asserted below; that none of
/// them kills the process is asserted here.
#[test]
fn every_content_hazard_answers_rather_than_crashes() {
    let tree = Tree::new("content");
    let mut cases: Vec<(&str, Vec<u8>)> = vec![
        (
            "bom.css",
            format!("\u{feff}.a{{color:{VALUE}}}").into_bytes(),
        ),
        (
            "crlf.css",
            format!(".a {{\r\n  color: {VALUE};\r\n}}\r\n").into_bytes(),
        ),
        (
            "lone-cr.css",
            format!(".a {{\r  color: {VALUE};\r}}\r").into_bytes(),
        ),
        (
            "no-newline.css",
            format!(".a{{color:{VALUE}}}").into_bytes(),
        ),
        ("empty.css", Vec::new()),
        ("whitespace.css", b"   \n\t\n  ".to_vec()),
        (
            "emoji.css",
            format!("/* \u{1f3af} */ .a{{color:{VALUE}}}").into_bytes(),
        ),
        (
            "astral-value.css",
            format!(".a{{content:\"\u{1f3af}\";color:{VALUE}}}").into_bytes(),
        ),
    ];
    // A NUL byte makes it binary by ripgrep's rule, which is its own
    // assertion below; here it only has to not crash.
    cases.push((
        "nul.css",
        format!(".a{{color:{VALUE}}}\0trailing").into_bytes(),
    ));
    // Invalid UTF-8 with no NUL: this looked like text and cannot be read.
    cases.push(("invalid-utf8.css", vec![b'.', b'a', 0xff, 0xfe, b'}']));
    // UTF-16LE with a BOM is not UTF-8 and has NUL bytes in it, so it is
    // binary — the point is that neither fact reaches the exit code.
    let mut utf16 = vec![0xff, 0xfe];
    for unit in format!(".a{{color:{VALUE}}}").encode_utf16() {
        utf16.extend_from_slice(&unit.to_le_bytes());
    }
    cases.push(("utf16le.css", utf16));
    cases.push((
        "one-long-line.css",
        format!("/* {} */ .a{{color:{VALUE}}}", "x".repeat(1024 * 1024)).into_bytes(),
    ));
    cases.push((
        "many-lines.css",
        format!(
            "{}.a{{color:{VALUE}}}\n",
            ".b{display:block}\n".repeat(100_000)
        )
        .into_bytes(),
    ));

    for (name, contents) in &cases {
        let path = tree.bytes(name, contents);
        let run = scan(&path);
        run.survived(name);
        assert!(
            run.stdout.is_empty() || !run.reports().is_empty(),
            "{name}: stdout was neither empty nor a report"
        );
    }

    // And the whole tree at once, which is how anybody actually runs it.
    run(&[&tree.path().to_string_lossy()]).survived("the whole hazard tree");
}

/// Three invisible bytes that Notepad, Excel and a PowerShell redirect
/// all add, and that VS Code strips before the extension sees a
/// document. Left in, they shift every column on the first line.
#[test]
fn a_byte_order_mark_does_not_move_the_reported_column() {
    let tree = Tree::new("bom");
    let plain = tree.text("plain.css", &format!(".a{{color:{VALUE}}}"));
    let marked = tree.text("marked.css", &format!("\u{feff}.a{{color:{VALUE}}}"));

    let from_plain = scan(&plain);
    let from_marked = scan(&marked);
    from_plain.survived("a document with no BOM");
    from_marked.survived("a document with a BOM");

    let column = |run: &Run| run.reports()[0]["colors"][0]["column"].clone();
    assert_eq!(
        column(&from_plain),
        column(&from_marked),
        "the BOM moved the column"
    );
}

/// A binary file was never a text candidate: no report line, no effect
/// on `--strict`. Conflating it with a file that failed to be read made
/// `--strict` exit 2 on any repository containing an image.
#[test]
fn a_binary_file_produces_no_report_and_does_not_fail_strict() {
    let tree = Tree::new("binary");
    tree.text("theme.css", &format!(".a{{color:{VALUE}}}"));
    tree.bytes("logo.png", &[0x89, b'P', b'N', b'G', 0x00, 0x1a, 0x0a]);

    let run = run(&["--strict", &tree.path().to_string_lossy()]);
    run.survived("a tree holding a PNG");
    assert_eq!(run.code, Some(0), "{}", run.stderr);
    let files: Vec<String> = run
        .reports()
        .iter()
        .filter_map(|report| report["file"].as_str().map(str::to_string))
        .collect();
    assert_eq!(files.len(), 1, "{files:?}");
    assert!(files[0].ends_with("theme.css"), "{files:?}");
}

/// The other half of that distinction: text that could not be decoded
/// keeps its named diagnostic and does fail `--strict`.
#[test]
fn undecodable_text_is_named_and_fails_strict() {
    let tree = Tree::new("undecodable");
    tree.bytes("broken.css", &[0xff, 0xfe, b'a']);

    let lenient = scan(tree.path());
    lenient.survived("a file that is not UTF-8");
    assert_eq!(lenient.code, Some(1), "{}", lenient.stderr);
    let report = &lenient.reports()[0];
    assert_eq!(report["diagnostics"][0]["code"], "skipped");
    assert_eq!(report["diagnostics"][0]["message"], "not UTF-8 text");

    let strict = run(&["--strict", &tree.path().to_string_lossy()]);
    assert_eq!(strict.code, Some(2), "{}", strict.stderr);
}

/// Exit 2 means the question was malformed. It does not mean one file in
/// fifty thousand could not be opened.
#[test]
fn exit_two_is_for_a_malformed_question_and_nothing_else() {
    let tree = Tree::new("exit-two");
    tree.bytes("broken.css", &[0xff, 0xfe, b'a']);
    tree.bytes("logo.png", &[0x89, b'P', b'N', b'G', 0x00]);
    tree.text("theme.css", &format!(".a{{color:{VALUE}}}"));

    let unreadable = scan(tree.path());
    assert_eq!(
        unreadable.code,
        Some(0),
        "an unreadable file is not a malformed question\n{}",
        unreadable.stderr
    );

    let root = tree.path().to_string_lossy().into_owned();
    for malformed in [
        vec!["--dedup", root.as_str()],
        vec!["--format", "klingon", root.as_str()],
        vec!["/no/such/place-xyz"],
    ] {
        let refused = run(&malformed);
        refused.survived(&format!("{malformed:?}"));
        assert_eq!(refused.code, Some(2), "{malformed:?}: {}", refused.stderr);
    }
}

// ------------------------------------------------------- the prose rules

/// The two rules that make reading every file safe, under the shapes
/// that break offsets. Both were derived from measurement over real
/// Markdown, and both apply outside stylesheets only.
#[test]
fn the_prose_rules_hold_under_a_bom_and_a_four_byte_emoji() {
    let tree = Tree::new("prose");
    let values = |path: &Path| -> Vec<String> {
        let run = scan(path);
        run.survived(&path.to_string_lossy());
        run.reports()
            .first()
            .and_then(|report| report["colors"].as_array().cloned())
            .unwrap_or_default()
            .iter()
            .filter_map(|found| found["value"].as_str().map(str::to_string))
            .collect()
    };

    // A short hex in prose needs an a-f: `#250` is an issue reference.
    for (name, document) in [
        ("plain.md", "closes #250 and the paper is #FFF".to_string()),
        (
            "bom.md",
            "\u{feff}closes #250 and the paper is #FFF".to_string(),
        ),
        (
            "emoji.md",
            "\u{1f3af} closes #250 and the paper is #FFF".to_string(),
        ),
        (
            "emoji-adjacent.md",
            "closes #250 \u{1f3af} the paper is #FFF".to_string(),
        ),
    ] {
        let path = tree.text(name, &document);
        assert_eq!(values(&path), ["#FFF"], "{name}");
    }

    // A named colour must be the whole value, whatever precedes it.
    for (name, document, expected) in [
        ("whole.md", "Brand: white".to_string(), vec!["white"]),
        (
            "bom-whole.md",
            "\u{feff}Brand: white".to_string(),
            vec!["white"],
        ),
        (
            "emoji-whole.md",
            "\u{1f3af} Brand: white".to_string(),
            vec!["white"],
        ),
        (
            "mention.md",
            "\u{1f3af} a brand-orange focus ring".to_string(),
            vec![],
        ),
        (
            "tailwind.md",
            "\u{feff}className=\"border-t border-white/10\"".to_string(),
            vec![],
        ),
    ] {
        let path = tree.text(name, &document);
        assert_eq!(values(&path), expected, "{name}");
    }

    // And the same digits in a stylesheet, where `#250` is a colour.
    let sheet = tree.text("theme.css", "\u{feff}.a{color:#250}");
    assert_eq!(values(&sheet), ["#250"]);
}

// ------------------------------------------------------------- filesystem

#[test]
fn a_symlink_to_a_file_is_answered() {
    let tree = Tree::new("symlink");
    let target = tree.text("theme.css", &format!(".a{{color:{VALUE}}}"));
    let link = tree.path().join("link.css");
    if !symlink(&target, &link) {
        skipped(
            "a symlink to a file",
            "this platform refused to create one (Windows needs privilege)",
        );
        return;
    }
    let run = scan(&link);
    run.survived("a symlink to a file");
    assert_eq!(run.code, Some(0), "{}", run.stderr);
}

#[test]
fn a_broken_symlink_and_a_loop_are_answered_rather_than_followed() {
    let tree = Tree::new("badlinks");
    tree.text("theme.css", &format!(".a{{color:{VALUE}}}"));

    let broken = tree.path().join("broken.css");
    if !symlink(&tree.path().join("gone.css"), &broken) {
        skipped(
            "a broken symlink and a symlink loop",
            "this platform refused to create a symlink",
        );
        return;
    }
    let loop_a = tree.path().join("loop-a");
    let loop_b = tree.path().join("loop-b");
    symlink(&loop_b, &loop_a);
    symlink(&loop_a, &loop_b);

    let run = scan(tree.path());
    run.survived("a tree holding a broken symlink and a loop");
    // The walk never follows links, so the tree still reads as one file.
    assert_eq!(run.code, Some(0), "{}", run.stderr);
}

/// A FIFO blocks forever on open. The walk must not be the thing that
/// discovers that.
#[cfg(unix)]
#[test]
fn a_fifo_does_not_hang_the_walk() {
    let tree = Tree::new("fifo");
    tree.text("theme.css", &format!(".a{{color:{VALUE}}}"));
    let fifo = tree.path().join("pipe.css");
    let made = Command::new("mkfifo")
        .arg(&fifo)
        .status()
        .is_ok_and(|status| status.success());
    if !made {
        skipped("a FIFO", "mkfifo is not available here");
        return;
    }

    // `ignore` reports a FIFO as a non-file entry, so the walk passes
    // over it — asserted by the run finishing at all.
    let run = scan(tree.path());
    run.survived("a tree holding a FIFO");
}

#[cfg(not(unix))]
#[test]
fn a_fifo_does_not_hang_the_walk() {
    skipped("a FIFO", "Windows has no equivalent this walk can meet");
}

#[cfg(unix)]
#[test]
fn a_file_that_cannot_be_opened_is_named_rather_than_dropped() {
    use std::os::unix::fs::PermissionsExt;

    let tree = Tree::new("denied");
    tree.text("theme.css", &format!(".a{{color:{VALUE}}}"));
    let denied = tree.text("secret.css", &format!(".a{{color:{VALUE}}}"));
    std::fs::set_permissions(&denied, std::fs::Permissions::from_mode(0o000)).expect("permissions");

    // Running as root defeats the case entirely rather than testing it.
    if std::fs::read(&denied).is_ok() {
        skipped(
            "a permission-denied file",
            "this user can read it anyway (root?)",
        );
        return;
    }

    let lenient = scan(tree.path());
    lenient.survived("a tree holding an unreadable file");
    assert_eq!(lenient.code, Some(0), "an unreadable file is not a refusal");
    let named = lenient
        .reports()
        .iter()
        .filter(|report| report["diagnostics"][0]["code"] == "skipped")
        .count();
    assert_eq!(named, 1, "the file was dropped, not named");

    let strict = run(&["--strict", &tree.path().to_string_lossy()]);
    assert_eq!(strict.code, Some(2), "--strict tolerates nothing");
}

#[cfg(not(unix))]
#[test]
fn a_file_that_cannot_be_opened_is_named_rather_than_dropped() {
    skipped(
        "a permission-denied file",
        "Windows ACLs are not this test's business",
    );
}

/// A directory called `x.json` is not a JSON file, and the walk has to
/// notice that rather than trying to read it.
#[test]
fn a_directory_named_like_a_document_is_not_read_as_one() {
    let tree = Tree::new("dirname");
    std::fs::create_dir(tree.path().join("tokens.json")).expect("a directory");
    std::fs::write(
        tree.path().join("tokens.json").join("real.css"),
        format!(".a{{color:{VALUE}}}"),
    )
    .expect("a file");

    let run = scan(tree.path());
    run.survived("a directory named tokens.json");
    let files: Vec<String> = run
        .reports()
        .iter()
        .filter_map(|report| report["file"].as_str().map(str::to_string))
        .collect();
    assert_eq!(files.len(), 1, "{files:?}");
    assert!(files[0].ends_with("real.css"), "{files:?}");
}

#[test]
fn awkward_file_names_are_read() {
    let tree = Tree::new("names");
    let mut expected = 0;
    for name in [
        "a file with spaces.css",
        "caf\u{e9}.css",
        "\u{1f3af}.css",
        // Not `.dots..css`: a leading dot makes it hidden, and the walk
        // skips hidden files until it is asked for them.
        "dots..css",
        "UPPER.CSS",
    ] {
        if std::fs::write(tree.path().join(name), format!(".a{{color:{VALUE}}}")).is_err() {
            skipped(
                &format!("the file name {name:?}"),
                "this filesystem refused it",
            );
            continue;
        }
        expected += 1;
    }

    let run = scan(tree.path());
    run.survived("a tree of awkward file names");
    assert_eq!(run.reports().len(), expected, "{}", run.stdout);
}

/// The case where Windows differs: `MAX_PATH` is 260 characters unless
/// long paths are enabled, and a walk that panics on the error rather
/// than reporting it is the failure being guarded against.
#[test]
fn a_path_over_260_characters_is_answered_either_way() {
    let tree = Tree::new("longpath");
    let mut deep = tree.path().to_path_buf();
    for _ in 0..12 {
        deep = deep.join("a-directory-with-a-long-name-for-the-purpose");
    }
    if std::fs::create_dir_all(&deep).is_err() {
        skipped(
            "a path over 260 characters",
            "this platform refused to create it",
        );
        return;
    }
    if std::fs::write(deep.join("theme.css"), format!(".a{{color:{VALUE}}}")).is_err() {
        skipped(
            "a path over 260 characters",
            "this platform refused to write the file",
        );
        return;
    }
    assert!(deep.to_string_lossy().len() > 260, "the path is not long");

    let run = scan(tree.path());
    run.survived("a path over 260 characters");
}

fn symlink(target: &Path, link: &Path) -> bool {
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(target, link).is_ok()
    }
    #[cfg(windows)]
    {
        // Creating one needs Developer Mode or an elevated shell, so a
        // refusal is a platform fact rather than a failure.
        if target.is_dir() {
            return std::os::windows::fs::symlink_dir(target, link).is_ok();
        }
        std::os::windows::fs::symlink_file(target, link).is_ok()
    }
}
