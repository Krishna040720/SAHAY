/**
 * SAHAY Slide 2 Presentation Showcase Controller
 * -----------------------------------------------
 * Renders the clean vertical boxes for Problem Statement & Proposed Solution
 * with real-time typography adjustment, contrast toggle, and fullscreen presentation mode.
 */

export function renderSlide2Presentation(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="presentation-stage" id="presentation-stage-box">
      <!-- Presentation Header with Title & Subtitle -->
      <div class="presentation-header">
        <div class="slide-meta-tag">
          <span>Smart India Hackathon • Slide 2 of 6</span>
        </div>
        <h2 class="slide-main-title">Problem Statement & Proposed Solution</h2>
        <p class="slide-subtitle">
          <strong>SAHAY:</strong> Smart AI for Humanitarian Aid &amp; Yielding Relief
        </p>
      </div>

      <!-- Vertical Boxes Layout (2 columns side-by-side) -->
      <div class="vertical-boxes-grid" id="presentation-boxes-grid">
        
        <!-- LEFT VERTICAL BOX: Problem Statement -->
        <div class="vert-box-card vert-box-problem">
          <div class="box-header">
            <span class="box-badge">🔴 Ground Reality &amp; Bottlenecks</span>
            <span style="font-family:var(--font-mono); font-size:0.75rem; color:#f87171; font-weight:700;">6 Pain Points</span>
          </div>

          <h3 class="box-heading" style="color:#fecaca; margin-bottom: 0.85rem;">Problem Statement</h3>

          <div class="box-hook-statement">
            "Disaster relief isn't failing due to lack of resources — it's failing due to <strong>lack of coordination</strong>."
          </div>

          <ul class="box-items-list">
            <li class="box-item">
              <span class="box-item-icon">✕</span>
              <div class="box-item-text">
                <strong>Survivors can't locate</strong> the nearest shelter, safe evacuation route, or relief camp.
              </div>
            </li>
            <li class="box-item">
              <span class="box-item-icon">✕</span>
              <div class="box-item-text">
                <strong>Relief camps have no real-time visibility</strong> into resource needs or surplus at neighboring camps.
              </div>
            </li>
            <li class="box-item">
              <span class="box-item-icon">✕</span>
              <div class="box-item-text">
                <strong>Volunteers and NGOs duplicate work</strong> in accessible areas while remote sectors are completely missed.
              </div>
            </li>
            <li class="box-item">
              <span class="box-item-icon">✕</span>
              <div class="box-item-text">
                <strong>Authorities lack a live, verified ground picture</strong> to allocate critical medical, food, and rescue assets.
              </div>
            </li>
            <li class="box-item">
              <span class="box-item-icon">✕</span>
              <div class="box-item-text">
                <strong>Crowdsourced reports can be false or outdated</strong>, causing rumor panics and misdirecting scarce aid.
              </div>
            </li>
            <li class="box-item">
              <span class="box-item-icon">✕</span>
              <div class="box-item-text">
                <strong>Disaster zones frequently lose cellular connectivity</strong>, cutting off field reporting entirely.
              </div>
            </li>
          </ul>
        </div>

        <!-- RIGHT VERTICAL BOX: Proposed Solution -->
        <div class="vert-box-card vert-box-solution">
          <div class="box-header">
            <span class="box-badge">🟢 The SAHAY Framework</span>
            <span style="font-family:var(--font-mono); font-size:0.75rem; color:#34d399; font-weight:700;">3 Core Pillars</span>
          </div>

          <h3 class="box-heading" style="color:#a7f3d0; margin-bottom: 0.85rem;">Proposed Solution</h3>

          <div class="box-hook-statement">
            "A single unified platform combining <strong>crowdsourced relief reporting</strong> with <strong>AI-assisted verification</strong>, live mapping, and cross-camp coordination."
          </div>

          <ul class="box-items-list">
            <li class="box-item">
              <span class="box-item-icon">✓</span>
              <div class="box-item-text">
                <strong>Instant Discovery &amp; Visibility:</strong> Survivors find the nearest verified camp instantly with live vacancies; relief camps gain complete cross-camp resource status.
              </div>
            </li>
            <li class="box-item">
              <span class="box-item-icon">✓</span>
              <div class="box-item-text">
                <strong>Unified Ground Picture:</strong> NGOs eliminate duplicate efforts and coordinate sectors; government authorities receive one single, live, verified ground picture.
              </div>
            </li>
            <li class="box-item">
              <span class="box-item-icon">✓</span>
              <div class="box-item-text">
                <strong>AI Intelligence &amp; Zero-Net Fallback:</strong> AI-driven trust scoring eliminates misinformation, automated need-vs-supply matching balances stockpiles, AI rescue routing optimizes convoys, and SMS/offline fallback guarantees 100% operation in zero-connectivity zones.
              </div>
            </li>
          </ul>

          <div style="margin-top:1.5rem; background:rgba(16,185,129,0.08); border-radius:var(--radius-md); padding:0.85rem 1rem; border:1px solid rgba(16,185,129,0.2); font-size:0.85rem; color:#d1fae5;">
            💡 <strong>Demonstration Note:</strong> Switch to the interactive tabs above to test the fuzzy matching engine, live map locator, and offline SMS gateway live in action.
          </div>
        </div>

      </div>

      <!-- Footer & Typography Adjustment Controls -->
      <div class="presentation-footer">
        <div>
          <span>Target Problem ID: <strong>SIH-2026-DISASTER-RELIEF</strong></span> • 
          <span>Theme: Humanitarian Disaster Management</span>
        </div>
        <div class="presentation-controls">
          <label style="font-size:0.75rem; color:#94a3b8; display:flex; align-items:center; gap:0.35rem;">
            Adjust Font Size:
            <input type="range" id="font-scale-slider" min="13" max="18" value="15" style="width:90px; cursor:pointer;" />
          </label>
          <button class="btn btn-secondary btn-sm" id="btn-toggle-fullscreen" style="background:#1e293b; color:#cbd5e1; border-color:#334155;">
            ⛶ Fullscreen Slide
          </button>
        </div>
      </div>
    </div>
  `;

  // Attach Font Scaler Slider
  const fontSlider = container.querySelector('#font-scale-slider');
  const boxesGrid = container.querySelector('#presentation-boxes-grid');
  if (fontSlider && boxesGrid) {
    fontSlider.addEventListener('input', (e) => {
      const size = e.target.value;
      boxesGrid.querySelectorAll('.box-item').forEach((el) => {
        el.style.fontSize = `${size}px`;
      });
      boxesGrid.querySelectorAll('.box-hook-statement').forEach((el) => {
        el.style.fontSize = `${Number(size) + 1}px`;
      });
    });
  }

  // Fullscreen toggle
  const fsBtn = container.querySelector('#btn-toggle-fullscreen');
  const stage = container.querySelector('#presentation-stage-box');
  if (fsBtn && stage) {
    fsBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        stage.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
  }
}
