import { atom, read, update } from 'claude-code'
import type { Register, SessionUsage } from 'claude-code'

import type { Usage } from '../types'

const usage = atom({ plugin: 'usage-band', key: 'usage' } as const, null, {
  shape: 'usage-1',
})

const LABELS: Record<string, string> = {
  five_hour: '5h',
  seven_day: 'week',
  spend_limit: 'spend',
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

function tokens(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)
}

function untilReset(resetsAt: string | undefined, now: number): string {
  if (!resetsAt) return ''
  const mins = Math.max(0, Math.round((Date.parse(resetsAt) - now) / 60_000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  const parts = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`
  return ` (${parts})`
}

function line(u: Usage, now: number): string | undefined {
  const parts = u.rateLimits.map(
    r => `${LABELS[r.kind] ?? r.kind} ${Math.round(r.percentUsed)}%${untilReset(r.resetsAt, now)}`,
  )
  const ctx = u.context
  if (ctx.percent !== undefined && ctx.tokens !== undefined) {
    parts.push(`ctx ${Math.round(ctx.percent)}% ${tokens(ctx.tokens)}/${tokens(ctx.window)}`)
  }
  return parts.length > 0 ? parts.join(' · ') : undefined
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const now = await $.session.usage()
    await update($, usage, () => pick(now))
    // 0.3.0 pinned the line as a status; a reload onto this version keeps it.
    $.ui.status(undefined)
    // The countdowns tick even while the session is idle.
    $.clock.every(60_000, () => $.ui.invalidate('ui.render'))

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await update($, usage, () => pick(e))

    return next(e)
  })

  // The dim labels at the right of the footer under the prompt.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const u = await read($, usage)
    const text = u && line(u, await $.clock.now())
    if (!text) return next(e)

    return next({ ...e, props: { ...e.props, modes: [...e.props.modes, text] } })
  })
}
