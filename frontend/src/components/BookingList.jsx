// Booking rows shared by "My bookings" and the admin "Booking requests" page.
// "actions" is a function that returns the buttons for one booking.
import { Link } from 'react-router-dom'
import { StatusBadge } from './ui'
import { formatDay, formatTime } from '../utils/format'

export const BOOKING_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']

export default function BookingList({ bookings, showUser = false, actions }) {
  return (
    <ul className="divide-y divide-line">
      {bookings.map((b) => (
        <li key={b.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
          {/* Date block */}
          <div className="flex shrink-0 items-center gap-4 sm:w-48">
            <div className="w-14 rounded-lg bg-canvas py-1.5 text-center">
              <p className="text-xs text-ink-soft">{new Date(b.startTime).toLocaleDateString(undefined, { month: 'short' })}</p>
              <p className="font-display text-xl font-bold leading-none">{new Date(b.startTime).getDate()}</p>
            </div>
            <div>
              <p className="text-sm font-medium tabular-nums">{formatTime(b.startTime)} – {formatTime(b.endTime)}</p>
              <p className="text-xs text-muted">{formatDay(b.startTime)}</p>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              <Link to={`/resources/${b.resourceId}`} className="hover:text-accent">{b.resourceName}</Link>
            </p>
            <p className="break-words text-sm text-ink-soft">{b.purpose}</p>
            <p className="mt-1 text-xs text-muted">
              {showUser && <>Requested by {b.userName}. </>}
              {b.ticketId && <>Linked to ticket #{b.ticketId}. </>}
              {b.decisionNote && <span className="text-ink-soft">Note: {b.decisionNote}</span>}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:justify-end">
            <StatusBadge status={b.status} />
            {actions && actions(b)}
          </div>
        </li>
      ))}
    </ul>
  )
}

// A booking can only be changed before it starts
export const isUpcoming = (b) => new Date(b.startTime).getTime() > Date.now()
