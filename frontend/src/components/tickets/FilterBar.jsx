import { Input, Select } from '../ui'

export const CATEGORIES = ['BILLING', 'BUG', 'FEATURE_REQUEST', 'LOGIN', 'DELIVERY']
export const PRIORITIES = ['URGENT', 'HIGH', 'MEDIUM', 'LOW']
export const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']

// Changing any control updates the list straight away (no page reload).
export default function FilterBar({ filters, search, onFilterChange, onSearchChange }) {
  const hasFilters = filters.status || filters.category || filters.priority || search
  return (
    <div className="flex flex-col gap-2 border-b border-line p-3 md:flex-row md:flex-wrap md:items-center">
      <div className="md:min-w-56 md:flex-1">
        <Input
          type="search"
          placeholder="Search subject and message"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search tickets"
        />
      </div>
      <div className="grid grid-cols-3 gap-2 md:flex">
        <Select aria-label="Status" placeholder="Status" options={STATUSES}
          value={filters.status} onChange={(e) => onFilterChange('status', e.target.value)} />
        <Select aria-label="Category" placeholder="Category" options={CATEGORIES}
          value={filters.category} onChange={(e) => onFilterChange('category', e.target.value)} />
        <Select aria-label="Priority" placeholder="Priority" options={PRIORITIES}
          value={filters.priority} onChange={(e) => onFilterChange('priority', e.target.value)} />
      </div>
      {hasFilters && (
        <button
          onClick={() => { onSearchChange(''); onFilterChange('reset') }}
          className="self-start px-2 text-sm text-accent hover:underline md:self-center"
        >
          Clear
        </button>
      )}
    </div>
  )
}
