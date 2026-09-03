import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Header from './components/Header';
import Toolbar from './components/Toolbar';
import FloorBar from './components/FloorBar';
import Sidebar from './components/Sidebar';
import Canvas2D from './components/Canvas2D';
import View3D from './components/View3D';
import DebugPanel from './components/DebugPanel';
import useHistory from './hooks/useHistory';
import { findClosedLoops } from './utils/geometry';
import { FURNITURE_CATALOG } from './utils/furniture';
import {
  DEFAULT_MATERIALS,
  makeEmptyFloor,
  migrateToFloors,
  updateFloorInDesign,
  getFloorBaseY,
  defaultFloorLabel,
} from './utils/floors';
import { computeFloorValidations } from './utils/validation';
import './index.css';

// ---------------------------------------------------------------------------
// Initial design — a single Ground Floor with empty content.
// ---------------------------------------------------------------------------
const INITIAL_DESIGN = migrateToFloors(null); // { floors: [{ id:'floor-0', label:'Ground Floor', ... }] }

// ---------------------------------------------------------------------------
// App — root component.
//
// State layout:
//   useHistory manages `design = { floors: [{ id, label, walls, doors, windows,
//                                             rooms, materials, furniture }] }`.
//   `activeFloorId` and `showAllFloors` are plain useState — not undoable.
//   All mutations write into the active floor via updateFloorInDesign().
//
// Undo/redo pattern for continuous interactions (drag, slider, color picker):
//   1. onXxxStart  — save `design` into snapRef (the "before" snapshot)
//   2. onXxxLive   — call setStateOnly(newDesign) — no history entry
//   3. onXxxCommit — call pushState(newDesign, snapshot) — single undo entry
//
// Discrete actions (add, delete, place, toggle, R-key, dropdown) call
// pushState(newDesign) directly — unchanged.
// ---------------------------------------------------------------------------
function App() {
  // ---- History-managed design state ----
  const {
    state: design,
    pushState,
    setStateOnly,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
  } = useHistory(INITIAL_DESIGN);

  // ---- UI state (not part of the design model) ----
  const [activeFloorId, setActiveFloorId]   = useState('floor-0');
  const [showAllFloors, setShowAllFloors]    = useState(false);
  const [mode, setMode]                      = useState('wall');
  const [selectedId, setSelectedId]          = useState(null);
  const [sidebarOpen, setSidebarOpen]        = useState(true);
  const [selectedFurnitureType, setSelectedFurnitureType] = useState('bed');
  const [selectedStairType, setSelectedStairType] = useState('straight');
  const [snapRotation, setSnapRotation]      = useState(true);

  // ---- Interaction snapshots — saved at drag/interaction START ----
  const snapRef = useRef(null);

  // ---- Migration effect: wrap old flat saves into floors format ----
  useEffect(() => {
    if (design && !Array.isArray(design.floors)) {
      // Legacy flat design detected — migrate it.
      const migrated = migrateToFloors(design);
      pushState(migrated);
      setActiveFloorId(migrated.floors[0].id);
    }
  }, []); // run once on mount only

  // ---- Legacy roof migration (within any floor) ----
  // If an old design had a global `roof` key on a floor, migrate it to `rooms`.
  useEffect(() => {
    if (!design || !Array.isArray(design.floors)) return;
    const needsMigration = design.floors.some((f) => f.roof !== undefined);
    if (!needsMigration) return;
    const newFloors = design.floors.map((f) => {
      if (f.roof === undefined) return f;
      const loops = findClosedLoops(f.walls || []);
      const migratedRooms = loops.map((loop) => ({ id: loop.id, roof: { ...f.roof } }));
      const { roof: _removed, ...rest } = f;
      return { ...rest, rooms: migratedRooms };
    });
    pushState({ ...design, floors: newFloors });
  }, [design, pushState]);

  // ---- Keep activeFloorId valid: if the active floor was deleted, fall back ----
  useEffect(() => {
    if (!design || !Array.isArray(design.floors)) return;
    const exists = design.floors.some((f) => f.id === activeFloorId);
    if (!exists && design.floors.length > 0) {
      setActiveFloorId(design.floors[0].id);
    }
  }, [design, activeFloorId]);

  // ---- Active floor — the floor currently being edited ----
  const activeFloor = useMemo(() => {
    if (!design || !Array.isArray(design.floors)) return null;
    return design.floors.find((f) => f.id === activeFloorId) || design.floors[0] || null;
  }, [design, activeFloorId]);

  // ---- Convenience: active floor's arrays ----
  const walls     = activeFloor?.walls     || [];
  const doors     = activeFloor?.doors     || [];
  const windows   = activeFloor?.windows   || [];
  const rooms     = activeFloor?.rooms     || [];
  const furniture = activeFloor?.furniture || [];
  const stairs    = activeFloor?.stairs    || [];

  // Compute closed loops from the active floor's walls
  const closedLoops = useMemo(() => findClosedLoops(walls), [walls]);

  // ---- Below-floor data: the floor directly beneath the active one ----
  const activeFloorIndex = useMemo(
    () => (design?.floors || []).findIndex((f) => f.id === activeFloorId),
    [design, activeFloorId]
  );
  const belowFloor = useMemo(
    () => (activeFloorIndex > 0 ? (design?.floors || [])[activeFloorIndex - 1] : null),
    [design, activeFloorIndex]
  );
  const belowFloorWalls = belowFloor?.walls || [];
  const belowFloorLoops = useMemo(
    () => (belowFloor ? findClosedLoops(belowFloor.walls || []) : []),
    [belowFloor]
  );

  // Materials for the active floor (per-floor, with defaults filled in)
  const materials = useMemo(
    () => ({ ...DEFAULT_MATERIALS, ...(activeFloor?.materials || {}) }),
    [activeFloor?.materials]
  );

  // ---- Helper: build updated design with a patch applied to the active floor ----
  const withActiveFloor = useCallback(
    (patch) => updateFloorInDesign(design, activeFloorId, patch),
    [design, activeFloorId]
  );

  // -----------------------------------------------------------------------
  // FLOOR management handlers (undoable add/delete)
  // -----------------------------------------------------------------------

  /** Add a new empty floor above the current highest. */
  const handleAddFloor = useCallback(() => {
    const floors = design.floors || [];

    // ---- Gate: top floor must have at least one closed structure with a roof ----
    const topFloor = floors[floors.length - 1];
    if (topFloor) {
      const topLoops = findClosedLoops(topFloor.walls || []);
      const topRooms = topFloor.rooms || [];
      const hasRoof = topLoops.some((loop) => {
        const room = topRooms.find((r) => r.id === loop.id);
        return room?.roof?.enabled === true;
      });
      if (!hasRoof) {
        alert(
          `Cannot add a new floor: "${topFloor.label}" has no closed structure with a roof/ceiling enabled.\n\n` +
          'Draw walls to form at least one closed room, then enable a roof on it before building the next floor.'
        );
        return;
      }
    }

    const newIndex = floors.length;
    const label = defaultFloorLabel(newIndex);
    const newFloor = makeEmptyFloor(label);
    const newDesign = { ...design, floors: [...floors, newFloor] };
    pushState(newDesign);
    setActiveFloorId(newFloor.id);
  }, [design, pushState]);

  /** Delete a floor by id (must not be the last remaining floor). */
  const handleDeleteFloor = useCallback((floorId) => {
    const floors = design.floors || [];
    if (floors.length <= 1) return; // prevent deleting last floor
    const newFloors = floors.filter((f) => f.id !== floorId).map(f => {
      // Remove any stairs on this floor that went to the deleted floor
      if (f.stairs) {
        return { ...f, stairs: f.stairs.filter(s => s.toFloorId !== floorId) };
      }
      return f;
    });
    pushState({ ...design, floors: newFloors });
    // activeFloorId is updated by the useEffect above
  }, [design, pushState]);

  // -----------------------------------------------------------------------
  // DISCRETE handlers — each calls pushState once, no snapshot needed.
  // (All now scoped to the active floor via withActiveFloor())
  // -----------------------------------------------------------------------

  /** Add a newly drawn wall — stamps per-wall material from current global defaults */
  const handleAddWall = useCallback((wallData) => {
    const newWall = {
      ...wallData,
      id: `wall-${Date.now()}`,
      material: {
        color: materials.wallColor,
        preset: materials.wallPreset,
      },
    };
    pushState(withActiveFloor({ walls: [...walls, newWall] }));
  }, [withActiveFloor, walls, materials, pushState]);

  /** Add a door onto a wall */
  const handleAddDoor = useCallback((doorData) => {
    const newDoor = { ...doorData, id: `door-${Date.now()}`, isOpen: doorData.isOpen ?? false };
    pushState(withActiveFloor({ doors: [...doors, newDoor] }));
  }, [withActiveFloor, doors, pushState]);

  /** Add a window onto a wall */
  const handleAddWindow = useCallback((windowData) => {
    const newWindow = { ...windowData, id: `window-${Date.now()}` };
    pushState(withActiveFloor({ windows: [...windows, newWindow] }));
  }, [withActiveFloor, windows, pushState]);

  /** Update roof settings for a specific room (toggle, type change — discrete) */
  const handleUpdateRoomRoof = useCallback((roomId, roofData) => {
    const existingRoom = rooms.find((r) => r.id === roomId);
    const newRooms = existingRoom
      ? rooms.map((r) => (r.id === roomId ? { ...r, roof: roofData } : r))
      : [...rooms, { id: roomId, roof: roofData }];
    pushState(withActiveFloor({ rooms: newRooms }));
  }, [withActiveFloor, rooms, pushState]);

  /** Apply a material patch to ALL walls AND update the active floor's global default */
  const handleApplyWallMaterialToAll = useCallback((patch) => {
    pushState(withActiveFloor({
      materials: { ...materials, ...patch },
      walls: walls.map((w) => ({ ...w, material: { ...(w.material || {}), ...patch } })),
    }));
  }, [withActiveFloor, walls, materials, pushState]);

  /** Apply roof material patch to ALL rooms AND update global defaults */
  const handleApplyRoofMaterialToAll = useCallback((patch) => {
    pushState(withActiveFloor({
      materials: { ...materials, ...patch },
      rooms: rooms.map((r) => ({ ...r, roof: { ...(r.roof || {}), ...patch } })),
    }));
  }, [withActiveFloor, rooms, materials, pushState]);

  /** Place a new furniture item */
  const handleAddFurniture = useCallback((data) => {
    const item = { scale: 1.0, rotation: 0, ...data, id: `furn-${Date.now()}` };
    pushState(withActiveFloor({ furniture: [...furniture, item] }));
  }, [withActiveFloor, furniture, pushState]);

  /** Place a new stair */
  const handleAddStair = useCallback((data) => {
    const floors = design.floors || [];
    const activeIndex = floors.findIndex(f => f.id === activeFloorId);
    if (activeIndex >= floors.length - 1) return; // Topmost check
    const toFloorId = floors[activeIndex + 1].id;
    const item = { ...data, id: `stair-${Date.now()}`, fromFloorId: activeFloorId, toFloorId };
    pushState(withActiveFloor({ stairs: [...stairs, item] }));
  }, [design, activeFloorId, withActiveFloor, stairs, pushState]);

  /** Toggle a door open / closed */
  const handleToggleDoor = useCallback((doorId) => {
    pushState(withActiveFloor({
      doors: doors.map((d) => d.id === doorId ? { ...d, isOpen: !d.isOpen } : d),
    }));
  }, [withActiveFloor, doors, pushState]);

  /** Rotate a furniture item by 15° clockwise — keyboard shortcut (R key). */
  const handleRotateFurniture = useCallback((id) => {
    pushState(withActiveFloor({
      furniture: furniture.map((f) =>
        f.id === id ? { ...f, rotation: (((f.rotation ?? 0) + 15) % 360 + 360) % 360 } : f
      ),
    }));
  }, [withActiveFloor, furniture, pushState]);

  /** Rotate a stair by 15° clockwise — keyboard shortcut (R key). */
  const handleRotateStair = useCallback((id) => {
    pushState(withActiveFloor({
      stairs: stairs.map((s) =>
        s.id === id ? { ...s, rotation: (((s.rotation ?? 0) + 15) % 360 + 360) % 360 } : s
      ),
    }));
  }, [withActiveFloor, stairs, pushState]);

  /** Delete whatever is currently selected */
  const handleDeleteSelected = useCallback(() => {
    if (!selectedId) return;

    if (walls.some((w) => w.id === selectedId)) {
      const newWalls = walls.filter((w) => w.id !== selectedId);
      const survivingLoopIds = new Set(findClosedLoops(newWalls).map((l) => l.id));
      pushState(withActiveFloor({
        walls: newWalls,
        doors: doors.filter((d) => d.wallId !== selectedId),
        windows: windows.filter((w) => w.wallId !== selectedId),
        furniture: furniture.filter((f) => survivingLoopIds.has(f.roomId)),
      }));
      setSelectedId(null);
      return;
    }
    if (doors.some((d) => d.id === selectedId)) {
      pushState(withActiveFloor({ doors: doors.filter((d) => d.id !== selectedId) }));
      setSelectedId(null);
      return;
    }
    if (windows.some((w) => w.id === selectedId)) {
      pushState(withActiveFloor({ windows: windows.filter((w) => w.id !== selectedId) }));
      setSelectedId(null);
      return;
    }
    if (furniture.some((f) => f.id === selectedId)) {
      pushState(withActiveFloor({ furniture: furniture.filter((f) => f.id !== selectedId) }));
      setSelectedId(null);
      return;
    }
    if (stairs.some((s) => s.id === selectedId)) {
      pushState(withActiveFloor({ stairs: stairs.filter((s) => s.id !== selectedId) }));
      setSelectedId(null);
      return;
    }
  }, [selectedId, withActiveFloor, walls, doors, windows, furniture, stairs, pushState]);

  /** Clear the entire design and history */
  const handleClear = useCallback(() => {
    reset(INITIAL_DESIGN);
    setActiveFloorId('floor-0');
    setSelectedId(null);
  }, [reset]);

  /** Select (or deselect) a wall, door, window, room, or furniture */
  const handleSelect = useCallback((id) => { setSelectedId(id); }, []);

  /** Activate a furniture type and switch to furniture-placement mode */
  const handleSelectFurnitureType = useCallback((type) => {
    setSelectedFurnitureType(type);
    setMode('furniture');
  }, []);

  /** Activate a stair type and switch to stair-placement mode */
  const handleSelectStairType = useCallback((type) => {
    setSelectedStairType(type);
    setMode('stairs');
  }, []);

  // -----------------------------------------------------------------------
  // CONTINUOUS handlers — three phases: start / live / commit
  // -----------------------------------------------------------------------

  // ----- Furniture: move -----

  const handleFurnMoveStart = useCallback(() => {
    snapRef.current = design;
  }, [design]);

  const handleMoveFurniture = useCallback((id, x, y) => {
    setStateOnly(withActiveFloor({
      furniture: furniture.map((f) => f.id === id ? { ...f, x, y } : f),
    }));
  }, [withActiveFloor, furniture, setStateOnly]);

  const handleCommitMoveFurniture = useCallback((id, x, y) => {
    const snap = snapRef.current;
    snapRef.current = null;
    pushState(withActiveFloor({
      furniture: furniture.map((f) => f.id === id ? { ...f, x, y } : f),
    }), snap);
  }, [withActiveFloor, furniture, pushState]);

  // ----- Furniture: rotate (drag handle) -----

  const handleFurnRotateStart = useCallback(() => {
    snapRef.current = design;
  }, [design]);

  const handleSetFurnitureRotation = useCallback((id, degrees) => {
    const normalized = ((degrees % 360) + 360) % 360;
    setStateOnly(withActiveFloor({
      furniture: furniture.map((f) => f.id === id ? { ...f, rotation: normalized } : f),
    }));
  }, [withActiveFloor, furniture, setStateOnly]);

  const handleCommitFurnitureRotation = useCallback((id, degrees) => {
    const snap = snapRef.current;
    snapRef.current = null;
    const normalized = ((degrees % 360) + 360) % 360;
    pushState(withActiveFloor({
      furniture: furniture.map((f) => f.id === id ? { ...f, rotation: normalized } : f),
    }), snap);
  }, [withActiveFloor, furniture, pushState]);

  // ----- Furniture: scale slider -----

  const handleFurnScaleStart = useCallback(() => {
    snapRef.current = design;
  }, [design]);

  const handleUpdateFurnitureScale = useCallback((id, scale) => {
    const clamped = Math.max(0.8, Math.min(1.5, parseFloat(scale) || 1.0));
    setStateOnly(withActiveFloor({
      furniture: furniture.map((f) => f.id === id ? { ...f, scale: clamped } : f),
    }));
  }, [withActiveFloor, furniture, setStateOnly]);

  const handleCommitFurnitureScale = useCallback((id, scale) => {
    const snap = snapRef.current;
    snapRef.current = null;
    const clamped = Math.max(0.8, Math.min(1.5, parseFloat(scale) || 1.0));
    pushState(withActiveFloor({
      furniture: furniture.map((f) => f.id === id ? { ...f, scale: clamped } : f),
    }), snap);
  }, [withActiveFloor, furniture, pushState]);

  // ----- Furniture: color picker -----

  const handleFurnColorStart = useCallback(() => {
    snapRef.current = design;
  }, [design]);

  const handleUpdateFurnitureColor = useCallback((id, color) => {
    setStateOnly(withActiveFloor({
      furniture: furniture.map((f) => f.id === id ? { ...f, color } : f),
    }));
  }, [withActiveFloor, furniture, setStateOnly]);

  const handleCommitFurnitureColor = useCallback((id, color) => {
    const snap = snapRef.current;
    snapRef.current = null;
    pushState(withActiveFloor({
      furniture: furniture.map((f) => f.id === id ? { ...f, color } : f),
    }), snap);
  }, [withActiveFloor, furniture, pushState]);

  // ----- Stairs: move -----

  const handleStairMoveStart = useCallback(() => {
    snapRef.current = design;
  }, [design]);

  const handleMoveStair = useCallback((id, x, y) => {
    setStateOnly(withActiveFloor({
      stairs: stairs.map((s) => s.id === id ? { ...s, x, y } : s),
    }));
  }, [withActiveFloor, stairs, setStateOnly]);

  const handleCommitMoveStair = useCallback((id, x, y) => {
    const snap = snapRef.current;
    snapRef.current = null;
    pushState(withActiveFloor({
      stairs: stairs.map((s) => s.id === id ? { ...s, x, y } : s),
    }), snap);
  }, [withActiveFloor, stairs, pushState]);

  // ----- Stairs: rotate (drag handle) -----

  const handleStairRotateStart = useCallback(() => {
    snapRef.current = design;
  }, [design]);

  const handleSetStairRotation = useCallback((id, degrees) => {
    const normalized = ((degrees % 360) + 360) % 360;
    setStateOnly(withActiveFloor({
      stairs: stairs.map((s) => s.id === id ? { ...s, rotation: normalized } : s),
    }));
  }, [withActiveFloor, stairs, setStateOnly]);

  const handleCommitStairRotation = useCallback((id, degrees) => {
    const snap = snapRef.current;
    snapRef.current = null;
    const normalized = ((degrees % 360) + 360) % 360;
    pushState(withActiveFloor({
      stairs: stairs.map((s) => s.id === id ? { ...s, rotation: normalized } : s),
    }), snap);
  }, [withActiveFloor, stairs, pushState]);

  // ----- Stairs: dimensions sliders -----

  const handleStairDimStart = useCallback(() => {
    snapRef.current = design;
  }, [design]);

  const handleUpdateStairDimensions = useCallback((id, patch) => {
    setStateOnly(withActiveFloor({
      stairs: stairs.map((s) => s.id === id ? { ...s, ...patch } : s),
    }));
  }, [withActiveFloor, stairs, setStateOnly]);

  const handleCommitStairDimensions = useCallback((id, patch) => {
    const snap = snapRef.current;
    snapRef.current = null;
    pushState(withActiveFloor({
      stairs: stairs.map((s) => s.id === id ? { ...s, ...patch } : s),
    }), snap);
  }, [withActiveFloor, stairs, pushState]);

  // ----- Stairs: color picker -----

  const handleStairColorStart = useCallback(() => {
    snapRef.current = design;
  }, [design]);

  const handleUpdateStairColor = useCallback((id, color) => {
    setStateOnly(withActiveFloor({
      stairs: stairs.map((s) => s.id === id ? { ...s, color } : s),
    }));
  }, [withActiveFloor, stairs, setStateOnly]);

  const handleCommitStairColor = useCallback((id, color) => {
    const snap = snapRef.current;
    snapRef.current = null;
    pushState(withActiveFloor({
      stairs: stairs.map((s) => s.id === id ? { ...s, color } : s),
    }), snap);
  }, [withActiveFloor, stairs, pushState]);

  // ----- Stairs: turn direction (discrete) -----

  const handleStairTurnChange = useCallback((id, direction) => {
    pushState(withActiveFloor({
      stairs: stairs.map((s) => s.id === id ? { ...s, turnDirection: direction } : s),
    }));
  }, [withActiveFloor, stairs, pushState]);

  // ----- Wall: material (color picker) -----

  const handleWallMatStart = useCallback(() => {
    snapRef.current = design;
  }, [design]);

  const handleUpdateWallMaterial = useCallback((wallId, patch) => {
    setStateOnly(withActiveFloor({
      walls: walls.map((w) =>
        w.id === wallId ? { ...w, material: { ...(w.material || {}), ...patch } } : w
      ),
    }));
  }, [withActiveFloor, walls, setStateOnly]);

  const handleCommitWallMaterial = useCallback((wallId, patch) => {
    const snap = snapRef.current;
    snapRef.current = null;
    pushState(withActiveFloor({
      walls: walls.map((w) =>
        w.id === wallId ? { ...w, material: { ...(w.material || {}), ...patch } } : w
      ),
    }), snap);
  }, [withActiveFloor, walls, pushState]);

  // ----- Wall: dimensions sliders (height, thickness) -----

  const handleWallDimStart = useCallback(() => {
    snapRef.current = design;
  }, [design]);

  const handleUpdateWallDimensions = useCallback((wallId, patch) => {
    setStateOnly(withActiveFloor({
      walls: walls.map((w) => w.id === wallId ? { ...w, ...patch } : w),
    }));
  }, [withActiveFloor, walls, setStateOnly]);

  const handleCommitWallDimensions = useCallback((wallId, patch) => {
    const snap = snapRef.current;
    snapRef.current = null;
    pushState(withActiveFloor({
      walls: walls.map((w) => w.id === wallId ? { ...w, ...patch } : w),
    }), snap);
  }, [withActiveFloor, walls, pushState]);

  // ----- Roof: material (color picker) — per room -----

  const handleRoofMatStart = useCallback(() => {
    snapRef.current = design;
  }, [design]);

  const handleUpdateRoomRoofMaterial = useCallback((roomId, patch) => {
    const existingRoom = rooms.find((r) => r.id === roomId);
    const newRooms = existingRoom
      ? rooms.map((r) => r.id === roomId ? { ...r, roof: { ...(r.roof || {}), ...patch } } : r)
      : [...rooms, { id: roomId, roof: { ...patch } }];
    setStateOnly(withActiveFloor({ rooms: newRooms }));
  }, [withActiveFloor, rooms, setStateOnly]);

  const handleCommitRoofMaterial = useCallback((roomId, patch) => {
    const snap = snapRef.current;
    snapRef.current = null;
    const existingRoom = rooms.find((r) => r.id === roomId);
    const newRooms = existingRoom
      ? rooms.map((r) => r.id === roomId ? { ...r, roof: { ...(r.roof || {}), ...patch } } : r)
      : [...rooms, { id: roomId, roof: { ...patch } }];
    pushState(withActiveFloor({ rooms: newRooms }), snap);
  }, [withActiveFloor, rooms, pushState]);

  // ----- Roof: height slider -----

  const handleRoofHeightStart = useCallback(() => {
    snapRef.current = design;
  }, [design]);

  const handleUpdateRoomRoofHeight = useCallback((roomId, roofData) => {
    const existingRoom = rooms.find((r) => r.id === roomId);
    const newRooms = existingRoom
      ? rooms.map((r) => r.id === roomId ? { ...r, roof: roofData } : r)
      : [...rooms, { id: roomId, roof: roofData }];
    setStateOnly(withActiveFloor({ rooms: newRooms }));
  }, [withActiveFloor, rooms, setStateOnly]);

  const handleCommitRoofHeight = useCallback((roomId, roofData) => {
    const snap = snapRef.current;
    snapRef.current = null;
    const existingRoom = rooms.find((r) => r.id === roomId);
    const newRooms = existingRoom
      ? rooms.map((r) => r.id === roomId ? { ...r, roof: roofData } : r)
      : [...rooms, { id: roomId, roof: roofData }];
    pushState(withActiveFloor({ rooms: newRooms }), snap);
  }, [withActiveFloor, rooms, pushState]);

  // ----- Floor: color picker — per room -----

  const handleFloorColorStart = useCallback(() => {
    snapRef.current = design;
  }, [design]);

  const handleUpdateRoomFloor = useCallback((roomId, floorColor) => {
    const existingRoom = rooms.find((r) => r.id === roomId);
    const newRooms = existingRoom
      ? rooms.map((r) => r.id === roomId ? { ...r, floorColor } : r)
      : [...rooms, { id: roomId, floorColor }];
    setStateOnly(withActiveFloor({ rooms: newRooms }));
  }, [withActiveFloor, rooms, setStateOnly]);

  const handleCommitRoomFloor = useCallback((roomId, floorColor) => {
    const snap = snapRef.current;
    snapRef.current = null;
    const existingRoom = rooms.find((r) => r.id === roomId);
    const newRooms = existingRoom
      ? rooms.map((r) => r.id === roomId ? { ...r, floorColor } : r)
      : [...rooms, { id: roomId, floorColor }];
    pushState(withActiveFloor({ rooms: newRooms }), snap);
  }, [withActiveFloor, rooms, pushState]);

  // ----- Global materials: color pickers (per active floor) -----

  const handleGlobalMatStart = useCallback(() => {
    snapRef.current = design;
  }, [design]);

  const handleUpdateMaterials = useCallback((patch) => {
    setStateOnly(withActiveFloor({ materials: { ...materials, ...patch } }));
  }, [withActiveFloor, materials, setStateOnly]);

  const handleCommitMaterials = useCallback((patch) => {
    const snap = snapRef.current;
    snapRef.current = null;
    pushState(withActiveFloor({ materials: { ...materials, ...patch } }), snap);
  }, [withActiveFloor, materials, pushState]);

  // ----- Door: slide along wall -----

  const handleDoorMoveStart = useCallback(() => {
    snapRef.current = design;
  }, [design]);

  const handleMoveDoor = useCallback((doorId, newPosition) => {
    setStateOnly(withActiveFloor({
      doors: doors.map((d) => d.id === doorId ? { ...d, position: newPosition } : d),
    }));
  }, [withActiveFloor, doors, setStateOnly]);

  const handleCommitMoveDoor = useCallback((doorId, newPosition) => {
    const snap = snapRef.current;
    snapRef.current = null;
    pushState(withActiveFloor({
      doors: doors.map((d) => d.id === doorId ? { ...d, position: newPosition } : d),
    }), snap);
  }, [withActiveFloor, doors, pushState]);

  // ----- Window: slide along wall -----

  const handleWindowMoveStart = useCallback(() => {
    snapRef.current = design;
  }, [design]);

  const handleMoveWindow = useCallback((windowId, newPosition) => {
    setStateOnly(withActiveFloor({
      windows: windows.map((w) => w.id === windowId ? { ...w, position: newPosition } : w),
    }));
  }, [withActiveFloor, windows, setStateOnly]);

  const handleCommitMoveWindow = useCallback((windowId, newPosition) => {
    const snap = snapRef.current;
    snapRef.current = null;
    pushState(withActiveFloor({
      windows: windows.map((w) => w.id === windowId ? { ...w, position: newPosition } : w),
    }), snap);
  }, [withActiveFloor, windows, pushState]);

  // ----- Wall endpoint drag -----

  const handleEndpointStart = useCallback(() => {
    snapRef.current = design;
  }, [design]);

  const handleMoveWallEndpoint = useCallback((wallId, whichEnd, newCoords) => {
    const oldWall = walls.find((w) => w.id === wallId);
    if (!oldWall) return;
    const oldLen = Math.hypot(oldWall.end.x - oldWall.start.x, oldWall.end.y - oldWall.start.y);
    const newWall = { ...oldWall };
    if (whichEnd === 'start') newWall.start = { ...newCoords };
    else newWall.end = { ...newCoords };
    const newLen = Math.hypot(newWall.end.x - newWall.start.x, newWall.end.y - newWall.start.y);
    const scaleFactor = newLen > 0 && oldLen > 0 ? oldLen / newLen : 1;
    function rescale(item) {
      if (item.wallId !== wallId) return item;
      let newT = item.position * scaleFactor;
      const halfW = (item.width / 2) / (newLen || 1);
      newT = Math.max(halfW, Math.min(1 - halfW, newT));
      return { ...item, position: newT };
    }
    setStateOnly(withActiveFloor({
      walls: walls.map((w) => w.id === wallId ? newWall : w),
      doors: doors.map(rescale),
      windows: windows.map(rescale),
    }));
  }, [withActiveFloor, walls, doors, windows, setStateOnly]);

  const handleCommitWallEndpoint = useCallback((wallId, whichEnd, newCoords) => {
    const snap = snapRef.current;
    snapRef.current = null;
    const oldWall = walls.find((w) => w.id === wallId);
    if (!oldWall) return;
    const oldLen = Math.hypot(oldWall.end.x - oldWall.start.x, oldWall.end.y - oldWall.start.y);
    const newWall = { ...oldWall };
    if (whichEnd === 'start') newWall.start = { ...newCoords };
    else newWall.end = { ...newCoords };
    const newLen = Math.hypot(newWall.end.x - newWall.start.x, newWall.end.y - newWall.start.y);
    const scaleFactor = newLen > 0 && oldLen > 0 ? oldLen / newLen : 1;
    function rescale(item) {
      if (item.wallId !== wallId) return item;
      let newT = item.position * scaleFactor;
      const halfW = (item.width / 2) / (newLen || 1);
      newT = Math.max(halfW, Math.min(1 - halfW, newT));
      return { ...item, position: newT };
    }
    pushState(withActiveFloor({
      walls: walls.map((w) => w.id === wallId ? newWall : w),
      doors: doors.map(rescale),
      windows: windows.map(rescale),
    }), snap);
  }, [withActiveFloor, walls, doors, windows, pushState]);

  // -----------------------------------------------------------------------
  // Keyboard shortcuts
  // -----------------------------------------------------------------------
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault(); undo(); return;
      }
      if (
        ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z'))
      ) {
        e.preventDefault(); redo(); return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        handleDeleteSelected();
        return;
      }
      // R — rotate selected furniture or stair 15° clockwise
      if (e.key === 'r' || e.key === 'R') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (selectedId && furniture.some((f) => f.id === selectedId)) {
          e.preventDefault();
          handleRotateFurniture(selectedId);
        } else if (selectedId && stairs.some((s) => s.id === selectedId)) {
          e.preventDefault();
          handleRotateStair(selectedId);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, handleDeleteSelected, handleRotateFurniture, handleRotateStair, selectedId, furniture, stairs]);

  // -----------------------------------------------------------------------
  // Precompute floor base Ys for 3D stacking (for View3D)
  // -----------------------------------------------------------------------
  const floors = design?.floors || [];
  const floorBaseYs = useMemo(
    () => floors.map((_, i) => getFloorBaseY(floors, i)),
    [floors]
  );
  const activeFloorHeight = useMemo(() => {
    if (activeFloorIndex >= floors.length - 1) return 3;
    return getFloorBaseY(floors, activeFloorIndex + 1) - getFloorBaseY(floors, activeFloorIndex);
  }, [floors, activeFloorIndex]);

  // -----------------------------------------------------------------------
  // Centralized Collision & Support Validation
  // -----------------------------------------------------------------------
  const { invalidStairIds, overlappingFurnIds, unsupportedWallIds } = useMemo(() => {
    return computeFloorValidations({
      activeFloorId,
      walls,
      furniture,
      stairs,
      closedLoops,
      belowFloorLoops,
      isGroundFloor: activeFloorIndex <= 0,
      allFloors: floors
    });
  }, [activeFloorId, walls, furniture, stairs, closedLoops, belowFloorLoops, activeFloorIndex, floors]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="app-container">
      <Header
        onClear={handleClear}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        selectedId={selectedId}
        onDeleteSelected={handleDeleteSelected}
      />

      <Toolbar mode={mode} onModeChange={setMode} />

      {/* Floor selector bar */}
      <FloorBar
        floors={floors}
        activeFloorId={activeFloorId}
        showAllFloors={showAllFloors}
        onSelectFloor={setActiveFloorId}
        onAddFloor={handleAddFloor}
        onDeleteFloor={handleDeleteFloor}
        onToggleShowAll={() => setShowAllFloors((prev) => !prev)}
      />

      <main className="main-content">
        {/* LEFT — 2D canvas (always shows active floor only) */}
        <div className="panel panel-left">
          <Canvas2D
            walls={walls}
            doors={doors}
            windows={windows}
            closedLoops={closedLoops}
            materials={materials}
            furniture={furniture}
            stairs={stairs}
            selectedFurnitureType={selectedFurnitureType}
            selectedStairType={selectedStairType}
            snapRotation={snapRotation}
            mode={mode}
            selectedId={selectedId}
            invalidStairIds={invalidStairIds}
            overlappingFurnIds={overlappingFurnIds}
            unsupportedWallIds={unsupportedWallIds}
            // Below-floor reference data
            belowFloorWalls={belowFloorWalls}
            belowFloorLoops={belowFloorLoops}
            isGroundFloor={activeFloorIndex <= 0}
            onAddWall={handleAddWall}
            onAddDoor={handleAddDoor}
            onAddWindow={handleAddWindow}
            onAddFurniture={handleAddFurniture}
            onSelect={handleSelect}
            // Door move — live/commit
            onDoorMoveStart={handleDoorMoveStart}
            onMoveDoor={handleMoveDoor}
            onCommitMoveDoor={handleCommitMoveDoor}
            // Window move — live/commit
            onWindowMoveStart={handleWindowMoveStart}
            onMoveWindow={handleMoveWindow}
            onCommitMoveWindow={handleCommitMoveWindow}
            // Wall endpoint drag — live/commit
            onEndpointStart={handleEndpointStart}
            onMoveWallEndpoint={handleMoveWallEndpoint}
            onCommitWallEndpoint={handleCommitWallEndpoint}
            // Furniture move — live/commit
            onFurnMoveStart={handleFurnMoveStart}
            onMoveFurniture={handleMoveFurniture}
            onCommitMoveFurniture={handleCommitMoveFurniture}
            // Furniture rotate handle (2D) — live/commit
            onFurnRotateStart={handleFurnRotateStart}
            onSetFurnitureRotation={handleSetFurnitureRotation}
            onCommitFurnitureRotation={handleCommitFurnitureRotation}
            
            onAddStair={handleAddStair}
            onStairMoveStart={handleStairMoveStart}
            onMoveStair={handleMoveStair}
            onCommitMoveStair={handleCommitMoveStair}
            onStairRotateStart={handleStairRotateStart}
            onSetStairRotation={handleSetStairRotation}
            onCommitStairRotation={handleCommitStairRotation}

            // Misc
            onToggleDoor={handleToggleDoor}
          />
        </div>

        {/* RIGHT — live 3D viewport */}
        <div className="panel panel-right">
          <View3D
            // Active floor (for single-floor editing)
            walls={walls}
            doors={doors}
            windows={windows}
            rooms={rooms}
            closedLoops={closedLoops}
            materials={materials}
            furniture={furniture}
            stairs={stairs}
            invalidStairIds={invalidStairIds}
            overlappingFurnIds={overlappingFurnIds}
            unsupportedWallIds={unsupportedWallIds}
            // Multi-floor
            allFloors={floors}
            activeFloorId={activeFloorId}
            floorBaseYs={floorBaseYs}
            showAllFloors={showAllFloors}
            // UI state
            selectedId={selectedId}
            mode={mode}
            snapRotation={snapRotation}
            onSelect={handleSelect}
            onToggleDoor={handleToggleDoor}
            // Furniture rotate handle (3D) — live/commit
            onFurnRotateStart={handleFurnRotateStart}
            onSetFurnitureRotation={handleSetFurnitureRotation}
            onCommitFurnitureRotation={handleCommitFurnitureRotation}
          />
        </div>

        {/* SIDEBAR */}
        <Sidebar
          selectedId={selectedId}
          walls={walls}
          closedLoops={closedLoops}
          rooms={rooms}
          materials={materials}
          furniture={furniture}
          selectedFurnitureType={selectedFurnitureType}
          snapRotation={snapRotation}
          mode={mode}
          // Discrete callbacks (no snapshot needed)
          onUpdateRoomRoof={handleUpdateRoomRoof}
          onApplyWallMaterialToAll={handleApplyWallMaterialToAll}
          onApplyRoofMaterialToAll={handleApplyRoofMaterialToAll}
          selectedFurnitureType={selectedFurnitureType}
          onSelectFurnitureType={handleSelectFurnitureType}
          
          selectedStairType={selectedStairType}
          onSelectStairType={handleSelectStairType}

          // Wall material — live/commit
          onWallMatStart={handleWallMatStart}
          onUpdateWallMaterial={handleUpdateWallMaterial}
          onCommitWallMaterial={handleCommitWallMaterial}
          // Wall dimensions — live/commit
          onWallDimStart={handleWallDimStart}
          onUpdateWallDimensions={handleUpdateWallDimensions}
          onCommitWallDimensions={handleCommitWallDimensions}
          // Roof material — live/commit
          onRoofMatStart={handleRoofMatStart}
          onUpdateRoomRoofMaterial={handleUpdateRoomRoofMaterial}
          onCommitRoofMaterial={handleCommitRoofMaterial}
          // Roof height — live/commit
          onRoofHeightStart={handleRoofHeightStart}
          onUpdateRoomRoofHeight={handleUpdateRoomRoofHeight}
          onCommitRoofHeight={handleCommitRoofHeight}
          // Floor color — live/commit
          onFloorColorStart={handleFloorColorStart}
          onUpdateRoomFloor={handleUpdateRoomFloor}
          onCommitRoomFloor={handleCommitRoomFloor}
          // Global materials — live/commit
          onGlobalMatStart={handleGlobalMatStart}
          onUpdateMaterials={handleUpdateMaterials}
          onCommitMaterials={handleCommitMaterials}
          // Furniture — live/commit
          onFurnColorStart={handleFurnColorStart}
          onUpdateFurnitureColor={handleUpdateFurnitureColor}
          onCommitFurnitureColor={handleCommitFurnitureColor}
          onFurnScaleStart={handleFurnScaleStart}
          onUpdateFurnitureScale={handleUpdateFurnitureScale}
          onCommitFurnitureScale={handleCommitFurnitureScale}

          // Stair continuous
          onStairColorStart={handleStairColorStart}
          onUpdateStairColor={handleUpdateStairColor}
          onCommitStairColor={handleCommitStairColor}
          
          onStairDimStart={handleStairDimStart}
          onUpdateStairDimensions={handleUpdateStairDimensions}
          onCommitStairDimensions={handleCommitStairDimensions}
          onStairTurnChange={handleStairTurnChange}
          
          activeFloorIndex={activeFloorIndex}
          totalFloors={(design?.floors || []).length}
          floorHeight={activeFloorHeight}
          stairs={stairs}

          // Misc
          onToggleSnapRotation={() => setSnapRotation((prev) => !prev)}
          isOpen={sidebarOpen}
          onToggleOpen={() => setSidebarOpen((prev) => !prev)}
        />

        {/* Floating debug JSON panel */}
        <DebugPanel data={design} />
      </main>
    </div>
  );
}

export default App;
