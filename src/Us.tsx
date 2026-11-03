import { useEffect, useState, FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { animate } from 'framer-motion'
import { Ws, Say, useRows, Sheet, save, remove, day, nextOn, daysUntil, when, KIND_COLOR, H1, Empty } from './lib'
import type { Ev } from './Calendar'

type Mi = { id: string; title: string; on_date: string; yearly: boolean; kind: string; note: string | null }
const ord = (n: number) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10 < 4 ? n % 10 : 0])
function Count({ to }: { to: number }) {
  const [v, setV] = useState(0)
  useEffect(() => { const c = animate(0, to, { duration: 1.2, onUpdate: x => setV(Math.round(x)) }); return () => c.stop() }, [to])
  return <>{v.toLocaleString()}</>
}
export function Us({ ws, say }: { ws: Ws; say: Say }) {
  const ms = useRows<Mi>('milestones', ws.id, ['on_date', true]), ev = useRows<Ev>('events', ws.id, ['starts_on', true])
  const [form, setForm] = useState<Partial<Mi> | null>(null), since = ws.together_since
  const days = since ? Math.floor((Date.now() - new Date(since + 'T00:00:00').getTime()) / 864e5) : null
  const ann = since ? nextOn(since, true) : null
  const coming = [
    ...(ann && since ? [{ id: 'ann', title: `Our ${ord(ann.getFullYear() - +since.slice(0, 4))} anniversary`, kind: 'anniversary', n: daysUntil(ann) }] : []),
    ...ev.rows.filter(e => e.kind === 'birthday').map(e => ({ id: e.id, title: `${e.title}`, kind: 'birthday', n: daysUntil(nextOn(e.starts_on, true)) })),
    ...ms.rows.filter(m => m.yearly).map(m => ({ id: m.id, title: m.title, kind: m.kind, n: daysUntil(nextOn(m.on_date, true)) }))].sort((a, b) => a.n - b.n)
  const tl: (Mi & { fixed?: boolean })[] = [...(since ? [{ id: 'start', title: 'We began', on_date: since, yearly: false, kind: 'first', note: null, fixed: true }] : []), ...ms.rows].sort((a, b) => a.on_date.localeCompare(b.on_date))
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!form?.title?.trim() || !form.on_date) return say('Add a title and a date')
    if (await save('milestones', { ...form, title: form.title.trim(), note: form.note || null }, ws.id, say)) { setForm(null); ms.reload() }
  }
  return (
    <div className="fade">
      <div className="flex items-end justify-between"><H1>Us</H1><button className="pill flex items-center gap-1" onClick={() => setForm({ kind: 'custom', yearly: false, on_date: day() })}><Plus size={14} />Milestone</button></div>
      {days === null ? <Empty t="Set your “together since” date in Settings to see your days together." /> : <section className="sec"><p className="text-7xl md:text-8xl font-extralight tracking-tight"><Count to={days} /></p><p className="text-mute mt-2">days together{ann && since ? ` · ${when(daysUntil(ann))} until your ${ord(ann.getFullYear() - +since.slice(0, 4))} anniversary` : ''}</p></section>}
      <section className="sec"><p className="cap">Coming up</p>{!coming.length ? <Empty t="Add birthdays in the calendar and yearly milestones here." /> :
        <ul className="mt-3 divide-y divide-line">{coming.map(c => <li key={c.id} className="py-3 flex justify-between"><span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ background: KIND_COLOR[c.kind] ?? 'var(--mute)' }} />{c.title}</span><span className="text-mute text-sm">{when(c.n)}</span></li>)}</ul>}</section>
      <section className="sec"><p className="cap">Timeline</p><ol className="mt-4 border-l border-line ml-1">{tl.map(m => { const future = m.on_date > day(); return <li key={m.id} className={`pl-6 pb-7 relative ${future ? 'opacity-60' : ''}`}>
        <span className="absolute -left-[5px] top-2 w-2.5 h-2.5 rounded-full" style={{ background: KIND_COLOR[m.kind] ?? 'var(--accent)' }} />
        <p className="text-xs text-mute">{new Date(m.on_date + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}{m.yearly ? ' · yearly' : ''}</p><p className="font-semibold">{m.title}</p>{m.note && <p className="text-sm text-mute">{m.note}</p>}
        {!(m as any).fixed && <span className="space-x-3"><button className="lnk" onClick={() => setForm(m)}>Edit</button><button className="lnk" onClick={async () => (await remove('milestones', m.id, say)) && ms.reload()}>Delete</button></span>}</li> })}</ol></section>
      <Sheet open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit milestone' : 'New milestone'}>{form && <form onSubmit={submit} className="space-y-4">
        <input className="inp" required placeholder="Title (e.g. First trip together)" value={form.title ?? ''} onChange={e => setForm({ ...form, title: e.target.value })} />
        <input className="inp" type="date" required value={form.on_date ?? ''} onChange={e => setForm({ ...form, on_date: e.target.value })} />
        <select className="inp capitalize" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>{['first', 'anniversary', 'trip', 'custom'].map(k => <option key={k}>{k}</option>)}</select>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={!!form.yearly} onChange={e => setForm({ ...form, yearly: e.target.checked })} />Celebrate every year</label>
        <textarea className="inp" rows={2} placeholder="Note" value={form.note ?? ''} onChange={e => setForm({ ...form, note: e.target.value })} /><button className="pill">Save</button></form>}</Sheet>
    </div>)
}
