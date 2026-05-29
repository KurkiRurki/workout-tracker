import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, startWorkout, completeWorkout, addSet, updateSet, deleteSet, updateSessionExercise, getPreviousSessionData } from '../db/index.js'
import { format } from 'date-fns'
import { Play, CheckCircle, Plus, Trash2, ChevronDown, ChevronUp, Clock, Target } from 'lucide-react'

const S     = { background: '#111118', borderColor: '#1e1e2a' }
const S2    = { background: '#1a1a24', border: '1px solid #2a2a38' }
const BRAND = '#22d3a0'
const BLOCK_COLORS = { Handstand: '#6366f1', Strength: '#22d3a0', Conditioning: '#f59e0b' }
const BLOCK_ORDER  = ['Handstand', 'Strength', 'Conditioning']

export default function LogPage() {
  const activeSessionId = useLiveQuery(async () => (await db.appState.get('activeSessionId'))?.value ?? null)
  if (activeSessionId === undefined) return <Spinner />
  if (!activeSessionId)              return <NoSession />
  return <ActiveWorkout sessionId={activeSessionId} />
}

/* ── No active session ───────────────────────────────────────────── */
function NoSession() {
  const navigate = useNavigate()
  const [starting, setStarting] = useState(false)

  const info = useLiveQuery(async () => {
    const planId = (await db.appState.get('activePlanId'))?.value
    const idx    = (await db.appState.get('currentDayIndex'))?.value ?? 0
    if (!planId) return null
    const days = await db.planDays.where('planId').equals(planId).sortBy('dayIndex')
    if (!days.length) return null
    const day = days[idx % days.length]
    const exs = await db.planExercises.where('planDayId').equals(day.id).sortBy('order')
    return { day, exs }
  })

  async function go() {
    if (!info?.day) return
    setStarting(true)
    try { await startWorkout(info.day.id) }
    finally { setStarting(false) }
  }

  if (!info) return (
    <div className="text-center py-20">
      <p className="mb-4" style={{ color: '#6b6b80' }}>No workout plan set up.</p>
      <button onClick={() => navigate('/plan')} style={{ color: BRAND }}>Create a plan →</button>
    </div>
  )

  const grouped = {}
  for (const b of BLOCK_ORDER) grouped[b] = info.exs.filter(e => (e.block || 'Strength') === b)

  return (
    <div className="space-y-5 fade-up">
      <div>
        <p className="text-xs uppercase tracking-widest" style={{ color: BRAND }}>{format(new Date(), 'EEEE, MMMM d')}</p>
        <h1 className="text-3xl font-bold mt-0.5 tracking-tight" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>{info.day.name}</h1>
      </div>

      {BLOCK_ORDER.filter(b => grouped[b]?.length > 0).map(block => (
        <div key={block}>
          <BlockHeader block={block} />
          <div className="space-y-2 mt-2">
            {grouped[block].map((ex, i) => (
              <div key={ex.id} className="rounded-xl px-4 py-3.5 border" style={S}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold" style={{ color: '#e8e8f0' }}>{ex.name}</p>
                  <span className="text-xs" style={{ color: '#6b6b80' }}>
                    {ex.targetSets && `${ex.targetSets}×`}{ex.targetReps || ''}{ex.repsOrSeconds === 'seconds' ? 's' : ''}
                  </span>
                </div>
                {ex.progression && <p className="text-xs mt-0.5" style={{ color: '#a0a0b8' }}>↑ {ex.progression}</p>}
                <div className="flex gap-3 mt-1 text-xs" style={{ color: '#6b6b80' }}>
                  {ex.band       && <span>Band: {ex.band}</span>}
                  {ex.ringHeight && <span style={{ color: '#f59e0b' }}>○ {ex.ringHeight}</span>}
                </div>
                {ex.cues && <p className="text-xs mt-1 italic" style={{ color: '#6b6b80' }}>{ex.cues}</p>}
              </div>
            ))}
          </div>
        </div>
      ))}

      <button onClick={go} disabled={starting}
        className="w-full py-4 rounded-xl font-bold tracking-wider flex items-center justify-center gap-2.5 transition-all active:scale-[.98] disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg, #22d3a0, #0f9b70)', color: '#000', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1rem', letterSpacing: '0.1em' }}>
        <Play size={18} fill="currentColor" />
        {starting ? 'Starting…' : 'Start Workout'}
      </button>
    </div>
  )
}

