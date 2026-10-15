# Auto Model

Auto-picks the smallest model that fits each prompt. Two parts: a **Claude Code mod** (below) and a **Codex CLI** wrapper and hook ([jump to Codex](#codex)).

## Claude Code

A Claude Code mod that reads each prompt and switches to the smallest Claude model that can handle it, so simple questions don't burn through your plan.

## How it works

On every prompt you type, a local heuristic (no API call, no tokens) picks a tier:

| Tier | Typical prompts |
| --- | --- |
| **Haiku** | Short factual questions, "explain X", very short prompts |
| **Sonnet** | Ordinary coding and editing work (default) |
| **Opus** | Long or code-heavy prompts with hard-task keywords (architecture, refactor, debug, migrate…), or very long prompts |

Guardrails to avoid thrashing the prompt cache:
- Upgrades happen immediately; downgrades only after 2 lower-tier prompts in a row.
- Short follow-ups ("yes", "continue", "go ahead") keep the current model.
- Slash commands and non-typed prompts (notifications, other plugins) never trigger a switch.

## Commands

| Command | Does |
| --- | --- |
| `/automodel` | Toggle on/off |
| `/automodel on` / `off` | Enable / disable |
| `/automodel status` | Settings and the last decision |
| `/automodel why` | Why the last prompt got its model |
| `/automodel stats` | Prompts routed per model, switch count |
| `/automodel pin <tier>` / `unpin` | Always use one model |
| `/automodel floor <tier>` | Never go below this tier |
| `/automodel max <tier>` | Never go above this tier |
| `/automodel reset` | Clear settings and stats |

Prefix a prompt with `@haiku`, `@sonnet` or `@opus` to force a model for that one prompt (the prefix is stripped).

Settings and stats persist across sessions.

## Install

```
/plugin marketplace add jitenruparelia-rgb/auto-model
/plugin install auto-model --marketplace jitenruparelia-rgb/auto-model
```

Or for development: `claude --plugin-dir /path/to/auto-model`.

## Tuning

The routing rules live in [`hooks/decide.ts`](hooks/decide.ts). Tests: `claude plugin test .`

## Codex

Codex hooks can add context or block a prompt but cannot change the model, so a Codex port works in two ways. Both use the same routing rules as the Claude mod (`hooks/decide.ts`). Requires Node >= 22.18.

### `codex-auto` wrapper (actually switches the model)

Classifies your prompt, then runs `codex -m <model> ...`:

```
node codex/bin/codex-auto.mjs "what does git rebase do?"
node codex/bin/codex-auto.mjs exec "refactor the auth module"
node codex/bin/codex-auto.mjs --dry-run exec "what is a mutex?"   # show the choice, don't run
```

Alias it, e.g. `alias codex='node /path/to/auto-model/codex/bin/codex-auto.mjs'`, or `npm link` for a `codex-auto` command. It leaves Codex alone when you pass `-m`, or start interactively with no prompt. Prefix a prompt with `@fast`, `@mid` or `@max` to force a tier (the prefix is stripped). `--why` prints its decision. It chooses the model when Codex starts, so it cannot switch mid-session.

### `UserPromptSubmit` hook (nudges, inside a session)

Tells you when `/model <other>` would suit the prompt better. Add it to `~/.codex/hooks.json` (see [`codex/hooks.example.json`](codex/hooks.example.json); use the absolute path), then review and trust it with `/hooks` in Codex.

### Configuration

Optional `~/.config/auto-model/codex.json` (or the file named by `AUTO_MODEL_CONFIG`):

```json
{
  "models": { "haiku": "gpt-6-luna", "sonnet": "gpt-6.1-sol", "opus": "gpt-6-astra" },
  "pin": null,
  "floor": "haiku",
  "ceiling": "opus",
  "enabled": true
}
```

`AUTO_MODEL_DISABLE=1` turns it off. The defaults are the model ids on the [Codex models page](https://learn.chatgpt.com/docs/models) at the time of writing; change them if yours differ.

Tests: `npm test`.

## License

MIT
