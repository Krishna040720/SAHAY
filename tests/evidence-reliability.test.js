import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzePhotoQuality,
  evaluateEvidenceReliability
} from '../src/engine/evidence-reliability.js';
import { compareMissingWithSurvivor } from '../src/engine/matching.js';

test('Evidence Quality: 1. Good-quality face', () => {
  const quality = analyzePhotoQuality({
    hasPhoto: true,
    faceDetected: true,
    faceCount: 1,
    brightness: 130,
    sharpness: 85,
    box: { x: 50, y: 50, width: 200, height: 200, imageWidth: 640, imageHeight: 480 },
    occlusionScore: 0,
    poseDeviation: 5
  });

  assert.equal(quality.faceDetected, true);
  assert.equal(quality.faceUsable, true);
  assert.equal(quality.lightingLevel, 'OPTIMAL');
  assert.equal(quality.blurLevel, 'SHARP');
  assert.equal(quality.occlusionLevel, 'NONE');
  assert.equal(quality.cropQuality, 'OPTIMAL');
  assert.ok(quality.qualityScore >= 80, `Expected qualityScore >= 80, got ${quality.qualityScore}`);
  assert.equal(quality.reliabilityLevel, 'HIGH');
  assert.equal(quality.warnings.length, 0);
});

test('Evidence Quality: 2. Dark photo', () => {
  const quality = analyzePhotoQuality({
    hasPhoto: true,
    faceDetected: true,
    faceCount: 1,
    brightness: 35, // Very dark
    sharpness: 75,
    box: { x: 50, y: 50, width: 200, height: 200, imageWidth: 640, imageHeight: 480 }
  });

  assert.equal(quality.lightingLevel, 'DARK');
  assert.equal(quality.faceUsable, false, 'Dark photo must not be marked as usable for reliable biometrics');
  assert.ok(quality.warnings.some((w) => w.toLowerCase().includes('underexposed') || w.toLowerCase().includes('lighting')));
});

test('Evidence Quality: 3. Blurry photo', () => {
  const quality = analyzePhotoQuality({
    hasPhoto: true,
    faceDetected: true,
    faceCount: 1,
    brightness: 120,
    sharpness: 25, // High blur
    box: { x: 50, y: 50, width: 200, height: 200, imageWidth: 640, imageHeight: 480 }
  });

  assert.equal(quality.blurLevel, 'HIGH_BLUR');
  assert.equal(quality.faceUsable, false, 'Blurry photo must not be marked as usable');
  assert.ok(quality.warnings.some((w) => w.toLowerCase().includes('blur')));
});

test('Evidence Quality: 4. Cropped face', () => {
  const quality = analyzePhotoQuality({
    hasPhoto: true,
    faceDetected: true,
    faceCount: 1,
    brightness: 120,
    sharpness: 80,
    box: { x: 1, y: 1, width: 300, height: 300, imageWidth: 320, imageHeight: 320 }, // Cropped tight at border
    isCropped: true
  });

  assert.equal(quality.cropQuality, 'EXCESSIVE_CROP');
  assert.equal(quality.faceUsable, false);
  assert.ok(quality.warnings.some((w) => w.toLowerCase().includes('crop') || w.toLowerCase().includes('cut off')));
});

test('Evidence Quality: 5. Partially covered / occluded face', () => {
  const quality = analyzePhotoQuality({
    hasPhoto: true,
    faceDetected: true,
    faceCount: 1,
    brightness: 120,
    sharpness: 80,
    occlusionScore: 60, // High occlusion (mask/cloth)
    isOccluded: true
  });

  assert.equal(quality.occlusionLevel, 'HIGH');
  assert.equal(quality.faceUsable, false);
  assert.ok(quality.warnings.some((w) => w.toLowerCase().includes('occlusion') || w.toLowerCase().includes('covering')));
});

test('Evidence Quality: 6. Multiple faces in photo', () => {
  const quality = analyzePhotoQuality({
    hasPhoto: true,
    faceDetected: true,
    faceCount: 3, // Group photo
    brightness: 120,
    sharpness: 80
  });

  assert.equal(quality.multipleFaces, true);
  assert.equal(quality.faceCount, 3);
  assert.equal(quality.faceUsable, false, 'Multi-face photos must not be marked usable for single identification');
  assert.ok(quality.warnings.some((w) => w.toLowerCase().includes('multiple faces')));
});

