import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const agentLinks = [
  { to: '/', label: 'Triage queue', end: true },
  { to: '/resources', label: 'Resources' },
  { to: '/bookings', label: 'My bookings' },
]
const adminLinks = [
  { to: '/admin', label: 'Analytics', end: true },
  { to: '/admin/bookings', label: 'Booking requests' },
  { to: '/admin/resources', label: 'Manage resources' },
]

export function Logo({ light = false }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="7" fill={light ? '#ffffff14' : '#16203A'} />
        <path d="M8 9h11l5 7-5 7H8z" fill="#4F46C8" />
        <path d="M8 9h4v14H8z" fill="#D93A3F" />
      </svg>
      <span className={`font-display text-lg font-bold tracking-tight ${light ? 'text-white' : 'text-ink'}`}>
        TriageSync
      </span>
    </span>
  )
}

function NavItem({ to, label, end, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `block rounded-lg px-3 py-2 text-sm transition-colors ${
          isActive ? 'bg-white/12 font-semibold text-white' : 'text-white/65 hover:bg-white/6 hover:text-white'
        }`
      }
    >
      {label}
    </NavLink>
  )
}

export default function Layout() {
  const { user, isAdmin, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const close = () => setMenuOpen(false)

  const sidebar = (
    <div className="flex h-full flex-col bg-ink px-4 py-5">
      <Logo light />
      <nav className="mt-8 space-y-1" aria-label="Main">
        {agentLinks.map((l) => <NavItem key={l.to} {...l} onClick={close} />)}
      </nav>
      {isAdmin && (
        <nav className="mt-7 space-y-1" aria-label="Admin">
          <p className="px-3 pb-1 text-xs text-white/40">Admin</p>
          {adminLinks.map((l) => <NavItem key={l.to} {...l} onClick={close} />)}
        </nav>
      )}
      <div className="mt-auto border-t border-white/10 pt-4">
        <p className="truncate text-sm font-medium text-white">{user.name}</p>
        <p className="truncate text-xs text-white/50">{user.email}</p>
        <button onClick={logout} className="mt-3 text-sm text-white/65 hover:text-white">
          Log out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen lg:pl-60">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 lg:block">{sidebar}</aside>

      {/* Mobile top bar + slide-in menu */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface px-4 lg:hidden">
        <Logo />
        <button
          onClick={() => setMenuOpen(true)}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink hover:bg-ink/5"
          aria-label="Open menu"
        >
          Menu
        </button>
      </header>
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={close} />
          <aside className="absolute inset-y-0 left-0 w-64">{sidebar}</aside>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[1.75rem]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
