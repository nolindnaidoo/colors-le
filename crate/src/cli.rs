//! The terminal surface.
//!
//! stdout is protocol — one JSON report per line, one line per file —
//! whenever something is reading it, and silent when it is a terminal.
//! `--values` is the exception: asking for the values is asking to see
//! them, wherever stdout goes. stderr is always for the human, and is a projection of the same
//! reports rather than parallel prose.

use std::io::{IsTerminal, Read, Write};
use std::path::PathBuf;
use std::process::ExitCode;

use crate::extract::{SUPPORTED_FORMATS, resolve_format};
use crate::scan::{self, FileReport, ScanOptions};
use crate::walk::{self, WalkOptions};

const USAGE: &str = "usage: colors-le [options] <file|dir>...
       colors-le [options] --stdin [--format <format>]
       colors-le mcp
       colors-le --version | --help

Finds every colour in a tree and, given a palette, says which of them are
not in it. One JSON report per line on stdout when it is piped or
redirected, human summary on stderr.

Every file is read. CSS, SCSS, LESS, Stylus, HTML, XML, SVG, JavaScript,
TypeScript, JSON, YAML, TOML, Markdown and plain text are read by name;
anything else is scanned as raw text and reported as format \"unknown\".
In Markdown, plain text and unknown formats a 3- or 4-digit hex must
contain an a-f to count, because #250 in prose is an issue reference.

Without --palette this reports what is there and nothing else.

A binary file — a NUL byte in its first 8KB, ripgrep's rule — is passed
over silently and counted in the summary. It was never a text candidate,
so it is not a file that failed to be read.

Options:
  --dedupe             collapse repeated values to their first occurrence
  --format <format>    force a format instead of inferring it from the
                       file name; a name this does not know is refused
  --values             print only the values, one per line, for piping
  --strict             exit 2 if a file that looked like text could not
                       be read, rather than reporting it and carrying on
  --stdin              read one document from stdin
  --hidden             walk hidden files and directories too
  --no-ignore          walk files that .gitignore excludes

Exit codes: 0 colours found and none outside the palette · 1 none found,
or a colour outside the palette · 2 malformed question. Without a
palette this follows grep, and finding none is an answer.";

/// Every flag the parser accepts. Held equal to the flags named in USAGE
/// by a test, and consulted at runtime so the list is what the parser
/// actually honours.
const FLAGS: [&str; 8] = [
    "--strict",
    "--dedupe",
    "--palette",
    "--format",
    "--values",
    "--stdin",
    "--hidden",
    "--no-ignore",
];

#[derive(Debug)]
struct Cli {
    /// Fail the run if any file could not be read.
    strict: bool,
    inputs: Vec<PathBuf>,
    stdin: bool,
    /// Print values alone rather than JSON reports. The reviewer's next
    /// step is almost always another tool, and making them run `jq`
    /// first is a tax on the person this was built for.
    values_only: bool,
    scan: ScanOptions,
    walk: WalkOptions,
}

pub(crate) fn run() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();

    if let Some(first) = args.first() {
        match first.as_str() {
            "mcp" => return crate::mcp::serve(),
            "--help" | "-h" => {
                println!("{USAGE}");
                return ExitCode::SUCCESS;
            }
            "--version" | "-V" => {
                println!("colors-le {}", env!("CARGO_PKG_VERSION"));
                return ExitCode::SUCCESS;
            }
            _ => {}
        }
    }

    match execute(&args) {
        Ok(code) => ExitCode::from(code),
        Err(message) => {
            eprintln!("colors-le: {message}");
            ExitCode::from(2)
        }
    }
}

fn execute(args: &[String]) -> Result<u8, String> {
    let options = parse(args)?;
    let (reports, binary) = if options.stdin {
        (vec![scan_stdin(&options)?], 0)
    } else {
        read_tree(&options)?
    };

    let stdout = std::io::stdout();
    let terminal = stdout.is_terminal();
    let mut out = stdout.lock();
    let written = if options.values_only {
        write_values(&mut out, &reports)
    } else {
        write_reports(&mut out, &reports, terminal)
    };
    written.map_err(|error| format!("could not write the report: {error}"))?;
    drop(out);

    summarise(
        &mut std::io::stderr().lock(),
        &reports,
        binary,
        options.values_only,
    );
    Ok(scan::exit_code(&reports, options.strict))
}

