const TicketStates = {
  NEW: 'New',
  AI_CLASSIFIED: 'AI Classified',
  MANUAL_REVIEW: 'Manual Review',
  ASSIGNED: 'Assigned',
  ACCEPTED: 'Accepted',
  IN_PROGRESS: 'In Progress',
  WAITING_FOR_PARTS: 'Waiting for Parts',
  COMPLETED: 'Completed',
  TENANT_CONFIRMED: 'Tenant Confirmed',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
  ARCHIVED: 'Archived',
  ON_HOLD: 'On Hold',
  REOPENED: 'Reopened',
  ESCALATED: 'Escalated',
  DECLINED: 'Declined',
};

const TRANSITIONS = {
  [TicketStates.NEW]: [TicketStates.AI_CLASSIFIED, TicketStates.MANUAL_REVIEW, TicketStates.CANCELLED],
  [TicketStates.AI_CLASSIFIED]: [TicketStates.ASSIGNED, TicketStates.MANUAL_REVIEW, TicketStates.CANCELLED],
  [TicketStates.MANUAL_REVIEW]: [TicketStates.AI_CLASSIFIED, TicketStates.CANCELLED],
  [TicketStates.ASSIGNED]: [TicketStates.ACCEPTED, TicketStates.CANCELLED, TicketStates.ON_HOLD, TicketStates.ESCALATED, TicketStates.DECLINED],
  [TicketStates.DECLINED]: [TicketStates.ASSIGNED, TicketStates.CANCELLED],
  [TicketStates.ACCEPTED]: [TicketStates.IN_PROGRESS, TicketStates.CANCELLED, TicketStates.ON_HOLD],
  [TicketStates.IN_PROGRESS]: [TicketStates.WAITING_FOR_PARTS, TicketStates.COMPLETED, TicketStates.ON_HOLD, TicketStates.ESCALATED],
  [TicketStates.WAITING_FOR_PARTS]: [TicketStates.IN_PROGRESS, TicketStates.ON_HOLD],
  [TicketStates.COMPLETED]: [TicketStates.TENANT_CONFIRMED, TicketStates.REOPENED],
  [TicketStates.TENANT_CONFIRMED]: [TicketStates.CLOSED, TicketStates.REOPENED],
  [TicketStates.CLOSED]: [TicketStates.REOPENED],
  [TicketStates.CANCELLED]: [TicketStates.ARCHIVED],
  [TicketStates.ARCHIVED]: [TicketStates.REOPENED],
  [TicketStates.ON_HOLD]: [TicketStates.IN_PROGRESS, TicketStates.CANCELLED],
  [TicketStates.REOPENED]: [TicketStates.ASSIGNED, TicketStates.IN_PROGRESS, TicketStates.CANCELLED],
  [TicketStates.ESCALATED]: [TicketStates.MANUAL_REVIEW, TicketStates.ASSIGNED],
};

const WORKFLOW_ORDER = [
  'New', 'AI Classified', 'Assigned', 'Accepted', 'In Progress',
  'Waiting for Parts', 'Completed', 'Tenant Confirmed', 'Closed',
];

function isValidTransition(from, to) {
  const allowed = TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

function getValidTransitions(state) {
  return TRANSITIONS[state] || [];
}

function isTerminal(state) {
  return [TicketStates.CLOSED, TicketStates.CANCELLED, TicketStates.ARCHIVED].includes(state);
}

function getWorkflowProgress(state) {
  const idx = WORKFLOW_ORDER.indexOf(state);
  return idx === -1 ? null : { current: idx, total: WORKFLOW_ORDER.length - 1, label: WORKFLOW_ORDER[idx] };
}

export {
  TicketStates, TRANSITIONS, isValidTransition, getValidTransitions,
  isTerminal, getWorkflowProgress, WORKFLOW_ORDER,
};
