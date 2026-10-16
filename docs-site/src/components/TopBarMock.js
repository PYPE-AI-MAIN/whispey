import React from 'react';
import {AppWindow, Icon, Legend, Pin} from './visuals';

const ITEMS = [
  {n: 1, label: 'Back', text: 'Return to the agent page.'},
  {n: 2, label: 'Steps list', text: 'Show the Add and Outline lists.'},
  {n: 3, label: 'Agent name', text: 'Shows Unsaved when your changes are not live yet.'},
  {n: 4, label: 'Problems', text: 'What to fix or check. Click one to jump to its step.'},
  {n: 5, label: 'Ask Pi', text: 'Describe a change and Pi makes it.'},
  {n: 6, label: 'Setup', text: 'Voice, variables, rules, documents, webhook and history.'},
  {n: 7, label: 'Test call', text: 'Talk to the deployed agent.'},
  {n: 8, label: 'Deploy', text: 'Make your changes live.'},
  {n: 9, label: 'More', text: 'Check for problems, or copy and paste the flow as JSON.'},
];

/** One control in the bar, with its pin. */
function Control({n, kind = 'ghost', icon, children, label}) {
  return (
    <span className={`wp-ctl wp-ctl-${kind}`} aria-label={label}>
      <Pin n={n} />
      {icon && <Icon name={icon} />}
      {children}
    </span>
  );
}

/** The workflow editor's top bar, as it looks in the app, with each control numbered. */
export function TopBarMock() {
  return (
    <figure className="wp-visual">
      <AppWindow title="Workflow editor">
        <div className="wp-scroll">
          <div className="wp-topbar" role="img" aria-label="The workflow editor top bar, with nine numbered controls">
            <Control n={1} kind="icon" icon="arrowLeft" label="Back" />
            <Control n={2} kind="icon" icon="panelLeft" label="Steps list" />
            <span className="wp-ctl wp-ctl-name">
              <Pin n={3} />
              Booking Agent
              <span className="wp-badge">Unsaved</span>
            </span>
            <span className="wp-topbar-gap" />
            <Control n={4} kind="warn" icon="alert">2 to check</Control>
            <Control n={5} kind="outline" icon="sparkles">Ask Pi</Control>
            <Control n={6} kind="outline" icon="settings">
              Setup <Icon name="chevronDown" size={12} />
            </Control>
            <Control n={7} kind="outline" icon="phone">Test call</Control>
            <Control n={8} kind="primary" icon="rocket">Deploy</Control>
            <Control n={9} kind="icon-outline" icon="more" label="More" />
          </div>
          {/* a hint of the canvas below the bar */}
          <div className="wp-canvas-strip" aria-hidden="true" />
        </div>
      </AppWindow>
      <Legend items={ITEMS} />
    </figure>
  );
}
