import React, { useState } from 'react';
import { X, ChevronDown, ChevronRight, Layers, Grid, ArrowUpFromLine, DoorOpen, Sofa, Box, Lightbulb } from 'lucide-react';

// ---------------------------------------------------------------------------
// Step definitions — shared architectural explanation content
// ---------------------------------------------------------------------------
const STEPS = [
  {
    id: 'walls',
    icon: <Grid size={15} />,
    title: 'Outer Wall Enclosure',
    summary: 'Closed polygon from connected walls',
    content: (
      <>
        <p>
          Four or more walls are drawn on the 2D canvas and <strong>snap at their endpoints</strong> to form
          a closed polygon. Envisioner detects closed loops automatically using a graph traversal
          algorithm — the moment the last wall endpoint touches the first wall's start point, a
          <em> room polygon</em> is born and the floor slab is rendered in 3D.
        </p>
        <p className="guide-tip">
          💡 Try selecting any outer wall and adjusting its <strong>Height</strong> or
          <strong> Thickness</strong> in the sidebar.
        </p>
      </>
    ),
  },
  {
    id: 'zones',
    icon: <Layers size={15} />,
    title: 'Interior Spatial Zoning',
    summary: 'T-junction divider walls',
    content: (
      <>
        <p>
          Interior partition walls start on the outer perimeter and terminate at a T-junction,
          splitting the room polygon into distinct spatial zones — bedroom, kitchen, bathroom, dining.
          Envisioner re-runs the closed-loop detection after every wall addition.
        </p>
        <p className="guide-tip">
          💡 Interior dividers do not need to form their own closed loop — they inherit the
          containing room's slab and can host doors independently.
        </p>
      </>
    ),
  },
  {
    id: 'stairs',
    icon: <ArrowUpFromLine size={15} />,
    title: 'Vertical Circulation (Stairs)',
    summary: 'Floor-to-floor L-Shape / U-Shape stair volumes',
    content: (
      <>
        <p>
          Stairs connect <strong>Floor 0 → Floor 1</strong> using a parametric volumetric model.
          Each stair knows its source and destination floor IDs. The stairwell opening
          (the ceiling cutout on the upper floor) is computed from the stair's exact footprint polygon
          using the same SAT geometry engine — ensuring the slab is punched precisely where the stair rises.
        </p>
        <p className="guide-tip">
          💡 Select a stair and use the sidebar to change its <strong>Width</strong>, <strong>Run</strong>,
          or <strong>Turn Direction</strong>. Switch to "All Floors" view to see the stairwell cutout.
        </p>
      </>
    ),
  },
  {
    id: 'openings',
    icon: <DoorOpen size={15} />,
    title: 'Fenestration (Doors & Windows)',
    summary: 'CSG cutouts hosted on wall vectors',
    content: (
      <>
        <p>
          Doors and windows are hosted along a wall's vector as a fractional <em>position</em> (0–1)
          from the wall's start to end point. In 3D, the engine performs
          <strong> CSG (Constructive Solid Geometry)</strong> — subtracting the opening volume
          from the wall mesh to create a geometrically accurate cutout with proper frame geometry.
        </p>
        <p className="guide-tip">
          💡 Switch to Door mode (<strong>D</strong> key) and click any wall to place a door.
          Drag the door glyph in 2D view to reposition it along the wall.
        </p>
      </>
    ),
  },
  {
    id: 'furniture',
    icon: <Sofa size={15} />,
    title: 'Spatial Furnishing & Wall Clamping',
    summary: 'SAT collision detection with wall boundary enforcement',
    content: (
      <>
        <p>
          Furniture items use <strong>SAT (Separating Axis Theorem)</strong> to detect overlaps with
          other furniture and walls. When dragging a piece near a wall interior face,
          the system automatically <em>clamps</em> the item's footprint so it stops
          flush with the wall surface — mimicking how furniture sits against walls in real spaces.
        </p>
        <p className="guide-tip">
          💡 Press <strong>F</strong> to enter Furniture mode, select an item type,
          then click inside a room to place it. Press <strong>R</strong> to rotate 15°.
        </p>
      </>
    ),
  },
  {
    id: 'roof',
    icon: <Box size={15} />,
    title: 'Roof Architecture & GLB Export',
    summary: 'Parametric gable/flat roof + universal 3D export',
    content: (
      <>
        <p>
          Select any closed room in the sidebar, toggle <strong>Roof On</strong>, and choose
          <strong> Flat</strong> or <strong>Gable</strong>. Gable roofs are calculated from
          the room's bounding axis — the ridge runs along the longest span and the hip triangles
          are constructed at the correct pitch angle from the roof height parameter.
        </p>
        <p>
          When you click <strong>[Export .GLB]</strong>, the entire multi-floor design
          (walls, slabs, roofs, furniture, stairs) is serialized into a
          standards-compliant <strong>GLTF 2.0 Binary</strong> file readable by any
          AR/VR viewer, Blender, or WebXR runtime.
        </p>
        <p className="guide-tip">
          💡 Select a room → Sidebar → Roof section → Enable roof → Choose Gable → adjust Height.
          Then export GLB and open in any GLTF viewer to inspect the full 3D model.
        </p>
      </>
    ),
  },
];

