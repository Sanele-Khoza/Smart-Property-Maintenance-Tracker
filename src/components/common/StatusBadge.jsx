import React from 'react';

/**
 * StatusBadge Component - Semantic State Visualization
 * 
 * Stateless presentation component rendering status indicators with semantic styling.
 * Implements lookup table (dictionary) pattern for mapping status enum values to CSS classes.
 * 
 * Props:
 * - status: Ticket lifecycle state value (Open, Assigned, In Progress, Completed)
 * 
 * Returns: Styled span element with appropriate CSS class for visual differentiation
 * 
 * Architecture: Dumb component suitable for composition in data display contexts.
 */
const STATUS_STYLE = {
  'Open': { className: 'badge badge-open' },
  'Assigned': { className: 'badge badge-assigned' },
  'In Progress': { className: 'badge badge-progress' },
  'Waiting for Parts': { className: 'badge badge-progress' },
  'Manual Review': { className: 'badge badge-assigned' },
  'Reopened': { className: 'badge badge-open' },
  'Completed (Provider)': { className: 'badge badge-completed' },
  'Closed': { className: 'badge', style: { color: '#78c878', background: 'rgba(100,180,100,0.15)' } },
  'Escalated': { className: 'badge', style: { color: '#e05252', background: 'rgba(224,82,82,0.15)' } },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_STYLE[status] || STATUS_STYLE['Open'];
  return <span className={cfg.className} style={cfg.style} role="status" aria-label={`Status: ${status}`}>{status}</span>;
};

export default StatusBadge;