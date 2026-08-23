import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Toolbar from './components/Toolbar';
import Sidebar from './components/Sidebar';
import Canvas2D from './components/Canvas2D';
import View3D from './components/View3D';
import DebugPanel from './components/DebugPanel';
import useHistory from './hooks/useHistory';
import { findClosedLoops } from './utils/geometry';
import './index.css';

// ---------------------------------------------------------------------------
// Initial (empty) design — includes walls, doors, windows, and roof config
// ---------------------------------------------------------------------------
const INITIAL_DESIGN = {
  walls: [],
  doors: [],
  windows: [],
  rooms: [], // array of { id, roof: { enabled, type, height, pitch } }
};

// ---------------------------------------------------------------------------
// App — root component.
//
// All mutation logic lives here. Canvas2D, View3D, and Sidebar read from
// the design JSON and call callbacks to request changes.
// ---------------------------------------------------------------------------
function App() {
  // ---- History-managed design state ----
  const {
    state: design,
    pushState,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
  } = useHistory(INITIAL_DESIGN);

  // ---- UI state (not part of the design model) ----
  const [mode, setMode] = useState('wall');           // 'wall' | 'door' | 'window' | 'select'
  const [selectedId, setSelectedId] = useState(null); // wall, door, window, or room/loop id
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Compute closed loops at the top level so they can be passed down to Canvas2D, View3D, Sidebar
  const closedLoops = React.useMemo(() => findClosedLoops(design.walls), [design.walls]);

  // Backward compatibility migration: If an old design with global `roof` is loaded,
  // migrate it to `rooms` for all current closed loops.
  useEffect(() => {
    if (design && design.roof !== undefined) {
      const migratedRooms = closedLoops.map((loop) => ({
        id: loop.id,
        roof: { ...design.roof },
      }));
      const migratedDesign = { ...design, rooms: migratedRooms };
      delete migratedDesign.roof; // remove the global roof object
      pushState(migratedDesign);
    }
  }, [design, closedLoops, pushState]);

  // -----------------------------------------------------------------------
  // Design mutation handlers
  // -----------------------------------------------------------------------

  /** Add a newly drawn wall */
  const handleAddWall = useCallback((wallData) => {
    const newWall = { ...wallData, id: `wall-${Date.now()}` };
    pushState({
      ...design,
      walls: [...design.walls, newWall],
    });
  }, [design, pushState]);

  /** Add a door onto a wall */
  const handleAddDoor = useCallback((doorData) => {
    const newDoor = { ...doorData, id: `door-${Date.now()}`, isOpen: doorData.isOpen ?? false };
    pushState({
      ...design,
      doors: [...design.doors, newDoor],
    });
  }, [design, pushState]);

  /** Add a window onto a wall */
  const handleAddWindow = useCallback((windowData) => {
    const newWindow = { ...windowData, id: `window-${Date.now()}` };
    pushState({
      ...design,
      windows: [...design.windows, newWindow],
    });
  }, [design, pushState]);

  /** Update roof settings for a specific room */
  const handleUpdateRoomRoof = useCallback((roomId, roofData) => {
    const existingRoom = (design.rooms || []).find((r) => r.id === roomId);
    if (existingRoom) {
      pushState({
        ...design,
        rooms: design.rooms.map((r) => (r.id === roomId ? { ...r, roof: roofData } : r)),
      });
    } else {
      pushState({
        ...design,
        rooms: [...(design.rooms || []), { id: roomId, roof: roofData }],
      });
    }
  }, [design, pushState]);

  /** Toggle a door open / closed */
  const handleToggleDoor = useCallback((doorId) => {
    pushState({
      ...design,
      doors: design.doors.map((d) =>
        d.id === doorId ? { ...d, isOpen: !d.isOpen } : d,
      ),
    });
  }, [design, pushState]);

  /** Delete whatever is currently selected (wall, door, or window).
   *  Deleting a wall also deletes all its doors AND windows (no orphans). */
  const handleDeleteSelected = useCallback(() => {
    if (!selectedId) return;

    // Is it a wall?
    if (design.walls.some((w) => w.id === selectedId)) {
      pushState({
        ...design,
        walls: design.walls.filter((w) => w.id !== selectedId),
        doors: design.doors.filter((d) => d.wallId !== selectedId),
        windows: design.windows.filter((w) => w.wallId !== selectedId),
      });
      setSelectedId(null);
      return;
    }

    // Is it a door?
    if (design.doors.some((d) => d.id === selectedId)) {
      pushState({
        ...design,
        doors: design.doors.filter((d) => d.id !== selectedId),
      });
      setSelectedId(null);
      return;
    }

    // Is it a window?
    if (design.windows.some((w) => w.id === selectedId)) {
      pushState({
        ...design,
        windows: design.windows.filter((w) => w.id !== selectedId),
      });
      setSelectedId(null);
    }
  }, [selectedId, design, pushState]);

  /** Clear the entire design and history */
  const handleClear = useCallback(() => {
    reset(INITIAL_DESIGN);
    setSelectedId(null);
  }, [reset]);

  /** Select (or deselect) a wall, door, or window */
  const handleSelect = useCallback((id) => {
    setSelectedId(id);
  }, []);

  // -----------------------------------------------------------------------
  // Move handlers
  // -----------------------------------------------------------------------

  /** Slide a door along its wall */
  const handleMoveDoor = useCallback((doorId, newPosition) => {
    pushState({
      ...design,
      doors: design.doors.map((d) =>
        d.id === doorId ? { ...d, position: newPosition } : d,
      ),
    });
  }, [design, pushState]);

  /** Slide a window along its wall */
  const handleMoveWindow = useCallback((windowId, newPosition) => {
    pushState({
      ...design,
      windows: design.windows.map((w) =>
        w.id === windowId ? { ...w, position: newPosition } : w,
      ),
    });
  }, [design, pushState]);

  /** Move a wall endpoint, rescaling door AND window positions
   *  proportionally so they remain within the new wall length. */
  const handleMoveWallEndpoint = useCallback((wallId, whichEnd, newCoords) => {
    const oldWall = design.walls.find((w) => w.id === wallId);
    if (!oldWall) return;

    const oldLen = Math.hypot(
      oldWall.end.x - oldWall.start.x,
      oldWall.end.y - oldWall.start.y,
    );

    const newWall = { ...oldWall };
    if (whichEnd === 'start') newWall.start = { ...newCoords };
    else newWall.end = { ...newCoords };

    const newLen = Math.hypot(
      newWall.end.x - newWall.start.x,
      newWall.end.y - newWall.start.y,
    );

    const scaleFactor = newLen > 0 && oldLen > 0 ? oldLen / newLen : 1;

    // Helper — rescale an opening's t-position and clamp
    function rescale(item) {
      if (item.wallId !== wallId) return item;
      let newT = item.position * scaleFactor;
      const halfW = (item.width / 2) / (newLen || 1);
      newT = Math.max(halfW, Math.min(1 - halfW, newT));
      return { ...item, position: newT };
    }

    pushState({
      ...design,
      walls: design.walls.map((w) => (w.id === wallId ? newWall : w)),
      doors: design.doors.map(rescale),
      windows: design.windows.map(rescale),
    });
  }, [design, pushState]);

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
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, handleDeleteSelected]);

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

      <main className="main-content">
        {/* LEFT — 2D canvas */}
        <div className="panel panel-left">
          <Canvas2D
            walls={design.walls}
            doors={design.doors}
            windows={design.windows}
            closedLoops={closedLoops}
            mode={mode}
            selectedId={selectedId}
            onAddWall={handleAddWall}
            onAddDoor={handleAddDoor}
            onAddWindow={handleAddWindow}
            onSelect={handleSelect}
            onMoveDoor={handleMoveDoor}
            onMoveWindow={handleMoveWindow}
            onMoveWallEndpoint={handleMoveWallEndpoint}
            onToggleDoor={handleToggleDoor}
          />
        </div>

        {/* RIGHT — live 3D viewport */}
        <div className="panel panel-right">
          <View3D
            walls={design.walls}
            doors={design.doors}
            windows={design.windows}
            rooms={design.rooms || []}
            closedLoops={closedLoops}
            selectedId={selectedId}
            mode={mode}
            onSelect={handleSelect}
            onToggleDoor={handleToggleDoor}
          />
        </div>

        {/* SIDEBAR — Structure & Roof settings */}
        <Sidebar
          selectedId={selectedId}
          closedLoops={closedLoops}
          rooms={design.rooms || []}
          onUpdateRoomRoof={handleUpdateRoomRoof}
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
