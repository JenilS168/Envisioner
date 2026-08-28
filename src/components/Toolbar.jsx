import React from 'react';
import { PenLine, DoorOpen, MousePointer2, SquareStack, Box } from 'lucide-react';

/**
 * Toolbar — lets the user switch between
 * "Select", "Draw Wall", "Add Door", "Add Window", and "Place Furniture" modes.
 *
 * Props:
 *   mode         — current active mode ('wall' | 'door' | 'window' | 'select' | 'furniture')
 *   onModeChange — called with the new mode string
 */
export default function Toolbar({ mode, onModeChange }) {
  return (
    <div className="toolbar glass">
      {/* Select mode — pick, move, delete */}
      <button
        id="btn-mode-select"
        className={`btn toolbar-btn ${mode === 'select' ? 'toolbar-btn-active' : ''}`}
        onClick={() => onModeChange('select')}
        title="Select walls, doors, windows, or furniture to move or delete them"
      >
        <MousePointer2 size={16} />
        Select
      </button>

      <div className="toolbar-separator" />

      {/* Draw Wall mode */}
      <button
        id="btn-mode-wall"
        className={`btn toolbar-btn ${mode === 'wall' ? 'toolbar-btn-active' : ''}`}
        onClick={() => onModeChange('wall')}
        title="Draw a wall by clicking and dragging"
      >
        <PenLine size={16} />
        Draw Wall
      </button>

      {/* Add Door mode */}
      <button
        id="btn-mode-door"
        className={`btn toolbar-btn ${mode === 'door' ? 'toolbar-btn-active' : ''}`}
        onClick={() => onModeChange('door')}
        title="Click on an existing wall to place a door"
      >
        <DoorOpen size={16} />
        Add Door
      </button>

      {/* Add Window mode */}
      <button
        id="btn-mode-window"
        className={`btn toolbar-btn ${mode === 'window' ? 'toolbar-btn-active' : ''}`}
        onClick={() => onModeChange('window')}
        title="Click on an existing wall to place a window"
      >
        <SquareStack size={16} />
        Add Window
      </button>

      <div className="toolbar-separator" />

      {/* Place Furniture mode */}
      <button
        id="btn-mode-furniture"
        className={`btn toolbar-btn ${mode === 'furniture' ? 'toolbar-btn-active' : ''}`}
        onClick={() => onModeChange('furniture')}
        title="Place furniture items inside closed rooms"
      >
        <Box size={16} />
        Furniture
      </button>
    </div>
  );
}
