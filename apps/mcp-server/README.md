# OpenPOS MCP Server

MCP server for OpenPOS. Connect MCP clients (Claude Desktop, etc.) to either your local OpenPOS SQLite database or a self-hosted OpenPOS Cloud endpoint.

By default this is a **stdio** server: MCP clients launch it as a subprocess and talk over JSON-RPC on stdin/stdout. It also has an opt-in **HTTP transport** (see [Remote access (HTTP)](#remote-access-http)) for self-hosters who want to expose it at a URL instead.

---

## App Binaries vs. MCP Helper

The desktop and mobile app binaries include the OpenPOS app, but they do **not** currently include a desktop start/stop toggle or a standalone `openpos-mcp` command on your `PATH`.

You do **not** need to run the whole app from source to use MCP. You can use the normal desktop app binary for your tasks, then run this separate MCP helper from the repository with Bun, or build the helper once and run it with Node. Point the helper at the desktop app's local `openpos.db`.

On desktop, the app shows the exact local data path in **Settings -> Sync -> Local Data**. Mobile binaries do not expose a local MCP server surface.

---

## Requirements

- Node.js 18+ (for the MCP client that spawns the server)
- npm package installs use better-sqlite3, a native SQLite addon. If no prebuilt binary is available for your platform, npm needs a working C/C++ build toolchain and Python for node-gyp.
- Bun (recommended for development in this repo)
- A local OpenPOS database (`openpos.db`) for local mode, or a self-hosted OpenPOS Cloud URL and bearer token for Cloud mode

Default database locations:
- Linux: `~/.local/share/openpos/openpos.db`
- macOS: `~/Library/Application Support/openpos/openpos.db`
- Windows: `%APPDATA%\openpos\openpos.db`

Additional macOS path for sandboxed builds:
- `~/Library/Containers/tech.indyzai.openpos/Data/Library/Application Support/openpos/openpos.db`

If `openpos.db` is missing but `data.json` exists in the same desktop data folder, the MCP server will bootstrap a fresh SQLite database from that local data snapshot on first start.
Desktop Settings → Sync → Local Data shows the exact storage location used by the app.

You can override local mode with:
- `--db /path/to/openpos.db`
- `OPEN_POS_DB_PATH=/path/to/openpos.db`
- `OPEN_POS_DB=/path/to/openpos.db`

For self-hosted Cloud mode, use:
- `--cloud-url https://openpos.example.com` or `OPEN_POS_MCP_CLOUD_URL`
- `--cloud-token <token>` or `OPEN_POS_MCP_CLOUD_TOKEN`
- optional `--cloud-allow-insecure-http=true` for trusted private HTTP deployments

---

## Start / Stop

### Run from npm

After installing the published package, run it directly:

```bash
openpos-mcp --db "/path/to/openpos.db"
```

Or let an MCP client launch it through npx:

```json
{
  "mcpServers": {
    "openpos": {
      "command": "npx",
      "args": [
        "-y",
        "openpos-mcp",
        "--db",
        "~/.local/share/openpos/openpos.db"
      ]
    }
  }
}
```

The npm package is read-only by default. Add `--write` only when you explicitly want add/update/complete/delete tools enabled.

### Self-hosted Cloud mode

Use Cloud mode when you run your own OpenPOS Cloud server and want MCP tools without pointing the helper at a local SQLite database:

```bash
npx -y openpos-mcp \
  --cloud-url "https://openpos.example.com" \
  --cloud-token "$OPEN_POS_TOKEN"
```

Or pass the same values through environment variables:

```bash
OPEN_POS_MCP_CLOUD_URL="https://openpos.example.com" \
OPEN_POS_MCP_CLOUD_TOKEN="$OPEN_POS_TOKEN" \
npx -y openpos-mcp
```

Cloud mode uses the self-hosted Cloud API. Reads come from the current `/v1/data` snapshot; with `--write`, task/project/section/area writes go through the Cloud server's per-resource REST endpoints (`POST /v1/tasks`, `PATCH /v1/tasks/:id`, and so on), so they get the same validation and revision stamping as any other client. Without `--write`, write tools return `read_only`. Person edits and restoring deleted tasks are not available in Cloud mode yet.

This does not make OpenPOS Cloud itself a hosted MCP server. It is still the same stdio helper, backed by a Cloud URL that you operate.

For private HTTP test deployments, local/private HTTP URLs are allowed by the shared Cloud client rules. Use `--cloud-allow-insecure-http=true` only for a self-hosted endpoint you intentionally trust.

### Remote access (HTTP)

By default `openpos-mcp` only speaks stdio. Pass `--http` to also (instead of stdio) serve a stateless streamable-HTTP MCP endpoint, so you can point a remote MCP client at a URL — the motivating case is [Gemini Spark](https://gemini.google.com) "custom apps", which take an MCP server URL. HTTP mode works with either backend (local SQLite or self-hosted Cloud).

```bash
openpos-mcp --http --http-token "$(openssl rand -hex 32)" --db "/path/to/openpos.db"
```

Flags (all have `OPEN_POS_MCP_HTTP*` env var equivalents):

- `--http` / `OPEN_POS_MCP_HTTP` — enable HTTP mode. Also implied by setting `--http-host`, `--http-port`, or `--http-token`.
- `--http-token <token>` / `OPEN_POS_MCP_HTTP_TOKEN` — **required** whenever HTTP mode is on, at least 16 characters. Generate one with `openssl rand -hex 32`. The server refuses to start without it — there is no way to expose HTTP mode unauthenticated, even on loopback.
- `--http-host <host>` / `OPEN_POS_MCP_HTTP_HOST` — bind address, default `127.0.0.1`.
- `--http-port <port>` / `OPEN_POS_MCP_HTTP_PORT` — bind port, default `8722`.

The MCP endpoint is `POST /mcp` and requires `Authorization: Bearer <token>` on every request; `GET /healthz` returns `200 ok` without auth for reverse-proxy health checks. Requests without a valid token get `401`; bodies over 1 MiB get `413`. When HTTP mode is on, the server does not also connect a stdio transport — it stays alive as long as the HTTP server is listening, not stdin.

There is no built-in TLS termination or rate limiting. If you're exposing this beyond localhost, put a reverse proxy (e.g. Caddy, nginx) in front for TLS and put the resulting `https://` URL (plus your token) into the remote MCP client.

### Run directly from the repo

```bash
# from repo root (read-only by default)
bun run openpos:mcp -- --db "/path/to/openpos.db"
```

Enable writes (required for add/update/complete/delete tools):

```bash
bun run openpos:mcp -- --db "/path/to/openpos.db" --write
```

Stop:
- Press `Ctrl+C` in the terminal.

### Keep-alive behavior (why it sometimes exits)

The MCP server is **stdio‑based**. It stays alive as long as stdin is open.
If your shell/client closes stdin, the process exits.

To force an immediate exit when stdin closes (no keep-alive), pass `--nowait`:

```bash
bun run openpos:mcp -- --db "/path/to/openpos.db" --nowait
```

Note: When an MCP client launches the server, it keeps stdin open, so the server should remain connected.

### Run without the helper script

```bash
bun run --filter openpos-mcp dev -- --db "/path/to/openpos.db"
```

Stop:
- Press `Ctrl+C` in the terminal.

### Build and run the binary entry (Node)

```bash
# from repo root
bun run --filter openpos-mcp build
node apps/mcp-server/dist/cli.js --db "/path/to/openpos.db"
```

Stop:
- Press `Ctrl+C` in the terminal.

---

## Why `openpos-mcp` is “command not found”

`openpos-mcp` is the package binary. It exists after installing the npm package globally, after an MCP client launches it through `npx`, or after you build the source package and run it with Node.

Use one of these source-tree options instead:

```bash
# ✅ works immediately
bun run openpos:mcp -- --db "/path/to/openpos.db"

# ✅ build then run
bun run --filter openpos-mcp build
node apps/mcp-server/dist/cli.js --db "/path/to/openpos.db"
```

### Optional: create a global `openpos-mcp` command

If you want a real `openpos-mcp` command on your PATH, create a tiny wrapper:

```bash
cat > ~/bin/openpos-mcp <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
cd /absolute/path/to/OpenPOS
exec bun run openpos:mcp -- "$@"
EOF
chmod +x ~/bin/openpos-mcp
```

Then use:

```bash
openpos-mcp --db "/path/to/openpos.db"
```

### Desktop app toggle?

Not yet. Start/stop is still manual.

---

## MCP Client Configuration

MCP clients run the server as a subprocess. You point them to **the command** and pass args/env.

**Important:** Do NOT use `bun run openpos:mcp` for MCP clients. The `bun run` wrapper outputs shell messages to stdout (e.g., `$ bun run --filter...`) which breaks the JSON-RPC protocol. Always run bun directly on the source file.

### Example (generic MCP config)

```json
{
  "mcpServers": {
    "openpos": {
      "command": "bun",
      "args": [
        "/absolute/path/to/OpenPOS/apps/mcp-server/src/cli.ts",
        "--db",
        "~/.local/share/openpos/openpos.db"
      ]
    }
  }
}
```

Add `--write` to the args if you want to enable **add/update/complete/delete** tools.

If your client doesn't support Bun, build first and use Node:

```bash
# Build once
cd /path/to/OpenPOS && bun run --filter openpos-mcp build
```

```json
{
  "mcpServers": {
    "openpos": {
      "command": "node",
      "args": [
        "/absolute/path/to/OpenPOS/apps/mcp-server/dist/cli.js",
        "--db",
        "~/.local/share/openpos/openpos.db"
      ]
    }
  }
}
```

Add `--write` to the args if you want to enable **add/update/complete/delete** tools.

### Claude Desktop

Claude Desktop supports MCP (stdio). Add a server entry in its MCP configuration.

Typical config file locations:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

After editing, fully quit and relaunch Claude Desktop.

### Claude Code (CLI)

Add a server via the CLI:

```bash
claude mcp add openpos -- \
  bun /path/to/OpenPOS/apps/mcp-server/src/cli.ts --db "/path/to/openpos.db" --write
```

Or edit `~/.claude.json` directly:

```json
{
  "projects": {
    "/path/to/your/project": {
      "mcpServers": {
        "openpos": {
          "type": "stdio",
          "command": "bun",
          "args": [
            "/absolute/path/to/OpenPOS/apps/mcp-server/src/cli.ts",
            "--db",
            "~/.local/share/openpos/openpos.db",
            "--write"
          ]
        }
      }
    }
  }
}
```

Then restart the Claude Code session and run `/mcp` to verify it's connected.

### OpenAI Codex (config.toml)

Codex stores MCP config in `~/.codex/config.toml`. Add:

```toml
[mcp_servers.openpos]
command = "bun"
args = ["/absolute/path/to/OpenPOS/apps/mcp-server/src/cli.ts", "--db", "/path/to/openpos.db", "--write"]

# Optional: pass env vars to the server
[mcp_servers.openpos.env]
OPEN_POS_DB_PATH = "/path/to/openpos.db"
```

Restart Codex after saving.

### Gemini CLI

Gemini CLI uses a JSON `settings.json` with `mcpServers`, either:
- User scope: `~/.gemini/settings.json`
- Project scope: `.gemini/settings.json` in your repo

You can add OpenPOS MCP two ways:

**1) CLI (recommended):**

```bash
gemini mcp add openpos \
  bun /absolute/path/to/OpenPOS/apps/mcp-server/src/cli.ts \
  --db "/path/to/openpos.db" --write
```

**2) Edit settings.json manually:**

```json
{
  "mcpServers": {
    "openpos": {
      "command": "bun",
      "args": ["/absolute/path/to/OpenPOS/apps/mcp-server/src/cli.ts", "--db", "/path/to/openpos.db", "--write"]
    }
  }
}
```

Restart the Gemini CLI session after saving.

### Other MCP clients

Any MCP-compatible client can work as long as it can launch a **stdio** server with the command + args above.

---

## Migration: tool rename (`openpos.*` → `openpos_*`)

> **Breaking change** (introduced in this release): all tool names have changed from dot-notation (`openpos.list_tasks`) to underscore-notation (`openpos_list_tasks`) to comply with MCP client validation rules (e.g. Claude Desktop).

**Old → new mapping:**

| Old name                  | New name                   |
| ------------------------- | -------------------------- |
| `openpos.list_tasks`      | `openpos_list_tasks`       |
| `openpos.list_projects`   | `openpos_list_projects`    |
| `openpos.get_project`     | `openpos_get_project`      |
| `openpos.get_task`        | `openpos_get_task`         |
| `openpos.list_areas`      | `openpos_list_areas`       |
| `openpos.add_task`        | `openpos_add_task`         |
| `openpos.update_task`     | `openpos_update_task`      |
| `openpos.complete_task`   | `openpos_complete_task`    |
| `openpos.delete_task`     | `openpos_delete_task`      |
| `openpos.restore_task`    | `openpos_restore_task`     |
| `openpos.add_project`     | `openpos_add_project`      |
| `openpos.update_project`  | `openpos_update_project`   |
| `openpos.delete_project`  | `openpos_delete_project`   |
| `openpos.add_area`        | `openpos_add_area`         |
| `openpos.update_area`     | `openpos_update_area`      |
| `openpos.delete_area`     | `openpos_delete_area`      |

**Upgrade action:** find and replace `openpos.` with `openpos_` in any MCP client configs, system prompts, scripts, or automations that reference these tool names. No other changes are required.

---

## Tools

- `openpos_list_tasks`
  - Input: `{ status?, projectId?, includeDeleted?, limit?, offset?, search?, dueDateFrom?, dueDateTo?, sortBy?, sortOrder? }`
- `openpos_list_projects`
  - Input: `{}`
- `openpos_get_project`
  - Input: `{ id, includeDeleted? }`
- `openpos_list_sections`
  - Input: `{ projectId?, includeDeleted? }`
- `openpos_get_section`
  - Input: `{ id, includeDeleted? }`
- `openpos_list_areas`
  - Input: `{}`
- `openpos_list_people`
  - Input: `{ includeDeleted? }`
- `openpos_get_person`
  - Input: `{ id, includeDeleted? }`
- `openpos_get_task`
  - Input: `{ id, includeDeleted? }`
- `openpos_add_task` **(requires `--write`)**
  - Input: `{ title? | quickAdd?, status?, projectId?, sectionId?, areaId?, dueDate?, startTime?, reviewAt?, recurrence?, contexts?, tags?, description?, priority?, energyLevel?, assignedTo?, timeEstimate?, taskMode?, relativeStartOffset?, showFutureRecurrence?, pushCount?, checklist?, textDirection?, location?, isFocusedToday?, timeSpentMinutes?, suppressOpenPOSReminders?, repeatReminderMinutes?, attachments? }`
- `openpos_update_task` **(requires `--write`)**
  - Input: `{ id, title?, status?, projectId?, sectionId?, areaId?, dueDate?, startTime?, reviewAt?, recurrence?, contexts?, tags?, description?, priority?, energyLevel?, assignedTo?, timeEstimate?, taskMode?, relativeStartOffset?, showFutureRecurrence?, pushCount?, checklist?, textDirection?, location?, isFocusedToday?, timeSpentMinutes?, suppressOpenPOSReminders?, repeatReminderMinutes?, order?, boardOrder?, focusOrder?, attachments? }`
  - `recurrence` accepts a recurrence object or an RFC 5545 RRULE string. Pass `null` to clear it.
  - `attachments` holds link attachments only (`{ id?, title?, uri }`, e.g. `obsidian://`, `file://` or `https://`). The list you pass is the complete set of links: links you leave out are removed, file attachments are never touched, and `null` clears every link.
- `openpos_complete_task` **(requires `--write`)**
  - Input: `{ id }`
- `openpos_delete_task` **(requires `--write`)**
  - Input: `{ id }`
- `openpos_restore_task` **(requires `--write`)**
  - Input: `{ id }`
- `openpos_add_project` **(requires `--write`)**
  - Input: `{ title, color?, status?, areaId?, isSequential?, isFocused?, dueDate?, reviewAt?, supportNotes?, attachments? }`
- `openpos_update_project` **(requires `--write`)**
  - Input: `{ id, title?, color?, status?, areaId?, isSequential?, isFocused?, dueDate?, reviewAt?, supportNotes?, attachments? }`
  - `attachments` follows the same rule as `openpos_update_task`: link attachments only, the list is the complete set of links, and `null` clears them.
- `openpos_delete_project` **(requires `--write`)**
  - Input: `{ id }`
- `openpos_add_section` **(requires `--write`)**
  - Input: `{ projectId, title, description?, order?, isCollapsed? }`
- `openpos_update_section` **(requires `--write`)**
  - Input: `{ id, title?, description?, order?, isCollapsed? }`
- `openpos_delete_section` **(requires `--write`)**
  - Input: `{ id }`
- `openpos_add_area` **(requires `--write`)**
  - Input: `{ name, color?, icon? }`
- `openpos_update_area` **(requires `--write`)**
  - Input: `{ id, name?, color?, icon? }`
- `openpos_delete_area` **(requires `--write`)**
  - Input: `{ id }`
- `openpos_add_person` **(requires `--write`)**
  - Input: `{ name, note?, referenceLink? }`
- `openpos_update_person` **(requires `--write`)**
  - Input: `{ id, name?, note?, referenceLink? }`
- `openpos_rename_person` **(requires `--write`)**
  - Input: `{ id, name, updateTasks? }`
- `openpos_delete_person` **(requires `--write`)**
  - Input: `{ id }`

All tools return JSON text payloads with the resulting task, project, section, area, person, or collection payload.

---

## Testing

### Quick smoke test (CLI)

1) Start the server (read‑only):
```bash
bun run openpos:mcp -- --db "~/.local/share/openpos/openpos.db"
```

