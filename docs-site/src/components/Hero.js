import React from 'react';
import Link from '@docusaurus/Link';

/** The top of the docs home page: one headline, one line, two ways in. */
export function Hero({title, accent, lead, primary, secondary}) {
  return (
    <section className="wp-hero">
      <p className="wp-eyebrow">Whispey by Pype</p>
      <h1 className="wp-hero-title">
        {title} <em>{accent}</em>
      </h1>
      <p className="wp-hero-lead">{lead}</p>
      <div className="wp-hero-actions">
        <Link className="wp-btn wp-btn-primary" to={primary.to}>{primary.label}</Link>
        {secondary && <Link className="wp-btn wp-btn-ghost" to={secondary.to}>{secondary.label}</Link>}
      </div>
    </section>
  );
}
