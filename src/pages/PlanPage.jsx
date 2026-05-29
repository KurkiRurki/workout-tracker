import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getState, setState } from '../db/index.js'
import { Plus, Edit2, Trash2, ChevronLeft, Check, Star } from 'lucide-react'

const S = { background: '#111118', borderColor: '#1e1e2a' }
const BRAND = '#22d3a0'
const BLOCKS = ['Handstand', 'Strength', 'Conditioning']
const BLOCK_COLORS = { Handstand: '#6366f1', Strength: '#22d3a0', Conditioning: '#f59e0b' }

export default function PlanPage() {
  const [view, setView]                   = useState('plans')
  const [selectedPlanId, setSelectedPlanId] = useState(null)
  const [selectedDayId, setSelectedDayId]   = useState(null)

  if (view === 'editDay')
    return <EditDay dayId={selectedDayId} onBack={() => setView('editPlan')} />
  if (view === 'editPlan')
    return (
      <EditPlan
        planId={selectedPlanId}
        onBack={() => setView('plans')}
        onEditDay={id => { setSelectedDayId(id); setView('editDay') }}
      />
    )
  return <PlansList onEditPlan={id => { setSelectedPlanId(id); setView('editPlan') }} />
}

/* ── Plans list ──────────────────────────────────────────────────── */
function PlansList({ onEditPlan }) {
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')

  const plans        = useLiveQuery(() => db.plans.toArray())
  const activePlanId = useLiveQuery(async () => (await db.appState.get('activePlanId'))?.value)

  async function handleCreate() {
    if (!newName.trim()) return
    const id = await db.plans.add({ name: newName.trim(), createdAt: new Date().toISOString() })
    // Auto-activate first plan
    const current = (await db.appState.get('activePlanId'))?.value
    if (!current) {
      await setState('activePlanId', id)
      await setState('currentDayIndex', 0)
      await setState('activeSessionId', null)
    }
    setNewName(''); setShowNew(false)
    onEditPlan(id)
  }

  async function handleSetActive(planId) {
    await setState('activePlanId', planId)
    await setState('currentDayIndex', 0)
    await setState('activeSessionId', null)
  }

  async function handleDelete(planId) {
    if (!confirm('Delete this plan and all its data?')) return
    const days = await db.planDays.where('planId').equals(planId).toArray()
    for (const d of days) await db.planExercises.where('planDayId').equals(d.id).delete()
    await db.planDays.where('planId').equals(planId).delete()
    await db.plans.delete(planId)
    if (activePlanId === planId) await setState('activePlanId', null)
  }

  return (
    <div className="space-y-5 fade-up">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
          Workout Plans
        </h1>
        <button onClick={() => setShowNew(true)}
          className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5"
          style={{ background: BRAND, color: '#000' }}>
          <Plus size={15} /> New Plan
        </button>
      </div>

      {showNew && (
        <div className="rounded-2xl p-4 border fade-up" style={{ ...S, borderColor: BRAND + '40' }}>
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#6b6b80' }}>Plan Name</p>
          <input value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus placeholder="e.g. Push Pull Legs, Ring Strength…"
            className="w-full rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none"
            style={{ background: '#1a1a24', color: '#e8e8f0', border: '1px solid #2a2a38' }} />
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={!newName.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: BRAND, color: '#000' }}>
              Create & Edit
            </button>
            <button onClick={() => { setShowNew(false); setNewName('') }}
              className="px-4 py-2.5 rounded-xl text-sm"
              style={{ background: '#1a1a24', color: '#6b6b80' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {!plans?.length ? (
        <div className="text-center py-16" style={{ color: '#6b6b80' }}>
          <div className="text-5xl mb-4">📋</div>
          <p className="mb-2">No plans yet.</p>
          <button onClick={() => setShowNew(true)} style={{ color: BRAND }} className="text-sm">Create your first plan →</button>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(p => (
            <PlanCard key={p.id} plan={p} isActive={p.id === activePlanId}
              onEdit={() => onEditPlan(p.id)}
              onSetActive={() => handleSetActive(p.id)}
              onDelete={() => handleDelete(p.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function PlanCard({ plan, isActive, onEdit, onSetActive, onDelete }) {
  const dayCount = useLiveQuery(() => db.planDays.where('planId').equals(plan.id).count(), [plan.id])
  return (
    <div className="rounded-2xl p-4 border" style={{ ...S, borderColor: isActive ? BRAND + '50' : '#1e1e2a' }}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-lg tracking-tight" style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#e8e8f0' }}>
              {plan.name}
            </h2>
            {isActive && (
              <span className="text-xs px-2 py-0.5 rounded-full border" style={{ background: '#0f3d2a', color: BRAND, borderColor: '#1a6b49' }}>Active</span>
            )}
          </div>
          <p className="text-sm mt-0.5" style={{ color: '#6b6b80' }}>{dayCount ?? 0} training days</p>
        </div>
        <div className="flex gap-0.5">
          {!isActive && <button onClick={onSetActive} className="p-2" style={{ color: '#6b6b80' }}><Star size={16} /></button>}
          <button onClick={onEdit}   className="p-2" style={{ color: '#6b6b80' }}><Edit2   size={16} /></button>
          <button onClick={onDelete} className="p-2" style={{ color: '#6b6b80' }}><Trash2  size={16} /></button>
        </div>
      </div>
    </div>
  )
}

/* ── Edit plan ───────────────────────────────────────────────────── */
function EditPlan({ planId, onBack, onEditDay }) {
  const [name, setName]     = useState('')
  const [dirty, setDirty]   = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [newDay, setNewDay]  = useState('')

  const plan = useLiveQuery(() => db.plans.get(planId), [planId])
  const days = useLiveQuery(() => db.planDays.where('planId').equals(planId).sortBy('dayIndex'), [planId])

  useEffect(() => { if (plan && !dirty) setName(plan.name) }, [plan?.id])

  async function saveName() {
    if (name.trim()) await db.plans.update(planId, { name: name.trim() })
    setDirty(false)
  }

  async function addDay() {
    if (!newDay.trim()) return
    const id = await db.planDays.add({ planId, dayIndex: days?.length ?? 0, name: newDay.trim() })
    setNewDay(''); setShowNew(false); onEditDay(id)
  }

  async function deleteDay(dayId) {
    if (!confirm('Remove this training day?')) return
    await db.planExercises.where('planDayId').equals(dayId).delete()
    await db.planDays.delete(dayId)
    const rem = await db.planDays.where('planId').equals(planId).sortBy('dayIndex')
    for (let i = 0; i < rem.length; i++) await db.planDays.update(rem[i].id, { dayIndex: i })
  }

  return (
    <div className="space-y-5 fade-up">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1" style={{ color: '#6b6b80' }}><ChevronLeft size={22} /></button>
        <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>{plan?.name}</h1>
      </div>
      <div className="rounded-2xl p-4 border" style={S}>
        <label className="text-xs uppercase tracking-widest mb-2 block" style={{ color: '#6b6b80' }}>Plan Name</label>
        <div className="flex gap-2">
          <input value={name} onChange={e => { setName(e.target.value); setDirty(true) }} onBlur={saveName}
            className="flex-1 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
            style={{ background: '#1a1a24', color: '#e8e8f0', border: '1px solid #2a2a38' }} />
          <button onClick={saveName} className="px-3 py-2.5 rounded-xl" style={{ background: BRAND, color: '#000' }}><Check size={16} /></button>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>Training Days</h2>
          <button onClick={() => setShowNew(true)} className="text-sm flex items-center gap-1" style={{ color: BRAND }}>
            <Plus size={15} /> Add Day
          </button>
        </div>
        {showNew && (
          <div className="rounded-2xl p-4 border mb-3 fade-up" style={{ ...S, borderColor: BRAND + '40' }}>
            <input value={newDay} onChange={e => setNewDay(e.target.value)} onKeyDown={e => e.key === 'Enter' && addDay()}
              autoFocus placeholder="Day name (e.g. Push Day, Ring Skills…)"
              className="w-full rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none"
              style={{ background: '#1a1a24', color: '#e8e8f0', border: '1px solid #2a2a38' }} />
            <div className="flex gap-2">
              <button onClick={addDay} disabled={!newDay.trim()} className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40" style={{ background: BRAND, color: '#000' }}>Create & Edit</button>
              <button onClick={() => { setShowNew(false); setNewDay('') }} className="px-4 py-2.5 rounded-xl text-sm" style={{ background: '#1a1a24', color: '#6b6b80' }}>Cancel</button>
            </div>
          </div>
        )}
        {!days?.length && !showNew ? (
          <div className="text-center py-10 rounded-2xl border-2 border-dashed" style={{ borderColor: '#2a2a38', color: '#6b6b80' }}>
            <p className="mb-2">No days yet.</p>
            <button onClick={() => setShowNew(true)} style={{ color: BRAND }} className="text-sm">Add your first training day →</button>
          </div>
        ) : (
          <div className="space-y-2">
            {days?.map((d, i) => <DayCard key={d.id} day={d} idx={i} onEdit={() => onEditDay(d.id)} onDelete={() => deleteDay(d.id)} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function DayCard({ day, idx, onEdit, onDelete }) {
  const count = useLiveQuery(() => db.planExercises.where('planDayId').equals(day.id).count(), [day.id])
  return (
    <div className="rounded-xl p-4 border flex items-center gap-3" style={S}>
      <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
        style={{ background: '#1a1a24', color: BRAND, fontFamily: 'Barlow Condensed, sans-serif' }}>{idx + 1}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate" style={{ color: '#e8e8f0' }}>{day.name}</p>
        <p className="text-xs mt-0.5" style={{ color: '#6b6b80' }}>{count ?? 0} exercises</p>
      </div>
      <button onClick={onEdit}   className="p-1.5" style={{ color: '#6b6b80' }}><Edit2  size={15} /></button>
      <button onClick={onDelete} className="p-1.5" style={{ color: '#6b6b80' }}><Trash2 size={15} /></button>
    </div>
  )
}

/* ── Edit day ────────────────────────────────────────────────────── */
function EditDay({ dayId, onBack }) {
  const [name, setName]   = useState('')
  const [dirty, setDirty] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]     = useState(null)

  const day = useLiveQuery(() => db.planDays.get(dayId), [dayId])
  const exs = useLiveQuery(() => db.planExercises.where('planDayId').equals(dayId).sortBy('order'), [dayId])

  useEffect(() => { if (day && !dirty) setName(day.name) }, [day?.id])

  async function saveName() { if (name.trim()) await db.planDays.update(dayId, { name: name.trim() }); setDirty(false) }

  async function addEx(data) {
    await db.planExercises.add({ planDayId: dayId, order: exs?.length ?? 0, ...data })
    setShowForm(false)
  }

  async function updateEx(id, data) { await db.planExercises.update(id, data); setEditId(null) }

  async function deleteEx(id) {
    await db.planExercises.delete(id)
    const rem = await db.planExercises.where('planDayId').equals(dayId).sortBy('order')
    for (let i = 0; i < rem.length; i++) await db.planExercises.update(rem[i].id, { order: i })
  }

  // Group by block for display
  const grouped = {}
  for (const block of BLOCKS) grouped[block] = exs?.filter(e => (e.block || 'Strength') === block) ?? []
  const ungrouped = exs?.filter(e => !e.block) ?? []

  return (
    <div className="space-y-5 fade-up">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1" style={{ color: '#6b6b80' }}><ChevronLeft size={22} /></button>
        <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>{day?.name}</h1>
      </div>

      <div className="rounded-2xl p-4 border" style={S}>
        <label className="text-xs uppercase tracking-widest mb-2 block" style={{ color: '#6b6b80' }}>Day Name</label>
        <div className="flex gap-2">
          <input value={name} onChange={e => { setName(e.target.value); setDirty(true) }} onBlur={saveName}
            className="flex-1 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
            style={{ background: '#1a1a24', color: '#e8e8f0', border: '1px solid #2a2a38' }} />
          <button onClick={saveName} className="px-3 py-2.5 rounded-xl" style={{ background: BRAND, color: '#000' }}><Check size={16} /></button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>Exercises</h2>
        <button onClick={() => { setShowForm(true); setEditId(null) }} className="text-sm flex items-center gap-1" style={{ color: BRAND }}>
          <Plus size={15} /> Add
        </button>
      </div>

      {showForm && <ExerciseForm onSave={addEx} onCancel={() => setShowForm(false)} />}

      {BLOCKS.map(block => {
        const list = grouped[block] ?? []
        return (
          <div key={block}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full" style={{ background: BLOCK_COLORS[block] }} />
              <span className="text-xs uppercase tracking-widest font-bold" style={{ color: BLOCK_COLORS[block] }}>{block} Block</span>
              <span className="text-xs" style={{ color: '#6b6b80' }}>({list.length})</span>
            </div>
            <div className="space-y-2">
              {list.map((ex, i) =>
                editId === ex.id
                  ? <ExerciseForm key={ex.id} initial={ex} onSave={d => updateEx(ex.id, d)} onCancel={() => setEditId(null)} />
                  : <ExCard key={ex.id} ex={ex} idx={i} onEdit={() => { setEditId(ex.id); setShowForm(false) }} onDelete={() => deleteEx(ex.id)} />
              )}
              {!list.length && (
                <p className="text-xs italic pl-4" style={{ color: '#3a3a50' }}>No {block.toLowerCase()} exercises yet.</p>
              )}
            </div>
          </div>
        )
      })}

      {!exs?.length && !showForm && (
        <div className="text-center py-8 rounded-2xl border-2 border-dashed" style={{ borderColor: '#2a2a38', color: '#6b6b80' }}>
          <p className="mb-2">No exercises yet.</p>
          <button onClick={() => setShowForm(true)} style={{ color: BRAND }} className="text-sm">Add your first exercise →</button>
        </div>
      )}
    </div>
  )
}

function ExCard({ ex, idx, onEdit, onDelete }) {
  const block = ex.block || 'Strength'
  return (
    <div className="rounded-xl p-4 border" style={S}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: BLOCK_COLORS[block] + '20', color: BLOCK_COLORS[block] }}>{block}</span>
            <p className="font-semibold" style={{ color: '#e8e8f0' }}>{ex.name}</p>
          </div>
          {ex.progression && <p className="text-xs mt-1" style={{ color: '#a0a0b8' }}>↑ {ex.progression}</p>}
          <div className="flex flex-wrap gap-3 mt-1 text-xs" style={{ color: '#6b6b80' }}>
            {ex.targetSets && <span>{ex.targetSets} sets</span>}
            {ex.targetReps && <span>× {ex.targetReps} {ex.repsOrSeconds === 'seconds' ? 'sec' : 'reps'}</span>}
            {ex.band       && <span>Band: {ex.band}</span>}
            {ex.ringHeight && <span style={{ color: '#f59e0b' }}>○ {ex.ringHeight}</span>}
          </div>
          {ex.cues && <p className="text-xs mt-1 italic truncate" style={{ color: '#6b6b80' }}>{ex.cues}</p>}
        </div>
        <div className="flex gap-0.5 ml-2">
          <button onClick={onEdit}   className="p-1.5" style={{ color: '#6b6b80' }}><Edit2  size={14} /></button>
          <button onClick={onDelete} className="p-1.5" style={{ color: '#6b6b80' }}><Trash2 size={14} /></button>
        </div>
      </div>
    </div>
  )
}

/* ── Exercise form ───────────────────────────────────────────────── */
function ExerciseForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState({
    name:          initial?.name          ?? '',
    block:         initial?.block         ?? 'Strength',
    progression:   initial?.progression   ?? '',
    targetSets:    initial?.targetSets    ?? '',
    targetReps:    initial?.targetReps    ?? '',
    repsOrSeconds: initial?.repsOrSeconds ?? 'reps',
    band:          initial?.band          ?? '',
    ringHeight:    initial?.ringHeight    ?? '',
    cues:          initial?.cues          ?? (initial?.notes ?? ''),
  })
  const u = (k, v) => setF(p => ({ ...p, [k]: v }))

  return (
    <div className="rounded-2xl p-4 border space-y-3 fade-up" style={{ ...S, borderColor: BRAND + '40' }}>
      {/* Block selector */}
      <div>
        <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#6b6b80' }}>Block</p>
        <div className="flex gap-2">
          {BLOCKS.map(b => (
            <button key={b} onClick={() => u('block', b)}
              className="flex-1 py-2 rounded-xl text-xs font-bold tracking-wide transition-all"
              style={{
                background: f.block === b ? BLOCK_COLORS[b] + '25' : '#1a1a24',
                color:      f.block === b ? BLOCK_COLORS[b] : '#6b6b80',
                border: `1px solid ${f.block === b ? BLOCK_COLORS[b] + '60' : '#2a2a38'}`,
              }}>
              {b}
            </button>
          ))}
        </div>
      </div>

      <input value={f.name} onChange={e => u('name', e.target.value)} placeholder="Exercise / workout name *" autoFocus
        className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
        style={{ background: '#1a1a24', color: '#e8e8f0', border: '1px solid #2a2a38' }} />

      <input value={f.progression} onChange={e => u('progression', e.target.value)} placeholder="Current progression (e.g. Tuck Planche Hold)"
        className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
        style={{ background: '#1a1a24', color: '#e8e8f0', border: '1px solid #2a2a38' }} />

      <div className="grid grid-cols-2 gap-2">
        <input type="number" value={f.targetSets} onChange={e => u('targetSets', e.target.value)} placeholder="Target sets"
          className="rounded-xl px-3 py-2.5 text-sm focus:outline-none"
          style={{ background: '#1a1a24', color: '#e8e8f0', border: '1px solid #2a2a38' }} />
        <input value={f.targetReps} onChange={e => u('targetReps', e.target.value)} placeholder="Target reps / seconds"
          className="rounded-xl px-3 py-2.5 text-sm focus:outline-none"
          style={{ background: '#1a1a24', color: '#e8e8f0', border: '1px solid #2a2a38' }} />
      </div>

      {/* Reps or Seconds toggle */}
      <div>
        <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#6b6b80' }}>Unit</p>
        <div className="flex gap-2">
          {['reps','seconds'].map(u2 => (
            <button key={u2} onClick={() => u('repsOrSeconds', u2)}
              className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                background: f.repsOrSeconds === u2 ? BRAND : '#1a1a24',
                color:      f.repsOrSeconds === u2 ? '#000' : '#6b6b80',
                border: `1px solid ${f.repsOrSeconds === u2 ? BRAND : '#2a2a38'}`,
              }}>
              {u2 === 'reps' ? 'Reps' : 'Seconds'}
            </button>
          ))}
        </div>
      </div>

      <input value={f.band} onChange={e => u('band', e.target.value)} placeholder="Band (e.g. red, mini, none)"
        className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
        style={{ background: '#1a1a24', color: '#e8e8f0', border: '1px solid #2a2a38' }} />

      <input value={f.ringHeight} onChange={e => u('ringHeight', e.target.value)} placeholder="Ring height (e.g. hip, shoulder, 120cm)"
        className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
        style={{ background: '#1a1a24', color: '#e8e8f0', border: '1px solid #2a2a38' }} />

      <textarea value={f.cues} onChange={e => u('cues', e.target.value)} placeholder="Cues / coaching notes…" rows={2}
        className="w-full rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none"
        style={{ background: '#1a1a24', color: '#e8e8f0', border: '1px solid #2a2a38' }} />

      <div className="flex gap-2">
        <button onClick={() => onSave(f)} disabled={!f.name.trim()} className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40" style={{ background: BRAND, color: '#000' }}>
          {initial ? 'Save Changes' : 'Add Exercise'}
        </button>
        <button onClick={onCancel} className="px-4 py-2.5 rounded-xl text-sm" style={{ background: '#1a1a24', color: '#6b6b80' }}>Cancel</button>
      </div>
    </div>
  )
}
