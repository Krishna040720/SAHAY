/**
 * SAHAY Cross-Camp Resource Balancing & Allocation Engine
 * ------------------------------------------------------
 * Detects severe deficits and surpluses across relief camps, calculates priority scores,
 * and generates actionable logistics transfer plans (e.g. food/water/medical supplies).
 */

import { haversineDistance } from './matching.js';

export const RESOURCE_TYPES = ['water', 'food', 'medical', 'blankets'];

/**
 * Categorizes camp occupancy status.
 */
export function getOccupancyStatus(occupancy, capacity) {
  if (!capacity || capacity <= 0) return { ratio: 0, status: 'UNKNOWN', label: 'Unknown', isCritical: false };
  const ratio = (occupancy / capacity);
  const percentage = Math.round(ratio * 100);

  if (ratio > 1.0) {
    return { ratio, percentage, status: 'OVER_CAPACITY', label: 'Over Capacity', isCritical: true, delta: occupancy - capacity };
  } else if (ratio >= 0.85) {
    return { ratio, percentage, status: 'NEAR_CAPACITY', label: 'Near Capacity', isCritical: false, delta: 0 };
  } else if (ratio >= 0.50) {
    return { ratio, percentage, status: 'MODERATE', label: 'Moderate', isCritical: false, delta: 0 };
  } else {
    return { ratio, percentage, status: 'AMPLE_SPACE', label: 'Ample Space', isCritical: false, delta: 0 };
  }
}

/**
 * Analyzes resource deficits (<35%) and surpluses (>75%) across camps.
 */
export function analyzeCampResources(camps) {
  const analysis = {
    criticalCamps: [],
    surplusCamps: [],
    recommendedTransfers: []
  };

  const deficits = [];
  const surpluses = [];

  for (const camp of camps) {
    const occupancyInfo = getOccupancyStatus(camp.occupancy, camp.capacity);
    const campNeeds = {
      campId: camp.id,
      campName: camp.name,
      district: camp.district,
      latitude: camp.latitude,
      longitude: camp.longitude,
      occupancyInfo,
      shortages: [],
      excess: []
    };

    for (const res of RESOURCE_TYPES) {
      const level = camp.resources ? Number(camp.resources[res] || 0) : 50;
      if (level <= 30) {
        campNeeds.shortages.push({ resource: res, level, deficitPct: 35 - level });
        deficits.push({
          campId: camp.id,
          campName: camp.name,
          lat: camp.latitude,
          lng: camp.longitude,
          resource: res,
          level,
          deficit: 70 - level // Desired target level 70%
        });
      } else if (level >= 75) {
        campNeeds.excess.push({ resource: res, level, surplusPct: level - 65 });
        surpluses.push({
          campId: camp.id,
          campName: camp.name,
          lat: camp.latitude,
          lng: camp.longitude,
          resource: res,
          level,
          availableSurplus: level - 60 // Can safely donate down to 60%
        });
      }
    }

    if (occupancyInfo.isCritical || campNeeds.shortages.length > 0) {
      analysis.criticalCamps.push(campNeeds);
    }
    if (campNeeds.excess.length > 0) {
      analysis.surplusCamps.push(campNeeds);
    }
  }

  // Generate optimal transfer recommendations by pairing nearby surplus with deficit
  for (const def of deficits) {
    // Find closest camp with surplus of this resource
    const compatibleSurpluses = surpluses
      .filter((s) => s.resource === def.resource && s.campId !== def.campId && s.availableSurplus > 0)
      .map((s) => {
        const dist = haversineDistance(def.lat, def.lng, s.lat, s.lng) || 999;
        return { ...s, distanceKm: dist };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);

    if (compatibleSurpluses.length > 0) {
      const source = compatibleSurpluses[0];
      const transferAmountPct = Math.min(source.availableSurplus, def.deficit);

      analysis.recommendedTransfers.push({
        id: `TRANS-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        resource: def.resource,
        fromCampId: source.campId,
        fromCampName: source.campName,
        toCampId: def.campId,
        toCampName: def.campName,
        distanceKm: source.distanceKm,
        transferAmountPct,
        priority: def.level <= 15 ? 'CRITICAL' : 'HIGH',
        status: 'PENDING_DISPATCH',
        estimatedTravelTimeMin: Math.max(15, Math.round(source.distanceKm * 2.5))
      });

      // Deduct from temporary calculation
      source.availableSurplus -= transferAmountPct;
    }
  }

  return analysis;
}
