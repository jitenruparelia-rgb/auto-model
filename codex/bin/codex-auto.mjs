#!/usr/bin/env node
// codex-auto: pick the Codex model for a prompt, then run `codex` with it.
//   codex-auto "what does git rebase do?"         -> codex -m <small model> "..."
//   codex-auto exec "refactor the auth module"    -> codex exec -m <big model> "..."
// Wrapper-only flags (stripped before codex sees them): --dry-run, --why.
import { spawn } from 'node:child_process'
import { loadConfig, decide } from '../lib.mjs'

// Codex flags that take a value, so their value is not mistaken for the prompt.
const VALUE_FLAGS = new Set(['-m', '--model', '-c', '--config', '-p', '--profile', '-s', '--sandbox', '-a', '--ask-for-approval', '-C', '--cd', '-i', '--image', '--color', '-o', '--output-last-message', '--output-schema'])
const SUBCOMMANDS = new Set(['exec', 'e', 'resume', 'review', 'login', 'logout', 'mcp', 'apply', 'cloud', 'completion', 'features'])

/**
 * Splits argv into the wrapper's flags, the codex args, and where the prompt is.
 * Returns { args, promptIndex, hasModel, dryRun, why }.
 */
export function parseArgs(argv) {
  const args = []
  let dryRun = false
  let why = false
  for (const a of argv) {
    if (a === '--dry-run') dryRun = true
    else if (a === '--why') why = true
    else args.push(a)
  }

  let hasModel = false
  let promptIndex = -1
  let seenSub = false
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--') {
      if (i + 1 < args.length) promptIndex = i + 1
      break
    }
    if (a === '-m' || a === '--model' || a.startsWith('--model=')) hasModel = true
    if (a.startsWith('-')) {
      if (VALUE_FLAGS.has(a)) i++
      continue
    }
    if (!seenSub && SUBCOMMANDS.has(a)) {
      seenSub = true
      continue
    }
    promptIndex = i // the last positional is the prompt
  }
  // `exec resume <id> <prompt>` and friends are not worth guessing at.
  if (args[0] === 'resume' || args[0] === 'login' || args[0] === 'logout' || args[0] === 'mcp') promptIndex = -1
  return { args, promptIndex, hasModel, dryRun, why }
}

/** What to run: { args, tier, model, reason } (model null when we leave codex alone). */
export function plan(argv, config) {
  const p = parseArgs(argv)
  const none = { args: p.args, tier: null, model: null, reason: '', ...p }
  if (!config.settings.enabled) return { ...none, reason: 'disabled' }
  if (p.hasModel) return { ...none, reason: 'you passed -m; leaving it alone' }
  if (p.promptIndex < 0) return { ...none, reason: 'no prompt to classify' }

  const d = decide(p.args[p.promptIndex], config.settings, null)
  const args = [...p.args]
  args[p.promptIndex] = d.text // @fast / @mid / @max prefix stripped
  const model = config.models[d.tier]
  return { ...p, args: ['-m', model, ...args], tier: d.tier, model, reason: d.reason }
}

function main() {
  const config = loadConfig()
  const r = plan(process.argv.slice(2), config)
  const note = r.model ? `auto-model: ${r.model} (${r.tier}: ${r.reason})` : `auto-model: default model (${r.reason})`
  if (r.why || r.dryRun) process.stderr.write(note + '\n')
  if (r.dryRun) {
    process.stderr.write(`codex ${r.args.map(a => JSON.stringify(a)).join(' ')}\n`)
    return
  }
  const child = spawn('codex', r.args, { stdio: 'inherit' })
  child.on('error', err => {
    process.stderr.write(`auto-model: could not run codex: ${err.message}\n`)
    process.exit(127)
  })
  child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)))
}

// Run only when executed, not when imported by the tests.
import { fileURLToPath } from 'node:url'
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
