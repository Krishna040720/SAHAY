import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEmergencySms, formatSmsAlert } from '../src/engine/sms-gateway.js';

test('SMS Gateway: Parse Missing Person Emergency SMS', () => {
  const sms = 'SAHAY MISSING Tarun Das, 32, Male, Bilasipara Bazar, +919876543210';
  const result = parseEmergencySms(sms);

  assert.equal(result.success, true);
  assert.equal(result.action, 'CREATE_MISSING_REPORT');
  assert.equal(result.data.name, 'Tarun Das');
  assert.equal(result.data.age, 32);
  assert.equal(result.data.gender, 'Male');
  assert.equal(result.data.lastSeenLocation, 'Bilasipara Bazar');
  assert.equal(result.data.contactPhone, '+919876543210');
});

test('SMS Gateway: Parse Camp Status Update SMS', () => {
  const sms = 'SAHAY CAMP CAMP-101 OCC 420 WATER 30 FOOD 40 MED 80';
  const result = parseEmergencySms(sms, '+919435012345');

  assert.equal(result.success, true);
  assert.equal(result.action, 'UPDATE_CAMP_STATUS');
  assert.equal(result.data.campCode, 'CAMP-101');
  assert.equal(result.data.occupancy, 420);
  assert.equal(result.data.water, 30);
  assert.equal(result.data.food, 40);
  assert.equal(result.data.medical, 80);
});

test('SMS Gateway: Parse Survivor Registration SMS', () => {
  const sms = 'SAHAY SURVIVOR Meena Paul, 26, Female, CAMP-102';
  const result = parseEmergencySms(sms);

  assert.equal(result.success, true);
  assert.equal(result.action, 'REGISTER_SURVIVOR');
  assert.equal(result.data.name, 'Meena Paul');
  assert.equal(result.data.age, 26);
  assert.equal(result.data.campCode, 'CAMP-102');
});

test('SMS Gateway: Error handling for invalid syntax', () => {
  const invalidPrefix = 'HELP MISSING John Doe';
  const res1 = parseEmergencySms(invalidPrefix);
  assert.equal(res1.success, false);

  const missingParams = 'SAHAY MISSING John';
  const res2 = parseEmergencySms(missingParams);
  assert.equal(res2.success, false);
});

test('SMS Gateway: Format Outgoing SMS Alerts', () => {
  const alert = formatSmsAlert('MATCH_CONFIRMATION', {
    missingName: 'Rajesh Sharma',
    campName: 'Dhubri Camp',
    contactPhone: '+919864011223',
    matchId: 'MATCH-101'
  });

  assert.ok(alert.includes('Rajesh Sharma'));
  assert.ok(alert.includes('Dhubri Camp'));
  assert.ok(alert.includes('Verification ID: MATCH-101'));
});
