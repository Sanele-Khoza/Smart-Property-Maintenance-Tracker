/**
 * SLA Management Engine — MOD-005 (SDD §4)
 * Simulates the server-side node-cron job described in the SDD.
 * Production: this runs as a background cron thread on the Node.js API server,
 * polling every SLA_POLL_INTERVAL_MINUTES (default: 5 min) via node-cron.
 * The window CustomEvents simulate SNS/SES notifications to PM and SysAdmin.
 */
import { getTickets, updateTicketStatus, getSystemSettings, getTechnicians, assignTicket, addNotification, getSlaConfig } from './store';
import { getStore, saveToLocalStorage } from './storeCore';

export let pollingIntervalId = null;

export function runSlaCheck() {
  const store = getStore();
  const now = Date.now();
  const tickets = getTickets();
  const slaConfig = getSlaConfig();
  const results = { warned: [], escalated: [], autoAssigned: [] };

  for (const ticket of tickets) {
    if (['Closed', 'Completed (Provider)', 'Escalated'].includes(ticket.status)) continue;

    const resolutionDeadline = ticket.slaResolutionBefore;
    const sla = slaConfig.find(s => s.priority === ticket.priority);
    const warningPct = sla?.warningPercent || 0.80;

    // --- ESCALATION check (resolution breach) ---
    if (now > resolutionDeadline && ticket.status !== 'Escalated') {
      updateTicketStatus(ticket.ticketId, 'Escalated',
        'SLA resolution deadline breached — auto-escalated by SLA Engine (MOD-005)');
      addNotification('admin@spmt.com', 'email',
        `SLA BREACH: ${ticket.ticketId} (${ticket.priority}) — resolution deadline exceeded. Auto-escalated.`, true);
      window.dispatchEvent(new CustomEvent('spmt:sla-breach', {
        detail: { ticketId: ticket.ticketId, priority: ticket.priority }
      }));
      results.escalated.push(ticket.ticketId);
    }

    // --- WARNING check (approaching breach) ---
    const createdMs = new Date(ticket.createdAt).getTime();
    const totalWindow = resolutionDeadline - createdMs;
    const elapsed = now - createdMs;
    const pctElapsed = totalWindow > 0 ? elapsed / totalWindow : 1;

    if (pctElapsed >= warningPct && pctElapsed < 1 && !ticket.slaWarningSent) {
      const t = store.tickets.find(tk => tk.ticketId === ticket.ticketId);
      if (t) { t.slaWarningSent = true; saveToLocalStorage(); }
      window.dispatchEvent(new CustomEvent('spmt:sla-warning', {
        detail: { ticketId: ticket.ticketId, pctElapsed: Math.round(pctElapsed * 100) }
      }));
      results.warned.push(ticket.ticketId);
    }

    // --- EMERGENCY AUTO-ASSIGNMENT check (BR-003) ---
    const emergencyAutoMinutes =
      getSystemSettings().find(s => s.key === 'EMERGENCY_AUTOASSIGN_MINUTES')?.value || 20;
    if (ticket.priority === 'EMERGENCY' && ticket.status === 'Open' && !ticket.assignedTo) {
      const minutesSinceCreation = (now - createdMs) / 60000;
      if (minutesSinceCreation >= emergencyAutoMinutes) {
        const available = getTechnicians().filter(t =>
          t.availabilityStatus === 'AVAILABLE' &&
          (t.specialisations || []).includes('Emergency')
        );
        const fallback = getTechnicians().filter(t =>
          t.availabilityStatus === 'AVAILABLE'
        );
        const provider = available[0] || fallback[0];
        if (provider) {
          assignTicket(ticket.ticketId, provider.name, provider.id);
          addNotification(provider.email || 'provider@spmt.com', 'push',
            `EMERGENCY AUTO-ASSIGN: ${ticket.ticketId} assigned to you. Immediate response required.`, true);
          window.dispatchEvent(new CustomEvent('spmt:emergency-autoassigned', {
            detail: { ticketId: ticket.ticketId, providerId: provider.id }
          }));
          results.autoAssigned.push(ticket.ticketId);
        }
      }
    }
  }

  return results;
}

export function startSlaPolling() {
  if (pollingIntervalId) return;
  runSlaCheck();
  pollingIntervalId = setInterval(runSlaCheck, 5 * 60 * 1000);
}

export function stopSlaPolling() {
  if (pollingIntervalId) {
    clearInterval(pollingIntervalId);
    pollingIntervalId = null;
  }
}
