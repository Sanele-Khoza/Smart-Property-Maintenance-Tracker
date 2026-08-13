import { api, getBaseUrl } from '../api/client.js';
import { getStore, saveToLocalStorage } from './storeCore';
import { addAuditLogEntry } from './auditStore';

export const TICKET_TRANSITIONS = {
  'New': ['AI Classified', 'Manual Review', 'Cancelled'],
  'AI Classified': ['Assigned', 'Manual Review', 'Cancelled'],
  'Manual Review': ['AI Classified', 'Cancelled'],
  'Assigned': ['Accepted', 'Cancelled', 'On Hold', 'Escalated', 'Declined'],
  'Accepted': ['In Progress', 'Cancelled', 'On Hold'],
  'Declined': ['Assigned', 'Cancelled'],
  'In Progress': ['Waiting for Parts', 'Completed', 'On Hold', 'Escalated'],
  'Waiting for Parts': ['In Progress', 'On Hold'],
  'Completed': ['Tenant Confirmed', 'Reopened'],
  'Tenant Confirmed': ['Closed'],
  'Closed': [],
  'Cancelled': ['Archived'],
  'Archived': ['Reopened'],
  'On Hold': ['In Progress', 'Cancelled'],
  'Reopened': ['Assigned', 'In Progress', 'Cancelled'],
  'Escalated': ['Manual Review', 'Assigned'],
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
    providerRating: t.provider_rating ?? t.providerRating ?? null,
    providerRatingCount: t.provider_rating_count ?? t.providerRatingCount ?? null,
    createdBy: t.created_by_name || t.createdBy || '',
    createdById: t.tenant_id || t.createdById || t.created_by || null,
    createdAt: t.created_at || t.createdAt || new Date().toLocaleString(),
    updatedAt: t.updated_at || t.updatedAt || new Date().toLocaleString(),
    deletedAt: t.deleted_at || t.deletedAt || null,
    deletedBy: t.deleted_by || t.deletedBy || null,
    postponedUntil: t.postponed_until || t.postponedUntil || null,
    postponedReason: t.postponed_reason || t.postponedReason || null,
    images: Array.isArray(t.photoUrls)
      ? t.photoUrls
          .filter(Boolean)
          .map(u => u.startsWith('/') ? `${getBaseUrl().replace(/\/api\/?$/, '')}${u}` : u)
      : [],
    ...(t.slaResponseBefore || t.slaResolutionBefore ? {} : getSlaDeadlines(t.priority)),
  };
}

export const notifyTicketsUpdated = () => {
  window.dispatchEvent(new CustomEvent('spmt:tickets-updated'));
};

export const uploadTicketImages = async (ticketId, images) => {
  for (const img of images || []) {
    if (!img?.data) continue;
    try {
      const blob = await (await fetch(img.data)).blob();
      const file = new File([blob], img.name || `photo-${Date.now()}.jpg`, {
        type: img.type || blob.type || 'image/jpeg',
      });
      const formData = new FormData();
      formData.append('file', file);
      await api(`/tickets/${ticketId}/attachments`, { method: 'POST', formData });
    } catch (err) {
      console.warn('Photo upload failed:', err.message);
    }
  }
};

