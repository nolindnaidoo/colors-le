//! Turning what the caller named into the list of files to read.
//!
//! Directories are walked with ripgrep's `ignore`, so "what this tool
//! reads" and "what ripgrep reads" are the same answer — which is the
//! answer a person auditing a repository already has in their head. A
//! file named explicitly is always read, ignore rules included: you
//! asked for it.
//!
//! **There is no format filter here.** There was one, and it meant this
//! could not open a `.json` — which is where a design system keeps its
//! tokens. It existed to keep a README's `#250` out of the results, and
//! that is a rule about short hex in prose
//! (`heuristics::is_issue_reference`); answering it in the extractor is
//! what lets the walk read everything. A file whose format has no parser
//! is scanned as raw text and says so, in the `format` field of its own
//! report.
//!
//! The cost is real and accepted: every binary file in the tree now
//! reaches `scan_file` and comes back carrying a `skipped` diagnostic,
//! rather than never being looked at. Naming the PNG is the honest
//! answer — a file that silently vanishes reads as one that was clean.
//!
//! What the ignore rules keep out is deliberately not counted. On a
//! checkout with dependencies installed the number is around thirty
//! thousand and every one of them is `node_modules`, so a line reporting
//! it reads as a shortfall when the walk did exactly what it was asked.
//! `--no-ignore` is how you widen it.
//!
//! Each crate in this family stands on its own: no shared crate, no
//! published core, and nothing holding this file equal to the similar
//! ones in the sibling repos. Where they agree it is because the same
//! answer was right twice; where they diverge that is the point.

use std::path::{Path as StdPath, PathBuf};

/// What the walk selects on. **Not the format** — it used to carry one,
/// purely to lift the filter that no longer exists.
#[derive(Debug, Clone)]
pub(crate) struct WalkOptions {
    pub(crate) hidden: bool,
    pub(crate) respect_ignore: bool,
}

impl Default for WalkOptions {
    fn default() -> Self {
        Self {
            hidden: false,
            respect_ignore: true,
        }
    }
}

/// Collect every file to read, in a stable order.
///
/// The sort is not cosmetic: `ignore` makes no ordering guarantee, and a
/// report whose lines move between two runs over an unchanged tree
/// cannot be diffed — which is most of what a report in CI is for, and
/// all of what "what changed since last release" is for.
pub(crate) fn collect(inputs: &[PathBuf], options: &WalkOptions) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();

    for input in inputs {
        let metadata =
            std::fs::metadata(input).map_err(|error| format!("{}: {error}", input.display()))?;

        if metadata.is_file() {
            files.push(input.clone());
            continue;
        }

        files.extend(walk_directory(input, options)?);
    }

    files.sort();
    files.dedup();
    Ok(files)
}