/// Every text file in the tree, and how many binary ones were passed
/// over. A binary file gets no report line — it was never a text
/// candidate — but the count is not thrown away, because silence about
/// files that were never looked at is the thing this tool exists to
/// avoid.
fn read_tree(options: &Cli) -> Result<(Vec<FileReport>, usize), String> {
    let mut reports = Vec::new();
    let mut binary = 0;
    for target in walk::collect(&options.inputs, &options.walk)? {
        match scan::scan_file(&target, &options.scan) {
            scan::Examined::Text(report) => reports.push(report),
            scan::Examined::Binary => binary += 1,
        }
    }
    Ok((reports, binary))
}

/// A terminal gets nothing here. The stderr summary already lists every
/// colour a person reads, and the JSON beside it on the same screen is
/// the same answer a second time in a form nobody reads by eye. Anything
/// that can parse — a pipe, a file, a subprocess — still gets every
/// report, so no script sees a difference.
fn write_reports(
    out: &mut impl Write,
    reports: &[FileReport],
    terminal: bool,
) -> std::io::Result<()> {
    if terminal {
        return Ok(());
    }
    for report in reports {
        let line = serde_json::to_string(report).expect("a report serializes");
        writeln!(out, "{line}")?;
    }
    Ok(())
}

/// Printed wherever stdout goes, unlike the reports: `--values` is plain
/// text a person asked to see, not a report.
fn write_values(out: &mut impl Write, reports: &[FileReport]) -> std::io::Result<()> {
    for report in reports {
        for found in &report.colors {
            writeln!(out, "{}", found.value)?;
        }
    }
    Ok(())
}

fn scan_stdin(options: &Cli) -> Result<FileReport, String> {
    // There is no filename to infer from, and no useful default: a
    // colour only means something in a format, so stdin must name one.
    // Checked before reading, or a missing flag waits for end of input
    // before it is refused.
    let format = options
        .scan
        .format
        .ok_or_else(|| "reading from stdin needs --format".to_string())?;
    let mut content = String::new();
    std::io::stdin()
        .read_to_string(&mut content)
        .map_err(|error| format!("could not read stdin: {error}"))?;
    Ok(scan::scan_content(
        &content,
        "<stdin>".to_string(),
        format,
        &options.scan,
    ))
}

fn parse(args: &[String]) -> Result<Cli, String> {
    let mut options = Cli {
        inputs: Vec::new(),
        stdin: false,
        strict: false,
        values_only: false,
        scan: ScanOptions::default(),
        walk: WalkOptions::default(),
    };

    let mut rest = args.iter();
    while let Some(arg) = rest.next() {
        // Strict parsing, never a silent default: a typo'd `--dedup`
        // that quietly did nothing would produce a report the caller
        // believed was deduplicated.
        if arg.starts_with('-') && !FLAGS.contains(&arg.as_str()) {
            return Err(format!("{arg} is not an option. Try --help."));
        }

        match arg.as_str() {
            "--dedupe" => options.scan.dedupe = true,
            "--values" => options.values_only = true,
            "--stdin" => options.stdin = true,
            "--strict" => options.strict = true,
            "--hidden" => options.walk.hidden = true,
            "--no-ignore" => options.walk.respect_ignore = false,
            // The flag takes a value, so a missing one is a refusal.
            "--format" => {
                let value = rest
                    .next()
                    .ok_or_else(|| "--format needs a format".to_string())?;
                let resolved = resolve_format(Some(value), None);
                // A typo is refused even though an unnamed format would
                // be read: `--fromat scss` silently scanning the tree as
                // raw text is a run whose caller believes it parsed
                // stylesheets. Strict parsing applies to flags; the
                // fallback applies to documents.
                if resolved == crate::extract::FALLBACK_FORMAT {
                    return Err(format!(
                        "{value} is not a format this names; one of: {}",
                        SUPPORTED_FORMATS.join(", ")
                    ));
                }
                options.scan.format = Some(resolved);
            }
            "--palette" => {
                let value = rest
                    .next()
                    .ok_or_else(|| "--palette needs a file".to_string())?;
                let text = std::fs::read_to_string(value)
                    .map_err(|error| format!("could not read the palette {value}: {error}"))?;
                let (palette, rejected) = crate::extract::Palette::parse(&text);
                if palette.is_empty() {
                    return Err(format!("{value} holds no colours this can read"));
                }
                // Said out loud rather than skipped: a typo in a palette
                // silently approving nothing is the worst outcome here.
                for entry in rejected {
                    eprintln!("colors-le: {value}: {entry} is not a colour");
                }
                options.scan.palette = Some(palette);
            }
            path => options.inputs.push(PathBuf::from(path)),
        }
    }

    if options.stdin && !options.inputs.is_empty() {
        return Err("reading from stdin takes no file arguments".to_string());
    }
    if !options.stdin && options.inputs.is_empty() {
        return Err("name a file or a directory to read. Try --help.".to_string());
    }
    Ok(options)
}

