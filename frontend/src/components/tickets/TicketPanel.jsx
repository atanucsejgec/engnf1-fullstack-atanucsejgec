// Ticket detail panel with edit controls and the audit history.
//
// OPTIMISTIC UI: when the agent changes a value we show it IMMEDIATELY,
// then send the PATCH in the background.
//   - server says OK     -> replace with the server's version (+ new events)
//   - server says error  -> ROLL BACK to the snapshot taken before the change
//                           and show a visible error message
import { useState } from 'react'
import { api } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useApi } from '../../hooks/useApi'
import { Button, ErrorState, LoadingState, PriorityTag, Select, StatusBadge } from '../ui'
import { formatDateTime, label, timeAgo } from '../../utils/format'
import { CATEGORIES, PRIORITIES, STATUSES } from './FilterBar'

const FIELD_NAMES = { category: 'category', priority: 'priority', status: 'status', assigneeId: 'assignee' }

function eventValue(field, value, user) {
  if (value === null) return 'nobody'
  if (field === 'assigneeId') return Number(value) === user.id ? 'you' : `user #${value}`
  return label(value)
}

function History({ events, user }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted">No changes yet. Edits made here are recorded with your name.</p>
  }
  return (
    <ol className="relative space-y-4 border-l border-line pl-4">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full border-2 border-surface bg-accent" aria-hidden />
          <p className="text-sm">
            <span className="font-medium">{e.actor}</span> changed {FIELD_NAMES[e.field]} from{' '}
            <span className="font-medium">{eventValue(e.field, e.oldValue, user)}</span> to{' '}
            <span className="font-medium">{eventValue(e.field, e.newValue, user)}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted" title={formatDateTime(e.createdAt)}>{timeAgo(e.createdAt)}</p>
        </li>
      ))}
    </ol>
  )
}

export default function TicketPanel({ ticketId, onClose, onTicketChange, onSaved }) {
  const { user } = useAuth()
  const showToast = useToast()
  const { data, setData, loading, error, reload } = useApi(() => api.get(`/tickets/${ticketId}`), [ticketId])
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)

  async function saveChange(changes) {
    const snapshot = data // what we roll back to if the server says no
    const optimisticTicket = { ...data.ticket, ...changes }

    // 1. Show the change right away
    setData({ ...data, ticket: optimisticTicket })
    onTicketChange(optimisticTicket)
    setSaveError('')
    setSaving(true)

    try {
      // 2. Ask the server. X-Agent tells the API who made the change.
      const result = await api.patch(`/tickets/${ticketId}`, changes, { 'X-Agent': user.email })
      setData(result)
      onTicketChange(result.ticket)
      onSaved()
    } catch (err) {
      // 3. Server rejected it -> undo and tell the agent clearly
      setData(snapshot)
      onTicketChange(snapshot.ticket)
      setSaveError(`Your change was not saved and has been undone. ${err.message}`)
      showToast('Update failed, change rolled back', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <p className="text-sm text-ink-soft">
          Ticket <span className="font-medium text-ink">#{ticketId}</span>
          {data && <span className="text-muted"> ({data.ticket.externalId})</span>}
        </p>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>

      {loading && !data && <LoadingState text="Loading ticket…" />}
      {error && <ErrorState message={error.message} onRetry={reload} />}

      {data && (
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={data.ticket.status} />
              <PriorityTag priority={data.ticket.priority} />
              {saving && <span className="text-xs text-muted">Saving…</span>}
            </div>
            {/* Plain text rendering: HTML in the ticket is shown, never run */}
            <h2 className="mt-3 break-words font-display text-xl font-semibold leading-snug">{data.ticket.subject}</h2>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-soft">{data.ticket.body}</p>
            <p className="mt-3 text-xs text-muted">Received {formatDateTime(data.ticket.createdAt)}</p>
          </div>

          {saveError && (
            <p role="alert" className="rounded-lg border border-danger/30 bg-[#fbe5e5] px-3 py-2 text-sm text-danger">
              {saveError}
            </p>
          )}

          <div className="space-y-3 rounded-xl bg-canvas/70 p-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">Category</span>
                <Select options={CATEGORIES} value={data.ticket.category}
                  onChange={(e) => saveChange({ category: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">Priority</span>
                <Select options={PRIORITIES} value={data.ticket.priority}
                  onChange={(e) => saveChange({ priority: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">Status</span>
                <Select options={STATUSES} value={data.ticket.status}
                  onChange={(e) => saveChange({ status: e.target.value })} />
              </label>
            </div>
            <p className="text-xs text-ink-soft">
              Classifier suggested <span className="font-medium text-ink">{label(data.ticket.autoCategory)}</span>
              {data.ticket.isHumanOverride
                ? '. An agent changed it, so re-imports will keep the agent’s choice.'
                : '. Changing the category marks it as an agent decision.'}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
              <p className="text-sm">
                Assignee:{' '}
                <span className="font-medium">
                  {data.ticket.assigneeId === null ? 'Unassigned' : data.ticket.assigneeId === user.id ? 'You' : `User #${data.ticket.assigneeId}`}
                </span>
              </p>
              {data.ticket.assigneeId === user.id ? (
                <Button variant="secondary" size="sm" onClick={() => saveChange({ assigneeId: null })}>Unassign</Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => saveChange({ assigneeId: user.id })}>Assign to me</Button>
              )}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">History</h3>
            <History events={data.events} user={user} />
          </div>
        </div>
      )}
    </div>
  )
}
