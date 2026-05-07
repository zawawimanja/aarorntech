// Supabase Configuration
const SUPABASE_URL = 'https://zrtbhkjqpivojwwsicwn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpydGJoa2pxcGl2b2p3d3NpY3duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMzM1MDUsImV4cCI6MjA5MzcwOTUwNX0.iVf0OxsY0cF9Y14SPvAiZ0oZSD6yDTIL2G1X_wgDTPM'; 

let supabaseClient;
try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Supabase client initialized.");
} catch (e) {
    console.error("Failed to initialize Supabase client.", e);
}

const USER_ID = 'aarorn_user_01';

// Initial Data
const defaultData = {
    joinDate: '2024-03-14',
    balances: { mc: 17, el: 4.5, cl: 5 },
    history: [
        { type: 'Earned Leave', dates: 'Apr 12 - Apr 15, 2026', days: 3.0, status: 'Approved' },
        { type: 'Medical Leave', dates: 'Mar 02, 2026', days: 1.0, status: 'Approved' }
    ]
};

// Holidays List
const holidays2026 = [
    { name: "New Year's Day", date: "2026-01-01" },
    { name: "Federal Territory Day", date: "2026-02-01" },
    { name: "Thaipusam", date: "2026-02-01" },
    { name: "Chinese New Year", date: "2026-02-17" },
    { name: "Nuzul Al-Quran", date: "2026-03-07" },
    { name: "Hari Raya Aidilfitri", date: "2026-03-21" },
    { name: "Good Friday", date: "2026-04-03" },
    { name: "Workers' Day", date: "2026-05-01" },
    { name: "Hari Raya Haji", date: "2026-05-27" },
    { name: "Wesak Day", date: "2026-05-31" },
    { name: "Agong's Birthday", date: "2026-06-01" },
    { name: "Awal Muharram", date: "2026-06-17" },
    { name: "Maulidur Rasul", date: "2026-08-25" },
    { name: "National Day", date: "2026-08-31" },
    { name: "Malaysia Day", date: "2026-09-16" },
    { name: "Deepavali", date: "2026-11-08" },
    { name: "Sultan of Selangor's Birthday", date: "2026-12-11" },
    { name: "Christmas Day", date: "2026-12-25" }
];

let userData = defaultData;

// DOM Elements
const mcBalanceEl = document.getElementById('mc-balance');
const elBalanceEl = document.getElementById('el-balance');
const historyBody = document.getElementById('history-body');
const currentDateEl = document.getElementById('current-date');
const leaveModal = document.getElementById('leaveModal');
const leaveForm = document.getElementById('leaveForm');

// Initialize
async function init() {
    console.log("Portal Initializing...");
    try {
        if (supabaseClient) {
            await fetchUserData();
        } else {
            throw new Error("Supabase not available");
        }
    } catch (e) {
        console.warn("Supabase Fetch Failed, using local storage:", e);
        userData = JSON.parse(localStorage.getItem('aarornPortalData')) || defaultData;
        updateUI(false);
    }
    
    // Set current date
    const now = new Date('2026-05-07');
    if (currentDateEl) {
        currentDateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    renderHolidays();
    calculateTenure();
    console.log("Portal Ready.");
}

async function fetchUserData() {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', USER_ID)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            // No profile found, create a fresh one with correct defaults
            console.log("No profile found, seeding with defaults...");
            userData = defaultData;
            await saveToSupabase(userData);
        } else {
            throw error;
        }
    } else if (data) {
        // Validate data - if balances are null/undefined, reset to defaults
        if (data.mc_balance === null || data.mc_balance === undefined || data.el_balance === null) {
            console.warn("Invalid data in DB, resetting to defaults...");
            userData = defaultData;
            await saveToSupabase(userData);
        } else {
            console.log("Data loaded from Supabase:", data);
            userData = {
                joinDate: data.join_date || defaultData.joinDate,
                balances: {
                    mc: parseFloat(data.mc_balance) || defaultData.balances.mc,
                    el: parseFloat(data.el_balance) || defaultData.balances.el,
                    cl: parseFloat(data.cl_balance) || defaultData.balances.cl
                },
                history: data.leave_history || []
            };
        }
    }
    updateUI(false);
}

