import React from 'react';
import Link from '@docusaurus/Link';

/** A responsive grid of link cards. */
export function CardGrid({children}) {
  return <div className="wp-cards">{children}</div>;
}

export function Card({to, title, tag, children}) {
  return (
    <Link className="wp-card" to={to}>
      {tag && <span className="wp-card-tag">{tag}</span>}
      <span className="wp-card-title">{title}</span>
      <span className="wp-card-text">{children}</span>
      <span className="wp-card-go" aria-hidden="true">Read</span>
    </Link>
  );
}
