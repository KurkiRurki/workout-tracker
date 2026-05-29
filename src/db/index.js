import Dexie from 'dexie';
import { isConnected, backupToDrive } from '../services/googleDrive.js';

export const db = new Dexie('WorkoutTracker');

// Version 1 - original schema (kept for migration)
db.version(1).stores({
  plans:            '++id, name, createdAt',
  planDays:         '++id, planId, dayIndex, name',
  planExercises:    '++id, planDayId, order, name',
  sessions:         '++id, planDayId, date, completed',
  sessionExercises: '++id, sessionId, planExerciseId, order',
  sessionSets:      '++id, sessionExerciseId, setNumber',
  appState:         'key',
  settings:         'key',
});

// Version 2 - adds block field index, migrates existing data
db.version(2).stores({
  plans:            '++id, name, createdAt',
  planDays:         '++id, planId, dayIndex, name',
  planExercises:    '++id, planDayId, order, name, block',
  sessions:         '++id, planDayId, date, completed',
  sessionExercises: '++id, sessionId, planExerciseId, order',
  sessionSets:      '++id, sessionExerciseId, setNumber',
  appState:         'key',
  settings:         'key',
}).upgrade(tx =>
  tx.table('planExercises').toCollection().modify(ex => {
    if (!ex.block)          ex.block          = 'Strength';
    if (!ex.repsOrSeconds)  ex.repsOrSeconds  = 'reps';
    if (!ex.cues && ex.notes) { ex.cues = ex.notes; }
  })
);

export async function initDB() {
  const stateDefaults = [
    { key: 'activePlanId',    value: null },
    { key: 'currentDayIndex', value: 0    },
    { key: 'activeSessionId', value: null },
  ];
  for (const e of stateDefaults)
    if (!await db.appState.get(e.key)) await db.appState.put(e);

  const settingsDefaults = [
    { key: 'ringHeight',  value: '' },
    { key: 'weightUnit',  value: 'kg' },
    { key: 'userName',    value: '' },
  ];
  for (const e of settingsDefaults)
    if (!await db.settings.get(e.key)) await db.settings.put(e);
}

export const getState   = async k => (await db.appState.get(k))?.value ?? null;
export const setState   = async (k, v) => db.appState.put({ key: k, value: v });
export const getSetting = async k => (await db.settings.get(k))?.value ?? '';
export const setSetting = async (k, v) => db.settings.put({ key: k, value: v });

export async function getFullBackup() {
  return {
    exportedAt:       new Date().toISOString(),
    plans:            await db.plans.toArray(),
    planDays:         await db.planDays.toArray(),
    planExercises:    await db.planExercises.toArray(),
    sessions:         await db.sessions.toArray(),
    sessionExercises: await db.sessionExercises.toArray(),
    sessionSets:      await db.sessionSets.toArray(),
    settings:         await db.settings.toArray(),
    appState:         await db.appState.toArray(),
  };
}

export async function startWorkout(planDayId) {
  const planExs = await db.planExercises.where('planDayId').equals(planDayId).sortBy('order');
  const sessionId = await db.sessions.add({
    planDayId, date: new Date().toISOString(), completed: 0, completedAt: null, notes: '',
  });
  for (const pe of planExs) {
    await db.sessionExercises.add({
      sessionId, planExerciseId: pe.id, name: pe.name, order: pe.order,
      notes: '', howItWas: '', nextTarget: '',
    });
  }
  await setState('activeSessionId', sessionId);
  return sessionId;
}

export async function completeWorkout(sessionId, notes = '') {
  await db.sessions.update(sessionId, { completed: 1, completedAt: new Date().toISOString(), notes });
  const planId = await getState('activePlanId');
  if (planId) {
    const total = await db.planDays.where('planId').equals(planId).count();
    const idx   = (await getState('currentDayIndex')) ?? 0;
    if (total > 0) await setState('currentDayIndex', (idx + 1) % total);
  }
  await setState('activeSessionId', null);

  // Auto-backup to Google Drive if connected
  if (isConnected()) {
    try {
      const data = await getFullBackup();
      await backupToDrive(data);
    } catch (e) {
      console.warn('Drive auto-backup failed:', e);
    }
  }
}

export async function addSet(sessionExerciseId) {
  const count = await db.sessionSets.where('sessionExerciseId').equals(sessionExerciseId).count();
  return db.sessionSets.add({
    sessionExerciseId, setNumber: count + 1,
    reps: '', weight: '', rpe: '', notes: '', mediaLink: null,
  });
}

export async function updateSet(id, updates)            { return db.sessionSets.update(id, updates); }
export async function updateSessionExercise(id, updates){ return db.sessionExercises.update(id, updates); }

export async function deleteSet(id, sessionExerciseId) {
  await db.sessionSets.delete(id);
  const rem = await db.sessionSets.where('sessionExerciseId').equals(sessionExerciseId).sortBy('setNumber');
  for (let i = 0; i < rem.length; i++)
    await db.sessionSets.update(rem[i].id, { setNumber: i + 1 });
}

export async function getPreviousSessionData(planDayId, currentSessionId) {
  const all = await db.sessions
    .where('planDayId').equals(planDayId)
    .filter(s => s.completed === 1 && s.id !== currentSessionId)
    .toArray();
  if (!all.length) return null;
  all.sort((a, b) => new Date(b.date) - new Date(a.date));
  const prev = all[0];
  const exercises = await db.sessionExercises.where('sessionId').equals(prev.id).sortBy('order');
  const exercisesWithSets = await Promise.all(exercises.map(async ex => ({
    ...ex,
    sets: await db.sessionSets.where('sessionExerciseId').equals(ex.id).sortBy('setNumber'),
  })));
  return { session: prev, exercises: exercisesWithSets };
}
