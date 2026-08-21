import test from 'node:test';
import assert from 'node:assert/strict';
import {
  levenshteinDistance,
  stringSimilarity,
  tokenSortRatio,
  soundex,
  haversineDistance,
  calculateAgeScore,
  calculateTrustScore,
  euclideanDistance,
  faceSimilarity,
  compareMissingWithSurvivor,
  findMatchesForMissingPerson
} from '../src/engine/matching.js';

test('Matching Engine: Levenshtein Distance & String Similarity', () => {
  assert.equal(levenshteinDistance('Rajesh', 'Rajesh'), 0);
  assert.equal(levenshteinDistance('Rajesh', 'Rakesh'), 1);
  assert.equal(levenshteinDistance('Pooja', 'Puja'), 2);

  assert.equal(stringSimilarity('Rajesh', 'Rajesh'), 1.0);
  assert.ok(stringSimilarity('Rajesh', 'Rajehs') >= 0.65);
  assert.equal(stringSimilarity('', 'Something'), 0.0);
});

test('Matching Engine: Token Sort Ratio handles name permutations', () => {
  const directScore = stringSimilarity('Rajesh Kumar', 'Kumar Rajesh');
  const tokenScore = tokenSortRatio('Rajesh Kumar', 'Kumar Rajesh');

  assert.ok(tokenScore > directScore, 'Token sort should score permutations higher than direct distance');
  assert.equal(tokenScore, 1.0, 'Identical tokens in different order should yield 1.0');
});

test('Matching Engine: Soundex phonetic similarity', () => {
  const code1 = soundex('Robert');
  const code2 = soundex('Rupert');
  assert.equal(code1, code2, 'Phonetically similar names should share soundex codes');

  const codePooja = soundex('Pooja');
  const codePuja = soundex('Puja');
  assert.equal(codePooja, codePuja, 'Pooja and Puja should share soundex code');
});

test('Matching Engine: Haversine distance calculation', () => {
  // Distance between Guwahati (26.1445, 91.7362) and Tezpur (26.6338, 92.7926) ~ 118 km
  const dist = haversineDistance(26.1445, 91.7362, 26.6338, 92.7926);
  assert.ok(dist >= 110 && dist <= 125, `Expected ~118km, got ${dist}km`);

  const zeroDist = haversineDistance(26.1445, 91.7362, 26.1445, 91.7362);
  assert.equal(zeroDist, 0);
});

test('Matching Engine: Age proximity scoring', () => {
  assert.equal(calculateAgeScore(30, 30), 1.0);
  assert.equal(calculateAgeScore(30, 31), 0.95);
  assert.equal(calculateAgeScore(30, 33), 0.85);
  assert.equal(calculateAgeScore(30, 35), 0.70);
  assert.equal(calculateAgeScore(30, 50), 0.10);
});

test('Matching Engine: Trust scoring boundaries and weights', () => {
  const officialReport = {
    sourceType: 'OFFICIAL_CAMP_ADMIN',
    hasPhoto: true,
    contactPhone: '+919876543210',
    witnessCorroborations: 3,
    latitude: 26.1,
    longitude: 91.7
  };
  const officialScore = calculateTrustScore(officialReport);
  assert.ok(officialScore >= 90, `Official score should be >= 90, got ${officialScore}`);

  const anonReport = {
    sourceType: 'ANONYMOUS',
    hasPhoto: false,
    contactPhone: '',
    witnessCorroborations: 0
  };
  const anonScore = calculateTrustScore(anonReport);
  assert.ok(anonScore <= 60, `Anonymous score should be <= 60, got ${anonScore}`);
});

test('Matching Engine: Euclidean distance and 128-D Face Similarity', () => {
  const v1 = new Array(128).fill(0.1);
  const v2 = new Array(128).fill(0.1);
  assert.equal(euclideanDistance(v1, v2), 0.0, 'Identical vectors have 0 Euclidean distance');
  assert.equal(faceSimilarity(v1, v2), 100, 'Identical face vectors have 100% similarity');

  // Same/Similar face descriptors -> high face score
  const v3 = v1.map((x, i) => (i % 2 === 0 ? x + 0.02 : x - 0.02));
  const distClose = euclideanDistance(v1, v3);
  assert.ok(distClose < 0.35, `Expected close distance < 0.35, got ${distClose}`);
  const simClose = faceSimilarity(v1, v3);
  assert.ok(simClose >= 70, `Expected high similarity >= 70%, got ${simClose}`);

  // Different descriptors -> lower face score (0% for distant vectors)
  const vFar = new Array(128).fill(0.9);
  const simFar = faceSimilarity(v1, vFar);
  assert.equal(simFar, 0, 'Distant vectors have 0% face similarity');

  // Missing or invalid descriptors return null
  assert.equal(euclideanDistance(null, v1), null);
  assert.equal(euclideanDistance(v1, [1, 2]), null);
  assert.equal(faceSimilarity(null, v1), null);
});

