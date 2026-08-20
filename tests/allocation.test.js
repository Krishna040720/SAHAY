import test from 'node:test';
import assert from 'node:assert/strict';
import { getOccupancyStatus, analyzeCampResources } from '../src/engine/allocation.js';

test('Allocation Engine: Occupancy status categorization', () => {
  const over = getOccupancyStatus(460, 400);
  assert.equal(over.status, 'OVER_CAPACITY');
  assert.equal(over.isCritical, true);

  const near = getOccupancyStatus(380, 400);
  assert.equal(near.status, 'NEAR_CAPACITY');

  const ample = getOccupancyStatus(150, 400);
  assert.equal(ample.status, 'AMPLE_SPACE');
});

test('Allocation Engine: Detects critical deficits and recommends logistics transfers', () => {
  const camps = [
    {
      id: 'CAMP-A',
      name: 'Deficit Camp A',
      district: 'Zone 1',
      latitude: 26.0,
      longitude: 90.0,
      capacity: 500,
      occupancy: 550, // Over capacity
      resources: { water: 15, food: 20, medical: 60, blankets: 70 } // Water/food shortage
    },
    {
      id: 'CAMP-B',
      name: 'Surplus Camp B',
      district: 'Zone 1',
      latitude: 26.05,
      longitude: 90.05,
      capacity: 800,
      occupancy: 400,
      resources: { water: 90, food: 85, medical: 80, blankets: 80 } // Surplus
    }
  ];

  const analysis = analyzeCampResources(camps);

  assert.ok(analysis.criticalCamps.length >= 1, 'Should flag Deficit Camp A as critical');
  assert.ok(analysis.surplusCamps.length >= 1, 'Should flag Surplus Camp B as surplus');
  assert.ok(analysis.recommendedTransfers.length >= 1, 'Should recommend at least one transfer');

  const waterTransfer = analysis.recommendedTransfers.find((t) => t.resource === 'water');
  assert.ok(waterTransfer, 'Should have recommended a water transfer');
  assert.equal(waterTransfer.fromCampId, 'CAMP-B');
  assert.equal(waterTransfer.toCampId, 'CAMP-A');
  assert.ok(waterTransfer.distanceKm < 15);
});
