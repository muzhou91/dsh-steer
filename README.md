# dsh-steer

A **steer button** for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH).

While the agent is running, a **⏩ button** appears at the right end of the composer. Type a message and click it to **inject the message into the current turn** ("steer") instead of queuing it for after the turn — handy for adding guidance mid-task without waiting or interrupting.

## Requirements

- DeepSeek Harness web UI (`dsh web`), any recent version (tested on `0.1.2-rc.1`).
- Node.js ≥ 20 to run the one-time patch script.

## How it works

Two small pieces:

1. **A one-time core patch** — the stock input shell only exposes `inputActions.submit()`, which always queues. The patch adds `inputActions.submitSteer()` (which calls `submit("steer")` — an existing but previously unreachable delivery mode that interrupts the running turn).
2. **A client plugin** — registers the ⏩ control into the composer's `conversation.input.right` seat. It appears only while a session is running.

## Install

### 1) Patch the core (one time)

From this repo:

```bash
npm run install:dsh
# or:  node scripts/patch-submit-steer.mjs
```

The script auto-finds your `dsh-client-ui-conversation` bundle (npm npx caches / walking up from cwd). If it can't, pass the path:

```bash
node scripts/patch-submit-steer.mjs /abs/path/to/dsh-client-ui-conversation/lib/client.js
```

It's **idempotent** — running it again is a no-op. After patching, **hard-refresh the web app** (`Cmd+Shift+R`); no server restart is needed (client bundles are served live).

### 2) Mount the plugin

**Option A — always-mounted (survives restarts/rebuilds; recommended):**

Add the package to your DSH web profile and insert it into the loader. With a profile at `~/.dsh/profiles/web`:

```bash
# copy the package into the profile so the loader can resolve it
cp -r dsh-steer ~/.dsh/profiles/web/node_modules/dsh-steer
```

Then append to `~/.dsh/profiles/web/cordis.patch.yml`:

```yaml
- insert:
    - id: dsh-steer
      name: dsh-steer
```

Restart the DSH server once (loader rows load at boot), then refresh.

**Option B — dynamic plugin (per-session):**

Use the plugin code in `lib/client.js` through DSH's dynamic-plugin flow (e.g. the `cordis_define` tool / plugin UI in a session). Note: dynamic plugins are in-memory and are lost on server restart — you'll re-run them after each restart.

## Uninstall

- **Plugin:** remove the `dsh-steer` row from `cordis.patch.yml` (and delete `node_modules/dsh-steer`) — or stop/undefine the dynamic plugin.
- **Core patch:** remove the `submitSteer` entry from the `actions` object in `dsh-client-ui-conversation/lib/client.js` (or re-run your DSH installer to restore the stock bundle).

## Development

- `lib/client.js` — the browser-half plugin (button + registration).
- `scripts/patch-submit-steer.mjs` — the version-tolerant core patch.

The button intentionally renders **only while a session is running**; clicking with an empty draft is a no-op (there's nothing to steer).

## License

[MIT](LICENSE)
