/**
 * SAHAY REST API Controller
 * -------------------------
 * Clean, structured handlers for all disaster relief operations.
 */

import { db } from '../models/repository.js';
import { validateMissingReport, validateCamp, validateSurvivor } from '../models/validators.js';
import { parseEmergencySms, formatSmsAlert, formatCampQueryResponse } from '../engine/sms-gateway.js';
import { haversineDistance } from '../engine/matching.js';

export function handleApiRequest(req, res, pathname, query, body) {
  // Helper for standard JSON responses
  const sendJson = (status, data) => {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(JSON.stringify(data));
  };

  const sendError = (status, message, details = null) => {
    sendJson(status, {
      success: false,
      error: message,
      details,
      timestamp: new Date().toISOString()
    });
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  // 1. Health check & Stats
  if (req.method === 'GET' && (pathname === '/api/health' || pathname === '/api')) {
    return sendJson(200, {
      status: 'ONLINE',
      system: 'SAHAY Disaster Coordination Engine',
      version: '1.0.0',
      uptimeSec: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    });
  }

  if (req.method === 'GET' && pathname === '/api/stats') {
    const stats = db.getDashboardStats();
    return sendJson(200, { success: true, stats });
  }

  // 2. Relief Camps
  if (req.method === 'GET' && pathname === '/api/camps') {
    const camps = db.getAllCamps();
    return sendJson(200, { success: true, count: camps.length, camps });
  }

  if (req.method === 'GET' && pathname === '/api/camps/nearby') {
    const lat = parseFloat(query.get('lat'));
    const lng = parseFloat(query.get('lng'));
    const radius = parseFloat(query.get('radius')) || 50; // default 50km

    if (isNaN(lat) || isNaN(lng)) {
      return sendError(400, 'Valid "lat" and "lng" query parameters are required.');
    }

    const allCamps = db.getAllCamps();
    const ranked = allCamps
      .map((camp) => {
        const dist = haversineDistance(lat, lng, camp.latitude, camp.longitude);
        const vacancy = Math.max(0, camp.capacity - camp.occupancy);
        return {
          ...camp,
          distanceKm: dist,
          vacancy,
          isAvailable: vacancy > 0
        };
      })
      .filter((c) => c.distanceKm !== null && c.distanceKm <= radius)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return sendJson(200, { success: true, count: ranked.length, camps: ranked });
  }

  if (req.method === 'GET' && pathname.startsWith('/api/camps/')) {
    const campId = pathname.split('/')[3];
    const camp = db.getCampById(campId);
    if (!camp) return sendError(404, `Camp with ID "${campId}" not found`);
    return sendJson(200, { success: true, camp });
  }

  if (req.method === 'POST' && pathname === '/api/auth/verify-role') {
    const { role, campId, pin } = body || {};
    const cleanPin = String(pin || '').trim();

    if (!cleanPin) {
      return sendError(400, 'PIN or security passcode is required');
    }

    // Master Emergency bypass keys
    if (cleanPin === '2026' || cleanPin === 'ADMIN2026' || cleanPin === 'VOL2026') {
      return sendJson(200, {
        success: true,
        verified: true,
        role: role || 'volunteer',
        message: 'Master Emergency Responder clearance accepted'
      });
    }

    if (campId && campId !== 'ALL_CAMPS') {
      const camp = db.getCampById(campId);
      if (camp) {
        const expected = role === 'volunteer' ? (camp.volunteerPin || '1234') : (camp.adminPin || '9999');
        if (cleanPin === expected) {
          return sendJson(200, {
            success: true,
            verified: true,
            campId: camp.id,
            campName: camp.name,
            role,
            message: `Authorized as ${role} for ${camp.name}`
          });
        }
      }
    } else {
      const camps = db.getAllCamps();
      const match = camps.find((c) => {
        const expected = role === 'volunteer' ? (c.volunteerPin || '1234') : (c.adminPin || '9999');
        return cleanPin === expected;
      });

      if (match || (role === 'volunteer' && cleanPin === '1234') || (role === 'camp-admin' && cleanPin === '9999')) {
        return sendJson(200, {
          success: true,
          verified: true,
          campId: match ? match.id : null,
          campName: match ? match.name : 'Central Operational Sector',
          role,
          message: 'Security credentials verified successfully'
        });
      }
    }

    return sendError(401, 'Invalid Security PIN. Access denied. Only authorized Camp Coordinators and Volunteers possess the assigned PIN.');
  }

  if (req.method === 'POST' && pathname === '/api/camps') {
    const validation = validateCamp(body);
    if (!validation.isValid) {
      return sendError(422, 'Camp validation failed', validation.errors);
    }

    const newCamp = db.createCamp(body);
    return sendJson(201, { success: true, message: 'Relief camp created', camp: newCamp });
  }

  if (req.method === 'PATCH' && pathname.startsWith('/api/camps/')) {
    const campId = pathname.split('/')[3];
    const updated = db.updateCamp(campId, body || {});
    if (!updated) return sendError(404, `Camp "${campId}" not found`);
    return sendJson(200, { success: true, message: 'Camp updated successfully', camp: updated });
  }

  // 3. Missing Persons
  if (req.method === 'GET' && pathname === '/api/missing') {
    const list = db.getAllMissing();
    return sendJson(200, { success: true, count: list.length, missingReports: list });
  }

  if (req.method === 'GET' && pathname.startsWith('/api/missing/')) {
    const id = pathname.split('/')[3];
    const report = db.getMissingById(id);
    if (!report) return sendError(404, `Missing report "${id}" not found`);
    return sendJson(200, { success: true, report });
  }

  if (req.method === 'POST' && pathname === '/api/missing') {
    const validation = validateMissingReport(body);
    if (!validation.isValid) {
      return sendError(422, 'Missing report validation failed', validation.errors);
    }

    const report = db.createMissingReport(body);
    return sendJson(201, {
      success: true,
      message: 'Missing person report filed successfully and AI matching triggered',
      report
    });
  }

  // 4. Sheltered Survivors
  if (req.method === 'GET' && pathname === '/api/survivors') {
    const survivors = db.getAllSurvivors();
    return sendJson(200, { success: true, count: survivors.length, survivors });
  }

  if (req.method === 'POST' && pathname === '/api/survivors') {
    const validation = validateSurvivor(body);
    if (!validation.isValid) {
      return sendError(422, 'Survivor registration validation failed', validation.errors);
    }

    const survivor = db.createSurvivor(body);
    return sendJson(201, {
      success: true,
      message: 'Survivor registered at shelter and matched against missing lists',
      survivor
    });
  }

  // 5. Matches & Verification Review Queue
  if (req.method === 'GET' && pathname === '/api/matches') {
    const matches = db.getAllMatches();
    return sendJson(200, { success: true, count: matches.length, matches });
  }

  if (req.method === 'POST' && pathname.startsWith('/api/matches/') && pathname.endsWith('/resolve')) {
    const parts = pathname.split('/');
    const matchId = parts[3];
    const { action, notes } = body || {};

    if (!action || !['CONFIRM', 'DISMISS'].includes(action)) {
      return sendError(400, 'Action must be either "CONFIRM" or "DISMISS"');
    }

    const resolved = db.resolveMatch(matchId, action, notes);
    if (!resolved) return sendError(404, `Match "${matchId}" not found`);

    return sendJson(200, {
      success: true,
      message: action === 'CONFIRM' ? 'Match confirmed! Notification dispatched.' : 'Match dismissed.',
      match: resolved
    });
  }

  // 6. Cross-Camp Resource Balancing
  if (req.method === 'GET' && pathname === '/api/resources/balance') {
    const balancing = db.getResourceBalancing();
    return sendJson(200, { success: true, ...balancing });
  }

  // 7. Emergency SMS Gateway Bridge
  if (req.method === 'POST' && pathname === '/api/sms/parse') {
    const { text, senderPhone } = body || {};
    const parsed = parseEmergencySms(text, senderPhone);

    if (!parsed.success) {
      return sendError(400, parsed.error);
    }

    // Execute parsed action
    let result = null;
    let autoReply = '';

    if (parsed.action === 'CREATE_MISSING_REPORT') {
      result = db.createMissingReport(parsed.data);
      autoReply = `[SAHAY CONFIRMED] Missing inquiry registered for ${result.name} (Ref: ${result.id}). System actively matching face & data across all relief camps. Updates sent to this number.`;
    } else if (parsed.action === 'REGISTER_SURVIVOR') {
      result = db.createSurvivor(parsed.data);
      autoReply = `[SAHAY CHECK-IN] Survivor ${result.name} registered at shelter. Match scan initiated against family search requests.`;
    } else if (parsed.action === 'UPDATE_CAMP_STATUS') {
      // Find camp by code/name
      const camps = db.getAllCamps();
      const targetCamp = camps.find(
        (c) => c.id.toLowerCase() === parsed.data.campCode.toLowerCase() ||
               c.name.toLowerCase().includes(parsed.data.campCode.toLowerCase())
      );
      if (targetCamp) {
        result = db.updateCamp(targetCamp.id, {
          occupancy: parsed.data.occupancy,
          resources: {
            water: parsed.data.water,
            food: parsed.data.food,
            medical: parsed.data.medical
          }
        });
        autoReply = `[SAHAY OPS] Camp ${targetCamp.name} status updated: Occupancy ${parsed.data.occupancy || targetCamp.occupancy}/${targetCamp.capacity}. Live sitrep synced.`;
      } else {
        autoReply = `[SAHAY ERROR] Camp code "${parsed.data.campCode}" not found. Verify camp ID.`;
      }
    } else if (parsed.action === 'SEARCH_NEARBY_CAMPS') {
      const q = (parsed.data.query || '').toLowerCase();
      const allCamps = db.getAllCamps();
      const matched = q === 'all' || !q
        ? allCamps
        : allCamps.filter((c) =>
            c.name.toLowerCase().includes(q) ||
            c.district.toLowerCase().includes(q)
          );
      result = matched;
      autoReply = formatCampQueryResponse(parsed.data.query, matched);
    } else if (parsed.action === 'HELP_MENU') {
      autoReply = formatSmsAlert('HELP_MENU', {});
    }

    return sendJson(200, {
      success: true,
      action: parsed.action,
      parsedData: parsed.data,
      result,
      autoReply,
      message: 'Emergency SMS parsed and processed into live registry'
    });
  }

  if (req.method === 'POST' && pathname === '/api/sms/generate') {
    const { type, payload } = body || {};
    const formattedSms = formatSmsAlert(type, payload || {});
    return sendJson(200, { success: true, formattedSms, charCount: formattedSms.length });
  }

  // 8. Activity Stream
  if (req.method === 'GET' && pathname === '/api/activities') {
    const activities = db.getActivities();
    return sendJson(200, { success: true, activities });
  }

  // Unhandled API Route
  return sendError(404, `Endpoint ${req.method} ${pathname} not found`);
}
