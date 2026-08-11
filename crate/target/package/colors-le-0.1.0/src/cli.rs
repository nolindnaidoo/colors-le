//! The terminal surface.
//!
//! stdout is always protocol — one JSON report per line, one line per
//! file. stderr is always for the human, and is a projection of the same
//! reports rather than parallel prose.

use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::ExitCode;

use crate::extract::{SUPPORTED_FORMATS, resolve_format};
use crate::scan::{self, FileReport, ScanOptions};
use crate::walk::{self, WalkOptions};

const USAGE: &str = "usage: colors-le [options] <file|dir>...
       colors-le [options] --stdin [--format <format>]
       colors-le mcp
       colors-le --version | --help

Finds every colour in a tree — CSS, SCSS, LESS, Stylus, HTML, SVG,
JavaScript and TypeScript — and, given a palette, says which of them are
not in it.

A file with no extractor is skipped rather than scanned: a colour only
means something where a colour can appear, and a raw scan of a README
would report every #anchor in it.

Without --palette this reports what is there and nothing else.

Options:
  --dedupe             collapse repeated values to their first occurrence
  --format <format>    force a format instead of inferring it from the
                       file name; an unknown name falls back rather than
                       failing
  --values             print only the values, one per line, for piping
  --stdin              read one document from stdin
  --hidden             walk hidden files and directories too
  --no-ignore          walk files that .gitignore excludes

Exit codes: 0 colours found and none outside the palette · 1 none found,
or a colour outside the palette · 2 malformed question. Without a
palette this follows grep, and finding none is an answer.";

/// Every flag the parser accepts. Held equal to the flags named in USAGE
/// by a test, and consulted at runtime so the list is what the parser
/// actually honours.
const FLAGS: [&str; 7] = [
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
    let reports = if options.stdin {
        vec![scan_stdin(&options)?]
    } else {
        walk::collect(&options.inputs, &options.walk)?
            .iter()
            .filter_map(|target| scan::scan_file(target, &options.scan))
            .collect()
    };

    if options.values_only {
        write_values(&reports)?;
    } else {
        write_reports(&reports)?;
    }

    summarise(&reports, options.values_only);
    Ok(scan::exit_code(&reports))
}

fn write_reports(reports: &[FileReport]) -> Result<(), String> {
    let mut stdout = std::io::stdout().lock();
    for report in reports {
        let line = serde_json::to_string(report).expect("a report serializes");
        writeln!(stdout, "{line}")
            .map_err(|error| format!("could not write the report: {error}"))?;
    }
    Ok(())
}

fn write_values(reports: &[FileReport]) -> Result<(), String> {
    let mut stdout = std::io::stdout().lock();
    for report in reports {
        for found in &report.colors {
            writeln!(stdout, "{}", found.value)
                .map_err(|error| format!("could not write the values: {error}"))?;
        }
    }
    Ok(())
}

fn scan_stdin(options: &Cli) -> Result<FileReport, String> {
    let mut content = String::new();
    std::io::stdin()
        .read_to_string(&mut content)
        .map_err(|error| format!("could not read stdin: {error}"))?;
    // There is no filename to infer from, and no useful default: a
    // colour only means something in a format, so stdin must name one.
    let format = options
        .scan
        .format
        .ok_or_else(|| "reading from stdin needs --format".to_string())?;
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
            "--hidden" => options.walk.hidden = true,
            "--no-ignore" => options.walk.respect_ignore = false,
            // An unknown format falls back rather than failing, which is
            // the extension's behaviour and the reason this tool can be
            // pointed at a repository nobody has described to it. The
            // flag still takes a value, so a missing one is a refusal.
            "--format" => {
                let value = rest
                    .next()
                    .ok_or_else(|| "--format needs a format".to_string())?;
                let resolved = resolve_format(Some(value), None);
                // Refused, not fallen back. There is no useful thing to
                // do with a format this has no extractor for, and a
                // silent nothing would read as a clean run.
                if resolved == crate::extract::FALLBACK_FORMAT {
                    return Err(format!(
                        "{value} is not a format this reads; one of: {}",
                        SUPPORTED_FORMATS.join(", ")
                    ));
                }
                options.scan.format = Some(resolved);
                options.walk.format = Some(resolved);
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

/// The human half. Every line restates something already on stdout.
fn summarise(reports: &[FileReport], values_only: bool) {
    let mut stderr = std::io::stderr().lock();
    let mut colors = 0;
    let mut outside = 0;

    for report in reports {
        for diagnostic in &report.diagnostics {
            let _ = writeln!(stderr, "{}: {}", report.file, diagnostic.message);
        }
        // With --values the values are already on stdout; repeating them
        // here would double every line a reviewer is piping.
        if !values_only {
            for found in &report.colors {
                let _ = writeln!(stderr, "{}", scan::describe(report, found));
            }
        }
        colors += report.summary.colors;
        outside += report.summary.outside_palette;
    }

    let _ = writeln!(
        stderr,
        "{} in {}",
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
