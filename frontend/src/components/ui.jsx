// Small reusable UI building blocks used by every page.
import { useEffect, useRef } from 'react'
import { label } from '../utils/format'

export function Button({ variant = 'primary', size = 'md', className = '', ...props }) {
  const variants = {
    primary: 'bg-accent text-white hover:bg-[#4239b3] disabled:bg-accent/50',
    secondary: 'bg-surface text-ink border border-line hover:border-ink-soft/40 hover:bg-canvas/60',
    danger: 'bg-danger text-white hover:bg-[#a92d32] disabled:bg-danger/50',
    ghost: 'text-ink-soft hover:text-ink hover:bg-ink/5',
  }
  const sizes = { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4 text-sm' }
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  )
}

export function Field({ label: text, error, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{text}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  )
}

const fieldClass =
  'w-full rounded-lg border border-line bg-surface text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20'
const inputClass = `px-3 ${fieldClass}`

export function Input(props) {
  return <input className={`h-10 ${inputClass}`} {...props} />
}

export function Textarea(props) {
  return <textarea className={`py-2 ${inputClass}`} rows={3} {...props} />
}

// The browser's own dropdown arrow takes ~20px inside the box, which cut off
// "Category" in the 3-column filter bar on phones. We hide it (appearance-none)
// and draw a small chevron in the right padding instead.
const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%235A6478' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`
const chevronStyle = {
  backgroundImage: CHEVRON,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 0.5rem center',
  backgroundSize: '10px 6px',
}

export function Select({ options, placeholder, className = '', style, ...props }) {
  return (
    <select
      className={`h-10 min-w-0 appearance-none truncate pl-2.5 pr-5 ${fieldClass} ${className}`}
      style={{ ...chevronStyle, ...style }}
      {...props}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o} value={o}>{label(o)}</option>
      ))}
    </select>
  )
}

// The triage tag: a coloured stripe + word, the visual signature of the app
const PRIORITY_COLORS = { URGENT: 'bg-urgent', HIGH: 'bg-high', MEDIUM: 'bg-medium', LOW: 'bg-low' }
export function PriorityTag({ priority }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
      <span className={`h-2.5 w-2.5 rounded-sm ${PRIORITY_COLORS[priority]}`} aria-hidden />
      {label(priority)}
    </span>
  )
}
export const priorityBg = (p) => PRIORITY_COLORS[p]

const STATUS_STYLES = {
  OPEN: 'bg-accent-soft text-accent',
  IN_PROGRESS: 'bg-[#fdf1dc] text-[#9a5b00]',
  RESOLVED: 'bg-[#e1f3ea] text-ok',
  CLOSED: 'bg-ink/5 text-ink-soft',
  PENDING: 'bg-[#fdf1dc] text-[#9a5b00]',
  APPROVED: 'bg-[#e1f3ea] text-ok',
  REJECTED: 'bg-[#fbe5e5] text-danger',
  CANCELLED: 'bg-ink/5 text-ink-soft',
}
export function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] || ''}`}>
      {label(status)}
    </span>
  )
}

export function Spinner({ className = '' }) {
  return (
    <span
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
      role="status"
      aria-label="Loading"
    />
  )
}

// Loading / error / empty states - every page uses these
export function LoadingState({ text = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-muted">
      <Spinner className="text-accent" /> {text}
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="mx-auto max-w-md py-14 text-center">
      <p className="font-display text-lg font-semibold">Couldn't load this</p>
      <p className="mt-1 text-sm text-ink-soft">{message}</p>
      {onRetry && <Button variant="secondary" className="mt-4" onClick={onRetry}>Try again</Button>}
    </div>
  )
}

export function EmptyState({ title, text, action }) {
  return (
    <div className="mx-auto max-w-md py-14 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      {text && <p className="mt-1 text-sm text-ink-soft">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Pagination({ page, totalPages, total, onChange }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between gap-3 pt-4 text-sm text-ink-soft">
      <span>Page {page} of {totalPages} <span className="text-muted">({total} total)</span></span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button>
        <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next</Button>
      </div>
    </div>
  )
}

// Accessible modal using the native <dialog> element
export function Modal({ open, title, onClose, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/40"
    >
      {open && (
        <div className="p-6">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <div className="mt-3">{children}</div>
        </div>
      )}
    </dialog>
  )
}
