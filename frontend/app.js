// Change this after your backend is deployed.
// Example: const API_BASE_URL = "http://3.84.12.44:5000";
// Production example behind HTTPS: const API_BASE_URL = "https://api.yourdomain.com";
const API_BASE_URL = "http://localhost:5000";

const rates = {
  laborOnly: { base: 120, perHourPerMover: 55, truck: 0 },
  localMove: { base: 180, perHourPerMover: 70, truck: 95 },
  packing: { base: 100, perHourPerMover: 50, truck: 0 },
  junkRemoval: { base: 150, perHourPerMover: 45, truck: 125 }
};

const form = document.getElementById('bookingForm');
const quoteTotal = document.getElementById('quoteTotal');
const depositDue = document.getElementById('depositDue');
const formMessage = document.getElementById('formMessage');
const apiWarning = document.getElementById('apiWarning');
const navLinks = document.getElementById('navLinks');
const menuButton = document.getElementById('menuButton');

document.getElementById('year').textContent = new Date().getFullYear();
menuButton.addEventListener('click', () => navLinks.classList.toggle('open'));

function money(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function calculateLocalQuote() {
  const formData = new FormData(form);
  const serviceType = formData.get('serviceType') || 'localMove';
  const selectedRate = rates[serviceType] || rates.localMove;
  const movers = Math.max(2, Math.min(Number(formData.get('movers') || 2), 6));
  const hours = Math.max(2, Math.min(Number(formData.get('hours') || 2), 12));
  const distanceMiles = Math.max(0, Math.min(Number(formData.get('distanceMiles') || 0), 300));
  const stairs = Math.max(0, Math.min(Number(formData.get('stairs') || 0), 10));
  const heavyItems = Math.max(0, Math.min(Number(formData.get('heavyItems') || 0), 20));

  const labor = movers * hours * selectedRate.perHourPerMover;
  const distanceFee = distanceMiles > 20 ? (distanceMiles - 20) * 2.5 : 0;
  const stairsFee = stairs * 25;
  const heavyItemFee = heavyItems * 45;
  const total = Math.round(selectedRate.base + selectedRate.truck + labor + distanceFee + stairsFee + heavyItemFee);

  quoteTotal.textContent = money(total);
  depositDue.textContent = `Estimated 20% deposit: ${money(Math.round(total * 0.2))}`;
}

async function testApi() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    if (!response.ok) throw new Error('API health check failed');
    apiWarning.textContent = 'Backend API connected successfully.';
    apiWarning.style.background = '#f0fdf4';
    apiWarning.style.borderColor = '#bbf7d0';
    apiWarning.style.color = '#166534';
  } catch (error) {
    apiWarning.textContent = 'Backend API not reachable yet. Deploy backend, open port 5000, then update API_BASE_URL in frontend/app.js.';
  }
}

form.addEventListener('input', calculateLocalQuote);
calculateLocalQuote();
testApi();

form.addEventListener('submit', async event => {
  event.preventDefault();
  formMessage.textContent = 'Submitting booking request...';
  formMessage.className = 'form-message';

  const payload = Object.fromEntries(new FormData(form).entries());
  ['movers', 'hours', 'distanceMiles', 'stairs', 'heavyItems'].forEach(key => {
    payload[key] = Number(payload[key] || 0);
  });

  try {
    const response = await fetch(`${API_BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Booking failed');

    formMessage.textContent = `Success. Your request was received. Booking ID: ${data.booking.bookingId}`;
    formMessage.className = 'form-message success';
    form.reset();
    calculateLocalQuote();
  } catch (error) {
    formMessage.textContent = `Error: ${error.message}. Make sure the backend is running and API_BASE_URL is correct.`;
    formMessage.className = 'form-message error';
  }
});
