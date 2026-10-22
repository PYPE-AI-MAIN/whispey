import React from 'react';
import {AppWindow, Icon} from './visuals';

const STEPS = [
  {name: 'Greet', kind: 'Conversation', icon: 'messageSquare', tone: 'blue', say: '“Hi, this is Sunrise Clinic…”'},
  {name: 'Ask day and time', kind: 'Collect', icon: 'listChecks', tone: 'violet', say: 'Saves preferred_day, preferred_time'},
  {name: 'Confirm', kind: 'Conversation', icon: 'messageSquare', tone: 'blue', say: 'Reads the booking back'},
  {name: 'End call', kind: 'End call', icon: 'phoneOff', tone: 'red', say: 'Says goodbye and hangs up'},
];

/** A call moving through steps on the canvas, with a global rule that can fire from any of them. */
export function FlowDiagram() {
  return (
    <figure className="wp-visual" aria-label="A call moving through four steps, with a global rule that can send it to a person from any step">
      <AppWindow title="Workflow editor · canvas">
        <div className="wp-scroll">
          <div className="wp-canvas">
            <div className="wp-canvas-row">
              <span className="wp-start">Start</span>
              {STEPS.map((s, i) => (
                <React.Fragment key={s.name}>
                  <span className="wp-edge" aria-hidden="true" />
                  <div className={`wp-node wp-tone-${s.tone}`}>
                    <span className="wp-node-kind">
                      <Icon name={s.icon} size={12} />
                      {s.kind}
                    </span>
                    <span className="wp-node-name">{s.name}</span>
                    <span className="wp-node-say">{s.say}</span>
                  </div>
                </React.Fragment>
              ))}
            </div>

            <div className="wp-rule">
              <div className="wp-rule-band">
                <span className="wp-rule-tag">Global rule</span>
                <span>“They ask for a person” — checked on every step</span>
              </div>
              <span className="wp-edge wp-edge-dashed" aria-hidden="true" />
              <div className="wp-node wp-tone-green">
                <span className="wp-node-kind">
                  <Icon name="userRound" size={12} />
                  Transfer
                </span>
                <span className="wp-node-name">Hand off to a person</span>
              </div>
            </div>
          </div>
        </div>
      </AppWindow>
      <figcaption className="wp-visual-caption">
        Steps are boxes, connections are arrows. A global rule is written once and can move the call from any step.
      </figcaption>
    </figure>
  );
}
