import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/index.js'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { format, subWeeks, startOfWeek, endOfWeek } from 'date-fns'

const BRAND = '#22d3a0'
const S = { background: '#111118', borderColor: '#1e1e2a' }

const TT = {
  contentStyle: { background: '#1a1a24', border: '1px solid #2a2a38', borderRadius: 10, fontSize: 12 },
  labelStyle:   { color: '#a0a0b8' },
  itemStyle:    { color: BRAND },
  cursor:       { fill: '#22d3a0', opacity: 0.05 },
}

export default function ProgressPage() {
  const [selEx, setSelEx] = useState('')

  const totals = useLiveQuery(async () => {
    const sessions = await db.sessions.where('completed').equals(1).count()
    const sets     = await db.sessionSets.count()
    const plans    = await db.plans.count()
    return { sessions, sets, plans }
  })

  const weekly = useLiveQuery(async () => {
    const rows = []
    for (let i = 7; i >= 0; i--) {
      const d  = subWeeks(new Date(), i)
      const wS = startOfWeek(d, { weekStartsOn: 1 })
      const wE = endOfWeek(d, { weekStartsOn: 1 })
      const n  = await db.sessions
        .where('date').between(wS.toISOString(), wE.toISOString(), true, true)
        .filter(s => s.completed === 1).count()
      rows.push({ week: i === 0 ? 'Now' : `W-${i}`, count: n })
    }
    return rows
  })

  const exNames = useLiveQuery(async () => {
    const all = await db.sessionExercises.toArray()
    return [...new Set(all.map(e => e.name))].sort()
  })

  const exProgress = useLiveQuery(async () => {
    if (!selEx) return []
    const exs = await db.sessionExercises.where('name').equals(selEx).toArray()
    const pts = []
    for (const ex of exs) {
      const s = await db.sessions.get(ex.sessionId)
      if (!s?.completed) continue
      const sets = await db.sessionSets.where('sessionExerciseId').equals(ex.id).toArray()
      if (!sets.length) continue
      const maxW   = Math.max(0, ...sets.map(s => parseFloat(s.weight) || 0))
      const totR   = sets.reduce((a, s) => a + (parseInt(s.reps) || 0), 0)
      const avgR   = sets.length ? Math.round(totR / sets.length) : 0
      pts.push({ date: format(new Date(s.date), 'MMM d'), weight: maxW || null, reps: avgR || null, volume: totR })
    }
    return pts.slice(-12)
  }, [selEx])

  return (
    <div className="space-y-5 fade-up">
      <h1 className="text-3xl font-bold tracking-tight"
        style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
        Progress
      </h1>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Workouts', val: totals?.sessions ?? 0 },
          { label: 'Sets',     val: totals?.sets     ?? 0 },
          { label: 'Plans',    val: totals?.plans    ?? 0 },
        ].map(x => (
          <div key={x.label} className="rounded-xl p-3 border text-center" style={S}>
            <p className="text-2xl font-bold" style={{ color: BRAND, fontFamily: 'Barlow Condensed, sans-serif' }}>{x.val}</p>
            <p className="text-xs mt-0.5" style={{ color: '#6b6b80' }}>{x.label}</p>
          </div>
        ))}
      </div>

      {/* Weekly bar */}
      <div className="rounded-2xl p-4 border" style={S}>
        <h2 className="font-bold mb-4" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.1rem' }}>
          Weekly Sessions
        </h2>
        {weekly?.some(w => w.count > 0) ? (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weekly} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2a" vertical={false} />
              <XAxis dataKey="week" tick={{ fill: '#6b6b80', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b6b80', fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} />
              <Tooltip {...TT} />
              <Bar dataKey="count" name="Sessions" fill={BRAND} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart text="Complete workouts to see weekly trends." />
        )}
      </div>

      {/* Per-exercise progress */}
      <div className="rounded-2xl p-4 border" style={S}>
        <h2 className="font-bold mb-3" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.1rem' }}>
          Exercise Progress
        </h2>
        <select
          value={selEx}
          onChange={e => setSelEx(e.target.value)}
          className="w-full rounded-xl px-3 py-2.5 text-sm mb-4 focus:outline-none"
          style={{ background: '#1a1a24', color: selEx ? '#e8e8f0' : '#6b6b80', border: '1px solid #2a2a38' }}
        >
          <option value="">Select an exercise…</option>
          {exNames?.map(n => <option key={n} value={n}>{n}</option>)}
        </select>

        {selEx && exProgress ? (
          exProgress.length > 1 ? (
            <>
              <p className="text-xs mb-3" style={{ color: '#6b6b80' }}>
                Last {exProgress.length} sessions — max weight & avg reps
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={exProgress} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2a" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#6b6b80', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6b6b80', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip {...TT} />
                  <Line type="monotone" dataKey="weight" stroke={BRAND} name="Max weight (kg)"
                    dot={{ fill: BRAND, r: 3, strokeWidth: 0 }} strokeWidth={2} connectNulls />
                  <Line type="monotone" dataKey="reps" stroke="#6366f1" name="Avg reps"
                    dot={{ fill: '#6366f1', r: 3, strokeWidth: 0 }} strokeWidth={2} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </>
          ) : (
            <EmptyChart text="Need at least 2 sessions to show a trend." />
          )
        ) : selEx ? (
          <EmptyChart text="No data logged for this exercise yet." />
        ) : null}
      </div>

      {/* Volume heatmap — streaks */}
      <WeeklyStreak />
    </div>
  )
}

function WeeklyStreak() {
  const data = useLiveQuery(async () => {
    const sessions = await db.sessions.where('completed').equals(1).toArray()
    const byDate = {}
    for (const s of sessions) {
      const d = s.date.slice(0, 10)
      byDate[d] = (byDate[d] || 0) + 1
    }
    // Last 35 days grid
    const days = []
    for (let i = 34; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      days.push({ date: key, label: format(d, 'd'), count: byDate[key] || 0 })
    }
    return days
  })

  if (!data) return null

  return (
    <div className="rounded-2xl p-4 border" style={S}>
      <h2 className="font-bold mb-4" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.1rem' }}>
        Last 35 Days
      </h2>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} className="text-center text-xs" style={{ color: '#6b6b80' }}>{d}</div>
        ))}
        {data.map(d => (
          <div
            key={d.date}
            title={`${d.date}: ${d.count} session${d.count !== 1 ? 's' : ''}`}
            className="aspect-square rounded-md flex items-center justify-center text-xs transition-all"
            style={{
              background: d.count > 0 ? BRAND : '#1a1a24',
              color: d.count > 0 ? '#000' : '#6b6b80',
              opacity: d.count > 0 ? (0.5 + d.count * 0.5) : 1,
              fontSize: '10px',
            }}
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyChart({ text }) {
  return (
    <div className="flex items-center justify-center h-28 rounded-xl"
      style={{ background: '#0a0a12', color: '#6b6b80', fontSize: '0.8125rem' }}>
      {text}
    </div>
  )
}