// ---------------------------------------------------------------------------
// AccordionStep — single collapsible step
// ---------------------------------------------------------------------------
function AccordionStep({ step, index, isOpen, onToggle }) {
  return (
    <div className={`guide-step ${isOpen ? 'guide-step-open' : ''}`}>
      <button className="guide-step-header" onClick={onToggle} aria-expanded={isOpen}>
        <span className="guide-step-num">{String(index + 1).padStart(2, '0')}</span>
        <span className="guide-step-icon">{step.icon}</span>
        <span className="guide-step-title-wrap">
          <span className="guide-step-title">{step.title}</span>
          <span className="guide-step-summary">{step.summary}</span>
        </span>
        <span className="guide-step-chevron">
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>
      {isOpen && (
        <div className="guide-step-body">
          {step.content}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TemplateGuideDrawer — slide-in from the right
// ---------------------------------------------------------------------------
export default function TemplateGuideDrawer({ template, onClose }) {
  const [openStep, setOpenStep] = useState(0);

  if (!template) return null;

  function toggleStep(idx) {
    setOpenStep((prev) => (prev === idx ? -1 : idx));
  }

  return (
    <div className="guide-drawer glass" role="complementary" aria-label="Template architectural guide">
      {/* Header */}
      <div className="guide-drawer-header">
        <div className="guide-drawer-title-row">
          <Lightbulb size={16} className="guide-drawer-icon" />
          <span className="guide-drawer-title">How It's Built</span>
        </div>
        <div className="guide-drawer-sub">{template.title}</div>
        <button className="guide-drawer-close" onClick={onClose} title="Close guide">
          <X size={15} />
        </button>
      </div>

      {/* Stats overview pill row */}
      <div className="guide-stats-row">
        <div className="guide-stat-pill">
          <span className="guide-stat-val">{template.floors}</span>
          <span className="guide-stat-label">Floors</span>
        </div>
        <div className="guide-stat-pill">
          <span className="guide-stat-val">~{template.areaSqm}</span>
          <span className="guide-stat-label">m²</span>
        </div>
        {template.stairType && (
          <div className="guide-stat-pill">
            <span className="guide-stat-val">{template.stairType}</span>
            <span className="guide-stat-label">Stair</span>
          </div>
        )}
        <div className="guide-stat-pill">
          <span className="guide-stat-val">{template.roofType}</span>
          <span className="guide-stat-label">Roof</span>
        </div>
      </div>

      {/* Accordion steps */}
      <div className="guide-steps-list">
        {STEPS.map((step, i) => (
          <AccordionStep
            key={step.id}
            step={step}
            index={i}
            isOpen={openStep === i}
            onToggle={() => toggleStep(i)}
          />
        ))}
      </div>

      {/* Footer tip */}
      <div className="guide-footer">
        <Lightbulb size={12} />
        <span>Select any wall or stair to adjust its properties in the Sidebar.</span>
      </div>
    </div>
  );
}
