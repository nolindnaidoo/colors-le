//! A standing net over the pure layer: colour classification, the two
//! literal matchers, the named-colour scan and the comment blankers.
//!
//! **The blankers are the highest-risk code here.** Every offset in this
//! crate is a byte offset into the original document, and blanking a
//! multi-byte character to a single space slides all of them — far
//! enough, on one real repository, to slice mid-character and abort the
//! process. `debug_assert`s guard the byte length; a fuzzer feeding
//! non-ASCII is what proves them, and the shared corpus cannot, because
//! it is deliberately ASCII.
//!
//! **Why not cargo-fuzz or proptest.** cargo-fuzz needs a library target
//! to link against and this crate is a binary; `extract/` is
//! `pub(crate)` and reachable from a test only through a frontend.
//! proptest would put a dependency tree in the published tarball's
//! `cargo test`, and its shrinking model does not buy anything for a
//! run that is time-boxed rather than run to convergence. So: a seeded
//! generator, a wall clock, and the built binary's MCP server — one
//! process, one request per line, which reaches `extract/` through the
//! thinnest shell there is. A panic kills that process and the loop
//! names the document that did it.
//!
//! Gated: `COLORS_LE_FUZZ=1`, `COLORS_LE_FUZZ_SECONDS` (default 60) per
//! target, `COLORS_LE_FUZZ_SEED` to reproduce. A skipped run says so
//! rather than reporting a pass.

use std::fmt::Write as _;
use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::time::{Duration, Instant};

const BINARY: &str = env!("CARGO_BIN_EXE_colors-le");

/// A single request may not take longer than this. A true infinite loop
/// is caught by the job's own `timeout-minutes`; this catches the
/// realistic shape — a document that turns a linear scan quadratic.
const PER_DOCUMENT_CEILING: Duration = Duration::from_secs(2);

/// Fragments to build documents out of, deliberately weighted towards
/// what breaks offsets: comment markers that never close, quotes that
/// never close, and characters wider than one byte.
const TOKENS: [&str; 64] = [
    "/*",
    "*/",
    "//",
    "<!--",
    "-->",
    "\"",
    "'",
    "`",
    "\\",
    "\n",
    "\r\n",
    "\t",
    " ",
    "{",
    "}",
    ";",
    ":",
    "=",
    ",",
    "(",
    ")",
    "<",
    ">",
    "/",
    "#",
    "#fff",
    "#FFF",
    "#250",
    "#1a2b3c",
    "#1a2b3c80",
    "#12345",
    "rgb(",
    "rgba(255, 255, 255, 0.2)",
    "hsl(210, 50%, 40%)",
    "hsla(",
    "white",
    "transparent",
    "rebeccapurple",
    "orange",
    "color",
    "fill=",
    "style=",
    "bgcolor=",
    "<style>",
    "</style>",
    "<rect",
    ".a",
    "--brand",
    "content",
    "url(#grad)",
    // Wider than one byte, which is the whole point.
    "é",
    "☕",
    "🎯",
    "İ",
    "K",
    "ẞ",
    "中文",
    "\u{feff}",
    "\u{85}",
    "\u{a0}",
    "\u{200b}",
    "\u{2028}",
    "café",
    "naïve",
];

/// splitmix64: seeded, reproducible, and no dependency.
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
        if bound == 0 {
            return 0;
        }
        usize::try_from(self.next() % bound as u64).unwrap_or(0)
    }

    fn pick<'a, T>(&mut self, items: &'a [T]) -> &'a T {
        &items[self.below(items.len())]
    }
}

/// One target: which documents get generated, and which format they are
/// read as — because the format is what chooses the extractor, and the
/// blankers are only reachable through the ones that have comments.
struct Target {
    name: &'static str,
    formats: &'static [&'static str],
    seeds: &'static [&'static str],
}

const TARGETS: [Target; 4] = [
    // blank_comments, in all four syntaxes it has.
    Target {
        name: "blankers",
        formats: &["css", "scss", "javascript", "html"],
        seeds: &[
            "multibyte.css",
            "multibyte.scss",
            "multibyte.js",
            "multibyte.svg",
        ],
    },
    // find_literals and find_literals_in_prose.
    Target {
        name: "literals",
        formats: &["css", "json", "markdown", "unknown"],
        seeds: &["multibyte.css", "multibyte.md", "theme.css", "tokens.json"],
    },
    // find_named, and the whole-value rule around it.
    Target {
        name: "named",
        formats: &["stylus", "yaml", "toml", "plaintext"],
        seeds: &["multibyte.md", "compose.yaml", "config.toml", "theme.styl"],
    },
    // classify, through the attribute path that compares a value
    // against its literal.
    Target {
        name: "classify",
        formats: &["svg", "xml", "html", "typescript"],
        seeds: &[
            "multibyte.svg",
            "icon.svg",
            "chart.xml",
            "page.html",
            "theme.ts",
        ],
    },
];

/// The seed documents, read once: the shared corpus plus the multi-byte
/// files beside this test. Both, on purpose — the corpus holds the real
/// shapes and is all ASCII, and a mutation of an ASCII document is
/// unlikely to grow a four-byte character on its own.
fn seed_text(name: &str) -> String {
    let manifest = Path::new(env!("CARGO_MANIFEST_DIR"));
    for directory in ["tests/seeds", "fixtures/documents"] {
        let candidate = manifest.join(directory).join(name);
        if let Ok(text) = std::fs::read_to_string(&candidate) {
            return text;
        }
    }
    panic!("no seed document named {name}");
}

