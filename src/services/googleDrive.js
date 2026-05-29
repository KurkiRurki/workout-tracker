const SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const FILE  = 'workout-tracker-backup.json'

function saveToken(resp) {
  localStorage.setItem('gd_token',  resp.access_token)
  localStorage.setItem('gd_expiry', String(Date.now() + (resp.expires_in - 120) * 1000))
}

function getToken() { return localStorage.getItem('gd_token') }

export function isConnected() {
  const token  = localStorage.getItem('gd_token')
  const expiry = localStorage.getItem('gd_expiry')
  return !!(token && expiry && Date.now() < Number(expiry))
}

export function getClientId()      { return localStorage.getItem('gd_client_id') || '' }
export function setClientId(id)    { localStorage.setItem('gd_client_id', id) }
export function getLastBackup()    { return localStorage.getItem('gd_last_backup') || null }

function loadGIS() {
  return new Promise(resolve => {
    if (window.google?.accounts?.oauth2) { resolve(); return }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.onload = resolve
    document.head.appendChild(s)
  })
}

export async function connectDrive(clientId) {
  await loadGIS()
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback(resp) {
        if (resp.error) { reject(new Error(resp.error)); return }
        saveToken(resp)
        localStorage.setItem('gd_client_id', clientId)
        resolve(resp)
      },
    })
    client.requestAccessToken()
  })
}

export async function refreshIfNeeded() {
  if (isConnected()) return true
  const clientId = getClientId()
  if (!clientId) return false
  try {
    await loadGIS()
    return await new Promise(resolve => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback(resp) {
          if (resp.error || !resp.access_token) { resolve(false); return }
          saveToken(resp)
          resolve(true)
        },
      })
      client.requestAccessToken({ prompt: '' })
    })
  } catch { return false }
}

export async function backupToDrive(data) {
  const ok = await refreshIfNeeded()
  if (!ok) return false
  const token   = getToken()
  const content = JSON.stringify(data)
  const search  = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D'${FILE}'&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const { files } = await search.json()
  const existing  = files?.[0]
  let success
  if (existing) {
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`,
      { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: content }
    )
    success = res.ok
  } else {
    const meta = JSON.stringify({ name: FILE, parents: ['appDataFolder'] })
    const form = new FormData()
    form.append('metadata', new Blob([meta], { type: 'application/json' }))
    form.append('file',     new Blob([content], { type: 'application/json' }))
    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
    )
    success = res.ok
  }
  if (success) localStorage.setItem('gd_last_backup', new Date().toISOString())
  return success
}

export async function restoreFromDrive() {
  const ok = await refreshIfNeeded()
  if (!ok) return null
  const token  = getToken()
  const search = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D'${FILE}'&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const { files } = await search.json()
  const file = files?.[0]
  if (!file) return null
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  return res.ok ? await res.json() : null
}

export function disconnectDrive() {
  const token = localStorage.getItem('gd_token')
  if (token && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(token, () => {})
  }
  localStorage.removeItem('gd_token')
  localStorage.removeItem('gd_expiry')
  localStorage.removeItem('gd_last_backup')
}
