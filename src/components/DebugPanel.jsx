import React, { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

export default function DebugPanel({ data }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="debug-panel glass">
      <div className="debug-header" onClick={() => setIsOpen(!isOpen)}>
        <strong style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          Data Model (JSON)
        </strong>
        {isOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
      </div>
      {isOpen && (
        <div className="debug-content">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
