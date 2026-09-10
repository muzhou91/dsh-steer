# dsh-steer

A one-click **⏩ Steer button** for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH).

While the agent is running, a ⏩ button appears at the right end of the composer (`conversation.input.right` slot). Type guidance and click it to **steer the current turn** — inject your message into the run that is already in flight instead of waiting for it to finish or queueing behind it.

> Personal, independent plugin practice on the DSH v0.1 developer preview. Built **with dsh itself** (vibe-coded by a product manager learning the harness from inside). Not merged into `deepseek-ai/deepseek-harness`; targets preview APIs that may change.

## Why

Long agent runs are expensive and *sticky*: once the model commits to a wrong plan, it can spend minutes and many tokens before you can say anything. The usual options are both bad — wait and pay, or stop and lose context.

DSH's input layer already understands two **delivery modes** — `queue` (default) and `steer` — but early previews (I started on `0.1.2-rc.1`) only exposed `queue` in the UI. dsh-steer surfaces the hidden `steer` mode as a single button, and answers two questions I cared about:

1. What is the minimal contract a Cordis client plugin needs to mount into the composer and unload cleanly?
2. How can a user intervene **during** a run instead of watching it burn tokens down the wrong path?

## What "steer" actually does (semantics)

Be precise about the guarantees — they come from DSH core, not from this plugin:

- Steer is **best-effort**. The Host/Agent owns the delivery window. Your message is injected into the running turn **only when the session is in a steerable (`continuable`) state**.
- If the steer window is closed, DSH core converts the message into the **next waking queue item** rather than dropping it (error code `session/steer-unavailable` / `session/queue-item-not-found` may surface for per-queue steering).
- Steer does **not** roll back what the agent already did — it merges your instruction with the live trajectory at the next decision point so the model re-plans in place. It is human-in-the-loop course correction, not undo.

## Relationship to DSH's built-in steering

DSH evolved fast: by `0.1.5-rc.1`, core ships its own steering UX — a busy-Enter preference (`Queue` vs `Steer` in Settings), the `Cmd/Ctrl+Enter` accelerated chord, and per-row **Steer / 插话发送** buttons in the queue dock. The patch in this repo **still applies cleanly on 0.1.5-rc.1** (the input-shell wrapper and the composer slot are unchanged).

| Path | Gesture | Discoverability |
| --- | --- | --- |
| DSH built-in | Settings + `Cmd/Ctrl+Enter`, or per-row buttons in the queue dock | Hidden behind a setting / chord |
| **dsh-steer** | A single always-visible ⏩ in the composer | One click, zero configuration |

In other words: I first built this because the steer delivery mode existed in protocol but had no composer entry point; upstream later validated the problem with its own UX. This plugin remains the dedicated, one-click surface (and a worked example of patching + slot-injecting a DSH client plugin).

## Requirements

- DeepSeek Harness web UI (`dsh web`) — developed against `0.1.2-rc.1`, verified to patch on `0.1.5-rc.1`.
- Node.js ≥ 20 (only needed to run the one-time patch script).

## How it works

Two small pieces:

