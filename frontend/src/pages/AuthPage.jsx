// Login and register share one layout; "mode" decides which form is shown.
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Logo } from '../components/Layout'
import { Button, Field, Input } from '../components/ui'

const DEMO_ACCOUNTS = [
  { role: 'Agent', email: 'user@triagesync.test', password: 'User@123' },
  { role: 'Admin', email: 'admin@triagesync.test', password: 'Admin@123' },
]

// Decorative stack of triage tags on the brand panel
function TagStack() {
  const rows = [
    ['bg-urgent', 'Production down for our team', 'w-[86%]'],
    ['bg-high', 'My package has not arrived', 'w-[74%]'],
    ['bg-medium', 'Locked out after 2FA reset', 'w-[80%]'],
    ['bg-low', 'Export reports to CSV', 'w-[64%]'],
  ]
  return (
    <div className="space-y-2.5" aria-hidden>
      {rows.map(([color, text, width]) => (
        <div key={text} className={`flex items-center gap-3 rounded-lg bg-white/[0.07] py-2.5 pr-4 ${width}`}>
          <span className={`h-8 w-1.5 rounded-r ${color}`} />
          <span className="truncate text-sm text-white/80">{text}</span>
        </div>
      ))}
    </div>
  )
}

export default function AuthPage({ mode }) {
  const isLogin = mode === 'login'
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (isLogin) await login(form.email, form.password)
      else await register(form.name, form.email, form.password)
      navigate(location.state?.from || '/', { replace: true })
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden flex-col justify-between bg-ink p-12 lg:flex">
        <Logo light />
        <div className="max-w-md">
          <h2 className="font-display text-4xl font-bold leading-[1.1] tracking-tight text-white">
            Sort every ticket by what matters most.
          </h2>
          <p className="mt-4 text-white/65">
            Incoming tickets are categorised and prioritised automatically. Agents review them, and book rooms, labs and
            equipment when a fix needs hands-on time.
          </p>
          <div className="mt-10"><TagStack /></div>
        </div>
        <p className="text-xs text-white/40">Support triage and resource scheduling</p>
      </section>

      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {isLogin ? 'Log in' : 'Create your account'}
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            {isLogin ? 'Welcome back. Your queue is waiting.' : 'New accounts join as support agents.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
            {!isLogin && (
              <Field label="Full name">
                <Input value={form.name} onChange={update('name')} autoComplete="name" required />
              </Field>
            )}
            <Field label="Email">
              <Input type="email" value={form.email} onChange={update('email')} autoComplete="email" required />
            </Field>
            <Field label="Password" hint={!isLogin ? '8–64 characters, with at least one letter and one number' : undefined}>
              <Input
                type="password"
                value={form.password}
                onChange={update('password')}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                required
              />
            </Field>

            {error && <p role="alert" className="rounded-lg bg-[#fbe5e5] px-3 py-2 text-sm text-danger">{error}</p>}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Please wait…' : isLogin ? 'Log in' : 'Create account'}
            </Button>
          </form>

          <p className="mt-6 text-sm text-ink-soft">
            {isLogin ? 'No account yet? ' : 'Already registered? '}
            <Link to={isLogin ? '/register' : '/login'} className="font-medium text-accent hover:underline">
              {isLogin ? 'Create one' : 'Log in'}
            </Link>
          </p>

          {isLogin && (
            <div className="mt-10 rounded-xl border border-line bg-surface p-4">
              <p className="text-sm font-medium">Demo accounts</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    onClick={() => setForm({ ...form, email: a.email, password: a.password })}
                    className="rounded-lg border border-line px-3 py-2 text-left text-sm hover:border-accent"
                  >
                    <span className="block font-medium">{a.role}</span>
                    <span className="block truncate text-xs text-muted">{a.email}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
