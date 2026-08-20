/**
 * SAHAY Input Validators & Sanitization
 * -------------------------------------
 * Validates reports, camps, and survivor registrations with clear, helpful feedback.
 */

export function validateMissingReport(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: ['Request body must be a valid JSON object'] };
  }

  if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 2) {
    errors.push('Person name is required (at least 2 characters)');
  }

  if (data.age !== undefined && data.age !== null && data.age !== '') {
    const ageNum = Number(data.age);
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 125) {
      errors.push('Age must be a valid integer between 0 and 125');
    }
  }

  if (!data.lastSeenLocation || typeof data.lastSeenLocation !== 'string' || data.lastSeenLocation.trim().length < 2) {
    errors.push('Last seen location or district is required');
  }

  if (data.contactPhone) {
    const cleanPhone = String(data.contactPhone).replace(/[\s\-()]/g, '');
    if (!/^\+?[0-9]{7,15}$/.test(cleanPhone)) {
      errors.push('Contact phone number format is invalid (e.g. +91 98765 43210)');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateCamp(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: ['Request body must be a valid JSON object'] };
  }

  if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 3) {
    errors.push('Camp name is required (at least 3 characters)');
  }

  if (!data.district || typeof data.district !== 'string') {
    errors.push('District is required');
  }

  if (data.capacity === undefined || isNaN(Number(data.capacity)) || Number(data.capacity) <= 0) {
    errors.push('Capacity must be a positive integer greater than zero');
  }

  if (data.occupancy !== undefined && (isNaN(Number(data.occupancy)) || Number(data.occupancy) < 0)) {
    errors.push('Occupancy must be a non-negative number');
  }

  if (data.latitude !== undefined && data.latitude !== null && data.latitude !== '') {
    const lat = Number(data.latitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      errors.push('Latitude must be between -90 and 90');
    }
  }

  if (data.longitude !== undefined && data.longitude !== null && data.longitude !== '') {
    const lng = Number(data.longitude);
    if (isNaN(lng) || lng < -180 || lng > 180) {
      errors.push('Longitude must be between -180 and 180');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateSurvivor(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: ['Request body must be a valid JSON object'] };
  }

  if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 2) {
    errors.push('Survivor name is required (at least 2 characters)');
  }

  if (data.age !== undefined && data.age !== null && data.age !== '') {
    const ageNum = Number(data.age);
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 125) {
      errors.push('Age must be between 0 and 125');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
