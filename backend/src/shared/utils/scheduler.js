/*
 * Background scheduler for BR-003 (emergency auto-assign + SLA breach).
 * Runs every 5 minutes in production.
 */

import { autoAssignEmergencyTickets, markSlaBreaches } from './emergencyScheduler.js';

const INTERVAL_MS = 5 * 60 * 1000; /* 5 minutes */

let intervalHandle = null;

function start() {
  if (intervalHandle) return;
  console.log('[Scheduler] Starting background tasks (every 5 min)');

  /* Run immediately on start */
  runTasks();

  intervalHandle = setInterval(runTasks, INTERVAL_MS);
}

function stop() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[Scheduler] Stopped');
  }
}

async function runTasks() {
  try {
    const autoAssigned = await autoAssignEmergencyTickets();
    if (autoAssigned > 0) {
      console.log(`[Scheduler] Auto-assigned ${autoAssigned} emergency ticket(s)`);
    }

    const breached = await markSlaBreaches();
    if (breached > 0) {
      console.log(`[Scheduler] Marked ${breached} SLA breach(es)`);
    }
  } catch (err) {
    console.error('[Scheduler] Error:', err.message);
  }
}

export { start, stop };
