#!/usr/bin/env node
// Codex UserPromptSubmit hook. Codex hooks cannot change the model, so this
// only nudges: it tells you when /model <other> would suit the prompt better.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig, decide, rank, tierOfModel } from '../lib.mjs'

/** The nudge for a prompt, or null. `lastNudged` is the tier already suggested this session. */
export function nudge(input, config, lastNudged) {
  if (!config.settings.enabled) return null
  const current = tierOfModel(input.model, config.models)
  if (!current) return null // a model we don't map: say nothing
  const d = decide(input.prompt ?? '', config.settings, current)
  if (d.tier === current || d.tier === lastNudged) return null
  const direction = rank(d.tier) < rank(current) ? 'a smaller model would do' : 'a bigger model may help'
  return { tier: d.tier, message: `auto-model: ${direction}. /model ${config.models[d.tier]}  (${d.reason})` }
}

function main() {
  let input
  try {
    input = JSON.parse(readFileSync(0, 'utf8'))
  } catch {
    return // never block a prompt on a parse problem
  }
  const stateFile = join(tmpdir(), `auto-model-${String(input.session_id ?? 'x').replace(/[^\w-]/g, '')}.json`)
  let last = null
  try {
    last = JSON.parse(readFileSync(stateFile, 'utf8')).tier
  } catch {}

  const n = nudge(input, loadConfig(), last)
  if (!n) return
  try {
    mkdirSync(tmpdir(), { recursive: true })
    writeFileSync(stateFile, JSON.stringify({ tier: n.tier }))
  } catch {}
  process.stdout.write(JSON.stringify({ systemMessage: n.message }) + '\n')
}

import { fileURLToPath } from 'node:url'
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
