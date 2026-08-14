import React from 'react';

/**
 * StatusBadge Component - Semantic State Visualization
 * 
 * Stateless presentation component rendering status indicators with semantic styling.
 * Implements lookup table (dictionary) pattern for mapping status enum values to CSS classes.
 * 
 * Props:
 * - status: Ticket lifecycle state value (New, Assigned, Accepted, In Progress, Completed, ...)
 * 
 * Returns: Styled span element with appropriate CSS class for visual differentiation
 * 
 * Architecture: Dumb component suitable for composition in data display contexts.
 */
const STATUS_STYLE = {
  'New': { className: 'badge badge-open' },
  'AI Classified': { className: 'badge badge-info' },
  'Manual Review': { className: 'badge badge-assigned' },
  'Assigned': { className: 'badge badge-assigned' },
  'Accepted': { className: 'badge badge-assigned' },
  'In Progress': { className: 'badge badge-progress' },
  'Waiting for Parts': { className: 'badge badge-progress' },
  'Completed': { className: 'badge badge-completed' },
  'Tenant Confirmed': { className: 'badge badge-completed' },
  'Closed': { className: 'badge', style: { color: '#78c878', background: 'rgba(100,180,100,0.15)' } },
  'Cancelled': { className: 'badge', style: { color: '#8a9bb5', background: 'rgba(100,120,150,0.15)' } },
  'Archived': { className: 'badge', style: { color: '#8a9bb5', background: 'rgba(100,120,150,0.15)' } },
  'On Hold': { className: 'badge', style: { color: '#f0b432', background: 'rgba(240,180,50,0.15)' } },
  'Reopened': { className: 'badge badge-open' },
  'Escalated': { className: 'badge', style: { color: '#e05252', background: 'rgba(224,82,82,0.15)' } },
  'Declined': { className: 'badge', style: { color: '#f0b432', background: 'rgba(240,180,50,0.15)' } },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_STYLE[status] || STATUS_STYLE['New'];
  return <span className={cfg.className} style={cfg.style} role="status" aria-label={`Status: ${status}`}>{status}</span>;
};

export default StatusBadge;