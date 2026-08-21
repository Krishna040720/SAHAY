/**
 * SAHAY Independent Evidence Quality & Reliability Layer
 * ------------------------------------------------------
 * Provides deep image quality analysis, facial usability scoring, and cross-signal
 * evidence consistency evaluation without altering existing deterministic matching scores.
 */

/**
 * Analyzes photo quality and facial usability from image metadata / detection metrics.
 *
 * @param {Object} input
 * @param {boolean} [input.hasPhoto=true]
 * @param {boolean} [input.faceDetected=true]
 * @param {number} [input.faceCount=1]
 * @param {number} [input.brightness=120] - 0 to 255 (or 0 to 100)
 * @param {number} [input.sharpness=75] - 0 to 100
 * @param {Object} [input.box] - { width, height, imageWidth, imageHeight, x, y }
 * @param {number} [input.occlusionScore=0] - 0 (none) to 100 (high)
 * @param {number} [input.poseDeviation=0] - 0 (frontal) to 100 (extreme angle)
 * @returns {Object} Photo Quality Assessment
 */
export function analyzePhotoQuality(input = {}) {
  if (!input || input.hasPhoto === false) {
    return {
      hasPhoto: false,
      qualityScore: 0,
      faceDetected: false,
      faceVisibility: 'NONE',
      blurLevel: 'HIGH_BLUR',
      lightingLevel: 'DARK',
      cropQuality: 'EXCESSIVE_CROP',
      occlusionLevel: 'HIGH',
      multipleFaces: false,
      faceCount: 0,
      faceUsable: false,
      reliabilityLevel: 'UNRELIABLE',
      warnings: ['No photo provided']
    };
  }

  const faceDetected = input.faceDetected !== false;
  if (!faceDetected) {
    return {
      hasPhoto: true,
      qualityScore: 10,
      faceDetected: false,
      faceVisibility: 'NONE',
      blurLevel: 'HIGH_BLUR',
      lightingLevel: 'DARK',
      cropQuality: 'EXCESSIVE_CROP',
      occlusionLevel: 'HIGH',
      multipleFaces: false,
      faceCount: 0,
      faceUsable: false,
      reliabilityLevel: 'UNRELIABLE',
      warnings: ['No detectable human face in photo']
    };
  }

  const faceCount = Number(input.faceCount != null ? input.faceCount : 1);
  const multipleFaces = faceCount > 1;
  const warnings = [];

  // 1. Lighting Level Evaluation
  const brightness = Number(input.brightness != null ? input.brightness : 120);

  let lightingLevel = 'GOOD';
  let lightingPenalty = 0;
  if (brightness < 60) {
    lightingLevel = 'DARK';
    lightingPenalty = 30;
    warnings.push('Underexposed / low lighting conditions');
  } else if (brightness > 225) {
    lightingLevel = 'OVEREXPOSED';
    lightingPenalty = 25;
    warnings.push('Overexposed / harsh glare detected');
  } else if (brightness >= 90 && brightness <= 180) {
    lightingLevel = 'OPTIMAL';
  }

  // 2. Blur & Sharpness Evaluation
  const sharpness = Number(input.sharpness != null ? input.sharpness : 75);
  let blurLevel = 'SHARP';
  let blurPenalty = 0;
  if (sharpness < 40) {
    blurLevel = 'HIGH_BLUR';
    blurPenalty = 35;
    warnings.push('Severe motion blur / lack of focus');
  } else if (sharpness < 65) {
    blurLevel = 'MODERATE_BLUR';
    blurPenalty = 15;
    warnings.push('Moderate blur detected');
  }

  // 3. Cropping & Face Sizing Evaluation
  let cropQuality = 'OPTIMAL';
  let cropPenalty = 0;
  if (input.cropQuality === 'EXCESSIVE_CROP' || input.isCropped === true) {
    cropQuality = 'EXCESSIVE_CROP';
    cropPenalty = 30;
    warnings.push('Face partially cut off by image borders');
  } else if (input.box) {
    const { width, height, imageWidth = 640, imageHeight = 480, x = 0, y = 0 } = input.box;
    const imgArea = imageWidth * imageHeight;
    const faceArea = (width || 100) * (height || 100);
    const faceRatio = imgArea > 0 ? faceArea / imgArea : 0.2;

    const isNearEdge = x <= 5 || y <= 5 || (x + width) >= (imageWidth - 5) || (y + height) >= (imageHeight - 5);

    if (faceRatio < 0.03) {
      cropQuality = 'EXCESSIVE_CROP';
      cropPenalty = 25;
      warnings.push('Face too small / distant in frame');
    } else if (isNearEdge && (faceRatio > 0.45 || x <= 2 || y <= 2)) {
      cropQuality = 'EXCESSIVE_CROP';
      cropPenalty = 25;
      warnings.push('Face tightly cropped near image border');
    } else if (faceRatio < 0.08) {
      cropQuality = 'ACCEPTABLE';
      cropPenalty = 10;
    }
  }

  // 4. Occlusion Evaluation
  const occlusionScore = Number(input.occlusionScore != null ? input.occlusionScore : (input.isOccluded ? 50 : 0));
  let occlusionLevel = 'NONE';
  let occlusionPenalty = 0;
  if (occlusionScore > 40 || input.isOccluded === true) {
    occlusionLevel = 'HIGH';
    occlusionPenalty = 35;
    warnings.push('Significant facial occlusion (mask, scarf, or object covering features)');
  } else if (occlusionScore > 15) {
    occlusionLevel = 'PARTIAL';
    occlusionPenalty = 15;
    warnings.push('Partial facial obstruction detected');
  }

  // 5. Multiple Faces Check
  let multiFacePenalty = 0;
  if (multipleFaces) {
    multiFacePenalty = 30;
    warnings.push(`Multiple faces detected in frame (${faceCount} individuals)`);
  }

  // 6. Pose Angle / Extreme Rotation
  const poseDeviation = Number(input.poseDeviation != null ? input.poseDeviation : 0);
  let posePenalty = 0;
  if (poseDeviation > 45) {
    posePenalty = 20;
    warnings.push('Extreme head rotation / side profile');
  }

  // 7. Composite Quality Score (0 to 100)
  const totalPenalties = lightingPenalty + blurPenalty + cropPenalty + occlusionPenalty + multiFacePenalty + posePenalty;
  const qualityScore = Math.max(5, Math.min(100, Math.round(100 - totalPenalties)));

  // 8. Face Visibility
  let faceVisibility = 'CLEAR';
  if (occlusionLevel === 'HIGH' || lightingLevel === 'DARK' || blurLevel === 'HIGH_BLUR') {
    faceVisibility = 'POOR';
  } else if (occlusionLevel === 'PARTIAL' || blurLevel === 'MODERATE_BLUR' || cropQuality === 'EXCESSIVE_CROP') {
    faceVisibility = 'PARTIAL';
  }

  // 9. Usability for Reliable 128-D Descriptors
  const faceUsable = (
    !multipleFaces &&
    qualityScore >= 45 &&
    blurLevel !== 'HIGH_BLUR' &&
    lightingLevel !== 'DARK' &&
    occlusionLevel !== 'HIGH' &&
    cropQuality !== 'EXCESSIVE_CROP'
  );

  // 10. Overall Reliability Level
  let reliabilityLevel = 'HIGH';
  if (!faceUsable || qualityScore < 40) {
    reliabilityLevel = 'UNRELIABLE';
  } else if (qualityScore < 60) {
    reliabilityLevel = 'LOW';
  } else if (qualityScore < 80) {
    reliabilityLevel = 'MEDIUM';
  }

  return {
    hasPhoto: true,
    qualityScore,
    faceDetected: true,
    faceVisibility,
    blurLevel,
    lightingLevel,
    cropQuality,
    occlusionLevel,
    multipleFaces,
    faceCount,
    faceUsable,
    reliabilityLevel,
    warnings
  };
}

