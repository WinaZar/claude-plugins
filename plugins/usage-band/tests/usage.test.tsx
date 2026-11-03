import { expect, mock, test } from 'claude-code/testing'

const FIRST = {
  startedAt: 0,
  context: { window: 200_000 },
  rateLimits: [],
  cost: { usd: 0 },
}

test('the line under the prompt follows each measurement and counts down', async ($, on) => {
  const clock = mock.clock(on, { now: Date.parse('2098-12-30T12:00:00Z') })
  const lines: (string | undefined)[] = []
  on('session.usage', () => ({ value: FIRST }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('ui.status', (_, e) => {
    lines.push(e.text)

    return { value: undefined }
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(lines).toEqual([undefined])

  await $.session.measure({
    context: { tokens: 84_000, window: 200_000, percent: 42 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 63.5, resetsAt: '2098-12-30T14:14:00Z' },
      { kind: 'seven_day', percentUsed: 18, resetsAt: '2099-01-01T00:00:00Z' },
    ],
    cost: { usd: 1.234 },
    changed: ['context', 'rateLimits', 'cost'],
  })
  expect(lines.at(-1)).toBe('5h 64% (2h 14m) · week 18% (1d 12h) · ctx 42% 84k/200k')

  await clock.advance(60_000)
  expect(lines.at(-1)).toBe('5h 64% (2h 13m) · week 18% (1d 11h) · ctx 42% 84k/200k')
})

test('a million-token window reads 1M, and a window with no reset time has no countdown', async ($, on) => {
  mock.clock(on, { now: 0 })
  const lines: (string | undefined)[] = []
  on('session.usage', () => ({ value: FIRST }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('ui.status', (_, e) => {
    lines.push(e.text)

    return { value: undefined }
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.session.measure({
    context: { tokens: 66_000, window: 1_000_000, percent: 7 },
    rateLimits: [{ kind: 'five_hour', percentUsed: 18 }],
    cost: { usd: 0 },
    changed: ['context', 'rateLimits'],
  })
  expect(lines.at(-1)).toBe('5h 18% · ctx 7% 66k/1M')
})
