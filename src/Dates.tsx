import { useState, FormEvent } from 'react'
import { Plus, Shuffle } from 'lucide-react'
import { Ws, Say, sb, useRows, Sheet, save, remove, day, Empty } from './lib'

type Idea = { id: string; title: string; description: string | null; location: string | null; budget: number | null; setting: 'indoor' | 'outdoor'; minutes: number | null; kind: string | null; done_on: string | null; memory_id: string | null }
const KINDS = ['Dinner', 'Home', 'Outdoors', 'Culture', 'Adventure', 'Trip', 'Dessert']

export function Dates({ ws, say }: { ws: Ws; say: Say }) {
  const { rows, loading, reload } = useRows<Idea>('date_ideas', ws.id)
  const [set, setSet] = useState(''), [budget, setBudget] = useState(''), [mins, setMins] = useState(''), [kind, setKind] = useState('')
  const [form, setForm] = useState<Partial<Idea> | null>(null), [pick, setPick] = useState<Idea | null>(null)
  const ok = (r: Idea) => (!set || r.setting === set) && (!budget || (r.budget ?? 0) <= +budget) && (!mins || (r.minutes ?? 0) <= +mins) && (!kind || r.kind === kind)
  const shown = rows.filter(ok)
  const random = () => { const pool = shown.filter(r => !r.done_on); if (!pool.length) return say('No unfinished ideas match these filters'); setPick(pool[Math.floor(Math.random() * pool.length)]) }
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!form?.title?.trim()) return say('Please add a title')
    const row = { ...form, title: form.title.trim(), description: form.description || null, location: form.location || null, budget: form.budget == null || (form.budget as any) === '' ? null : +form.budget!, minutes: form.minutes ? +form.minutes : null, setting: form.setting ?? 'outdoor' }
    if (await save('date_ideas', row, ws.id, say)) { setForm(null); reload() }
  }
  async function finish(r: Idea) { const { error } = await sb.from('date_ideas').update({ done_on: day() }).eq('id', r.id); error ? say(error.message) : (say('Marked as done'), setPick(null), reload()) }
  async function toMemory(r: Idea) {
    const { data, error } = await sb.from('memories').insert({ workspace_id: ws.id, title: r.title, description: r.description, location: r.location, taken_on: r.done_on || day() }).select('id').single()
    if (error || !data) return say(error?.message ?? 'Could not create memory')
    await sb.from('date_ideas').update({ memory_id: data.id }).eq('id', r.id); say('Saved as a memory — add photos from Memories'); reload()
  }
  return (
    <div className="fade">
      <div className="flex items-end justify-between"><p className="text-mute">{rows.filter(r => r.done_on).length} of {rows.length} done</p>
        <div className="flex gap-3"><button className="pill flex items-center gap-1" onClick={random}><Shuffle size={14} />Surprise us</button><button className="pill flex items-center gap-1" onClick={() => setForm({ setting: 'outdoor' })}><Plus size={14} />Idea</button></div></div>
      <div className="flex flex-wrap gap-6 mt-6 text-sm text-mute">
        <select value={set} onChange={e => setSet(e.target.value)}><option value="">Indoor or outdoor</option><option value="indoor">Indoor</option><option value="outdoor">Outdoor</option></select>
        <select value={mins} onChange={e => setMins(e.target.value)}><option value="">Any time</option><option value="60">Up to 1 hour</option><option value="120">Up to 2 hours</option><option value="240">Up to 4 hours</option></select>
        <select value={budget} onChange={e => setBudget(e.target.value)}><option value="">Any budget</option><option value="0">Free</option><option value="500">Up to 500</option><option value="1500">Up to 1500</option><option value="5000">Up to 5000</option></select>
        <select value={kind} onChange={e => setKind(e.target.value)}><option value="">Any type</option>{KINDS.map(k => <option key={k}>{k}</option>)}</select></div>
      {pick && <section className="sec fade"><p className="cap">Tonight’s idea</p><h2 className="text-3xl font-extrabold tracking-tight mt-2">{pick.title}</h2>
        <p className="text-mute text-sm mt-1">{[pick.location, pick.budget != null && `Budget ${pick.budget}`, pick.minutes && `${pick.minutes} min`, pick.setting].filter(Boolean).join(' · ')}</p>{pick.description && <p className="mt-2">{pick.description}</p>}
        <div className="flex gap-5 mt-4"><button className="pill" onClick={() => finish(pick)}>We did it</button><button className="lnk" onClick={random}>Another</button><button className="lnk" onClick={() => setPick(null)}>Close</button></div></section>}
      {loading ? <Empty t="Loading…" /> : !shown.length ? <Empty t={rows.length ? 'No ideas match these filters.' : 'No ideas yet. Save the first date you’d love to go on.'} /> :
        <ul className="divide-y divide-line mt-6">{shown.map(r => <li key={r.id} className="py-4"><p className={`font-semibold ${r.done_on ? 'text-mute' : ''}`}>{r.title}</p>
          <p className="text-xs text-mute">{[r.kind, r.setting, r.location, r.budget != null && `Budget ${r.budget}`, r.minutes && `${r.minutes} min`, r.done_on && `done ${r.done_on}`].filter(Boolean).join(' · ')}</p>{r.description && <p className="text-sm mt-1">{r.description}</p>}
          <div className="flex gap-4 mt-2">{!r.done_on && <button className="text-sm text-accent" onClick={() => finish(r)}>Mark done</button>}
            {r.done_on && (r.memory_id ? <span className="text-xs text-mute">In memories</span> : <button className="text-sm text-accent" onClick={() => toMemory(r)}>Save as memory</button>)}
            <button className="lnk" onClick={() => setForm(r)}>Edit</button><button className="lnk" onClick={async () => (await remove('date_ideas', r.id, say)) && reload()}>Delete</button></div></li>)}</ul>}
      <Sheet open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit idea' : 'New date idea'}>{form && <form onSubmit={submit} className="space-y-4">
        <input className="inp" required placeholder="Title" value={form.title ?? ''} onChange={e => setForm({ ...form, title: e.target.value })} />
        <input className="inp" placeholder="Location" value={form.location ?? ''} onChange={e => setForm({ ...form, location: e.target.value })} />
        <textarea className="inp" rows={2} placeholder="Notes" value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} />
        <div className="grid grid-cols-2 gap-5"><input className="inp" type="number" min="0" placeholder="Budget" value={form.budget ?? ''} onChange={e => setForm({ ...form, budget: e.target.value as any })} /><input className="inp" type="number" min="0" placeholder="Minutes" value={form.minutes ?? ''} onChange={e => setForm({ ...form, minutes: e.target.value as any })} /></div>
        <div className="grid grid-cols-2 gap-5"><select className="inp" value={form.setting} onChange={e => setForm({ ...form, setting: e.target.value as any })}><option value="outdoor">Outdoor</option><option value="indoor">Indoor</option></select>
          <select className="inp" value={form.kind ?? ''} onChange={e => setForm({ ...form, kind: e.target.value })}><option value="">Type</option>{KINDS.map(k => <option key={k}>{k}</option>)}</select></div>
        <button className="pill">Save</button></form>}</Sheet>
    </div>)
}
