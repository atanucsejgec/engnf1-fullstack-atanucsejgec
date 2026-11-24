import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useApi } from '../../hooks/useApi'
import { PageHeader } from '../../components/Layout'
import { ErrorState, LoadingState, priorityBg } from '../../components/ui'
import { label } from '../../utils/format'

// Horizontal bar list: label on the left, bar + value on the right.
// Bars are scaled to the largest value in the list.
function BarList({ items, colorFor = () => 'bg-accent' }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.key} className="grid grid-cols-[7.5rem_1fr] items-center gap-3 text-sm">
          <span className="truncate text-ink-soft">{item.label}</span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 rounded-full bg-canvas" style={{ flex: 1 }}>
              <span className={`block h-full rounded-full ${colorFor(item.key)}`} style={{ width: `${(item.value / max) * 100}%` }} />
            </span>
            <span className="w-7 text-right font-semibold tabular-nums">{item.value}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

function Panel({ title, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-line bg-surface p-5 ${className}`}>
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  )
}

const toItems = (obj) => Object.entries(obj).map(([key, value]) => ({ key, label: label(key), value }))
const BOOKING_COLORS = { PENDING: 'bg-high', APPROVED: 'bg-ok', REJECTED: 'bg-danger', CANCELLED: 'bg-low' }

export default function AdminDashboard() {
  const { data, loading, error, reload } = useApi(() => api.get('/admin/stats'), [])

  if (loading) return <LoadingState text="Loading analytics…" />
  if (error) return <ErrorState message={error.message} onRetry={reload} />

  const { activeResources, bookingsByStatus, topResources, ticketStats } = data
  const pending = bookingsByStatus.PENDING

  return (
    <>
      <PageHeader title="Analytics" subtitle="How the support queue and shared resources are being used." />

      {/* Headline row: the numbers an admin acts on */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link to="/admin/bookings" className="rounded-xl bg-ink p-5 text-white hover:bg-[#1d2949]">
          <p className="font-display text-4xl font-bold">{pending}</p>
          <p className="mt-1 text-sm text-white/70">{pending === 1 ? 'Booking request waits' : 'Booking requests wait'} for your decision</p>
        </Link>
        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="font-display text-4xl font-bold">{ticketStats.modelAgreementRate}%</p>
          <p className="mt-1 text-sm text-ink-soft">
            Model agreement on {ticketStats.reviewedCount} reviewed tickets
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="font-display text-4xl font-bold">{activeResources}</p>
          <p className="mt-1 text-sm text-ink-soft">Active resources agents can book</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Bookings by status">
          <BarList items={toItems(bookingsByStatus)} colorFor={(k) => BOOKING_COLORS[k]} />
        </Panel>

        <Panel title="Most requested resources">
          {topResources.length === 0 ? (
            <p className="text-sm text-muted">No active bookings yet.</p>
          ) : (
            <ol className="space-y-3">
              {topResources.map((r, i) => (
                <li key={r.id} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">{i + 1}</span>
                  <Link to={`/resources/${r.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-accent">{r.name}</Link>
                  <span className="text-sm text-ink-soft">{r.bookingCount} {r.bookingCount === 1 ? 'booking' : 'bookings'}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel title="Tickets by category">
          <BarList items={toItems(ticketStats.byCategory)} />
        </Panel>

        <Panel title="Tickets by priority">
          <BarList items={toItems(ticketStats.byPriority)} colorFor={priorityBg} />
        </Panel>

        <Panel title="Tickets by status" className="lg:col-span-2">
          <BarList items={toItems(ticketStats.byStatus)} colorFor={() => 'bg-ink-soft'} />
        </Panel>
      </div>
    </>
  )
}
