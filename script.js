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
const EL_ANNUAL = 12; // Total annual EL entitlement

// Default data
const defaultData = {
    joinDate: '2024-03-14',
    balances: { mc: 17, cl: 5 },
    el_taken: 0, // EL days used; balance is calculated dynamically
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

let userData = { ...defaultData };

// DOM Elements
const mcBalanceEl = document.getElementById('mc-balance');
const elBalanceEl = document.getElementById('el-balance');
const historyBody = document.getElementById('history-body');
const currentDateEl = document.getElementById('current-date');
const leaveModal = document.getElementById('leaveModal');
const leaveForm = document.getElementById('leaveForm');

// --- Auto EL Accrual ---
// Calculates EL earned so far this year: 1 day per completed month + 0.5 for partial month
function calculateELEarned() {
    const now = new Date();
    const monthsCompleted = now.getMonth(); // 0=Jan, 4=May → 4 completed months
    const partial = now.getDate() >= 15 ? 1.0 : 0.5; // First half = 0.5, second half = 1.0
    return Math.min(monthsCompleted + partial, EL_ANNUAL);
}

function getELRemaining() {
    const earned = calculateELEarned();
    const remaining = parseFloat((earned - (userData.el_taken || 0)).toFixed(1));
    return Math.max(remaining, 0);
}

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
        console.warn("Supabase Fetch Failed, using defaults:", e);
        userData = { ...defaultData };
        updateUI(false);
    }

    // Set current date (real time)
    const now = new Date();
    if (currentDateEl) {
        currentDateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    renderHolidays();
    calculateTenure();
    console.log(`EL Earned: ${calculateELEarned()}, EL Taken: ${userData.el_taken}, EL Remaining: ${getELRemaining()}`);
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
            console.log("No profile found, seeding with defaults...");
            userData = { ...defaultData };
            await saveToSupabase(userData);
        } else {
            throw error;
        }
    } else if (data) {
        console.log("Data loaded from Supabase:", data);
        userData = {
            joinDate: data.join_date || defaultData.joinDate,
            balances: {
                mc: parseFloat(data.mc_balance) || defaultData.balances.mc,
                cl: parseFloat(data.cl_balance) || defaultData.balances.cl
            },
            el_taken: parseFloat(data.el_taken) || 0,
            history: data.leave_history || []
        };
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
            cl_balance: dataToSave.balances.cl,
            el_taken: dataToSave.el_taken || 0,
            leave_history: dataToSave.history
        });
    if (error) console.error("Save failed:", error);
}

function updateUI(shouldSave = true) {
    const elRemaining = getELRemaining();
    const elEarned = calculateELEarned();

    if (mcBalanceEl) mcBalanceEl.textContent = userData.balances.mc;
    if (elBalanceEl) elBalanceEl.textContent = elRemaining;

    // Update EL progress bar (out of 12 total)
    const elProgressBar = document.getElementById('el-progress-bar');
    if (elProgressBar) {
        const pct = Math.min((elRemaining / EL_ANNUAL) * 100, 100);
        elProgressBar.style.width = pct + '%';
    }

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
        saveToSupabase(userData);
    }
}

async function deleteLeave(index) {
    if (!confirm('Delete this leave and restore balance?')) return;
    const item = userData.history[index];
    if (item.type === 'Earned Leave') {
        userData.el_taken = Math.max(0, (userData.el_taken || 0) - item.days);
    } else if (item.type === 'Medical Leave') {
        userData.balances.mc += item.days;
    }
    userData.history.splice(index, 1);
    updateUI();
}

function calculateTenure() {
    const joinDate = new Date(userData.joinDate);
    const now = new Date();
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
    const now = new Date();
    const upcoming = holidays2026
        .filter(h => new Date(h.date) >= now)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 4);
    holidayListEl.innerHTML = upcoming.map(h => {
        const d = new Date(h.date);
        return `<div class="holiday-item">
            <span style="font-size: 0.875rem; font-weight: 500; color: var(--md-on-surface);">${h.name}</span>
            <span style="font-size: 0.75rem; font-weight: 700; color: var(--md-primary); background: var(--md-primary-container); padding: 0.25rem 0.6rem; border-radius: 99px;">${d.toLocaleDateString('en-US', {month:'short', day:'2-digit'})}</span>
        </div>`;
    }).join('');
}

leaveForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const type = document.getElementById('leaveType').value;
    const start = new Date(document.getElementById('startDate').value);
    const end = new Date(document.getElementById('endDate').value);
    const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;

    if (type === 'EL') {
        const remaining = getELRemaining();
        if (remaining >= diffDays) {
            userData.el_taken = (userData.el_taken || 0) + diffDays;
        } else {
            alert(`Insufficient EL! You have ${remaining} days remaining.`);
            return;
        }
    } else if (type === 'MC') {
        if (userData.balances.mc >= diffDays) {
            userData.balances.mc -= diffDays;
        } else {
            alert(`Insufficient MC! You have ${userData.balances.mc} days remaining.`);
            return;
        }
    }

    userData.history.unshift({
        type: type === 'EL' ? 'Earned Leave' : type === 'MC' ? 'Medical Leave' : 'Compassionate Leave',
        dates: `${start.toLocaleDateString('en-US', {month:'short', day:'numeric'})} - ${end.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}`,
        days: diffDays,
        status: 'Approved'
    });

    updateUI();
    closeModal();
    leaveForm.reset();
});

function openModal() { leaveModal.style.display = 'flex'; }
function closeModal() { leaveModal.style.display = 'none'; }
window.onclick = (e) => { if (e.target == leaveModal) closeModal(); }

// Initialize Flatpickr date pickers
const startPicker = flatpickr("#startDate", {
    dateFormat: "Y-m-d",
    minDate: "today",
    disableMobile: true,
    onChange: function(selectedDates) {
        endPicker.set("minDate", selectedDates[0]);
    }
});

const endPicker = flatpickr("#endDate", {
    dateFormat: "Y-m-d",
    minDate: "today",
    disableMobile: true
});

init();

// --- Theme Toggle Logic ---
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    if (themeIcon) {
        if (theme === 'dark') {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        } else {
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
        }
    }
}

// Check saved theme or system preference
const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
setTheme(savedTheme);

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        setTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });
}
