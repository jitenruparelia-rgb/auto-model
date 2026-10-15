import { test, expect } from 'claude-code/testing'
import { DEFAULTS, decide } from './decide'

const d = (text: string, s = DEFAULTS, cur: 'haiku' | 'sonnet' | 'opus' | null = 'sonnet') => decide(text, s, cur)

test('simple questions go to haiku', () => {
  expect(d('what does git rebase do?').tier).toBe('haiku')
})
test('ordinary work goes to sonnet', () => {
  expect(d('add a loading spinner to the login button and update the styles accordingly').tier).toBe('sonnet')
})
test('big design work goes to opus', () => {
  expect(d('Design a system for ' + 'distributed rate limiting with trade-offs and failure modes '.repeat(6)).tier).toBe('opus')
})
test('@prefix overrides and is stripped', () => {
  const r = d('@opus what is 2+2?')
  expect(r.tier).toBe('opus')
  expect(r.text).toBe('what is 2+2?')
})
test('pin wins', () => {
  expect(d('what is 2+2?', { ...DEFAULTS, pin: 'opus' }).tier).toBe('opus')
})
test('floor and ceiling clamp', () => {
  expect(d('what is 2+2?', { ...DEFAULTS, floor: 'sonnet' }).tier).toBe('sonnet')
  expect(d('Design a system for ' + 'x '.repeat(60) + 'refactor', { ...DEFAULTS, ceiling: 'sonnet' }).tier).toBe('sonnet')
})
test('short follow-ups keep the current model', () => {
  expect(d('yes, go ahead', DEFAULTS, 'opus').tier).toBe('opus')
  expect(d('continue', DEFAULTS, 'opus').tier).toBe('opus')
})
