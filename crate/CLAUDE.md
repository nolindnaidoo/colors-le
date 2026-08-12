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
  unit-tested, 90% module coverage floor), and in `walk.rs` / `scan.rs`
  only when it needs the filesystem. A `std::fs` call in `extract/`
  fails a CI job.
- **Blanking must preserve byte length.** Every offset in this crate is
  a byte offset into the original document, and blanking a multi-byte
  character to one space slides all of them — far enough to slice
  mid-character and abort. `debug_assert`s guard it; do not remove them,
  and pad by `len_utf8()` in anything new that blanks.
- **The corpus is all ASCII**, so it cannot catch a byte-length bug.
  That class is caught by running the binary over a real repository, and
  it has been, once, the hard way.
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
  frontends and needs a CHANGELOG entry. The extension is the reference
  implementation; a difference is a regression until SPEC.md says
  otherwise.
- Write regression tests for every bug you fix; keep unit tests free of
  clocks, randomness, and the filesystem outside `walk`/`scan`.
- **Run the binary, not only the tests.** 106 unit tests passed while
  the binary aborted on the first real repository.
