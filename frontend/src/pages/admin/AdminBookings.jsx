import { useState } from 'react'
import { api } from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { useApi } from '../../hooks/useApi'
import { PageHeader } from '../../components/Layout'
import BookingList, { BOOKING_STATUSES, isUpcoming } from '../../components/BookingList'
import { Button, EmptyState, ErrorState, Field, Input, LoadingState, Modal, Pagination, Select, Textarea } from '../../components/ui'

export default function AdminBookings() {
  const showToast = useToast()
  const [filters, setFilters] = useState({ status: 'PENDING', resourceId: '', from: '', to: '' })
  const [page, setPage] = useState(1)
  const [rejecting, setRejecting] = useState(null)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState('')
  const [busyId, setBusyId] = useState(null)

  // Resource names for the filter dropdown (admin sees all, max 50)
  const resources = useApi(() => api.get('/resources', { limit: 50 }), [])

  const { data, loading, error, reload } = useApi(() => api.get('/bookings', {
    status: filters.status,
    resourceId: filters.resourceId,
    // date inputs are local days -> convert to UTC instants for the API
    from: filters.from && new Date(`${filters.from}T00:00`).toISOString(),
    to: filters.to && new Date(`${filters.to}T23:59:59`).toISOString(),
    page,
  }), [filters, page])

  const setFilter = (name) => (e) => { setFilters({ ...filters, [name]: e.target.value }); setPage(1) }

  async function approve(booking) {
    setBusyId(booking.id)
    try {
      await api.patch(`/bookings/${booking.id}/approve`)
      showToast(`Approved ${booking.resourceName} for ${booking.userName}`)
      reload()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function reject(e) {
    e.preventDefault()
    setNoteError('')
    try {
      await api.patch(`/bookings/${rejecting.id}/reject`, { note })
      showToast('Booking rejected')
      setRejecting(null)
      reload()
    } catch (err) {
      setNoteError(err.message)
    }
  }

  return (
    <>
      <PageHeader title="Booking requests" subtitle="Approve or reject slot requests from agents." />

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="grid grid-cols-2 gap-2 border-b border-line p-3 md:grid-cols-4">
          <Select aria-label="Status" placeholder="All statuses" options={BOOKING_STATUSES}
            value={filters.status} onChange={setFilter('status')} />
          <select aria-label="Resource" value={filters.resourceId} onChange={setFilter('resourceId')}
            className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm">
            <option value="">All resources</option>
            {resources.data?.data.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <Input type="date" aria-label="From date" value={filters.from} onChange={setFilter('from')} />
          <Input type="date" aria-label="To date" value={filters.to} onChange={setFilter('to')} />
        </div>

        {loading && !data && <LoadingState text="Loading bookings…" />}
        {error && <ErrorState message={error.message} onRetry={reload} />}
        {data && data.data.length === 0 && (
          <EmptyState title="Nothing here" text={filters.status === 'PENDING' ? 'No requests are waiting for a decision.' : 'No bookings match these filters.'} />
        )}
        {data && data.data.length > 0 && (
          <>
            <BookingList
              bookings={data.data}
              showUser
              actions={(b) =>
                b.status === 'PENDING' && isUpcoming(b) ? (
                  <>
                    <Button size="sm" onClick={() => approve(b)} disabled={busyId === b.id}>Approve</Button>
                    <Button size="sm" variant="secondary" onClick={() => { setRejecting(b); setNote(''); setNoteError('') }}>
                      Reject
                    </Button>
                  </>
                ) : null
              }
            />
            <div className="border-t border-line px-4 pb-4">
              <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
            </div>
          </>
        )}
      </div>

      <Modal open={Boolean(rejecting)} title="Reject booking" onClose={() => setRejecting(null)}>
        {rejecting && (
          <form onSubmit={reject} className="space-y-4">
            <p className="text-sm text-ink-soft">
              {rejecting.userName} will see this note on their booking for {rejecting.resourceName}.
            </p>
            <Field label="Reason" hint="5–200 characters" error={noteError}>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setRejecting(null)}>Back</Button>
              <Button type="submit" variant="danger">Reject booking</Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  )
}
