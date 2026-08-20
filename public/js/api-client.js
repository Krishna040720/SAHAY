/**
 * SAHAY API Client
 * ----------------
 * Communicates with REST API endpoints and falls back gracefully to local cache when offline.
 */

class ApiClient {
  constructor() {
    this.baseUrl = window.location.origin;
    this.isOnline = true;
    this.initNetworkListeners();
  }

  initNetworkListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      document.dispatchEvent(new CustomEvent('sahay:network-change', { detail: { online: true } }));
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
      document.dispatchEvent(new CustomEvent('sahay:network-change', { detail: { online: false } }));
    });
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
      }

      // Cache successful GET responses in localStorage for offline resiliency
      if ((!options.method || options.method === 'GET') && data) {
        try {
          localStorage.setItem(`sahay_cache_${endpoint}`, JSON.stringify({ timestamp: Date.now(), data }));
        } catch (e) {
          // ignore cache quota issues
        }
      }

      return data;
    } catch (err) {
      console.warn(`[API] Request to ${endpoint} failed:`, err.message);

      // Attempt offline cache retrieval
      if (!options.method || options.method === 'GET') {
        const cached = localStorage.getItem(`sahay_cache_${endpoint}`);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            console.log(`[API] Serving offline cached data for ${endpoint}`);
            return parsed.data;
          } catch {
            // cache corrupt
          }
        }
      }

      throw err;
    }
  }

  getStats() { return this.request('/api/stats'); }
  getCamps() { return this.request('/api/camps'); }
  getNearbyCamps(lat, lng, radius = 50) { return this.request(`/api/camps/nearby?lat=${lat}&lng=${lng}&radius=${radius}`); }
  createCamp(campData) { return this.request('/api/camps', { method: 'POST', body: JSON.stringify(campData) }); }
  updateCamp(id, updates) { return this.request(`/api/camps/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }); }

  getMissingReports() { return this.request('/api/missing'); }
  createMissingReport(reportData) { return this.request('/api/missing', { method: 'POST', body: JSON.stringify(reportData) }); }

  getSurvivors() { return this.request('/api/survivors'); }
  createSurvivor(survivorData) { return this.request('/api/survivors', { method: 'POST', body: JSON.stringify(survivorData) }); }

  getMatches() { return this.request('/api/matches'); }
  resolveMatch(matchId, action, notes = '') {
    return this.request(`/api/matches/${matchId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ action, notes })
    });
  }

  getResourceBalancing() { return this.request('/api/resources/balance'); }
  verifyRole(authData) {
    return this.request('/api/auth/verify-role', {
      method: 'POST',
      body: JSON.stringify(authData)
    });
  }
  parseEmergencySms(text, senderPhone = '') {
    return this.request('/api/sms/parse', {
      method: 'POST',
      body: JSON.stringify({ text, senderPhone })
    });
  }

  getActivities() { return this.request('/api/activities'); }
}

export const api = new ApiClient();
