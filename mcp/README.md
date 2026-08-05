# colors-le-mcp

An [MCP](https://modelcontextprotocol.io) server that extracts colors from
stylesheets and code — the extraction engine behind the
[Colors-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.colors-le)
editor extension, exposed as a tool an agent can call.

No dependencies, no network calls, no filesystem access. Content goes in,
structured results come out.

## Use it

Point any MCP host at `npx colors-le-mcp`.

**Claude Code**

```bash
claude mcp add colors-le -- npx -y colors-le-mcp
```

**Anything with a JSON config** — Cursor, Windsurf, Claude Desktop:

```json
{
  "mcpServers": {
    "colors-le": {
      "command": "npx",
      "args": ["-y", "colors-le-mcp"]
    }
  }
}
```

**VS Code and Zed** need nothing here. Install the extension instead — it
carries this server and registers it for you.

## The tool

### `extract_colors`

| argument | type | |
|---|---|---|
| `content` | string | **required.** The text to scan. |
| `format` | string | The language: `css`, `scss`, `less`, `stylus`, `html`, `javascript`, `typescript`, `svg`, `xml`. Required unless `filename` is given. |
| `filename` | string | Used to infer `format` when it is absent — `theme.scss` resolves to `scss`. |
| `dedupe` | boolean | Collapse repeats. Default `false`. |
| `maxResults` | number | Default `500`, ceiling `5000`. |

Returns each color with its notation and 1-based line and column, plus
`meta.truncated` so a capped result is never mistaken for a complete one.

```json
{
  "ok": true,
  "data": {
    "colors": [
      { "value": "#ff0000", "format": "hex", "line": 2, "column": 12 }
    ]
  },
  "meta": { "count": 1, "truncated": false }
}
```

Extraction is heuristic, and what it deliberately does **not** match is
documented as carefully as what it does — see the
[extension README](https://github.com/nolindnaidoo/colors-le#readme).

## Licence

MIT
