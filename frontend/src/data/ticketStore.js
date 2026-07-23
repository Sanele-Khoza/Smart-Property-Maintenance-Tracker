import { api } from '../api/client.js';
import { getStore, saveToLocalStorage } from './storeCore';

export const TICKET_TRANSITIONS = {
  'Open': ['Manual Review', 'Assigned', 'Escalated'],
  'Manual Review': ['Open', 'Assigned', 'Escalated'],
  'Assigned': ['In Progress', 'Escalated'],
  'In Progress': ['Waiting for Parts', 'Completed (Provider)', 'Escalated'],
  'Waiting for Parts': ['In Progress', 'Escalated'],
  'Completed (Provider)': ['Closed', 'Reopened'],
  'Closed': ['Reopened'],
  'Reopened': ['Assigned', 'In Progress', 'Escalated'],
  'Escalated': ['Assigned', 'In Progress'],
};

export const PRIORITY_ORDER = { EMERGENCY: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

let ticketCounter = getStore().tickets.length + 1;

const getSlaDeadlines = (priority) => {
  const store = getStore();
  const sla = store.slaConfig.find(s => s.priority === priority);
  const now = Date.now();
  return {
    slaResponseBefore: now + (sla?.responseMinutes || 240) * 60 * 1000,
    slaResolutionBefore: now + (sla?.resolutionMinutes || 2880) * 60 * 1000,
  };
};

function mapTicket(t) {
  return {
    ticketId: t.id || t.ticketId,
    unitId: t.unit_id || t.unitId,
    unitNumber: t.unit_number || t.unitNumber,
    propertyName: t.property_name || t.propertyName || '',
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    category: t.category,
    aiOriginalCategory: t.ai_original_label || t.aiOriginalCategory,
    combinedConfidence: t.ai_text_confidence || t.ai_visual_confidence || t.combinedConfidence || null,
    conflictDetected: t.conflict_detected || t.conflictDetected || false,
    manualReviewRequired: false,
    assignedTo: t.assigned_to_name || t.assignedTo || null,
    assignedToId: t.assigned_to || t.assignedToId || null,
    createdBy: t.created_by_name || t.createdBy || '',
    createdById: t.tenant_id || t.createdById || t.created_by || null,
    createdAt: t.created_at || t.createdAt || new Date().toLocaleString(),
    updatedAt: t.updated_at || t.updatedAt || new Date().toLocaleString(),
    images: [],
    ...(t.slaResponseBefore || t.slaResolutionBefore ? {} : getSlaDeadlines(t.priority)),
  };
}

export const createTicket = async (unitId, title, description, priority, images, createdById, createdByName, forceSubmit = false) => {
  try {
    const result = await api('/tickets', {
      method: 'POST',
      body: {
        unit_id: unitId,
        title: title || 'Maintenance Request',
        description,
        priority: priority || 'MEDIUM',
        source: 'tenant_portal',
      },
    });

    if (!result.success || !result.data?.ticket) {
      return { success: false, error: result.error || 'Failed to create ticket' };
    }

    const ticketData = result.data.ticket;
    const store = getStore();
    const localTicket = mapTicket(ticketData);
    localTicket.images = images || [];

    store.tickets.unshift(localTicket);
    store.auditLog.push({
      id: `AUD-${String(store.auditLog.length + 1).padStart(3, '0')}`,
      ticketId: localTicket.ticketId,
      actor: createdByName || 'Tenant',
      action: 'CREATED',
      previousStatus: null,
      newStatus: localTicket.status,
      comment: 'Ticket created via API',
      timestamp: new Date().toISOString(),
    });
    saveToLocalStorage();

    return { success: true, data: localTicket };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const getTickets = () => {
  const store = getStore();
  return store.tickets.map(t => {
    const needsSla = !t.slaResponseBefore || !t.slaResolutionBefore;
    return {
      ...t,
      propertyId: store.units.find(u => u.unitId === t.unitId || u.id === t.unitId)?.propertyId || null,
      ...(needsSla ? getSlaDeadlines(t.priority) : {}),
    };
  });
};

export const getTicketsByUnit = (unitId) => getStore().tickets.filter(t => t.unitId === unitId);

export const getTicketById = (ticketId) => {
  const store = getStore();
  const t = store.tickets.find(tk => tk.ticketId === ticketId || tk.id === ticketId);
  if (!t) return null;
  return { ...t, propertyId: store.units.find(u => u.unitId === t.unitId || u.id === t.unitId)?.propertyId || null };
};

export const updateTicketStatus = async (ticketId, newStatus, comment) => {
  try {
    const result = await api(`/tickets/${ticketId}/status`, {
      method: 'PUT',
      body: { status: newStatus, reason: comment },
    });
    if (result.success) {
      const updated = result.data?.ticket || result.data;
      const store = getStore();
      const idx = store.tickets.findIndex(t => t.ticketId === ticketId || t.id === ticketId);
      if (idx !== -1) {
        store.tickets[idx] = { ...store.tickets[idx], ...mapTicket(updated), status: newStatus, updatedAt: new Date().toLocaleString() };
      }
      if (comment) {
        store.auditLog.push({
          id: `AUD-${String(store.auditLog.length + 1).padStart(3, '0')}`,
          ticketId, actor: 'User', action: 'STATUS_CHANGE',
          previousStatus: store.tickets[idx]?.status || newStatus, newStatus,
          comment, timestamp: new Date().toISOString(),
        });
        saveToLocalStorage();
      }
      return { success: true, data: store.tickets[idx] || updated };
    }
    return { success: false, error: result.error || 'Status change failed' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const assignTicket = async (ticketId, providerName, providerId) => {
  try {
    const result = await api(`/tickets/${ticketId}/assign`, {
      method: 'PUT',
      body: { technician_id: providerId, note: `Assigned to ${providerName}` },
    });
    if (result.success) {
      const store = getStore();
      const idx = store.tickets.findIndex(t => t.ticketId === ticketId || t.id === ticketId);
      if (idx !== -1) {
        store.tickets[idx].assignedTo = providerName;
        store.tickets[idx].assignedToId = providerId;
        store.tickets[idx].status = 'Assigned';
        store.tickets[idx].updatedAt = new Date().toLocaleString();
      }
      saveToLocalStorage();
      return { success: true, data: store.tickets[idx] };
    }
    return { success: false, error: result.error || 'Assignment failed' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const declineTicketAssignment = async (ticketId, providerName, reason) => {
  try {
    const result = await api(`/tickets/${ticketId}/status`, {
      method: 'PUT',
      body: { status: 'Open', reason: reason || 'Provider declined' },
    });
    if (result.success) {
      const store = getStore();
      const idx = store.tickets.findIndex(t => t.ticketId === ticketId || t.id === ticketId);
      if (idx !== -1) {
        store.tickets[idx].assignedTo = null;
        store.tickets[idx].assignedToId = null;
        store.tickets[idx].status = 'Open';
        store.tickets[idx].updatedAt = new Date().toLocaleString();
      }
      saveToLocalStorage();
      return { success: true, data: store.tickets[idx] };
    }
    return { success: false, error: result.error || 'Decline failed' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const reopenTicket = async (ticketId, justification) => {
  try {
    const result = await api(`/tickets/${ticketId}/reopen`, {
      method: 'PUT',
      body: { reason: justification },
    });
    if (result.success) {
      const store = getStore();
      const idx = store.tickets.findIndex(t => t.ticketId === ticketId || t.id === ticketId);
      if (idx !== -1) {
        store.tickets[idx].status = 'Reopened';
        store.tickets[idx].updatedAt = new Date().toLocaleString();
        store.tickets[idx].reopenJustification = justification;
      }
      saveToLocalStorage();
      return { success: true, data: store.tickets[idx] };
    }
    return { success: false, error: result.error || 'Reopen failed' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const updateTicketCategory = async (ticketId, newCategory) => {
  try {
    const result = await api(`/tickets/${ticketId}/override-ai`, {
      method: 'PUT',
      body: { category: newCategory },
    });
    if (result.success) {
      const store = getStore();
      const idx = store.tickets.findIndex(t => t.ticketId === ticketId || t.id === ticketId);
      if (idx !== -1) {
        store.tickets[idx].category = newCategory;
        store.tickets[idx].updatedAt = new Date().toLocaleString();
      }
      saveToLocalStorage();
      return { success: true, data: store.tickets[idx] };
    }
    return { success: false, error: result.error || 'Category update failed' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const getTicketsByStatus = (status) => getStore().tickets.filter(t => t.status === status);
export const getOpenTickets = () => getStore().tickets.filter(t => t.status === 'Open');
export const getTicketsByProvider = (providerName) => getStore().tickets.filter(t => t.assignedTo === providerName);

export const updateTicketRating = async (ticketId, rating, comment) => {
  try {
    const result = await api(`/tickets/${ticketId}/rate`, {
      method: 'POST',
      body: { rating, comment },
    });
    if (result.success) {
      const store = getStore();
      const idx = store.tickets.findIndex(t => t.ticketId === ticketId || t.id === ticketId);
      if (idx !== -1) {
        store.tickets[idx].rating = rating;
        store.tickets[idx].ratingComment = (comment || '').trim();
        store.tickets[idx].ratingSubmittedAt = new Date().toISOString();
        store.tickets[idx].updatedAt = new Date().toLocaleString();
      }
      saveToLocalStorage();
      return { success: true, data: store.tickets[idx] };
    }
    return { success: false, error: result.error || 'Rating failed' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const submitJobCompletion = async (ticketId, invoiceText, photoMetadata, providerName) => {
  try {
    const result = await api(`/tickets/${ticketId}/complete`, {
      method: 'PUT',
      body: { notes: invoiceText },
    });
    if (result.success) {
      const store = getStore();
      const idx = store.tickets.findIndex(t => t.ticketId === ticketId || t.id === ticketId);
      if (idx !== -1) {
        store.tickets[idx].status = 'Completed (Provider)';
        store.tickets[idx].completionInvoice = invoiceText?.trim() || '';
        store.tickets[idx].completionPhotos = photoMetadata || [];
        store.tickets[idx].completedAt = new Date().toISOString();
        store.tickets[idx].updatedAt = new Date().toLocaleString();
      }
      saveToLocalStorage();
      return { success: true, data: store.tickets[idx] };
    }
    return { success: false, error: result.error || 'Job completion failed' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const refreshTickets = async () => {
  try {
    const result = await api('/tickets');
    if (result.success && Array.isArray(result.data)) {
      const store = getStore();
      store.tickets = result.data.map(mapTicket);
      saveToLocalStorage();
    }
  } catch (err) {
    console.warn('refreshTickets failed:', err.message);
  }
  return getStore().tickets;
};

export const getStats = () => {
  const store = getStore();
  const t = store.tickets || [];
  const n = store.notifications || [];
  return {
    totalProperties: (store.properties || []).length,
    totalUnits: (store.units || []).length,
    occupiedUnits: (store.units || []).filter(u => u.status === 'OCCUPIED').length,
    totalTickets: t.length,
    openTickets: t.filter(tk => tk.status === 'Open').length,
    manualReviewTickets: t.filter(tk => tk.status === 'Manual Review').length,
    assignedTickets: t.filter(tk => tk.status === 'Assigned').length,
    inProgressTickets: t.filter(tk => tk.status === 'In Progress').length,
    completedTickets: t.filter(tk => tk.status === 'Completed (Provider)').length,
    closedTickets: t.filter(tk => tk.status === 'Closed').length,
    conflictDetected: t.filter(tk => tk.conflictDetected).length,
    slaBreachedTickets: t.filter(tk => tk.slaResolutionBefore && Date.now() > tk.slaResolutionBefore).length,
    totalNotifications: n.length,
    failedNotifications: n.filter(nn => nn.deliveryStatus === 'Failed').length,
  };
};