2) Connect via your MCP client and run:
- `openpos_list_tasks` (limit 5)

If you want to test writes, restart with `--write`:
```bash
bun run openpos:mcp -- --db "~/.local/share/openpos/openpos.db" --write
```

Then test:
- `openpos_add_task` (quickAdd: "Test task @home /due:tomorrow")
- `openpos_complete_task` (use returned task id)
- `openpos_update_task` (e.g. set status or dueDate)
- `openpos_delete_task` (use returned task id)
- `openpos_get_task` (use returned task id)
- `openpos_restore_task` (after delete, restore the task)
- `openpos_list_projects`
- `openpos_get_project` (use returned project id)
- `openpos_list_areas`
- `openpos_list_people`
- `openpos_add_project`
- `openpos_update_project`
- `openpos_delete_project`
- `openpos_add_area`
- `openpos_update_area`
- `openpos_delete_area`
- `openpos_add_person`
- `openpos_update_person`
- `openpos_rename_person`
- `openpos_get_person` (use returned person id)
- `openpos_delete_person`
- `openpos_list_tasks` with `dueDateFrom`, `dueDateTo`, `sortBy`, `sortOrder`

If the list returns tasks and add/complete works, the server is healthy.

### Stdio JSON-RPC E2E (transport validation)

Use any MCP client or a small script to send:
- `initialize`
- `notifications/initialized`
- `tools/list`
- `tools/call` (e.g. `openpos_list_projects` or `openpos_list_tasks`)

