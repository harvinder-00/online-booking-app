const roomSelect = document.getElementById('roomId');
const form = document.getElementById('booking-form');
const message = document.getElementById('form-message');
const tableBody = document.querySelector('#bookings-table tbody');
const healthIndicator = document.getElementById('health-indicator');

let roomsById = {};

async function loadRooms() {
  const res = await fetch('/api/rooms');
  const rooms = await res.json();
  roomsById = Object.fromEntries(rooms.map((r) => [r.id, r]));
  roomSelect.innerHTML = rooms
    .map((r) => `<option value="${r.id}">${r.name} (cap ${r.capacity})</option>`)
    .join('');
}

async function loadBookings() {
  const res = await fetch('/api/bookings');
  const bookings = await res.json();
  tableBody.innerHTML = bookings
    .map(
      (b) => `<tr>
        <td>${roomsById[b.roomId]?.name || b.roomId}</td>
        <td>${b.customerName}</td>
        <td>${b.date}</td>
        <td>${b.time}</td>
        <td><button class="cancel-btn" data-id="${b.id}">Cancel</button></td>
      </tr>`
    )
    .join('') || '<tr><td colspan="5">No bookings yet</td></tr>';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  message.textContent = '';
  const payload = {
    roomId: document.getElementById('roomId').value,
    customerName: document.getElementById('customerName').value,
    date: document.getElementById('date').value,
    time: document.getElementById('time').value,
  };

  const res = await fetch('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();

  if (!res.ok) {
    message.textContent = `❌ ${data.error}`;
    message.style.color = '#dc2626';
  } else {
    message.textContent = '✅ Room booked!';
    message.style.color = '#16a34a';
    form.reset();
    loadBookings();
  }
});

tableBody.addEventListener('click', async (e) => {
  if (!e.target.matches('.cancel-btn')) return;
  const id = e.target.dataset.id;
  await fetch(`/api/bookings/${id}`, { method: 'DELETE' });
  loadBookings();
});

async function checkHealth() {
  try {
    const res = await fetch('/health');
    const data = await res.json();
    healthIndicator.textContent = `● service healthy — uptime ${Math.floor(data.uptimeSeconds)}s — ${data.bookings} bookings`;
  } catch {
    healthIndicator.textContent = '● service unreachable';
  }
}

loadRooms().then(loadBookings);
checkHealth();
setInterval(checkHealth, 15000);
