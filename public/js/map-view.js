/**
 * SAHAY Interactive Map Engine (Leaflet + OpenStreetMap)
 * -----------------------------------------------------
 * 100% Free, open-source real-world map with interactive pins,
 * live GPS "Use My Location", camp capacity badges, and reunification route lines.
 */

import { haversineDistance, escapeHtml } from './ui-helpers.js';

export class MapVisualizer {
  constructor(containerId, onCampSelect) {
    this.containerId = containerId;
    this.onCampSelect = onCampSelect;
    this.map = null;
    this.markersGroup = null;
    this.survivorMarker = null;
    this.routePolyline = null;
    this.camps = [];
    this.userLocation = null;

    this.initLeaflet();
  }

  initLeaflet() {
    const el = document.getElementById(this.containerId);
    if (!el || typeof L === 'undefined') {
      console.warn('[Map] Leaflet not yet loaded or container missing');
      return;
    }

    // Default center on Assam / North-East disaster corridor
    this.map = L.map(this.containerId, {
      center: [26.15, 91.75],
      zoom: 8,
      zoomControl: true
    });

    // Free OpenStreetMap tile layer (No API key needed)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);

    this.markersGroup = L.layerGroup().addTo(this.map);
  }

  setCamps(camps) {
    this.camps = camps || [];
    if (!this.map) {
      this.initLeaflet();
    }
    if (!this.map) return;

    this.renderCamps();
  }

  updateCamps(camps) {
    this.setCamps(camps);
  }

  renderCamps() {
    if (!this.markersGroup) return;
    this.markersGroup.clearLayers();

    const bounds = [];

    for (const camp of this.camps) {
      const lat = Number(camp.latitude);
      const lng = Number(camp.longitude);
      if (isNaN(lat) || isNaN(lng)) continue;

      bounds.push([lat, lng]);

      const isOver = camp.occupancy > camp.capacity;
      const isNear = !isOver && (camp.occupancy / camp.capacity >= 0.85);

      const color = isOver ? '#dc2626' : isNear ? '#d97706' : '#059669';
      const statusText = isOver ? 'FULL (Over-capacity)' : isNear ? 'Near Limit' : 'Available Space';
      const pct = Math.round((camp.occupancy / camp.capacity) * 100);

      // Clean, custom HTML marker icon
      const customIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div style="
            background: ${color};
            color: white;
            font-weight: 700;
            font-size: 11px;
            padding: 4px 8px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            border: 2px solid white;
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 4px;
            cursor: pointer;
          ">
            <span>⛺ ${escapeHtml(camp.name.split(' ')[0])}</span>
            <span style="background:rgba(0,0,0,0.25); padding:1px 5px; border-radius:8px; font-size:10px;">${pct}%</span>
          </div>
        `,
        iconSize: [120, 30],
        iconAnchor: [60, 15]
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(this.markersGroup);

      // Rich interactive popup with simple English
      const popupContent = `
        <div style="min-width: 220px; font-family: sans-serif;">
          <h4 style="margin: 0 0 4px 0; font-size: 14px; color: #0f172a;">${escapeHtml(camp.name)}</h4>
          <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b;">📍 ${escapeHtml(camp.district)} • 📞 ${escapeHtml(camp.contactPhone || 'Helpline 1800-SAHAY')}</p>
          
          <div style="background: #f8fafc; padding: 8px; border-radius: 6px; margin-bottom: 8px; font-size: 12px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span>Beds Available:</span>
              <strong>${Math.max(0, camp.capacity - camp.occupancy)} / ${camp.capacity}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; color:${color}; font-weight:700;">
              <span>Status:</span>
              <span>${statusText} (${pct}%)</span>
            </div>
          </div>

          <button id="popup-btn-${escapeHtml(camp.id)}" style="
            width: 100%;
            background: #2563eb;
            color: white;
            border: none;
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
          ">
            Select Camp &amp; Get Directions
          </button>
        </div>
      `;

      marker.bindPopup(popupContent);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`popup-btn-${camp.id}`);
        if (btn) {
          btn.addEventListener('click', () => {
            if (this.onCampSelect) this.onCampSelect(camp.id);
          });
        }
      });
    }

    if (bounds.length > 0 && !this.userLocation && !this.routePolyline) {
      this.map.fitBounds(bounds, { padding: [40, 40] });
    }
  }

  setSurvivorLocation(lat, lng, name = 'Your Location') {
    this.userLocation = { lat, lng, name };
    if (!this.map) return;

    if (this.survivorMarker) {
      this.map.removeLayer(this.survivorMarker);
    }

    const userIcon = L.divIcon({
      className: 'custom-user-pin',
      html: `
        <div style="
          background: #2563eb;
          color: white;
          font-weight: 700;
          font-size: 12px;
          padding: 6px 12px;
          border-radius: 20px;
          box-shadow: 0 0 0 4px rgba(37,99,235,0.3), 0 4px 10px rgba(0,0,0,0.3);
          border: 2px solid white;
          white-space: nowrap;
        ">
          📍 ${escapeHtml(name)}
        </div>
      `,
      iconSize: [160, 32],
      iconAnchor: [80, 16]
    });

    this.survivorMarker = L.marker([lat, lng], { icon: userIcon }).addTo(this.map);
    this.map.setView([lat, lng], 11);
  }

  flyToCamp(campId) {
    const camp = this.camps.find((c) => c.id === campId);
    if (!camp || !this.map) return;
    this.map.flyTo([camp.latitude, camp.longitude], 13, { duration: 1.2 });
  }

  /**
   * Draws a clear reunification line connecting the family/missing report location to the camp
   */
  showReunificationRoute(fromLat, fromLng, toLat, toLng, fromLabel = 'Family Last Seen', toLabel = 'Found at Camp') {
    if (!this.map) return;

    if (this.routePolyline) {
      this.map.removeLayer(this.routePolyline);
    }

    // Draw dashed connecting path
    const latlngs = [
      [fromLat, fromLng],
      [toLat, toLng]
    ];

    this.routePolyline = L.polyline(latlngs, {
      color: '#2563eb',
      weight: 4,
      dashArray: '8, 8',
      opacity: 0.85
    }).addTo(this.map);

    const dist = haversineDistance(fromLat, fromLng, toLat, toLng);

    // Popup in middle of line
    const midLat = (fromLat + toLat) / 2;
    const midLng = (fromLng + toLng) / 2;

    const infoMarker = L.popup()
      .setLatLng([midLat, midLng])
      .setContent(`
        <div style="font-family:sans-serif; text-align:center; padding:4px;">
          <strong style="color:#2563eb;">Reunification Distance: ${dist} km</strong><br>
          <span style="font-size:11px; color:#64748b;">${escapeHtml(fromLabel)} ➔ ${escapeHtml(toLabel)}</span>
        </div>
      `)
      .openOn(this.map);

    this.map.fitBounds(latlngs, { padding: [60, 60] });
  }
}
