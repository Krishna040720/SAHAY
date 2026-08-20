/**
 * SAHAY Offline & SMS/USSD Fallback Gateway
 * ----------------------------------------
 * Enables disaster relief reporting, missing person lookups, and camp status updates
 * even when 4G/5G data networks are completely down, using compressed SMS syntax.
 */

/**
 * Parses an incoming SMS text payload and converts it into structured command actions.
 * Supported Commands:
 * 1. REPORT MISSING: "SAHAY MISSING [Name], [Age], [Gender], [LastSeenLocation], [Phone]"
 * 2. CAMP UPDATE:   "SAHAY CAMP [CampCode] OCC [Count] WATER [Lvl] FOOD [Lvl] MED [Lvl]"
 * 3. SHELTER LOOKUP: "SAHAY FIND [District or Coords]"
 * 4. SURVIVOR CHECKIN: "SAHAY SURVIVOR [Name], [Age], [Gender], [CampCode]"
 */
export function parseEmergencySms(rawText, senderPhone = '') {
  if (!rawText || typeof rawText !== 'string') {
    return { success: false, error: 'Empty SMS content' };
  }

  let text = rawText.trim();
  // Strip optional leading 'SAHAY' prefix if present
  if (text.toUpperCase().startsWith('SAHAY')) {
    text = text.slice(5).trim();
  }

  const upper = text.toUpperCase();

  // 1. Missing Person Report (e.g., "MISSING Tarun Das, 32, Male, Bilasipara", "SAHAY MISSING ...")
  if (upper.includes('MISSING') || upper.startsWith('LOST')) {
    const dataPart = text.replace(/.*?(MISSING|LOST)\s*/i, '').trim();
    const parts = dataPart.split(',').map((p) => p.trim());
    if (parts.length < 3) {
      return {
        success: false,
        error: 'Please provide Name, Age, and Location. Example: SAHAY MISSING Ramesh, 30, Male, Dhubri'
      };
    }

    return {
      success: true,
      action: 'CREATE_MISSING_REPORT',
      data: {
        name: parts[0],
        age: parseInt(parts[1], 10) || null,
        gender: parts[2] || 'Unknown',
        lastSeenLocation: parts[3] || parts[2] || 'Flood Sector',
        contactPhone: parts[4] || senderPhone || 'SMS-Reporter',
        sourceType: 'SMS_GATEWAY',
        notes: 'Submitted via emergency SMS bridge'
      }
    };
  }

  // If text is empty or just 'HELP' / 'MENU' / 'HI'
  if (!text || upper === 'HELP' || upper === 'MENU' || upper === 'HI' || upper === 'HELLO') {
    return {
      success: true,
      action: 'HELP_MENU',
      data: {}
    };
  }

  // 2. Camp Status Update (for coordinators: "CAMP CAMP-101 OCC 420 WATER 30 FOOD 40 MED 80")
  if (upper.startsWith('CAMP') && /OCC\s+\d+/i.test(upper)) {
    const regex = /CAMP\s+([A-Za-z0-9_-]+)(?:\s+OCC\s+(\d+))?(?:\s+WATER\s+(\d+))?(?:\s+FOOD\s+(\d+))?(?:\s+MED\s+(\d+))?/i;
    const match = text.match(regex);
    if (!match) {
      return {
        success: false,
        error: 'Format: CAMP <CampCode> OCC <Occupancy> WATER <%> FOOD <%>'
      };
    }

    return {
      success: true,
      action: 'UPDATE_CAMP_STATUS',
      data: {
        campCode: match[1],
        occupancy: match[2] ? parseInt(match[2], 10) : undefined,
        water: match[3] ? parseInt(match[3], 10) : undefined,
        food: match[4] ? parseInt(match[4], 10) : undefined,
        medical: match[5] ? parseInt(match[5], 10) : undefined,
        reporterPhone: senderPhone
      }
    };
  }

  // 3. Survivor Check-In (e.g., "SURVIVOR Meena Paul, 26, Female, CAMP-102")
  if (upper.startsWith('SURVIVOR') || upper.startsWith('CHECKIN')) {
    const dataPart = text.replace(/^(SURVIVOR|CHECKIN)\s*/i, '').trim();
    const parts = dataPart.split(',').map((p) => p.trim());
    if (parts.length < 2) {
      return {
        success: false,
        error: 'Format: SURVIVOR <Name>, <Age>, <Gender>, <CampName/ID>'
      };
    }

    return {
      success: true,
      action: 'REGISTER_SURVIVOR',
      data: {
        name: parts[0],
        age: parseInt(parts[1], 10) || null,
        gender: parts[2] || 'Unknown',
        campCode: parts[3] || parts[2] || null,
        notes: 'Registered via offline SMS/USSD check-in'
      }
    };
  }

  // 4. Shelter Finder (e.g. "FIND Dhubri", "CAMP Dhubri", "NEAR Silchar", "Dhubri", "CAMPS", "RELIEF")
  if (upper.startsWith('FIND') || upper.startsWith('NEAR') || upper.startsWith('CAMP') || upper.startsWith('SHELTER') || upper.startsWith('RELIEF') || text.length <= 25) {
    const query = text.replace(/^(FIND|NEAR|CAMP|CAMPS|SHELTER|RELIEF)\s*/i, '').trim();
    return {
      success: true,
      action: 'SEARCH_NEARBY_CAMPS',
      data: { query: query || 'ALL' }
    };
  }

  // Default fallback to searching camps
  return {
    success: true,
    action: 'SEARCH_NEARBY_CAMPS',
    data: { query: text }
  };
}

