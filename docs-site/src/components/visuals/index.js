// Building blocks for product visuals in the docs: an app-window frame, the
// same icons the app uses (Lucide), and numbered pins for annotating a UI.
import React from 'react';

const ICON_PATHS = {
  arrowLeft: 'M12 19l-7-7 7-7M19 12H5',
  panelLeft: 'M3 3h18v18H3zM9 3v18',
  alert: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  sparkles: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 3v4M21 5h-4',
  settings: 'M20 7h-9M14 17H5M17 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM7 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  chevronDown: 'm6 9 6 6 6-6',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
  rocket: 'M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1zM12 15l-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2zM9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  messageSquare: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  listChecks: 'M10 6h11M10 12h11M10 18h11M3 6l1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2',
  phoneOff: 'M10.7 13.3a16 16 0 0 0 3.4 2.6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19 19 0 0 1-3.3-2.6M5.2 13.2A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9M22 2 2 22',
  userRound: 'M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM20 21a8 8 0 0 0-16 0',
};

export function Icon({name, size = 14}) {
  if (name === 'more') {
    return (
      <svg className="wp-icon" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
        <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
      </svg>
    );
  }
  return (
    <svg className="wp-icon" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

/** A browser-like window around a product visual. */
export function AppWindow({title, children, className = ''}) {
  return (
    <div className={`wp-window ${className}`}>
      <div className="wp-window-bar" aria-hidden="true">
        <span className="wp-window-dots"><i /><i /><i /></span>
        {title && <span className="wp-window-title">{title}</span>}
      </div>
      <div className="wp-window-body">{children}</div>
    </div>
  );
}

/** A numbered marker pinned above a control. */
export function Pin({n}) {
  return <span className="wp-pin" aria-hidden="true">{n}</span>;
}

/** The numbered list that explains the pins. */
export function Legend({items}) {
  return (
    <ol className="wp-legend">
      {items.map((i) => (
        <li key={i.n}>
          <span className="wp-legend-n">{i.n}</span>
          <span>
            <strong>{i.label}</strong>
            <span className="wp-legend-text">{i.text}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
