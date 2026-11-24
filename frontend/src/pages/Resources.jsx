import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useApi } from '../hooks/useApi'
import { PageHeader } from '../components/Layout'
import { EmptyState, ErrorState, Input, LoadingState, Pagination, Select } from '../components/ui'
import { label } from '../utils/format'

export const RESOURCE_TYPES = ['ROOM', 'LAB', 'EQUIPMENT']

export function TypeIcon({ type }) {
  // Simple shapes so each type is recognisable at a glance
  const shapes = {
    ROOM: <path d="M4 20V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v15M2 20h20M13 12h.01" />,
    LAB: <path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3M7 15h10" />,
    EQUIPMENT: <path d="M3 7h18v10H3zM7 17v3M17 17v3M7 11h4" />,
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden>{shapes[type]}</svg>
    </span>
  )
}

export default function Resources() {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [type, setType] = useState('')
  const [minCapacity, setMinCapacity] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const timer = setTimeout(() => { setDebounced(search.trim()); setPage(1) }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data, loading, error, reload } = useApi(
    () => api.get('/resources', { search: debounced, type, minCapacity, page }),
    [debounced, type, minCapacity, page]
  )

  return (
    <>
      <PageHeader title="Resources" subtitle="Rooms, labs and equipment you can book for hands-on troubleshooting." />

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row">
          <div className="sm:flex-1">
            <Input type="search" placeholder="Search by name" value={search}
              onChange={(e) => setSearch(e.target.value)} aria-label="Search resources" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Select aria-label="Type" placeholder="All types" options={RESOURCE_TYPES} value={type}
              onChange={(e) => { setType(e.target.value); setPage(1) }} />
            <Input type="number" min="1" max="500" placeholder="Min. capacity" aria-label="Minimum capacity"
              value={minCapacity} className="sm:w-36"
              onChange={(e) => { setMinCapacity(e.target.value); setPage(1) }} />
          </div>
        </div>

        {loading && !data && <LoadingState text="Loading resources…" />}
        {error && <ErrorState message={error.message} onRetry={reload} />}
        {data && data.data.length === 0 && (
          <EmptyState title="No resources found" text="Try another name, type or a smaller capacity." />
        )}
        {data && data.data.length > 0 && (
          <div className={loading ? 'opacity-60' : ''}>
            <ul className="divide-y divide-line">
              {data.data.map((r) => (
                <li key={r.id}>
                  <Link to={`/resources/${r.id}`} className="flex items-center gap-4 px-4 py-4 hover:bg-canvas/70 sm:px-5">
                    <TypeIcon type={r.type} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-semibold">
                        <span className="truncate">{r.name}</span>
                        {!r.isActive && <span className="shrink-0 rounded-full bg-ink/5 px-2 py-0.5 text-xs font-normal text-ink-soft">Inactive</span>}
                      </p>
                      <p className="truncate text-sm text-ink-soft">{r.description || 'No description'}</p>
                    </div>
                    <div className="hidden shrink-0 text-right sm:block">
                      <p className="text-sm font-medium">{label(r.type)}</p>
                      <p className="text-xs text-muted">Up to {r.capacity} {r.capacity === 1 ? 'person' : 'people'}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-t border-line px-4 pb-4">
              <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
            </div>
          </div>
        )}
      </div>
    </>
  )
}
