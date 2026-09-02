/*
 * PROMPT 22 (v2) §4 — pure auto-assign eligibility gate.
 * Kept dependency-free so the scheduler's guard logic is directly unit-testable.
 */

/* Only these statuses are eligible: classification finished cleanly
 * (ai_confidence set) and the ticket is simply waiting for assignment.
 * 'Manual Review', 'ESCALATED' (dispatched offers pending) etc. are excluded. */
const AUTO_ASSIGNED_STATUSES = ['New', 'Open', 'AI Classified'];

/** Pure helper — per-priority delay cutoff in seconds (kept pure for tests). */
function getAutoAssignCutoff(baseTime, autoAssignSeconds) {
  return new Date(new Date(baseTime).getTime() - autoAssignSeconds * 1000);
}

/** Pure eligibility gate — what the SQL guard AND the race check enforce. */
function isEligibleForAutoAssign(ticket, cutoff) {
  if (!ticket) return false;
  if (ticket.assigned_to) return false;
  if (ticket.deleted_at != null) return false;
  if (ticket.ai_confidence == null) return false;
  if (!AUTO_ASSIGNED_STATUSES.includes(ticket.status)) return false;
  if (ticket.no_provider_flagged_at != null) return false;
  if (ticket.auto_assigned_at != null) return false;
  if (!cutoff || new Date(ticket.created_at) >= new Date(cutoff)) return false;
  return true;
}

export { AUTO_ASSIGNED_STATUSES, getAutoAssignCutoff, isEligibleForAutoAssign };