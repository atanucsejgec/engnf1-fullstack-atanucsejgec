// 48 half-hour cells for one day, in the user's LOCAL time.
// A cell is "taken" when a PENDING/APPROVED booking overlaps it
// (same rule as the API: slotStart < bookingEnd AND slotEnd > bookingStart).
import { formatTime } from '../utils/format'

const HALF_HOUR = 30 * 60 * 1000

export function daySlots(dateString) {
  const start = new Date(`${dateString}T00:00`) // local midnight
  return Array.from({ length: 48 }, (_, i) => new Date(start.getTime() + i * HALF_HOUR))
}

function slotState(slot, bookings, selection) {
  const end = new Date(slot.getTime() + HALF_HOUR)
  const booking = bookings.find((b) => slot < new Date(b.endTime) && end > new Date(b.startTime))
  if (booking) return booking.status === 'APPROVED' ? 'approved' : 'pending'
  if (slot.getTime() <= Date.now()) return 'past'
  if (selection && slot >= selection.start && end <= selection.end) return 'selected'
  return 'free'
}

const STYLES = {
  free: 'border-line bg-surface text-ink hover:border-accent hover:text-accent',
  selected: 'border-accent bg-accent text-white',
  pending: 'border-high/40 bg-[repeating-linear-gradient(135deg,#fdf1dc_0_6px,#fbe6c2_6px_12px)] text-[#9a5b00] cursor-not-allowed',
  approved: 'border-ink bg-ink text-white/80 cursor-not-allowed',
  past: 'border-transparent bg-canvas text-muted cursor-not-allowed',
}

export function SlotGrid({ date, bookings, selection, onPick }) {
  const slots = daySlots(date)
  return (
    <div>
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 xl:grid-cols-8">
        {slots.map((slot) => {
          const state = slotState(slot, bookings, selection)
          return (
            <button
              key={slot.toISOString()}
              type="button"
              disabled={state !== 'free' && state !== 'selected'}
              onClick={() => onPick(slot)}
              className={`h-9 rounded-md border text-xs font-medium tabular-nums transition-colors ${STYLES[state]}`}
              aria-label={`${formatTime(slot.toISOString())} ${state}`}
            >
              {formatTime(slot.toISOString())}
            </button>
          )
        })}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-soft">
        <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-line bg-surface" />Free</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-accent" />Your selection</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-high/40 bg-[#fbe6c2]" />Requested</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-ink" />Booked</li>
      </ul>
    </div>
  )
}
