import { useState, FormEvent } from 'react'
import { Ws, Prof, Say, sb, uploadPhoto, zipPhotos, safe, Avatar, H1 } from './lib'

export function Settings({ ws, me, say, reload }: { ws: Ws; me: Prof; say: Say; reload: () => void }) {
  const [name, setName] = useState(me.display_name), [since, setSince] = useState(ws.together_since ?? ''), [sn, setSn] = useState(ws.name), [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    const a = await sb.from('profiles').update({ display_name: name.trim() || 'Me' }).eq('id', me.id)
    const b = await sb.from('workspaces').update({ together_since: since || null, name: sn || 'Us' }).eq('id', ws.id)
    a.error || b.error ? say((a.error || b.error)!.message) : (say('Saved'), reload())
  }
  async function avatar(f?: File) {
    if (!f) return; setBusy(true)
    try {
      const path = await uploadPhoto(ws.id, f, 'avatar'), old = me.avatar_path
      const { error } = await sb.from('profiles').update({ avatar_path: path }).eq('id', me.id); if (error) throw error
      if (old) await sb.storage.from('photos').remove([old])
      say('Profile photo updated'); reload()
    } catch (e: any) { say(e.message) }
    setBusy(false)
  }
  function theme() { const dark = !document.documentElement.classList.contains('dark'); document.documentElement.classList.toggle('dark', dark); localStorage.setItem('theme', dark ? 'dark' : 'light') }
  async function backup() {
    const out: Record<string, any> = { workspace: ws, exported_at: new Date().toISOString() }
    for (const t of ['profiles', 'memories', 'albums', 'notes', 'answers', 'moods', 'events', 'bucket_items', 'date_ideas', 'milestones', 'questions']) {
      const { data, error } = await sb.from(t).select('*'); if (error) return say(`${t}: ${error.message}`); out[t] = data
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })); a.download = `ourspace-backup-${new Date().toLocaleDateString('en-CA')}.json`; a.click()
  }
  async function photos() {
    const { data, error } = await sb.from('memories').select('title,taken_on,photo_path').not('photo_path', 'is', null)
    if (error) return say(error.message)
    zipPhotos((data ?? []).map((m: any) => ({ path: m.photo_path, name: `${m.taken_on}-${safe(m.title)}` })), 'ourspace-photos.zip', say)
  }
  return (
    <div className="fade max-w-lg"><H1>Settings</H1>
      <form onSubmit={submit} className="sec space-y-5"><p className="cap">Profile &amp; space</p>
        <div className="flex items-center gap-4"><Avatar p={me} size={56} /><label className="lnk cursor-pointer">{busy ? 'Uploading…' : 'Change photo'}<input type="file" accept="image/*" hidden onChange={e => { avatar(e.target.files?.[0]); e.target.value = '' }} /></label></div>
        <input className="inp" placeholder="Your display name" value={name} onChange={e => setName(e.target.value)} />
        <input className="inp" placeholder="Space name" value={sn} onChange={e => setSn(e.target.value)} />
        <label className="cap block">Together since</label><input className="inp" type="date" value={since} onChange={e => setSince(e.target.value)} /><button className="pill">Save</button></form>
      <div className="sec"><p className="cap">Invite code</p><p className="text-2xl font-semibold mt-2 tracking-widest">{ws.invite_code}</p>
        <p className="text-sm text-mute mt-1">Your partner enters this after creating an account. A space holds exactly two people.</p><button className="lnk mt-2" onClick={() => { navigator.clipboard.writeText(ws.invite_code); say('Copied') }}>Copy code</button></div>
      <div className="sec"><p className="cap">Your data</p><div className="flex flex-wrap gap-8 mt-3"><button className="lnk" onClick={backup}>Full backup (JSON)</button><button className="lnk" onClick={photos}>All photos (ZIP)</button></div></div>
      <div className="sec flex flex-wrap gap-8"><button className="lnk" onClick={theme}>Switch light / dark</button><button className="lnk" onClick={() => sb.auth.signOut()}>Sign out</button></div>
    </div>)
}
