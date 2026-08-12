//! What this opens, measured rather than claimed.
//!
//! "Opens 21 of 88" was true for a release and invisible, because
//! nothing counted. Two things are counted here, against the built
//! binary and the shared corpus:
//!
//! - **The walk opens every file.** One file per name in the alias table
//!   — every language id and every extension both frontends accept —
//!   plus a dozen extensions neither has ever heard of. Every one of
//!   them must come back with a report line. A file the walk passes over
//!   is a file the reader believes was clean.
//! - **Every format a caller can name has a corpus document.** A format
//!   advertised in the tool schema with nothing pinning what it reads is
//!   a format whose behaviour nobody has written down.
//!
//! The alias table is read from `fixtures/aliases.json` rather than from
//! the crate: that file is the one both frontends are held to, and a
//! unit test in `extract/format.rs` already asserts this crate's copy
//! matches it.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::process::Command;

const BINARY: &str = env!("CARGO_BIN_EXE_colors-le");

/// A colour in a shape every extractor finds: a declaration value, an
/// attribute value, a quoted string and a bare token all at once, so one
/// document works whatever the file name turns out to mean.
const DOCUMENT: &str = ".a { color: #1a2b3c }\n<rect fill=\"#1a2b3c\"/>\nbrand = \"#1a2b3c\"\n";

/// Extensions neither frontend names. They are read as raw text and
/// reported as `unknown` — the 0.2.0 change this asserts is still true.
const UNKNOWN_EXTENSIONS: [&str; 12] = [
    "py", "rs", "go", "rb", "java", "kt", "swift", "sh", "sql", "ini", "cfg", "lock",
];

struct Tree {
    root: PathBuf,
}

impl Tree {
    fn new(name: &str) -> Self {
        let root =
            std::env::temp_dir().join(format!("colors-le-coverage-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).expect("a temporary directory");
        Self {
            root: std::fs::canonicalize(&root).expect("a canonical directory"),
        }
    }

    fn write(&self, name: &str) {
        std::fs::write(self.root.join(name), DOCUMENT).expect("a file");
    }
}

impl Drop for Tree {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

#[derive(Debug, serde::Deserialize)]
struct Shared {
    aliases: BTreeMap<String, String>,
    formats: Vec<String>,
}

fn shared() -> Shared {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("fixtures/aliases.json");
    let text = std::fs::read_to_string(&path).expect("the shared alias table");
    serde_json::from_str(&text).expect("the shared table is valid JSON")
}

/// Every file the binary reported, mapped to the format it read it as.
fn scan(root: &Path) -> BTreeMap<String, String> {
    let output = Command::new(BINARY)
        .arg(root)
        .output()
        .expect("the binary runs");
    assert!(
        matches!(output.status.code(), Some(0 | 1)),
        "the walk exited {:?}: {}",
        output.status.code(),
        String::from_utf8_lossy(&output.stderr)
    );

    String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| {
            let report: serde_json::Value =
                serde_json::from_str(line).expect("stdout carries only JSON");
            let file = report["file"].as_str().expect("a file").to_string();
            let name = file.rsplit(['/', '\\']).next().expect("a name").to_string();
            let format = report["format"].as_str().expect("a format").to_string();
            (name, format)
        })
        .collect()
}

/// One file per name in the alias table, plus a dozen nobody names.
///
/// The alias keys are language ids as well as extensions — `stylus` and
/// `styl`, `typescriptreact` and `tsx` — and a file named `a.stylus` is
/// not a file anybody writes. Using them anyway is the point: the walk
/// must not have a list of extensions it likes, and the only way to see
/// that it does not is to hand it names it has no reason to expect.
#[test]
fn every_extension_in_the_alias_table_is_opened_and_named() {
    let shared = shared();
    let tree = Tree::new("aliases");

    let mut expected: BTreeMap<String, String> = BTreeMap::new();
    for (alias, format) in &shared.aliases {
        let name = format!("alias-{alias}.{alias}");
        tree.write(&name);
        expected.insert(name, format.clone());
    }
    for extension in UNKNOWN_EXTENSIONS {
        let name = format!("unknown-{extension}.{extension}");
        tree.write(&name);
        expected.insert(name, "unknown".to_string());
    }

    let reported = scan(&tree.root);

    let missing: Vec<&String> = expected
        .keys()
        .filter(|name| !reported.contains_key(*name))
        .collect();
    assert!(
        missing.is_empty(),
        "the walk passed over {} file(s) it should have read: {missing:?}",
        missing.len()
    );

    let wrong: Vec<String> = expected
        .iter()
        .filter_map(|(name, format)| {
            let actual = reported.get(name)?;
            (actual != format).then(|| format!("{name}: read as {actual}, not {format}"))
        })
        .collect();
    assert!(wrong.is_empty(), "{wrong:#?}");
}

/// Every file, whatever it is called, produces a report line — including
/// one with no extension at all.
#[test]
fn a_file_with_no_extension_is_still_read() {
    let tree = Tree::new("noext");
    for name in ["Makefile", "Dockerfile", "LICENSE", "README"] {
        tree.write(name);
    }
    let reported = scan(&tree.root);
    assert_eq!(reported.len(), 4, "{reported:?}");
    for (name, format) in &reported {
        assert_eq!(format, "unknown", "{name}");
    }
}

/// A format advertised in the tool schema with no corpus document is a
/// format whose behaviour nobody wrote down — and the corpus is the only
/// thing holding the two frontends to the same answer for it.
#[test]
fn every_advertised_format_has_a_corpus_document() {
    let shared = shared();
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("fixtures/extraction.json");
    let text = std::fs::read_to_string(&path).expect("the corpus");
    let corpus: serde_json::Value = serde_json::from_str(&text).expect("valid JSON");
    let covered: Vec<&str> = corpus["documents"]
        .as_array()
        .expect("documents")
        .iter()
        .filter_map(|case| case["fileType"].as_str())
        .collect();

    let uncovered: Vec<&String> = shared
        .formats
        .iter()
        .filter(|format| !covered.contains(&format.as_str()))
        .collect();
    assert!(
        uncovered.is_empty(),
        "{} advertised format(s) have no corpus document: {uncovered:?}",
        uncovered.len()
    );
}
