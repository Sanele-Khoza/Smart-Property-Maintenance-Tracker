import React, { useState, useMemo } from 'react';
import { FaBuilding, FaBox, FaUser, FaCalendarAlt, FaWrench, FaClipboardList } from 'react-icons/fa';
import Alert from './common/Alert';
import EmptyState from './common/EmptyState';
import StatusBadge from './common/StatusBadge';
import { getTickets, assignTicket, updateTicketStatus, getProviders, getProperties } from '../data/store';

const Assignment = ({ refreshData, pmName }) => {
  const [allTickets, setAllTickets] = useState(getTickets());
  const [allProperties] = useState(getProperties());
  const [providers, setProviders] = useState(getProviders());
  const propNames = useMemo(() => {
    if (!pmName) return null;
    return new Set(allProperties.filter(p => p.managerName === pmName).map(p => p.name));
  }, [allProperties, pmName]);
  const tickets = useMemo(() => {
    if (!propNames) return allTickets;
    return allTickets.filter(t => propNames.has(t.propertyName));
  }, [allTickets, propNames]);
  
  // Form state: Controlled component inputs for assignment and status update operations
  const [assignForm, setAssignForm] = useState({ ticketId: '', providerName: '', providerId: '' });
  const [statusForm, setStatusForm] = useState({ ticketId: '', newStatus: '' });
  
  // Message state: User feedback mechanism for operation results
  const [assignMsg, setAssignMsg] = useState({ text: '', type: '' });
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });
  
  // UI state: Modal/image viewer state management
  const [selectedImage, setSelectedImage] = useState(null);

  /**
   * Data refresh handler: Synchronize component state with store mutations
   * Implements optimistic UI pattern where parent callback coordinates re-render
   */
  const refresh = () => {
    setAllTickets(getTickets());
    if (refreshData) refreshData();
  };

  // Query predicates: Filter ticket collection by state (functional programming style)
  // openTickets: unassigned tickets available for dispatch
  // activeTickets: tickets in progress (neither Open nor Completed)
  const openTickets = tickets.filter(t => t.status === 'Open');
  const activeTickets = tickets.filter(t => !['Open', 'Completed'].includes(t.status));

  /**
   * Event handler: Dispatch ticket assignment
   * Invokes mutation with Result type for error handling
   * Implements transactional semantics: form clear only on success
   */
  const handleAssign = async () => {
    const result = await assignTicket(assignForm.ticketId, assignForm.providerName, assignForm.providerId);
    if (result.error) {
      setAssignMsg({ text: result.error, type: 'error' });
    } else {
      setAssignMsg({ text: `Ticket assigned to ${assignForm.providerName}`, type: 'success' });
      setAssignForm({ ticketId: '', providerName: '', providerId: '' });
      refresh();
    }
  };

  /**
   * Event handler: Execute ticket status state transition
   * Validates transition through store's state machine logic
   * Implements workflow progression control
   */
  const handleStatusUpdate = async () => {
    const result = await updateTicketStatus(statusForm.ticketId, statusForm.newStatus);
    if (result.error) {
      setStatusMsg({ text: result.error, type: 'error' });
    } else {
      setStatusMsg({ text: `Ticket status updated to ${statusForm.newStatus}`, type: 'success' });
      setStatusForm({ ticketId: '', newStatus: '' });
      refresh();
    }
  };

  /**
   * Getter function: Retrieve valid state transitions for current ticket
   * Implements guard logic for state machine: enforces allowed transitions
   * Returns array of permissible next states based on current state
   */
  const getAvailableNextStatus = (ticketStatus) => {
    const transitions = {
      'Open': ['Assigned'],
      'Assigned': ['In Progress'],
      'In Progress': ['Completed'],
      'Completed': [],
    };
    return transitions[ticketStatus] || [];
  };

  const selectedTicket = tickets.find(t => t.ticketId === statusForm.ticketId);

  return (
    <div className="main-cols">
      <div>
        <div className="card">
          <div className="card-title">Assign Ticket to Provider <span className="req-ref">REQ-033</span></div>
          <Alert msg={assignMsg.text} type={assignMsg.type} />
          
          <div className="form-group">
            <label className="form-label">Open Ticket</label>
            <select className="form-select" value={assignForm.ticketId}
              onChange={e => setAssignForm(f => ({ ...f, ticketId: e.target.value }))}>
              <option value="">— Select open ticket —</option>
              {openTickets.map(t => (
                <option key={t.ticketId} value={t.ticketId}>
                  {t.ticketId}: {t.title.substring(0, 50)}...
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Select Provider</label>
            <select className="form-select" value={assignForm.providerId}
              onChange={e => {
                const provider = providers.find(p => p.id === e.target.value);
                setAssignForm(f => ({ ...f, providerId: e.target.value, providerName: provider?.name || '' }));
              }}>
              <option value="">— Select provider —</option>
              {providers.map(p => (
                <option key={p.id} value={p.id}>{p.name} - ⭐ {p.rating} ({p.specialisations.join(', ')})</option>
              ))}
            </select>
          </div>

          <button className="btn btn-primary" onClick={handleAssign} disabled={!assignForm.ticketId || !assignForm.providerId}>
            Assign Ticket
          </button>
        </div>

        <div className="card">
          <div className="card-title">Update Ticket Status <span className="req-ref">REQ-039</span></div>
          <Alert msg={statusMsg.text} type={statusMsg.type} />
          
          <div className="form-group">
            <label className="form-label">Active Ticket</label>
            <select className="form-select" value={statusForm.ticketId}
              onChange={e => setStatusForm(f => ({ ...f, ticketId: e.target.value, newStatus: '' }))}>
              <option value="">— Select ticket —</option>
              {activeTickets.map(t => (
                <option key={t.ticketId} value={t.ticketId}>{t.ticketId} [{t.status}] - {t.title}</option>
              ))}
            </select>
          </div>

          {selectedTicket && (
            <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Current:</span>
              <StatusBadge status={selectedTicket.status} />
              {getAvailableNextStatus(selectedTicket.status).length > 0 && (
                <>
                  <span style={{ color: 'var(--text-dim)' }}>→</span>
                  {getAvailableNextStatus(selectedTicket.status).map(s => <StatusBadge key={s} status={s} />)}
                </>
              )}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">New Status</label>
            <select className="form-select" value={statusForm.newStatus}
              onChange={e => setStatusForm(f => ({ ...f, newStatus: e.target.value }))}
              disabled={!selectedTicket || getAvailableNextStatus(selectedTicket.status).length === 0}>
              <option value="">— Select status —</option>
              {selectedTicket && getAvailableNextStatus(selectedTicket.status).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <button className="btn btn-teal" onClick={handleStatusUpdate} disabled={!statusForm.ticketId || !statusForm.newStatus}>
            Update Status
          </button>
        </div>
      </div>

      <div>
        <div className="card">
          <div className="card-title">Ticket Pipeline</div>
          {activeTickets.length === 0 && openTickets.length === 0 ? (
            <EmptyState icon={<FaClipboardList />} text="No active tickets" />
          ) : (
            <div className="scroll-list ticket-grid">
              {[...tickets].reverse().map(t => (
                <div className="ticket-card" key={t.ticketId}>
                  <div className="ticket-header">
                    <span className="ticket-id">{t.ticketId}</span>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="ticket-desc"><strong>{t.title}</strong><br />{t.description.substring(0, 100)}...</div>
                  {t.images && t.images.length > 0 && (
                    <div className="ticket-images">
                      {t.images.slice(0, 3).map((img, idx) => (
                        <div key={idx} className="ticket-thumb" onClick={() => setSelectedImage(img)}>
                          <img src={img} alt={`Ticket ${t.ticketId}`} />
                        </div>
                      ))}
                      {t.images.length > 3 && <span className="ticket-meta">+{t.images.length - 3} more</span>}
                    </div>
                  )}
                  <div className="ticket-meta">
                    <span><FaBuilding /> {t.propertyName}</span>
                    <span><FaBox /> Unit {t.unitNumber}</span>
                    <span><FaUser /> By: {t.createdBy}</span>
                    <span><FaCalendarAlt /> {t.createdAt}</span>
                    {t.assignedTo && <span><FaWrench /> {t.assignedTo}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedImage && (
        <div className="modal" onClick={() => setSelectedImage(null)}>
          <span className="modal-close">×</span>
          <img src={selectedImage} alt="Full size" />
        </div>
      )}
    </div>
  );
};

export default Assignment;