/**
 * SAHAY Matching Engine
 * --------------------
 * High-performance deterministic fuzzy name matching, phonetic similarity,
 * demographic proximity, and AI trust scoring for missing persons and relief camps.
 */

/**
 * Computes the Levenshtein distance between two strings.
 * Used to tolerate typos, regional spelling differences, and transcription errors.
 */
export function levenshteinDistance(a, b) {
  if (!a || !b) return (a || b || '').length;
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();

  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Normalized string similarity ratio between 0.0 (completely distinct) and 1.0 (exact match).
 */
export function stringSimilarity(a, b) {
  if (!a && !b) return 1.0;
  if (!a || !b) return 0.0;
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (s1 === s2) return 1.0;

  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;

  const dist = levenshteinDistance(s1, s2);
  return Math.max(0, (maxLen - dist) / maxLen);
}

/**
 * Token Sort Ratio: handles reordered words (e.g. "Kumar Rajesh" vs "Rajesh Kumar")
 */
export function tokenSortRatio(a, b) {
  if (!a || !b) return stringSimilarity(a, b);
  const cleanTokens = (str) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .sort()
      .join(' ');

  const sortedA = cleanTokens(a);
  const sortedB = cleanTokens(b);
  return stringSimilarity(sortedA, sortedB);
}

/**
 * Simplified Soundex code generator for phonetic matching of names
 */
export function soundex(str) {
  if (!str) return '';
  const s = str.toUpperCase().replace(/[^A-Z]/g, '');
  if (!s.length) return '';

  const mapping = {
    B: 1, F: 1, P: 1, V: 1,
    C: 2, G: 2, J: 2, K: 2, Q: 2, S: 2, X: 2, Z: 2,
    D: 3, T: 3,
    L: 4,
    M: 5, N: 5,
    R: 6
  };

  const firstChar = s[0];
  let res = firstChar;
  let prevCode = mapping[firstChar] || 0;

  for (let i = 1; i < s.length && res.length < 4; i++) {
    const char = s[i];
    const code = mapping[char] || 0;

    if (code !== 0 && code !== prevCode) {
      res += code;
    }
    if (code !== 0 || 'HW'.includes(char) === false) {
      prevCode = code;
    }
  }

  return (res + '000').slice(0, 4);
}

/**
 * Calculates geographic distance in kilometers using the Haversine formula.
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth's radius in km

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Evaluates age proximity score (1.0 = exact, drops smoothly with year gaps).
 */
export function calculateAgeScore(age1, age2) {
  if (age1 == null || age2 == null) return 0.7; // Moderate fallback if age missing
  const diff = Math.abs(Number(age1) - Number(age2));
  if (diff === 0) return 1.0;
  if (diff === 1) return 0.95;
  if (diff <= 3) return 0.85;
  if (diff <= 5) return 0.70;
  if (diff <= 10) return 0.40;
  return 0.10;
}

/**
 * Trust Scoring Algorithm for Crowdsourced Reports:
 * Combines reporter credibility, verification method, corroborations, and freshness.
 */
export function calculateTrustScore(report) {
  let score = 50; // Baseline neutrality

  // Source Type
  if (report.sourceType === 'OFFICIAL_CAMP_ADMIN') score += 35;
  else if (report.sourceType === 'VERIFIED_NGO') score += 30;
  else if (report.sourceType === 'SHELTER_STAFF') score += 25;
  else if (report.sourceType === 'FAMILY_MEMBER') score += 20;
  else if (report.sourceType === 'COMMUNITY_VOLUNTEER') score += 15;
  else score += 5; // Anonymous / General Public

  // Verification & Evidence
  if (report.hasPhoto) score += 10;
  if (report.contactPhone && /^\+?[0-9]{10,14}$/.test(report.contactPhone.replace(/\s+/g, ''))) score += 10;
  if (report.witnessCorroborations && report.witnessCorroborations > 0) {
    score += Math.min(15, report.witnessCorroborations * 5);
  }

  // Location Accuracy
  if (report.latitude && report.longitude) score += 10;

  // Freshness penalty (if reported > 7 days ago without update)
  if (report.createdAt) {
    const ageDays = (Date.now() - new Date(report.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > 14) score -= 15;
    else if (ageDays > 7) score -= 8;
  }

  return Math.min(100, Math.max(10, Math.round(score)));
}

/**
 * Calculates Euclidean distance between two numerical embedding vectors (e.g. 128-D face descriptors).
 */
export function euclideanDistance(v1, v2) {
  if (!v1 || !v2) return null;
  const arr1 = Array.isArray(v1) ? v1 : (v1.buffer ? Array.from(v1) : null);
  const arr2 = Array.isArray(v2) ? v2 : (v2.buffer ? Array.from(v2) : null);
  if (!arr1 || !arr2 || arr1.length !== 128 || arr2.length !== 128) return null;

  let sum = 0;
  for (let i = 0; i < 128; i++) {
    const diff = Number(arr1[i]) - Number(arr2[i]);
    if (isNaN(diff)) return null;
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Converts Euclidean distance between 128-D face embeddings into a percentage similarity score (0 to 100).
 * Matches face-recognition.js formula: clamp(1 - distance / 0.85, 0, 1) * 100
 */
export function faceSimilarity(v1, v2) {
  const dist = euclideanDistance(v1, v2);
  if (dist === null) return null;
  const similarity = Math.max(0, Math.min(1, 1 - (dist / 0.85))) * 100;
  return Math.round(similarity);
}

/**
 * Composite Match Score between a Missing Person Record and a Sheltered Survivor Record.
 * Returns match score (0-100), individual sub-scores, and matched criteria summary.
 */
export function compareMissingWithSurvivor(missing, survivor, camp = null) {
  // 1. Name Similarity (Levenshtein + Token Sort + Soundex)
  const nameDirect = stringSimilarity(missing.name, survivor.name);
  const nameToken = tokenSortRatio(missing.name, survivor.name);
  const soundexMatch = soundex(missing.name) === soundex(survivor.name) ? 1.0 : 0.0;
  const bestNameScore = Math.max(nameDirect, nameToken, soundexMatch * 0.85);

  // 2. Gender Compatibility
  let genderScore = 0.5;
  if (missing.gender && survivor.gender) {
    const g1 = missing.gender.toLowerCase().trim();
    const g2 = survivor.gender.toLowerCase().trim();
    if (g1 === g2) genderScore = 1.0;
    else if (g1 === 'unknown' || g2 === 'unknown' || g1 === 'other' || g2 === 'other') genderScore = 0.7;
    else genderScore = 0.0; // Clear mismatch (e.g. Male vs Female)
  }

  // Hard filter: If gender strongly mismatches and names are not identical, reject
  if (genderScore === 0.0 && bestNameScore < 0.95) {
    return {
      matchScore: 0,
      confidence: 'LOW',
      factors: {
        nameScore: Math.round(bestNameScore * 100),
        faceScore: null,
        faceDistance: null,
        genderScore: 0,
        ageScore: 0,
        locationScore: 0,
        faceMatchStatus: 'NO_FACE_DATA'
      },
      isCandidate: false,
      reason: 'Gender mismatch'
    };
  }

  // 3. Age Proximity
  const ageScore = calculateAgeScore(missing.age, survivor.age);

  // 4. Location Proximity (if camp or survivor coordinates are provided)
  let locationScore = 0.7; // Default neutral if location coords not provided
  let distanceKm = null;

  if (missing.lastSeenLat && missing.lastSeenLng) {
    const targetLat = survivor.latitude || (camp ? camp.latitude : null);
    const targetLng = survivor.longitude || (camp ? camp.longitude : null);

    if (targetLat != null && targetLng != null) {
      distanceKm = haversineDistance(missing.lastSeenLat, missing.lastSeenLng, targetLat, targetLng);
      if (distanceKm <= 5) locationScore = 1.0;
      else if (distanceKm <= 20) locationScore = 0.9;
      else if (distanceKm <= 50) locationScore = 0.75;
      else if (distanceKm <= 100) locationScore = 0.55;
      else locationScore = 0.35;
    }
  }

  // 5. Real Face Similarity (face-api.js 128-D Vector)
  let faceScore = null;
  let faceDistance = null;
  let faceMatchStatus = 'NO_FACE_DATA';

  const hasMissingFace = Array.isArray(missing?.faceDescriptor) && missing.faceDescriptor.length === 128;
  const hasSurvivorFace = Array.isArray(survivor?.faceDescriptor) && survivor.faceDescriptor.length === 128;

  if (hasMissingFace && hasSurvivorFace) {
    faceDistance = euclideanDistance(missing.faceDescriptor, survivor.faceDescriptor);
    if (faceDistance !== null) {
      faceScore = faceSimilarity(missing.faceDescriptor, survivor.faceDescriptor);

      if (faceScore >= 70) {
        faceMatchStatus = 'CONFIRMED_FACE_MATCH';
      } else if (faceScore >= 45) {
        faceMatchStatus = 'PROBABLE_FACE_MATCH';
      } else {
        faceMatchStatus = 'DISTINCT_FACES';
      }
    } else {
      faceScore = null;
      faceMatchStatus = 'NO_FACE_DATA';
    }
  } else if (hasMissingFace || hasSurvivorFace) {
    faceMatchStatus = 'SINGLE_FACE_ONLY';
  } else {
    faceMatchStatus = 'NO_FACE_DATA';
  }

  // 6. Composite Weighted Calculation
  let composite = 0;
  if (faceScore !== null) {
    // When valid face descriptor exists on both records:
    // Name = 35%, Face = 30%, Age = 15%, Location = 15%, Gender = 5% (Total = 100%)
    composite = (
      bestNameScore * 0.35 +
      (faceScore / 100) * 0.30 +
      ageScore * 0.15 +
      locationScore * 0.15 +
      genderScore * 0.05
    );
  } else {
    // Fallback weighting when face data is unavailable (Normalized to 100%):
    // Name = 50%, Age = 20%, Location = 20%, Gender = 10% (Total = 100%)
    composite = (
      bestNameScore * 0.50 +
      ageScore * 0.20 +
      locationScore * 0.20 +
      genderScore * 0.10
    );
  }

  const matchScore = Math.round(composite * 100);

  let confidence = 'LOW';
  if (matchScore >= 80) confidence = 'HIGH';
  else if (matchScore >= 60) confidence = 'MEDIUM';

  const isCandidate = matchScore >= 55;

  return {
    matchScore,
    confidence,
    distanceKm,
    factors: {
      nameScore: Math.round(bestNameScore * 100),
      faceScore: faceScore !== null ? faceScore : null,
      faceDistance: faceDistance !== null ? Math.round(faceDistance * 1000) / 1000 : null,
      ageScore: Math.round(ageScore * 100),
      locationScore: Math.round(locationScore * 100),
      genderScore: Math.round(genderScore * 100),
      faceMatchStatus
    },
    isCandidate
  };
}

import { evaluateEvidenceReliability, analyzePhotoQuality } from './evidence-reliability.js';
export { evaluateEvidenceReliability, analyzePhotoQuality };

/**
 * Searches and ranks all matching candidates across registries.
 */
export function findMatchesForMissingPerson(missingPerson, survivorsList, campsMap = new Map()) {
  const candidates = [];

  for (const survivor of survivorsList) {
    const camp = survivor.campId ? campsMap.get(survivor.campId) : null;
    const comparison = compareMissingWithSurvivor(missingPerson, survivor, camp);

    if (comparison.isCandidate) {
      const evidenceAssessment = evaluateEvidenceReliability({
        comparison,
        missingQuality: missingPerson.photoQuality || (missingPerson.hasPhoto ? analyzePhotoQuality({ hasPhoto: true, faceDetected: Boolean(missingPerson.faceDescriptor) }) : null),
        survivorQuality: survivor.photoQuality || (survivor.photoUrl ? analyzePhotoQuality({ hasPhoto: true, faceDetected: Boolean(survivor.faceDescriptor) }) : null),
        missingRecord: missingPerson,
        survivorRecord: survivor
      });

      candidates.push({
        missingPersonId: missingPerson.id,
        survivorId: survivor.id,
        campId: survivor.campId || null,
        campName: camp ? camp.name : 'Independent Shelter / Transit',
        missingName: missingPerson.name,
        survivorName: survivor.name,
        matchScore: comparison.matchScore,
        confidence: comparison.confidence,
        distanceKm: comparison.distanceKm,
        factors: comparison.factors,
        evidenceAssessment,
        status: 'PENDING_REVIEW',
        createdAt: new Date().toISOString()
      });
    }
  }

  // Sort descending by score
  return candidates.sort((a, b) => b.matchScore - a.matchScore);
}
