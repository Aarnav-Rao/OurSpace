import { useEffect, useState } from 'react'
import { Search as SearchIcon } from 'lucide-react'
import { Go, sb, H1, Empty } from './lib'

const SRC: [string, string, string, string, string][] = [
  ['memories', 'title,description,location', 'Memories', 'memories', ''], ['albums', 'name,description', 'Albums', 'memories', 'albums'], ['events', 'title,description', 'Events', 'calendar', ''],
  ['bucket_items', 'title,description,category', 'Bucket list', 'plan', 'bucket'], ['notes', 'body', 'Notes', 'home', ''], ['milestones', 'title,note', 'Milestones', 'us', ''], ['date_ideas', 'title,description,location', 'Date ideas', 'plan', 'dates']]

export function Search({ go }: { go: Go }) {
  const [q, setQ] = useState(''), [res, setRes] = useState<any[]>([]), [busy, setBusy] = useState(false)
  useEffect(() => {
    const s = q.replace(/[%,()*"\\]/g, ' ').trim()
    if (s.length < 2) { setRes([]); return }
    setBusy(true)
    const t = setTimeout(async () => {
      const out = await Promise.all(SRC.map(async ([tb, cols, label, tab, sub]) => {
        const { data } = await sb.from(tb).select('*').or(cols.split(',').map(c => `${c}.ilike.%${s}%`).join(',')).limit(8)
        return (data ?? []).map((r: any) => ({ id: tb + r.id, label, tab, sub, text: r.title ?? r.name ?? r.body, meta: r.taken_on ?? r.starts_on ?? r.on_date ?? r.category ?? '' }))
      }))
      setRes(out.flat()); setBusy(false)
    }, 300)
    return () => clearTimeout(t)
  }, [q])
  const groups = [...new Set(res.map(r => r.label))]
  return (
    <div className="fade"><H1>Search</H1>
      <div className="flex items-center gap-3 mt-8"><SearchIcon size={18} className="text-mute" /><input autoFocus className="inp" placeholder="Memories, albums, events, bucket list, notes, milestones, date ideas…" value={q} onChange={e => setQ(e.target.value)} /></div>
      {q.trim().length < 2 ? <Empty t="Type at least two characters." /> : busy && !res.length ? <Empty t="Searching…" /> : !res.length ? <Empty t="No results." /> :
        groups.map(g => <section key={g} className="sec !mt-8"><p className="cap">{g}</p><ul className="divide-y divide-line mt-2">{res.filter(r => r.label === g).map(r => <li key={r.id}><button className="w-full text-left py-3 flex justify-between gap-4 hover:text-accent transition-colors" onClick={() => go(r.tab, r.sub)}><span className="truncate">{r.text}</span><span className="text-xs text-mute shrink-0">{r.meta}</span></button></li>)}</ul></section>)}
    </div>)
}
