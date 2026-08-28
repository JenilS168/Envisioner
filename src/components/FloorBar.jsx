import React from 'react';
import { Plus, Trash2, Layers, Eye, EyeOff } from 'lucide-react';

/**
 * FloorBar — horizontal bar between the Toolbar and the main editing views.
 *
 * Displays one tab per floor.  Active floor is highlighted.
 * "+" adds a new floor above the highest.
 * "🗑" deletes the active floor (disabled when only 1 floor remains).
 * "Show All Floors" toggle controls the 3D stacking view.
 *
 * Props:
 *   floors            — array of { id, label } floor objects
 *   activeFloorId     — id of the currently active floor
 *   showAllFloors     — boolean, whether 3D shows all stacked floors
 *   onSelectFloor(id) — switch to a floor (not undoable)
 *   onAddFloor()      — add a new floor (undoable)
 *   onDeleteFloor(id) — delete a floor (undoable); App shows confirm dialog
 *   onToggleShowAll() — toggle showAllFloors
 */
export default function FloorBar({
  floors = [],
  activeFloorId,
  showAllFloors = false,
  onSelectFloor,
  onAddFloor,
  onDeleteFloor,
  onToggleShowAll,
}) {
  const canDelete = floors.length > 1;

  function handleDelete() {
    if (!canDelete) return;
    const floor = floors.find((f) => f.id === activeFloorId);
    const label = floor?.label || 'this floor';
    if (window.confirm(`Delete "${label}" and all its walls, doors, windows, furniture, and roof? This cannot be undone with a single undo if you have many changes, but Ctrl+Z still works.`)) {
      onDeleteFloor && onDeleteFloor(activeFloorId);
    }
  }

  return (
    <div className="floor-bar glass">
      {/* Floor tabs */}
      <div className="floor-tabs">
        <Layers size={14} className="floor-bar-icon" />
        {floors.map((floor) => (
          <button
            key={floor.id}
            id={`floor-tab-${floor.id}`}
            className={`floor-tab ${floor.id === activeFloorId ? 'floor-tab-active' : ''}`}
            onClick={() => onSelectFloor && onSelectFloor(floor.id)}
            title={`Switch to ${floor.label}`}
          >
            {floor.label}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="floor-bar-actions">
        {/* Add floor */}
        <button
          id="btn-add-floor"
          className="btn btn-sm floor-bar-btn"
          onClick={onAddFloor}
          title="Add a new floor above the highest"
        >
          <Plus size={13} />
          Add Floor
        </button>

        {/* Delete active floor */}
        <button
          id="btn-delete-floor"
          className="btn btn-sm btn-danger floor-bar-btn"
          onClick={handleDelete}
          disabled={!canDelete}
          title={canDelete ? `Delete ${floors.find(f => f.id === activeFloorId)?.label}` : 'Cannot delete the last floor'}
        >
          <Trash2 size={13} />
          Delete
        </button>

        {/* Show All Floors toggle */}
        <button
          id="btn-show-all-floors"
          className={`btn btn-sm floor-bar-btn ${showAllFloors ? 'floor-bar-btn-active' : ''}`}
          onClick={onToggleShowAll}
          title={showAllFloors ? 'Hide other floors in 3D' : 'Show all floors stacked in 3D'}
        >
          {showAllFloors ? <Eye size={13} /> : <EyeOff size={13} />}
          {showAllFloors ? 'All Floors' : 'One Floor'}
        </button>
      </div>
    </div>
  );
}