/**
 * Formats incoming camp lookup query results into a compressed 160-char SMS response.
 */
export function formatCampQueryResponse(query, camps = []) {
  if (!camps || camps.length === 0) {
    return `[SAHAY RELIEF] No open camps found matching "${query}". Call 24x7 Emergency Helpline 112 / 1078 or text SAHAY FIND Dhubri for district hub.`;
  }

  const topCamps = camps.slice(0, 2).map((c, i) => {
    const vacant = Math.max(0, c.capacity - c.occupancy);
    return `${i + 1}) ${c.name}: ${vacant} open beds, Food: ${c.resources?.food || 70}%, Ph: ${c.contactPhone || '112'}`;
  }).join('; ');

  return `[SAHAY CAMPS for ${query.toUpperCase()}]: ${topCamps}. Free Food, Medical & Child Safe. Call 1070 for rescue escort.`;
}

/**
 * Formats outgoing SMS broadcast alerts and match confirmations.
 */
export function formatSmsAlert(type, payload) {
  if (type === 'MATCH_CONFIRMATION') {
    return `[SAHAY RELIEF ALERT] Positive match confirmed for ${payload.missingName}! Located at ${payload.campName}. Contact Field Desk: ${payload.contactPhone || '+91-1800-SAHAY-01'}. Verification ID: ${payload.matchId}`;
  }
  if (type === 'CAMP_ALERT') {
    return `[SAHAY OPS] Camp ${payload.campName} reached ${payload.occupancyPct}% capacity. Priority assistance requested for: ${payload.shortages || 'General Relief'}.`;
  }
  if (type === 'LOGISTICS_TRANSFER') {
    return `[SAHAY DISPATCH] Transfer #${payload.id}: Send ${payload.resource.toUpperCase()} from ${payload.fromCamp} to ${payload.toCamp} (Distance: ${payload.distanceKm}km). ETA: ${payload.etaMin}m.`;
  }
  if (type === 'HELP_MENU') {
    return `[SAHAY 2G SMS SERVICE] Commands: 1. SAHAY FIND [District] (Get camps & beds); 2. SAHAY MISSING [Name,Age,Gender,Location]; 3. SAHAY SURVIVOR [Name,Age,Gender,Camp]. Call 112 / 1078.`;
  }
  return `[SAHAY] ${payload.message || 'Disaster relief system update'}`;
}
