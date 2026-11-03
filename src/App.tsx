import { useCallback, useEffect, useMemo, useState, FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AnimatePresence, motion } from 'framer-motion'
import { Home as HomeIcon, Images, CalendarDays, ListChecks, Heart, Search as SearchIcon } from 'lucide-react'
import { sb, Ws, Prof, Mem, Say, Go, day, MOODS, useLive, sign, Avatar, Tabs, H1 } from './lib'
import { Memories } from './Memories'
import { Calendar } from './Calendar'
import { Bucket } from './Bucket'
import { Dates } from './Dates'
import { Us } from './Us'
import { History } from './History'
import { Search } from './Search'
import { Settings } from './Settings'
import { Upcoming, Quick } from './Upcoming'

function Auth() {
  const [mode, setMode] = useState<'in' | 'up'>('in'), [email, setEmail] = useState(''), [pw, setPw] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  async function go(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    const r = mode === 'in' ? await sb.auth.signInWithPassword({ email, password: pw }) : await sb.auth.signUp({ email, password: pw })
    if (r.error) setErr(r.error.message); else if (mode === 'up' && !r.data.session) setErr('Check your email to confirm, then sign in.')
    setBusy(false)
  }
  return (
    <div className="min-h-screen grid place-items-center px-6"><form onSubmit={go} className="w-full max-w-sm space-y-6 fade">
      <h1 className="text-5xl font-extrabold tracking-tight">OurSpace</h1><p className="text-mute">A private place for two.</p>
      <input className="inp" type="email" required placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input className="inp" type="password" required minLength={8} placeholder="Password (8+ characters)" value={pw} onChange={e => setPw(e.target.value)} />
      {err && <p className="text-sm text-accent">{err}</p>}
      <button className="pill" disabled={busy}>{mode === 'in' ? 'Sign in' : 'Create account'}</button>
      <p className="text-sm text-mute">{mode === 'in' ? 'New here? ' : 'Have an account? '}
        <button type="button" className="text-accent" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>{mode === 'in' ? 'Create account' : 'Sign in'}</button></p>
    </form></div>)
}

function Onboard({ done }: { done: () => void }) {
  const [name, setName] = useState(''), [since, setSince] = useState(''), [code, setCode] = useState(''), [err, setErr] = useState('')
  async function create(e: FormEvent) { e.preventDefault(); const { error } = await sb.rpc('create_workspace', { n: name || 'Us', since: since || null }); error ? setErr(error.message) : done() }
  async function join(e: FormEvent) { e.preventDefault(); const { error } = await sb.rpc('join_workspace', { code: code.trim() }); error ? setErr(error.message) : done() }
  return (
    <div className="max-w-md mx-auto px-6 py-20 space-y-14 fade">
      <form onSubmit={create} className="space-y-5"><h2 className="text-3xl font-extrabold tracking-tight">Start your space</h2>
        <input className="inp" placeholder="Space name (optional)" value={name} onChange={e => setName(e.target.value)} />
        <label className="cap block">Together since</label><input className="inp" type="date" value={since} onChange={e => setSince(e.target.value)} />
        <button className="pill">Create &amp; get invite code</button></form>
      <form onSubmit={join} className="space-y-5"><h2 className="text-3xl font-extrabold tracking-tight">Or join your partner</h2>
        <input className="inp" required placeholder="Invite code" value={code} onChange={e => setCode(e.target.value)} />
        <button className="pill">Join</button></form>
      {err && <p className="text-sm text-accent">{err}</p>}
    </div>)
}

