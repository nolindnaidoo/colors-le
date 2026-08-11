//! Turning what the caller named into the list of files to read.
//!
//! Directories are walked with ripgrep's `ignore`, so "what this tool
//! reads" and "what ripgrep reads" are the same answer — which is the
//! answer a person auditing a repository already has in their head. A
//! file named explicitly is always read, ignore rules included: you
//! asked for it.
//!
//! **There is a format filter here**, unlike string-le and numbers-le.
//! A colour only means something where a colour can appear, so a file
//! this has no extractor for is skipped rather than scanned: a raw scan
//! of a README would report every `#anchor` in it as a three-digit hex.
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

#[derive(Debug, Clone)]
pub(crate) struct WalkOptions {
    pub(crate) hidden: bool,
    pub(crate) respect_ignore: bool,
    /// A format the caller forced. When set, every file is read as that
    /// format and the filter does not apply — naming a format is asking
    /// for those files.
    pub(crate) format: Option<&'static str>,
}

impl Default for WalkOptions {
    fn default() -> Self {
        Self {
            hidden: false,
            respect_ignore: true,
            format: None,
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
        let path = entry.into_path();
        if options.format.is_some() || has_a_format(&path) {
            files.push(path);
        }
    }
    Ok(files)
}

/// Whether this crate has an extractor for the file's name.
fn has_a_format(path: &StdPath) -> bool {
    let name = path.file_name().and_then(|name| name.to_str());
    crate::extract::resolve_format(None, name) != crate::extract::FALLBACK_FORMAT
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

    /// Only the files this has an extractor for. A README's `#anchor`
    /// looks exactly like a three-digit hex, and scanning one would
    /// report it.
    #[test]
    fn only_files_with_a_format_are_walked() {
        let tree = TempTree::new("walk-formats");
        for name in ["a.css", "b.scss", "c.svg", "d.ts", "README.md", "Makefile"] {
            tree.write(name, "x");
        }
        let walked = collect(&[tree.path().to_path_buf()], &WalkOptions::default()).expect("walks");
        assert_eq!(walked.len(), 4, "{walked:?}");
    }

    /// Naming a format is asking for those files, whatever they are
    /// called.
    #[test]
    fn a_forced_format_lifts_the_filter() {
        let tree = TempTree::new("walk-forced");
        tree.write("theme.txt", "x");
        let walked = collect(
            &[tree.path().to_path_buf()],
            &WalkOptions {
                format: Some("css"),
                ..WalkOptions::default()
            },
        )
        .expect("walks");
        assert_eq!(walked.len(), 1);
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
