import { atom, read, update } from 'claude-code'
import type { Register, SessionUsage } from 'claude-code'

import type { Usage } from '../types'

const BAR = 8
const usage = atom({ plugin: 'usage-band', key: 'usage' } as const, null, {
  shape: 'usage-1',
})

const LABELS: Record<string, string> = {
  five_hour: '5-hour',
  seven_day: 'Weekly',
  spend_limit: 'Spend',
}

function pick(u: Pick<SessionUsage, 'context' | 'rateLimits'>): Usage {
  return {
    context: {
      tokens: u.context.tokens,
      window: u.context.window,
      percent: u.context.percent,
    },
    rateLimits: u.rateLimits.map(r => ({
      kind: r.kind,
      percentUsed: r.percentUsed,
      resetsAt: r.resetsAt,
    })),
  }
}

function bar(percent: number, width: number): string {
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function tone(percent: number): 'success' | 'warning' | 'error' {
  return percent >= 80 ? 'error' : percent >= 50 ? 'warning' : 'success'
}

function kTokens(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)
}

function untilReset(resetsAt: string | undefined, now: number): string {
  if (!resetsAt) return ''
  const mins = Math.max(0, Math.round((Date.parse(resetsAt) - now) / 60_000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  const parts = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`
  return `resets ${parts}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const now = await $.session.usage()
    await update($, usage, () => pick(now))
    // "resets …" counts down even while the session is idle.
    $.clock.every(60_000, () => $.ui.invalidate('ui.render'))

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await update($, usage, () => pick(e))

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const u = await read($, usage)
    if (e.props.hasSurvey || !u) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const now = await $.clock.now()
    const ctx = u.context
    const meter = (label: string, percent: number, detail: string) => (
      <Box columnGap={1}>
        <Text bold>{label}</Text>
        <Text color={tone(percent)}>{bar(percent, BAR)}</Text>
        <Text>{`${percent}%`}</Text>
        {detail !== '' && <Text dimColor>{detail}</Text>}
      </Box>
    )

    return (
      <Box
        width={e.props.bodyColumns}
        flexWrap="wrap"
        justifyContent="flex-end"
        columnGap={3}
      >
        {ctx.percent === undefined || ctx.tokens === undefined ? (
          <Text dimColor>Context: no reading yet</Text>
        ) : (
          meter('Context', ctx.percent, `${kTokens(ctx.tokens)}/${kTokens(ctx.window)}`)
        )}
        {u.rateLimits.map(r =>
          meter(LABELS[r.kind] ?? r.kind, r.percentUsed, untilReset(r.resetsAt, now)),
        )}
      </Box>
    )
  })
}
