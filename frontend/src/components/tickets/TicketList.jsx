import { PriorityTag, StatusBadge, priorityBg } from '../ui'
import { label, timeAgo } from '../../utils/format'

// One row in the queue. The coloured left edge is the priority "triage tag".
// Subject and body are rendered as plain React text, so HTML like <script>
// is shown as text and never executed (rule T-B5).
function TicketRow({ ticket, selected, onSelect }) {
  return (
    <li>
      <button
        onClick={() => onSelect(ticket.id)}
        aria-current={selected ? 'true' : undefined}
        className={`group relative flex w-full gap-4 py-3.5 pl-5 pr-4 text-left transition-colors ${
          selected ? 'bg-accent-soft' : 'hover:bg-canvas/70'
        }`}
      >
        <span className={`absolute inset-y-2 left-0 w-1.5 rounded-r ${priorityBg(ticket.priority)}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{ticket.subject}</p>
          <p className="mt-0.5 truncate text-sm text-ink-soft">{ticket.body}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <PriorityTag priority={ticket.priority} />
            <span className="text-xs text-ink-soft">{label(ticket.category)}</span>
            {ticket.isHumanOverride && (
              <span className="text-xs text-accent" title="Category set by an agent">Agent override</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end justify-between gap-2">
          <StatusBadge status={ticket.status} />
          <span className="text-xs text-muted">{timeAgo(ticket.createdAt)}</span>
        </div>
      </button>
    </li>
  )
}

export default function TicketList({ tickets, selectedId, onSelect }) {
  return (
    <ul className="divide-y divide-line">
      {tickets.map((t) => (
        <TicketRow key={t.id} ticket={t} selected={t.id === selectedId} onSelect={onSelect} />
      ))}
    </ul>
  )
}
