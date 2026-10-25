import React, { useState, useRef } from 'react';
import {
  Home, Layers, Palette, CheckCircle2, AlertCircle,
  ChevronRight, ChevronLeft, Square, AlertTriangle, Box, ListOrdered,
} from 'lucide-react';
import { FURNITURE_CATALOG } from '../utils/furniture';
import { STAIR_CATALOG, calculateStepCount } from '../utils/stairs';

// ---------------------------------------------------------------------------
// ColorRow — labeled color input that uses the three-phase commit pattern.
//
// Props:
//   label       — display label
//   value       — current color string
//   onSnapshot  — called on focus (before any change) — saves undo snapshot
//   onChange    — called on every change (live update, no undo entry)
//   onCommit    — called on blur (single undo entry with before→after)
// ---------------------------------------------------------------------------
function ColorRow({ label, value, onSnapshot, onChange, onCommit }) {
  // Track the most recent color so onCommit can pass the final value.
  const latestRef = useRef(value);
  latestRef.current = value;

  return (
    <div className="color-row">
      <span className="form-label">{label}</span>
      <div className="color-row-right">
        <div className="color-swatch" style={{ background: value }} />
        <input
          type="color"
          value={value}
          onFocus={() => onSnapshot && onSnapshot()}
          onChange={(e) => {
            latestRef.current = e.target.value;
            onChange && onChange(e.target.value);
          }}
          onBlur={() => onCommit && onCommit(latestRef.current)}
          className="color-input"
          title={label}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PresetSelect — labelled dropdown. Dropdown changes are discrete (one option
// chosen at a time) — already correct, no snapshot/commit needed.
// ---------------------------------------------------------------------------
function PresetSelect({ label, value, onChange, options }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <select className="form-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RangeRow — slider input that uses the three-phase commit pattern.
//
// Props:
//   label       — display label
//   displayValue — formatted string for the badge (e.g. "1.5 m")
//   value       — numeric value (controlled)
//   min, max, step
//   onSnapshot  — called on mousedown (before any change)
//   onChange    — called on every change (live update, no undo entry)
//   onCommit    — called on mouseup/pointerup (single undo entry)
// ---------------------------------------------------------------------------
function RangeRow({ label, displayValue, value, min, max, step, onSnapshot, onChange, onCommit, style, hints }) {
  const latestRef = useRef(value);
  latestRef.current = value;

  return (
    <div className="form-group">
      <div className="form-label-row">
        <label className="form-label">{label}</label>
        <span className="form-value-badge">{displayValue}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        className="form-slider"
        value={value}
        style={style}
        onMouseDown={() => onSnapshot && onSnapshot()}
        onChange={(e) => {
          latestRef.current = e.target.value;
          onChange && onChange(e.target.value);
        }}
        onMouseUp={() => onCommit && onCommit(latestRef.current)}
        // Also handle pointer events for touch screens
        onPointerUp={() => onCommit && onCommit(latestRef.current)}
      />
      {hints && (
        <div className="slider-hints">{hints}</div>
      )}
    </div>
  );
}

const WALL_PRESETS = [
  { value: 'plain',    label: 'Plain' },
  { value: 'brick',    label: 'Brick' },
  { value: 'concrete', label: 'Concrete' },
  { value: 'wood',     label: 'Wood' },
];

const ROOF_PRESETS = [
  { value: 'plain',  label: 'Plain' },
  { value: 'tiles',  label: 'Tiles' },
  { value: 'metal',  label: 'Metal' },
];

/**
 * Sidebar — three tabs: Structure/Roof, Materials, Furniture.
 *
 * All color pickers and sliders use the three-phase commit pattern:
 *   onXxxStart   → snapshot (before)
 *   onUpdateXxx  → live update (setStateOnly, no undo entry)
 *   onCommitXxx  → single undo entry (pushState with before snapshot)
 *
 * Discrete controls (dropdowns, toggle buttons, apply-to-all) remain
 * as single-callback calls — no snapshot needed.
 */
export default function Sidebar({
  selectedId,
  walls = [],
  closedLoops = [],
  rooms = [],
  materials = {},
  furniture = [],
  selectedFurnitureType = 'bed',
  mode,
  snapRotation = true,

  // Discrete callbacks
  onUpdateRoomRoof,
  onApplyWallMaterialToAll,
  onApplyRoofMaterialToAll,
  onSelectFurnitureType,
  onSelectStairType,

  // Wall material — live/commit
  onWallMatStart,
  onUpdateWallMaterial,
  onCommitWallMaterial,

  // Wall dimensions — live/commit
  onWallDimStart,
  onUpdateWallDimensions,
  onCommitWallDimensions,

  // Roof material — live/commit
  onRoofMatStart,
  onUpdateRoomRoofMaterial,
  onCommitRoofMaterial,

  // Roof height — live/commit
  onRoofHeightStart,
  onUpdateRoomRoofHeight,
  onCommitRoofHeight,

  // Floor color — live/commit
  onFloorColorStart,
  onUpdateRoomFloor,
  onCommitRoomFloor,

  // Global materials — live/commit
  onGlobalMatStart,
  onUpdateMaterials,
  onCommitMaterials,

  // Furniture color — live/commit
  onFurnColorStart,
  onUpdateFurnitureColor,
  onCommitFurnitureColor,

  // Furniture scale — live/commit
  onFurnScaleStart,
  onUpdateFurnitureScale,
  onCommitFurnitureScale,

  // Stair properties — live/commit
  onStairColorStart,
  onUpdateStairColor,
  onCommitStairColor,

  onStairDimStart,
  onUpdateStairDimensions,
  onCommitStairDimensions,

  onStairTurnChange,
  
  // Floor context for stairs
  activeFloorIndex = 0,
  totalFloors = 1,
  floorHeight = 3, // Delta to next floor
  stairs = [],
  selectedStairType = 'straight',

  // Misc
  onToggleSnapRotation,
  isOpen = true,
  onToggleOpen,
}) {
  const [activeTab, setActiveTab] = useState('roof');

  React.useEffect(() => {
    if (mode === 'furniture') setActiveTab('furniture');
    if (mode === 'stairs') setActiveTab('stairs');
  }, [mode]);

  const hasClosedLoop = closedLoops.length > 0;

  // Identify what is currently selected
  const selectedWall      = walls.find(w => w.id === selectedId) || null;
  const selectedLoop      = closedLoops.find(l => l.id === selectedId) || null;
  const selectedRoomData  = rooms.find(r => r.id === selectedId) || null;
  const selectedFurniture = furniture.find(f => f.id === selectedId) || null;
  const selectedStair     = stairs.find(s => s.id === selectedId) || null;

  // Effective roof for the selected structure
  const defaultRoof = { enabled: false, type: 'flat', height: 1.5 };
  const currentRoof = selectedRoomData?.roof ?? defaultRoof;

  // Effective material for the selected wall (per-wall overrides global)
  const wallMatColor  = selectedWall?.material?.color  ?? materials.wallColor  ?? '#d6c2a1';
  const wallMatPreset = selectedWall?.material?.preset ?? materials.wallPreset ?? 'plain';
  const wallHeight    = selectedWall?.height    ?? 3;
  const wallThickness = selectedWall?.thickness ?? 0.2;

  // Effective roof color/preset for selected room
  const roofColor  = currentRoof?.color  ?? materials.roofColor  ?? '#555555';
  const roofPreset = currentRoof?.preset ?? materials.roofPreset ?? 'plain';

  // Floor color for selected structure
  const currentFloorColor = selectedRoomData?.floorColor || '#94a3b8';

  // ---- Roof tab handlers (discrete) ----
  function handleRoofTypeChange(e) {
    if (!selectedLoop) return;
    onUpdateRoomRoof && onUpdateRoomRoof(selectedLoop.id, { ...currentRoof, type: e.target.value });
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
          {/* ---- Header ---- */}
          <div className="sidebar-header">
            <div className="sidebar-title">
              <Home size={18} className="text-accent" />
              <span>Design Settings</span>
            </div>
          </div>

          {/* ---- Tab Bar ---- */}
          <div className="tab-bar">
            <button className={`tab-btn ${activeTab === 'roof' ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab('roof')}>
              <Layers size={14} /><span>Structure</span>
            </button>
            <button className={`tab-btn ${activeTab === 'materials' ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab('materials')}>
              <Palette size={14} /><span>Materials</span>
            </button>
            <button className={`tab-btn ${activeTab === 'furniture' ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab('furniture')}>
              <Box size={14} /><span>Furniture</span>
            </button>
            <button className={`tab-btn ${activeTab === 'stairs' ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab('stairs')}>
              <ListOrdered size={14} /><span>Stairs</span>
            </button>
          </div>

          {/* ============================================================
              TAB: Structure & Roof
          ============================================================ */}
          {activeTab === 'roof' && (
            <div className="sidebar-section">
              <div className="section-title">
                <Layers size={16} />
                <span>Roof Configuration</span>
              </div>

              <div className={`status-badge ${hasClosedLoop ? 'status-success' : 'status-warning'}`}>
                {hasClosedLoop ? (
                  <><CheckCircle2 size={14} /><span>
                    {closedLoops.length} closed {closedLoops.length === 1 ? 'structure' : 'structures'} detected
                  </span></>
                ) : (
                  <><AlertCircle size={14} /><span>Connect walls in a loop to add a roof</span></>
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

                  {/* Add / Remove Roof Toggle (discrete) */}
                  <div className="form-group" style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
                    <button
                      className={`btn ${currentRoof.enabled ? 'btn-danger' : 'btn-primary'}`}
                      style={{ width: '100%', padding: '0.5rem' }}
                      onClick={handleToggleRoof}>
                      {currentRoof.enabled ? 'Remove Roof' : 'Add Roof'}
                    </button>
                  </div>

                  {/* Roof Type Dropdown (discrete) */}
                  {currentRoof.enabled && (
                    <div className="form-group">
                      <label htmlFor="roof-type-select" className="form-label">Roof Type</label>
                      <select
                        id="roof-type-select"
                        className="form-select"
                        value={currentRoof.type || 'flat'}
                        onChange={handleRoofTypeChange}>
                        <option value="flat">Flat Roof (Slab)</option>
                        <option value="gable">Hip Roof (Pitched)</option>
                      </select>
                    </div>
                  )}

                  {/* Ridge Height slider — continuous: uses three-phase */}
                  {currentRoof.enabled && currentRoof.type === 'gable' && (
                    <RangeRow
                      label="Ridge Height"
                      displayValue={`${(currentRoof.height || 1.5).toFixed(1)} m`}
                      value={currentRoof.height || 1.5}
                      min="0.5" max="3.5" step="0.1"
                      onSnapshot={() => onRoofHeightStart && onRoofHeightStart()}
                      onChange={(val) =>
                        onUpdateRoomRoofHeight && onUpdateRoomRoofHeight(
                          selectedLoop.id, { ...currentRoof, height: parseFloat(val) }
                        )
                      }
                      onCommit={(val) =>
                        onCommitRoofHeight && onCommitRoofHeight(
                          selectedLoop.id, { ...currentRoof, height: parseFloat(val) }
                        )
                      }
                      hints={<><span>Low (0.5m)</span><span>Steep (3.5m)</span></>}
                    />
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

          {/* ============================================================
              TAB: Materials
          ============================================================ */}
          {activeTab === 'materials' && (
            <div className="sidebar-section">

              {!selectedWall && !selectedLoop && (
                <div className="info-card context-hint">
                  <AlertTriangle size={14} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                  <p className="text-sm text-muted">
                    Select a <strong>wall</strong> to edit its individual material, or select a <strong>closed structure</strong> to edit its roof material.
                  </p>
                </div>
              )}

              {/* ---- Selected Wall ---- */}
              {selectedWall && (
                <>
                  <div className="section-title">
                    <Square size={14} /><span>Selected Wall</span>
                  </div>
                  <div className="info-card mb-2">
                    <p className="text-xs text-muted">Changes below only affect <strong>this wall</strong>.</p>
                  </div>

                  {/* Wall preset dropdown (discrete) */}
                  <PresetSelect
                    label="Wall Preset"
                    value={wallMatPreset}
                    onChange={(val) => onCommitWallMaterial && onCommitWallMaterial(selectedWall.id, { preset: val })}
                    options={WALL_PRESETS}
                  />

                  {/* Wall color picker (continuous) */}
                  <ColorRow
                    label="Wall Color"
                    value={wallMatColor}
                    onSnapshot={() => onWallMatStart && onWallMatStart()}
                    onChange={(color) => onUpdateWallMaterial && onUpdateWallMaterial(selectedWall.id, { color })}
                    onCommit={(color) => onCommitWallMaterial && onCommitWallMaterial(selectedWall.id, { color })}
                  />

                  {/* Wall height slider (continuous) */}
                  <RangeRow
                    label="Height"
                    displayValue={`${wallHeight.toFixed(1)} m`}
                    value={wallHeight}
                    min="1" max="6" step="0.1"
                    onSnapshot={() => onWallDimStart && onWallDimStart()}
                    onChange={(val) => onUpdateWallDimensions && onUpdateWallDimensions(selectedWall.id, { height: parseFloat(val) })}
                    onCommit={(val) => onCommitWallDimensions && onCommitWallDimensions(selectedWall.id, { height: parseFloat(val) })}
                    hints={<><span>1 m</span><span>6 m</span></>}
                  />

                  {/* Wall thickness slider (continuous) */}
                  <RangeRow
                    label="Thickness"
                    displayValue={`${wallThickness.toFixed(2)} m`}
                    value={wallThickness}
                    min="0.05" max="0.5" step="0.01"
                    onSnapshot={() => onWallDimStart && onWallDimStart()}
                    onChange={(val) => onUpdateWallDimensions && onUpdateWallDimensions(selectedWall.id, { thickness: parseFloat(val) })}
                    onCommit={(val) => onCommitWallDimensions && onCommitWallDimensions(selectedWall.id, { thickness: parseFloat(val) })}
                    hints={<><span>5 cm</span><span>50 cm</span></>}
                  />

                  <button
                    className="btn btn-secondary apply-all-btn"
                    onClick={() => onApplyWallMaterialToAll && onApplyWallMaterialToAll({ color: wallMatColor, preset: wallMatPreset })}
                    title="Apply this wall's color and preset to every wall, and update the global default">
                    Apply to all walls
                  </button>
                  <div className="section-divider" />
                </>
              )}

              {/* ---- Selected Roof ---- */}
              {selectedLoop && (
                <>
                  <div className="section-title">
                    <Layers size={14} /><span>Selected Roof</span>
                  </div>

                  {!currentRoof.enabled ? (
                    <div className="info-card mb-2">
                      <p className="text-sm text-muted">
                        No roof on this structure. Switch to the Structure tab and click "Add Roof" first.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="info-card mb-2">
                        <p className="text-xs text-muted">Changes below only affect <strong>this roof</strong>.</p>
                      </div>

                      {/* Roof preset dropdown (discrete) */}
                      <PresetSelect
                        label="Roof Preset"
                        value={roofPreset}
                        onChange={(val) => onCommitRoofMaterial && onCommitRoofMaterial(selectedLoop.id, { preset: val })}
                        options={ROOF_PRESETS}
                      />

                      {/* Roof color picker (continuous) */}
                      <ColorRow
                        label="Roof Color"
                        value={roofColor}
                        onSnapshot={() => onRoofMatStart && onRoofMatStart()}
                        onChange={(color) => onUpdateRoomRoofMaterial && onUpdateRoomRoofMaterial(selectedLoop.id, { color })}
                        onCommit={(color) => onCommitRoofMaterial && onCommitRoofMaterial(selectedLoop.id, { color })}
                      />

                      <button
                        className="btn btn-secondary apply-all-btn"
                        onClick={() => onApplyRoofMaterialToAll && onApplyRoofMaterialToAll({ color: roofColor, preset: roofPreset })}
                        title="Apply this roof's color and preset to every roof, and update the global default">
                        Apply to all roofs
                      </button>
                    </>
                  )}

                  {/* Floor color (continuous) */}
                  <div className="section-divider" />
                  <div className="section-title">
                    <Palette size={14} /><span>Floor Color</span>
                  </div>
                  <ColorRow
                    label="Floor Color"
                    value={currentFloorColor}
                    onSnapshot={() => onFloorColorStart && onFloorColorStart()}
                    onChange={(color) => onUpdateRoomFloor && onUpdateRoomFloor(selectedLoop.id, color)}
                    onCommit={(color) => onCommitRoomFloor && onCommitRoomFloor(selectedLoop.id, color)}
                  />
                  <div className="section-divider" />
                </>
              )}

              {/* ---- Global Defaults ---- */}
              <div className="section-title">
                <Palette size={16} /><span>Global Defaults</span>
              </div>
              <div className="info-card mb-2">
                <p className="text-xs text-muted">
                  These are the defaults used when creating <strong>new</strong> walls and roofs. They do not change existing ones.
                </p>
              </div>

              <div className="subsection-label">New Wall Default</div>
              {/* Wall preset (discrete) */}
              <PresetSelect
                label="Preset"
                value={materials.wallPreset || 'plain'}
                onChange={(val) => onCommitMaterials && onCommitMaterials({ wallPreset: val })}
                options={WALL_PRESETS}
              />
              {/* Wall color (continuous) */}
              <ColorRow
                label="Color"
                value={materials.wallColor || '#d6c2a1'}
                onSnapshot={() => onGlobalMatStart && onGlobalMatStart()}
                onChange={(color) => onUpdateMaterials && onUpdateMaterials({ wallColor: color })}
                onCommit={(color) => onCommitMaterials && onCommitMaterials({ wallColor: color })}
              />

              <div className="section-divider" />

              <div className="subsection-label">New Roof Default</div>
              {/* Roof preset (discrete) */}
              <PresetSelect
                label="Preset"
                value={materials.roofPreset || 'plain'}
                onChange={(val) => onCommitMaterials && onCommitMaterials({ roofPreset: val })}
                options={ROOF_PRESETS}
              />
              {/* Roof color (continuous) */}
              <ColorRow
                label="Color"
                value={materials.roofColor || '#555555'}
                onSnapshot={() => onGlobalMatStart && onGlobalMatStart()}
                onChange={(color) => onUpdateMaterials && onUpdateMaterials({ roofColor: color })}
                onCommit={(color) => onCommitMaterials && onCommitMaterials({ roofColor: color })}
              />

              <div className="section-divider" />

              <div className="subsection-label">Doors (global)</div>
              <ColorRow
                label="Frame Color"
                value={materials.doorFrameColor || '#4b2e1e'}
                onSnapshot={() => onGlobalMatStart && onGlobalMatStart()}
                onChange={(color) => onUpdateMaterials && onUpdateMaterials({ doorFrameColor: color })}
                onCommit={(color) => onCommitMaterials && onCommitMaterials({ doorFrameColor: color })}
              />
              <ColorRow
                label="Panel Color"
                value={materials.doorPanelColor || '#8b5a2b'}
                onSnapshot={() => onGlobalMatStart && onGlobalMatStart()}
                onChange={(color) => onUpdateMaterials && onUpdateMaterials({ doorPanelColor: color })}
                onCommit={(color) => onCommitMaterials && onCommitMaterials({ doorPanelColor: color })}
              />

              <div className="section-divider" />

              <div className="subsection-label">Windows (global)</div>
              <ColorRow
                label="Frame Color"
                value={materials.windowFrameColor || '#eeeeee'}
                onSnapshot={() => onGlobalMatStart && onGlobalMatStart()}
                onChange={(color) => onUpdateMaterials && onUpdateMaterials({ windowFrameColor: color })}
                onCommit={(color) => onCommitMaterials && onCommitMaterials({ windowFrameColor: color })}
              />
              <ColorRow
                label="Glass Color"
                value={materials.windowGlassColor || '#78c7e8'}
                onSnapshot={() => onGlobalMatStart && onGlobalMatStart()}
                onChange={(color) => onUpdateMaterials && onUpdateMaterials({ windowGlassColor: color })}
                onCommit={(color) => onCommitMaterials && onCommitMaterials({ windowGlassColor: color })}
              />

            </div>
          )}

          {/* ============================================================
              TAB: Furniture
          ============================================================ */}
          {activeTab === 'furniture' && (
            <div className="sidebar-section">
              <div className="section-title">
                <Box size={16} /><span>Furniture</span>
              </div>

              <div className={`status-badge ${mode === 'furniture' ? 'status-success' : 'status-warning'}`}>
                {mode === 'furniture' ? (
                  <><CheckCircle2 size={14} /><span>Click inside a room to place</span></>
                ) : (
                  <><AlertCircle size={14} /><span>Select a type below to start placing</span></>
                )}
              </div>

              {/* Catalog */}
              <div className="furniture-catalog">
                {Object.entries(FURNITURE_CATALOG).map(([type, cat]) => {
                  const isActive = mode === 'furniture' && selectedFurnitureType === type;
                  return (
                    <button
                      key={type}
                      id={`furn-catalog-${type}`}
                      className={`furniture-catalog-btn ${isActive ? 'furniture-catalog-btn-active' : ''}`}
                      onClick={() => onSelectFurnitureType && onSelectFurnitureType(type)}
                      title={`Place ${cat.label} (${cat.footprintW}m × ${cat.footprintD}m)`}>
                      <span className="furniture-color-chip" style={{ background: cat.color }} />
                      <span className="furniture-catalog-label">{cat.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="info-card" style={{ marginTop: '0.75rem' }}>
                <p className="text-sm text-muted">
                  In Select mode: drag to move, <kbd>R</kbd> to rotate 15°, drag the purple handle for free rotation, <kbd>Del</kbd> to delete.
                </p>
              </div>

              {/* Selected furniture panel */}
              {selectedFurniture && (
                <>
                  <div className="section-divider" />
                  <div className="subsection-label">
                    Selected — {FURNITURE_CATALOG[selectedFurniture.type]?.label || selectedFurniture.type}
                  </div>
                  <div className="info-card mb-2">
                    <p className="text-sm">
                      Rotation: <strong>{Math.round(selectedFurniture.rotation ?? 0)}°</strong>
                    </p>
                  </div>

                  {/* Furniture color picker (continuous) */}
                  <ColorRow
                    label="Color"
                    value={selectedFurniture.color || FURNITURE_CATALOG[selectedFurniture.type]?.color || '#888888'}
                    onSnapshot={() => onFurnColorStart && onFurnColorStart()}
                    onChange={(color) => onUpdateFurnitureColor && onUpdateFurnitureColor(selectedFurniture.id, color)}
                    onCommit={(color) => onCommitFurnitureColor && onCommitFurnitureColor(selectedFurniture.id, color)}
                  />

                  {/* Scale slider (continuous) */}
                  <div className="form-group">
                    <label className="form-label">
                      Size (scale): <strong>{((selectedFurniture.scale ?? 1.0) * 100).toFixed(0)}%</strong>
                    </label>
                    <input
                      type="range"
                      min="0.8" max="1.5" step="0.05"
                      value={selectedFurniture.scale ?? 1.0}
                      style={{ width: '100%', accentColor: '#a78bfa' }}
                      onMouseDown={() => onFurnScaleStart && onFurnScaleStart()}
                      onChange={(e) => onUpdateFurnitureScale && onUpdateFurnitureScale(selectedFurniture.id, e.target.value)}
                      onMouseUp={(e) => onCommitFurnitureScale && onCommitFurnitureScale(selectedFurniture.id, e.target.value)}
                      onPointerUp={(e) => onCommitFurnitureScale && onCommitFurnitureScale(selectedFurniture.id, e.target.value)}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8' }}>
                      <span>80%</span><span>100%</span><span>150%</span>
                    </div>
                  </div>

                  {/* Snap rotation toggle (discrete — checkbox) */}
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      id="snap-rotation-toggle"
                      type="checkbox"
                      checked={snapRotation}
                      onChange={onToggleSnapRotation}
                      style={{ accentColor: 'var(--accent-primary)', width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <label htmlFor="snap-rotation-toggle" className="form-label" style={{ marginBottom: 0, cursor: 'pointer' }}>
                      Snap rotation to 15°
                    </label>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ============================================================
              TAB: Stairs
          ============================================================ */}
          {activeTab === 'stairs' && (
            <div className="sidebar-section">
              <div className="section-title">
                <ListOrdered size={16} /><span>Stairs</span>
              </div>

              {activeFloorIndex >= totalFloors - 1 ? (
                <div className="info-card status-warning mb-2">
                  <AlertCircle size={14} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} />
                  <p className="text-sm">
                    <strong>Cannot place stairs here.</strong><br/>
                    Add another floor above this floor before placing stairs.
                  </p>
                </div>
              ) : (
                <>
                  <div className={`status-badge ${mode === 'stairs' ? 'status-success' : 'status-warning'}`}>
                    {mode === 'stairs' ? (
                      <><CheckCircle2 size={14} /><span>Click inside a room to place stairs</span></>
                    ) : (
                      <><AlertCircle size={14} /><span>Select a type below to start placing</span></>
                    )}
                  </div>

                  {/* Segmented Stair Shape Selector */}
                  <div className="seg-pill-control mb-3" role="group" aria-label="Select Stair Shape">
                    {Object.entries(STAIR_CATALOG).map(([type, cat]) => {
                      const isActive = mode === 'stairs' && selectedStairType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          id={`stair-catalog-${type}`}
                          className={`seg-pill-btn ${isActive ? 'active' : ''}`}
                          onClick={() => onSelectStairType && onSelectStairType(type)}
                          title={`Place ${cat.label} Stairs`}
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="info-card" style={{ marginTop: '0.75rem' }}>
                    <p className="text-sm text-muted">
                      In Select mode: drag to move, drag the rotation handle, <kbd>Del</kbd> to delete.
                    </p>
                  </div>
                </>
              )}

              {/* Selected Stair Panel */}
              {selectedStair && (
                <>
                  <div className="section-divider" />
                  <div className="subsection-label">
                    Selected — {STAIR_CATALOG[selectedStair.type]?.label || selectedStair.type} Stairs
                  </div>
                  <div className="info-card mb-2">
                    <p className="text-sm">
                      Rotation: <strong>{Math.round(selectedStair.rotation ?? 0)}°</strong>
                    </p>
                  </div>

                  {/* Stair Type Segmented Control */}
                  <div className="form-group">
                    <label className="form-label">Stair Shape</label>
                    <div className="seg-pill-control" role="group" aria-label="Stair Shape">
                      {Object.entries(STAIR_CATALOG).map(([type, cat]) => {
                        const isSelected = selectedStair.type === type;
                        return (
                          <button
                            key={type}
                            type="button"
                            className={`seg-pill-btn ${isSelected ? 'active' : ''}`}
                            onClick={() => onCommitStairDimensions && onCommitStairDimensions(selectedStair.id, { type })}
                          >
                            {cat.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Turn Direction (only for L/U) */}
                  {(selectedStair.type === 'l_shape' || selectedStair.type === 'u_shape') && (
                    <div className="form-group">
                      <label className="form-label">Turn Direction</label>
                      <div className="seg-pill-control" role="group" aria-label="Turn Direction">
                        <button
                          type="button"
                          className={`seg-pill-btn ${selectedStair.turnDirection === 'left' ? 'active' : ''}`}
                          onClick={() => onStairTurnChange && onStairTurnChange(selectedStair.id, 'left')}
                        >
                          Turn Left
                        </button>
                        <button
                          type="button"
                          className={`seg-pill-btn ${selectedStair.turnDirection === 'right' ? 'active' : ''}`}
                          onClick={() => onStairTurnChange && onStairTurnChange(selectedStair.id, 'right')}
                        >
                          Turn Right
                        </button>
                      </div>
                    </div>
                  )}

                  <ColorRow
                    label="Color"
                    value={selectedStair.color || '#8b6b45'}
                    onSnapshot={() => onStairColorStart && onStairColorStart()}
                    onChange={(color) => onUpdateStairColor && onUpdateStairColor(selectedStair.id, color)}
                    onCommit={(color) => onCommitStairColor && onCommitStairColor(selectedStair.id, color)}
                  />

                  <RangeRow
                    label="Width"
                    displayValue={`${(selectedStair.width ?? 1.0).toFixed(2)} m`}
                    value={selectedStair.width ?? 1.0}
                    min="0.6" max="2.0" step="0.05"
                    onSnapshot={() => onStairDimStart && onStairDimStart()}
                    onChange={(val) => onUpdateStairDimensions && onUpdateStairDimensions(selectedStair.id, { width: parseFloat(val) })}
                    onCommit={(val) => onCommitStairDimensions && onCommitStairDimensions(selectedStair.id, { width: parseFloat(val) })}
                    hints={<><span>0.6m</span><span>2.0m</span></>}
                  />

                  <RangeRow
                    label="Run"
                    displayValue={`${(selectedStair.run ?? 3.0).toFixed(2)} m`}
                    value={selectedStair.run ?? 3.0}
                    min="1.0" max="6.0" step="0.1"
                    onSnapshot={() => onStairDimStart && onStairDimStart()}
                    onChange={(val) => onUpdateStairDimensions && onUpdateStairDimensions(selectedStair.id, { run: parseFloat(val) })}
                    onCommit={(val) => onCommitStairDimensions && onCommitStairDimensions(selectedStair.id, { run: parseFloat(val) })}
                    hints={<><span>1.0m</span><span>6.0m</span></>}
                  />

                  {(selectedStair.type === 'l_shape' || selectedStair.type === 'u_shape') && (
                    <RangeRow
                      label="Landing"
                      displayValue={`${(selectedStair.landingLength ?? 1.0).toFixed(2)} m`}
                      value={selectedStair.landingLength ?? 1.0}
                      min="0.5" max="2.0" step="0.05"
                      onSnapshot={() => onStairDimStart && onStairDimStart()}
                      onChange={(val) => onUpdateStairDimensions && onUpdateStairDimensions(selectedStair.id, { landingLength: parseFloat(val) })}
                      onCommit={(val) => onCommitStairDimensions && onCommitStairDimensions(selectedStair.id, { landingLength: parseFloat(val) })}
                      hints={<><span>0.5m</span><span>2.0m</span></>}
                    />
                  )}

                  {/* Step Count and Riser Height info */}
                  <RangeRow
                    label="Step Count"
                    displayValue={`${selectedStair.stepCount ?? calculateStepCount(floorHeight)}`}
                    value={selectedStair.stepCount ?? calculateStepCount(floorHeight)}
                    min="10" max="30" step="1"
                    onSnapshot={() => onStairDimStart && onStairDimStart()}
                    onChange={(val) => onUpdateStairDimensions && onUpdateStairDimensions(selectedStair.id, { stepCount: parseInt(val, 10) })}
                    onCommit={(val) => onCommitStairDimensions && onCommitStairDimensions(selectedStair.id, { stepCount: parseInt(val, 10) })}
                    hints={<><span>10</span><span>30</span></>}
                  />
                  <div className="info-card mb-2 mt-1">
                    <p className="text-sm">
                      Floor-to-floor: <strong>{floorHeight.toFixed(2)} m</strong><br/>
                      Calculated Riser: <strong>{((floorHeight * 100) / (selectedStair.stepCount ?? calculateStepCount(floorHeight))).toFixed(1)} cm</strong>
                    </p>
                  </div>

                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                    <input
                      id="snap-rotation-toggle-stairs"
                      type="checkbox"
                      checked={snapRotation}
                      onChange={onToggleSnapRotation}
                      style={{ accentColor: '#a78bfa', width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <label htmlFor="snap-rotation-toggle-stairs" className="form-label" style={{ marginBottom: 0, cursor: 'pointer' }}>
                      Snap rotation to 15°
                    </label>
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      )}
    </aside>
  );
}
