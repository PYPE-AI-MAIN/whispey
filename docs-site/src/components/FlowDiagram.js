import React from 'react';

const STEPS = [
  {name: 'Greet', kind: 'Conversation', color: '#3b82f6'},
  {name: 'Ask day and time', kind: 'Collect Details', color: '#8b5cf6'},
  {name: 'Confirm', kind: 'Conversation', color: '#3b82f6'},
  {name: 'End call', kind: 'End Call', color: '#dc2626'},
];

/** A small picture of a call moving through steps, with a global rule that can fire from any of them. */
export function FlowDiagram() {
  return (
    <figure className="wp-flow" aria-label="A call moving through four steps, with a global rule that can send it to a hand-off from any step">
      <div className="wp-flow-row">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.name}>
            <div className="wp-flow-step" style={{'--c': s.color}}>
              <span className="wp-flow-kind">{s.kind}</span>
              <span className="wp-flow-name">{s.name}</span>
              {i === 0 && <span className="wp-flow-start">Start</span>}
            </div>
            {i < STEPS.length - 1 && <span className="wp-flow-arrow" aria-hidden="true" />}
          </React.Fragment>
        ))}
      </div>
      <div className="wp-flow-rule">
        <span className="wp-flow-rule-line" aria-hidden="true" />
        <span className="wp-flow-rule-label">Global rule: "they ask for a person" goes to a hand-off, from any step</span>
      </div>
      <figcaption>Steps are boxes, connections are arrows, and a global rule is written once.</figcaption>
    </figure>
  );
}
