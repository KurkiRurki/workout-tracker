import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, startWorkout } from '../db/index.js'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { Play, Flame, BarChart2, CheckCircle2, ChevronRight } from 'lucide-react'

export default function Dashboard() {
  const navigate = useNavigate()
  const [starting, setStarting] = useState(false)

  const state = useLiveQuery(async () => {
    const planId    = (await db.appState.get('activePlanId'))?.value
    const dayIdx    = (await db.appState.get('currentDayIndex'))?.value ?? 0
    const sessionId = (await db.appState.get('activeSessionId'))?.value
    return { planId, dayIdx, sessionId }
  })

  const plan = useLiveQuery(
    async () => state?.planId ? db.plans.get(state.planId) : null,
    [state?.planId]
  )

  const currentDay = useLiveQuery(async () => {
    if (!state?.planId) return null
    const days = await db.planDays.where('planId').equals(state.planId).sortBy('dayIndex')
    if (!days.length) return null
    return days[(state.dayIdx ?? 0) % days.length]
  }, [state?.planId, state?.dayIdx])

  const preview = useLiveQuery(
    async () => currentDay
      ? db.planExercises.where('planDayId').equals(currentDay.id).sortBy('order')
      : [],
    [currentDay?.id]
  )

  const weekStats = useLiveQuery(async () => {
    const wS = startOfWeek(new Date(), { weekStartsOn: 1 })
    const wE = endOfWeek(new Date(),   { weekStartsOn: 1 })
    const done  = await db.sessions.where('date').between(wS.toISOString(), wE.toISOString(), true, true).filter(s => s.completed === 1).count()
    const total = await db.sessions.where('completed').equals(1).count()
    return { done, total }
  })

  const activeSession = useLiveQuery(
    async () => state?.sessionId ? db.sessions.get(state.sessionId) : null,
    [state?.sessionId]
  )

  async function handleStart() {
    if (!currentDay || starting) return
    setStarting(true)
    try { await startWorkout(currentDay.id); navigate('/log') }
    finally { setStarting(false) }
  }

  if (!state) return <Spinner />

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Morning'
    if (h < 17) return 'Afternoon'
    return 'Evening'
  }

  return (
    <div className="space-y-5 fade-up">
      {/* Header */}
      <div className="pt-1">
        <p className="text-xs tracking-widest uppercase" style={{ color: '#22d3a0' }}>
          {format(new Date(), 'EEEE, MMMM d')}
        </p>
        <h1 className="text-3xl font-bold mt-0.5 tracking-tight" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
          Good {greeting()}
        </h1>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <Stat icon={<Flame size={16} style={{ color: '#f59e0b' }} />} label="This Week" value={weekStats?.done ?? 0} sub="sessions" />
        <Stat icon={<CheckCircle2 size={16} style={{ color: '#22d3a0' }} />} label="All Time" value={weekStats?.total ?? 0} sub="completed" />
      </div>

      {!plan ? (
        <Noplan onGo={() => navigate('/plan')} />
      ) : currentDay ? (
        <div
          className="rounded-2xl p-5 border"
          style={{ background: '#111118', borderColor: '#1e1e2a' }}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#6b6b80' }}>
                {activeSession ? 'In progress' : 'Up next · ' + plan.name}
              </p>
              <h2
                className="text-2xl font-bold tracking-tight"
                style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
              >
                {currentDay.name}
              </h2>
            </div>
            {activeSession && (
              <span
                className="text-xs px-2.5 py-1 rounded-full border pulse-active"
                style={{ background: '#0f3d2a', color: '#22d3a0', borderColor: '#1a6b49' }}
              >
                ACTIVE
              </span>
            )}
          </div>

          {preview?.length > 0 && (
            <div className="mb-5 space-y-2">
              {preview.slice(0, 5).map(ex => (
                <div key={ex.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: '#22d3a0' }}
                    />
                    <span style={{ color: '#c8c8d8' }}>{ex.name}</span>
                  </div>
                  {(ex.targetSets || ex.targetReps) && (
                    <span style={{ color: '#6b6b80' }} className="text-xs">
                      {ex.targetSets && `${ex.targetSets}×`}{ex.targetReps || ''}
                    </span>
                  )}
                </div>
              ))}
              {preview.length > 5 && (
                <p className="text-xs pl-4" style={{ color: '#6b6b80' }}>
                  +{preview.length - 5} more exercises
                </p>
              )}
            </div>
          )}

          <button
            onClick={activeSession ? () => navigate('/log') : handleStart}
            disabled={starting}
            className="w-full py-4 rounded-xl font-bold text-sm tracking-wider uppercase flex items-center justify-center gap-2.5 transition-all active:scale-[.98] disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #22d3a0, #0f9b70)',
              color: '#000',
              fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: '1rem',
              letterSpacing: '0.1em',
            }}
          >
            <Play size={18} fill="currentColor" />
            {activeSession ? 'Continue Workout' : starting ? 'Starting…' : 'Start Workout'}
          </button>
        </div>
      ) : (
        <div
          className="rounded-2xl p-5 text-center border"
          style={{ background: '#111118', borderColor: '#1e1e2a' }}
        >
          <p style={{ color: '#6b6b80' }} className="mb-3">No days in your plan.</p>
          <button onClick={() => navigate('/plan')} className="text-sm" style={{ color: '#22d3a0' }}>
            Add training days →
          </button>
        </div>
      )}

      {/* Recent sessions */}
      <RecentSessions />
    </div>
  )
}

