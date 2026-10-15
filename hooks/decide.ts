export type Tier = 'haiku' | 'sonnet' | 'opus'
export const TIERS: readonly Tier[] = ['haiku', 'sonnet', 'opus']
export const rank = (t: Tier): number => TIERS.indexOf(t)

export type Settings = {
  enabled: boolean
  /** Always use this tier, ignoring the prompt. */
  pin: Tier | null
  /** Never go below / above these. */
  floor: Tier
  ceiling: Tier
}
export const DEFAULTS: Settings = { enabled: true, pin: null, floor: 'haiku', ceiling: 'opus' }

export type Decision = { tier: Tier; reason: string; text: string }

const HARD =
  /\b(architect(ure)?|design (a|the) system|refactor|migrat(e|ion)|debug|root cause|race condition|deadlock|security (review|audit)|performance|optimi[sz]e|prove|algorithm|trade-?offs?|from scratch|end-to-end|across (the )?(codebase|repo)|implement (a|an|the) \w+|rewrite|concurrency|distributed)\b/i
const EASY =
  /^(what|who|when|where|why|how (do|does|to)|explain|define|summari[sz]e|translate|rename|fix (the )?typo|list|show|tell me|is |are |can you (tell|show|explain))\b/i
const FOLLOW_UP = /^(yes|yep|yeah|no|ok(ay)?|sure|thanks?|thank you|go( ahead| on)?|continue|do it|proceed|lgtm|looks good|y|n)\b[\s.!]*$/i
const ALIASES: Record<string, Tier> = { haiku: 'haiku', sonnet: 'sonnet', opus: 'opus', fast: 'haiku', mid: 'sonnet', max: 'opus' }
const OVERRIDE = /^@(haiku|sonnet|opus|fast|mid|max)\b\s*/i
const CODE_FENCE = /```/

/** Cheap local heuristic: no tokens spent deciding. */
export function classify(text: string): { tier: Tier; reason: string } {
  const t = text.trim()
  const words = t.split(/\s+/).filter(Boolean).length
  const hard = HARD.test(t)
  const code = CODE_FENCE.test(t)
  if (hard && (words > 40 || code)) return { tier: 'opus', reason: 'long or code-heavy hard task' }
  if (words > 250) return { tier: 'opus', reason: 'very long prompt' }
  if (hard) return { tier: 'sonnet', reason: 'hard-task keywords, short prompt' }
  if (words <= 25 && !code && EASY.test(t)) return { tier: 'haiku', reason: 'short factual question' }
  if (words <= 8 && !code) return { tier: 'haiku', reason: 'very short prompt' }
  return { tier: 'sonnet', reason: 'ordinary work' }
}

const clamp = (t: Tier, s: Settings): Tier =>
  TIERS[Math.min(rank(s.ceiling), Math.max(rank(s.floor), rank(t)))]!

/**
 * Picks the tier for a prompt. `current` is the tier now in use (null if the
 * session is on a model outside the three tiers).
 */
export function decide(text: string, s: Settings, current: Tier | null): Decision {
  const m = OVERRIDE.exec(text)
  if (m) {
    const name = m[1]!.toLowerCase()
    return { tier: ALIASES[name]!, reason: `@${name} override`, text: text.slice(m[0].length) }
  }
  if (s.pin) return { tier: s.pin, reason: 'pinned', text }
  if (current && FOLLOW_UP.test(text.trim()))
    return { tier: clamp(current, s), reason: 'follow-up, keeping model', text }
  const c = classify(text)
  return { tier: clamp(c.tier, s), reason: c.reason, text }
}

/** Switching models re-reads the context uncached: upgrade at once, downgrade after 2 lower prompts in a row. */
export const DOWNGRADE_AFTER = 2