test('Evidence Assessment: 7. High face similarity + Wrong demographic information (CONFLICTING_EVIDENCE)', () => {
  const v1 = new Array(128).fill(0.05);
  const v2 = v1.map((x, i) => (i % 8 === 0 ? x + 0.01 : x)); // Very close face vector (faceScore >= 85)

  // Person with completely different name, large age gap, different gender/district
  const missing = {
    id: 'MIS-701',
    name: 'Tarun Gogoi',
    age: 65,
    gender: 'Male',
    lastSeenLat: 26.12,
    lastSeenLng: 91.74,
    faceDescriptor: v1
  };

  const survivor = {
    id: 'SURV-701',
    name: 'Biren Borah', // Completely different name
    age: 22, // 43 years age gap
    gender: 'Male', // Same gender
    latitude: 24.84,
    longitude: 92.79, // Far distance (> 100km)
    faceDescriptor: v2
  };

  const comparison = compareMissingWithSurvivor(missing, survivor);
  const goodQuality = analyzePhotoQuality({ hasPhoto: true, faceDetected: true, brightness: 120, sharpness: 80 });

  const assessment = evaluateEvidenceReliability({
    comparison,
    missingQuality: goodQuality,
    survivorQuality: goodQuality,
    missingRecord: missing,
    survivorRecord: survivor
  });

  // Must not be automatically accepted or rejected; must be flagged as CONFLICTING_EVIDENCE
  assert.equal(assessment.classification, 'CONFLICTING_EVIDENCE');
  assert.equal(assessment.consistencyStatus, 'CONFLICTING');
  assert.equal(assessment.humanReviewRecommended, true);
  assert.ok(assessment.flags.length > 0);
});

test('Evidence Assessment: 8. Low face similarity + Correct demographic information (CONFLICTING_EVIDENCE)', () => {
  const v1 = new Array(128).fill(0.05);
  const vFar = new Array(128).fill(0.85); // Completely distant face vector (faceScore = 0%)

  const missing = {
    id: 'MIS-801',
    name: 'Rajesh Sharma',
    age: 36,
    gender: 'Male',
    lastSeenLat: 26.04,
    lastSeenLng: 89.99,
    faceDescriptor: v1
  };

  const survivor = {
    id: 'SURV-801',
    name: 'Rajesh Sharma', // Exact name match
    age: 36, // Exact age
    gender: 'Male', // Exact gender
    latitude: 26.04,
    longitude: 89.99, // Exact location
    faceDescriptor: vFar
  };

  const comparison = compareMissingWithSurvivor(missing, survivor);
  const goodQuality = analyzePhotoQuality({ hasPhoto: true, faceDetected: true, brightness: 120, sharpness: 80 });

  const assessment = evaluateEvidenceReliability({
    comparison,
    missingQuality: goodQuality,
    survivorQuality: goodQuality,
    missingRecord: missing,
    survivorRecord: survivor
  });

  // Name and location are identical, but faces are completely distinct -> CONFLICTING_EVIDENCE
  assert.equal(assessment.classification, 'CONFLICTING_EVIDENCE');
  assert.equal(assessment.consistencyStatus, 'CONFLICTING');
  assert.equal(assessment.humanReviewRecommended, true);
});

test('Evidence Assessment: 9. No detectable face in photo', () => {
  const missing = {
    id: 'MIS-901',
    name: 'Suresh Das',
    age: 40,
    gender: 'Male',
    lastSeenLat: 26.04,
    lastSeenLng: 89.99,
    faceDescriptor: null
  };

  const survivor = {
    id: 'SURV-901',
    name: 'Suresh Das',
    age: 40,
    gender: 'Male',
    latitude: 26.04,
    longitude: 89.99,
    faceDescriptor: null
  };

  const comparison = compareMissingWithSurvivor(missing, survivor);
  const noFaceQuality = analyzePhotoQuality({ hasPhoto: true, faceDetected: false });

  assert.equal(noFaceQuality.faceDetected, false);
  assert.equal(noFaceQuality.faceUsable, false);
  assert.equal(noFaceQuality.reliabilityLevel, 'UNRELIABLE');

  const assessment = evaluateEvidenceReliability({
    comparison,
    missingQuality: noFaceQuality,
    survivorQuality: noFaceQuality,
    missingRecord: missing,
    survivorRecord: survivor
  });

  assert.equal(assessment.isBiometricReliable, false);
  assert.equal(assessment.classification, 'LOW_QUALITY_FACE');
});

test('Evidence Assessment: 10. Insufficient evidence (low signals, missing photos)', () => {
  const missing = {
    id: 'MIS-1001',
    name: 'Tarun',
    age: null,
    gender: 'Unknown',
    lastSeenLat: null,
    lastSeenLng: null,
    faceDescriptor: null
  };

  const survivor = {
    id: 'SURV-1001',
    name: 'Biren',
    age: null,
    gender: 'Unknown',
    latitude: null,
    longitude: null,
    faceDescriptor: null
  };

  const comparison = compareMissingWithSurvivor(missing, survivor);
  const missingQuality = analyzePhotoQuality({ hasPhoto: false });
  const survivorQuality = analyzePhotoQuality({ hasPhoto: false });

  const assessment = evaluateEvidenceReliability({
    comparison,
    missingQuality,
    survivorQuality,
    missingRecord: missing,
    survivorRecord: survivor
  });

  assert.equal(assessment.classification, 'INSUFFICIENT_EVIDENCE');
  assert.equal(assessment.isBiometricReliable, false);
  assert.equal(assessment.humanReviewRecommended, true);
});
