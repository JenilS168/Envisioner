import React from 'react';
import { Trash2, Undo2, Redo2, X } from 'lucide-react';

/**
 * Header — top bar with logo, undo/redo buttons, delete-selected, and clear.
 *
 * Props:
 *   onClear       — resets the entire design
 *   onUndo        — undo last action
 *   onRedo        — redo last undone action
 *   canUndo       — boolean, true if undo is possible
 *   canRedo       — boolean, true if redo is possible
 *   selectedId    — the currently selected wall/door id, or null
 *   onDeleteSelected — deletes whatever is currently selected
 */
export default function Header({
  onClear,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  selectedId,
  onDeleteSelected,
}) {
  return (
    <header className="header glass">
      <div className="logo">Envisioner</div>

      <div className="header-actions">
        {/* Undo */}
        <button
          className="btn btn-icon"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={16} />
        </button>

        {/* Redo */}
        <button
          className="btn btn-icon"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 size={16} />
        </button>

        <div className="header-separator" />

        {/* Delete selected — only enabled when something is selected */}
        <button
          className="btn btn-danger"
          onClick={onDeleteSelected}
          disabled={!selectedId}
          title="Delete selected (Del)"
        >
          <X size={16} />
          Delete
        </button>

        {/* Clear all */}
        <button className="btn btn-danger" onClick={onClear} title="Clear entire design">
          <Trash2 size={16} />
          Clear All
        </button>
      </div>
    </header>
  );
}
