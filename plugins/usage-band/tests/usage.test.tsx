import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const FIRST = {
  startedAt: 0,
  context: { window: 200_000 },
  rateLimits: [],
  cost: { usd: 0 },
}

const MODES = { plugin: 'usage-band', component: 'SessionMode' } as const

// Stands for the engine: the footer's mode labels, joined as it joins them.
function engine(on: On) {
  on('session.usage', () => ({ value: FIRST }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>{`modes: ${(e.props as { modes: string[] }).modes.join(' & ')}`}</Text>
  })
}

test('the footer line follows each measurement and counts down', async ($, on) => {
  const clock = mock.clock(on, { now: Date.parse('2098-12-30T12:00:00Z') })
  engine(on)

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.session.measure({
    context: { tokens: 84_000, window: 200_000, percent: 42 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 63.5, resetsAt: '2098-12-30T14:14:00Z' },
      { kind: 'seven_day', percentUsed: 18, resetsAt: '2099-01-01T00:00:00Z' },
    ],
    cost: { usd: 1.234 },
    changed: ['context', 'rateLimits', 'cost'],
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...MODES, props: { modes: [] }, surface })
    expect((await ui.find({ type: 'Text' }))?.text).toBe(
      'modes: 5h 64% (2h 14m) · week 18% (1d 12h) · ctx 42% 84k/200k',
    )
    await ui.unmount()
  }

  const ui = await $.ui.mount({ ...MODES, props: { modes: [] }, surface: 'terminal' })
  await clock.advance(60_000)
  expect((await ui.find({ type: 'Text' }))?.text).toBe(
    'modes: 5h 64% (2h 13m) · week 18% (1d 11h) · ctx 42% 84k/200k',
  )
  await ui.unmount()
})

test("the engine's own modes stay, the line after them", async ($, on) => {
  mock.clock(on, { now: 0 })
  engine(on)

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.session.measure({
    context: { tokens: 66_000, window: 1_000_000, percent: 7 },
    rateLimits: [{ kind: 'five_hour', percentUsed: 18 }],
    cost: { usd: 0 },
    changed: ['context', 'rateLimits'],
  })

  const ui = await $.ui.mount({ ...MODES, props: { modes: ['focus'] }, surface: 'terminal' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('modes: focus & 5h 18% · ctx 7% 66k/1M')
  await ui.unmount()
})

test('with nothing measured yet the footer is left as it was', async ($, on) => {
  mock.clock(on, { now: 0 })
  engine(on)

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...MODES, props: { modes: [] }, surface: 'terminal' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('modes: ')
  await ui.unmount()
})
