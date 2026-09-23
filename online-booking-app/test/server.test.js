// Tests use Node's built-in test runner (`node --test`) so there is
// zero external dependency to install — Jenkins can run these instantly.

const test = require('node:test');
const assert = require('node:assert/strict');
const { server } = require('../server');

// Helper: start the server on a random free port for the duration of the tests
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  baseUrl = `http://localhost:${port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('GET /health returns ok status', async () => {
  const res = await fetch(`${baseUrl}/health`);
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.status, 'ok');
});

test('GET /api/rooms returns a non-empty list', async () => {
  const res = await fetch(`${baseUrl}/api/rooms`);
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(data));
  assert.ok(data.length > 0);
});

test('POST /api/bookings creates a booking', async () => {
  const res = await fetch(`${baseUrl}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: 'r1', customerName: 'Test User', date: '2026-10-01', time: '10:00' }),
  });
  const data = await res.json();
  assert.equal(res.status, 201);
  assert.equal(data.customerName, 'Test User');
});

test('POST /api/bookings rejects a double-booking of the same slot', async () => {
  const payload = { roomId: 'r2', customerName: 'Person A', date: '2026-10-02', time: '11:00' };
  const first = await fetch(`${baseUrl}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert.equal(first.status, 201);

  const second = await fetch(`${baseUrl}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, customerName: 'Person B' }),
  });
  assert.equal(second.status, 409);
});

test('POST /api/bookings rejects a missing field', async () => {
  const res = await fetch(`${baseUrl}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: 'r1' }),
  });
  assert.equal(res.status, 400);
});

test('DELETE /api/bookings/:id cancels a booking', async () => {
  const create = await fetch(`${baseUrl}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: 'r3', customerName: 'Cancel Me', date: '2026-10-03', time: '09:00' }),
  });
  const booking = await create.json();

  const del = await fetch(`${baseUrl}/api/bookings/${booking.id}`, { method: 'DELETE' });
  assert.equal(del.status, 200);
});
