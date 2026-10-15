/**
 * The command line's help text and the flags it names.
 *
 * Word for word the Rust CLI's, because both install as `colors-le` and a
 * person reading `--help` cannot tell which one they have.
 * `scripts/check-cli-parity.ts` compares the two outputs, and `usage.test.ts`
 * holds FLAGS equal to the flags this text names.
 */

export const USAGE = `usage: colors-le [options] <file|dir>...
       colors-le [options] --stdin [--format <format>]
       colors-le mcp
       colors-le --version | --help

Finds every colour in a tree and, given a palette, says which of them are
not in it. One JSON report per line on stdout when it is piped or
redirected, human summary on stderr.

Every file is read. CSS, SCSS, LESS, Stylus, HTML, XML, SVG, JavaScript,
TypeScript, JSON, YAML, TOML, Markdown and plain text are read by name;
anything else is scanned as raw text and reported as format "unknown".
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
palette this follows grep, and finding none is an answer.`;

export const FLAGS: readonly string[] = Object.freeze([
	'--strict',
	'--dedupe',
	'--palette',
	'--format',
	'--values',
	'--stdin',
	'--hidden',
	'--no-ignore',
]);
