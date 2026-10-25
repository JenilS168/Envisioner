import React, { useState } from 'react';
import { Code2, ChevronUp, ChevronDown, X } from 'lucide-react';

/**
 * DebugDrawer — collapses to a slim handle at the bottom centre of the screen.
 * Closed by default so it never occludes the viewport.
 */
export default function DebugPanel({ data }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`debug-drawer${isOpen ? '' : ' debug-drawer-closed'}`}>
      <div
        className="debug-drawer-handle"
        onClick={() => setIsOpen((v) => !v)}
        title={isOpen ? 'Collapse JSON inspector' : 'Open JSON data inspector'}
      >
        <span className="debug-drawer-title">
          <Code2 size={13} />
          Data Inspector
        </span>
        {isOpen ? <ChevronDown size={14} color="var(--text-dim)" /> : <ChevronUp size={14} color="var(--text-dim)" />}
      </div>

      {isOpen && (
        <div className="debug-drawer-body">
          <div className="debug-content">
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
