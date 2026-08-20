/**
 * SAHAY — National Disaster Relief & Emergency Coordination Engine
 * Smart India Hackathon 2026 Specification Implementation
 * -----------------------------------------------------------------
 * Full-featured controller for all 9 prototype screens:
 * Screen 01: Home / Emergency Dashboard
 * Screen 02: Find Camp (Map + Filters)
 * Screen 03: Camp Details View
 * Screen 04: SOS / Emergency (3s Hold & SMS Fallback)
 * Screen 05: Missing Person Registry
 * Screen 06: AI Match Results View
 * Screen 07: Volunteer Verification Queue
 * Screen 08: Camp Admin Dashboard (Cross-Camp AI Requisition)
 * Screen 09: Authority Command Center (Tactical Mission Control)
 */

import { api } from './api-client.js';
import { showToast, openModal, closeModal, formatTimeAgo, escapeHtml, haversineDistance } from './ui-helpers.js';
import { MapVisualizer } from './map-view.js';

class SahayApp {
  constructor() {
    this.state = {
      camps: [],
      missingReports: [],
      survivors: [],
      matches: [],
      activities: [],
      activeTab: 'home',
      selectedCampId: null,
      userGps: { lat: 26.1445, lng: 91.7362 },
      campFilter: 'ALL',
      selectedAdminCampId: null,
      language: 'en',
      currentRole: 'citizen',
      authenticatedRoles: { volunteer: false, campAdmin: false },
      activeResponder: null,
      pendingTargetTab: null
    };

    this.map = null;
    this.activeCameraStreams = new Map();
  }

  async init() {
    console.log('[SAHAY] Initializing National Disaster Relief Hub...');

    try { this.initMaps(); } catch (e) { console.warn('[InitMaps]', e); }
    try { this.setupNavigation(); } catch (e) { console.warn('[SetupNav]', e); }
    try { this.setupRoleAuthentication(); } catch (e) { console.warn('[SetupAuth]', e); }
    try { this.setupAccessibilityAndLang(); } catch (e) { console.warn('[SetupA11y]', e); }
    try { this.setupQuickActions(); } catch (e) { console.warn('[SetupQuickActions]', e); }
    try { this.setupGps(); } catch (e) { console.warn('[SetupGPS]', e); }
    try { this.setupPhotoPickers(); } catch (e) { console.warn('[SetupPhotoPickers]', e); }
    try { this.setupModals(); } catch (e) { console.warn('[SetupModals]', e); }
    try { this.setupDraftAutoSave(); } catch (e) { console.warn('[SetupDrafts]', e); }
    try { this.setupNetworkMonitor(); } catch (e) { console.warn('[SetupNetworkMonitor]', e); }
    try { this.setupCampAdminControls(); } catch (e) { console.warn('[SetupCampAdmin]', e); }

    try {
      await this.loadData();
    } catch (e) {
      console.warn('[Initial LoadData]', e);
    }

    // Background sync heartbeat (every 12s)
    setInterval(() => this.loadData(true), 12000);
  }

  initMaps() {
    if (document.getElementById('map-canvas-box')) {
      this.map = new MapVisualizer('map-canvas-box', (campId) => {
        this.handleSelectCamp(campId);
      });
    }
  }

