import React, { useState } from 'react';
import {
  Layers, Cpu, Sparkles, Glasses,
  ArrowRight, ChevronRight, Box, Zap, Monitor,
  PenLine, LayoutDashboard, Wand2,
} from 'lucide-react';
import { TEMPLATE_CATALOG } from '../data/templates';

// ---------------------------------------------------------------------------
// Module card data
// ---------------------------------------------------------------------------
const MODULES = [
  {
    id: 1,
    icon: <Layers size={26} />,
    status: 'production',
    statusBadge: 'Production Ready',
    title: 'Manual 3D Home Builder',
    subtitle: 'Module 1 · Active System',
    description:
      'Precision architectural CAD drafting in 2D with real-time 3D volumetric extrusion. ' +
      'Supports multi-floor structures, pitched & gable roofs, parametric stairs, cantilevers, and furniture placement.',
    features: ['Multi-floor & parametric stairs', 'Pitched / gable / hip roofs', 'Standard GLB export for AR/VR', 'SAT collision & validation engine'],
  },
  {
    id: 2,
    icon: <Wand2 size={26} />,
    status: 'planned',
    statusBadge: 'Planned',
    title: '2D Floor Plan → 3D Auto-Conversion',
    subtitle: 'Module 2 · Pipeline',
    description:
      'Upload architectural blueprints, image drafts, or CAD PDFs and let neural edge-detection ' +
      'automatically synthesize wall boundaries, structural openings, and room geometry.',
    features: ['Blueprint & vector PDF upload', 'Neural room topology detection', 'One-click 3D volumetric model', 'Interactive CAD correction layer'],
  },
  {
    id: 3,
    icon: <Sparkles size={26} />,
    status: 'planned',
    statusBadge: 'Planned',
    title: 'AI-Powered Layout Generator',
    subtitle: 'Module 3 · Generative CAD',
    description:
      'Describe spatial requirements in plain architectural language. Envisioner synthesizes ' +
      'optimized spatial configurations with ergonomic circulation pathways and area calculations.',
    features: ['Natural language spatial prompts', 'Multi-variant floor plan proposals', 'Circulation & area optimization', 'Aesthetic style guidance'],
  },
  {
    id: 4,
    icon: <Glasses size={26} />,
    status: 'research',
    statusBadge: 'In Research',
    title: 'AR / VR Interactive Walkthrough',
    subtitle: 'Module 4 · Spatial Immersion',
    description:
      'Export production GLB assets or step directly into full 1:1 scale architectural walkthroughs ' +
      'using WebXR headsets or mobile AR devices for realistic spatial inspection.',
    features: ['WebXR 1:1 spatial walkthrough', 'Mobile ARKit / ARCore preview', 'Standardized GLTF/GLB runtime', 'In-situ dimensioning tools'],
  },
];

