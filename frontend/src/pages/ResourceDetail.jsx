import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useToast } from '../context/ToastContext'
import { useApi } from '../hooks/useApi'
import { Button, ErrorState, Field, Input, LoadingState, Select } from '../components/ui'
import { SlotGrid, daySlots } from '../components/SlotGrid'
import { TypeIcon } from './Resources'
import { formatDay, formatTime, label, toDateInput } from '../utils/format'

const HALF_HOUR = 30 * 60 * 1000

function BookingForm({ resource, date, setDate, selection, setSelection, onBooked }) {
  const showToast = useToast()
  const [purpose, setPurpose] = useState('')
  const [ticketId, setTicketId] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const slots = daySlots(date).filter((s) => s.getTime() > Date.now())
  const startOptions = slots.map((s) => s.toISOString())
  // End can be 30 to 240 minutes after the start
  const endOptions = selection
    ? Array.from({ length: 8 }, (_, i) => new Date(selection.start.getTime() + (i + 1) * HALF_HOUR).toISOString())
    : []

  function pickStart(iso) {
    if (!iso) return setSelection(null)
    const start = new Date(iso)
    setSelection({ start, end: new Date(start.getTime() + 2 * HALF_HOUR) })
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!selection) return setError('Pick a start time first.')
    setSubmitting(true)
    try {
      await api.post('/bookings', {
        resourceId: resource.id,
        startTime: selection.start.toISOString(), // the API always gets UTC
        endTime: selection.end.toISOString(),
        purpose,
        ...(ticketId && { ticketId: Number(ticketId) }),
      })
      showToast('Booking requested. An admin will approve it soon.')
      setPurpose('')
      setTicketId('')
      setSelection(null)
      onBooked()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const today = toDateInput(new Date())
  const maxDay = toDateInput(Date.now() + 30 * 24 * 60 * 60 * 1000)

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Date">
        <Input type="date" value={date} min={today} max={maxDay}
          onChange={(e) => { if (e.target.value) { setDate(e.target.value); setSelection(null) } }} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start">
          <select value={selection?.start.toISOString() || ''} onChange={(e) => pickStart(e.target.value)}
            className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm">
            <option value="">Choose</option>
            {startOptions.map((iso) => <option key={iso} value={iso}>{formatTime(iso)}</option>)}
          </select>
        </Field>
        <Field label="End">
          <select value={selection?.end.toISOString() || ''} disabled={!selection}
            onChange={(e) => setSelection({ ...selection, end: new Date(e.target.value) })}
            className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm disabled:bg-canvas">
            {!selection && <option value="">Choose</option>}
            {endOptions.map((iso) => <option key={iso} value={iso}>{formatTime(iso)}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Purpose" hint="5–200 characters">
        <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Reproduce checkout crash on device" />
      </Field>
      <Field label="Linked ticket (optional)" hint="Ticket number from the triage queue">
        <Input type="number" min="1" value={ticketId} onChange={(e) => setTicketId(e.target.value)} placeholder="e.g. 7" />
      </Field>

      {error && <p role="alert" className="rounded-lg bg-[#fbe5e5] px-3 py-2 text-sm text-danger">{error}</p>}

      <Button type="submit" className="w-full" disabled={submitting || !resource.isActive}>
        {submitting ? 'Requesting…' : 'Request booking'}
      </Button>
      {!resource.isActive && <p className="text-xs text-muted">This resource is inactive and can't be booked.</p>}
    </form>
  )
}

export default function ResourceDetail() {
  const { id } = useParams()
  const [date, setDate] = useState(toDateInput(new Date()))
  const [selection, setSelection] = useState(null)

  const resource = useApi(() => api.get(`/resources/${id}`), [id])
  const availability = useApi(() => {
    const from = new Date(`${date}T00:00`)
    const to = new Date(from.getTime() + 24 * 60 * 60 * 1000)
    return api.get(`/resources/${id}/availability`, { from: from.toISOString(), to: to.toISOString() })
  }, [id, date])

  if (resource.loading) return <LoadingState text="Loading resource…" />
  if (resource.error) {
    return <ErrorState message={resource.error.message} />
  }
  const r = resource.data

  return (
    <>
      <Link to="/resources" className="text-sm text-accent hover:underline">Back to resources</Link>
      <div className="mt-3 mb-6 flex items-start gap-4">
        <TypeIcon type={r.type} />
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{r.name}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {label(r.type)}, up to {r.capacity} {r.capacity === 1 ? 'person' : 'people'}
            {!r.isActive && ', currently inactive'}
          </p>
          {r.description && <p className="mt-2 max-w-2xl text-sm text-ink-soft">{r.description}</p>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-xl border border-line bg-surface p-5">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">{formatDay(`${date}T12:00`)}</h2>
            <p className="text-xs text-muted">Times in your timezone</p>
          </div>
          {availability.loading && !availability.data && <LoadingState text="Loading availability…" />}
          {availability.error && <ErrorState message={availability.error.message} onRetry={availability.reload} />}
          {availability.data && (
            <SlotGrid
              date={date}
              bookings={availability.data.bookings}
              selection={selection}
              onPick={(slot) => setSelection({ start: slot, end: new Date(slot.getTime() + 2 * HALF_HOUR) })}
            />
          )}
        </section>

        <section className="h-fit rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-4 font-display text-lg font-semibold">Book a slot</h2>
          <BookingForm
            resource={r} date={date} setDate={setDate}
            selection={selection} setSelection={setSelection}
            onBooked={availability.reload}
          />
        </section>
      </div>
    </>
  )
}
