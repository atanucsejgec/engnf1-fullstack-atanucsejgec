import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useToast } from '../context/ToastContext'
import { ticketFeed } from '../data/ticketFeed'
import { useApi } from '../hooks/useApi'
import { PageHeader } from '../components/Layout'
import { Button, EmptyState, ErrorState, LoadingState, Pagination } from '../components/ui'
import StatsStrip from '../components/tickets/StatsStrip'
import FilterBar from '../components/tickets/FilterBar'
import TicketList from '../components/tickets/TicketList'
import TicketPanel from '../components/tickets/TicketPanel'

const EMPTY_FILTERS = { status: '', category: '', priority: '' }

export default function TriageQueue() {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('') // search text after a short pause
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState(null)
  const [importing, setImporting] = useState(false)
  const showToast = useToast()

  // Wait 300ms after the last keystroke before searching
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1) }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const tickets = useApi(
    () => api.get('/tickets', { ...filters, q: query, page, limit: 20 }),
    [filters, query, page]
  )
  const stats = useApi(() => api.get('/stats'), [])

  function changeFilter(name, value) {
    setFilters(name === 'reset' ? EMPTY_FILTERS : { ...filters, [name]: value })
    setPage(1)
  }

  // Keep the list row in sync with the panel (used by the optimistic update)
  function updateTicketInList(ticket) {
    tickets.setData((current) =>
      current && { ...current, data: current.data.map((t) => (t.id === ticket.id ? { ...t, ...ticket } : t)) }
    )
  }

  // Sends the feed to the import endpoint. Running it twice is safe:
  // existing tickets are updated, agent-chosen categories are kept.
  async function reimportFeed() {
    setImporting(true)
    try {
      const r = await api.post('/tickets/import', { tickets: ticketFeed })
      showToast(
        `Feed imported: ${r.importedCount} new, ${r.updatedCount} updated, ${r.skippedOverrideCount} kept agent category`
      )
      tickets.reload()
      stats.reload()
    } catch (err) {
      showToast(`Import failed: ${err.message}`, 'error')
    } finally {
      setImporting(false)
    }
  }

  const list = tickets.data
  return (
    <>
      <PageHeader
        title="Triage queue"
        subtitle="Review auto-sorted tickets, correct the category, and move them along."
        actions={
          <Button variant="secondary" onClick={reimportFeed} disabled={importing}>
            {importing ? 'Importing…' : 'Re-import feed'}
          </Button>
        }
      />

      <StatsStrip stats={stats.data} />

      <div className={`mt-6 grid gap-6 ${selectedId ? 'lg:grid-cols-[minmax(0,1fr)_420px]' : ''}`}>
        <section className="min-w-0 overflow-hidden rounded-xl border border-line bg-surface">
          <FilterBar filters={filters} search={search} onFilterChange={changeFilter} onSearchChange={setSearch} />

          {tickets.loading && !list && <LoadingState text="Loading tickets…" />}
          {tickets.error && <ErrorState message={tickets.error.message} onRetry={tickets.reload} />}
          {list && list.data.length === 0 && (
            <EmptyState title="No tickets match" text="Try a different search or clear the filters." />
          )}
          {list && list.data.length > 0 && (
            <div className={tickets.loading ? 'opacity-60 transition-opacity' : ''}>
              <TicketList tickets={list.data} selectedId={selectedId} onSelect={setSelectedId} />
              <div className="border-t border-line px-4 pb-4">
                <Pagination page={list.page} totalPages={list.totalPages} total={list.total} onChange={setPage} />
              </div>
            </div>
          )}
        </section>

        {selectedId && (
          // Desktop: sticky side panel. Smaller screens: full-screen sheet.
          <aside className="fixed inset-0 z-40 lg:sticky lg:inset-auto lg:top-8 lg:z-auto lg:h-[calc(100vh-4rem)] lg:overflow-hidden lg:rounded-xl lg:border lg:border-line">
            <TicketPanel
              key={selectedId}
              ticketId={selectedId}
              onClose={() => setSelectedId(null)}
              onTicketChange={updateTicketInList}
              onSaved={stats.reload}
            />
          </aside>
        )}
      </div>
    </>
  )
}
