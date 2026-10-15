# Auto Model

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
/plugin marketplace add <owner>/auto-model
/plugin install auto-model --marketplace <owner>/auto-model
```

Or for development: `claude --plugin-dir /path/to/auto-model`.

## Tuning

The routing rules live in [`hooks/decide.ts`](hooks/decide.ts). Tests: `claude plugin test .`

## License

MIT
