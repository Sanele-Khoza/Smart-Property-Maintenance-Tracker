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

export const createTicket = (unitId, title, description, priority, images, createdById, createdByName, aiFields, forceSubmit = false) => {
  const store = getStore();
  const unit = store.units.find(u => u.unitId === unitId);
  if (!unit) return { success: false, error: 'Invalid unit selected.' };
  if (!description?.trim() || description.trim().length < 20) return { success: false, error: 'Description must be at least 20 characters.' };
  const property = store.properties.find(p => p.propertyId === unit.propertyId);

  const creatorName = createdByName || 'Tenant';

  if (!forceSubmit) {
    const activeDuplicates = store.tickets.filter(t =>
      (t.createdById === createdById || t.createdBy === creatorName) &&
      t.unitId === unitId &&
      !['Closed', 'Completed (Provider)'].includes(t.status) &&
      (
        t.title.toLowerCase().trim() === (title || '').toLowerCase().trim() ||
        t.description.toLowerCase().trim().substring(0, 40) === description.toLowerCase().trim().substring(0, 40)
      )
    );
    if (activeDuplicates.length > 0) {
      return {
        success: false,
        isDuplicate: true,
        existingTicketId: activeDuplicates[0].ticketId,
        error: `A similar active ticket already exists: ${activeDuplicates[0].ticketId} — "${activeDuplicates[0].title}" (Status: ${activeDuplicates[0].status}). Submit anyway?`,
      };
    }
  }

  const effectivePriority = aiFields?.overridePriority || priority || 'MEDIUM';
  const sla = getSlaDeadlines(effectivePriority);

  const newTicket = {
    ticketId: `T-${String(ticketCounter++).padStart(3, '0')}`,
    unitId, unitNumber: unit.unitNumber, propertyName: property?.name || 'Unknown Property',
    title: title.trim() || 'Maintenance Request', description: description.trim(),
    status: aiFields?.manualReviewRequired ? 'Manual Review' : 'Open',
    priority: effectivePriority,
    category: aiFields?.suggestedCategory || null,
    aiOriginalCategory: aiFields?.suggestedCategory || null,
    combinedConfidence: aiFields?.combinedConfidence || null,
    conflictDetected: aiFields?.conflictDetected || false,
    manualReviewRequired: aiFields?.manualReviewRequired || false,
    assignedTo: null, assignedToId: null,
    createdBy: creatorName,
    createdById: createdById || null,
    createdAt: new Date().toLocaleString(), updatedAt: new Date().toLocaleString(),
    images: images || [],
    ...sla,
  };

  store.tickets.unshift(newTicket);
  saveToLocalStorage();
  store.auditLog.push({
    id: `AUD-${String(store.auditLog.length + 1).padStart(3, '0')}`, ticketId: newTicket.ticketId,
    actor: creatorName, action: 'CREATED', previousStatus: null, newStatus: newTicket.status,
    comment: `Ticket created with ${aiFields?.combinedConfidence ? `confidence ${aiFields.combinedConfidence}` : 'no AI classification'}`,
    timestamp: new Date().toISOString(),
  });
  saveToLocalStorage();
  return { success: true, data: newTicket };
};

export const getTickets = () => {
  const store = getStore();
  return store.tickets.map(t => {
    const needsSla = !t.slaResponseBefore || !t.slaResolutionBefore;
    return {
      ...t,
      propertyId: store.units.find(u => u.unitId === t.unitId)?.propertyId || null,
      ...(needsSla ? getSlaDeadlines(t.priority) : {}),
    };
  });
};

export const getTicketsByUnit = (unitId) => getStore().tickets.filter(t => t.unitId === unitId);

export const getTicketById = (ticketId) => {
  const store = getStore();
  const t = store.tickets.find(tk => tk.ticketId === ticketId);
  if (!t) return null;
  return { ...t, propertyId: store.units.find(u => u.unitId === t.unitId)?.propertyId || null };
};

