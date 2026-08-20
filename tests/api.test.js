import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.js';

let server;
let baseUrl;

before(async () => {
  server = createServer();
  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('API: GET /api/health returns ONLINE status', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'ONLINE');
  assert.equal(data.system, 'SAHAY Disaster Coordination Engine');
});

test('API: GET /api/stats returns high-level dashboard metrics', async () => {
  const res = await fetch(`${baseUrl}/api/stats`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.stats.campsCount >= 5);
  assert.ok(data.stats.missingCount >= 4);
  assert.ok(data.stats.totalCapacity > 0);
});

test('API: Camp CRUD and Nearby Search', async () => {
  // 1. Get all camps
  const res1 = await fetch(`${baseUrl}/api/camps`);
  const list = await res1.json();
  assert.equal(list.success, true);
  assert.ok(list.camps.length >= 5);

  // 2. Nearby search near Guwahati (26.14, 91.73)
  const resNear = await fetch(`${baseUrl}/api/camps/nearby?lat=26.14&lng=91.73&radius=50`);
  const nearby = await resNear.json();
  assert.equal(nearby.success, true);
  assert.ok(nearby.camps.length >= 1);
  assert.ok(nearby.camps[0].distanceKm < 50);

  // 3. Create new camp
  const resCreate = await fetch(`${baseUrl}/api/camps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Nagaon Stadium Shelter',
      district: 'Nagaon',
      capacity: 350,
      occupancy: 120,
      latitude: 26.34,
      longitude: 92.68
    })
  });
  assert.equal(resCreate.status, 201);
  const created = await resCreate.json();
  assert.equal(created.success, true);
  assert.equal(created.camp.name, 'Nagaon Stadium Shelter');
});

test('API: Report Missing Person and auto-trigger AI match', async () => {
  const res = await fetch(`${baseUrl}/api/missing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Bikramjit Gogoi',
      age: 52,
      gender: 'Male',
      lastSeenLocation: 'Jamugurihat area',
      contactPhone: '+919876543210',
      sourceType: 'FAMILY_MEMBER'
    })
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.report.id);
  assert.ok(data.report.trustScore >= 50);

  // Check matches queue
  const matchesRes = await fetch(`${baseUrl}/api/matches`);
  const matchesData = await matchesRes.json();
  assert.ok(matchesData.matches.length >= 1);
});

test('API: Resource Balancing & Deficit Analysis', async () => {
  const res = await fetch(`${baseUrl}/api/resources/balance`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(Array.isArray(data.criticalCamps));
  assert.ok(Array.isArray(data.surplusCamps));
  assert.ok(Array.isArray(data.recommendedTransfers));
});

test('API: Emergency SMS Bridge', async () => {
  const res = await fetch(`${baseUrl}/api/sms/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'SAHAY MISSING Hemanta Barman, 48, Male, Nalbari Ward 2, +919435099887'
    })
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.action, 'CREATE_MISSING_REPORT');
  assert.equal(data.result.name, 'Hemanta Barman');
});