export const createTicket = async (unitId, title, description, priority, category, images, createdById, createdByName, forceSubmit = false) => {
  try {
    const result = await api('/tickets', {
      method: 'POST',
      body: {
        unit_id: unitId,
        title: title || 'Maintenance Request',
        description,
        category: category || 'General',
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

    uploadTicketImages(localTicket.ticketId, images);

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
    notifyTicketsUpdated();

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
      notifyTicketsUpdated();
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
        store.tickets[idx].postponedUntil = null;
        store.tickets[idx].postponedReason = null;
        store.tickets[idx].updatedAt = new Date().toLocaleString();
      }
      saveToLocalStorage();
      notifyTicketsUpdated();
      return { success: true, data: store.tickets[idx] };
    }
    return { success: false, error: result.error || 'Assignment failed' };
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
      notifyTicketsUpdated();
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
      body: { correctedLabel: newCategory },
    });
    if (!result.success) return { success: false, error: result.error || 'Category update failed' };

    const store = getStore();
    const idx = store.tickets.findIndex(t => t.ticketId === ticketId || t.id === ticketId);
    const prevCategory = idx !== -1 ? store.tickets[idx].category : null;
    if (idx !== -1) {
      const t = store.tickets[idx];
      if (prevCategory && prevCategory !== newCategory && !t.aiOriginalCategory) {
        t.aiOriginalCategory = prevCategory;
      }
      t.category = newCategory;
      t.updatedAt = new Date().toLocaleString();
    }
    addAuditLogEntry({
      ticketId,
      actor: 'User',
      action: 'ai_overridden',
      previousStatus: prevCategory || null,
      newStatus: newCategory,
      comment: `Category override: ${prevCategory || '—'} → ${newCategory}`,
      timestamp: new Date().toISOString(),
    });
    saveToLocalStorage();
    notifyTicketsUpdated();
    return { success: true, data: store.tickets[idx] };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const getTicketsByStatus = (status) => getStore().tickets.filter(t => t.status === status);
export const getOpenTickets = () => getStore().tickets.filter(t => t.status === 'New');
export const getTicketsByProvider = (providerName) => getStore().tickets.filter(t => t.assignedTo === providerName);

export const updateTicketRating = async (ticketId, rating, comment) => {
  try {
    const result = await api('/ratings', {
      method: 'POST',
      body: { ticketId, rating, comment },
    });
    if (result.success) {
      const store = getStore();
      const idx = store.tickets.findIndex(t => t.ticketId === ticketId || t.id === ticketId);
      if (idx !== -1) {
        store.tickets[idx].rating = rating;
        store.tickets[idx].ratingComment = (comment || '').trim();
        store.tickets[idx].ratingSubmittedAt = new Date().toISOString();
        store.tickets[idx].providerRating = result.data?.finalRating ?? store.tickets[idx].providerRating ?? null;
        store.tickets[idx].providerRatingCount = result.data?.ratingCount ?? store.tickets[idx].providerRatingCount ?? null;
        store.tickets[idx].updatedAt = new Date().toLocaleString();
      }
      saveToLocalStorage();
      notifyTicketsUpdated();
      return {
        success: true,
        data: result.data || null,
        ticket: store.tickets[idx],
      };
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
        store.tickets[idx].status = 'Completed';
        store.tickets[idx].completionInvoice = invoiceText?.trim() || '';
        store.tickets[idx].completionPhotos = photoMetadata || [];
        store.tickets[idx].completedAt = new Date().toISOString();
        store.tickets[idx].updatedAt = new Date().toLocaleString();
      }
      saveToLocalStorage();
      notifyTicketsUpdated();
      return { success: true, data: store.tickets[idx] };
    }
    return { success: false, error: result.error || 'Job completion failed' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

async function runWorkflowStep(ticketId, endpoint, nextStatus, note) {
  try {
    const result = await api(`/tickets/${ticketId}${endpoint}`, {
      method: 'PUT',
      body: note ? { note } : {},
    });
    if (result.success) {
      const store = getStore();
      const idx = store.tickets.findIndex(t => t.ticketId === ticketId || t.id === ticketId);
      if (idx !== -1) {
        store.tickets[idx].status = nextStatus;
        store.tickets[idx].updatedAt = new Date().toLocaleString();
      }
      saveToLocalStorage();
      notifyTicketsUpdated();
      return { success: true, data: store.tickets[idx] };
    }
    return { success: false, error: result.error || 'Action failed' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export const acceptJob = (ticketId, note) => runWorkflowStep(ticketId, '/accept', 'Accepted', note);
export const startJob = (ticketId, note) => runWorkflowStep(ticketId, '/start', 'In Progress', note);
export const waitForParts = (ticketId, note) => runWorkflowStep(ticketId, '/waiting-parts', 'Waiting for Parts', note);
export const partsReceived = (ticketId, note) => runWorkflowStep(ticketId, '/parts-received', 'In Progress', note);

export const declineJob = async (ticketId, note, postponeUntil) => {
  try {
    const result = await api(`/tickets/${ticketId}/decline`, {
      method: 'PUT',
      body: { note: note || null, postponeUntil: postponeUntil || null },
    });
    if (result.success) {
      const store = getStore();
      const idx = store.tickets.findIndex(t => t.ticketId === ticketId || t.id === ticketId);
      if (idx !== -1) {
        store.tickets[idx].status = 'Declined';
        store.tickets[idx].assignedTo = null;
        store.tickets[idx].assignedToId = null;
        store.tickets[idx].postponedUntil = postponeUntil || null;
        store.tickets[idx].postponedReason = note || null;
        store.tickets[idx].updatedAt = new Date().toLocaleString();
      }
      saveToLocalStorage();
      notifyTicketsUpdated();
      return { success: true, data: store.tickets[idx] };
    }
    return { success: false, error: result.error || 'Decline failed' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const confirmTicketCompletion = async (ticketId, satisfied, note) => {
  try {
    const result = await api(`/tickets/${ticketId}/tenant-confirm`, {
      method: 'PUT',
      body: { satisfied, note },
    });
    if (result.success) {
      const store = getStore();
      const idx = store.tickets.findIndex(t => t.ticketId === ticketId || t.id === ticketId);
      const nextStatus = satisfied === false ? 'Reopened' : 'Tenant Confirmed';
      if (idx !== -1) {
        store.tickets[idx].status = nextStatus;
        store.tickets[idx].updatedAt = new Date().toLocaleString();
      }
      saveToLocalStorage();
      notifyTicketsUpdated();
      return { success: true, data: store.tickets[idx] };
    }
    return { success: false, error: result.error || 'Confirmation failed' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const closeTicket = async (ticketId, note) => {
  try {
    const result = await api(`/tickets/${ticketId}/close`, {
      method: 'PUT',
      body: note ? { note } : {},
    });
    if (result.success) {
      const store = getStore();
      const idx = store.tickets.findIndex(t => t.ticketId === ticketId || t.id === ticketId);
      if (idx !== -1) {
        store.tickets[idx].status = 'Closed';
        store.tickets[idx].updatedAt = new Date().toLocaleString();
      }
      saveToLocalStorage();
      notifyTicketsUpdated();
      return { success: true, data: store.tickets[idx] };
    }
    return { success: false, error: result.error || 'Close failed' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const refreshTickets = async () => {
  try {
    const result = await api('/tickets?limit=1000');
    if (result.success && Array.isArray(result.data?.tickets)) {
      const store = getStore();
      store.tickets = result.data.tickets.map(mapTicket);
      saveToLocalStorage();
      notifyTicketsUpdated();
    }
  } catch (err) {
    console.warn('refreshTickets failed:', err.message);
  }
  return getStore().tickets;
};

export const trashTicket = async (ticketId) => {
  try {
    const result = await api(`/tickets/${ticketId}`, { method: 'DELETE' });
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to move ticket to trash' };
    }
    const store = getStore();
    const idx = store.tickets.findIndex(t => t.ticketId === ticketId || t.id === ticketId);
    if (idx !== -1) {
      const removed = store.tickets[idx];
      store.tickets.splice(idx, 1);
      store.trash = store.trash || [];
      store.trash.unshift({ ...removed, deletedAt: removed.deletedAt || new Date().toISOString() });
      saveToLocalStorage();
    }
    notifyTicketsUpdated();
    return { success: true, data: result.data?.ticket };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const restoreTicket = async (ticketId) => {
  try {
    const result = await api(`/tickets/${ticketId}/restore`, { method: 'POST' });
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to restore ticket' };
    }
    const store = getStore();
    const idx = (store.trash || []).findIndex(t => t.ticketId === ticketId || t.id === ticketId);
    if (idx !== -1) {
      const restored = store.trash[idx];
      store.trash.splice(idx, 1);
      store.tickets.unshift({ ...restored, deletedAt: null, deletedBy: null });
      saveToLocalStorage();
    }
    notifyTicketsUpdated();
    return { success: true, data: result.data?.ticket };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const getTrashTickets = async () => {
  try {
    const result = await api('/tickets?deleted=true&limit=1000');
    if (result.success && Array.isArray(result.data?.tickets)) {
      const store = getStore();
      store.trash = result.data.tickets.map(mapTicket);
      saveToLocalStorage();
    }
  } catch (err) {
    console.warn('getTrashTickets failed:', err.message);
  }
  return [...(getStore().trash || [])];
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
    openTickets: t.filter(tk => tk.status === 'New').length,
    manualReviewTickets: t.filter(tk => tk.status === 'Manual Review').length,
    assignedTickets: t.filter(tk => tk.status === 'Assigned').length,
    acceptedTickets: t.filter(tk => tk.status === 'Accepted').length,
    inProgressTickets: t.filter(tk => tk.status === 'In Progress').length,
    completedTickets: t.filter(tk => tk.status === 'Completed' || tk.status === 'Tenant Confirmed').length,
    closedTickets: t.filter(tk => tk.status === 'Closed').length,
    conflictDetected: t.filter(tk => tk.conflictDetected).length,
    slaBreachedTickets: t.filter(tk => tk.slaResolutionBefore && Date.now() > tk.slaResolutionBefore).length,
    totalNotifications: n.length,
    failedNotifications: n.filter(nn => nn.deliveryStatus === 'Failed').length,
  };
};