import React from 'react';

/**
 * EmptyState Component - Null/Empty Condition User Feedback
 * 
 * Stateless presentation component rendering informative placeholder UI.
 * Provides user feedback when data collections are empty (null state visualization).
 * 
 * Props:
 * - icon: String emoji or icon representation
 * - text: Descriptive message for empty condition
 * 
 * Architecture: Dumb component for composition in lists and data grids.
 * Follows compound component pattern for icon + text composition.
 */
const EmptyState = ({ icon, text }) => (
  <div className="empty-state">
    <div className="empty-icon">{icon}</div>
    <div className="empty-text">{text}</div>
  </div>
);

export default EmptyState;