/**
 * Evaluates the multi-signal evidence reliability and classifies the candidate match.
 *
 * @param {Object} options
 * @param {Object} options.comparison - Match result from compareMissingWithSurvivor
 * @param {Object} [options.missingQuality] - Quality metrics for missing person photo
 * @param {Object} [options.survivorQuality] - Quality metrics for survivor photo
 * @param {Object} [options.missingRecord] - Missing person record
 * @param {Object} [options.survivorRecord] - Sheltered survivor record
 * @returns {Object} Evidence Assessment Output
 */
export function evaluateEvidenceReliability({
  comparison,
  missingQuality = null,
  survivorQuality = null,
  missingRecord = null,
  survivorRecord = null
}) {
  if (!comparison) {
    return {
      classification: 'INSUFFICIENT_EVIDENCE',
      reliabilityScore: 0,
      isBiometricReliable: false,
      consistencyStatus: 'INSUFFICIENT_DATA',
      evidenceSummary: 'No comparison data available.',
      missingPhotoQuality: null,
      survivorPhotoQuality: null,
      flags: ['Missing comparison data'],
      humanReviewRecommended: true
    };
  }

  const flags = [];
  const factors = comparison.factors || {};
  const nameScore = factors.nameScore ?? 0;
  const faceScore = factors.faceScore; // 0-100 or null
  const locationScore = factors.locationScore ?? 70;
  const ageScore = factors.ageScore ?? 70;
  const genderScore = factors.genderScore ?? 50;
  const distanceKm = comparison.distanceKm;

  // Resolve photo qualities
  const mQuality = missingQuality ? (missingQuality.qualityScore != null ? missingQuality : analyzePhotoQuality(missingQuality)) : null;
  const sQuality = survivorQuality ? (survivorQuality.qualityScore != null ? survivorQuality : analyzePhotoQuality(survivorQuality)) : null;

  const hasMissingPhotoProvided = Boolean(mQuality && mQuality.hasPhoto);
  const hasSurvivorPhotoProvided = Boolean(sQuality && sQuality.hasPhoto);

  const missingUsable = Boolean(mQuality && mQuality.faceUsable);
  const survivorUsable = Boolean(sQuality && sQuality.faceUsable);
  const isBiometricReliable = hasMissingPhotoProvided && hasSurvivorPhotoProvided && missingUsable && survivorUsable && faceScore !== null;

  // Add photo warnings to flags
  if (mQuality && mQuality.warnings && mQuality.warnings.length > 0) {
    mQuality.warnings.forEach((w) => flags.push(`Missing Person Photo: ${w}`));
  }
  if (sQuality && sQuality.warnings && sQuality.warnings.length > 0) {
    sQuality.warnings.forEach((w) => flags.push(`Survivor Photo: ${w}`));
  }

  // Demographic consistency evaluation
  const ageDiff = (missingRecord?.age != null && survivorRecord?.age != null)
    ? Math.abs(Number(missingRecord.age) - Number(survivorRecord.age))
    : 0;

  const hasDemographicConflict = (
    nameScore < 45 ||
    ageDiff > 14 ||
    genderScore === 0
  );

  const hasLocationConflict = (distanceKm !== null && distanceKm > 100);

  const isDemographicsStrong = (
    nameScore >= 70 &&
    ageScore >= 70 &&
    (distanceKm === null || distanceKm <= 35) &&
    genderScore >= 70
  );

  let classification = 'INSUFFICIENT_EVIDENCE';
  let consistencyStatus = 'CONSISTENT';
  let evidenceSummary = '';

  // --- Classification Hierarchy ---

  // Check 1: Low Quality Face / Unreliable Biometrics
  // If either photo provided failed facial extraction or has degraded quality
  const hasDegradedFace = (
    (hasMissingPhotoProvided && !missingUsable) ||
    (hasSurvivorPhotoProvided && !survivorUsable)
  );

  if (hasDegradedFace) {
    classification = 'LOW_QUALITY_FACE';
    consistencyStatus = 'INSUFFICIENT_DATA';
    evidenceSummary = 'Facial evidence is degraded by poor lighting, blur, extreme cropping, occlusion, or undetectable features. Biometric score must not be solely relied upon.';
  }
  // Check 2: Conflicting Evidence
  // (a) High Face Similarity (>= 70%) but Demographic / Location Conflict
  else if (isBiometricReliable && faceScore >= 70 && (hasDemographicConflict || hasLocationConflict)) {
    classification = 'CONFLICTING_EVIDENCE';
    consistencyStatus = 'CONFLICTING';
    flags.push('Strong facial vector match conflicts with disparate demographic or location records');
    evidenceSummary = `High facial biometric similarity (${faceScore}%) detected, but demographic or geographic records diverge. Do not reject automatically — require on-ground volunteer verification.`;
  }
  // (b) Low Face Similarity (< 40%) but Strong Demographic & Location Match
  else if (isBiometricReliable && faceScore < 40 && isDemographicsStrong) {
    classification = 'CONFLICTING_EVIDENCE';
    consistencyStatus = 'CONFLICTING';
    flags.push('High demographic similarity conflicts with low facial embedding similarity');
    evidenceSummary = `Strong name/demographic alignment (${nameScore}%), but facial biometric similarity is low (${faceScore}%). Requires human review to rule out photo age difference or facial trauma.`;
  }
  // Check 3: Strong Evidence
  else if (
    comparison.matchScore >= 75 &&
    (isBiometricReliable ? faceScore >= 70 : true) &&
    (isDemographicsStrong || nameScore >= 80)
  ) {
    classification = 'STRONG_EVIDENCE';
    consistencyStatus = 'CONSISTENT';
    evidenceSummary = `High-confidence multi-signal confirmation (${comparison.matchScore}%). ${isBiometricReliable ? `Verified 128-D facial match (${faceScore}%) + ` : ''}consistent demographic records.`;
  }
  // Check 4: Insufficient Evidence
  else {
    classification = 'INSUFFICIENT_EVIDENCE';
    consistencyStatus = 'INSUFFICIENT_DATA';
    if (!hasMissingPhotoProvided || !hasSurvivorPhotoProvided) {
      flags.push('One or both parties lack clear facial photographs');
    }
    evidenceSummary = 'Insufficient evidence signals to establish automated certainty. Standard volunteer triage queue assigned.';
  }

  // Calculate overall Evidence Reliability Score (0 to 100)
  const q1 = mQuality ? mQuality.qualityScore : 50;
  const q2 = sQuality ? sQuality.qualityScore : 50;
  const avgPhotoQuality = Math.round((q1 + q2) / 2);

  let reliabilityScore = Math.round(
    (comparison.matchScore * 0.50) +
    (avgPhotoQuality * 0.30) +
    (consistencyStatus === 'CONSISTENT' ? 20 : (consistencyStatus === 'CONFLICTING' ? 5 : 10))
  );
  reliabilityScore = Math.max(10, Math.min(100, reliabilityScore));

  return {
    classification,
    reliabilityScore,
    isBiometricReliable,
    consistencyStatus,
    evidenceSummary,
    missingPhotoQuality: mQuality,
    survivorPhotoQuality: sQuality,
    flags,
    humanReviewRecommended: true
  };
}
