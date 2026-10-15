import type { Register } from 'claude-code'
import { DEFAULTS, DOWNGRADE_AFTER, TIERS, decide, rank } from './decide'
import type { Settings, Tier } from './decide'

type Stats = { haiku: number; sonnet: number; opus: number; switches: number }
type Last = { tier: Tier; reason: string; prompt: string }
const NO_STATS: Stats = { haiku: 0, sonnet: 0, opus: 0, switches: 0 }

const isTier = (s: string | undefined): s is Tier => TIERS.includes(s as Tier)
const tierOf = (model: string): Tier | null => TIERS.find(t => model.toLowerCase().includes(t)) ?? null

const HELP = `Auto Model: picks haiku / sonnet / opus per prompt.
  /automodel              toggle on/off
  /automodel on|off       enable / disable
  /automodel status       settings and what it last decided
  /automodel why          why the last prompt got its model
  /automodel stats        prompts routed per model
  /automodel pin <tier>   always use haiku|sonnet|opus   (/automodel unpin)
  /automodel floor <tier> never go below this tier
  /automodel max <tier>   never go above this tier
  /automodel reset        clear settings and stats
Prefix a prompt with @haiku, @sonnet or @opus to force one for that prompt.`

export const register: Register = on => {
  const load = async ($: any): Promise<Settings> => ({ ...DEFAULTS, ...((await $.store.get('settings')) as object | undefined) })
  const save = ($: any, s: Settings) => $.store.set('settings', s)

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'automodel',
      description: 'Toggle Auto Model, or pin / limit the models it picks',
      argumentHint: '[on|off|status|why|stats|pin <tier>|unpin|floor <tier>|max <tier>|reset]',
      immediate: true,
    })
    return next(e)
  })

  on('command.run', { command: 'automodel' }, async ($, e) => {
    const [cmd = '', arg] = e.args.trim().toLowerCase().split(/\s+/)
    const s = await load($)
    const say = (text: string) => ({ text })

    switch (cmd) {
      case '':
        s.enabled = !s.enabled
        await save($, s)
        $.ui.status(s.enabled ? undefined : 'auto-model off')
        return say(`Auto Model ${s.enabled ? 'on' : 'off'}.`)
      case 'on':
      case 'off':
        s.enabled = cmd === 'on'
        await save($, s)
        $.ui.status(s.enabled ? undefined : 'auto-model off')
        return say(`Auto Model ${cmd}.`)
      case 'pin':
      case 'floor':
      case 'max': {
        if (!isTier(arg)) return say(`Usage: /automodel ${cmd} <haiku|sonnet|opus>`)
        if (cmd === 'pin') s.pin = arg
        else if (cmd === 'floor') s.floor = arg
        else s.ceiling = arg
        if (rank(s.floor) > rank(s.ceiling)) return say('Floor cannot be above max.')
        await save($, s)
        return say(cmd === 'pin' ? `Pinned to ${arg}.` : `${cmd} set to ${arg}.`)
      }
      case 'unpin':
        s.pin = null
        await save($, s)
        return say('Unpinned.')
      case 'status': {
        const last = (await $.store.get('last')) as Last | undefined
        return say(
          `Auto Model ${s.enabled ? 'on' : 'off'} · pin: ${s.pin ?? 'none'} · range: ${s.floor}–${s.ceiling}` +
            (last ? `\nLast: ${last.tier} (${last.reason})` : ''),
        )
      }
      case 'why': {
        const last = (await $.store.get('last')) as Last | undefined
        return say(last ? `"${last.prompt}" → ${last.tier}: ${last.reason}` : 'Nothing routed yet.')
      }
      case 'stats': {
        const st = { ...NO_STATS, ...((await $.store.get('stats')) as object | undefined) }
        const total = st.haiku + st.sonnet + st.opus
        const pct = (n: number) => (total ? Math.round((100 * n) / total) : 0)
        return say(
          `Routed ${total} prompts: haiku ${st.haiku} (${pct(st.haiku)}%), sonnet ${st.sonnet} (${pct(st.sonnet)}%), opus ${st.opus} (${pct(st.opus)}%) · ${st.switches} model switches`,
        )
      }
      case 'reset':
        await $.store.delete('settings')
        await $.store.delete('stats')
        await $.store.delete('last')
        await $.store.delete('lowStreak')
        return say('Auto Model settings and stats cleared.')
      default:
        return say(HELP)
    }
  })

  on('prompt.submit', async ($, e, next) => {
    // Only the person's own prompts pick a model; slash commands pass through.
    if ((e.origin.kind !== 'composer' && e.origin.kind !== 'bridge') || e.text.trim().startsWith('/')) return next(e)
    const s = await load($)
    if (!s.enabled) return next(e)

    const current = tierOf(await $.session.model())
    const d = decide(e.text, s, current)

    let target = d.tier
    let streak = Number((await $.store.get('lowStreak')) ?? 0)
    const isOverride = d.reason.endsWith('override') || d.reason === 'pinned'
    if (current && !isOverride && rank(target) < rank(current)) {
      streak += 1
      if (streak < DOWNGRADE_AFTER) target = current // hold; don't thrash the cache
    } else {
      streak = 0
    }
    await $.store.set('lowStreak', streak >= DOWNGRADE_AFTER ? 0 : streak)

    let switched = false
    if (target !== current) {
      const r = await $.config.set({ key: 'model', value: target })
      switched = r.deny === undefined
      if (!switched) $.ui.status(`auto-model: could not switch (${r.deny.slice(0, 60)})`)
    }
    if (target === current || switched) $.ui.status(`auto-model: ${target}${switched ? ' ↻' : ''}`)

    const st = { ...NO_STATS, ...((await $.store.get('stats')) as object | undefined) } as Stats
    st[target] += 1
    if (switched) st.switches += 1
    await $.store.set('stats', st)
    await $.store.set('last', { tier: target, reason: d.reason, prompt: d.text.trim().slice(0, 60) } satisfies Last)

    return next(d.text === e.text ? e : { ...e, text: d.text })
  }).catch(($, e, next) => next(e))
}
