import { test } from 'node:test'
import assert from 'node:assert/strict'
import { plan, parseArgs } from './bin/codex-auto.mjs'
import { nudge } from './hooks/user-prompt-submit.mjs'
import { DEFAULT_MODELS } from './lib.mjs'

const config = { models: DEFAULT_MODELS, settings: { enabled: true, pin: null, floor: 'haiku', ceiling: 'opus' } }

test('simple question gets the small model', () => {
  const r = plan(['what does git rebase do?'], config)
  assert.deepEqual(r.args, ['-m', 'gpt-6-luna', 'what does git rebase do?'])
})
test('exec keeps the subcommand and routes its prompt', () => {
  const r = plan(['exec', '--full-auto', 'add a loading spinner to the login button and update the styles accordingly'], config)
  assert.equal(r.model, 'gpt-6.1-sol')
  assert.deepEqual(r.args.slice(0, 3), ['exec', '-m', 'gpt-6.1-sol'])
})
test('flag values are not mistaken for the prompt', () => {
  const p = parseArgs(['-C', '/tmp/x', 'exec', 'hello there'])
  assert.equal(p.args[p.promptIndex], 'hello there')
})
test('-m from the user is respected', () => {
  const r = plan(['-m', 'gpt-6-astra', 'hi'], config)
  assert.equal(r.model, null)
  assert.deepEqual(r.args, ['-m', 'gpt-6-astra', 'hi'])
})
test('@max override is honored and stripped', () => {
  const r = plan(['@max what is 2+2?'], config)
  assert.equal(r.model, 'gpt-6-astra')
  assert.equal(r.args[2], 'what is 2+2?')
})
test('no prompt (interactive start) leaves codex alone', () => {
  assert.equal(plan([], config).model, null)
})
test('wrapper flags are stripped', () => {
  const r = plan(['--dry-run', 'hi'], config)
  assert.ok(r.dryRun)
  assert.ok(!r.args.includes('--dry-run'))
})
test('hook nudges toward a smaller model, once', () => {
  const input = { model: 'gpt-6-astra', prompt: 'what does git rebase do?' }
  const n = nudge(input, config, null)
  assert.equal(n.tier, 'haiku')
  assert.match(n.message, /\/model gpt-6-luna/)
  assert.equal(nudge(input, config, 'haiku'), null)
})
test('hook is silent when the model already fits or is unknown', () => {
  assert.equal(nudge({ model: 'gpt-6-luna', prompt: 'what does git rebase do?' }, config, null), null)
  assert.equal(nudge({ model: 'something-else', prompt: 'hi' }, config, null), null)
})
