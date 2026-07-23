import React from 'react';

/**
 * Alert Component - Generic Notification Display
 * 
 * Stateless presentation component implementing composition pattern for user feedback.
 * Encapsulates conditional rendering logic: returns null (falsy) if no message provided.
 * 
 * Props interface:
 * - msg: String message content (falsy value triggers conditional rendering)
 * - type: CSS class suffix for styling (success, error, warning, info)
 * 
 * Architecture: Dumb component - pure function with no side effects,
 * suitable for composition in forms and data entry contexts.
 */
const Alert = ({ msg, type }) => {
  if (!msg) return null;
  return <div className={`alert alert-${type}`}>{msg}</div>;
};

export default Alert;