// Module entry point: Application bootstrap and React tree mounting
// This file initializes the React runtime and attaches root component to DOM

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

/**
 * Bootstrap sequence:
 * 1. Import React library for JSX compilation and component rendering
 * 2. Import ReactDOM library for client-side rendering to browser DOM
 * 3. Import root App component containing application component tree
 * 4. Import global CSS stylesheet for application styling
 */

/**
 * Create React root: Initialize concurrent rendering mode with Fiber architecture
 * Targets DOM element with id='root' defined in public/index.html
 * Returns Root interface for rendering the component tree
 */
const root = ReactDOM.createRoot(document.getElementById('root'));

/**
 * Render operation: Hydrate React component tree into DOM
 * Wraps App component in StrictMode for development-time invariant checking
 * Detects side effects, unsafe lifecycle methods, and legacy API usage
 */
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);