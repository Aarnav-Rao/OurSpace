import { useState, FormEvent } from 'react'
import { Check, Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import { Ws, Say, sb, useRows, Sheet, save, remove, day, uploadPhoto, Photo, Empty, Tabs } from './lib'

type Item = { id: string; title: string; description: string | null; category: string; priority: number; status: 'planned' | 'in_progress' | 'completed'; photo_path: string | null; completed_on: string | null; memory_id: string | null }
const CATS = ['Places', 'Restaurants', 'Movies', 'Activities', 'Things to buy', 'Milestones', 'Adventures']
const ST: Record<string, string> = { planned: 'Planned', in_progress: 'In progress', completed: 'Completed' }
const PR = ['', 'High', 'Medium', 'Low']

export function Bucket({ ws, say }: { ws: Ws; say: Say }) {
  const { rows, loading, reload } = useRows<Item>('bucket_items', ws.id)
  const [f, setF] = useState('all'), [cat, setCat] = useState('all'), [form, setForm] = useState<Partial<Item> | null>(null), [file, setFile] = useState<File | null>(null), [busy, setBusy] = useState(false)
  const cats = [...new Set([...CATS, ...rows.map(r => r.category)])]
  const shown = rows.filter(r => (f === 'all' || r.status === f) && (cat === 'all' || r.category === cat)).sort((a, b) => a.priority - b.priority)
  const done = rows.filter(r => r.status === 'completed').length
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!form?.title?.trim()) return say('Please add a title'); setBusy(true)
    try {
      const photo = file ? await uploadPhoto(ws.id, file, 'bucket') : form.photo_path ?? null, status = form.status ?? 'planned'
      const row = { ...form, title: form.title.trim(), description: form.description || null, category: (form.category || 'Adventures').trim(), priority: form.priority ?? 2, status, photo_path: photo, completed_on: status === 'completed' ? (form.completed_on || day()) : null }
      if (await save('bucket_items', row, ws.id, say)) { setForm(null); setFile(null); reload() }
    } catch (err: any) { say(err.message) }
    setBusy(false)
  }
  async function setStatus(it: Item, s: string) {
    const { error } = await sb.from('bucket_items').update({ status: s, completed_on: s === 'completed' ? (it.completed_on || day()) : null }).eq('id', it.id)
    error ? say(error.message) : (s === 'completed' && say('Completed — well done'), reload())
  }
  async function toMemory(it: Item) {
    const { data, error } = await sb.from('memories').insert({ workspace_id: ws.id, title: it.title, description: it.description, taken_on: it.completed_on || day(), photo_path: it.photo_path }).select('id').single()
    if (error || !data) return say(error?.message ?? 'Could not create memory')
    await sb.from('bucket_items').update({ memory_id: data.id }).eq('id', it.id); say('Saved as a memory'); reload()
  }
  return (
    <div className="fade">
      <div className="flex items-end justify-between"><p className="text-mute">{done} of {rows.length} completed</p><button className="pill flex items-center gap-1" onClick={() => { setForm({ status: 'planned', priority: 2, category: 'Adventures' }); setFile(null) }}><Plus size={14} />Add</button></div>
      <div className="h-px bg-line mt-3"><motion.div className="h-px bg-accent" initial={false} animate={{ width: rows.length ? `${done / rows.length * 100}%` : 0 }} /></div>
      <div className="flex flex-wrap items-center gap-6 mt-6"><Tabs v={f} set={setF} opts={[['all', 'All'], ['planned', 'Planned'], ['in_progress', 'In progress'], ['completed', 'Completed']]} />
        <select className="text-sm text-mute" value={cat} onChange={e => setCat(e.target.value)}><option value="all">All categories</option>{cats.map(c => <option key={c}>{c}</option>)}</select></div>
      {loading ? <Empty t="Loading…" /> : !shown.length ? <Empty t={rows.length ? 'Nothing in this filter.' : 'Your bucket list is empty. Add the first thing you want to do together.'} /> :
        <ul className="divide-y divide-line mt-4">{shown.map(it => <li key={it.id} className="py-4 flex gap-4">
          <Photo path={it.photo_path} className="w-16 h-16 object-cover rounded-sm shrink-0" />
          <div className="flex-1 min-w-0"><p className="font-semibold flex items-center gap-2">{it.status === 'completed' && <motion.span initial={{ scale: .3 }} animate={{ scale: 1 }} className="text-accent"><Check size={16} /></motion.span>}{it.title}</p>
            <p className="text-xs text-mute">{it.category} · {PR[it.priority]} priority{it.completed_on ? ` · done ${it.completed_on}` : ''}</p>{it.description && <p className="text-sm mt-1">{it.description}</p>}
            <div className="flex flex-wrap items-center gap-4 mt-2"><select className="text-sm text-mute" value={it.status} onChange={e => setStatus(it, e.target.value)}>{Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <button className="lnk" onClick={() => { setForm(it); setFile(null) }}>Edit</button><button className="lnk" onClick={async () => (await remove('bucket_items', it.id, say)) && reload()}>Delete</button>
              {it.status === 'completed' && (it.memory_id ? <span className="text-xs text-mute">In memories</span> : <button className="text-sm text-accent" onClick={() => toMemory(it)}>Save as memory</button>)}</div></div></li>)}</ul>}
      <Sheet open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit entry' : 'New entry'}>{form && <form onSubmit={submit} className="space-y-4">
        <input className="inp" required placeholder="What do you want to do?" value={form.title ?? ''} onChange={e => setForm({ ...form, title: e.target.value })} />
        <textarea className="inp" rows={2} placeholder="Description" value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} />
        <input className="inp" list="cats" placeholder="Category (pick or type your own)" value={form.category ?? ''} onChange={e => setForm({ ...form, category: e.target.value })} /><datalist id="cats">{cats.map(c => <option key={c} value={c} />)}</datalist>
        <div className="grid grid-cols-2 gap-5"><select className="inp" value={form.priority} onChange={e => setForm({ ...form, priority: +e.target.value })}>{[1, 2, 3].map(p => <option key={p} value={p}>{PR[p]} priority</option>)}</select>
          <select className="inp" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Item['status'] })}>{Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        {form.status === 'completed' && <input className="inp" type="date" value={form.completed_on ?? day()} onChange={e => setForm({ ...form, completed_on: e.target.value })} />}
        <input type="file" accept="image/*" className="text-sm text-mute" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        <button className="pill" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></form>}</Sheet>
    </div>)
}
