import { useState } from 'react'
import { api } from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { useApi } from '../../hooks/useApi'
import { PageHeader } from '../../components/Layout'
import { Button, EmptyState, ErrorState, Field, Input, LoadingState, Modal, Pagination, Select, Textarea } from '../../components/ui'
import { RESOURCE_TYPES, TypeIcon } from '../Resources'
import { label } from '../../utils/format'

const EMPTY = { name: '', type: 'ROOM', capacity: '', description: '' }

function ResourceForm({ initial, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await onSubmit({
        name: form.name,
        type: form.type,
        capacity: Number(form.capacity),
        description: form.description.trim() || null,
      })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Name" hint="3–60 characters, must be unique">
        <Input value={form.name} onChange={update('name')} autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <Select options={RESOURCE_TYPES} value={form.type} onChange={update('type')} />
        </Field>
        <Field label="Capacity" hint="1–500">
          <Input type="number" min="1" max="500" value={form.capacity} onChange={update('capacity')} />
        </Field>
      </div>
      <Field label="Description (optional)" hint="Up to 300 characters">
        <Textarea value={form.description} onChange={update('description')} />
      </Field>
      {error && <p role="alert" className="rounded-lg bg-[#fbe5e5] px-3 py-2 text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save resource'}</Button>
      </div>
    </form>
  )
}

export default function AdminResources() {
  const showToast = useToast()
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(null) // null = closed, {} = new, resource = edit

  const { data, loading, error, reload } = useApi(() => api.get('/resources', { page }), [page])

  async function save(values) {
    if (editing.id) await api.patch(`/resources/${editing.id}`, values)
    else await api.post('/resources', values)
    showToast(editing.id ? 'Resource saved' : 'Resource created')
    setEditing(null)
    reload()
  }

  async function toggleActive(r) {
    try {
      await api.patch(`/resources/${r.id}`, { isActive: !r.isActive })
      showToast(r.isActive ? `${r.name} deactivated` : `${r.name} activated`)
      reload()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  return (
    <>
      <PageHeader
        title="Manage resources"
        subtitle="Inactive resources are hidden from agents and can't be booked."
        actions={<Button onClick={() => setEditing({})}>Add resource</Button>}
      />

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {loading && !data && <LoadingState text="Loading resources…" />}
        {error && <ErrorState message={error.message} onRetry={reload} />}
        {data && data.data.length === 0 && <EmptyState title="No resources yet" text="Add the first room, lab or device." />}
        {data && data.data.length > 0 && (
          <>
            <ul className="divide-y divide-line">
              {data.data.map((r) => (
                <li key={r.id} className={`flex flex-wrap items-center gap-4 px-4 py-4 sm:px-5 ${r.isActive ? '' : 'bg-canvas/50'}`}>
                  <TypeIcon type={r.type} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{r.name}</p>
                    <p className="text-sm text-ink-soft">{label(r.type)}, capacity {r.capacity}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Toggle switch for isActive */}
                    <button
                      role="switch"
                      aria-checked={r.isActive}
                      aria-label={`${r.name} active`}
                      onClick={() => toggleActive(r)}
                      className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-ink-soft hover:bg-ink/5"
                    >
                      <span className={`relative h-5 w-9 rounded-full transition-colors ${r.isActive ? 'bg-ok' : 'bg-low/50'}`}>
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left] ${r.isActive ? 'left-[18px]' : 'left-0.5'}`} />
                      </span>
                      {r.isActive ? 'Active' : 'Inactive'}
                    </button>
                    <Button variant="secondary" size="sm" onClick={() => setEditing(r)}>Edit</Button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-line px-4 pb-4">
              <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
            </div>
          </>
        )}
      </div>

      <Modal open={Boolean(editing)} title={editing?.id ? `Edit ${editing.name}` : 'Add resource'} onClose={() => setEditing(null)}>
        {editing && (
          <ResourceForm
            key={editing.id || 'new'}
            initial={editing.id ? { ...editing, capacity: String(editing.capacity), description: editing.description || '' } : EMPTY}
            onSubmit={save}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </>
  )
}
