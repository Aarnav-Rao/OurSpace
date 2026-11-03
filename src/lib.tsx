import { useCallback, useEffect, useState, ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { supabase as sb } from './supabase'
export { sb }

export type Ws = { id: string; name: string; together_since: string | null; invite_code: string }
export type Prof = { id: string; display_name: string; avatar_path?: string | null }
export type Mem = { id: string; title: string; description: string | null; location: string | null; taken_on: string; photo_path: string | null; album_id?: string | null }
export type Say = (m: string) => void
export type Go = (t: string, sub?: string) => void
export const day = () => new Date().toLocaleDateString('en-CA')
export const pad = (n: number) => String(n).padStart(2, '0')
export const MOODS = ['Happy', 'Tired', 'Excited', 'Stressed', 'Romantic', 'Peaceful', 'Missing you']
export const KIND_COLOR: Record<string, string> = { birthday: 'var(--accent)', anniversary: 'var(--lav)', date: 'var(--warm)', trip: 'var(--sage)', personal: 'var(--mute)', first: 'var(--lav)', custom: 'var(--accent)' }
export const safe = (s: string) => s.replace(/[^\w\- ]+/g, '').trim().slice(0, 40) || 'photo'

export function nextOn(date: string, yearly: boolean) {
  const t = new Date(); t.setHours(0, 0, 0, 0)
  const d = new Date(date + 'T00:00:00')
  if (yearly) { d.setFullYear(t.getFullYear()); if (d < t) d.setFullYear(t.getFullYear() + 1) }
  return d
}
export const daysUntil = (d: Date) => { const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((d.getTime() - t.getTime()) / 864e5) }
export const when = (n: number) => n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`

export function useLive(ws: string, tables: string[], fn: () => void) {
  useEffect(() => {
    const ch = sb.channel('live-' + tables.join('-') + Math.random())
    tables.forEach(t => ch.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: `workspace_id=eq.${ws}` }, fn))
    ch.subscribe()
    return () => { sb.removeChannel(ch) }
  }, [ws])
}
export function useRows<T = any>(table: string, ws: string, order: [string, boolean] = ['created_at', false], live = true) {
  const [rows, setRows] = useState<T[]>([]), [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    const { data, error } = await sb.from(table).select('*').order(order[0], { ascending: order[1] })
    if (!error) setRows((data ?? []) as T[]); setLoading(false)
  }, [table])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!live) return
    const ch = sb.channel('rows-' + table + Math.random()).on('postgres_changes', { event: '*', schema: 'public', table, filter: `workspace_id=eq.${ws}` }, load).subscribe()
    return () => { sb.removeChannel(ch) }
  }, [ws, table])
  return { rows, loading, reload: load }
}

const cache = new Map<string, { u: string; t: number }>()
export async function sign(paths: string[]) {
  const out: Record<string, string> = {}, need: string[] = []
  for (const p of paths.filter(Boolean)) { const c = cache.get(p); if (c && c.t > Date.now()) out[p] = c.u; else need.push(p) }
  if (need.length) {
    const { data } = await sb.storage.from('photos').createSignedUrls([...new Set(need)], 3600)
    for (const d of data ?? []) if (d.path && d.signedUrl) { out[d.path] = d.signedUrl; cache.set(d.path, { u: d.signedUrl, t: Date.now() + 3300e3 }) }
  }
  return out
}
export function useUrl(path?: string | null) {
  const [u, setU] = useState('')
  useEffect(() => { let on = true; if (path) sign([path]).then(r => on && setU(r[path] ?? '')); else setU(''); return () => { on = false } }, [path])
  return u
}
export async function uploadPhoto(ws: string, f: File, tag = 'p') {
  if (!f.type.startsWith('image/')) throw new Error('Please choose an image file')
  if (f.size > 15 * 1024 * 1024) throw new Error('Image must be under 15 MB')
  const path = `${ws}/${tag}-${crypto.randomUUID()}.${(f.name.split('.').pop() || 'jpg').toLowerCase()}`
  const { error } = await sb.storage.from('photos').upload(path, f)
  if (error) throw error
  return path
}
export async function download(path: string, name: string) {
  const { data } = await sb.storage.from('photos').createSignedUrl(path, 60, { download: `${name}.${path.split('.').pop()}` })
  if (data) { const a = document.createElement('a'); a.href = data.signedUrl; a.click() }
}
export async function zipPhotos(items: { path: string; name: string }[], zipName: string, say: Say) {
  if (!items.length) return say('No photos to export')
  say('Preparing download…')
  const { default: JSZip } = await import('jszip'), z = new JSZip(), urls = await sign(items.map(i => i.path)); let n = 0
  for (const it of items) { const u = urls[it.path]; if (!u) continue; z.file(`${String(++n).padStart(3, '0')}-${it.name}.${it.path.split('.').pop()}`, await (await fetch(u)).blob()) }
  const a = document.createElement('a'); a.href = URL.createObjectURL(await z.generateAsync({ type: 'blob' })); a.download = zipName; a.click()
}
export async function save(table: string, row: any, ws: string, say: Say) {
  const { id, created_at, user_id, ...r } = row
  const { error } = id ? await sb.from(table).update(r).eq('id', id) : await sb.from(table).insert({ ...r, workspace_id: ws })
  if (error) { say(error.message); return false }
  say('Saved'); return true
}
export async function remove(table: string, id: string, say: Say) {
  if (!confirm('Delete this?')) return false
  const { error } = await sb.from(table).delete().eq('id', id)
  if (error) { say(error.message); return false }
  say('Deleted'); return true
}

export const H1 = ({ children }: { children: ReactNode }) => <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">{children}</h1>
export const Empty = ({ t }: { t: string }) => <p className="text-mute text-sm mt-8">{t}</p>
export function Tabs({ v, set, opts }: { v: string; set: (x: any) => void; opts: [string, string][] }) {
  return <div className="flex flex-wrap gap-6">{opts.map(([k, l]) => <button key={k} onClick={() => set(k)} className={`text-sm transition-colors ${v === k ? 'text-accent underline underline-offset-4' : 'text-mute hover:text-fg'}`}>{l}</button>)}</div>
}
export function Photo({ path, className }: { path?: string | null; className?: string }) {
  const u = useUrl(path); return u ? <img loading="lazy" src={u} className={className} /> : null
}
export function Avatar({ p, size = 32 }: { p?: Prof; size?: number }) {
  const u = useUrl(p?.avatar_path), s = { width: size, height: size }
  return u ? <img src={u} style={s} className="rounded-full object-cover" /> : <span style={s} className="rounded-full bg-lav text-bg grid place-items-center text-xs font-semibold shrink-0">{(p?.display_name ?? '?')[0].toUpperCase()}</span>
}
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <AnimatePresence>{open && <motion.div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" style={{ background: 'rgba(0,0,0,.4)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="bg-bg text-fg w-full max-w-lg max-h-[90vh] overflow-auto p-6 md:rounded-md rounded-t-xl border border-line" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5"><h2 className="text-xl font-semibold">{title}</h2><button className="lnk" onClick={onClose} aria-label="Close"><X size={18} /></button></div>{children}
      </motion.div></motion.div>}</AnimatePresence>)
}
