import { useState, FormEvent } from 'react'
import { Ws, Say, Mem, sb, Sheet, save, remove, day, uploadPhoto, download, zipPhotos, safe, Empty } from './lib'

export type Album = { id: string; name: string; description: string | null; cover_memory_id: string | null }
type P = { ws: Ws; say: Say; mems: Mem[]; urls: Record<string, string>; albums: Album[]; reload: () => void; reloadAlbums: () => void }

export function Albums({ ws, say, mems, urls, albums, reload, reloadAlbums }: P) {
  const [open, setOpen] = useState<string | null>(null), [q, setQ] = useState(''), [form, setForm] = useState<Partial<Album> | null>(null), [busy, setBusy] = useState(false), [pick, setPick] = useState('')
  const album = albums.find(a => a.id === open), photos = (id: string) => mems.filter(m => m.album_id === id)
  const cover = (a: Album) => { const m = mems.find(x => x.id === a.cover_memory_id && x.photo_path) ?? photos(a.id).find(x => x.photo_path); return m?.photo_path ? urls[m.photo_path] : '' }
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!form?.name?.trim()) return say('Please name the album')
    if (await save('albums', { ...form, name: form.name.trim(), description: form.description || null }, ws.id, say)) { setForm(null); reloadAlbums() }
  }
  async function addFiles(files: FileList | null) {
    if (!files || !album) return; setBusy(true); let n = 0
    for (const f of Array.from(files)) {
      try { const path = await uploadPhoto(ws.id, f, 'album'); const { error } = await sb.from('memories').insert({ workspace_id: ws.id, title: f.name.replace(/\.[^.]+$/, ''), taken_on: day(), photo_path: path, album_id: album.id }); if (error) throw error; n++ } catch (e: any) { say(e.message) }
    }
    setBusy(false); if (n) say(`${n} photo${n > 1 ? 's' : ''} added`); reload()
  }
  async function patch(id: string, v: object) { const { error } = await sb.from('memories').update(v).eq('id', id); error ? say(error.message) : reload() }
  async function setCover(id: string) { const { error } = await sb.from('albums').update({ cover_memory_id: id }).eq('id', open!); error ? say(error.message) : (say('Cover updated'), reloadAlbums()) }

  if (album) {
    const ph = photos(album.id).filter(m => [m.title, m.description, m.location, m.taken_on].join(' ').toLowerCase().includes(q.toLowerCase())), free = mems.filter(m => !m.album_id)
    return (
      <div className="mt-8 fade"><button className="lnk" onClick={() => { setOpen(null); setQ('') }}>← All albums</button>
        <h2 className="text-4xl font-extrabold tracking-tight mt-3">{album.name}</h2>{album.description && <p className="text-mute mt-1">{album.description}</p>}
        <div className="flex flex-wrap items-center gap-6 mt-4 text-sm">
          <button className="lnk" onClick={() => setForm(album)}>Edit</button>
          <label className="lnk cursor-pointer">{busy ? 'Uploading…' : 'Add photos'}<input type="file" accept="image/*" multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = '' }} /></label>
          <button className="lnk" onClick={() => zipPhotos(photos(album.id).filter(m => m.photo_path).map(m => ({ path: m.photo_path!, name: safe(m.title) })), `${safe(album.name)}.zip`, say)}>Export album</button>
          <button className="lnk" onClick={async () => { if (await remove('albums', album.id, say)) { setOpen(null); reload(); reloadAlbums() } }}>Delete album</button></div>
        {!!free.length && <div className="flex gap-3 mt-4 items-center"><select className="text-sm text-mute max-w-[14rem]" value={pick} onChange={e => setPick(e.target.value)}><option value="">Add an existing memory…</option>{free.map(m => <option key={m.id} value={m.id}>{m.title} ({m.taken_on})</option>)}</select>
          {pick && <button className="text-sm text-accent" onClick={() => { patch(pick, { album_id: album.id }); setPick('') }}>Add</button>}</div>}
        <input className="inp max-w-xs mt-6" placeholder="Search this album…" value={q} onChange={e => setQ(e.target.value)} />
        {!ph.length ? <Empty t={photos(album.id).length ? 'Nothing matches.' : 'This album is empty. Add photos above.'} /> : <div className="columns-2 md:columns-3 gap-5 mt-6">{ph.map(m => <figure key={m.id} className="mb-6 break-inside-avoid">
          {m.photo_path && urls[m.photo_path] && <img loading="lazy" src={urls[m.photo_path]} className="w-full rounded-sm" />}
          <figcaption className="mt-2"><p className="font-semibold">{m.title}</p><p className="text-xs text-mute">{m.taken_on}{m.location ? ` · ${m.location}` : ''}</p>
            <span className="space-x-3">{m.photo_path && <button className="lnk" onClick={() => setCover(m.id)}>{album.cover_memory_id === m.id ? 'Cover ✓' : 'Make cover'}</button>}
              {m.photo_path && <button className="lnk" onClick={() => download(m.photo_path!, safe(m.title))}>Download</button>}<button className="lnk" onClick={() => patch(m.id, { album_id: null })}>Remove</button></span></figcaption></figure>)}</div>}
        <AlbumSheet form={form} setForm={setForm} submit={submit} /></div>)
  }
  const shown = albums.filter(a => `${a.name} ${a.description ?? ''}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="mt-8 fade"><div className="flex flex-wrap gap-6 items-center"><input className="inp max-w-xs" placeholder="Search albums…" value={q} onChange={e => setQ(e.target.value)} /><button className="pill" onClick={() => setForm({})}>New album</button></div>
      {!shown.length ? <Empty t={albums.length ? 'No albums match.' : 'No albums yet. Create one for trips, firsts, birthdays…'} /> : <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mt-8">{shown.map(a => <button key={a.id} onClick={() => { setOpen(a.id); setQ('') }} className="text-left group">
        <div className="aspect-[4/3] bg-line rounded-sm overflow-hidden">{cover(a) && <img loading="lazy" src={cover(a)} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />}</div>
        <p className="font-semibold mt-2">{a.name}</p><p className="text-xs text-mute">{photos(a.id).length} photo{photos(a.id).length === 1 ? '' : 's'}{a.description ? ` · ${a.description}` : ''}</p></button>)}</div>}
      <AlbumSheet form={form} setForm={setForm} submit={submit} /></div>)
}
function AlbumSheet({ form, setForm, submit }: { form: Partial<Album> | null; setForm: (f: Partial<Album> | null) => void; submit: (e: FormEvent) => void }) {
  return <Sheet open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit album' : 'New album'}>{form && <form onSubmit={submit} className="space-y-4">
    <input className="inp" required placeholder="Album name" value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} />
    <textarea className="inp" rows={2} placeholder="Description" value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} /><button className="pill">Save</button></form>}</Sheet>
}

export function OnThisDay({ mems, urls }: { mems: Mem[]; urls: Record<string, string> }) {
  const [d, setD] = useState(day()), [yr, setYr] = useState('all'), md = d.slice(5)
  const hits = mems.filter(m => m.taken_on.slice(5) === md), years = [...new Set(hits.map(m => m.taken_on.slice(0, 4)))].sort().reverse(), cur = new Date().getFullYear()
  return (
    <div className="mt-8 fade"><div className="flex flex-wrap items-center gap-6"><input className="inp max-w-[11rem]" type="date" value={d} onChange={e => { setD(e.target.value || day()); setYr('all') }} />
      {!!years.length && <div className="flex gap-4 text-sm">{['all', ...years].map(y => <button key={y} onClick={() => setYr(y)} className={yr === y ? 'text-accent underline underline-offset-4' : 'text-mute'}>{y === 'all' ? 'All years' : y}</button>)}</div>}</div>
      {!hits.length ? <Empty t="No memories on this day in any year yet." /> : years.filter(y => yr === 'all' || y === yr).map(y => <section key={y} className="mt-10"><h3 className="text-5xl font-extralight text-mute">{y}</h3>
        <p className="text-sm text-mute">{+y === cur ? 'This year' : `${cur - +y} year${cur - +y > 1 ? 's' : ''} ago`}</p>
        <div className="columns-2 md:columns-3 gap-5 mt-4">{hits.filter(m => m.taken_on.startsWith(y)).map(m => <figure key={m.id} className="mb-6 break-inside-avoid">
          {m.photo_path && urls[m.photo_path] && <img loading="lazy" src={urls[m.photo_path]} className="w-full rounded-sm" />}<figcaption className="mt-2"><p className="font-semibold">{m.title}</p><p className="text-xs text-mute">{m.taken_on}{m.location ? ` · ${m.location}` : ''}</p>{m.description && <p className="text-sm">{m.description}</p>}</figcaption></figure>)}</div></section>)}</div>)
}