1. **A one-time core patch** (`scripts/patch-submit-steer.mjs`). The stock input shell only exposes `inputActions.submit()` (which hardcodes `submit("queue")`). The patch adds a sibling action `inputActions.submitSteer()` that calls the existing-but-unreachable `submit("steer")`. It does **not** change any model or agent-loop behavior — it only wires an existing mode to the UI.
   > Note: by design this edits an installed DSH **core bundle** (the capability isn't reachable from a plugin alone). A DSH upgrade overwrites that bundle — just re-run the patch.
2. **A client plugin** (`lib/client.js`) that registers the ⏩ control into the `conversation.input.right` seat and shows it only while a session is running. `lib/index.js` is the intentionally inert host half that gives the Cordis loader a plugin row to mount so the browser bundle is served.

## Install

### 1) Patch the core (one time)

```bash
npm run install:dsh
# or:  node scripts/patch-submit-steer.mjs
```

The script auto-discovers your `@deepseek-ai/dsh-client-ui-conversation/lib/client.js` bundle (npm npx cache preferred when it also hosts `dsh-web-app`, then walking up from the current directory). Discovery overrides:

```bash
# explicit path
node scripts/patch-submit-steer.mjs /abs/path/to/dsh-client-ui-conversation/lib/client.js
# or environment variable
DSH_CONVERSATION_BUNDLE=/abs/path/to/client.js node scripts/patch-submit-steer.mjs
```

The patch is **idempotent** — re-running is a no-op once `submitSteer` is present. Then **hard-refresh** the web app (`Cmd+Shift+R`); no server restart is needed because client bundles are served live.

### 2) Mount the plugin

**Option A — always-mounted (survives restarts; recommended).** Copy the package into your web profile and add a loader row. Default profile path is `$DSH_HOME/profiles/web` (usually `~/.dsh/profiles/web`):

```bash
cp -r dsh-steer ~/.dsh/profiles/web/node_modules/dsh-steer
```

Append to `~/.dsh/profiles/web/cordis.patch.yml`:

```yaml
- insert:
    - id: dsh-steer
      name: dsh-steer
```

Restart the DSH server once (loader rows load at boot), then refresh.

**Option B — dynamic plugin (per-session).** Feed `lib/client.js` through DSH's dynamic-plugin flow (the `cordis_define` tool / in-session plugin UI). Dynamic plugins are in-memory and vanish on server restart.

### After upgrading DSH

Upgrades restore the stock core bundle, so: re-run `npm run install:dsh` and hard-refresh. Option A's loader row survives; only the patch needs replaying.

## Uninstall

- **Plugin:** remove the `dsh-steer` row from `cordis.patch.yml` and delete `node_modules/dsh-steer` (or undefine the dynamic plugin).
- **Core patch:** delete the `submitSteer` entry from the `actions` object in `dsh-client-ui-conversation/lib/client.js`, or re-run your DSH installer to restore the stock bundle.

## FAQ

- **Does it depend on the model/provider?** No — steering is a session-transport behavior; it works with any model the harness runs.
- **What happens mid-tool-call?** Delivery is decided by core at its next window; the message isn't injected inside a running tool execution.
- **What about an empty draft?** Core ignores an empty, attachment-less submit; the button is only shown while a run is active.
- **Why patch core instead of a pure plugin?** The `steer` delivery mode existed in `submit(mode)` but no input action reached it; a slot plugin alone cannot add that action.

## Known limitations & roadmap

- [ ] Optional draft guard + tooltip explaining why steer is unavailable when the session isn't continuable.
- [ ] "Steer all queued messages" action — core already supports per-queue `{ kind: "steer" }` updates (the empty-draft accelerated gesture); expose it in the UI.
- [ ] Auto-backup the bundle (`.bak`) on first patch + an `uninstall:dsh` script.
- [ ] **Fork-based steering:** branch the append-only Trajectory at the injection point so the original vs steered paths can both be replayed.
- [ ] Compatibility matrix as DSH preview versions move.

## Development

| File | Role |
| --- | --- |
| `lib/client.js` | Browser half: ⏩ button, CSS, `conversation.input.right` registration |
| `lib/index.js` | Host half: inert plugin row for the Cordis loader |
| `scripts/patch-submit-steer.mjs` | Version-tolerant, idempotent core patch |

## Design notes & further reading

- Write-up: *Steering an Agent Mid-Run* (design space: abort / queue / in-place inject / trajectory fork) — `【link to your post】`
- DSH repo: https://github.com/deepseek-ai/deepseek-harness (Cordis microkernel, append-only Trajectory)
- Community discussion on harness-level feedback/memory: Discussion #3426

Issues and design feedback welcome — especially on mid-run steering semantics across harnesses.

## License

[MIT](LICENSE)
