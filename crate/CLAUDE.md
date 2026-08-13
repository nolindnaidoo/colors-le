# Instructions for AI coding assistants

Read [AGENTS.md](AGENTS.md) first — it is the engineering-standards
document for this crate and the source of truth for layout, control-flow
style, the settled decisions, testing requirements, and the definition
of done. [SPEC.md](SPEC.md) defines the product behavior. AGENTS.md wins
on any conflict. The extension at the repo root is a separate product
with its own `CLAUDE.md`.

- Before declaring any change complete, run exactly what CI runs:
  `cargo fmt --all --check`,
  `cargo clippy --all-targets -- -D warnings`,
  `cargo test --locked`. All three must pass — and
  `bun ../scripts/check-extraction-parity.ts` when extraction changed.
- Never add inline `#[allow(...)]` — CI fails the build on it. Fix the
  lint, or add a commented relaxation to `[lints.clippy]` in
  `Cargo.toml`. Two are there already, with their reason.
- New logic goes in `extract/` when it is pure (it must then be
  unit-tested, 75% module coverage floor), and in `walk.rs` / `scan.rs`
  only when it needs the filesystem. A `std::fs` call in `extract/`
  fails a CI job.
- **Blanking must preserve byte length.** Every offset in this crate is
  a byte offset into the original document, and blanking a multi-byte
  character to one space slides all of them — far enough to slice
  mid-character and abort. `debug_assert`s guard it; do not remove them,
  and pad by `len_utf8()` in anything new that blanks.
- **The corpus is all ASCII**, so it cannot catch a byte-length bug.
  That class is caught by running the binary over a real repository —
  and it was, once, the hard way — and now by `tests/fuzz.rs`, whose
  seeds in `tests/seeds/` are multi-byte for exactly this reason, and by
  `scripts/check-extraction-differential.ts`.
- **The extraction layer follows JavaScript's string semantics, not
  Rust's.** The reference implementation runs its patterns without the
  `u` flag, so `\b`, `\d` and `[a-z]` are ASCII there, and both its `\s`
  and its `trim` include U+FEFF while excluding U+0085. `extract/js.rs`
  holds that set once and `heuristics.rs` spells the ASCII classes out.
  **Never use `str::trim` or `char::is_whitespace` on the shared path —
  use `js::trim`**, and do not "simplify" the patterns back to `(?i)`
  and `\d`. Each shortcut is a divergence in the shared MCP tool, and
  five of them shipped.
- **Never index one string with offsets taken from another.** A
  `to_lowercase` copy is a different string: `İ` grows and `K` shrinks,
  and the markup extractor aborted on both. `to_ascii_lowercase`
  preserves byte length, and tag and attribute names are ASCII.
- **An unknown format is read as raw text**, since 0.2.0 — the walk has
  no format filter and every file is opened. Two rules make that safe
  and both apply *only* outside the format-aware extractors: a short hex
  in prose needs an `a`-`f` (`#250` is an issue reference), and a named
  colour must be the whole value (a paragraph mentioning orange is not a
  finding). Do not relax either without the measurement that justified
  it — see `crate/SPEC.md`.
- **The palette compares by colour, not by text**, and a named colour is
  only equal to itself. Resolving keywords to hex would launder an
  unapproved keyword into an approved brand colour.
- **Do not give this tool an opinion beyond the palette it is handed.**
  No contrast score, no conversion, no nearest-match — see SPEC.md.
  Contract tests on both surfaces enforce it.
- `fixtures/` is shared with the extension — changing it changes both
  frontends and needs a CHANGELOG entry. **What it holds equal is the
  shared `extract_colors` MCP tool**, which must answer identically from
  either server; a difference there is a bug. The surfaces themselves
  are IDE-first and terminal-first and are meant to differ — the walk,
  `--palette`, `--strict`, the exit codes and JSON Lines have no editor
  equivalent and are not drift. SPEC.md's "Deliberate divergences" is
  the bar for a new one.
- Write regression tests for every bug you fix; keep unit tests free of
  clocks, randomness, and the filesystem outside `walk`/`scan`.
- **Run the binary, not only the tests.** 106 unit tests passed while
  the binary aborted on the first real repository.