// Tech stack items for footer
const TECH_STACK = [
  { label: 'React 19', icon: '⚛️' },
  { label: 'Three.js / R3F', icon: '🎯' },
  { label: 'GLTF / GLB', icon: '📦' },
  { label: 'SAT Collision', icon: '🔺' },
  { label: 'WebXR Ready', icon: '🥽' },
  { label: 'Vite 6', icon: '⚡' },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ModuleCard({ mod }) {
  const isProduction = mod.status === 'production';
  return (
    <div className={`lp-module-card ${isProduction ? 'lp-module-active' : ''}`}>
      <div className="lp-module-top">
        <div className="lp-module-icon">
          {mod.icon}
        </div>
        <div className={`lp-module-badge ${isProduction ? 'badge-emerald-pulse' : 'badge-monochrome'}`}>
          {isProduction ? '✦ ' : ''}{mod.statusBadge}
        </div>
      </div>
      <h3 className="lp-module-title">{mod.title}</h3>
      <p className="lp-module-subtitle">{mod.subtitle}</p>
      <p className="lp-module-desc">{mod.description}</p>
      <ul className="lp-module-features">
        {mod.features.map((f) => (
          <li key={f}>
            <ChevronRight size={13} className="lp-feature-chevron" />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TemplateCard({ tpl, onLoad }) {
  return (
    <div className="lp-tpl-card">
      <div className="lp-tpl-icon">{tpl.icon}</div>
      <div className="lp-tpl-info">
        <h4 className="lp-tpl-title">{tpl.title}</h4>
        <p className="lp-tpl-desc">{tpl.description}</p>
        <div className="lp-tpl-meta">
          <span className="lp-tpl-pill">{tpl.floors} floor{tpl.floors > 1 ? 's' : ''}</span>
          {tpl.areaSqm && <span className="lp-tpl-pill">~{tpl.areaSqm} m²</span>}
          {tpl.stairType && <span className="lp-tpl-pill">{tpl.stairType} Stair</span>}
          {tpl.roofType && <span className="lp-tpl-pill">{tpl.roofType} Roof</span>}
        </div>
      </div>
      <button className="lp-tpl-btn" onClick={() => onLoad(tpl)}>
        Load in Studio <ArrowRight size={14} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main LandingPage
// ---------------------------------------------------------------------------
export default function LandingPage({ onLaunchStudio, onLoadTemplate }) {
  const [activeSection, setActiveSection] = useState('modules');

  const demoVillaTemplate = TEMPLATE_CATALOG.find((t) => t.id === 'modernist-villa') || TEMPLATE_CATALOG[1];

  return (
    <div className="lp-root">

      {/* ── Nav ── */}
      <nav className="lp-nav glass">
        <div className="lp-nav-brand">
          <div className="lp-logo-mark">E</div>
          <span className="lp-brand-name">Envisioner</span>
          <span className="lp-nav-pill">STUDIO ARCHITECTURE</span>
        </div>
        <div className="lp-nav-links">
          <a href="#modules" className="lp-nav-link" onClick={() => setActiveSection('modules')}>Modules</a>
          <a href="#templates" className="lp-nav-link" onClick={() => setActiveSection('templates')}>Templates</a>
          <a href="#about" className="lp-nav-link">Specifications</a>
        </div>
        <button className="lp-nav-cta" onClick={onLaunchStudio}>
          Open Studio <ArrowRight size={14} />
        </button>
      </nav>

      {/* ── Hero ── */}
      <section className="lp-hero">
        <div className="lp-hero-bg-grid" aria-hidden />
        <div className="lp-hero-radial-glow" aria-hidden />

        <div className="lp-hero-content">
          <div className="lp-hero-badge">
            <span className="lp-badge-sparkle">✦</span> Module 1: Production Ready
          </div>
          <h1 className="lp-hero-title">
            Precision Architectural Design
            <span className="lp-hero-title-accent"> in Your Browser</span>
          </h1>
          <p className="lp-hero-sub">
            Seamlessly draft in 2D and inspect in real-time 3D. 
            Engineered with multi-floor stacking, parametric stairs, pitched roofs, SAT collision validation, and instant GLB export.
          </p>
          <div className="lp-hero-actions">
            <button className="lp-btn-primary" onClick={onLaunchStudio}>
              <Monitor size={17} />
              Open Studio Workspace →
            </button>
            <button className="lp-btn-secondary" onClick={() => onLoadTemplate(demoVillaTemplate)}>
              <Box size={16} />
              Load Demo Villa
            </button>
          </div>

          {/* Stats row */}
          <div className="lp-hero-stats">
            {[
              ['4', 'Studio Modules'],
              ['∞', 'Multi-Floor Stacking'],
              ['GLB', 'Universal Export'],
              ['SAT', 'Collision Physics'],
            ].map(([val, label]) => (
              <div className="lp-stat" key={label}>
                <span className="lp-stat-val">{val}</span>
                <span className="lp-stat-label">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hero illustration */}
        <div className="lp-hero-visual">
          <img
            src={heroImgUrl}
            alt="Envisioner 3D home design preview"
            className="lp-hero-img"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          {/* Floating feature chips */}
          <div className="lp-hero-chip lp-chip-tl">
            <PenLine size={12} /> 2D Drafting · 3D Volume
          </div>
          <div className="lp-hero-chip lp-chip-br">
            <Box size={12} /> Precision GLB Export
          </div>
        </div>
      </section>

      {/* ── Modules ── */}
      <section id="modules" className="lp-section">
        <div className="lp-section-header">
          <div className="lp-section-eyebrow"><LayoutDashboard size={14} /> Integrated Architecture</div>
          <h2 className="lp-section-title">The Four Architectural Modules</h2>
          <p className="lp-section-sub">From manual CAD drafting to AI generative layout synthesis and spatial XR inspection.</p>
        </div>
        <div className="lp-modules-grid">
          {MODULES.map((mod) => <ModuleCard key={mod.id} mod={mod} />)}
        </div>
      </section>

      {/* ── Templates ── */}
      <section id="templates" className="lp-section lp-section-alt">
        <div className="lp-section-header">
          <div className="lp-section-eyebrow"><Sparkles size={14} /> Curated Blueprints</div>
          <h2 className="lp-section-title">Starter Architectural Blueprints</h2>
          <p className="lp-section-sub">Select an architectural template to immediately explore multi-floor layouts, stairs, and materials.</p>
        </div>
        <div className="lp-templates-list">
          {TEMPLATE_CATALOG.map((tpl) => (
            <TemplateCard key={tpl.id} tpl={tpl} onLoad={onLoadTemplate} />
          ))}
        </div>
      </section>

      {/* ── About / Tech ── */}
      <section id="about" className="lp-section">
        <div className="lp-section-header">
          <div className="lp-section-eyebrow"><Cpu size={14} /> Technology</div>
          <h2 className="lp-section-title">Built on Modern Web Standards</h2>
          <p className="lp-section-sub">No plug-ins, no downloads. Envisioner runs entirely in the browser using cutting-edge web technologies.</p>
        </div>
        <div className="lp-tech-grid">
          {TECH_STACK.map((t) => (
            <div className="lp-tech-card" key={t.label}>
              <span className="lp-tech-icon">{t.icon}</span>
              <span className="lp-tech-label">{t.label}</span>
            </div>
          ))}
        </div>
        <div className="lp-about-body">
          <p>
            Envisioner is a passion project exploring what modern browsers can do for architectural design.
            The 3D engine uses <strong>React Three Fiber</strong> (a React renderer for Three.js), the geometry
            engine uses a custom <strong>SAT (Separating Axis Theorem)</strong> collision system for accurate
            furniture overlap detection, and the export pipeline uses the <strong>GLTFExporter</strong> to produce
            fully standards-compliant GLB files compatible with any AR/VR viewer.
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer glass">
        <div className="lp-footer-brand">
          <div className="lp-logo-mark lp-logo-mark-sm">E</div>
          <span className="lp-brand-name">Envisioner</span>
        </div>
        <p className="lp-footer-copy">© 2025 Envisioner · Built with React, Three.js & love.</p>
        <button className="lp-btn-secondary lp-footer-cta" onClick={onLaunchStudio}>
          Open Studio <ArrowRight size={14} />
        </button>
      </footer>
    </div>
  );
}

// We use an inline data-URL approach so the image works even if the build
// asset pipeline hasn't been configured. The actual image is embedded at
// build time via the import below. If it fails (e.g., old save), we fall back
// gracefully via the onError handler on the <img>.
let heroImgUrl = '';
try {
  // Dynamic import is async — instead, we embed as a static module
  // import. Vite will inline or asset-hash it automatically.
  heroImgUrl = new URL('../assets/hero.jpg', import.meta.url).href;
} catch (_) {
  heroImgUrl = '';
}
