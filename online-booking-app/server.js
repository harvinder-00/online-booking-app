// Simple Online Room Booking System
// Pure Node.js (no external dependencies) so it needs zero `npm install` time —
// keeps the Docker build and Jenkins pipeline fast and dependency-free.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// ---- In-memory data store ---------------------------------------------
const rooms = [
  { id: 'r1', name: 'Conference Room A', capacity: 10 },
  { id: 'r2', name: 'Conference Room B', capacity: 6 },
  { id: 'r3', name: 'Meeting Room 1', capacity: 4 },
  { id: 'r4', name: 'Training Hall', capacity: 30 },
];

let bookings = [];

// ---- Helpers -------------------------------------------------------------
function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) req.destroy(); // basic guard against huge bodies
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function isRoomAvailable(roomId, date, time, ignoreId = null) {
  return !bookings.some(
    (b) => b.roomId === roomId && b.date === date && b.time === time && b.id !== ignoreId
  );
}

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
};

function serveStatic(req, res) {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(PUBLIC_DIR, path.normalize(filePath).replace(/^(\.\.[\/\\])+/, ''));

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

// ---- Route handling --------------------------------------------------------
async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const segments = url.pathname.split('/').filter(Boolean); // ['api', 'bookings', ':id']

  // GET /api/rooms
  if (req.method === 'GET' && url.pathname === '/api/rooms') {
    return sendJSON(res, 200, rooms);
  }

  // GET /api/bookings
  if (req.method === 'GET' && url.pathname === '/api/bookings') {
    return sendJSON(res, 200, bookings);
  }

  // POST /api/bookings
  if (req.method === 'POST' && url.pathname === '/api/bookings') {
    let body;
    try {
      body = await readBody(req);
    } catch {
      return sendJSON(res, 400, { error: 'Invalid JSON body' });
    }
    const { roomId, customerName, date, time } = body;

    if (!roomId || !customerName || !date || !time) {
      return sendJSON(res, 400, { error: 'roomId, customerName, date and time are required' });
    }
    if (!rooms.find((r) => r.id === roomId)) {
      return sendJSON(res, 404, { error: 'Room not found' });
    }
    if (!isRoomAvailable(roomId, date, time)) {
      return sendJSON(res, 409, { error: 'Room already booked for that date/time' });
    }

    const booking = { id: randomUUID(), roomId, customerName, date, time, createdAt: new Date().toISOString() };
    bookings.push(booking);
    return sendJSON(res, 201, booking);
  }

  // DELETE /api/bookings/:id
  if (req.method === 'DELETE' && segments[0] === 'api' && segments[1] === 'bookings' && segments[2]) {
    const id = segments[2];
    const before = bookings.length;
    bookings = bookings.filter((b) => b.id !== id);
    if (bookings.length === before) {
      return sendJSON(res, 404, { error: 'Booking not found' });
    }
    return sendJSON(res, 200, { deleted: id });
  }

  return sendJSON(res, 404, { error: 'Not found' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Health check endpoint - used by Docker HEALTHCHECK and can be scraped for monitoring
  if (url.pathname === '/health') {
    return sendJSON(res, 200, { status: 'ok', uptimeSeconds: process.uptime(), bookings: bookings.length });
  }

  if (url.pathname.startsWith('/api/')) {
    try {
      return await handleApi(req, res);
    } catch (err) {
      return sendJSON(res, 500, { error: 'Internal server error' });
    }
  }

  return serveStatic(req, res);
});

// Only start listening if this file is run directly (not when required by tests)
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Booking app listening on port ${PORT}`);
  });
}

module.exports = { server, rooms, bookings };
