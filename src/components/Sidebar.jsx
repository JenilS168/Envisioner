import React from 'react';
import { Home, Layers, CheckCircle2, AlertCircle, ChevronRight, ChevronLeft } from 'lucide-react';

/**
 * Sidebar component containing the Roof configuration section and room diagnostics.
 *
 * Props:
 *   selectedId       — ID of the currently selected element
 *   closedLoops      — array of calculated closed loops
 *   rooms            — array of room data (e.g. { id, roof: { type, height, ... } })
 *   onUpdateRoomRoof — callback(roomId, roofData)
 *   isOpen           — sidebar open/collapsed state
 *   onToggleOpen     — toggle sidebar
 */
export default function Sidebar({
  selectedId,
  closedLoops = [],
  rooms = [],
  onUpdateRoomRoof,
  isOpen = true,
  onToggleOpen,
}) {
  const hasClosedLoop = closedLoops.length > 0;
  
  // Find if a valid room/loop is currently selected
  const selectedLoop = closedLoops.find(l => l.id === selectedId);
  const selectedRoomData = rooms.find(r => r.id === selectedId);
  
  // Fallback roof defaults
  const defaultRoof = { enabled: false, type: 'flat', height: 1.5, pitch: 25 };
  const currentRoof = selectedRoomData ? selectedRoomData.roof : defaultRoof;

  function handleTypeChange(e) {
    if (!selectedLoop) return;
    const newType = e.target.value;
    onUpdateRoomRoof && onUpdateRoomRoof(selectedLoop.id, { ...currentRoof, type: newType });
  }

  function handleHeightChange(e) {
    if (!selectedLoop) return;
    const newHeight = parseFloat(e.target.value);
    onUpdateRoomRoof && onUpdateRoomRoof(selectedLoop.id, { ...currentRoof, height: newHeight });
  }

  function handleToggleRoof() {
    if (!selectedLoop) return;
    onUpdateRoomRoof && onUpdateRoomRoof(selectedLoop.id, { ...currentRoof, enabled: !currentRoof.enabled });
  }

  return (
    <aside className={`sidebar glass ${isOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
      {/* Toggle collapse button */}
      <button
        className="sidebar-toggle-btn btn-icon"
        onClick={onToggleOpen}
        title={isOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
        aria-label="Toggle Sidebar"
      >
        {isOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {isOpen && (
        <div className="sidebar-content">
          <div className="sidebar-header">
            <div className="sidebar-title">
              <Home size={18} className="text-accent" />
              <span>Structure & Roof</span>
            </div>
          </div>

          {/* ---- Roof Section ---- */}
          <div className="sidebar-section">
            <div className="section-title">
              <Layers size={16} />
              <span>Roof Configuration</span>
            </div>

            {/* Status indicator */}
            <div className={`status-badge ${hasClosedLoop ? 'status-success' : 'status-warning'}`}>
              {hasClosedLoop ? (
                <>
                  <CheckCircle2 size={14} />
                  <span>
                    {closedLoops.length} closed {closedLoops.length === 1 ? 'structure' : 'structures'} detected
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle size={14} />
                  <span>Connect walls in a loop to add a roof</span>
                </>
              )}
            </div>

            {!selectedLoop ? (
              <div className="info-card mt-2">
                <p className="text-sm text-muted">
                  Click on a closed structure's floor in the 2D or 3D view to configure its roof.
                </p>
              </div>
            ) : (
              <>
                <div className="info-card mt-2 mb-2">
                  <p className="text-sm">
                    <strong>Selected Structure:</strong> {selectedLoop.area.toFixed(1)} m²
                  </p>
                </div>

                {/* Add / Remove Roof Toggle */}
                <div className="form-group" style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
                  <button
                    className={`btn ${currentRoof.enabled ? 'btn-danger' : 'btn-primary'}`}
                    style={{ width: '100%', padding: '0.5rem' }}
                    onClick={handleToggleRoof}
                  >
                    {currentRoof.enabled ? 'Remove Roof' : 'Add Roof'}
                  </button>
                </div>

                {/* Roof Type Dropdown */}
                {currentRoof.enabled && (
                  <div className="form-group">
                    <label htmlFor="roof-type-select" className="form-label">
                      Roof Type
                    </label>
                    <select
                      id="roof-type-select"
                      className="form-select"
                      value={currentRoof.type || 'flat'}
                      onChange={handleTypeChange}
                    >
                      <option value="flat">Flat Roof (Slab)</option>
                      <option value="gable">Hip Roof (Pitched)</option>
                    </select>
                  </div>
                )}

                {/* Height / Pitch Control (especially useful for Gable/Hip) */}
                {currentRoof.enabled && currentRoof.type === 'gable' && (
                  <div className="form-group">
                    <div className="form-label-row">
                      <label htmlFor="roof-height-slider" className="form-label">
                        Ridge Height
                      </label>
                      <span className="form-value-badge">{(currentRoof.height || 1.5).toFixed(1)} m</span>
                    </div>
                    <input
                      id="roof-height-slider"
                      type="range"
                      min="0.5"
                      max="3.5"
                      step="0.1"
                      className="form-slider"
                      value={currentRoof.height || 1.5}
                      onChange={handleHeightChange}
                    />
                    <div className="slider-hints">
                      <span>Low (0.5m)</span>
                      <span>Steep (3.5m)</span>
                    </div>
                  </div>
                )}

                {/* Information Card */}
                {currentRoof.enabled && (
                  <div className="info-card">
                    <p className="text-xs text-muted">
                      {currentRoof.type === 'gable'
                        ? 'A pitched hip roof that automatically adapts to the selected polygon structure.'
                        : 'A flat slab with beveled edges covering the top of this selected loop.'}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
