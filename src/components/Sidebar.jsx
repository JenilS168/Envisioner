import React, { useState } from 'react';
import { Home, Layers, Palette, CheckCircle2, AlertCircle, ChevronRight, ChevronLeft } from 'lucide-react';

// ---------------------------------------------------------------------------
// ColorRow — a labeled color input with a swatch
// ---------------------------------------------------------------------------
function ColorRow({ label, value, onChange }) {
  return (
    <div className="color-row">
      <span className="form-label">{label}</span>
      <div className="color-row-right">
        <div className="color-swatch" style={{ background: value }} />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="color-input"
          title={label}
        />
      </div>
    </div>
  );
}

/**
 * Sidebar component — two tabs: "Structure & Roof" and "Materials".
 *
 * Props:
 *   selectedId       — ID of the currently selected element
 *   closedLoops      — array of calculated closed loops
 *   rooms            — array of room data
 *   materials        — global material settings object
 *   onUpdateRoomRoof — callback(roomId, roofData)
 *   onUpdateMaterials — callback(patch)
 *   onUpdateRoomFloor — callback(roomId, floorColor)
 *   isOpen           — sidebar open/collapsed state
 *   onToggleOpen     — toggle sidebar
 */
export default function Sidebar({
  selectedId,
  closedLoops = [],
  rooms = [],
  materials = {},
  onUpdateRoomRoof,
  onUpdateMaterials,
  onUpdateRoomFloor,
  isOpen = true,
  onToggleOpen,
}) {
  const [activeTab, setActiveTab] = useState('roof'); // 'roof' | 'materials'

  const hasClosedLoop = closedLoops.length > 0;

  // Find if a valid room/loop is currently selected
  const selectedLoop = closedLoops.find(l => l.id === selectedId);
  const selectedRoomData = rooms.find(r => r.id === selectedId);

  // Fallback roof defaults
  const defaultRoof = { enabled: false, type: 'flat', height: 1.5, pitch: 25 };
  const currentRoof = selectedRoomData ? selectedRoomData.roof : defaultRoof;

  // Current floor color for the selected structure
  const currentFloorColor = selectedRoomData?.floorColor || '#94a3b8';

  // ---- Roof handlers ----
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

  // ---- Material patch helpers ----
  function mat(field) {
    return (value) => onUpdateMaterials && onUpdateMaterials({ [field]: value });
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
          {/* ---- Header ---- */}
          <div className="sidebar-header">
            <div className="sidebar-title">
              <Home size={18} className="text-accent" />
              <span>Design Settings</span>
            </div>
          </div>

          {/* ---- Tab Bar ---- */}
          <div className="tab-bar">
            <button
              className={`tab-btn ${activeTab === 'roof' ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab('roof')}
            >
              <Layers size={14} />
              <span>Structure</span>
            </button>
            <button
              className={`tab-btn ${activeTab === 'materials' ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab('materials')}
            >
              <Palette size={14} />
              <span>Materials</span>
            </button>
          </div>

          {/* ========================================================
              TAB: Structure & Roof
          ======================================================== */}
          {activeTab === 'roof' && (
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

                  {/* Height / Pitch Control */}
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
          )}

          {/* ========================================================
              TAB: Materials
          ======================================================== */}
          {activeTab === 'materials' && (
            <div className="sidebar-section">

              {/* ---- Walls ---- */}
              <div className="section-title">
                <Palette size={16} />
                <span>Walls</span>
              </div>

              <div className="form-group">
                <label className="form-label">Wall Material Preset</label>
                <select
                  className="form-select"
                  value={materials.wallPreset || 'plain'}
                  onChange={(e) => mat('wallPreset')(e.target.value)}
                >
                  <option value="plain">Plain</option>
                  <option value="brick">Brick</option>
                  <option value="concrete">Concrete</option>
                  <option value="wood">Wood</option>
                </select>
              </div>

              <ColorRow label="Wall Color" value={materials.wallColor || '#d6c2a1'} onChange={mat('wallColor')} />

              <div className="section-divider" />

              {/* ---- Doors ---- */}
              <div className="section-title">
                <Palette size={16} />
                <span>Doors</span>
              </div>

              <ColorRow label="Door Frame Color" value={materials.doorFrameColor || '#4b2e1e'} onChange={mat('doorFrameColor')} />
              <ColorRow label="Door Panel Color" value={materials.doorPanelColor || '#8b5a2b'} onChange={mat('doorPanelColor')} />

              <div className="section-divider" />

              {/* ---- Windows ---- */}
              <div className="section-title">
                <Palette size={16} />
                <span>Windows</span>
              </div>

              <ColorRow label="Window Frame Color" value={materials.windowFrameColor || '#eeeeee'} onChange={mat('windowFrameColor')} />
              <ColorRow label="Glass Color" value={materials.windowGlassColor || '#78c7e8'} onChange={mat('windowGlassColor')} />

              <div className="section-divider" />

              {/* ---- Roof ---- */}
              <div className="section-title">
                <Palette size={16} />
                <span>Roof</span>
              </div>

              <div className="form-group">
                <label className="form-label">Roof Material Preset</label>
                <select
                  className="form-select"
                  value={materials.roofPreset || 'plain'}
                  onChange={(e) => mat('roofPreset')(e.target.value)}
                >
                  <option value="plain">Plain</option>
                  <option value="tiles">Tiles</option>
                  <option value="metal">Metal</option>
                </select>
              </div>

              <ColorRow label="Roof Color" value={materials.roofColor || '#555555'} onChange={mat('roofColor')} />

              <div className="section-divider" />

              {/* ---- Per-Structure Floor Color ---- */}
              <div className="section-title">
                <Palette size={16} />
                <span>Floor (per structure)</span>
              </div>

              {!selectedLoop ? (
                <div className="info-card">
                  <p className="text-sm text-muted">
                    Select a closed structure in the 2D or 3D view to change its floor color.
                  </p>
                </div>
              ) : (
                <>
                  <div className="info-card mb-2">
                    <p className="text-sm">
                      <strong>Selected:</strong> {selectedLoop.area.toFixed(1)} m²
                    </p>
                  </div>
                  <ColorRow
                    label="Floor Color"
                    value={currentFloorColor}
                    onChange={(color) => onUpdateRoomFloor && onUpdateRoomFloor(selectedLoop.id, color)}
                  />
                </>
              )}

            </div>
          )}

        </div>
      )}
    </aside>
  );
}
