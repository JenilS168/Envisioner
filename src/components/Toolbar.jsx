import React from 'react';
import { PenLine, DoorOpen, MousePointer2, Box, ListOrdered, RectangleHorizontal } from 'lucide-react';

const TOOLS = [
  {
    mode: 'select',
    label: 'Select',
    icon: <MousePointer2 size={18} />,
    shortcut: 'S',
    tip: 'Select & move walls, doors, furniture',
    id: 'btn-mode-select',
  },
  { type: 'sep' },
  {
    mode: 'wall',
    label: 'Wall',
    icon: <PenLine size={18} />,
    shortcut: 'W',
    tip: 'Click & drag to draw walls',
    id: 'btn-mode-wall',
  },
  {
    mode: 'door',
    label: 'Door',
    icon: <DoorOpen size={18} />,
    shortcut: 'D',
    tip: 'Click a wall to place a door',
    id: 'btn-mode-door',
  },
  {
    mode: 'window',
    label: 'Window',
    icon: <RectangleHorizontal size={18} />,
    shortcut: 'N',
    tip: 'Click a wall to place a window',
    id: 'btn-mode-window',
  },
  {
    mode: 'stairs',
    label: 'Stairs',
    icon: <ListOrdered size={18} />,
    shortcut: 'T',
    tip: 'Place stairs to connect floors',
    id: 'btn-mode-stairs',
  },
  {
    mode: 'furniture',
    label: 'Furniture',
    icon: <Box size={18} />,
    shortcut: 'F',
    tip: 'Place furniture inside rooms',
    id: 'btn-mode-furniture',
  },
];

export default function Toolbar({ mode, onModeChange }) {
  return (
    <div className="toolbar-dock glass" role="toolbar" aria-label="Drawing tools">
      {TOOLS.map((tool, idx) => {
        if (tool.type === 'sep') {
          return <div key={`sep-${idx}`} className="toolbar-dock-sep" />;
        }
        const isActive = mode === tool.mode;
        return (
          <div key={tool.mode} className="toolbar-dock-item-wrap">
            <button
              id={tool.id}
              className={`toolbar-dock-btn${isActive ? ' toolbar-dock-btn-active' : ''}`}
              onClick={() => onModeChange(tool.mode)}
              title={`${tool.label} — ${tool.tip}`}
              aria-pressed={isActive}
            >
              <span className="toolbar-dock-icon">{tool.icon}</span>
              <span className="toolbar-dock-label">{tool.label}</span>
            </button>
            {/* Tooltip */}
            <div className="toolbar-tooltip glass" role="tooltip">
              <span className="toolbar-tooltip-label">{tool.label}</span>
              <span className="toolbar-tooltip-tip">{tool.tip}</span>
              <kbd className="toolbar-tooltip-kbd">{tool.shortcut}</kbd>
            </div>
          </div>
        );
      })}
    </div>
  );
}
