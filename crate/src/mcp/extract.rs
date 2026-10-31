//! `extract_colors` — the tool **both** servers offer.
//!
//! The npm server (`src/mcp/tools.ts`) and this one are meant to be the
//! same tool, not two similar ones: same schema, same envelope,
//! byte-identical output. `fixtures/mcp-extract-colors.json` runs against
//! both, so changing one without the other fails a build.
//!
//! It touches no filesystem. An agent already has file-read tools;
//! duplicating them here would add a path-traversal surface for no
//! capability. The tool that needs a filesystem is `colors_le_scan`.

use serde_json::{Value, json};

use super::{Refusal, optional_bool, optional_str, refuse_unknown};
use crate::extract::{self, SUPPORTED_FORMATS, resolve_format};

const DEFAULT_MAX_RESULTS: usize = 500;
const MAX_MAX_RESULTS: usize = 5000;

pub(crate) fn definition() -> Value {
    json!({
        "name": "extract_colors",
        "description": "Extract every color from a stylesheet or document, with its notation \
                        and 1-based line and column. Reads CSS, SCSS, LESS, Stylus, HTML, \
                        JavaScript, TypeScript, SVG, XML, JSON, YAML, TOML, Markdown and \
                        plain text by name, and anything else as raw text, so a format is \
                        optional. Reports hex, rgb/rgba, hsl/hsla, hwb, lab, lch, oklab, oklch, \
                        color() and named colors as written.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "content": { "type": "string", "description": "The document text to scan." },
                "format": {
                    "type": "string",
                    "enum": SUPPORTED_FORMATS,
                    "description": "Document format. Optional — an unrecognised or absent \
                                    format is read as raw text and reported as \"unknown\".",
                },
                "filename": {
                    "type": "string",
                    "description": "Filename used to infer the format when `format` is absent, \
                                    e.g. \"theme.scss\".",
                },
                "dedupe": {
                    "type": "boolean",
                    "default": false,
                    "description": "Collapse repeated colors to their first occurrence.",
                },
                "maxResults": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": MAX_MAX_RESULTS,
                    "default": DEFAULT_MAX_RESULTS,
                    "description": format!(
                        "Cap on returned colors (default {DEFAULT_MAX_RESULTS}). meta.truncated \
                         reports whether any were dropped."
                    ),
                },
            },
            "required": ["content"],
            "additionalProperties": false,
        },
    })
}

pub(crate) fn run(arguments: &Value) -> Result<Value, Refusal> {
    refuse_unknown(
        arguments,
        &["content", "format", "filename", "dedupe", "maxResults"],
    )?;
    let content = arguments
        .get("content")
        .and_then(Value::as_str)
        .ok_or_else(|| {
            Refusal::InvalidParams("content is required and must be a string".to_string())
        })?;
    let max_results = read_max_results(arguments)?;

    // Never a refusal of the document. An agent that knows nothing about
    // it still gets its colours, which is the whole reason a format is
    // optional here. Read as the schema types them, though: a `format: 7`
    // was read as absent and a `dedupe: "yes"` as false, silences the
    // schema never allowed.
    let format = resolve_format(
        optional_str(arguments, "format")?,
        optional_str(arguments, "filename")?,
    );
    let dedupe = optional_bool(arguments, "dedupe")?;

    let mut values: Vec<Value> = extract::extract(content, format)
        .into_iter()
        .map(|found| {
            json!({
                "value": found.value,
                "format": found.notation,
                "line": found.position.line,
                "column": found.position.column,
            })
        })
        .collect();

    if dedupe {
        let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
        values.retain(|value| seen.insert(value["value"].to_string()));
    }

    // The `truncated` flag matters more than the cap: a silently
    // incomplete answer is wrong in the most expensive way, and this is
    // a tool whose whole job is completeness.
    let truncated = values.len() > max_results;
    values.truncate(max_results);

    let count = values.len();
    Ok(super::envelope(
        "extract_colors",
        &json!({ "colors": values, "fileType": format }),
        count,
        &[],
        truncated,
    ))
}

/// Clamp quietly, reject loudly — the npm server's asymmetry. The other
/// two servers read `2.0`, `1e3` and `1E20` as caps; serde reads all
/// three as floats, so `as_u64` refused them here while the extension's
/// server answered.
fn read_max_results(arguments: &Value) -> Result<usize, Refusal> {
    let Some(raw) = arguments.get("maxResults") else {
        return Ok(DEFAULT_MAX_RESULTS);
    };
    let invalid = || Refusal::InvalidParams("maxResults must be a positive integer".to_string());
    let value = raw.as_f64().ok_or_else(invalid)?;
    if !value.is_finite() || value.fract() != 0.0 || value < 1.0 {
        return Err(invalid());
    }
    // A whole number prints without a point or an exponent, so the parse
    // is exact and casts nothing; one too wide for `usize` fails it, and
    // that is a cap past the ceiling.
    let cap = format!("{value}")
        .parse::<usize>()
        .unwrap_or(MAX_MAX_RESULTS);
    Ok(cap.min(MAX_MAX_RESULTS))
}