export const updateTicketStatus = (ticketId, newStatus, comment) => {
  const store = getStore();
  const ticket = store.tickets.find(t => t.ticketId === ticketId);
  if (!ticket) return { success: false, error: 'Ticket not found.' };

  const valid = TICKET_TRANSITIONS[ticket.status];
  if (!valid || !valid.includes(newStatus)) return { success: false, error: `Invalid transition: ${ticket.status} → ${newStatus}. Allowed: ${(valid || []).join(', ')}` };

  const prevStatus = ticket.status;
  ticket.status = newStatus;
  ticket.updatedAt = new Date().toLocaleString();

  store.auditLog.push({
    id: `AUD-${String(store.auditLog.length + 1).padStart(3, '0')}`, ticketId,
    actor: 'System Admin', action: 'STATUS_CHANGE',
    previousStatus: prevStatus, newStatus,
    comment: comment || `Status changed from ${prevStatus} to ${newStatus}`,
    timestamp: new Date().toISOString(),
  });
  saveToLocalStorage();
  return { success: true, data: { ...ticket } };
};

export const assignTicket = (ticketId, providerName, providerId) => {
  const store = getStore();
  const ticket = store.tickets.find(t => t.ticketId === ticketId);
  if (!ticket) return { success: false, error: 'Ticket not found.' };
  if (!['Open', 'Manual Review', 'Reopened', 'Escalated'].includes(ticket.status)) return { success: false, error: `Cannot assign ticket with status "${ticket.status}". Only Open, Manual Review, Reopened, or Escalated tickets can be assigned.` };

  ticket.assignedTo = providerName;
  ticket.assignedToId = providerId;
  ticket.status = 'Assigned';
  ticket.updatedAt = new Date().toLocaleString();

  store.auditLog.push({
    id: `AUD-${String(store.auditLog.length + 1).padStart(3, '0')}`, ticketId,
    actor: 'System Admin', action: 'ASSIGNED',
    previousStatus: ticket.status === 'Assigned' ? 'Assigned' : ticket.status,
    newStatus: 'Assigned',
    comment: `Reassigned to ${providerName}`,
    timestamp: new Date().toISOString(),
  });
  saveToLocalStorage();
  return { success: true, data: ticket };
};

export const declineTicketAssignment = (ticketId, providerName, reason) => {
  const store = getStore();
  const ticket = store.tickets.find(t => t.ticketId === ticketId);
  if (!ticket) return { success: false, error: 'Ticket not found.' };
  if (ticket.status !== 'Assigned') return { success: false, error: 'Only assigned tickets can be declined.' };
  if (ticket.assignedTo !== providerName) return { success: false, error: 'This ticket is not assigned to you.' };

  ticket.assignedTo = null;
  ticket.assignedToId = null;
  ticket.status = 'Open';
  ticket.updatedAt = new Date().toLocaleString();

  store.auditLog.push({
    id: `AUD-${String(store.auditLog.length + 1).padStart(3, '0')}`, ticketId,
    actor: providerName, action: 'DECLINED',
    previousStatus: 'Assigned', newStatus: 'Open',
    comment: reason ? `Declined: ${reason.trim()}` : 'Provider declined assignment',
    timestamp: new Date().toISOString(),
  });
  saveToLocalStorage();
  return { success: true, data: { ...ticket } };
};

export const reopenTicket = (ticketId, justification) => {
  const store = getStore();
  const ticket = store.tickets.find(t => t.ticketId === ticketId);
  if (!ticket) return { success: false, error: 'Ticket not found.' };
  if (!['Closed', 'Completed (Provider)'].includes(ticket.status)) return { success: false, error: `Cannot reopen ticket with status "${ticket.status}". Only Closed or Completed tickets can be reopened.` };
  if (!justification || justification.trim().length < 10) return { success: false, error: 'Justification must be at least 10 characters. (REQ-041)' };

  const prevStatus = ticket.status;
  ticket.status = 'Reopened';
  ticket.updatedAt = new Date().toLocaleString();
  ticket.reopenJustification = justification.trim();

  store.auditLog.push({
    id: `AUD-${String(store.auditLog.length + 1).padStart(3, '0')}`, ticketId,
    actor: 'System Admin', action: 'REOPENED',
    previousStatus: prevStatus, newStatus: 'Reopened',
    comment: justification.trim(),
    timestamp: new Date().toISOString(),
  });
  saveToLocalStorage();
  return { success: true, data: { ...ticket } };
};

