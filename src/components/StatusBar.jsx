import React from 'react';
import { Info } from 'lucide-react';

const MODE_HINTS = {
  wall:      'Click & drag on the 2D canvas to draw a wall · Connect endpoints to close rooms',
  door:      'Click on any existing wall to place a door · Drag along the wall to reposition',
  window:    'Click on any existing wall to place a window · Drag along the wall to reposition',
  select:    'Click to select a wall, door, window, furniture, or stair · Drag to move · R to rotate · Del to delete',
  furniture: 'Click inside a closed room to place furniture · Use the sidebar to change type and style',
  stairs:    'Click inside a closed room to place stairs · Requires a floor above to connect to',
};

const EMPTY_HINT = {
  title: 'Getting Started',
  steps: [
    '1 · Switch to "Wall" mode and draw 4 connected walls to form a room',
    '2 · Select a room to configure its roof in the sidebar',
    '3 · Switch to "Door" or "Window" mode to add openings',
  ],
};

export default function StatusBar({ mode, hasContent, onDismissHint, hintDismissed }) {
  const hint = MODE_HINTS[mode] || '';

  return (
    <div className="status-bar glass">
      <div className="status-hint">
        <Info size={13} className="status-hint-icon" />
        <span>{hint}</span>
      </div>

      {!hasContent && !hintDismissed && (
        <div className="status-starter glass">
          <strong>{EMPTY_HINT.title}</strong>
          {EMPTY_HINT.steps.map((s) => <span key={s} className="status-starter-step">{s}</span>)}
          <button className="status-starter-dismiss" onClick={onDismissHint}>✕ Got it</button>
        </div>
      )}
    </div>
  );
}
