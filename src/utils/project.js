/**
 * project.js — Versioned project serialization, normalization, and file I/O.
 *
 * Canonical project schema (v1):
 *   {
 *     schemaVersion: 1,
 *     projectId:     string,
 *     projectName:   string,
 *     units:         "meters",
 *     floors:        Floor[],
 *     settings:      {},
 *     metadata: {
 *       createdAt:   ISO string,
 *       updatedAt:   ISO string,
 *     }
 *   }
 *
 * The internal design model used by App.jsx is `{ floors, _projectMeta }`.
 * `_projectMeta` stores project-level data (id, name, metadata) for
 * round-trip preservation without polluting the floor data.
 */

import { normaliseFloor, DEFAULT_MATERIALS } from './floors';

// ---------------------------------------------------------------------------
// Supported schema versions — extend this set when adding migrations.
// ---------------------------------------------------------------------------
const SUPPORTED_SCHEMA_VERSIONS = new Set([1]);
const CURRENT_SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Portable unique-ID generator — mirrors the pattern in makeEmptyFloor().
// Falls back gracefully when crypto.randomUUID() is unavailable.
// ---------------------------------------------------------------------------
function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + random suffix (same pattern as makeEmptyFloor)
  return `proj-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// normaliseProject — validate, migrate, and fill defaults for a raw project.
//
// Returns { project, warnings } on success.
// Throws a descriptive Error on malformed input that cannot be recovered.
//
// Contract:
//   • Supports schemaVersion 1.
//   • Adds missing arrays safely (e.g. stairs: [] on older floors).
//   • Preserves all IDs.
//   • Applies defaults ONLY to missing fields.
//   • Rejects clearly malformed files (not an object, missing floors).
//   • Preserves invalid/unknown geometry — never deletes data.
//   • Returns warnings for anything unusual that was auto-fixed.
// ---------------------------------------------------------------------------
export function normaliseProject(raw) {
  const warnings = [];

  // ---- Gate: must be a non-null object ----
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Project file is not a valid JSON object.');
  }

  // ---- schemaVersion ----
  if (raw.schemaVersion === undefined) {
    // Legacy file from before versioning — treat as v1.
    warnings.push('Missing schemaVersion — treating as version 1.');
  } else if (!SUPPORTED_SCHEMA_VERSIONS.has(raw.schemaVersion)) {
    throw new Error(
      `Unsupported schema version: ${raw.schemaVersion}. ` +
      `This app supports versions: ${[...SUPPORTED_SCHEMA_VERSIONS].join(', ')}.`
    );
  }

  // ---- floors — required ----
  if (!raw.floors) {
    // Attempt legacy migration: if it looks like a flat design with walls
    if (raw.walls && Array.isArray(raw.walls)) {
      warnings.push('No floors array found — migrating flat design into a single Ground Floor.');
      raw = {
        ...raw,
        floors: [{
          id: 'floor-0',
          label: 'Ground Floor',
          walls:     raw.walls     || [],
          doors:     raw.doors     || [],
          windows:   raw.windows   || [],
          rooms:     raw.rooms     || [],
          materials: raw.materials ? { ...DEFAULT_MATERIALS, ...raw.materials } : { ...DEFAULT_MATERIALS },
          furniture: raw.furniture || [],
          stairs:    raw.stairs    || [],
        }],
      };
    } else {
      throw new Error('Project file has no "floors" array and does not look like a legacy flat design.');
    }
  }

  if (!Array.isArray(raw.floors)) {
    throw new Error('"floors" must be an array.');
  }

  if (raw.floors.length === 0) {
    throw new Error('Project must contain at least one floor.');
  }

  // ---- Normalise each floor ----
  const floors = raw.floors.map((floor, i) => {
    if (!floor || typeof floor !== 'object') {
      warnings.push(`Floor at index ${i} is not an object — wrapping as empty floor.`);
      return normaliseFloor({ id: `floor-recovered-${i}`, label: `Recovered Floor ${i}` });
    }

    // Ensure the floor has an id
    if (!floor.id) {
      floor = { ...floor, id: `floor-${i}` };
      warnings.push(`Floor at index ${i} had no id — assigned "${floor.id}".`);
    }

    // Track which arrays were missing (for warnings)
    const missingArrays = [];
    if (!floor.walls)     missingArrays.push('walls');
    if (!floor.doors)     missingArrays.push('doors');
    if (!floor.windows)   missingArrays.push('windows');
    if (!floor.rooms)     missingArrays.push('rooms');
    if (!floor.furniture) missingArrays.push('furniture');
    if (!floor.stairs)    missingArrays.push('stairs');

    if (missingArrays.length > 0) {
      warnings.push(`Floor "${floor.label || floor.id}": added missing arrays: ${missingArrays.join(', ')}.`);
    }

    // normaliseFloor fills in all missing arrays and materials
    return normaliseFloor(floor);
  });

  // ---- Build normalised project ----
  const now = new Date().toISOString();
  const project = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    projectId:     raw.projectId     || generateId(),
    projectName:   raw.projectName   || 'Untitled Project',
    units:         raw.units         || 'meters',
    floors,
    settings:      raw.settings      || {},
    metadata: {
      createdAt: raw.metadata?.createdAt || now,
      updatedAt: raw.metadata?.updatedAt || now,
    },
  };

  // ---- Flag if projectId was missing ----
  if (!raw.projectId) {
    warnings.push('No projectId found — generated a new one.');
  }

  return { project, warnings };
}

// ---------------------------------------------------------------------------
// designToProject — wraps the internal { floors, _projectMeta? } design
// into the canonical project schema for serialization.
// ---------------------------------------------------------------------------
export function designToProject(design, projectMeta) {
  const meta = projectMeta || design?._projectMeta || {};
  const now = new Date().toISOString();

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    projectId:     meta.projectId   || generateId(),
    projectName:   meta.projectName || 'Untitled Project',
    units:         meta.units       || 'meters',
    floors:        (design?.floors || []).map(f => {
      // Strip any transient keys that shouldn't be persisted
      const { ...floorData } = f;
      return floorData;
    }),
    settings:      meta.settings    || {},
    metadata: {
      createdAt: meta.createdAt || now,
      updatedAt: now,
    },
  };
}

// ---------------------------------------------------------------------------
// projectToDesign — extracts the internal design shape from a normalised
// project. Stores project-level meta in _projectMeta for round-tripping.
// ---------------------------------------------------------------------------
export function projectToDesign(project) {
  return {
    floors: project.floors,
    _projectMeta: {
      projectId:   project.projectId,
      projectName: project.projectName,
      units:       project.units,
      settings:    project.settings,
      createdAt:   project.metadata?.createdAt,
      updatedAt:   project.metadata?.updatedAt,
    },
  };
}

// ---------------------------------------------------------------------------
// saveProjectToFile — serializes a project object and triggers a browser
// file download. Does NOT modify any application state.
// ---------------------------------------------------------------------------
export function saveProjectToFile(project) {
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  // Sanitise projectName for use as a filename
  const safeName = (project.projectName || 'Untitled Project')
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim()
    || 'Untitled Project';

  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}.envisioner.json`;
  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// ---------------------------------------------------------------------------
// loadProjectFromFile — opens a file picker, reads + parses the selected
// JSON file, runs normaliseProject, and returns the result.
//
// Returns a Promise that resolves to { project, warnings } or rejects
// with a descriptive error. The caller is responsible for state updates.
// ---------------------------------------------------------------------------
export function loadProjectFromFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      document.body.removeChild(input);

      if (!file) {
        reject(new Error('No file selected.'));
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        try {
          const raw = JSON.parse(reader.result);
          const result = normaliseProject(raw);
          resolve(result);
        } catch (err) {
          reject(new Error(`Failed to load project: ${err.message}`));
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read the file.'));
      };

      reader.readAsText(file);
    });

    // Handle cancel (user closes picker without selecting)
    input.addEventListener('cancel', () => {
      document.body.removeChild(input);
      reject(new Error('File selection cancelled.'));
    });

    input.click();
  });
}