function RecentSessions() {
  const recent = useLiveQuery(async () => {
    const all = await db.sessions.where('completed').equals(1).reverse().limit(3).toArray()
    return Promise.all(all.map(async s => ({
      ...s,
      dayName: (await db.planDays.get(s.planDayId))?.name ?? 'Workout',
      setCount: await db.sessionSets.count(),
    })))
  })

  if (!recent?.length) return null

  return (
    <div>
      <h3 className="text-xs uppercase tracking-widest mb-3" style={{ color: '#6b6b80' }}>
        Recent Sessions
      </h3>
      <div className="space-y-2">
        {recent.map(s => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded-xl px-4 py-3 border"
            style={{ background: '#111118', borderColor: '#1e1e2a' }}
          >
            <div>
              <p className="font-semibold text-sm" style={{ color: '#e8e8f0' }}>{s.dayName}</p>
              <p className="text-xs mt-0.5" style={{ color: '#6b6b80' }}>
                {format(new Date(s.date), 'EEE, MMM d')}
              </p>
            </div>
            <CheckCircle2 size={18} style={{ color: '#22d3a0' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({ icon, label, value, sub }) {
  return (
    <div className="rounded-xl p-4 border" style={{ background: '#111118', borderColor: '#1e1e2a' }}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs uppercase tracking-wider" style={{ color: '#6b6b80' }}>{label}</span>
      </div>
      <p className="text-3xl font-bold" style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#e8e8f0' }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: '#6b6b80' }}>{sub}</p>
    </div>
  )
}

function Noplan({ onGo }) {
  return (
    <div className="rounded-2xl p-8 border text-center" style={{ background: '#111118', borderColor: '#1e1e2a' }}>
      <div className="text-5xl mb-4">🏋️</div>
      <h2 className="text-xl font-bold mb-2">No plan yet</h2>
      <p className="text-sm mb-5" style={{ color: '#6b6b80' }}>Create a workout plan to get started.</p>
      <button
        onClick={onGo}
        className="px-6 py-3 rounded-xl font-bold text-sm tracking-wider"
        style={{ background: 'linear-gradient(135deg, #22d3a0, #0f9b70)', color: '#000' }}
      >
        Create a Plan
      </button>
    </div>
  )
}

const NoplanFix = Noplan
export { NoplanFix as Noplan }

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div
        className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: '#22d3a0', borderTopColor: 'transparent' }}
      />
    </div>
  )
}
