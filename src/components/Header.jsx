import React, { useState, useRef, useEffect } from 'react';
import {
  Trash2, Undo2, Redo2, X, Download, Upload, Box,
  HelpCircle, Home, Edit3, Keyboard, Lightbulb,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Keyboard Shortcuts Modal
// ---------------------------------------------------------------------------
function ShortcutsModal({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="hdr-modal-backdrop" onClick={onClose}>
      <div className="hdr-modal glass" onClick={(e) => e.stopPropagation()}>
        <div className="hdr-modal-header">
          <Keyboard size={18} />
          <h3>Keyboard Shortcuts</h3>
          <button className="hdr-modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="hdr-modal-body">
          {[
            ['R', 'Rotate selected furniture / stair 15°'],
            ['Delete / Backspace', 'Delete selected item'],
            ['Escape', 'Cancel current drawing / deselect'],
            ['Ctrl + Z', 'Undo last action'],
            ['Ctrl + Y', 'Redo last undone action'],
            ['Ctrl + S', 'Save project (coming soon)'],
            ['Click + Drag (2D)', 'Draw a wall'],
            ['Click on wall', 'Place door or window (in mode)'],
          ].map(([key, desc]) => (
            <div className="hdr-shortcut-row" key={key}>
              <kbd className="hdr-kbd">{key}</kbd>
              <span>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirm Dialog (unsaved changes)
// ---------------------------------------------------------------------------
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="hdr-modal-backdrop" onClick={onCancel}>
      <div className="hdr-modal hdr-confirm glass" onClick={(e) => e.stopPropagation()}>
        <div className="hdr-modal-header">
          <Home size={18} />
          <h3>Go to Home?</h3>
          <button className="hdr-modal-close" onClick={onCancel}><X size={16} /></button>
        </div>
        <p className="hdr-confirm-msg">{message}</p>
        <div className="hdr-confirm-actions">
          <button className="btn btn-accent" onClick={onConfirm}>Yes, go home</button>
          <button className="btn" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: '1px solid var(--panel-border)' }} onClick={onCancel}>Stay in Studio</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
export default function Header({
  projectName,
  onProjectNameChange,
  onGoHome,
  onSaveProject,
  onLoadProject,
  onExportGlb,
  onClear,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  selectedId,
  onDeleteSelected,
  isDirty,
  guideActive = false,
  onToggleGuide,
}) {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showHomeConfirm, setShowHomeConfirm] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(projectName || 'Untitled Project');
  const nameInputRef = useRef(null);

  // Sync nameValue if projectName changes externally (e.g., after load)
  useEffect(() => {
    setNameValue(projectName || 'Untitled Project');
  }, [projectName]);

  function handleHomeClick() {
    if (isDirty) {
      setShowHomeConfirm(true);
    } else {
      onGoHome?.();
    }
  }

  function commitName() {
    setEditingName(false);
    const trimmed = nameValue.trim() || 'Untitled Project';
    setNameValue(trimmed);
    onProjectNameChange?.(trimmed);
  }

  return (
    <>
      <header className="header glass">
        {/* Brand + Home */}
        <div className="hdr-left">
          <button className="hdr-home-btn" onClick={handleHomeClick} title="Back to Home Showcase">
            <div className="lp-logo-mark lp-logo-mark-sm">E</div>
            <span className="hdr-brand-title">Envisioner</span>
          </button>
          <div className="hdr-divider" />
          <span className="hdr-tag">STUDIO</span>
        </div>

        {/* Center — Editable Project Name */}
        <div className="hdr-centre">
          {editingName ? (
            <input
              ref={nameInputRef}
              className="hdr-name-input"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setEditingName(false); setNameValue(projectName || 'Untitled Project'); } }}
              autoFocus
            />
          ) : (
            <button className="hdr-name-btn" onClick={() => setEditingName(true)} title="Click to rename project">
              <span>{nameValue}</span>
              <Edit3 size={12} className="hdr-name-edit-icon" />
            </button>
          )}
        </div>

        {/* Right — Action Cluster */}
        <div className="hdr-right">
          <div className="hdr-action-group">
            <button className="btn btn-secondary btn-sm" onClick={onSaveProject} title="Save Project as JSON">
              <Download size={13} /> Save JSON
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onLoadProject} title="Load Project from JSON">
              <Upload size={13} /> Load JSON
            </button>
            <button className="btn btn-accent btn-sm" onClick={onExportGlb} title="Export 3D Model as GLB for AR/VR">
              <Box size={14} /> Export .GLB
            </button>
          </div>

          <div className="hdr-sep" />

          {/* History */}
          <div className="hdr-action-group">
            <button className="btn btn-icon btn-sm" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
              <Undo2 size={14} />
            </button>
            <button className="btn btn-icon btn-sm" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
              <Redo2 size={14} />
            </button>
          </div>

          <div className="hdr-sep" />

          {/* Destructive & Help */}
          <div className="hdr-action-group">
            {selectedId && (
              <button className="btn btn-danger-soft btn-sm" onClick={onDeleteSelected} title="Delete selected element (Del)">
                <X size={13} /> Delete
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={onClear} title="Clear entire floor design">
              <Trash2 size={13} /> Clear All
            </button>
            {onToggleGuide && (
              <button
                className={`btn btn-sm ${guideActive ? 'btn-accent' : 'btn-secondary'}`}
                onClick={onToggleGuide}
                title={guideActive ? 'Close Template Guide' : 'Open Template Guide'}
                style={{ gap: '5px' }}
              >
                <Lightbulb size={13} />
                {guideActive ? 'Guide ✓' : '📖 Guide'}
              </button>
            )}
            <button className="btn btn-icon btn-sm" onClick={() => setShowShortcuts(true)} title="Keyboard shortcuts (?)">
              <HelpCircle size={14} />
            </button>
          </div>
        </div>
      </header>

      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {showHomeConfirm && (
        <ConfirmDialog
          message="You have unsaved changes. Going home will not lose your design — just use Save first if you want to keep it."
          onConfirm={() => { setShowHomeConfirm(false); onGoHome?.(); }}
          onCancel={() => setShowHomeConfirm(false)}
        />
      )}
    </>
  );
}
