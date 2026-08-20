import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMissingReport, validateCamp, validateSurvivor } from '../src/models/validators.js';

test('Validators: Missing person report validation', () => {
  const validReport = {
    name: 'Anjali Sarma',
    age: 24,
    gender: 'Female',
    lastSeenLocation: 'Guwahati Ward 3',
    contactPhone: '+919876543210'
  };
  const res1 = validateMissingReport(validReport);
  assert.equal(res1.isValid, true);
  assert.equal(res1.errors.length, 0);

  const invalidReport = {
    name: 'A', // Too short
    age: 200,  // Invalid age
    lastSeenLocation: '' // Missing
  };
  const res2 = validateMissingReport(invalidReport);
  assert.equal(res2.isValid, false);
  assert.ok(res2.errors.length >= 2);
});

test('Validators: Camp validation', () => {
  const validCamp = {
    name: 'Central Stadium Relief Post',
    district: 'Kamrup',
    capacity: 500,
    latitude: 26.14,
    longitude: 91.73
  };
  const res = validateCamp(validCamp);
  assert.equal(res.isValid, true);

  const invalidCamp = {
    name: 'C',
    capacity: -50,
    latitude: 195 // Out of bounds
  };
  const badRes = validateCamp(invalidCamp);
  assert.equal(badRes.isValid, false);
  assert.ok(badRes.errors.length >= 3);
});

test('Validators: Survivor check-in validation', () => {
  const validSurvivor = {
    name: 'Biren Kalita',
    age: 40
  };
  assert.equal(validateSurvivor(validSurvivor).isValid, true);

  const badSurvivor = {
    name: '',
    age: 'not-a-number'
  };
  assert.equal(validateSurvivor(badSurvivor).isValid, false);
});
