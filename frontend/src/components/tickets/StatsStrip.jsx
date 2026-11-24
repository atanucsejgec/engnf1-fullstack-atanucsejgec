// Top of the triage queue: one stacked "load bar" showing how the queue
// splits by priority, plus the review numbers. All values come from GET /api/stats.
import { priorityBg } from '../ui'
import { label } from '../../utils/format'

const PRIORITIES = ['URGENT', 'HIGH', 'MEDIUM', 'LOW']

function Figure({ value, caption }) {
  return (
    <div>
      <p className="font-display text-2xl font-bold leading-none tracking-tight">{value}</p>
      <p className="mt-1.5 text-xs text-ink-soft">{caption}</p>
    </div>
  )
}

export default function StatsStrip({ stats }) {
  if (!stats) {
    return <div className="h-[120px] animate-pulse rounded-xl bg-surface" aria-label="Loading stats" />
  }

  const total = stats.total || 0
  const open = stats.byStatus.OPEN + stats.byStatus.IN_PROGRESS

  return (
    <section className="rounded-xl border border-line bg-surface p-5" aria-label="Queue statistics">
      <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm font-medium">Queue load by priority</p>
            <p className="text-xs text-muted">{total} tickets</p>
          </div>
          {/* Stacked bar: each segment's width = its share of all tickets */}
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-canvas">
            {PRIORITIES.map((p) => {
              const count = stats.byPriority[p]
              return count > 0 ? (
                <div
                  key={p}
                  className={`${priorityBg(p)} transition-[width] duration-500`}
                  style={{ width: `${(count / total) * 100}%` }}
                  title={`${label(p)}: ${count}`}
                />
              ) : null
            })}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
            {PRIORITIES.map((p) => (
              <li key={p} className="flex items-center gap-1.5 text-xs text-ink-soft">
                <span className={`h-2 w-2 rounded-sm ${priorityBg(p)}`} aria-hidden />
                {label(p)} <span className="font-semibold text-ink">{stats.byPriority[p]}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-3 gap-6 border-line md:border-l md:pl-6">
          <Figure value={open} caption="Open or in progress" />
          <Figure value={stats.reviewedCount} caption="Reviewed by agents" />
          <Figure value={`${stats.modelAgreementRate}%`} caption="Model agreement" />
        </div>
      </div>
    </section>
  )
}
