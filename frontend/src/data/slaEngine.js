import { getTickets, refreshTickets } from './ticketStore';

export let pollingIntervalId = null;

export function getSlaStatus(ticket) {
  if (!ticket?.slaResolutionBefore && !ticket?.slaResponseBefore) return null;

  const now = Date.now();
  const deadline = ticket.slaResolutionBefore || ticket.slaResponseBefore;
  const remaining = deadline - now;

  if (!ticket.createdAt) {
    return {
      state: remaining <= 0 ? 'breached' : 'ok',
      pctElapsed: remaining <= 0 ? 100 : 0,
      label: remaining <= 0 ? 'BREACHED' : '',
      color: remaining <= 0 ? 'var(--danger)' : 'var(--teal)',
      remaining,
    };
  }

  const createdMs = new Date(ticket.createdAt).getTime();
  const totalWindow = deadline - createdMs;
  const pctElapsed = totalWindow > 0
    ? Math.min(100, Math.max(0, ((now - createdMs) / totalWindow) * 100))
    : 0;

  if (remaining <= 0) {
    return { state: 'breached', pctElapsed: 100, label: 'BREACHED', color: 'var(--danger)', remaining: 0 };
  }

  const isWarning = pctElapsed >= 80;
  const hrs = Math.floor(remaining / 3600000);
  const mins = Math.floor((remaining % 3600000) / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return {
    state: isWarning ? 'warning' : 'ok',
    pctElapsed,
    label: isWarning ? timeStr : timeStr,
    color: isWarning ? 'var(--amber)' : 'var(--teal)',
    remaining,
  };
}

export function runSlaCheck() {
  const tickets = getTickets();
  const result = { warned: [], escalated: [] };

  for (const ticket of tickets) {
    if (['Completed', 'Tenant Confirmed', 'Closed', 'Cancelled', 'Archived', 'Escalated'].includes(ticket.status)) continue;

    const status = getSlaStatus(ticket);
    if (!status) continue;

    if (status.state === 'breached') {
      window.dispatchEvent(new CustomEvent('spmt:sla-breach', {
        detail: { ticketId: ticket.ticketId, priority: ticket.priority },
      }));
      result.escalated.push(ticket.ticketId);
    } else if (status.state === 'warning') {
      window.dispatchEvent(new CustomEvent('spmt:sla-warning', {
        detail: { ticketId: ticket.ticketId, pctElapsed: Math.round(status.pctElapsed) },
      }));
      result.warned.push(ticket.ticketId);
    }
  }

  return result;
}

export async function startSlaPolling() {
  if (pollingIntervalId) return;

  try { await refreshTickets(); } catch {}
  runSlaCheck();

  pollingIntervalId = setInterval(async () => {
    try { await refreshTickets(); } catch {}
    runSlaCheck();
  }, 15 * 1000);
}

export function stopSlaPolling() {
  if (pollingIntervalId) {
    clearInterval(pollingIntervalId);
    pollingIntervalId = null;
  }
}
