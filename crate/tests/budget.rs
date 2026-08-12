//! A wall-clock ceiling on a fixed tree, and the linearity check under
//! it.
//!
//! A sibling was fifty times slower than the rest of the family for a
//! release and nobody noticed, because nothing measured it. This crate's
//! own scan went from 0.02s to 0.25s on a large TypeScript application
//! the day the walk widened from twenty extensions to every file — a
//! real and accepted cost, and exactly the kind of step that has to be
//! visible the next time it happens.
//!
//! **The tree is generated from a fixed seed rather than checked in.**
//! 500 files of plausible source is half a megabyte of fixtures nobody
//! would read, and the generator is fifteen lines. The seed is a
//! constant here, so the tree is the same on every run and on every
//! machine.
//!
//! Gated: `COLORS_LE_BUDGET=1`. A skipped run says so rather than
//! reporting a pass. Run in release, because that is what a user
//! installs and a debug binary measures the wrong thing.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, Instant};

const BINARY: &str = env!("CARGO_BIN_EXE_colors-le");

/// Files in the generated tree, near enough to a small application.
const FILES: usize = 500;

/// **The ceiling: ten times the local measurement.**
///
/// Measured at 0.046s for this 500-file tree — release build, fastest
/// of three runs, on an Apple M-series laptop (macOS 15, 2026-08). Ten
/// times that is 0.5s: generous enough not to flake on a shared runner
/// sharing a core with somebody else's job, and tight enough that an
/// order-of-magnitude regression — the class this exists to catch —
/// cannot hide under it.
///
/// For scale, the step this is watching for: the same crate's scan of a
/// large TypeScript application went from 0.02s to 0.25s the day the
/// walk widened from twenty extensions to every file. That was a real
/// and accepted cost, decided deliberately. The next one has to be
/// decided deliberately too, and that means being seen.
const CEILING: Duration = Duration::from_millis(500);

/// Four copies of the tree may take at most six times as long as one.
///
/// Linear would be four; the two-fold slack is process start-up, the
/// walk's own bookkeeping, and a runner under load. A quadratic scan
/// lands at sixteen and cannot fit.
const LINEARITY: f64 = 6.0;

struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9e37_79b9_7f4a_7c15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xbf58_476d_1ce4_e5b9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94d0_49bb_1331_11eb);
        z ^ (z >> 31)
    }

    fn below(&mut self, bound: usize) -> usize {
        usize::try_from(self.next() % bound as u64).unwrap_or(0)
    }
}

const EXTENSIONS: [&str; 8] = ["css", "scss", "ts", "js", "svg", "json", "md", "py"];

const LINES: [&str; 10] = [
    ".selector-{n} {{ color: #1a2b3c; background: rgba(255, 255, 255, 0.2); }}",
    "const token{n} = \"#f0a8\";",
    "  --brand-{n}: hsl(210, 50%, 40%);",
    "<rect fill=\"#1a2b3c\" stroke=\"rgb(1, 2, 3)\"/>",
    "  \"paper-{n}\": \"white\",",
    "// a comment about #deadbe that is not a colour",
    "/* another comment, this one about caf\u{e9} \u{2615} */",
    "See #250 for the reasoning behind token {n}.",
    "export function helper{n}(value: string): string {{ return value; }}",
    "  padding: {n}px; margin: 0 auto; display: block;",
];

/// A tree of `count` files, identical on every machine for a given seed.
fn build(root: &Path, count: usize, seed: u64) {
    let mut rng = Rng(seed);
    for index in 0..count {
        let directory = root.join(format!("module-{:02}", index % 20));
        std::fs::create_dir_all(&directory).expect("a directory");
        let extension = EXTENSIONS[rng.below(EXTENSIONS.len())];
        let mut body = String::with_capacity(4096);
        for line in 0..40 + rng.below(60) {
            let template = LINES[rng.below(LINES.len())];
            body.push_str(&template.replace("{n}", &line.to_string()));
            body.push('\n');
        }
        std::fs::write(directory.join(format!("file-{index:04}.{extension}")), body)
            .expect("a file");
    }
}

struct Tree {
    root: PathBuf,
}

impl Tree {
    fn new(name: &str, count: usize) -> Self {
        let root =
            std::env::temp_dir().join(format!("colors-le-budget-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).expect("a temporary directory");
        // One constant, so the tree is the same everywhere.
        build(&root, count, 0x0020_2608_1200_0002);
        Self { root }
    }
}

impl Drop for Tree {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

/// The fastest of three runs. The slowest is whatever else the runner
/// was doing; the fastest is the closest thing to what this crate costs.
fn time(root: &Path) -> Duration {
    let mut best = Duration::from_secs(3600);
    for _ in 0..3 {
        let started = Instant::now();
        let output = Command::new(BINARY)
            .arg(root)
            .output()
            .expect("the binary runs");
        let elapsed = started.elapsed();
        assert!(
            matches!(output.status.code(), Some(0 | 1)),
            "the scan exited {:?}: {}",
            output.status.code(),
            String::from_utf8_lossy(&output.stderr)
        );
        best = best.min(elapsed);
    }
    best
}

fn enabled() -> bool {
    std::env::var("COLORS_LE_BUDGET").is_ok()
}

#[test]
fn a_five_hundred_file_tree_scans_inside_its_budget() {
    if !enabled() {
        println!(
            "budget SKIPPED: set COLORS_LE_BUDGET=1 to run it. \
             This did NOT pass — it did not run."
        );
        return;
    }

    let tree = Tree::new("one", FILES);
    let elapsed = time(&tree.root);
    println!("budget: {FILES} files scanned in {elapsed:?} (ceiling {CEILING:?})");
    assert!(
        elapsed < CEILING,
        "{FILES} files took {elapsed:?}, over the {CEILING:?} ceiling. \
         The ceiling is ten times the local measurement recorded in this \
         file; if the work genuinely grew, measure again and move it \
         deliberately."
    );
}

/// Four copies of the same tree, which is the check that catches the
/// quadratic class directly: a position lookup that rescans a line, a
/// matcher that restarts from the top, a `contains` inside a loop.
#[test]
fn four_times_the_tree_is_not_sixteen_times_the_work() {
    if !enabled() {
        println!(
            "budget SKIPPED: set COLORS_LE_BUDGET=1 to run it. \
             This did NOT pass — it did not run."
        );
        return;
    }

    let one = Tree::new("linear-one", FILES);
    let four = Tree::new("linear-four", FILES * 4);

    let small = time(&one.root);
    let large = time(&four.root);
    let ratio = large.as_secs_f64() / small.as_secs_f64().max(0.000_001);
    println!(
        "budget: {FILES} files {small:?}, {} files {large:?}, ratio {ratio:.2}",
        FILES * 4
    );
    assert!(
        ratio < LINEARITY,
        "four times the tree took {ratio:.2}x as long ({small:?} then {large:?}), \
         over the {LINEARITY}x ceiling — the scan is not linear in the size of the tree"
    );
}