#[cfg(test)]
mod tests {
    use serde::Deserialize;

    use super::*;
    use crate::extract::FALLBACK_FORMAT;
    use crate::extract::corpus::document;

    const CASES: &str = include_str!("../../fixtures/mcp-extract-colors.json");

    #[derive(Debug, Deserialize)]
    struct Case {
        name: String,
        file: Option<String>,
        content: Option<String>,
        arguments: Value,
        expected: Option<Value>,
        /// A schema violation: `-32602`, in these words.
        #[serde(rename = "expectedError")]
        expected_error: Option<String>,
        /// A tool failure on what it was given: an `isError` result.
        #[serde(rename = "expectedFailure")]
        expected_failure: Option<String>,
    }

    #[test]
    fn every_shared_case_answers_identically() {
        let cases: Vec<Case> = serde_json::from_str(CASES).expect("the corpus is valid JSON");
        assert!(!cases.is_empty(), "the corpus is empty");

        for case in cases {
            let mut arguments = case.arguments.clone();
            let content = case
                .file
                .as_deref()
                .map(document)
                .map(str::to_string)
                .or(case.content);
            if let Some(content) = content {
                arguments["content"] = json!(content);
            }

            match (case.expected, case.expected_error, case.expected_failure) {
                (_, Some(expected), _) => {
                    assert_eq!(
                        run(&arguments).expect_err(&case.name),
                        Refusal::InvalidParams(expected),
                        "{}",
                        case.name
                    );
                }
                (_, None, Some(expected)) => {
                    assert_eq!(
                        run(&arguments).expect_err(&case.name),
                        Refusal::Failure(expected),
                        "{}",
                        case.name
                    );
                }
                (Some(expected), None, None) => {
                    assert_eq!(
                        run(&arguments).expect(&case.name),
                        expected,
                        "{}",
                        case.name
                    );
                }
                (None, None, None) => {
                    panic!("{} pins neither a result nor a refusal", case.name);
                }
            }
        }
    }

    #[test]
    fn the_tool_name_is_pinned() {
        assert_eq!(definition()["name"], "extract_colors");
    }

    #[test]
    fn the_advertised_enum_matches_the_formats_that_resolve() {
        let definition = definition();
        let advertised: Vec<String> = definition["inputSchema"]["properties"]["format"]["enum"]
            .as_array()
            .expect("an enum")
            .iter()
            .filter_map(|value| value.as_str().map(str::to_string))
            .collect();
        assert_eq!(advertised, SUPPORTED_FORMATS);
    }

    /// The shared tool carries positions, which is what its own
    /// description on both servers promises.
    #[test]
    fn a_colour_comes_back_with_its_notation_and_position() {
        let result =
            run(&json!({ "content": ".a{color:#1a2b3c}", "format": "css" })).expect("a result");
        let found = &result["data"]["colors"][0];
        assert_eq!(found["value"], "#1a2b3c");
        assert_eq!(found["format"], "hex");
        assert_eq!(found["line"], 1);
        assert_eq!(found["column"], 10);
    }

    /// A format with no extractor of its own is read as raw text, and
    /// the answer says which it was.
    #[test]
    fn an_unknown_format_is_read_and_says_so() {
        let result =
            run(&json!({ "content": "see #abc below", "format": "klingon" })).expect("a result");
        assert_eq!(result["data"]["fileType"], FALLBACK_FORMAT);
        assert_eq!(result["data"]["colors"][0]["value"], "#abc");
    }

    /// Markdown resolves by name, so the answer names it — and its
    /// short-hex rule drops the issue reference while keeping `#FFF`.
    #[test]
    fn markdown_is_named_and_keeps_only_the_hex_with_a_letter_in_it() {
        let result = run(&json!({
            "content": "closes #250, and the paper is #FFF",
            "filename": "notes.md",
        }))
        .expect("a result");
        assert_eq!(result["data"]["fileType"], "markdown");
        assert_eq!(result["data"]["colors"][0]["value"], "#FFF");
        assert_eq!(result["meta"]["count"], 1);
    }

    /// The palette is the CLI's, not this tool's: an agent handing over
    /// document text has no palette file to point at.
    #[test]
    fn the_shared_tool_carries_no_verdict() {
        let result =
            run(&json!({ "content": ".a{color:#1a2b3c}", "format": "css" })).expect("a result");
        let rendered = serde_json::to_string(&result).expect("serializes");
        assert!(!rendered.contains("inPalette"), "{rendered}");
    }

    #[test]
    fn a_fractional_cap_is_refused() {
        let error = run(&json!({ "content": "x", "maxResults": 1.5 })).expect_err("a refusal");
        assert_eq!(error.message(), "maxResults must be a positive integer");
        assert!(matches!(error, Refusal::InvalidParams(_)));
    }
}