/// A slice of a seed at character boundaries, so the fuzzer starts from
/// something shaped like a document rather than from noise.
fn seed_slice(rng: &mut Rng, text: &str) -> String {
    let boundaries: Vec<usize> = text
        .char_indices()
        .map(|(at, _)| at)
        .chain(std::iter::once(text.len()))
        .collect();
    let a = *rng.pick(&boundaries);
    let b = *rng.pick(&boundaries);
    let (start, end) = if a <= b { (a, b) } else { (b, a) };
    text[start..end].to_string()
}

fn document(rng: &mut Rng, target: &Target) -> String {
    let pieces = 1 + rng.below(40);
    let mut out = String::new();
    for _ in 0..pieces {
        if rng.below(4) == 0 {
            let seed = seed_text(rng.pick(target.seeds));
            out.push_str(&seed_slice(rng, &seed));
            continue;
        }
        out.push_str(rng.pick(&TOKENS));
    }
    out
}

struct Server {
    child: Child,
    input: ChildStdin,
    output: BufReader<ChildStdout>,
}

impl Server {
    fn start() -> Self {
        let mut child = Command::new(BINARY)
            .arg("mcp")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .expect("the server starts");
        let input = child.stdin.take().expect("stdin");
        let output = BufReader::new(child.stdout.take().expect("stdout"));
        Self {
            child,
            input,
            output,
        }
    }

    /// The answer to one document, or `None` when the server died on it.
    fn ask(&mut self, content: &str, format: &str) -> Option<String> {
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": "extract_colors",
                "arguments": { "content": content, "format": format },
            },
        });
        writeln!(self.input, "{request}").ok()?;
        self.input.flush().ok()?;

        let mut line = String::new();
        match self.output.read_line(&mut line) {
            Ok(0) | Err(_) => None,
            Ok(_) => Some(line),
        }
    }

    fn stop(mut self) {
        drop(self.input);
        let _ = self.child.wait();
    }
}

/// Every non-ASCII character escaped, so a failing document pastes
/// straight into a test.
fn escape(text: &str) -> String {
    let mut out = String::with_capacity(text.len() + 2);
    out.push('"');
    for character in text.chars() {
        match character {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if c.is_ascii_graphic() || c == ' ' => out.push(c),
            c => {
                let _ = write!(out, "\\u{{{:x}}}", c as u32);
            }
        }
    }
    out.push('"');
    out
}

fn budget() -> Option<Duration> {
    if std::env::var("COLORS_LE_FUZZ").is_err() {
        return None;
    }
    let seconds = std::env::var("COLORS_LE_FUZZ_SECONDS")
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(60);
    Some(Duration::from_secs(seconds))
}

fn seed() -> u64 {
    std::env::var("COLORS_LE_FUZZ_SEED")
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(0x0020_2608_1200_0001)
}

/// A time-boxed run over one target. Any panic, any hang, any answer
/// that is not a well-formed envelope fails, and the document that did
/// it is printed with its seed and iteration.
fn fuzz(target: &Target, budget: Duration) {
    let base = seed();
    let mut rng = Rng(base ^ u64::from(target.name.len() as u32));
    let mut server = Server::start();
    let started = Instant::now();
    let mut iterations: u64 = 0;

    while started.elapsed() < budget {
        iterations += 1;
        let content = document(&mut rng, target);
        let format = *rng.pick(target.formats);

        let began = Instant::now();
        let Some(answer) = server.ask(&content, format) else {
            panic!(
                "target {} died on iteration {iterations}\n  seed:     {base}\n  format:   {format}\n  document: {}",
                target.name,
                escape(&content)
            );
        };
        let took = began.elapsed();
        assert!(
            took < PER_DOCUMENT_CEILING,
            "target {} took {took:?} on one document — the scan is not linear\n  seed:     {base}\n  format:   {format}\n  document: {}",
            target.name,
            escape(&content)
        );

        let parsed: serde_json::Value = serde_json::from_str(&answer).unwrap_or_else(|error| {
            panic!(
                "target {} answered something that is not JSON ({error})\n  seed:     {base}\n  document: {}",
                target.name,
                escape(&content)
            )
        });
        let envelope = &parsed["result"]["structuredContent"];
        assert_eq!(
            envelope["ok"],
            true,
            "target {} reported a failed extraction\n  seed:     {base}\n  format:   {format}\n  document: {}",
            target.name,
            escape(&content)
        );
        // Every colour has to be a real slice of a real answer: a value,
        // a notation, and a 1-based position.
        for found in envelope["data"]["colors"]
            .as_array()
            .expect("colors is an array")
        {
            assert!(
                found["value"].as_str().is_some_and(|v| !v.is_empty()),
                "an empty value\n  seed: {base}\n  document: {}",
                escape(&content)
            );
            assert!(
                found["line"].as_u64().is_some_and(|line| line >= 1)
                    && found["column"].as_u64().is_some_and(|column| column >= 1),
                "a position that is not 1-based\n  seed: {base}\n  document: {}",
                escape(&content)
            );
        }
    }

    server.stop();
    println!(
        "fuzz {}: {iterations} documents in {:?}, seed {base}",
        target.name,
        started.elapsed()
    );
}

#[test]
fn the_pure_layer_survives_everything_thrown_at_it() {
    let Some(budget) = budget() else {
        println!(
            "fuzz SKIPPED: set COLORS_LE_FUZZ=1 to run it. \
             This did NOT pass — it did not run."
        );
        return;
    };
    for target in &TARGETS {
        fuzz(target, budget);
    }
}