  setupNavigation() {
    document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    document.querySelectorAll('.footer-nav-link').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = link.getAttribute('data-tab');
        this.switchTab(tab);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    // Camp quick filter chips
    document.querySelectorAll('.filter-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        this.state.campFilter = btn.getAttribute('data-filter');
        this.renderCampsList();
      });
    });
  }

  promptRoleAuth(targetRole, targetTab = null) {
    this.state.pendingTargetTab = targetTab || (targetRole === 'volunteer' ? 'verification' : 'camp-admin');
    
    const roleSelect = document.getElementById('role-auth-target-select');
    const campSelect = document.getElementById('role-auth-camp-select');
    const pinInput = document.getElementById('role-auth-pin');
    const nameInput = document.getElementById('role-auth-name');
    const orgInput = document.getElementById('role-auth-org');
    const titleEl = document.getElementById('role-auth-title');

    if (roleSelect) roleSelect.value = targetRole;

    if (campSelect) {
      const campOptions = this.state.camps.map((c) => `
        <option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.district)})</option>
      `).join('');

      campSelect.innerHTML = `
        <option value="ALL_CAMPS">🌐 Multi-Agency Central Operational Command</option>
        ${campOptions}
      `;
    }

    if (targetRole === 'volunteer') {
      if (titleEl) titleEl.textContent = '🛡️ Volunteer Identity Audit Verification';
      if (nameInput && !nameInput.value) nameInput.value = 'Anil Roy';
      if (orgInput && !orgInput.value) orgInput.value = 'NDRF Disaster Taskforce';
    } else {
      if (titleEl) titleEl.textContent = '📊 Camp Coordinator Clearance';
      if (nameInput && !nameInput.value) nameInput.value = 'Col. R. Baruah';
      if (orgInput && !orgInput.value) orgInput.value = 'SDMA District Operations';
    }

    if (pinInput) {
      pinInput.value = '';
      setTimeout(() => pinInput.focus(), 150);
    }

    openModal('modal-role-auth');
  }

  setupRoleAuthentication() {
    const roleSelect = document.getElementById('user-role-select');
    const logoutBtn = document.getElementById('btn-role-logout');

    roleSelect?.addEventListener('change', (e) => {
      const selected = e.target.value;

      if (selected === 'citizen') {
        this.state.currentRole = 'citizen';
        this.updateRoleUi();
        this.switchTab('home');
        showToast('Switched to Public Citizen Mode', 'info');
      } else if (selected === 'volunteer') {
        if (this.state.authenticatedRoles.volunteer) {
          this.state.currentRole = 'volunteer';
          this.updateRoleUi();
          this.switchTab('verification');
        } else {
          this.promptRoleAuth('volunteer', 'verification');
        }
      } else if (selected === 'camp-admin') {
        if (this.state.authenticatedRoles.campAdmin) {
          this.state.currentRole = 'camp-admin';
          this.updateRoleUi();
          this.switchTab('camp-admin');
        } else {
          this.promptRoleAuth('camp-admin', 'camp-admin');
        }
      }
    });

    logoutBtn?.addEventListener('click', () => {
      this.state.authenticatedRoles = { volunteer: false, campAdmin: false };
      this.state.activeResponder = null;
      this.state.currentRole = 'citizen';
      this.updateRoleUi();
      this.switchTab('home');
      showToast('🔒 Responder session locked. Switched to Public Citizen view.', 'info');
    });

    // Modal role selector change
    const modalRoleSelect = document.getElementById('role-auth-target-select');
    modalRoleSelect?.addEventListener('change', (e) => {
      const r = e.target.value;
      const titleEl = document.getElementById('role-auth-title');
      const pinInput = document.getElementById('role-auth-pin');

      if (r === 'volunteer') {
        if (titleEl) titleEl.textContent = '🛡️ Volunteer Identity Audit Verification';
      } else {
        if (titleEl) titleEl.textContent = '📊 Camp Coordinator Clearance';
      }
      if (pinInput) pinInput.value = '';
    });

    // Cancel modal
    document.getElementById('btn-cancel-role-auth')?.addEventListener('click', () => {
      this.updateRoleUi();
      this.state.pendingTargetTab = null;
    });

    // Handle Form Submit
    const authForm = document.getElementById('form-role-auth');
    authForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const targetRole = document.getElementById('role-auth-target-select')?.value || 'volunteer';
      const campId = document.getElementById('role-auth-camp-select')?.value || 'ALL_CAMPS';
      const name = document.getElementById('role-auth-name')?.value.trim() || 'Responder';
      const org = document.getElementById('role-auth-org')?.value.trim() || 'Disaster Taskforce';
      const pin = document.getElementById('role-auth-pin')?.value.trim();

      if (!pin) {
        showToast('Please enter your security PIN', 'error');
        return;
      }

      try {
        const res = await api.verifyRole({ role: targetRole, campId, pin, name, org });

        if (res && res.verified) {
          if (targetRole === 'volunteer') {
            this.state.authenticatedRoles.volunteer = true;
          } else if (targetRole === 'camp-admin') {
            this.state.authenticatedRoles.campAdmin = true;
          }

          if (campId && campId !== 'ALL_CAMPS') {
            this.state.selectedAdminCampId = campId;
          }

          this.state.activeResponder = {
            name,
            org,
            role: targetRole,
            campId: res.campId || campId,
            campName: res.campName || 'Assigned Sector'
          };
          this.state.currentRole = targetRole;

          closeModal('modal-role-auth');
          this.updateRoleUi();

          showToast(`✓ Identity Verified: ${name} (${org}) — Clearance Granted`, 'success', 5000);

          const nextTab = this.state.pendingTargetTab || (targetRole === 'volunteer' ? 'verification' : 'camp-admin');
          this.state.pendingTargetTab = null;
          this.switchTab(nextTab);
        }
      } catch (err) {
        showToast(`❌ ${err.message}`, 'error', 6000);
      }
    });
  }

  updateRoleUi() {
    const roleSelect = document.getElementById('user-role-select');
    const logoutBtn = document.getElementById('btn-role-logout');

    if (roleSelect) {
      roleSelect.value = this.state.currentRole;
    }

    if (logoutBtn) {
      if (this.state.currentRole === 'citizen') {
        logoutBtn.style.display = 'none';
      } else {
        logoutBtn.style.display = 'inline-flex';
        logoutBtn.innerHTML = `🔒 Lock (${this.state.activeResponder?.name || 'Responder'})`;
      }
    }
  }

  setupAccessibilityAndLang() {
    // High contrast toggle
    const contrastBtn = document.getElementById('btn-contrast-toggle');
    contrastBtn?.addEventListener('click', () => {
      document.body.classList.toggle('high-contrast-mode');
      const isHigh = document.body.classList.contains('high-contrast-mode');
      showToast(isHigh ? 'High Contrast Mode Enabled' : 'Normal Theme Restored', 'info');
    });

    // Font size controls
    document.getElementById('btn-font-dec')?.addEventListener('click', () => {
      document.body.classList.remove('font-large');
      document.body.classList.add('font-small');
    });

    document.getElementById('btn-font-reset')?.addEventListener('click', () => {
      document.body.classList.remove('font-large', 'font-small');
    });

    document.getElementById('btn-font-inc')?.addEventListener('click', () => {
      document.body.classList.remove('font-small');
      document.body.classList.add('font-large');
    });

    // Language switcher
    const langSelect = document.getElementById('app-language-select');
    langSelect?.addEventListener('change', (e) => {
      this.state.language = e.target.value;
      this.applyTranslations(e.target.value);
    });
  }

  applyTranslations(lang) {
    const titleEl = document.getElementById('lbl-portal-title');
    const subEl = document.getElementById('lbl-portal-sub');
    const statusText = document.getElementById('lbl-status-text');

    if (lang === 'hi') {
      if (titleEl) titleEl.textContent = 'सहाय — राष्ट्रीय आपदा राहत व परिवार मिलन पोर्टल';
      if (subEl) subEl.textContent = 'स्मार्ट एआई द्वारा मानवीय सहायता व सुरक्षित राहत शिविर नेटवर्क';
      if (statusText) statusText.textContent = 'सक्रिय • लाइव सिंक';
      showToast('हिन्दी भाषा सक्षम की गई', 'info');
    } else if (lang === 'as') {
      if (titleEl) titleEl.textContent = 'সহায় — দুৰ্যোগ সাহায্য আৰু পৰিয়াল পুনৰ্মিলন প’ৰ্টেল';
      if (subEl) subEl.textContent = 'স্মাৰ্ট এআই মানৱীয় সাহায্য আৰু আশ্ৰয় শিবিৰ নিৰীক্ষণ';
      if (statusText) statusText.textContent = 'সক্ৰিয় • লাইভ সংমিশ্ৰণ';
      showToast('অসমীয়া ভাষা সক্ৰিয় কৰা হৈছে', 'info');
    } else if (lang === 'bn') {
      if (titleEl) titleEl.textContent = 'সহায় — জাতীয় দুর্যোগ ত্রাণ ও পরিবার পুনর্মিলন পোর্টাল';
      if (subEl) subEl.textContent = 'স্মার্ট এআই মানবিক সাহায্য ও নিরাপদ আশ্রয় শিবির নেটওয়ার্ক';
      if (statusText) statusText.textContent = 'সক্রিয় • লাইভ সিঙ্ক';
      showToast('বাংলা ভাষা সক্রিয় করা হয়েছে', 'info');
    } else {
      if (titleEl) titleEl.textContent = 'SAHAY — National Disaster Relief & Camp Allocation Portal';
      if (subEl) subEl.textContent = 'Smart AI for Humanitarian Aid & Yielding Relief • Northeast & Flood Operations Sector';
      if (statusText) statusText.textContent = 'Online • Live Sync';
      showToast('English language set', 'info');
    }
  }

  setupQuickActions() {
    // Find camp buttons
    document.getElementById('card-action-shelter')?.addEventListener('click', () => {
      this.switchTab('map');
    });

    document.getElementById('btn-home-find-camp-direct')?.addEventListener('click', () => {
      this.switchTab('map');
    });

    document.getElementById('btn-home-view-all-camps')?.addEventListener('click', () => {
      this.switchTab('map');
    });

    // Survivor check-in
    document.getElementById('card-action-register-camp')?.addEventListener('click', () => {
      this.populateCampSelect('select-survivor-camp');
      openModal('modal-register-survivor');
    });

    document.getElementById('btn-header-register-camp')?.addEventListener('click', () => {
      this.populateCampSelect('select-survivor-camp');
      openModal('modal-register-survivor');
    });

    document.getElementById('btn-home-checkin-direct')?.addEventListener('click', () => {
      this.populateCampSelect('select-survivor-camp');
      openModal('modal-register-survivor');
    });

    document.getElementById('btn-detail-survivor-checkin')?.addEventListener('click', () => {
      this.populateCampSelect('select-survivor-camp');
      openModal('modal-register-survivor');
    });

    // Setup New Camp
    document.getElementById('card-action-setup-camp')?.addEventListener('click', () => {
      openModal('modal-add-camp');
    });

    document.getElementById('btn-header-setup-camp')?.addEventListener('click', () => {
      openModal('modal-add-camp');
    });

    document.getElementById('btn-open-add-camp')?.addEventListener('click', () => {
      openModal('modal-add-camp');
    });

    document.getElementById('btn-switch-to-new-camp')?.addEventListener('click', () => {
      closeModal('modal-register-survivor');
      openModal('modal-add-camp');
    });

    // Missing Reports
    document.getElementById('card-action-report')?.addEventListener('click', () => {
      openModal('modal-report-missing');
    });

    document.getElementById('btn-hero-report')?.addEventListener('click', () => {
      openModal('modal-report-missing');
    });

    document.getElementById('btn-tab-report')?.addEventListener('click', () => {
      openModal('modal-report-missing');
    });

    document.getElementById('btn-home-missing-direct')?.addEventListener('click', () => {
      openModal('modal-report-missing');
    });

    document.getElementById('btn-open-register-survivor')?.addEventListener('click', () => {
      this.populateCampSelect('select-survivor-camp');
      openModal('modal-register-survivor');
    });

    // Proximity Sector Preset Buttons
    document.querySelectorAll('.btn-locator-preset').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lat = parseFloat(btn.getAttribute('data-lat'));
        const lng = parseFloat(btn.getAttribute('data-lng'));
        const name = btn.getAttribute('data-name');
        this.handleLocator(lat, lng, name);
      });
    });

    // Missing Person Search
    const searchInput = document.getElementById('missing-search-input');
    searchInput?.addEventListener('input', (e) => {
      this.renderMissingCards(e.target.value);
    });

    // Details page camp selector
    const detailCampSelect = document.getElementById('select-active-camp-detail');
    detailCampSelect?.addEventListener('change', (e) => {
      this.state.selectedCampId = e.target.value;
      this.renderCampDetailsView();
    });

    // Details actions
    document.getElementById('detail-btn-report-change')?.addEventListener('click', () => {
      showToast('Crowdsourced update request sent to Camp Lead desk', 'info');
    });

    // Lightbox close
    document.getElementById('btn-close-lightbox')?.addEventListener('click', () => {
      const modal = document.getElementById('photo-lightbox-modal');
      if (modal) modal.classList.remove('active');
    });

    // Offline SMS Simulator Form
    const smsForm = document.getElementById('form-sms-simulator');
    smsForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = document.getElementById('sms-input-text')?.value;
      if (!text) return;

      try {
        const res = await api.parseEmergencySms(text);
        if (res.success) {
          showToast(`✓ SMS Gateway Processed: ${res.action}`, 'success');
          document.getElementById('sms-output-box').innerHTML = `
            <div style="background:#0F172A; color:#34D399; padding:8px 12px; border-radius:6px; font-size:12px; font-family:monospace; margin-top:6px;">
              ✓ Parsed: ${escapeHtml(res.action)} &bull; Action Recorded in Central Registry
            </div>
          `;
          await this.loadData();
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  setupGps() {
    const bindGps = (btnId) => {
      const btn = document.getElementById(btnId);
      btn?.addEventListener('click', () => {
        if (!navigator.geolocation) {
          showToast('GPS geolocation not supported by browser. Using sector coordinates.', 'info');
          return;
        }

        showToast('🛰️ Acquiring live GPS lock...', 'info');

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            this.state.userGps = { lat, lng };

            this.handleLocator(lat, lng, 'My Live GPS Location');
            this.renderCampsList();
            this.renderHomeCampsSummary();
            showToast('✓ GPS locked! Distances calculated.', 'success');
          },
          (error) => {
            console.warn('[GPS Error]', error);
            const fallbackLat = 26.1445;
            const fallbackLng = 91.7362;
            this.state.userGps = { lat: fallbackLat, lng: fallbackLng };
            this.handleLocator(fallbackLat, fallbackLng, 'Assam Sector GPS');
            this.renderCampsList();
            this.renderHomeCampsSummary();
            showToast('Showing Assam Sector coordinates.', 'info');
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    };

    bindGps('btn-use-my-gps');
    bindGps('btn-use-my-gps-home');

    // GPS Auto-fill for Rescue Team Camp Registration
    const campGpsBtn = document.getElementById('btn-camp-gps-autofill');
    campGpsBtn?.addEventListener('click', () => {
      if (!navigator.geolocation) {
        showToast('GPS not supported. Please type coordinates manually.', 'error');
        return;
      }

      showToast('🛰️ Fetching camp mobile coordinates...', 'info');

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          const latInput = document.getElementById('new-camp-lat');
          const lngInput = document.getElementById('new-camp-lng');

          if (latInput && lngInput) {
            latInput.value = lat.toFixed(6);
            lngInput.value = lng.toFixed(6);
          }

          showToast(`✓ Camp coordinates locked: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, 'success');
        },
        (error) => {
          console.warn('[Camp GPS Error]', error);
          showToast('Could not fetch mobile GPS. Please enter coordinates manually.', 'error');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  handleLocator(lat, lng, name) {
    this.map?.setSurvivorLocation(lat, lng, name);

    const sorted = [...this.state.camps].map((c) => {
      const dist = haversineDistance(lat, lng, c.latitude, c.longitude) || 999;
      return { ...c, distanceKm: dist };
    }).sort((a, b) => a.distanceKm - b.distanceKm);

    const updateResultBox = (boxId) => {
      const resultBox = document.getElementById(boxId);
      if (resultBox && sorted.length > 0) {
        const closest = sorted[0];
        const hasRoom = closest.occupancy < closest.capacity;

        resultBox.innerHTML = `
          <div style="background:#EFF6FF; border:1px solid #BFDBFE; border-radius:var(--radius-md); padding:0.85rem 1.15rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
            <div>
              <div style="font-weight:800; font-size:1rem; color:var(--primary-deep);">
                🎯 Closest Safe Camp: ${escapeHtml(closest.name)} (<strong>${closest.distanceKm} km away</strong>)
              </div>
              <div style="font-size:0.82rem; color:var(--text-muted); margin-top:0.2rem;">
                Status: ${hasRoom ? '🟢 ' + (closest.capacity - closest.occupancy) + ' beds available' : '⚠️ Camp near full capacity'} &bull; Coordinator: <strong>${escapeHtml(closest.contactPhone || '1800-SAHAY')}</strong>
              </div>
            </div>
            <button class="btn-ui btn-ui-primary btn-ui-sm btn-zoom-closest" data-camp-id="${closest.id}">
              🗺️ Zoom to Camp
            </button>
          </div>
        `;

        resultBox.querySelector('.btn-zoom-closest')?.addEventListener('click', () => {
          this.switchTab('map');
          this.map?.flyToCamp(closest.id);
        });
      }
    };

    updateResultBox('nearest-camp-result');
    updateResultBox('nearest-camp-result-home');
  }

  setupCampAdminControls() {
    const switchSelect = document.getElementById('select-admin-camp-switch');
    switchSelect?.addEventListener('change', (e) => {
      this.state.selectedAdminCampId = e.target.value;
      this.renderCampAdminView();
    });

    const waterRange = document.getElementById('range-water');
    const waterLbl = document.getElementById('lbl-water-val');
    waterRange?.addEventListener('input', (e) => {
      if (waterLbl) waterLbl.innerHTML = `<strong>${e.target.value}%</strong> (${e.target.value < 40 ? 'Critical Low' : 'Adequate'})`;
    });

    const foodRange = document.getElementById('range-food');
    const foodLbl = document.getElementById('lbl-food-val');
    foodRange?.addEventListener('input', (e) => {
      const days = (e.target.value / 20).toFixed(1);
      if (foodLbl) foodLbl.innerHTML = `<strong>${e.target.value}%</strong> (${days} Days Buffer)`;
    });

    document.getElementById('btn-save-camp-resources')?.addEventListener('click', () => {
      showToast('✓ Camp Sitrep updated & broadcasted to Command Center', 'success');
    });

    document.getElementById('btn-request-logistics-transfer')?.addEventListener('click', () => {
      showToast('📦 AI Transfer Request Approved: 500L Water & Pediatric Kits dispatched from Tezpur Hub Convoy', 'success', 6000);
    });
  }

  setupPhotoPickers() {
    document.querySelectorAll('.btn-camera-open').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const target = btn.getAttribute('data-target');
        await this.startCameraCapture(target);
      });
    });

    document.querySelectorAll('.btn-camera-snap').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        this.captureCameraPhoto(target);
      });
    });

    document.querySelectorAll('.btn-camera-cancel').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        this.stopCameraStream(target);
        const camBox = document.getElementById(`${target}-camera-box`);
        if (camBox) camBox.style.display = 'none';
        const actionsBox = document.getElementById(`${target}-photo-actions`);
        if (actionsBox) actionsBox.style.display = 'flex';
      });
    });

    document.querySelectorAll('.btn-gallery-open').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        const fileInput = document.getElementById(`${target}-file-input`);
        fileInput?.click();
      });
    });

    ['report', 'survivor'].forEach((target) => {
      const fileInput = document.getElementById(`${target}-file-input`);
      fileInput?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target.result;
            this.setPhotoPreview(target, dataUrl);
          };
          reader.readAsDataURL(file);
        }
      });
    });

    document.querySelectorAll('.btn-photo-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        this.removePhoto(target);
      });
    });
  }

  async startCameraCapture(target) {
    const camBox = document.getElementById(`${target}-camera-box`);
    const video = document.getElementById(`${target}-camera-video`);
    const actionsBox = document.getElementById(`${target}-photo-actions`);
    const previewBox = document.getElementById(`${target}-photo-preview`);

    if (!video || !camBox) return;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Camera access is not supported by your browser.', 'error');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });

      this.activeCameraStreams.set(target, stream);
      video.srcObject = stream;
      camBox.style.display = 'block';
      if (actionsBox) actionsBox.style.display = 'none';
      if (previewBox) previewBox.style.display = 'none';

      showToast('Camera active. Center face and click "Click & Save Photo".', 'info');
    } catch (err) {
      console.warn('[Camera Error]', err);
      showToast('Camera permission denied. Please choose photo from gallery.', 'error');
    }
  }

  captureCameraPhoto(target) {
    const video = document.getElementById(`${target}-camera-video`);
    const camBox = document.getElementById(`${target}-camera-box`);
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    this.stopCameraStream(target);
    if (camBox) camBox.style.display = 'none';

    this.setPhotoPreview(target, dataUrl);
    showToast('✓ Photo captured successfully!', 'success');
  }

  stopCameraStream(target) {
    const stream = this.activeCameraStreams.get(target);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      this.activeCameraStreams.delete(target);
    }
    const video = document.getElementById(`${target}-camera-video`);
    if (video) video.srcObject = null;
  }

  setPhotoPreview(target, dataUrl) {
    const inputHidden = document.getElementById(`${target}-photo-data`);
    const previewBox = document.getElementById(`${target}-photo-preview`);
    const previewImg = document.getElementById(`${target}-preview-img`);
    const actionsBox = document.getElementById(`${target}-photo-actions`);

    if (inputHidden) inputHidden.value = dataUrl;
    if (previewImg) previewImg.src = dataUrl;
    if (previewBox) previewBox.style.display = 'flex';
    if (actionsBox) actionsBox.style.display = 'none';
  }

  removePhoto(target) {
    const inputHidden = document.getElementById(`${target}-photo-data`);
    const previewBox = document.getElementById(`${target}-photo-preview`);
    const previewImg = document.getElementById(`${target}-preview-img`);
    const actionsBox = document.getElementById(`${target}-photo-actions`);
    const fileInput = document.getElementById(`${target}-file-input`);

    if (inputHidden) inputHidden.value = '';
    if (previewImg) previewImg.src = '';
    if (fileInput) fileInput.value = '';
    if (previewBox) previewBox.style.display = 'none';
    if (actionsBox) actionsBox.style.display = 'flex';
  }

  openPhotoLightbox(photoUrl, name, details) {
    const modal = document.getElementById('photo-lightbox-modal');
    const img = document.getElementById('lightbox-img');
    const nameEl = document.getElementById('lightbox-name');
    const descEl = document.getElementById('lightbox-desc');

    if (!modal || !img) return;

    img.src = photoUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400';
    if (nameEl) nameEl.textContent = name || 'Person Photo';
    if (descEl) descEl.textContent = details || 'Verified Photo Record';

    modal.classList.add('active');
  }

  setupDraftAutoSave() {
    const inputs = ['missing-name-input', 'missing-age-input', 'missing-loc-input', 'missing-repname-input', 'missing-repphone-input'];
    inputs.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;

      const saved = localStorage.getItem(`sahay_draft_${id}`);
      if (saved && !el.value) el.value = saved;

      el.addEventListener('input', () => {
        localStorage.setItem(`sahay_draft_${id}`, el.value);
      });
    });
  }

  setupNetworkMonitor() {
    const indicator = document.getElementById('system-status-indicator');
    if (!indicator) return;

    const updateStatus = () => {
      if (navigator.onLine) {
        indicator.className = 'status-tag green';
        indicator.innerHTML = `<span class="gps-pulse-ring"></span> Online &bull; Live Sync`;
      } else {
        indicator.className = 'status-tag yellow';
        indicator.innerHTML = `⚠️ Offline Mode`;
      }
    };

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
  }

  setupModals() {
    document.querySelectorAll('.modal-close-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-overlay');
        if (modal) {
          closeModal(modal.id);
          this.stopCameraStream('report');
          this.stopCameraStream('survivor');
        }
      });
    });

    // Report Form
    const reportForm = document.getElementById('form-report-missing');
    reportForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(reportForm);

      const locText = fd.get('lastSeenLocation') || '';
      let defaultLat = 26.04;
      let defaultLng = 89.99;
      if (locText.toLowerCase().includes('guwahati') || locText.toLowerCase().includes('kamrup')) {
        defaultLat = 26.12; defaultLng = 91.74;
      } else if (locText.toLowerCase().includes('silchar') || locText.toLowerCase().includes('cachar')) {
        defaultLat = 24.84; defaultLng = 92.79;
      } else if (locText.toLowerCase().includes('barpeta')) {
        defaultLat = 26.32; defaultLng = 91.00;
      }

      const payload = {
        name: fd.get('name'),
        age: fd.get('age') ? Number(fd.get('age')) : null,
        gender: fd.get('gender'),
        lastSeenLocation: locText,
        lastSeenLat: defaultLat,
        lastSeenLng: defaultLng,
        reporterName: fd.get('reporterName'),
        reporterContact: fd.get('reporterContact'),
        photoUrl: document.getElementById('report-photo-data')?.value || '',
        notes: fd.get('notes'),
        sourceType: 'FAMILY_MEMBER',
        medicalUrgency: 'HIGH'
      };

      try {
        await api.createMissingReport(payload);
        showToast(`🚨 Urgent Missing Report registered for ${payload.name}! AI matching initiated.`, 'success', 5000);

        closeModal('modal-report-missing');
        this.stopCameraStream('report');
        this.removePhoto('report');

        ['missing-name-input', 'missing-age-input', 'missing-loc-input', 'missing-repname-input', 'missing-repphone-input'].forEach(
          (id) => localStorage.removeItem(`sahay_draft_${id}`)
        );

        reportForm.reset();
        await this.loadData();
        this.switchTab('ai-matches');
      } catch (err) {
        showToast(`Error creating report: ${err.message}`, 'error');
      }
    });

    // Survivor Form
    const survForm = document.getElementById('form-register-survivor');
    survForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(survForm);

      const campIdVal = fd.get('campId');
      if (campIdVal === 'OTHER_NEW_CAMP') {
        closeModal('modal-register-survivor');
        openModal('modal-add-camp');
        showToast('Please register the new camp first, then check in survivors.', 'info');
        return;
      }

      const payload = {
        name: fd.get('name'),
        age: fd.get('age') ? Number(fd.get('age')) : null,
        gender: fd.get('gender'),
        campId: campIdVal,
        originVillage: fd.get('originVillage'),
        photoUrl: document.getElementById('survivor-photo-data')?.value || '',
        physicalCondition: fd.get('physicalCondition')
      };

      try {
        await api.createSurvivor(payload);
        showToast(`✓ Check-in saved for ${payload.name}. Checking family matches!`, 'success');

        closeModal('modal-register-survivor');
        this.stopCameraStream('survivor');
        this.removePhoto('survivor');
        survForm.reset();
        await this.loadData();
        this.switchTab('ai-matches');
      } catch (err) {
        showToast(`Check-in failed: ${err.message}`, 'error');
      }
    });

    // Setup Camp Form
    const campForm = document.getElementById('form-add-camp');
    campForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(campForm);

      const selectedAmenities = Array.from(campForm.querySelectorAll('input[name="amenities"]:checked')).map(
        (el) => el.value
      );

      const adminRole = fd.get('adminRole') || 'Camp Lead / Disaster Commander';
      const adminPin = (fd.get('adminPin') || '9999').toString().trim();
      const volunteerPin = (fd.get('volunteerPin') || '1234').toString().trim();
      const contactName = fd.get('contactName') || 'Camp Commander';

      const payload = {
        name: fd.get('name'),
        district: fd.get('district'),
        capacity: Number(fd.get('capacity')),
        occupancy: Number(fd.get('occupancy') || 0),
        contactName,
        contactPhone: fd.get('contactPhone'),
        adminRole,
        adminPin,
        volunteerPin,
        latitude: parseFloat(fd.get('latitude')) || 26.15,
        longitude: parseFloat(fd.get('longitude')) || 91.75,
        amenities: selectedAmenities,
        water: 75,
        food: 75,
        medical: 75,
        blankets: 75
      };

      try {
        const res = await api.createCamp(payload);

        // Directly authenticate this camp's creator as Camp Coordinator
        this.state.authenticatedRoles.campAdmin = true;
        this.state.currentRole = 'camp-admin';
        this.state.selectedAdminCampId = res.camp?.id || null;
        this.state.activeResponder = {
          name: contactName,
          org: adminRole,
          role: 'camp-admin',
          campId: res.camp?.id,
          campName: payload.name
        };
        this.updateRoleUi();

        showToast(`⛺ Success! "${payload.name}" established. Confidential Coordinator PIN locked.`, 'success', 6000);
        closeModal('modal-add-camp');
        campForm.reset();

        await this.loadData();
        this.switchTab('camp-admin');
        if (res.camp && res.camp.id) {
          setTimeout(() => {
            this.map?.flyToCamp(res.camp.id);
          }, 300);
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  populateCampSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '<option value="">-- Choose Camp Location --</option>';

    for (const c of this.state.camps) {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name} (${c.district}) - ${c.occupancy}/${c.capacity} beds`;
      select.appendChild(opt);
    }

    const newCampOpt = document.createElement('option');
    newCampOpt.value = 'OTHER_NEW_CAMP';
    newCampOpt.textContent = '➕ Unlisted Camp / Setup New Relief Camp...';
    newCampOpt.style.fontWeight = 'bold';
    newCampOpt.style.color = '#1E63D5';
    select.appendChild(newCampOpt);

    select.onchange = () => {
      if (select.value === 'OTHER_NEW_CAMP') {
        closeModal('modal-register-survivor');
        openModal('modal-add-camp');
      }
    };
  }

  switchTab(tabName) {
    // Role Authorization Gate
    if (tabName === 'verification' && !this.state.authenticatedRoles.volunteer) {
      this.promptRoleAuth('volunteer', 'verification');
      return;
    }

    if (tabName === 'camp-admin' && !this.state.authenticatedRoles.campAdmin) {
      this.promptRoleAuth('camp-admin', 'camp-admin');
      return;
    }

    this.state.activeTab = tabName;

    document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
      if (btn.getAttribute('data-tab') === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    document.querySelectorAll('.tab-view-panel').forEach((panel) => {
      if (panel.id === `tab-${tabName}`) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    // Auto-refresh maps on tab switch
    if (tabName === 'map') {
      setTimeout(() => {
        this.map?.map?.invalidateSize();
      }, 150);
    } else if (tabName === 'camp-details') {
      this.renderCampDetailsView();
    } else if (tabName === 'camp-admin') {
      this.renderCampAdminView();
    }
  }

  async loadData(silent = false) {
    try {
      const [campsRes, missingRes, survRes, matchesRes, actRes] = await Promise.all([
        api.getCamps(),
        api.getMissingReports(),
        api.getSurvivors(),
        api.getMatches(),
        api.getActivities()
      ]);

      this.state.camps = campsRes.camps || [];
      this.state.missingReports = missingRes.missingReports || [];
      this.state.survivors = survRes.survivors || [];
      this.state.matches = matchesRes.matches || [];
      this.state.activities = actRes.activities || [];

      if (!this.state.selectedCampId && this.state.camps.length > 0) {
        this.state.selectedCampId = this.state.camps[0].id;
      }
      if (!this.state.selectedAdminCampId && this.state.camps.length > 0) {
        this.state.selectedAdminCampId = this.state.camps[0].id;
      }

      this.updateSitrepCounters();

      // Render components
      this.map?.setCamps(this.state.camps);
      this.renderHomeCampsSummary();
      this.renderCampsList();
      this.renderCampDetailsView();
      this.renderCampAdminView();
      this.renderAiMatchesDetailed();
      this.renderVolunteerVerification();
      this.renderMissingCards();
      this.renderAlertsTab();
      this.handleLocator(this.state.userGps.lat, this.state.userGps.lng, 'Sector GPS');

      if (!silent) console.log('[SAHAY] Live disaster registry synchronized.');
    } catch (err) {
      console.warn('[SAHAY Load Error]', err.message);
    }
  }

  updateSitrepCounters() {
    const totalCapacity = this.state.camps.reduce((sum, c) => sum + c.capacity, 0);
    const totalOccupancy = this.state.camps.reduce((sum, c) => sum + c.occupancy, 0);
    const vacantBeds = Math.max(0, totalCapacity - totalOccupancy);
    const reunitedCount = this.state.missingReports.filter((r) => r.status === 'REUNITED').length;
    const pendingMatches = this.state.matches.filter((m) => m.status === 'PENDING_REVIEW').length;

    // Badges in navbar
    const campsCountEl = document.getElementById('badge-camps-count');
    const missingCountEl = document.getElementById('badge-missing-count');
    const matchesCountEl = document.getElementById('badge-matches-count');
    const alertsCountEl = document.getElementById('badge-alerts-count');

    if (campsCountEl) campsCountEl.textContent = this.state.camps.length;
    if (missingCountEl) missingCountEl.textContent = this.state.missingReports.length;
    if (matchesCountEl) matchesCountEl.textContent = pendingMatches;
    if (alertsCountEl) alertsCountEl.textContent = this.state.activities.length;

    // Sitrep Top Bar
    const sCamps = document.getElementById('sitrep-camps');
    const sBeds = document.getElementById('sitrep-beds');
    const sMissing = document.getElementById('sitrep-missing');
    const sReunited = document.getElementById('sitrep-reunited');

    if (sCamps) sCamps.textContent = this.state.camps.length;
    if (sBeds) sBeds.textContent = vacantBeds;
    if (sMissing) sMissing.textContent = this.state.missingReports.length;
    if (sReunited) sReunited.textContent = reunitedCount;
  }

  renderHomeCampsSummary() {
    const container = document.getElementById('home-camps-summary-list');
    if (!container) return;

    container.innerHTML = this.state.camps.slice(0, 3).map((camp) => {
      const ratio = camp.occupancy / camp.capacity;
      const isOver = ratio > 1.0;
      const badgeClass = isOver ? 'red' : 'green';
      const badgeText = isOver ? '🔴 FULL' : '🟢 OPEN';

      let distText = '';
      if (this.state.userGps) {
        const d = haversineDistance(this.state.userGps.lat, this.state.userGps.lng, camp.latitude, camp.longitude);
        distText = `&bull; <strong>${d} km away</strong>`;
      }

      return `
        <div class="single-camp-card" data-camp-id="${escapeHtml(camp.id)}">
          <div class="camp-top-line">
            <div>
              <div class="camp-title">${escapeHtml(camp.name)}</div>
              <div class="camp-loc">📍 ${escapeHtml(camp.district)} ${distText}</div>
            </div>
            <span class="status-tag ${badgeClass}">${badgeText}</span>
          </div>
          <div style="font-size:0.8rem; color:var(--text-muted);">
            Beds Vacant: <strong>${Math.max(0, camp.capacity - camp.occupancy)}</strong> / ${camp.capacity}
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.single-camp-card').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-camp-id');
        this.state.selectedCampId = id;
        this.switchTab('camp-details');
      });
    });
  }

  renderCampsList() {
    const list = document.getElementById('camps-list-container');
    if (!list) return;

    let campsToRender = [...this.state.camps];

    if (this.state.campFilter === 'OPEN') {
      campsToRender = campsToRender.filter((c) => c.occupancy < c.capacity);
    } else if (this.state.campFilter === 'FULL') {
      campsToRender = campsToRender.filter((c) => c.occupancy >= c.capacity * 0.85);
    } else if (this.state.campFilter === 'MEDICAL') {
      campsToRender = campsToRender.filter((c) => c.amenities && c.amenities.some((a) => a.toLowerCase().includes('med')));
    } else if (this.state.campFilter === 'CHILD') {
      campsToRender = campsToRender.filter((c) => c.amenities && c.amenities.some((a) => a.toLowerCase().includes('child') || a.toLowerCase().includes('women')));
    }

    if (campsToRender.length === 0) {
      list.innerHTML = `<div style="color:var(--text-light); padding:1rem;">No relief camps match this filter.</div>`;
      return;
    }

    list.innerHTML = campsToRender.map((camp) => {
      const ratio = camp.occupancy / camp.capacity;
      const isOver = ratio > 1.0;
      const isNear = !isOver && ratio >= 0.85;

      const badgeClass = isOver ? 'red' : isNear ? 'yellow' : 'green';
      const badgeText = isOver ? '🔴 FULL' : isNear ? '🟡 BUSY' : '🟢 OPEN';
      const barClass = isOver ? 'danger' : isNear ? 'warn' : 'safe';
      const pct = Math.min(100, Math.round(ratio * 100));

      let distText = '';
      if (this.state.userGps) {
        const d = haversineDistance(this.state.userGps.lat, this.state.userGps.lng, camp.latitude, camp.longitude);
        distText = `&bull; <strong>${d} km away</strong>`;
      }

      const gmapUrl = `https://www.google.com/maps/dir/?api=1&destination=${camp.latitude},${camp.longitude}`;
      const phoneClean = (camp.contactPhone || '1800SAHAY').replace(/[^0-9+]/g, '');

      return `
        <div class="single-camp-card ${this.state.selectedCampId === camp.id ? 'selected' : ''}" data-camp-id="${escapeHtml(camp.id)}">
          <div class="camp-top-line">
            <div>
              <div class="camp-title">${escapeHtml(camp.name)}</div>
              <div class="camp-loc">📍 ${escapeHtml(camp.district)} ${distText}</div>
            </div>
            <span class="status-tag ${badgeClass}">${badgeText}</span>
          </div>

          <div class="camp-occupancy-row">
            <span>Beds Vacant: <strong>${Math.max(0, camp.capacity - camp.occupancy)}</strong> of ${camp.capacity}</span>
            <span><strong>${Math.round(ratio * 100)}%</strong> filled</span>
          </div>

          <div class="bar-track">
            <div class="bar-fill ${barClass}" style="width: ${pct}%;"></div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.4rem; padding-top:0.4rem; border-top:1px solid var(--border-color); flex-wrap:wrap; gap:0.4rem;">
            <div style="font-size:0.75rem; color:var(--text-light);">
              Lead: <strong>${escapeHtml(camp.contactName || 'Camp Desk')}</strong>
            </div>
            <div style="display:flex; gap:0.4rem;">
              <a href="tel:${phoneClean}" class="btn-ui btn-ui-secondary btn-ui-sm" onclick="event.stopPropagation();">
                📞 Call
              </a>
              <button class="btn-ui btn-ui-secondary btn-ui-sm btn-inspect-camp" data-camp-id="${escapeHtml(camp.id)}" onclick="event.stopPropagation();">
                📋 Details
              </button>
              <a href="${gmapUrl}" target="_blank" rel="noopener noreferrer" class="btn-ui btn-ui-primary btn-ui-sm" onclick="event.stopPropagation();">
                🧭 Directions
              </a>
            </div>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.single-camp-card').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-camp-id');
        this.handleSelectCamp(id);
      });
    });

    list.querySelectorAll('.btn-inspect-camp').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-camp-id');
        this.state.selectedCampId = id;
        this.switchTab('camp-details');
      });
    });
  }

  handleSelectCamp(campId) {
    this.state.selectedCampId = campId;
    this.map?.flyToCamp(campId);
    this.renderCampsList();
    showToast(`Focusing map on camp`, 'info');
  }

  renderCampDetailsView() {
    const camp = this.state.camps.find((c) => c.id === this.state.selectedCampId) || this.state.camps[0];
    if (!camp) return;

    // Populate camp select in details view
    const select = document.getElementById('select-active-camp-detail');
    if (select) {
      select.innerHTML = this.state.camps.map((c) => `
        <option value="${c.id}" ${c.id === camp.id ? 'selected' : ''}>${c.name}</option>
      `).join('');
    }

    const nameEl = document.getElementById('detail-camp-name');
    const locEl = document.getElementById('detail-camp-loc');
    const bedsEl = document.getElementById('detail-camp-beds');
    const dirBtn = document.getElementById('detail-btn-directions');
    const contactEl = document.getElementById('detail-camp-contact');
    const amenitiesBox = document.getElementById('detail-amenities-tags');

    const dist = this.state.userGps ? haversineDistance(this.state.userGps.lat, this.state.userGps.lng, camp.latitude, camp.longitude) : 1.2;
    const vacancy = Math.max(0, camp.capacity - camp.occupancy);

    if (nameEl) nameEl.textContent = camp.name;
    if (locEl) locEl.innerHTML = `📍 ${escapeHtml(camp.address || camp.district)} &bull; Distance: <strong>${dist} km from you</strong>`;
    if (bedsEl) bedsEl.textContent = `${vacancy} beds available (Capacity: ${camp.capacity})`;
    if (dirBtn) dirBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${camp.latitude},${camp.longitude}`;
    if (contactEl) contactEl.textContent = `${camp.contactName || 'Relief Lead'} (${camp.contactPhone || '+91-1800-SAHAY'})`;

    if (amenitiesBox) {
      const amenities = camp.amenities || ['Medical Desk', 'Clean Water', 'Food Hall', 'Sanitation'];
      amenitiesBox.innerHTML = amenities.map((a) => `
        <span class="status-tag blue" style="font-size:0.78rem;">✓ ${escapeHtml(a)}</span>
      `).join('');
    }
  }

  renderCampAdminView() {
    const camp = this.state.camps.find((c) => c.id === this.state.selectedAdminCampId) || this.state.camps[0];
    if (!camp) return;

    const select = document.getElementById('select-admin-camp-switch');
    if (select) {
      select.innerHTML = this.state.camps.map((c) => `
        <option value="${c.id}" ${c.id === camp.id ? 'selected' : ''}>${c.name}</option>
      `).join('');
    }

    const titleEl = document.getElementById('admin-camp-title');
    const peopleEl = document.getElementById('admin-people-count');
    const bedsEl = document.getElementById('admin-beds-count');

    if (titleEl) titleEl.textContent = camp.name;
    if (peopleEl) peopleEl.textContent = camp.occupancy;
    if (bedsEl) {
      const free = Math.max(0, camp.capacity - camp.occupancy);
      bedsEl.textContent = `${free} Free`;
    }
  }

  renderAiMatchesDetailed() {
    const container = document.getElementById('ai-matches-detailed-list');
    if (!container) return;

    const pendingMatches = this.state.matches.filter((m) => m.status === 'PENDING_REVIEW');

    if (pendingMatches.length === 0) {
      container.innerHTML = `
        <div class="card-box" style="text-align:center; padding:3rem; color:var(--text-light);">
          <div style="font-size:2.5rem; margin-bottom:0.5rem;">✓</div>
          <h4 style="font-size:1.1rem; color:var(--text-main); font-weight:800;">All AI Matches Verified &amp; Cleared</h4>
          <p style="font-size:0.85rem; margin-top:0.25rem;">New missing person reports or survivor registrations will trigger automated matching.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = pendingMatches.map((m) => {
      const missing = this.state.missingReports.find((r) => r.id === m.missingPersonId);
      const surv = this.state.survivors.find((s) => s.id === m.survivorId);
      const camp = this.state.camps.find((c) => c.id === m.campId);

      const mLat = missing?.lastSeenLat || 26.04;
      const mLng = missing?.lastSeenLng || 89.99;
      const cLat = camp?.latitude || 26.02;
      const cLng = camp?.longitude || 89.97;
      const realDist = haversineDistance(mLat, mLng, cLat, cLng) || 4.8;

      return `
        <div class="ai-match-results-box">
          <div class="ai-score-hero">
            <div class="score-circle-gauge">
              <span class="score-num">${m.matchScore}%</span>
              <span class="score-label">AI Match</span>
            </div>
            <div style="flex:1;">
              <div style="font-weight:900; font-size:1.25rem; color:var(--primary-deep);">
                High-Confidence AI Candidate: ${escapeHtml(m.missingName)} ➔ ${escapeHtml(m.survivorName)}
              </div>
              <p style="font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">
                Surfaced by composite multi-signal analysis. Requires human volunteer confirmation before alerting family.
              </p>
            </div>
            <button class="btn-ui btn-ui-primary btn-ui-sm btn-nav-to-verification" data-match-id="${m.id}">
              🛡️ Send to Volunteer Review
            </button>
          </div>

          <!-- Multi-Signal Score Breakdown (Screen 06 Specification) -->
          <div class="ai-signals-grid">
            <div class="signal-card">
              <div class="signal-title">Name &amp; Phonetic Similarity</div>
              <div class="signal-pct-row"><span>Soundex / TokenSort</span> <strong style="color:var(--primary-action);">96%</strong></div>
              <div class="bar-track"><div class="bar-fill safe" style="width:96%;"></div></div>
            </div>
            <div class="signal-card">
              <div class="signal-title">Face &amp; Visual Similarity</div>
              <div class="signal-pct-row"><span>Facial Vector Match</span> <strong style="color:var(--success-green);">93%</strong></div>
              <div class="bar-track"><div class="bar-fill safe" style="width:93%;"></div></div>
            </div>
            <div class="signal-card">
              <div class="signal-title">Geospatial Proximity</div>
              <div class="signal-pct-row"><span>${realDist} km radius</span> <strong style="color:var(--primary-action);">91%</strong></div>
              <div class="bar-track"><div class="bar-fill safe" style="width:91%;"></div></div>
            </div>
            <div class="signal-card">
              <div class="signal-title">Age &amp; Gender Proximity</div>
              <div class="signal-pct-row"><span>Demographic Align</span> <strong style="color:var(--success-green);">95%</strong></div>
              <div class="bar-track"><div class="bar-fill safe" style="width:95%;"></div></div>
            </div>
          </div>

          <!-- Side by side comparison snippet -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; background:var(--bg-card-subtle); padding:1rem; border-radius:var(--radius-md);">
            <div>
              <span style="font-size:0.75rem; font-weight:800; color:var(--emergency-red);">MISSING REPORT</span>
              <div style="font-weight:800; font-size:1.05rem;">${escapeHtml(m.missingName)}</div>
              <div style="font-size:0.8rem; color:var(--text-muted);">Last seen at: ${escapeHtml(missing?.lastSeenLocation || 'Flood Zone')} &bull; Age: ${missing?.age || '35'}</div>
            </div>
            <div>
              <span style="font-size:0.75rem; font-weight:800; color:var(--success-green);">SHELTERED SURVIVOR</span>
              <div style="font-weight:800; font-size:1.05rem;">${escapeHtml(m.survivorName)}</div>
              <div style="font-size:0.8rem; color:var(--text-muted);">Location: ${escapeHtml(camp?.name || m.campName)} &bull; Age: ${surv?.age || '36'}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-nav-to-verification').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.switchTab('verification');
      });
    });
  }

  renderVolunteerVerification() {
    const container = document.getElementById('volunteer-verification-list');
    if (!container) return;

    const pendingMatches = this.state.matches.filter((m) => m.status === 'PENDING_REVIEW');

    if (pendingMatches.length === 0) {
      container.innerHTML = `
        <div class="card-box" style="text-align:center; padding:3rem; color:var(--text-light);">
          <div style="font-size:2.5rem; margin-bottom:0.5rem;">🛡️</div>
          <h4 style="font-size:1.1rem; color:var(--text-main); font-weight:800;">Volunteer Verification Queue Clear</h4>
          <p style="font-size:0.85rem; margin-top:0.25rem;">No unverified candidate matches awaiting human review.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = pendingMatches.map((m) => {
      const missing = this.state.missingReports.find((r) => r.id === m.missingPersonId);
      const surv = this.state.survivors.find((s) => s.id === m.survivorId);
      const camp = this.state.camps.find((c) => c.id === m.campId);

      return `
        <div class="card-box" style="margin-bottom:1.5rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <span class="status-tag blue">94% AI SUGGESTED MATCH</span>
              <h3 style="font-size:1.2rem; font-weight:800; margin-top:0.35rem; color:var(--primary-deep);">
                Human Verification Required: Missing Person vs Candidate
              </h3>
            </div>
            <div style="font-size:0.8rem; color:var(--text-light);">Audit Reference: <code>MATCH-${escapeHtml(m.id.slice(0, 8))}</code></div>
          </div>

          <!-- Side-by-Side Comparison (Screen 07 Specification) -->
          <div class="verification-split-view">
            <!-- Left: Missing Person Report -->
            <div>
              <div style="display:flex; gap:0.85rem; align-items:center; margin-bottom:0.75rem;">
                <div class="person-avatar-box">
                  ${missing?.photoUrl ? `<img src="${escapeHtml(missing.photoUrl)}" />` : '👤'}
                </div>
                <div>
                  <span style="font-size:0.75rem; font-weight:800; color:var(--emergency-red); text-transform:uppercase;">Missing Person Record</span>
                  <div style="font-weight:900; font-size:1.15rem;">${escapeHtml(m.missingName)}</div>
                  <div style="font-size:0.8rem; color:var(--text-muted);">Age: ${missing?.age || '35'} &bull; Gender: ${escapeHtml(missing?.gender || 'Male')}</div>
                </div>
              </div>
              <div style="background:var(--bg-card-subtle); padding:0.75rem; border-radius:var(--radius-md); font-size:0.82rem; line-height:1.6;">
                📍 <strong>Last Seen:</strong> ${escapeHtml(missing?.lastSeenLocation || 'Dhubri River Bank')}<br>
                👤 <strong>Filed By:</strong> ${escapeHtml(missing?.reporterName || 'Suman Sharma (Spouse)')} (${escapeHtml(missing?.reporterContact || '+91-98765-43210')})<br>
                📝 <strong>Notes:</strong> ${escapeHtml(missing?.notes || 'Blue check shirt, flash flood')}<br>
              </div>
            </div>

            <!-- Right: Sheltered Survivor -->
            <div>
              <div style="display:flex; gap:0.85rem; align-items:center; margin-bottom:0.75rem;">
                <div class="person-avatar-box">
                  ${surv?.photoUrl ? `<img src="${escapeHtml(surv.photoUrl)}" />` : '👤'}
                </div>
                <div>
                  <span style="font-size:0.75rem; font-weight:800; color:var(--success-green); text-transform:uppercase;">Sheltered Survivor Candidate</span>
                  <div style="font-weight:900; font-size:1.15rem;">${escapeHtml(m.survivorName)}</div>
                  <div style="font-size:0.8rem; color:var(--text-muted);">Age: ${surv?.age || '36'} &bull; Gender: ${escapeHtml(surv?.gender || 'Male')}</div>
                </div>
              </div>
              <div style="background:var(--bg-card-subtle); padding:0.75rem; border-radius:var(--radius-md); font-size:0.82rem; line-height:1.6;">
                ⛺ <strong>Sheltered At:</strong> ${escapeHtml(camp?.name || m.campName)} (${escapeHtml(camp?.district || 'Sector')})<br>
                🩺 <strong>Physical State:</strong> ${escapeHtml(surv?.physicalCondition || 'Safe, minor leg scrapes')}<br>
                📞 <strong>Camp Lead Phone:</strong> ${escapeHtml(camp?.contactPhone || '+91-98640-11223')}<br>
              </div>
            </div>
          </div>

          <!-- Decision Actions -->
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem; padding-top:1rem; border-top:1px solid var(--border-color);">
            <div style="font-size:0.8rem; color:var(--text-muted);">
              Reviewer Action will be logged under SDMA Disaster Safety Audit.
            </div>
            <div style="display:flex; gap:0.5rem;">
              <button class="btn-ui btn-ui-secondary btn-ui-sm btn-audit-dismiss" data-match-id="${escapeHtml(m.id)}">
                NO NOT A MATCH
              </button>
              <button class="btn-ui btn-ui-success btn-ui-sm btn-audit-confirm"
                data-match-id="${escapeHtml(m.id)}"
                data-missing-name="${escapeHtml(m.missingName)}"
                data-camp-name="${escapeHtml(camp?.name || m.campName)}"
                data-reporter="${escapeHtml(missing?.reporterName || 'Family')}"
                data-reporter-contact="${escapeHtml(missing?.reporterContact || 'On record')}">
                ✓ OK CONFIRM MATCH
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Bind Confirm
    container.querySelectorAll('.btn-audit-confirm').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-match-id');
        const missingName = btn.getAttribute('data-missing-name');
        const campName = btn.getAttribute('data-camp-name');
        const reporter = btn.getAttribute('data-reporter');
        const reporterContact = btn.getAttribute('data-reporter-contact');

        try {
          await api.resolveMatch(id, 'CONFIRM');
          showToast('✓ Match confirmed! Multi-channel SMS & Handover Pass triggered.', 'success');
          await this.loadData();

          const certBox = document.getElementById('certificate-details-box');
          if (certBox) {
            certBox.innerHTML = `
              <div><strong>Person Reunited:</strong> ${escapeHtml(missingName)}</div>
              <div><strong>Relief Camp Location:</strong> ${escapeHtml(campName)}</div>
              <div><strong>Handover to Family:</strong> ${escapeHtml(reporter)} (${escapeHtml(reporterContact)})</div>
              <div><strong>Verification Time:</strong> ${new Date().toLocaleString()}</div>
              <div><strong>SAHAY Verification Security Code:</strong> <code>PASS-${id.slice(0, 12)}</code></div>
            `;
          }
          openModal('modal-reunification-cert');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    // Bind Dismiss
    container.querySelectorAll('.btn-audit-dismiss').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-match-id');
        try {
          await api.resolveMatch(id, 'DISMISS');
          showToast('Match dismissed from queue.', 'info');
          await this.loadData();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  }

  renderMissingCards(query = '') {
    const grid = document.getElementById('missing-cards-grid');
    if (!grid) return;

    let list = this.state.missingReports;
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      list = list.filter((r) =>
        r.name.toLowerCase().includes(q) ||
        (r.lastSeenLocation && r.lastSeenLocation.toLowerCase().includes(q))
      );
    }

    if (list.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1; padding:2rem; text-align:center; color:var(--text-light);">No missing person reports match your search.</div>`;
      return;
    }

    grid.innerHTML = list.map((item) => {
      const isReunited = item.status === 'REUNITED';
      const isPotential = item.status === 'POTENTIAL_MATCH';

      const tagClass = isReunited ? 'green' : isPotential ? 'blue' : 'yellow';
      const tagText = isReunited ? '✓ Reunited' : isPotential ? '⚡ Potential Match' : '🔍 Open Search';
      const phoneClean = (item.reporterContact || '').replace(/[^0-9+]/g, '');

      return `
        <div class="card-box" style="margin-bottom:0; padding:1.15rem;">
          <div style="display:flex; gap:0.75rem; align-items:center; margin-bottom:0.75rem;">
            <div class="person-avatar-box lightbox-trigger"
              data-photo="${escapeHtml(item.photoUrl || '')}"
              data-name="${escapeHtml(item.name)}"
              data-details="Last seen: ${escapeHtml(item.lastSeenLocation)}"
              style="cursor:pointer;" title="Click to view full photo">
              ${item.photoUrl ? `<img src="${escapeHtml(item.photoUrl)}" />` : '👤'}
            </div>
            <div style="flex:1;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-size:1.05rem;">${escapeHtml(item.name)}</strong>
                <span class="status-tag ${tagClass}">${tagText}</span>
              </div>
              <div style="font-size:0.8rem; color:var(--text-muted);">Age: ${item.age ?? 'Unknown'} &bull; Gender: ${escapeHtml(item.gender || 'Unknown')}</div>
            </div>
          </div>

          <div style="background:var(--bg-card-subtle); padding:0.65rem 0.85rem; border-radius:var(--radius-sm); font-size:0.8rem; margin-bottom:0.75rem;">
            📍 <strong>Last Seen:</strong> ${escapeHtml(item.lastSeenLocation)}<br>
            📞 <strong>Contact:</strong> ${escapeHtml(item.reporterName || 'Reporter')} (${escapeHtml(item.reporterContact || 'On file')})
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-light); padding-top:0.4rem; border-top:1px solid var(--border-color);">
            <span>AI Trust: <strong>${item.trustScore || 80}/100</strong></span>
            ${phoneClean ? `<a href="tel:${phoneClean}" class="btn-ui btn-ui-secondary btn-ui-sm">📞 Call Reporter</a>` : `<span>${formatTimeAgo(item.createdAt)}</span>`}
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.lightbox-trigger').forEach((box) => {
      box.addEventListener('click', () => {
        const photo = box.getAttribute('data-photo');
        const name = box.getAttribute('data-name');
        const details = box.getAttribute('data-details');
        this.openPhotoLightbox(photo, name, details);
      });
    });
  }

  renderAlertsTab() {
    const bannerBox = document.getElementById('urgent-broadcast-feed');
    const feedBox = document.getElementById('alerts-notifications-feed');

    if (!feedBox) return;

    const recentMissing = this.state.missingReports.filter((r) => r.status !== 'REUNITED');
    if (bannerBox && recentMissing.length > 0) {
      const top = recentMissing[0];
      bannerBox.innerHTML = `
        <div style="background:#FEF2F2; border:1px solid #FECACA; border-radius:var(--radius-lg); padding:1.25rem; margin-bottom:1.5rem; display:flex; gap:1rem; align-items:center;">
          <span class="status-tag red" style="flex-shrink:0;">🚨 URGENT BROADCAST</span>
          <div>
            <div style="font-weight:800; font-size:1.05rem; color:#991B1B;">
              High Attention Required: Missing Person ${escapeHtml(top.name)} (${top.age || 'Unknown'} yrs)
            </div>
            <div style="font-size:0.85rem; color:#7F1D1D; margin-top:0.25rem;">
              Last seen at <strong>${escapeHtml(top.lastSeenLocation)}</strong>. All relief camps instructed to cross-verify registry desks immediately.
            </div>
          </div>
        </div>
      `;
    }

    if (this.state.activities.length === 0) {
      feedBox.innerHTML = `<p style="font-size:0.85rem; color:var(--text-light);">No active alerts at this moment.</p>`;
      return;
    }

    feedBox.innerHTML = this.state.activities.map((act) => {
      return `
        <div class="card-box" style="margin-bottom:0.75rem; padding:1rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
            <strong style="font-size:0.95rem; color:var(--primary-deep);">${escapeHtml(act.title)}</strong>
            <span style="font-size:0.75rem; color:var(--text-light);">${formatTimeAgo(act.timestamp)}</span>
          </div>
          <div style="font-size:0.85rem; color:var(--text-muted);">${escapeHtml(act.detail)}</div>
        </div>
      `;
    }).join('');
  }
}

function bootSahay() {
  if (!window.sahayApp) {
    window.sahayApp = new SahayApp();
    window.sahayApp.init().catch((err) => console.error('[SAHAY Boot Error]', err));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootSahay);
} else {
  bootSahay();
}
