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
