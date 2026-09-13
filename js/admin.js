let currentToken = localStorage.getItem('adminToken') || '';
let allLeads = [];

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  loginForm.addEventListener('submit', handleLogin);

  if (currentToken) {
    showDashboard();
    loadLeads();
    loadStats();
  } else {
    showLogin();
  }

  // Har 20 soniyada yangilab turish
  setInterval(() => {
    if (currentToken) {
      loadLeads(true);
      loadStats();
    }
  }, 20000);
});

function showLogin() {
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('adminApp').classList.add('hidden');
}

function showDashboard() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('adminApp').classList.remove('hidden');
}

async function handleLogin(e) {
  e.preventDefault();
  const passInput = document.getElementById('adminPasswordInput');
  const errorEl = document.getElementById('loginError');
  const password = passInput.value.trim();

  errorEl.classList.add('hidden');

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Parol noto\'g\'ri!');
    }

    currentToken = data.token;
    localStorage.setItem('adminToken', currentToken);
    showDashboard();
    loadLeads();
    loadStats();
  } catch (err) {
    errorEl.innerText = err.message;
    errorEl.classList.remove('hidden');
  }
}

function logoutAdmin() {
  localStorage.removeItem('adminToken');
  currentToken = '';
  showLogin();
}

async function loadStats() {
  try {
    const res = await fetch('/api/stats', {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.success && data.stats) {
      document.getElementById('statTotal').innerText = data.stats.total;
      document.getElementById('statToday').innerText = data.stats.today;
      document.getElementById('statNew').innerText = data.stats.new;
      document.getElementById('statContacted').innerText = data.stats.contacted;
    }
  } catch (err) {
    console.error('Stats load error:', err);
  }
}

async function loadLeads(silent = false) {
  const tableBody = document.getElementById('leadsTableBody');
  if (!silent) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="py-8 text-center text-gray-500">
          <i class="fa-solid fa-circle-notch fa-spin text-lg mr-2"></i> Lidlar yuklanmoqda...
        </td>
      </tr>
    `;
  }

  try {
    const res = await fetch('/api/leads', {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });

    if (res.status === 401) {
      logoutAdmin();
      return;
    }

    const data = await res.json();
    if (data.success) {
      allLeads = data.leads || [];
      renderLeadsTable(allLeads);
    }
  } catch (err) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="py-6 text-center text-red-400">
          Lidlarni yuklashda xatolik yuz berdi: ${err.message}
        </td>
      </tr>
    `;
  }
}

