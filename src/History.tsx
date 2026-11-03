import { useEffect, useState } from 'react'
import { Ws, Prof, sb, useRows, Avatar, H1, Empty } from './lib'

export function History({ ws, me, partner }: { ws: Ws; me: Prof; partner?: Prof }) {
  const { rows, loading } = useRows<any>('answers', ws.id, ['day', false]), [qs, setQs] = useState<any[]>([]), [d, setD] = useState('')
  useEffect(() => { sb.from('questions').select('*').then(r => setQs(r.data ?? [])) }, [])
  const days = [...new Set(rows.map(a => a.day as string))].filter(x => !d || x === d)
  return (
    <div className="fade"><H1>Past questions</H1><p className="text-mute mt-2">Answers unlock only when you’ve both replied.</p>
      <div className="sec flex items-center gap-4"><input className="inp max-w-[11rem]" type="date" value={d} onChange={e => setD(e.target.value)} />{d && <button className="lnk" onClick={() => setD('')}>Show all</button>}</div>
      {loading ? <Empty t="Loading…" /> : !days.length ? <Empty t={d ? 'No answers on that date.' : 'No answers yet. Answer today’s question on Home.'} /> : days.map(x => {
        const mine = rows.find(a => a.day === x && a.user_id === me.id), theirs = rows.find(a => a.day === x && a.user_id !== me.id), q = qs.find(z => z.id === (mine ?? theirs)?.question_id)
        return <section key={x} className="sec !mt-8"><p className="cap">{new Date(x + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <h2 className="text-xl font-semibold mt-2">{q?.text ?? 'Question'}</h2>
          <div className="mt-3 space-y-3 text-[15px]">{mine && <p className="flex gap-3"><Avatar p={me} size={24} /><span>{mine.body}</span></p>}
            {theirs ? <p className="flex gap-3"><Avatar p={partner} size={24} /><span>{theirs.body}</span></p> : <p className="text-mute text-sm">Locked until both of you have answered.</p>}</div></section>
      })}
    </div>)
}