test('Matching Engine: Final score includes face (35/30/15/15/5) when both descriptors exist', () => {
  const vA1 = new Array(128).fill(0.05);
  const vA2 = vA1.map((x, i) => (i % 4 === 0 ? x + 0.01 : x));

  const missing = {
    id: 'MIS-1',
    name: 'Rajesh Kumar Sharma',
    age: 35,
    gender: 'Male',
    lastSeenLat: 26.04,
    lastSeenLng: 89.99,
    faceDescriptor: vA1
  };

  const matchingSurvivorWithFace = {
    id: 'SURV-1',
    name: 'Rajesh Sharma',
    age: 36,
    gender: 'Male',
    latitude: 26.02,
    longitude: 89.97,
    faceDescriptor: vA2
  };

  const matchRes = compareMissingWithSurvivor(missing, matchingSurvivorWithFace);
  assert.ok(matchRes.isCandidate, 'Should be candidate match');
  assert.ok(matchRes.matchScore >= 80, `Expected matchScore >= 80, got ${matchRes.matchScore}`);
  assert.ok(matchRes.factors.faceScore >= 80, `Expected faceScore >= 80, got ${matchRes.factors.faceScore}`);
  assert.ok(matchRes.factors.faceDistance !== null, 'Face distance must be returned');
  assert.equal(matchRes.factors.faceMatchStatus, 'CONFIRMED_FACE_MATCH');
});

test('Matching Engine: Final score falls back correctly (50/20/20/10) when face data is unavailable', () => {
  const missingNoFace = {
    id: 'MIS-2',
    name: 'Pooja Devi',
    age: 28,
    gender: 'Female',
    lastSeenLat: 26.12,
    lastSeenLng: 91.74,
    faceDescriptor: null
  };

  const survivorNoFace = {
    id: 'SURV-2',
    name: 'Puja Devi',
    age: 28,
    gender: 'Female',
    latitude: 26.12,
    longitude: 91.74,
    faceDescriptor: null
  };

  const res = compareMissingWithSurvivor(missingNoFace, survivorNoFace);
  assert.ok(res.isCandidate, 'Text matching should still find candidate');
  assert.equal(res.factors.faceScore, null, 'Must NOT claim face match if face vector is null');
  assert.equal(res.factors.faceDistance, null, 'faceDistance must be null when face is missing');
  assert.equal(res.factors.faceMatchStatus, 'NO_FACE_DATA');
  assert.ok(res.matchScore >= 80, 'Deterministic score works correctly with 50/20/20/10 fallback');
});

test('Matching Engine: Composite comparison between missing and survivor', () => {
  const missing = {
    id: 'MIS-1',
    name: 'Rajesh Kumar Sharma',
    age: 35,
    gender: 'Male',
    lastSeenLat: 26.04,
    lastSeenLng: 89.99
  };

  const matchingSurvivor = {
    id: 'SURV-1',
    name: 'Rajesh Sharma',
    age: 36,
    gender: 'Male',
    latitude: 26.02,
    longitude: 89.97
  };

  const mismatchSurvivor = {
    id: 'SURV-2',
    name: 'Sita Devi',
    age: 60,
    gender: 'Female',
    latitude: 26.02,
    longitude: 89.97
  };

  const matchRes = compareMissingWithSurvivor(missing, matchingSurvivor);
  assert.ok(matchRes.isCandidate, 'Close name and location should be a candidate match');
  assert.ok(matchRes.matchScore >= 80, `Expected score >= 80, got ${matchRes.matchScore}`);

  const mismatchRes = compareMissingWithSurvivor(missing, mismatchSurvivor);
  assert.equal(mismatchRes.isCandidate, false);
  assert.ok(mismatchRes.matchScore < 40);
});
