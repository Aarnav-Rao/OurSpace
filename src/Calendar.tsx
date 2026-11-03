import { useMemo, useState, FormEvent } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Ws, Say, useRows, Sheet, save, remove, day, pad, nextOn, daysUntil, when, KIND_COLOR, H1, Empty } from './lib'

export type Ev = { id: string; title: string; description: string | null; kind: string; starts_on: string; ends_on: string | null; yearly: boolean; remind_days: number }
const KINDS = ['birthday', 'anniversary', 'date', 'trip', 'personal']
export const occurs = (e: Ev, d: string) => e.yearly ? e.starts_on.slice(5) === d.slice(5) && d >= e.starts_on : e.ends_on ? d >= e.starts_on && d <= e.ends_on : e.starts_on === d
const Dot = ({ k }: { k: string }) => <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: KIND_COLOR[k] }} />

export function Calendar({ ws, say }: { ws: Ws; say: Say }) {
  const { rows, loading, reload } = useRows<Ev>('events', ws.id, ['starts_on', true])
  const [m, setM] = useState(() => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), 1) })
  const [sel, setSel] = useState(day()), [form, setForm] = useState<Partial<Ev> | null>(null)
  const y = m.getFullYear(), mo = m.getMonth(), first = (new Date(y, mo, 1).getDay() + 6) % 7, n = new Date(y, mo + 1, 0).getDate()
  const cells = [...Array(first).fill(null), ...Array.from({ length: n }, (_, i) => `${y}-${pad(mo + 1)}-${pad(i + 1)}`)]
  const on = (d: string) => rows.filter(e => occurs(e, d))
  const upcoming = useMemo(() => rows.map(e => ({ e, n: daysUntil(nextOn(e.starts_on, e.yearly)) })).filter(x => x.n >= 0).sort((a, b) => a.n - b.n).slice(0, 5), [rows])
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!form?.title?.trim()) return say('Please add a title')
    if (form.ends_on && form.ends_on < form.starts_on!) return say('End date is before the start date')
    if (await save('events', { ...form, title: form.title.trim(), ends_on: form.ends_on || null, description: form.description || null }, ws.id, say)) { setForm(null); reload() }
  }
  const add = () => setForm({ kind: 'date', starts_on: sel, yearly: false, remind_days: 0 })
  return (
    <div className="fade">
      <div className="flex items-end justify-between"><H1>Calendar</H1><button className="pill flex items-center gap-1" onClick={add}><Plus size={14} />Event</button></div>
      <div className="sec flex items-center justify-between">
        <h2 className="text-2xl font-semibold">{m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
        <div className="flex gap-4 items-center"><button className="lnk" aria-label="Previous month" onClick={() => setM(new Date(y, mo - 1, 1))}><ChevronLeft size={18} /></button>
          <button className="lnk" onClick={() => { const t = new Date(); setM(new Date(t.getFullYear(), t.getMonth(), 1)); setSel(day()) }}>Today</button>
          <button className="lnk" aria-label="Next month" onClick={() => setM(new Date(y, mo + 1, 1))}><ChevronRight size={18} /></button></div></div>
      <div className="grid grid-cols-7 mt-4 text-center">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="cap pb-2">{d}</span>)}
        {cells.map((d: string | null, i) => d ? <button key={d} onClick={() => setSel(d)} className={`h-14 flex flex-col items-center justify-start pt-2 gap-1 border-t border-line transition-colors ${sel === d ? 'text-accent' : ''} ${d === day() ? 'font-extrabold' : ''}`}>
          <span className={sel === d ? 'underline underline-offset-4' : ''}>{+d.slice(8)}</span><span className="flex gap-0.5 h-1.5">{on(d).slice(0, 3).map(e => <Dot key={e.id} k={e.kind} />)}</span></button> : <span key={'b' + i} className="border-t border-line" />)}</div>
      <div className="flex flex-wrap gap-4 mt-3 text-xs text-mute">{KINDS.map(k => <span key={k} className="flex items-center gap-1 capitalize"><Dot k={k} />{k}</span>)}</div>
      <section className="sec">
        <div className="flex justify-between"><p className="cap">{new Date(sel + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p><button className="lnk" onClick={add}>Add here</button></div>
        {loading ? <Empty t="Loading…" /> : !on(sel).length ? <Empty t="Nothing planned." /> : <ul className="divide-y divide-line mt-3">{on(sel).map(e => <li key={e.id} className="py-3 flex justify-between gap-4">
          <div><p className="flex items-center gap-2 font-semibold"><Dot k={e.kind} />{e.title}</p>{e.description && <p className="text-sm text-mute">{e.description}</p>}{e.remind_days > 0 && <p className="text-xs text-mute">Reminder {e.remind_days} day{e.remind_days > 1 ? 's' : ''} before</p>}</div>
          <span className="space-x-3 shrink-0"><button className="lnk" onClick={() => setForm(e)}>Edit</button><button className="lnk" onClick={async () => (await remove('events', e.id, say)) && reload()}>Delete</button></span></li>)}</ul>}
      </section>
      <section className="sec"><p className="cap">Coming up</p>{!upcoming.length ? <Empty t="No upcoming events." /> : <ul className="mt-3 space-y-2">{upcoming.map(({ e, n }) => <li key={e.id} className="flex items-center gap-2"><Dot k={e.kind} />{e.title}<span className="text-mute text-sm">· {when(n)}</span></li>)}</ul>}</section>
      <Sheet open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit event' : 'New event'}>{form && <form onSubmit={submit} className="space-y-4">
        <input className="inp" required placeholder="Title" value={form.title ?? ''} onChange={e => setForm({ ...form, title: e.target.value })} />
        <select className="inp capitalize" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value, yearly: ['birthday', 'anniversary'].includes(e.target.value) ? true : form.yearly })}>{KINDS.map(k => <option key={k}>{k}</option>)}</select>
        <div className="grid grid-cols-2 gap-5"><div><label className="cap">Starts</label><input className="inp" type="date" required value={form.starts_on ?? ''} onChange={e => setForm({ ...form, starts_on: e.target.value })} /></div>
          <div><label className="cap">Ends (optional)</label><input className="inp" type="date" value={form.ends_on ?? ''} onChange={e => setForm({ ...form, ends_on: e.target.value })} /></div></div>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={!!form.yearly} onChange={e => setForm({ ...form, yearly: e.target.checked })} />Repeats every year</label>
        <select className="inp" value={form.remind_days ?? 0} onChange={e => setForm({ ...form, remind_days: +e.target.value })}><option value={0}>No reminder</option><option value={1}>Remind 1 day before</option><option value={3}>Remind 3 days before</option><option value={7}>Remind 1 week before</option></select>
        <textarea className="inp" rows={2} placeholder="Description" value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} />
        <button className="pill">Save</button></form>}</Sheet>
    </div>)
}
