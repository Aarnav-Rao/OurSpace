import { useMemo } from 'react'
import { Ws, Go, useRows, nextOn, daysUntil, when, KIND_COLOR } from './lib'
import type { Ev } from './Calendar'

export function Upcoming({ ws, go }: { ws: Ws; go: Go }) {
  const ev = useRows<Ev>('events', ws.id, ['starts_on', true]), ms = useRows<any>('milestones', ws.id, ['on_date', true])
  const items = useMemo(() => [
    ...ev.rows.map(e => ({ id: e.id, title: e.title, kind: e.kind, n: daysUntil(nextOn(e.starts_on, e.yearly)), remind: e.remind_days })),
    ...ms.rows.map(m => ({ id: m.id, title: m.title, kind: m.kind, n: daysUntil(nextOn(m.on_date, m.yearly)), remind: 0 }))]
    .filter(x => x.n >= 0).sort((a, b) => a.n - b.n).slice(0, 5), [ev.rows, ms.rows])
  return (
    <section className="sec"><p className="cap flex justify-between">Upcoming<button className="lnk normal-case tracking-normal" onClick={() => go('calendar')}>Calendar</button></p>
      {!items.length ? <p className="text-mute text-sm mt-3">Nothing coming up yet.</p> : <ul className="mt-3 space-y-2">{items.map(x => <li key={x.id} className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ background: KIND_COLOR[x.kind] ?? 'var(--mute)' }} />{x.title}
        <span className="text-mute text-sm">· {when(x.n)}</span>{x.remind > 0 && x.n <= x.remind && <span className="text-xs text-accent">reminder</span>}</li>)}</ul>}
    </section>)
}
export function Quick({ go }: { go: Go }) {
  return <section className="sec"><p className="cap">Jump to</p><div className="flex flex-wrap gap-8 mt-3">
    <button className="lnk" onClick={() => go('memories')}>Memories →</button><button className="lnk" onClick={() => go('plan', 'bucket')}>Bucket list →</button>
    <button className="lnk" onClick={() => go('plan', 'dates')}>Date ideas →</button><button className="lnk" onClick={() => go('memories', 'onthisday')}>On this day →</button></div></section>
}