/* ── Active workout ───────────────────────────────────────────────── */
function ActiveWorkout({ sessionId }) {
  const navigate = useNavigate()
  const [completing, setCompleting] = useState(false)
  const [sessionNotes, setSessionNotes] = useState('')
  const [showNotes, setShowNotes]   = useState(false)
  const [showAddEx, setShowAddEx]   = useState(false)
  const [newExName, setNewExName]   = useState('')
  const [newExBlock, setNewExBlock] = useState('Strength')

  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId])
  const planDay = useLiveQuery(async () => session ? db.planDays.get(session.planDayId) : null, [session?.planDayId])

  const exs = useLiveQuery(
    async () => db.sessionExercises.where('sessionId').equals(sessionId).sortBy('order'),
    [sessionId]
  )

  const prevData = useLiveQuery(
    async () => session ? getPreviousSessionData(session.planDayId, sessionId) : null,
    [session?.planDayId, sessionId]
  )

  // Load planExercises to get block info for each sessionExercise
  const planExMap = useLiveQuery(async () => {
    if (!exs?.length) return {}
    const ids = exs.map(e => e.planExerciseId).filter(Boolean)
    if (!ids.length) return {}
    const planExs = await db.planExercises.where('id').anyOf(ids).toArray()
    return Object.fromEntries(planExs.map(pe => [pe.id, pe]))
  }, [exs])

  // Group session exercises by block
  const grouped = useMemo(() => {
    if (!exs || !planExMap) return {}
    const g = {}
    for (const b of [...BLOCK_ORDER, 'General']) g[b] = []
    for (const ex of exs) {
      const pe    = planExMap[ex.planExerciseId]
      const block = pe?.block || 'General'
      const key   = BLOCK_ORDER.includes(block) ? block : 'General'
      g[key].push({ ...ex, planEx: pe })
    }
    return g
  }, [exs, planExMap])

  async function handleAddEx() {
    if (!newExName.trim()) return
    await db.sessionExercises.add({
      sessionId, planExerciseId: null,
      name: newExName.trim(), order: exs?.length ?? 0,
      notes: '', howItWas: '', nextTarget: '', block: newExBlock,
    })
    setNewExName(''); setShowAddEx(false)
  }

  async function handleComplete() {
    setCompleting(true)
    try { await completeWorkout(sessionId, sessionNotes); navigate('/') }
    finally { setCompleting(false) }
  }

  if (!session || !planDay) return <Spinner />

  const elapsed = session.date ? Math.floor((Date.now() - new Date(session.date).getTime()) / 60000) : 0

  const activeBlocks = [...BLOCK_ORDER, 'General'].filter(b => grouped[b]?.length > 0)

  return (
    <div className="space-y-4 fade-up">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>{planDay.name}</h1>
          <div className="flex items-center gap-1.5 mt-0.5 text-xs" style={{ color: '#6b6b80' }}>
            <Clock size={12} />{elapsed}m elapsed
          </div>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full border pulse-active" style={{ background: '#0f3d2a', color: BRAND, borderColor: '#1a6b49' }}>ACTIVE</span>
      </div>

      {activeBlocks.map(block => (
        <div key={block}>
          <BlockHeader block={block} />
          <div className="space-y-3 mt-2">
            {grouped[block].map(ex => (
              <ExerciseBlock
                key={ex.id}
                ex={ex}
                prevEx={prevData?.exercises?.find(p => ex.planExerciseId && p.planExerciseId === ex.planExerciseId)}
                prevDate={prevData?.session?.date}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Add exercise */}
      {showAddEx ? (
        <div className="rounded-2xl p-4 border fade-up" style={{ ...S, borderColor: BRAND + '40' }}>
          <div className="flex gap-2 mb-3">
            {BLOCK_ORDER.map(b => (
              <button key={b} onClick={() => setNewExBlock(b)}
                className="flex-1 py-1.5 rounded-lg text-xs font-bold"
                style={{
                  background: newExBlock === b ? BLOCK_COLORS[b] + '25' : '#1a1a24',
                  color: newExBlock === b ? BLOCK_COLORS[b] : '#6b6b80',
                  border: `1px solid ${newExBlock === b ? BLOCK_COLORS[b] + '60' : '#2a2a38'}`,
                }}>{b}</button>
            ))}
          </div>
          <input value={newExName} onChange={e => setNewExName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddEx()}
            autoFocus placeholder="Exercise name…"
            className="w-full rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none" style={{ ...S2, color: '#e8e8f0' }} />
          <div className="flex gap-2">
            <button onClick={handleAddEx} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: BRAND, color: '#000' }}>Add</button>
            <button onClick={() => setShowAddEx(false)} className="px-4 py-2.5 rounded-xl text-sm" style={{ background: '#1a1a24', color: '#6b6b80' }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAddEx(true)}
          className="w-full py-3 rounded-2xl text-sm flex items-center justify-center gap-1.5 border-2 border-dashed"
          style={{ borderColor: '#2a2a38', color: '#6b6b80' }}>
          <Plus size={16} /> Add Exercise
        </button>
      )}

      {/* Session notes */}
      <div className="rounded-2xl border overflow-hidden" style={S}>
        <button onClick={() => setShowNotes(!showNotes)} className="w-full flex items-center justify-between px-4 py-3 text-sm" style={{ color: '#6b6b80' }}>
          <span>Session notes</span>
          {showNotes ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showNotes && (
          <div className="px-4 pb-4">
            <textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)}
              placeholder="Overall notes for this session…" rows={3}
              className="w-full rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none" style={{ ...S2, color: '#e8e8f0' }} />
          </div>
        )}
      </div>

      <button onClick={handleComplete} disabled={completing}
        className="w-full py-4 rounded-xl font-bold tracking-wider flex items-center justify-center gap-2.5 transition-all active:scale-[.98] disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg, #22d3a0, #0f9b70)', color: '#000', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1rem', letterSpacing: '0.1em' }}>
        <CheckCircle size={18} />
        {completing ? 'Saving…' : 'Complete Workout'}
      </button>
    </div>
  )
}

