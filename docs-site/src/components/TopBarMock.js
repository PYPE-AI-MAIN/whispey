import React from 'react';

const ITEMS = [
  {n: 1, label: 'Back', text: 'Return to the agent page'},
  {n: 2, label: 'Panel', text: 'Show the Add and Outline lists'},
  {n: 3, label: 'Agent name', text: 'With an Unsaved badge when changes are not live'},
  {n: 4, label: 'Problems', text: 'What to fix or check, one click to the step'},
  {n: 5, label: 'Ask Pi', text: 'Describe a change and Pi makes it'},
  {n: 6, label: 'Setup', text: 'Voice, variables, rules, documents, webhook, history'},
  {n: 7, label: 'Test call', text: 'Talk to the deployed agent'},
  {n: 8, label: 'Deploy', text: 'Make your changes live'},
  {n: 9, label: 'More', text: 'Check for problems, copy or paste the flow as JSON'},
];

/** The editor's top bar drawn with numbers, so the legend below it can be read at a glance. */
export function TopBarMock() {
  const chip = (n, text, cls = '') => (
    <span className={`wp-bar-chip ${cls}`}>
      <b>{n}</b>
      {text}
    </span>
  );
  return (
    <figure className="wp-bar-figure">
      <div className="wp-bar" role="img" aria-label="The editor top bar with nine numbered controls">
        {chip(1, '←', 'wp-bar-icon')}
        {chip(2, '▤', 'wp-bar-icon')}
        {chip(3, 'Booking Agent', 'wp-bar-name')}
        <span className="wp-bar-spacer" />
        {chip(4, '2 to check', 'wp-bar-warn')}
        {chip(5, 'Ask Pi')}
        {chip(6, 'Setup ▾')}
        {chip(7, 'Test call')}
        {chip(8, 'Deploy', 'wp-bar-primary')}
        {chip(9, '⋯', 'wp-bar-icon')}
      </div>
      <ol className="wp-bar-legend">
        {ITEMS.map((i) => (
          <li key={i.n}>
            <b>{i.n}</b>
            <span><strong>{i.label}.</strong> {i.text}.</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}
