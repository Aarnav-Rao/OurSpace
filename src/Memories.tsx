import { useCallback, useEffect, useState, FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { Ws, Say, Mem, sb, sign, useLive, useRows, Sheet, uploadPhoto, download, safe, day, H1, Tabs, Empty } from './lib'
import { Albums, OnThisDay, Album } from './Albums'

type V = 'gallery' | 'timeline' | 'albums' | 'onthisday'
export function Memories({ ws, say, sub }: { ws: Ws; say: Say; sub?: string }) {
  const [list, setList] = useState<Mem[]>([]), [urls, setUrls] = useState<Record<string, string>>({}), [view, setView] = useState<V>(sub === 'albums' || sub === 'onthisday' ? sub : 'gallery'), [q, setQ] = useState(''), [alb, setAlb] = useState('')
  const [form, setForm] = useState<Partial<Mem> | null>(null), [file, setFile] = useState<File | null>(null), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true)
  const albums = useRows<Album>('albums', ws.id, ['created_at', true])
  const load = useCallback(async () => {
    const { data, error } = await sb.from('memories').select('*').order('taken_on', { ascending: false })
    if (error) say(error.message)
    const l = (data ?? []) as Mem[]; setList(l); setUrls(await sign(l.map(m => m.photo_path ?? ''))); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load]); useLive(ws.id, ['memories'], load)
  async function save(e: FormEvent) {
    e.preventDefault(); if (!form?.title?.trim()) return say('Please add a title'); setBusy(true)
    try {
      const path = file ? await uploadPhoto(ws.id, file, 'memory') : form.photo_path ?? null
      const row = { workspace_id: ws.id, title: form.title.trim(), description: form.description || null, location: form.location || null, taken_on: form.taken_on || day(), photo_path: path, album_id: form.album_id || null }
      const r = form.id ? await sb.from('memories').update(row).eq('id', form.id) : await sb.from('memories').insert(row)
      if (r.error) throw r.error
      say('Memory saved'); setForm(null); setFile(null); load()
    } catch (err: any) { say(err.message) }
    setBusy(false)
  }
  async function del(m: Mem) {
    if (!confirm('Delete this memory?')) return
    if (m.photo_path) { const { count } = await sb.from('bucket_items').select('id', { count: 'exact', head: true }).eq('photo_path', m.photo_path); if (!count) await sb.storage.from('photos').remove([m.photo_path]) }
    const { error } = await sb.from('memories').delete().eq('id', m.id); error ? say(error.message) : say('Deleted'); load()
  }
  const s = q.toLowerCase(), shown = list.filter(m => (!alb || m.album_id === alb) && [m.title, m.description, m.location, m.taken_on, albums.rows.find(a => a.id === m.album_id)?.name].join(' ').toLowerCase().includes(s))
  const years = [...new Set(shown.map(m => m.taken_on.slice(0, 4)))]
  const Acts = ({ m }: { m: Mem }) => <span className="space-x-3"><button className="lnk" onClick={() => { setForm(m); setFile(null) }}>Edit</button>{m.photo_path && <button className="lnk" onClick={() => download(m.photo_path!, safe(m.title))}>Download</button>}<button className="lnk" onClick={() => del(m)}>Delete</button></span>
  return (
    <div className="fade">
      <div className="flex items-end justify-between"><H1>Memories</H1><button className="pill flex items-center gap-1" onClick={() => { setForm({ taken_on: day() }); setFile(null) }}><Plus size={14} />Add</button></div>
      <div className="sec"><Tabs v={view} set={setView} opts={[['gallery', 'Gallery'], ['timeline', 'Timeline'], ['albums', 'Albums'], ['onthisday', 'On this day']]} /></div>
      {view === 'albums' ? <Albums ws={ws} say={say} mems={list} urls={urls} albums={albums.rows} reload={load} reloadAlbums={albums.reload} />
        : view === 'onthisday' ? <OnThisDay mems={list} urls={urls} />
        : <>
          <div className="mt-6 flex flex-wrap items-center gap-6"><input className="inp max-w-xs" placeholder="Search title, place, date, album…" value={q} onChange={e => setQ(e.target.value)} />
            {!!albums.rows.length && <select className="text-sm text-mute" value={alb} onChange={e => setAlb(e.target.value)}><option value="">All albums</option>{albums.rows.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}</div>
          {loading ? <Empty t="Loading…" /> : !shown.length ? <Empty t={list.length ? 'Nothing matches your search.' : 'No memories yet. Add your first one.'} />
            : view === 'gallery' ? <div className="columns-2 md:columns-3 gap-5 mt-8">{shown.map(m => <figure key={m.id} className="mb-6 break-inside-avoid">
              {m.photo_path && urls[m.photo_path] && <img loading="lazy" src={urls[m.photo_path]} className="w-full rounded-sm" />}
              <figcaption className="mt-2"><p className="font-semibold">{m.title}</p><p className="text-xs text-mute">{m.taken_on}{m.location ? ` · ${m.location}` : ''}</p>{m.description && <p className="text-sm mt-1">{m.description}</p>}<Acts m={m} /></figcaption></figure>)}</div>
            : <div className="mt-8">{years.map(y => <div key={y} className="mb-10"><h2 className="text-5xl font-extralight text-mute">{y}</h2><ul className="divide-y divide-line mt-3">{shown.filter(m => m.taken_on.startsWith(y)).map(m => <li key={m.id} className="py-4 flex gap-4 items-start">
              {m.photo_path && urls[m.photo_path] && <img loading="lazy" src={urls[m.photo_path]} className="w-20 h-20 object-cover rounded-sm" />}
              <div className="flex-1"><p className="text-xs text-mute">{m.taken_on}{m.location ? ` · ${m.location}` : ''}</p><p className="font-semibold">{m.title}</p>{m.description && <p className="text-sm">{m.description}</p>}<Acts m={m} /></div></li>)}</ul></div>)}</div>}
        </>}
      <Sheet open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit memory' : 'New memory'}>{form && <form onSubmit={save} className="space-y-4">
        <input className="inp" required placeholder="Title" value={form.title ?? ''} onChange={e => setForm({ ...form, title: e.target.value })} />
        <div className="grid grid-cols-2 gap-5"><input className="inp" type="date" value={form.taken_on ?? ''} onChange={e => setForm({ ...form, taken_on: e.target.value })} /><input className="inp" placeholder="Location" value={form.location ?? ''} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
        <textarea className="inp" rows={3} placeholder="Description" value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} />
        <select className="inp" value={form.album_id ?? ''} onChange={e => setForm({ ...form, album_id: e.target.value || null })}><option value="">No album</option>{albums.rows.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        <input type="file" accept="image/*" className="text-sm text-mute" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        <button className="pill" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></form>}</Sheet>
    </div>)
}
