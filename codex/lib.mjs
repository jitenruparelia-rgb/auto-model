// Shared by the Codex wrapper and hook. The routing rules are the Claude mod's
// own (hooks/decide.ts), imported as-is: Node >= 22.18 strips the types.
import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { DEFAULTS, TIERS, decide, rank } from '../hooks/decide.ts'

export { TIERS, rank, decide }

/** Tier -> Codex model id. Override in ~/.config/auto-model/codex.json. */
export const DEFAULT_MODELS = {
  haiku: 'gpt-6-luna',
  sonnet: 'gpt-6.1-sol',
  opus: 'gpt-6-astra',
}

export function configPath(env = process.env) {
  return env.AUTO_MODEL_CONFIG ?? join(env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'auto-model', 'codex.json')
}

/** { models, floor, ceiling, pin, enabled } with defaults filled in. */
export function loadConfig(env = process.env) {
  const path = configPath(env)
  let user = {}
  if (existsSync(path)) {
    try {
      user = JSON.parse(readFileSync(path, 'utf8'))
    } catch (err) {
      process.stderr.write(`auto-model: ignoring unreadable ${path}: ${err.message}\n`)
    }
  }
  const pick = (v, fallback) => (TIERS.includes(v) ? v : fallback)
  return {
    models: { ...DEFAULT_MODELS, ...(user.models ?? {}) },
    settings: {
      ...DEFAULTS,
      enabled: user.enabled !== false && env.AUTO_MODEL_DISABLE !== '1',
      pin: pick(user.pin, null),
      floor: pick(user.floor, DEFAULTS.floor),
      ceiling: pick(user.ceiling, DEFAULTS.ceiling),
    },
  }
}

/** Which tier a model id belongs to, or null if it is not one of ours. */
export function tierOfModel(model, models) {
  if (!model) return null
  return TIERS.find(t => models[t] === model) ?? null
}