export const updateTicketCategory = (ticketId, newCategory) => {
  const store = getStore();
  const ticket = store.tickets.find(t => t.ticketId === ticketId);
  if (!ticket) return { success: false, error: 'Ticket not found.' };
  const prevCategory = ticket.category;
  ticket.category = newCategory;
  ticket.updatedAt = new Date().toLocaleString();

  if (prevCategory !== newCategory) {
    store.auditLog.push({
      id: `AUD-${String(store.auditLog.length + 1).padStart(3, '0')}`, ticketId,
      actor: 'System Admin', action: 'CATEGORY_OVERRIDE',
      previousStatus: ticket.status, newStatus: ticket.status,
      comment: `PM override: ai_original_category=${ticket.aiOriginalCategory || 'none'} → category=${newCategory} (BR-006)`,
      timestamp: new Date().toISOString(),
    });
  }
  saveToLocalStorage();
  return { success: true, data: { ...ticket } };
};

export const getTicketsByStatus = (status) => getStore().tickets.filter(t => t.status === status);
export const getOpenTickets = () => getStore().tickets.filter(t => t.status === 'Open');
export const getTicketsByProvider = (providerName) => getStore().tickets.filter(t => t.assignedTo === providerName);

export const updateTicketRating = (ticketId, rating, comment) => {
  const store = getStore();
  const ticket = store.tickets.find(t => t.ticketId === ticketId);
  if (!ticket) return { success: false, error: 'Ticket not found.' };
  if (ticket.status !== 'Closed') return { success: false, error: 'Can only rate closed tickets.' };
  if (rating < 1 || rating > 5) return { success: false, error: 'Rating must be between 1 and 5.' };
  ticket.rating = rating;
  ticket.ratingComment = (comment || '').trim();
  ticket.ratingSubmittedAt = new Date().toISOString();
  ticket.updatedAt = new Date().toLocaleString();
  store.auditLog.push({
    id: `AUD-${String(store.auditLog.length + 1).padStart(3, '0')}`, ticketId,
    actor: ticket.createdBy, action: 'RATED',
    previousStatus: 'Closed', newStatus: 'Closed',
    comment: `Tenant rated ${rating}/5` + (ticket.ratingComment ? `: ${ticket.ratingComment}` : ''),
    timestamp: new Date().toISOString(),
  });
  saveToLocalStorage();
  return { success: true, data: { ...ticket } };
};

export const submitJobCompletion = (ticketId, invoiceText, photoMetadata, providerName) => {
  const store = getStore();
  const ticket = store.tickets.find(t => t.ticketId === ticketId);
  if (!ticket) return { success: false, error: 'Ticket not found.' };
  if (ticket.status !== 'In Progress' && ticket.status !== 'Waiting for Parts') return { success: false, error: 'Can only complete in-progress jobs.' };

  ticket.status = 'Completed (Provider)';
  ticket.completionInvoice = invoiceText?.trim() || '';
  ticket.completionPhotos = photoMetadata || [];
  ticket.completedAt = new Date().toISOString();
  ticket.updatedAt = new Date().toLocaleString();

  store.auditLog.push({
    id: `AUD-${String(store.auditLog.length + 1).padStart(3, '0')}`, ticketId,
    actor: providerName || 'Provider', action: 'JOB_COMPLETED',
    previousStatus: 'In Progress', newStatus: 'Completed (Provider)',
    comment: `Provider marked complete. Invoice: ${invoiceText || 'none provided'}`,
    timestamp: new Date().toISOString(),
  });
  saveToLocalStorage();
  return { success: true, data: { ...ticket } };
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
