# colors-le (CLI) — engineering standards

This is the source of truth for how code in `crate/` is written, tested,
and reviewed. It applies to every contributor, human or AI-assisted. CI
(`.github/workflows/ci-crate.yml`) enforces the mechanical parts;
reviewers enforce the rest. [SPEC.md](SPEC.md) defines the product
behavior — verdicts, exit codes, the parity scope; this file is how the
code gets there. The extension at the repo root is a separate TypeScript
product with its own `AGENTS.md`.

## What this project is

The command-line and MCP frontend of Colors-LE: find every colour in a
codebase, and say which are not in the palette. Nothing is filtered,
rewritten or judged — see SPEC.md, "Non-goals". One product, two
frontends, one repository: the corpus (`fixtures/`) is shared with the VS
Code extension, and CI fails when either side drifts from it.

**Two jobs, one extraction.** Enforcement — here is the palette, tell me
what is not in it — and discovery, where there is no palette yet and one
has to be written from what is in use. Every decision below follows from
those.

**Status: released.** All eight extractors, both surfaces and
the test layers below are green. Releases go out through
`release-crate.yml`, which is dispatch-only and refuses a version that
crates.io already carries, has no changelog entry, would ship a tarball
missing its own corpus, or whose corpus the extension no longer
reproduces.

## Layout

```
crate/src/
├── extract/     pure: the matchers, the format extractors, palette
│                comparison, positions, and js.rs — JavaScript's string
│                semantics, where Rust's differ. No filesystem,
│                pub(crate).
├── walk.rs      ignore-aware tree walking
├── scan.rs      one file end to end — the only path either surface calls
├── cli.rs       the terminal surface
└── mcp/         the agent surface
```

- **`extract/` touches no filesystem.** It takes document text and a
  format and returns values, so the entire extraction layer tests from a
  fixture file — no temp directories, no flake. It carries the **90%
  line coverage floor per module**, enforced by the `coverage` job. A
  `std::fs` call appearing there is a bug, and the `policy` job greps
  for one.
- **`scan.rs` and `walk.rs` are the only modules allowed to touch the
  filesystem.**
- **Both surfaces are one implementation.** `cli.rs` and `mcp/` both call
  `scan.rs`. A surface that grows its own copy of a rule is a bug, and
  a contract test asserts the two return identical reports for the same
  tree.
- **`walk.rs` selects, it does not decide.** Its one rule — a file named
  explicitly is read whatever the ignore rules say — is why intent beats
  configuration. It has **no format filter**: it had one, and it was the
  reason a `tokens.json` was never opened.
- Keep modules flat. No layers, registries, managers, or services. No
  trait with a single implementation.

## Decisions already made (do not relitigate)

- **Blanking preserves byte length.** JavaScript replaces a comment
  character with a space and the string keeps its length, because it
  counts UTF-16 units; Rust replaces a multi-byte `char` with a one-byte
  space and every offset after it shifts. One accented character in one
  comment was enough to slide the offsets far enough to slice
  mid-character and abort. `blank_comments` pads by `len_utf8()` and both
  blankers carry a `debug_assert` on the length. **Every corpus document
  is ASCII, so the corpus cannot catch this** — a real repository did.
- **`typescript` and `xml` are their own format keys**, not aliases of
  `javascript` and `svg`. The key is user-visible as `fileType` in every
  MCP answer, so collapsing them would have the two servers disagree
  about what they just read. **A key is not an extractor**: `xml` runs
  the markup-SVG extractor, and the mapping from one to the other is
  `format::extractor_of`, held equal to the extension by
  `fixtures/aliases.json`. That mapping is where the second divergence
  lived — `xml` ran markup-HTML here and markup-SVG there, so a `fill`
  attribute was found by the extension and missed by this crate. Pin
  both layers; the alias table alone cannot see this one.
- **An unknown format is read, not refused** — reversed in 0.2.0. It was
  a refusal, and the refusal meant this could not open a `.json`, which
  is where a design system keeps its tokens. What it protected against
  is one collision, `#250` in prose, and that is now a rule about short
  hex in the extractor rather than a filter on the walk. `--format`
  still refuses a name it does not know: strict parsing applies to
  flags, the fallback applies to documents.