/* ── Exercise block ───────────────────────────────────────────────── */
function ExerciseBlock({ ex, prevEx, prevDate }) {
  const [showPrev, setShowPrev] = useState(false)

  const planEx = ex.planEx ?? null // already attached by parent

  const sets = useLiveQuery(
    () => db.sessionSets.where('sessionExerciseId').equals(ex.id).sortBy('setNumber'),
    [ex.id]
  )

  const unit = planEx?.repsOrSeconds === 'seconds' ? 'sec' : 'reps'

  async function handleUpdate(id, field, val) { await updateSet(id, { [field]: val }) }
  async function handleDelete(id)             { await deleteSet(id, ex.id) }
  async function handleUpdateEx(field, val)   { await updateSessionExercise(ex.id, { [field]: val }) }

  return (
    <div className="rounded-2xl border overflow-hidden" style={S}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h3 className="font-bold text-lg tracking-tight" style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#e8e8f0' }}>
          {ex.name}
        </h3>
        <div className="flex flex-wrap gap-3 mt-0.5 text-xs" style={{ color: '#6b6b80' }}>
          {planEx?.targetSets && <span>Target: {planEx.targetSets} × {planEx.targetReps || '?'} {unit}</span>}
          {planEx?.progression && <span style={{ color: '#a0a0b8' }}>↑ {planEx.progression}</span>}
          {planEx?.band        && <span>Band: {planEx.band}</span>}
          {planEx?.ringHeight  && <span style={{ color: '#f59e0b' }}>○ {planEx.ringHeight}</span>}
        </div>
        {planEx?.cues && <p className="text-xs mt-1 italic" style={{ color: '#6b6b80' }}>{planEx.cues}</p>}

        {/* Previous session toggle */}
        {prevEx && (
          <button onClick={() => setShowPrev(!showPrev)}
            className="mt-2.5 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors"
            style={{ color: showPrev ? BRAND : '#6b6b80', borderColor: showPrev ? BRAND + '40' : '#2a2a38', background: showPrev ? BRAND + '10' : 'transparent' }}>
            {showPrev ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Previous: {prevEx.sets.length} sets
            {prevDate && ` · ${format(new Date(prevDate), 'MMM d')}`}
          </button>
        )}
      </div>

      {/* Previous data */}
      {showPrev && prevEx && (
        <div className="mx-4 mb-3 rounded-xl p-3 border" style={{ background: '#0a0a12', borderColor: '#1e1e2a' }}>
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#6b6b80' }}>Previous Session</p>
          {prevEx.nextTarget && (
            <div className="flex items-center gap-2 mb-2 text-xs px-2 py-1.5 rounded-lg" style={{ background: BRAND + '15', color: BRAND }}>
              <Target size={11} />
              <span>You planned: {prevEx.nextTarget}</span>
            </div>
          )}
          {prevEx.howItWas && (
            <p className="text-xs mb-2 italic" style={{ color: '#a0a0b8' }}>"{prevEx.howItWas}"</p>
          )}
          <div className="space-y-1.5">
            {prevEx.sets.map(s => (
              <div key={s.id} className="flex gap-3 text-xs" style={{ color: '#a0a0b8' }}>
                <span style={{ color: '#6b6b80', width: '1.5rem' }}>#{s.setNumber}</span>
                <span>{s.reps || '—'} {unit}</span>
                <span>{s.weight || '—'} kg</span>
                {s.notes && <span className="italic truncate" style={{ color: '#6b6b80' }}>{s.notes}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current sets */}
      <div className="px-4 pb-2 space-y-2">
        {sets?.length > 0 && (
          <>
            <div className="flex gap-2 text-xs px-1 mb-1" style={{ color: '#6b6b80' }}>
              <span className="w-7">Set</span>
              <span className="w-16 text-center">{unit === 'sec' ? 'Sec' : 'Reps'}</span>
              <span className="w-20 text-center">Weight</span>
              <span className="flex-1">Note</span>
              <span className="w-6" />
            </div>
            {sets.map(s => <SetRow key={s.id} set={s} unit={unit} onUpdate={handleUpdate} onDelete={handleDelete} />)}
          </>
        )}
        <button onClick={() => addSet(ex.id)}
          className="w-full py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5 border transition-colors"
          style={{ background: '#1a1a24', borderColor: '#2a2a38', color: '#6b6b80' }}>
          <Plus size={14} />
          {sets?.length ? 'Add Set' : 'Log First Set'}
        </button>
      </div>

      {/* How it was + Next target */}
      <div className="px-4 pb-4 pt-1 grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: '#6b6b80' }}>How it was</label>
          <input
            value={ex.howItWas || ''}
            onChange={e => handleUpdateEx('howItWas', e.target.value)}
            placeholder="Felt strong, struggled…"
            className="w-full rounded-lg px-2.5 py-2 text-xs focus:outline-none"
            style={{ ...S2, color: '#e8e8f0' }}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: '#6b6b80' }}>Next target</label>
          <input
            value={ex.nextTarget || ''}
            onChange={e => handleUpdateEx('nextTarget', e.target.value)}
            placeholder="+1 rep, 30 sec, +2.5kg…"
            className="w-full rounded-lg px-2.5 py-2 text-xs focus:outline-none"
            style={{ ...S2, color: '#e8e8f0' }}
          />
        </div>
      </div>
    </div>
  )
}

/* ── Set row ─────────────────────────────────────────────────────── */
function SetRow({ set, unit, onUpdate, onDelete }) {
  const iStyle = { background: '#1a1a24', border: '1px solid #2a2a38', color: '#e8e8f0', borderRadius: '8px', padding: '6px 8px', fontSize: '0.875rem', textAlign: 'center', width: '100%', outline: 'none' }
  return (
    <div className="flex gap-2 items-center">
      <span className="text-xs w-7 text-center" style={{ color: '#6b6b80' }}>#{set.setNumber}</span>
      <div className="w-16">
        <input type="number" inputMode="numeric" placeholder="—" value={set.reps ?? ''}
          onChange={e => onUpdate(set.id, 'reps', e.target.value)} style={iStyle} />
      </div>
      <div className="w-20">
        <input type="number" inputMode="decimal" placeholder="—" value={set.weight ?? ''}
          onChange={e => onUpdate(set.id, 'weight', e.target.value)} style={iStyle} />
      </div>
      <div className="flex-1 min-w-0">
        <input type="text" placeholder="note" value={set.notes ?? ''}
          onChange={e => onUpdate(set.id, 'notes', e.target.value)} style={{ ...iStyle, textAlign: 'left' }} />
      </div>
      <button onClick={() => onDelete(set.id)} className="w-6 flex-shrink-0 flex items-center justify-center" style={{ color: '#6b6b80' }}>
        <Trash2 size={13} />
      </button>
    </div>
  )
}

/* ── Block header ─────────────────────────────────────────────────── */
function BlockHeader({ block }) {
  const color = BLOCK_COLORS[block] || '#6b6b80'
  return (
    <div className="flex items-center gap-2 mt-1">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="text-xs uppercase tracking-widest font-bold" style={{ color }}>{block} Block</span>
      <div className="flex-1 h-px" style={{ background: color + '30' }} />
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: BRAND, borderTopColor: 'transparent' }} />
    </div>
  )
}
