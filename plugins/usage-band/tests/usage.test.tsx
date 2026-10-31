import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'usage-band',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 6,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 5 },
    view: {},
  },
} as const

const FIRST = {
  startedAt: 0,
  context: { window: 200_000 },
  rateLimits: [],
  cost: { usd: 0 },
}

test('the band follows each measurement, without cost', async ($, on) => {
  on('session.usage', () => ({ value: FIRST }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('clock.now', () => ({ value: Date.parse('2098-12-30T12:00:00Z') }))
  on('clock.every', () => ({ value: undefined }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /Context/ }))?.text).toBe('Context: no reading yet')
    await ui.unmount()
  }

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
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /^█/ }))?.text).toBe('███░░░░░')
    expect((await ui.find({ type: 'Text', text: /200k/ }))?.text).toBe('84k/200k')
    expect((await ui.find({ type: 'Text', text: /5-hour/ }))?.text).toBe('5-hour')
    expect((await ui.find({ type: 'Text', text: /63/ }))?.text).toBe('63.5%')
    expect((await ui.find({ type: 'Text', text: /resets 2h/ }))?.text).toBe('resets 2h 14m')
    expect((await ui.find({ type: 'Text', text: /resets 1d/ }))?.text).toBe('resets 1d 12h')
    expect(await ui.find({ type: 'Text', text: /\$/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('the band yields to a survey', async ($, on) => {
  on('session.usage', () => ({ value: FIRST }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('clock.every', () => ({ value: undefined }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>survey</Text>
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({
    ...BAND,
    props: { ...BAND.props, hasSurvey: true },
    surface: 'terminal',
  })

  expect((await ui.find({ type: 'Text' }))?.text).toBe('survey')
  await ui.unmount()
})