fn walk_directory(root: &StdPath, options: &WalkOptions) -> Result<Vec<PathBuf>, String> {
    let mut builder = ignore::WalkBuilder::new(root);
    builder
        .hidden(!options.hidden)
        .git_ignore(options.respect_ignore)
        .git_global(options.respect_ignore)
        .git_exclude(options.respect_ignore)
        .ignore(options.respect_ignore)
        .parents(options.respect_ignore)
        // Never followed. A link out of the tree would have this reading
        // files the caller did not point it at, and reporting their
        // paths as though they were part of the audit.
        .follow_links(false);

    let mut files = Vec::new();
    for entry in builder.build() {
        let entry = entry.map_err(|error| format!("{}: {error}", root.display()))?;
        if !entry.file_type().is_some_and(|kind| kind.is_file()) {
            continue;
        }
        files.push(entry.into_path());
    }
    Ok(files)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testing::TempTree;

    fn names(files: &[PathBuf]) -> Vec<String> {
        files
            .iter()
            .map(|path| {
                path.file_name()
                    .expect("a file name")
                    .to_string_lossy()
                    .into_owned()
            })
            .collect()
    }

    #[test]
    fn a_named_file_is_the_whole_walk() {
        let tree = TempTree::new("walk-one");
        let file = tree.write("a.css", ".a{}");
        assert_eq!(
            names(&collect(&[file], &WalkOptions::default()).expect("walks")),
            ["a.css"]
        );
    }

    #[test]
    fn a_directory_is_walked_in_a_stable_order() {
        let tree = TempTree::new("walk-order");
        for name in ["z.css", "a.css", "m.css"] {
            tree.write(name, "{}");
        }
        let first = collect(&[tree.path().to_path_buf()], &WalkOptions::default()).expect("walks");
        let again = collect(&[tree.path().to_path_buf()], &WalkOptions::default()).expect("walks");
        assert_eq!(names(&first), ["a.css", "m.css", "z.css"]);
        assert_eq!(first, again);
    }

    /// Changed deliberately in 0.2.0: the walk used to keep only the
    /// files it had an extractor for, which meant it could not open a
    /// `tokens.json`. Everything is read now, and the short-hex rule —
    /// not the walk — is what keeps a README's `#250` out.
    #[test]
    fn every_file_is_walked_whatever_its_extension() {
        let tree = TempTree::new("walk-formats");
        let names = ["a.css", "b.scss", "c.svg", "d.ts", "README.md", "Makefile"];
        for name in names {
            tree.write(name, "x");
        }
        let walked = collect(&[tree.path().to_path_buf()], &WalkOptions::default()).expect("walks");
        assert_eq!(walked.len(), names.len(), "{walked:?}");
    }

    #[test]
    fn ignored_files_are_skipped() {
        let tree = TempTree::new("walk-ignore");
        tree.mkdir(".git");
        tree.write(".gitignore", "ignored.css\n");
        tree.write("ignored.css", ".a{color:#fff}");
        tree.write("kept.css", ".b{color:#000}");

        let walked = collect(&[tree.path().to_path_buf()], &WalkOptions::default()).expect("walks");
        assert!(names(&walked).contains(&"kept.css".to_string()));
        assert!(!names(&walked).contains(&"ignored.css".to_string()));
    }

    #[test]
    fn ignored_files_are_read_on_request() {
        let tree = TempTree::new("walk-noignore");
        tree.mkdir(".git");
        tree.write(".gitignore", "ignored.css\n");
        tree.write("ignored.css", ".a{color:#fff}");

        let walked = collect(
            &[tree.path().to_path_buf()],
            &WalkOptions {
                respect_ignore: false,
                ..WalkOptions::default()
            },
        )
        .expect("walks");
        assert!(names(&walked).contains(&"ignored.css".to_string()));
    }

    #[test]
    fn hidden_files_are_read_on_request() {
        let tree = TempTree::new("walk-hidden");
        tree.write(".hidden.css", ".a{}");
        let default =
            collect(&[tree.path().to_path_buf()], &WalkOptions::default()).expect("walks");
        assert!(default.is_empty());

        let all = collect(
            &[tree.path().to_path_buf()],
            &WalkOptions {
                hidden: true,
                ..WalkOptions::default()
            },
        )
        .expect("walks");
        assert_eq!(names(&all), [".hidden.css"]);
    }

    /// Intent beats configuration: naming a file is asking for it.
    #[test]
    fn an_explicitly_named_file_beats_the_ignore_rules() {
        let tree = TempTree::new("walk-explicit");
        tree.mkdir(".git");
        tree.write(".gitignore", ".hidden.css\n");
        let file = tree.write(".hidden.css", ".a{}");
        let walked = collect(&[file], &WalkOptions::default()).expect("walks");
        assert_eq!(names(&walked), [".hidden.css"]);
    }

    #[test]
    fn a_missing_input_is_refused_by_name() {
        let tree = TempTree::new("walk-missing");
        let error =
            collect(&[tree.path().join("nope")], &WalkOptions::default()).expect_err("a refusal");
        assert!(error.contains("nope"), "{error}");
    }

    #[test]
    fn the_same_file_named_twice_is_read_once() {
        let tree = TempTree::new("walk-dedupe");
        let file = tree.write("a.css", ".a{}");
        let walked = collect(&[file.clone(), file], &WalkOptions::default()).expect("walks");
        assert_eq!(walked.len(), 1);
    }
}
