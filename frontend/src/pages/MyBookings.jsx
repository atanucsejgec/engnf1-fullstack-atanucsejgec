import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useToast } from '../context/ToastContext'
import { useApi } from '../hooks/useApi'
import { PageHeader } from '../components/Layout'
import BookingList, { BOOKING_STATUSES, isUpcoming } from '../components/BookingList'
import { Button, EmptyState, ErrorState, LoadingState, Modal, Pagination, Select } from '../components/ui'
import { formatDateTime } from '../utils/format'

export default function MyBookings() {
  const showToast = useToast()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [toCancel, setToCancel] = useState(null) // booking waiting for confirmation
  const [cancelling, setCancelling] = useState(false)

  const { data, loading, error, reload } = useApi(() => api.get('/bookings/mine', { status, page }), [status, page])

  async function confirmCancel() {
    setCancelling(true)
    try {
      await api.patch(`/bookings/${toCancel.id}/cancel`)
      showToast('Booking cancelled')
      reload()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setCancelling(false)
      setToCancel(null)
    }
  }

  return (
    <>
      <PageHeader title="My bookings" subtitle="Slots you've requested, and whether they've been approved." />

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-line p-3">
          <Select aria-label="Filter by status" placeholder="All statuses" options={BOOKING_STATUSES}
            value={status} className="sm:w-48" onChange={(e) => { setStatus(e.target.value); setPage(1) }} />
        </div>

        {loading && !data && <LoadingState text="Loading your bookings…" />}
        {error && <ErrorState message={error.message} onRetry={reload} />}
        {data && data.data.length === 0 && (
          <EmptyState
            title={status ? 'No bookings with this status' : 'No bookings yet'}
            text="Find a room, lab or piece of equipment and request a slot."
            action={<Link to="/resources"><Button>Browse resources</Button></Link>}
          />
        )}
        {data && data.data.length > 0 && (
          <>
            <BookingList
              bookings={data.data}
              actions={(b) =>
                ['PENDING', 'APPROVED'].includes(b.status) && isUpcoming(b) ? (
                  <Button variant="secondary" size="sm" onClick={() => setToCancel(b)}>Cancel</Button>
                ) : null
              }
            />
            <div className="border-t border-line px-4 pb-4">
              <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
            </div>
          </>
        )}
      </div>

      <Modal open={Boolean(toCancel)} title="Cancel this booking?" onClose={() => setToCancel(null)}>
        {toCancel && (
          <>
            <p className="text-sm text-ink-soft">
              {toCancel.resourceName} on {formatDateTime(toCancel.startTime)} will be released for others to book.
              This can't be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setToCancel(null)}>Keep booking</Button>
              <Button variant="danger" onClick={confirmCancel} disabled={cancelling}>
                {cancelling ? 'Cancelling…' : 'Cancel booking'}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}