async function saveToSupabase(dataToSave) {
    if (!supabaseClient) return;
    const { error } = await supabaseClient
        .from('profiles')
        .upsert({
            id: USER_ID,
            join_date: dataToSave.joinDate,
            mc_balance: dataToSave.balances.mc,
            el_balance: dataToSave.balances.el,
            cl_balance: dataToSave.balances.cl,
            leave_history: dataToSave.history
        });
    if (error) console.error("Save failed:", error);
}

function updateUI(shouldSave = true) {
    if (mcBalanceEl) mcBalanceEl.textContent = userData.balances.mc;
    if (elBalanceEl) elBalanceEl.textContent = userData.balances.el;
    
    if (historyBody) {
        historyBody.innerHTML = userData.history.map((item, index) => `
            <tr>
                <td>${item.type}</td>
                <td>${item.dates}</td>
                <td>${item.days.toFixed(1)}</td>
                <td>
                    <span class="status-badge status-${item.status.toLowerCase()}">${item.status}</span>
                    <button onclick="deleteLeave(${index})" style="background:none; border:none; color:var(--danger); cursor:pointer; margin-left:10px;"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    }

    if (shouldSave) {
        localStorage.setItem('aarornPortalData', JSON.stringify(userData));
        saveToSupabase(userData);
    }
}

async function deleteLeave(index) {
    if (!confirm('Delete this leave and restore balance?')) return;
    const item = userData.history[index];
    if (item.type === 'Earned Leave') userData.balances.el += item.days;
    else if (item.type === 'Medical Leave') userData.balances.mc += item.days;
    userData.history.splice(index, 1);
    updateUI();
}

function calculateTenure() {
    const joinDate = new Date(userData.joinDate);
    const now = new Date('2026-05-07');
    let years = now.getFullYear() - joinDate.getFullYear();
    let months = now.getMonth() - joinDate.getMonth();
    let days = now.getDate() - joinDate.getDate();
    if (days < 0) { months--; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
    if (months < 0) { years--; months += 12; }
    const tenureEl = document.getElementById('service-tenure');
    if (tenureEl) tenureEl.textContent = `${years}Y ${months}M ${days}D`;
}

function renderHolidays() {
    const holidayListEl = document.getElementById('holiday-list');
    if (!holidayListEl) return;
    const upcoming = holidays2026.filter(h => new Date(h.date) >= new Date('2026-05-01')).sort((a,b) => new Date(a.date) - new Date(b.date)).slice(0, 4);
    holidayListEl.innerHTML = upcoming.map(h => {
        const d = new Date(h.date);
        return `<div class="stat-card" style="margin-bottom:0.75rem; padding:1rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:600;">${h.name}</span>
                <span style="font-size:0.8rem; color:var(--accent);">${d.toLocaleDateString('en-US', {month:'short', day:'2-digit'})} (${d.toLocaleDateString('en-US', {weekday:'short'})})</span>
            </div>
        </div>`;
    }).join('');
    const valEl = document.querySelector('.stat-card:nth-child(4) .value');
    if (valEl) valEl.textContent = upcoming.length;
}

leaveForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const type = document.getElementById('leaveType').value;
    const start = new Date(document.getElementById('startDate').value);
    const end = new Date(document.getElementById('endDate').value);
    const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;
    if (type === 'EL') { if (userData.balances.el >= diffDays) userData.balances.el -= diffDays; else { alert('Insufficient EL!'); return; } }
    else if (type === 'MC') { if (userData.balances.mc >= diffDays) userData.balances.mc -= diffDays; else { alert('Insufficient MC!'); return; } }
    userData.history.unshift({
        type: type === 'EL' ? 'Earned Leave' : type === 'MC' ? 'Medical Leave' : 'Compassionate Leave',
        dates: `${start.toLocaleDateString('en-US', {month:'short', day:'numeric'})} - ${end.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}`,
        days: diffDays, status: 'Approved'
    });
    updateUI();
    closeModal();
    leaveForm.reset();
});

function openModal() { leaveModal.style.display = 'flex'; }
function closeModal() { leaveModal.style.display = 'none'; }
window.onclick = (e) => { if (e.target == leaveModal) closeModal(); }
init();