/// The human half. Every line restates something already on stdout,
/// except the binary count — the one fact stdout deliberately omits.
///
/// `values_on_stdout` is true under `--values`, which prints the colours
/// to stdout itself. Otherwise they are listed here, because at a
/// terminal stdout is silent and a bare count would show nothing.
fn summarise(
    stderr: &mut impl Write,
    reports: &[FileReport],
    binary: usize,
    values_on_stdout: bool,
) {
    let mut colors = 0;
    let mut outside = 0;

    for report in reports {
        for diagnostic in &report.diagnostics {
            let _ = writeln!(stderr, "{}: {}", report.file, diagnostic.message);
        }
        // With --values the values are already on stdout; repeating them
        // here would double every line a reviewer is piping.
        if !values_on_stdout {
            for found in &report.colors {
                let _ = writeln!(stderr, "{}", scan::describe(report, found));
            }
        }
        colors += report.summary.colors;
        outside += report.summary.outside_palette;
    }

    // Said out loud rather than left to inference: the walk read fewer
    // files than it visited, and a reader comparing the file count to
    // their tree deserves to know why.
    let passed_over = if binary == 0 {
        String::new()
    } else {
        format!(
            ", {} skipped",
            plural(binary, "binary file", "binary files")
        )
    };
    let _ = writeln!(
        stderr,
        "{} in {}{passed_over}",
        plural(colors, "color", "colors"),
        plural(reports.len(), "file", "files")
    );
    if outside > 0 {
        // Said plainly: the count is the reason the run failed, and a
        // reader scrolling past a thousand colours needs it at the end.
        let _ = writeln!(
            stderr,
            "{} not in the palette",
            plural(outside, "colour is", "colours are")
        );
    }
}

