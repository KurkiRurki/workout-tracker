import { useState, useEffect } from 'react'
import { db, getSetting, setSetting, getFullBackup } from '../db/index.js'
import { connectDrive, disconnectDrive, isConnected, getClientId, setClientId, getLastBackup, backupToDrive, restoreFromDrive } from '../services/googleDrive.js'
import { Save, Download, Upload, Info, Check, Cloud, CloudOff, RefreshCw, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'

const S  = { background: '#111118', borderColor: '#1e1e2a' }
const S2 = { background: '#1a1a24', border: '1px solid #2a2a38' }
const BRAND = '#22d3a0'

export default function SettingsPage() {
  const [cfg, setCfg]     = useState({ ringHeight: '', weightUnit: 'kg', userName: '' })
  const [saved, setSaved] = useState(false)

  const [clientId, setClientIdState] = useState(getClientId)
  const [connected, setConnected]    = useState(isConnected)
  const [lastBackup, setLastBackup]  = useState(getLastBackup)
  const [driveStatus, setDriveStatus] = useState('')  // '', 'connecting', 'backing_up', 'restoring', 'error'

  useEffect(() => { load() }, [])

  async function load() {
    setCfg({
      ringHeight: await getSetting('ringHeight'),
      weightUnit: await getSetting('weightUnit'),
      userName:   await getSetting('userName'),
    })
  }

  const set = (k, v) => setCfg(p => ({ ...p, [k]: v }))

  async function save() {
    await setSetting('ringHeight', cfg.ringHeight)
    await setSetting('weightUnit', cfg.weightUnit)
    await setSetting('userName',   cfg.userName)
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  async function doExport() {
    try {
      const data = await getFullBackup()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `workout-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click(); URL.revokeObjectURL(url)
    } catch (e) { alert('Export failed: ' + e.message) }
  }

  async function doImport(file) {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!confirm('This will replace ALL your data. Continue?')) return
      await importData(data)
      alert('Import successful!')
      load()
    } catch (e) { alert('Import failed: ' + e.message) }
  }

  async function importData(data) {
    await db.transaction('rw',
      db.plans, db.planDays, db.planExercises,
      db.sessions, db.sessionExercises, db.sessionSets,
      db.settings, db.appState,
      async () => {
        await db.plans.clear();            await db.plans.bulkAdd(data.plans ?? [])
        await db.planDays.clear();         await db.planDays.bulkAdd(data.planDays ?? [])
        await db.planExercises.clear();    await db.planExercises.bulkAdd(data.planExercises ?? [])
        await db.sessions.clear();         await db.sessions.bulkAdd(data.sessions ?? [])
        await db.sessionExercises.clear(); await db.sessionExercises.bulkAdd(data.sessionExercises ?? [])
        await db.sessionSets.clear();      await db.sessionSets.bulkAdd(data.sessionSets ?? [])
        await db.settings.clear();         await db.settings.bulkAdd(data.settings ?? [])
        await db.appState.clear();         await db.appState.bulkAdd(data.appState ?? [])
      }
    )
  }

  /* ── Google Drive ── */
  async function handleConnect() {
    if (!clientId.trim()) { alert('Paste your Google Client ID first.'); return }
    setClientId(clientId.trim())
    setDriveStatus('connecting')
    try {
      await connectDrive(clientId.trim())
      setConnected(true)
      setDriveStatus('')
    } catch (e) {
      setDriveStatus('error')
      alert('Connection failed: ' + e.message)
    }
  }

  async function handleBackupNow() {
    setDriveStatus('backing_up')
    try {
      const data = await getFullBackup()
      const ok   = await backupToDrive(data)
      if (ok) { setLastBackup(getLastBackup()); setDriveStatus('') }
      else { setDriveStatus('error'); alert('Backup failed. Try reconnecting.') }
    } catch (e) { setDriveStatus('error'); alert('Backup failed: ' + e.message) }
  }

  async function handleRestore() {
    if (!confirm('Restore from Google Drive? This will replace all current data.')) return
    setDriveStatus('restoring')
    try {
      const data = await restoreFromDrive()
      if (!data) { alert('No backup found in Drive.'); setDriveStatus(''); return }
      await importData(data)
      setDriveStatus('')
      alert('Restored successfully!')
      load()
    } catch (e) { setDriveStatus('error'); alert('Restore failed: ' + e.message) }
  }

  function handleDisconnect() {
    disconnectDrive()
    setConnected(false)
    setLastBackup(null)
    setDriveStatus('')
  }

  return (
    <div className="space-y-5 fade-up">
      <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>Settings</h1>

      {/* Personal */}
      <Section title="Personal">
        <Field label="Your name">
          <input value={cfg.userName} onChange={e => set('userName', e.target.value)} placeholder="e.g. Alex"
            className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none" style={{ ...S2, color: '#e8e8f0' }} />
        </Field>
        <Field label="Weight unit">
          <div className="flex gap-2">
            {['kg', 'lbs'].map(u => (
              <button key={u} onClick={() => set('weightUnit', u)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: cfg.weightUnit === u ? BRAND : '#1a1a24', color: cfg.weightUnit === u ? '#000' : '#6b6b80', border: `1px solid ${cfg.weightUnit === u ? BRAND : '#2a2a38'}` }}>
                {u}
              </button>
            ))}
          </div>
        </Field>
      </Section>

      {/* Equipment */}
      <Section title="Equipment">
        <Field label="Default gymnastics ring height">
          <input value={cfg.ringHeight} onChange={e => set('ringHeight', e.target.value)} placeholder="e.g. hip height, 120 cm"
            className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none" style={{ ...S2, color: '#e8e8f0' }} />
          <p className="text-xs mt-1.5" style={{ color: '#6b6b80' }}>Also configurable per exercise in your plan.</p>
        </Field>
      </Section>

      {/* Save */}
      <button onClick={save}
        className="w-full py-4 rounded-xl font-bold tracking-wider flex items-center justify-center gap-2.5 transition-all active:scale-[.98]"
        style={{ background: saved ? '#0f7a5c' : 'linear-gradient(135deg, #22d3a0, #0f9b70)', color: '#000', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1rem', letterSpacing: '0.1em' }}>
        {saved ? <><Check size={18} /> Saved!</> : <><Save size={18} /> Save Settings</>}
      </button>

      {/* Google Drive */}
      <Section title="Google Drive Backup">
        <div className="flex items-center gap-3 mb-4">
          {connected
            ? <><div className="w-2 h-2 rounded-full" style={{ background: BRAND }} /><span className="text-sm font-medium" style={{ color: BRAND }}>Connected</span></>
            : <><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-sm" style={{ color: '#6b6b80' }}>Not connected</span></>
          }
          {lastBackup && (
            <span className="text-xs ml-auto" style={{ color: '#6b6b80' }}>
              Last backup: {format(new Date(lastBackup), 'MMM d, HH:mm')}
            </span>
          )}
        </div>

        {!connected && (
          <>
            <Field label="Google OAuth Client ID">
              <input value={clientId} onChange={e => setClientIdState(e.target.value)}
                placeholder="xxxx.apps.googleusercontent.com"
                className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none font-mono" style={{ ...S2, color: '#e8e8f0', fontSize: '0.75rem' }} />
            </Field>
            <button onClick={handleConnect} disabled={driveStatus === 'connecting' || !clientId.trim()}
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 mt-3 disabled:opacity-40"
              style={{ background: BRAND, color: '#000' }}>
              <Cloud size={16} />
              {driveStatus === 'connecting' ? 'Connecting…' : 'Connect Google Drive'}
            </button>
            <p className="text-xs mt-3" style={{ color: '#6b6b80' }}>
              Need a Client ID? See the guide below.
            </p>
          </>
        )}

        {connected && (
          <div className="space-y-2">
            <p className="text-sm mb-3" style={{ color: '#a0a0b8' }}>
              Auto-backup runs after every completed workout. Data is stored in your private Google Drive app folder.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleBackupNow} disabled={!!driveStatus}
                className="py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: '#1a1a24', color: '#e8e8f0', border: '1px solid #2a2a38' }}>
                <RefreshCw size={14} className={driveStatus === 'backing_up' ? 'animate-spin' : ''} />
                {driveStatus === 'backing_up' ? 'Backing up…' : 'Backup Now'}
              </button>
              <button onClick={handleRestore} disabled={!!driveStatus}
                className="py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: '#1a1a24', color: '#e8e8f0', border: '1px solid #2a2a38' }}>
                <Download size={14} />
                {driveStatus === 'restoring' ? 'Restoring…' : 'Restore'}
              </button>
            </div>
            <button onClick={handleDisconnect}
              className="w-full py-2.5 rounded-xl text-sm flex items-center justify-center gap-2"
              style={{ color: '#6b6b80' }}>
              <CloudOff size={14} /> Disconnect
            </button>
          </div>
        )}

        {/* Setup guide */}
        <details className="mt-4">
          <summary className="text-xs cursor-pointer" style={{ color: '#6b6b80' }}>
            How to get a Client ID (5 min setup)
          </summary>
          <ol className="mt-3 space-y-1.5 text-xs" style={{ color: '#a0a0b8' }}>
            <li>1. Go to <span style={{ color: BRAND }}>console.cloud.google.com</span></li>
            <li>2. Create a new project (any name)</li>
            <li>3. APIs &amp; Services → Enable APIs → search "Drive API" → Enable</li>
            <li>4. APIs &amp; Services → Credentials → Create Credentials → OAuth 2.0 Client ID</li>
            <li>5. Application type: <strong>Web application</strong></li>
            <li>6. Authorized JavaScript origins: add your app URL (e.g. <span style={{ color: BRAND }}>https://yourapp.pages.dev</span>)</li>
            <li>7. Copy the Client ID and paste it above</li>
          </ol>
        </details>
      </Section>

      {/* Manual backup */}
      <Section title="Manual Backup">
        <p className="text-sm mb-3" style={{ color: '#6b6b80' }}>Export/import all data as a JSON file.</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={doExport}
            className="py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
            style={{ background: '#1a1a24', color: '#e8e8f0', border: '1px solid #2a2a38' }}>
            <Download size={15} /> Export JSON
          </button>
          <label className="py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
            style={{ background: '#1a1a24', color: '#e8e8f0', border: '1px solid #2a2a38' }}>
            <Upload size={15} /> Import JSON
            <input type="file" accept=".json" className="hidden" onChange={e => e.target.files?.[0] && doImport(e.target.files[0])} />
          </label>
        </div>
      </Section>

      <p className="text-center text-xs pb-2" style={{ color: '#3a3a50' }}>
        Workout Tracker · Offline-first PWA · All data stays on your device
      </p>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="rounded-2xl p-4 border space-y-4" style={S}>
      <h2 className="font-bold" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.1rem', color: '#e8e8f0' }}>{title}</h2>
      {children}
    </div>
  )
}
function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest mb-2 block" style={{ color: '#6b6b80' }}>{label}</label>
      {children}
    </div>
  )
}