function renderLeadsTable(leads) {
  const tableBody = document.getElementById('leadsTableBody');
  if (leads.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="py-8 text-center text-gray-500">
          <i class="fa-regular fa-folder-open text-2xl mb-2 block"></i>
          Hozircha birorta ham lid mavjud emas.
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  leads.forEach(lead => {
    // Status badges
    let statusClass = 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    if (lead.status === 'boglanildi') statusClass = 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    if (lead.status === 'tolov_qildi') statusClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    if (lead.status === 'bekor_qilindi') statusClass = 'bg-red-500/20 text-red-300 border-red-500/40';

    // Clean phone for link
    const cleanPhone = lead.phone.replace(/\D/g, '');

    html += `
      <tr class="hover:bg-gray-800/40 transition">
        <td class="py-3 px-4 font-mono text-gray-400 font-semibold">${lead.id || '-'}</td>
        <td class="py-3 px-4 text-gray-400">${lead.createdAtFormatted || lead.createdAt?.slice(0, 16) || '-'}</td>
        <td class="py-3 px-4 font-bold text-white">${escapeHtml(lead.name)}</td>
        <td class="py-3 px-4 font-mono font-semibold text-gray-200">
          <div class="flex items-center gap-2">
            <a href="tel:${lead.phone}" class="hover:text-emerald-400 transition" title="Qo'ng'iroq qilish">
              ${escapeHtml(lead.phone)}
            </a>
            <a href="https://t.me/+${cleanPhone}" target="_blank" class="text-blue-400 hover:text-blue-300" title="Telegramda ochish">
              <i class="fa-brands fa-telegram text-sm"></i>
            </a>
          </div>
        </td>
        <td class="py-3 px-4 text-gray-300">
          <span class="bg-gray-800 px-2 py-1 rounded-md text-[11px] border border-gray-700">
            ${escapeHtml(lead.course || 'Umumiy')}
          </span>
        </td>
        <td class="py-3 px-4">
          <select 
            onchange="updateLeadStatus('${lead.id}', this.value)" 
            class="bg-gray-950 border border-gray-700 rounded-lg px-2 py-1 text-xs outline-none cursor-pointer ${statusClass}"
          >
            <option value="yangi" ${lead.status === 'yangi' ? 'selected' : ''}>🟡 Yangi</option>
            <option value="boglanildi" ${lead.status === 'boglanildi' ? 'selected' : ''}>🔵 Bog'lanildi</option>
            <option value="tolov_qildi" ${lead.status === 'tolov_qildi' ? 'selected' : ''}>🟢 To'lov qildi</option>
            <option value="bekor_qilindi" ${lead.status === 'bekor_qilindi' ? 'selected' : ''}>🔴 Bekor qilindi</option>
          </select>
        </td>
        <td class="py-3 px-4 text-center">
          <button 
            onclick="deleteLead('${lead.id}')" 
            class="text-gray-500 hover:text-red-400 p-1 rounded transition" 
            title="Lidni o'chirish"
          >
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  });

  tableBody.innerHTML = html;
}

function filterLeads() {
  const query = (document.getElementById('searchInput').value || '').toLowerCase().trim();
  const status = document.getElementById('statusFilter').value;

  const filtered = allLeads.filter(lead => {
    const matchesQuery = 
      (lead.name || '').toLowerCase().includes(query) ||
      (lead.phone || '').includes(query) ||
      (lead.id || '').toLowerCase().includes(query);

    const matchesStatus = (status === 'all') || (lead.status === status);

    return matchesQuery && matchesStatus;
  });

  renderLeadsTable(filtered);
}

async function updateLeadStatus(id, newStatus) {
  try {
    const res = await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ status: newStatus })
    });

    if (!res.ok) throw new Error('Statusni yangilab bo\'lmadi');
    
    // Mahalliy holatni yangilash
    const lead = allLeads.find(l => l.id === id);
    if (lead) lead.status = newStatus;

    loadStats();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteLead(id) {
  if (!confirm(`Haqiqatan ham #${id} lidni o'chirmoqchimisiz?`)) return;

  try {
    const res = await fetch(`/api/leads/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });

    if (!res.ok) throw new Error('Lidni o\'chirib bo\'lmadi');

    allLeads = allLeads.filter(l => l.id !== id);
    filterLeads();
    loadStats();
  } catch (err) {
    alert(err.message);
  }
}

// Excel / CSV formatida eksport qilish
function exportToCSV() {
  if (allLeads.length === 0) {
    alert('Hozircha eksport qilish uchun lidlar mavjud emas!');
    return;
  }

  const headers = ['ID', 'Sana va Vaqt', 'Ism Familiya', 'Telefon', 'Kurs', 'Status'];
  const rows = allLeads.map(l => [
    `"${l.id || ''}"`,
    `"${l.createdAtFormatted || l.createdAt || ''}"`,
    `"${(l.name || '').replace(/"/g, '""')}"`,
    `"${l.phone || ''}"`,
    `"${(l.course || '').replace(/"/g, '""')}"`,
    `"${l.status || ''}"`
  ]);

  // UTF-8 BOM so that Excel properly displays Uzbek Cyrillic / Latin characters
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const dateStr = new Date().toISOString().slice(0, 10);
  link.setAttribute('href', url);
  link.setAttribute('download', `Grant42_Lidlar_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function toggleTelegramGuide() {
  const modal = document.getElementById('telegramGuideModal');
  modal.classList.toggle('hidden');
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}