If these succeed, the stdio transport is working end-to-end.

### Claude Code sanity check

1) Add the server:
```bash
claude mcp add openpos -- \
  bun /path/to/OpenPOS/apps/mcp-server/src/cli.ts --db "/path/to/openpos.db" --write
```
2) Restart Claude Code, run `/mcp`, and verify **openpos** is connected.
3) Ask the model to call:
   - `openpos_list_tasks` (limit 5)
   - `openpos_add_task` (quickAdd: "Test MCP @home /due:tomorrow")
   - `openpos_complete_task` (use returned id)

---

## Safety & Concurrency

- The server uses **SQLite WAL mode**. Read-only tools can run while the desktop app is open.
- Write tools fail fast on SQLite writer locks, then retry the whole OpenPOS write operation. Each retry reloads current data before applying the requested change, so a delayed MCP write does not keep working from a stale pre-lock snapshot.
- Writes are **disabled by default**. Use `--write` to enable edits.
- Write operations go through the shared **@openpos/core** store to enforce business rules (both Bun and Node).
- SQL is reserved for read-heavy paths (list/search) where performance matters.
- Do not point a separate container/server deployment at the same local storage or sync data while the desktop app is also writing. That creates independent writers outside the local SQLite coordination path and is unsupported.

---

## Notes

- This MCP server targets the SQLite database used by the desktop app, with mutations routed through `@openpos/core`.
- Keep an eye on schema changes across app versions (update queries if needed).