- **A binary file is not a file that failed to be read.** A NUL byte in
  the first 8KB (ripgrep's rule) means the file was never a text
  candidate: no report line, no effect on `--strict`, counted in the
  summary. A file that looked like text and could not be read keeps its
  `skipped` diagnostic and still fails `--strict`. Collapsing the two
  made `--strict` exit 2 on any repository containing an image, which
  made it useless.
- **Outside a stylesheet, a named colour must be the whole value.** The
  raw scan reads prose, and matching any keyword inside a value segment
  produced 35 false findings against 19 real colours on two real
  repositories — a paragraph about a brand-orange focus ring, a
  shields.io badge ending `-red)`, a Tailwind `text-white` class. The
  format-aware extractors keep the looser rule, because there the
  declaration syntax is known.
- **A named colour is only a colour where a value is expected** — a
  declaration value, an attribute value, a whole string literal. Without
  that, every sentence containing "orange" is a finding.
- **An attribute value must be the whole colour.** A value that merely
  *contains* a literal is not one, which is what keeps `href="#abc"` out.
- **Half the extension, on purpose.** Convert, analyze and validate are
  interactive quick-picks and stay in the editor. The extension's
  `validate` already computes WCAG contrast; that capability is real and
  deliberately left there until a contrast auditor is designed as its own
  thing.
- **The palette is the addition**, outside parity scope, and it compares
  **by colour rather than by text** — a palette in hex must catch a
  violation in `rgb()`. Alpha is part of the identity. A colour that
  cannot be resolved is never approved: surfacing it is the safe
  direction.
- **A named colour is only equal to itself in a palette.** `white` and
  `#ffffff` are the same pixel and not the same decision, and resolving
  keywords would launder an unapproved one into an approved one.
- **`inPalette` is absent when no palette was given**, rather than always
  `true`. A field that always says yes reads as a verdict nobody asked
  for.
- **`--dedupe` collapses within each file**, matching the extension.
  Across a tree the last step is `sort -u`, and the docs say so.
- **Exit 1 means two things and that is deliberate.** Without a palette
  this follows grep and 1 is "none found"; with one, 1 is "a violation".
  A run cannot be both.
- **One crate, self-contained.** No published `-core`, no shared crate,
  and nothing holding this code equal to the similar files in the
  sibling repos.
- **stdout is protocol, stderr is human. There is no `--json` flag.**
- **Parity scope is extraction** — `src/extraction/**`. The palette is
  outside it; the extension has nothing to disagree with.

## Control-flow style

Flat over nested, guards over branches — the same rules as pixelcoords,
pixelactions and scrape-le:

- **No statement-position `else`.** Guard clauses and early `return`
  (`if !ok { return ... }` / `let Some(x) = ... else { return }`), then
  fall through to the happy path.
- **Value-position `if/else` is fine** — `let x = if cond { a } else
  { b }` is Rust's ternary.
- **`match` is fine and preferred** over any chain of condition tests on
  the same value; use match guards instead of `if/else` inside arms.
- Prefer combinators where they read cleanly: `bool::then_some`,
  `Option::map/filter/is_some_and`, `?`.
- No nesting deeper than two levels inside a function; extract a named
  helper instead.

## Hard rules

- **No inline `#[allow(...)]`** — CI greps and fails the build. Either
  fix the lint or add a visible, commented relaxation to
  `[lints.clippy]` in `Cargo.toml`.
- **Clippy pedantic, deny warnings.** `cargo clippy --all-targets --
  -D warnings` must pass exactly as CI runs it.
- **No async runtime.** This tool reads files and asks the filesystem
  about them. There is nothing to await.
- **`unsafe` is forbidden crate-wide** (`[lints.rust]`).
- **Dependencies are a cost.** Five format parsers is already more than
  most tools carry, and every one is justified by a comment in
  `Cargo.toml`. Justify any addition; prefer the standard library;
  prefer what is already in the tree.
- **No network, ever.**
- **Nothing writes, and nothing judges.** No `--fix`, no verdicts, no
  filtering.
- **Strict parsing, never silent defaults** — for flags. An unrecognised
  flag or an input that does not exist is an error with an actionable
  message. A format that does not resolve is the documented exception
  above: it falls back. A typo'd `--stict` that silently did
  nothing would report a clean audit that never ran the check asked for.
- **Refuse rather than guess.** A file that cannot be read is reported
  as unexamined and the run exits 2 — never a clean result that quietly
  skipped it. Never report coverage you did not achieve.
- **Refusals speak the caller's vocabulary.** An MCP caller has no
  command line; no message aimed at one mentions `--dedupe` or any other
  flag. A test asserts no MCP output contains `--`.
- **`extract_colors` belongs to both servers.** The npm server
  (`src/mcp/tools.ts`) and this one offer the same tool: same schema,
  same envelope, byte-identical output, positions
  included. `fixtures/mcp-extract-colors.json` runs
  against both, so changing one without the other fails a build.
  Every tool here returns that envelope — `{ ok, data, diagnostics,
  meta }` — where `ok` means the check ran, never that the answer was
  yes.

## The corpus contract

`fixtures/` lives inside this crate so the published package is
self-contained — `cargo package` cannot reach above its own directory.
The corpus is **not** needed to build the binary; that was checked
rather than assumed, by deleting it from an unpacked tarball and
building. It is needed to *verify*: `cargo test` on the published crate
runs every corpus case, so a consumer can check the parity claims
instead of trusting them. That is why it ships, and the release workflow
asserts it is in the tarball. It is still shared ground: the extension
reads the same files.
`../scripts/check-extraction-parity.ts` (the `parity` job in
`ci-crate.yml`) fails when the extension drifts. Changing a document or
an expectation is a behavior change for **both** frontends and needs a
CHANGELOG entry.

Where the two must disagree, the disagreement is written down in
SPEC.md and a test asserts what each side actually answers. There is no
other sanctioned way to differ.

## Testing

The bar, enforced by review:

- **`extract/`: 90% line coverage floor per module.** Everything in it
  is pure; if something is hard to test there, the design is wrong. Per
  module rather than the crate total, because a total lets one module
  slide while the others carry it.
- **The parity corpus is embedded.** Every `fixtures/` case runs as a
  unit test; the expected values are the extension's answers.
- **Exit codes belong in `tests/contracts.rs`.** They are the API —
  callers branch on them — so they are pinned by tests that drive the
  built binary against a temporary tree: no network, no privileged
  operation, so they run everywhere on every push. A new refusal adds
  its case there.
- **Anything needing a document larger than an editor opens is
  `tests/scenarios.rs`** — gated behind `COLORS_LE_SCENARIOS` and run by
  CI on all three OSes. A skipped scenario is never reported as a pass; each one says
  plainly that it did not run.
- **The six jobs that exist because something got through.** Each has
  its own file, and each fails naming the input that broke it:
  - `tests/hazards.rs` — a tree built at runtime: a BOM, a lone CR,
    invalid UTF-8, a NUL byte, a FIFO, a symlink loop, a 260-character
    path. Every case asserts an answer (0, 1 or 2), never a signal.
    Cases a platform cannot express are skipped **by name**.
  - `tests/platform.rs` — what differs by OS: `/` in every report path,
    `TZ` independence, case-folding filesystems, reserved Windows names,
    and a child that refuses before the write lands.
  - `tests/fuzz.rs` — 60 seconds per target over the pure layer, gated
    behind `COLORS_LE_FUZZ`, seeded from `tests/seeds/` as well as the
    corpus. **The blankers are the highest-risk code here**; the seeds
    are multi-byte because the corpus is deliberately ASCII and so could
    never have caught the offset slide that aborted the process.
  - `tests/budget.rs` — a wall-clock ceiling on a 500-file generated
    tree, gated behind `COLORS_LE_BUDGET`, run in release. The ceiling
    is ten times the local measurement and the measurement is recorded
    in the file with the machine it came from. Four copies of the tree
    may not take more than six times as long.
  - `tests/coverage_matrix.rs` — every name in the alias table gets a
    file and every file gets a report line; every advertised format has
    a corpus document.
  - `../scripts/check-extraction-differential.ts` — generates documents
    and requires **the shared `extract_colors` tool** to answer
    identically on both servers. Scoped to that tool on purpose: the
    surfaces around it differ by design, and SPEC.md lists how.
- **Every bug fix ships with a regression test** that fails before the
  fix. Three divergences got through a green suite here and were caught
  the first time the corpus and then the binary actually ran: rust-ini
  resolving `\U` as an escape, the fallback regex matching across
  newlines where JavaScript's `.` cannot, and a bare key in an INI file
  taking every value in that file down with it. Run the binary, not only
  the tests.
- Tests are deterministic: no clocks, no randomness, and **no filesystem
  in `extract/` tests** — everything there runs from the corpus.

## Verification — the definition of done

All of it, exactly as CI runs it, before every push:

```bash
cargo fmt --all --check
cargo clippy --all-targets -- -D warnings
cargo test --locked
bun ../scripts/check-extraction-parity.ts   # when extraction changed
```

CI additionally builds on macOS, Windows and Linux, checks the Rust 1.88
minimum version, runs `cargo audit`, the no-inline-`#[allow]` and
no-filesystem-in-`extract/` policy jobs, the per-module coverage floor,
the gated scenarios, and parity — including on extension-side edits to
`src/extraction/**`, so neither frontend can drift green. On top of
those: `hazards` and `platform` on all three OSes, and `differential`,
`fuzz`, `budget` and `coverage-matrix` on Linux. The gated ones are run
locally with the env var that turns them on:

```bash
COLORS_LE_FUZZ=1 COLORS_LE_FUZZ_SECONDS=60 cargo test --test fuzz -- --nocapture
COLORS_LE_BUDGET=1 cargo test --release --test budget -- --test-threads=1 --nocapture
bun ../scripts/check-extraction-differential.ts   # needs cargo build --locked first
```
 A change is
not done because it compiles; it is done when it is tested, linted,
documented where behavior changed (README / CHANGELOG / SPEC / this
file), and honest — claims in docs must match the code.

## Commits and pull requests

The repo root's convention applies unchanged (root `AGENTS.md`):
conventional prefix, imperative subject under 72 characters, body
carrying the *why* — enforced by the `commit-msg` hook and the
`Commit messages` CI job. One concern per change; if docs describe the
thing you changed, update them in the same commit. Release tags are
`crate-v*`, and a release goes out by dispatching `release-crate.yml`
with its publish opt-in — never by pushing a tag, because a crates.io
version can never be reused.