fn plural(count: usize, one: &str, many: &str) -> String {
    format!("{count} {}", if count == 1 { one } else { many })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testing::TempTree;

    fn sample_reports(tree: &TempTree) -> Vec<FileReport> {
        tree.write("a.css", "a { color: #2563eb; }\n");
        let options = parse(&[tree.path().join("a.css").to_string_lossy().into_owned()])
            .expect("a valid command line");
        read_tree(&options).expect("a read").0
    }

    #[test]
    fn a_pipe_gets_one_report_per_line() {
        let tree = TempTree::new("cli-pipe");
        let reports = sample_reports(&tree);
        let mut out = Vec::new();
        write_reports(&mut out, &reports, false).expect("a write");
        let text = String::from_utf8(out).expect("utf-8");
        assert_eq!(text.lines().count(), reports.len());
        assert!(text.starts_with('{'), "{text}");
    }

    #[test]
    fn a_terminal_gets_no_json() {
        let tree = TempTree::new("cli-terminal");
        let reports = sample_reports(&tree);
        let mut out = Vec::new();
        write_reports(&mut out, &reports, true).expect("a write");
        assert!(out.is_empty());
    }

    #[test]
    fn values_print_one_per_line() {
        let tree = TempTree::new("cli-values");
        let reports = sample_reports(&tree);
        let mut out = Vec::new();
        write_values(&mut out, &reports).expect("a write");
        assert_eq!(String::from_utf8(out).expect("utf-8"), "#2563eb\n");
    }

    /// With stdout silent at a terminal, a `--values` run would show a
    /// bare count if stderr did not carry the colours.
    #[test]
    fn stderr_lists_the_colours_unless_values_are_on_stdout() {
        let tree = TempTree::new("cli-stderr");
        let reports = sample_reports(&tree);
        let mut listed = Vec::new();
        summarise(&mut listed, &reports, 0, false);
        let text = String::from_utf8(listed).expect("utf-8");
        assert!(text.contains("a.css:1:12  #2563eb\n"), "{text}");
        assert!(text.ends_with("1 color in 1 file\n"), "{text}");

        let mut quiet = Vec::new();
        summarise(&mut quiet, &reports, 0, true);
        let text = String::from_utf8(quiet).expect("utf-8");
        assert_eq!(text, "1 color in 1 file\n");
    }

    #[test]
    fn every_documented_flag_is_parsed_and_the_reverse() {
        let mut documented: Vec<&str> = USAGE
            .split_whitespace()
            .filter(|word| word.starts_with("--"))
            .map(|word| word.trim_end_matches([',', '.', ':', ';']))
            .filter(|word| !matches!(*word, "--version" | "--help"))
            .collect();
        documented.sort_unstable();
        documented.dedup();

        let mut implemented = FLAGS.to_vec();
        implemented.sort_unstable();
        assert_eq!(documented, implemented);
    }

    #[test]
    fn the_parser_accepts_every_flag_it_lists() {
        for flag in FLAGS {
            let args: Vec<String> = match flag {
                "--format" => vec![flag.into(), "css".into(), "x".into()],
                // --palette needs a real file, and has its own tests.
                "--palette" => continue,
                "--stdin" => vec![flag.into(), "--format".into(), "css".into()],
                _ => vec![flag.into(), "x".into()],
            };
            assert!(parse(&args).is_ok(), "{flag}");
        }
    }

    #[test]
    fn an_unknown_flag_is_refused_rather_than_ignored() {
        let error = parse(&["--dedup".into(), "x".into()]).expect_err("a refusal");
        assert!(error.contains("--dedup"), "{error}");
    }

    #[test]
    fn every_offered_format_is_accepted_by_name() {
        for format in SUPPORTED_FORMATS {
            let options = parse(&["--format".into(), format.into(), "x".into()]).expect(format);
            assert_eq!(options.scan.format, Some(format));
        }
    }

    /// Refused, not fallen back. A silent nothing would read as a clean
    /// run over files that were never looked at.
    #[test]
    fn an_unknown_format_is_refused_by_name() {
        let error =
            parse(&["--format".into(), "python".into(), "x".into()]).expect_err("a refusal");
        assert!(error.contains("python"), "{error}");
    }

    #[test]
    fn a_flag_with_no_value_is_refused() {
        for flag in ["--format", "--palette"] {
            assert!(parse(&[flag.into()]).is_err(), "{flag}");
        }
    }

    /// Refused before stdin is read. Reading first made this test block
    /// on any open stdin, and made `--stdin` alone wait for end of input.
    #[test]
    fn stdin_needs_a_format() {
        let options = parse(&["--stdin".into()]).expect("options");
        assert!(
            scan_stdin(&options).is_err(),
            "stdin has no name to infer from"
        );
    }

    /// The tool has no opinion beyond the palette you hand it, so no
    /// flag may produce one.
    #[test]
    fn no_flag_asks_for_a_judgment() {
        for attempt in ["--contrast", "--wcag", "--convert", "--to", "--fix"] {
            assert!(
                parse(&[attempt.into(), "x".into()]).is_err(),
                "{attempt} was accepted"
            );
        }
        for word in ["contrast", "wcag", "convert"] {
            assert!(!USAGE.contains(word), "the usage text offers {word}");
        }
    }

    #[test]
    fn naming_nothing_is_refused() {
        assert!(parse(&[]).is_err());
    }

    #[test]
    fn stdin_and_file_arguments_together_are_refused() {
        assert!(parse(&["--stdin".into(), "x".into()]).is_err());
    }

    #[test]
    fn the_usage_text_states_the_exit_codes_and_the_palette() {
        for code in ["0", "1", "2"] {
            assert!(USAGE.contains(code), "exit code {code} is undocumented");
        }
        assert!(USAGE.contains("palette"), "the palette is unexplained");
    }
}