function Home({ ws, me, partner, say, go }: { ws: Ws; me: Prof; partner?: Prof; say: Say; go: Go }) {
  const [qs, setQs] = useState<{ id: number; text: string }[]>([]), [ans, setAns] = useState<any[]>([]), [moods, setMoods] = useState<any[]>([]), [notes, setNotes] = useState<any[]>([]), [mems, setMems] = useState<Mem[]>([])
  const [draft, setDraft] = useState(''), [note, setNote] = useState(''), [msg, setMsg] = useState(''), [img, setImg] = useState('')
  const d = day()
  const load = useCallback(async () => {
    const [q, a, m, n, me_] = await Promise.all([
      sb.from('questions').select('*').order('id'), sb.from('answers').select('*').eq('day', d), sb.from('moods').select('*').eq('day', d),
      sb.from('notes').select('*').order('created_at', { ascending: false }).limit(20), sb.from('memories').select('id,title,description,location,taken_on,photo_path')])
    setQs(q.data ?? []); setAns(a.data ?? []); setMoods(m.data ?? []); setNotes(n.data ?? []); setMems((me_.data ?? []) as Mem[])
  }, [d])
  useEffect(() => { load() }, [load]); useLive(ws.id, ['answers', 'moods', 'notes'], load)

  const hr = new Date().getHours(), greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'
  const days = ws.together_since ? Math.floor((Date.now() - new Date(ws.together_since + 'T00:00:00').getTime()) / 864e5) : null
  const q = qs.length ? qs[Math.floor(Date.now() / 864e5) % qs.length] : null
  const mine = ans.find(a => a.user_id === me.id), theirs = ans.find(a => a.user_id !== me.id)
  const myMood = moods.find(m => m.user_id === me.id)
  const name = (id: string) => id === me.id ? me.display_name : partner?.display_name ?? 'Partner'
  const motd = useMemo(() => mems.find(m => m.taken_on.slice(5) === d.slice(5) && m.taken_on.slice(0, 4) !== d.slice(0, 4)) ?? (mems.length ? mems[Math.floor(Date.now() / 864e5) % mems.length] : null), [mems, d])
  useEffect(() => { if (motd?.photo_path) sign([motd.photo_path]).then(u => setImg(u[motd.photo_path!] ?? '')); else setImg('') }, [motd])

  async function answer(e: FormEvent) {
    e.preventDefault(); if (!draft.trim() || !q) return
    const { error } = await sb.from('answers').insert({ workspace_id: ws.id, question_id: q.id, day: d, body: draft.trim() })
    error ? say(error.message) : (setDraft(''), say('Answer saved')); load()
  }
  async function setMood(mood: string) {
    const { error } = await sb.from('moods').upsert({ workspace_id: ws.id, user_id: me.id, day: d, mood, message: msg || myMood?.message || null }, { onConflict: 'workspace_id,user_id,day' })
    error ? say(error.message) : load()
  }
  async function send(e: FormEvent) {
    e.preventDefault(); if (!note.trim()) return
    const { error } = await sb.from('notes').insert({ workspace_id: ws.id, body: note.trim() })
    error ? say(error.message) : setNote(''); load()
  }

  return (
    <div className="fade">
      <div className="flex -space-x-2 mb-5"><Avatar p={me} size={40} />{partner && <Avatar p={partner} size={40} />}</div>
      <p className="cap">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mt-3 leading-[1.05]">{greet}, {me.display_name}{partner ? ` & ${partner.display_name}` : ''}.</h1>
      {days !== null && <p className="text-mute mt-4">{days.toLocaleString()} days together{days > 0 && days % 100 === 0 ? ' — a milestone today' : ''}</p>}
      {!partner && <p className="mt-4 text-accent text-sm">Your partner hasn’t joined yet. Share the invite code from Settings.</p>}

      <p className="cap mt-14">Today</p>
      <section className="sec !mt-4">
        <p className="cap flex justify-between">Daily question<button className="lnk normal-case tracking-normal" onClick={() => go('history')}>Past questions</button></p><h2 className="text-2xl font-semibold mt-2">{q?.text ?? '…'}</h2>
        {!mine ? <form onSubmit={answer} className="mt-4 space-y-3"><textarea className="inp" rows={2} placeholder="Your answer stays hidden until you both reply" value={draft} onChange={e => setDraft(e.target.value)} /><button className="pill">Save answer</button></form>
          : <div className="mt-4 space-y-3 text-[15px]"><p><span className="text-mute">You — </span>{mine.body}</p>
            {theirs ? <p><span className="text-mute">{partner?.display_name} — </span>{theirs.body}</p> : <p className="text-mute">Waiting for {partner?.display_name ?? 'your partner'} to answer…</p>}</div>}
      </section>
      <section className="sec">
        <p className="cap">Mood</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3">{MOODS.map(m => <button key={m} onClick={() => setMood(m)} className={`text-sm transition-colors ${myMood?.mood === m ? 'text-accent underline underline-offset-4' : 'text-mute hover:text-fg'}`}>{m}</button>)}</div>
        <input className="inp mt-3" placeholder="Add a short message (optional)" value={msg} onChange={e => setMsg(e.target.value)} onBlur={() => myMood && setMood(myMood.mood)} />
        <div className="mt-4 space-y-1 text-[15px]">{[me, partner].filter(Boolean).map(p => { const m = moods.find(x => x.user_id === p!.id); return <p key={p!.id}><span className="text-mute">{p!.display_name} — </span>{m ? <>{m.mood}{m.message ? <span className="text-mute"> · {m.message}</span> : null}</> : <span className="text-mute">no mood yet</span>}</p> })}</div>
      </section>
      <section className="sec">
        <p className="cap">Little notes</p>
        <form onSubmit={send} className="flex gap-4 items-end mt-3"><input className="inp" placeholder="Leave a note…" value={note} onChange={e => setNote(e.target.value)} /><button className="pill">Send</button></form>
        <ul className="mt-5 divide-y divide-line">{notes.map(n => <li key={n.id} className="py-3 flex justify-between gap-4"><p><span className="text-mute">{name(n.user_id)} · {new Date(n.created_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} — </span>{n.body}</p>
          {n.user_id === me.id && <button className="lnk" onClick={async () => { await sb.from('notes').delete().eq('id', n.id); load() }}>Delete</button>}</li>)}</ul>
        {!notes.length && <p className="text-mute text-sm mt-4">No notes yet.</p>}
      </section>
      <Upcoming ws={ws} go={go} />
      {motd && <section className="sec"><p className="cap">Memory of the day</p>{img && <img src={img} className="mt-4 max-h-96 w-auto rounded-sm" />}
        <p className="text-xl font-semibold mt-3">{motd.title}</p><p className="text-mute text-sm">{motd.taken_on}{motd.location ? ` · ${motd.location}` : ''}</p></section>}
      <Quick go={go} />
    </div>)
}

function Plan({ ws, say, sub }: { ws: Ws; say: Say; sub?: string }) {
  const [v, setV] = useState<'bucket' | 'dates'>(sub === 'dates' ? 'dates' : 'bucket')
  return <div className="fade"><H1>Plan</H1><div className="sec"><Tabs v={v} set={setV} opts={[['bucket', 'Bucket list'], ['dates', 'Date ideas']]} /></div>
    <div className="mt-6">{v === 'bucket' ? <Bucket ws={ws} say={say} /> : <Dates ws={ws} say={say} />}</div></div>
}

type Tab = 'home' | 'memories' | 'calendar' | 'plan' | 'us' | 'history' | 'search' | 'settings'
const NAV: [Tab, string, typeof HomeIcon][] = [['home', 'Home', HomeIcon], ['memories', 'Memories', Images], ['calendar', 'Calendar', CalendarDays], ['plan', 'Plan', ListChecks], ['us', 'Us', Heart]]

export default function App() {
  const [session, setSession] = useState<Session | null>(null), [ready, setReady] = useState(false), [ws, setWs] = useState<Ws | null>(null), [profs, setProfs] = useState<Prof[]>([]), [got, setGot] = useState(false)
  const [tab, setTab] = useState<Tab>('home'), [sub, setSub] = useState(''), [toast, setToast] = useState('')
  const say: Say = m => { setToast(m); setTimeout(() => setToast(''), 2500) }
  const go: Go = (t, s = '') => { setTab(t as Tab); setSub(s); scrollTo(0, 0) }
  useEffect(() => {
    const t = localStorage.getItem('theme'); document.documentElement.classList.toggle('dark', t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches)
    sb.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data } = sb.auth.onAuthStateChange((_, s) => { setSession(s); setGot(false) }); return () => data.subscription.unsubscribe()
  }, [])
  const reload = useCallback(async () => {
    if (!session) return
    const { data } = await sb.from('members').select('workspaces(*)').limit(1).maybeSingle()
    setWs((data as any)?.workspaces ?? null)
    setProfs((await sb.from('profiles').select('id,display_name,avatar_path')).data ?? []); setGot(true)
  }, [session])
  useEffect(() => { reload() }, [reload, tab])
  if (!ready) return null
  if (!session) return <Auth />
  if (!got) return <p className="p-10 text-mute">Loading…</p>
  if (!ws) return <Onboard done={reload} />
  const me = profs.find(p => p.id === session.user.id) ?? { id: session.user.id, display_name: 'Me' }, partner = profs.find(p => p.id !== session.user.id)
  return (
    <div className="min-h-screen">
      <header className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
        <button onClick={() => go('home')} className="font-extrabold tracking-tight text-lg">OurSpace</button>
        <nav className="hidden md:flex gap-8 text-sm">{NAV.map(([k, l]) => <button key={k} onClick={() => go(k)} className={`transition-colors ${tab === k ? 'text-fg font-semibold' : 'text-mute hover:text-fg'}`}>{l}</button>)}</nav>
        <div className="flex items-center gap-5"><button onClick={() => go('search')} aria-label="Search" className={tab === 'search' ? 'text-accent' : 'text-mute hover:text-fg'}><SearchIcon size={18} /></button>
          <button onClick={() => go('settings')} aria-label="Settings"><Avatar p={me} size={28} /></button></div>
      </header>
      <AnimatePresence mode="wait"><motion.main key={tab + sub} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .2 }} className="max-w-4xl mx-auto px-6 pt-6 pb-28">
        {tab === 'home' && <Home ws={ws} me={me} partner={partner} say={say} go={go} />}
        {tab === 'memories' && <Memories ws={ws} say={say} sub={sub} />}
        {tab === 'calendar' && <Calendar ws={ws} say={say} />}
        {tab === 'plan' && <Plan ws={ws} say={say} sub={sub} />}
        {tab === 'us' && <Us ws={ws} say={say} />}
        {tab === 'history' && <History ws={ws} me={me} partner={partner} />}
        {tab === 'search' && <Search go={go} />}
        {tab === 'settings' && <Settings ws={ws} me={me} say={say} reload={reload} />}
      </motion.main></AnimatePresence>
      <nav className="md:hidden fixed bottom-0 inset-x-0 flex justify-around pt-3 bg-bg border-t border-line text-[11px]" style={{ paddingBottom: 'calc(.75rem + env(safe-area-inset-bottom))' }}>
        {NAV.map(([k, l, I]) => <button key={k} onClick={() => go(k)} className={`flex flex-col items-center gap-1 transition-colors ${tab === k ? 'text-accent' : 'text-mute'}`}><I size={20} />{l}</button>)}</nav>
      <div className={`fixed left-1/2 -translate-x-1/2 bottom-24 md:bottom-8 z-[60] bg-fg text-bg text-sm px-5 py-2 rounded-full transition-all duration-300 ${toast ? 'opacity-100' : 'opacity-0 pointer-events-none translate-y-2'}`}>{toast}</div>
    </div>)
}
