// Supabase Configuration
const SUPABASE_URL = 'https://zrtbhkjqpivojwwsicwn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpydGJoa2pxcGl2b2p3d3NpY3duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMzM1MDUsImV4cCI6MjA5MzcwOTUwNX0.iVf0OxsY0cF9Y14SPvAiZ0oZSD6yDTIL2G1X_wgDTPM'; 

let supabaseClient;
let isOfflineMode = false;

try {
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log("Supabase client initialized.");
    } else {
        console.warn("Supabase library not loaded. Running in offline capability mode.");
    }
} catch (e) {
    console.error("Failed to initialize Supabase client.", e);
}

let USER_ID = null; // Set dynamically after auth
const AL_ANNUAL = 12;
const AL_ADDITIONAL = 4;

// Default data
const defaultData = {
    joinDate: '2024-03-14',
    balances: { mc: 18, cl: 5 },
    el_taken: 0,
    history: []
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
const alBalanceEl = document.getElementById('al-balance');
const historyBody = document.getElementById('history-body');
const currentDateEl = document.getElementById('current-date');
const leaveModal = document.getElementById('leaveModal');
const leaveForm = document.getElementById('leaveForm');

// Auth DOM Elements
const loginOverlay = document.getElementById('login-overlay');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');

// --- Auth Handling ---

const offlineBtn = document.getElementById('offline-btn');
const offlineOptionContainer = document.getElementById('offline-option-container');
const offlineBadge = document.getElementById('offline-badge');

function showOfflineOption(message) {
    if (loginError) {
        loginError.textContent = message || "Database connection error (Failed to fetch).";
        loginError.style.display = 'block';
    }
    if (offlineOptionContainer) {
        offlineOptionContainer.style.display = 'block';
    }
}

async function checkUser() {
    // Check if we already have offline mode saved in session/localStorage
    if (localStorage.getItem('aarorntech_offline_mode') === 'true') {
        enableOfflineMode();
        return;
    }

    if (!supabaseClient) {
        showOfflineOption("Supabase could not be initialized. Please check your internet connection.");
        return;
    }

    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error) throw error;
        handleAuthState(session);

        // Listen for auth changes
        supabaseClient.auth.onAuthStateChange((_event, session) => {
            handleAuthState(session);
        });
    } catch (e) {
        console.error("Auth check failed:", e);
        showOfflineOption("Unable to connect to the database (Failed to fetch). You can continue in Offline Mode.");
        handleAuthState(null);
    }
}

function handleAuthState(session) {
    if (session && !isOfflineMode) {
        USER_ID = session.user.id;
        loginOverlay.style.display = 'none';
        document.body.classList.remove('auth-needed');
        if (offlineBadge) offlineBadge.style.display = 'none';
        init(); // Load data for this user
    } else if (isOfflineMode) {
        USER_ID = 'local_user';
        loginOverlay.style.display = 'none';
        document.body.classList.remove('auth-needed');
        if (offlineBadge) offlineBadge.style.display = 'flex';
        init();
    } else {
        USER_ID = null;
        loginOverlay.style.display = 'flex';
        document.body.classList.add('auth-needed');
        if (offlineBadge) offlineBadge.style.display = 'none';
    }
}

async function signIn(email, password) {
    loginError.style.display = 'none';
    if (!supabaseClient) {
        showOfflineOption("Supabase is offline. Cannot sign in.");
        return;
    }
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            loginError.textContent = error.message;
            loginError.style.display = 'block';
        }
    } catch (e) {
        console.error("Sign in failed:", e);
        showOfflineOption("Sign in failed: " + (e.message || "Failed to fetch (check database connection)."));
    }
}

function enableOfflineMode() {
    isOfflineMode = true;
    localStorage.setItem('aarorntech_offline_mode', 'true');
    handleAuthState(null); // Will trigger the isOfflineMode branch in handleAuthState
}

async function signOut() {
    if (isOfflineMode) {
        localStorage.removeItem('aarorntech_offline_mode');
        isOfflineMode = false;
    } else if (supabaseClient) {
        try {
            await supabaseClient.auth.signOut();
        } catch (e) {
            console.error("Sign out error:", e);
        }
    }
    window.location.reload(); // Refresh to reset state
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    await signIn(email, password);
});

if (offlineBtn) {
    offlineBtn.addEventListener('click', (e) => {
        e.preventDefault();
        enableOfflineMode();
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        signOut();
    });
}

// --- Auto AL Accrual ---
function calculateALEarned() {
    const now = new Date();
    const monthsCompleted = now.getMonth();
    const partial = now.getDate() >= 15 ? 1.0 : 0.5;
    return Math.min(monthsCompleted + partial, AL_ANNUAL) + AL_ADDITIONAL;
}

function getALRemaining() {
    const earned = calculateALEarned();
    const remaining = parseFloat((earned - (userData.el_taken || 0)).toFixed(1));
    return Math.max(remaining, 0);
}

// --- Data Handling ---

async function init() {
    if (!USER_ID) return;
    console.log("Portal Initializing for user:", USER_ID);
    
    try {
        await fetchUserData();
    } catch (e) {
        console.warn("Supabase Fetch Failed, using defaults:", e);
        userData = { ...defaultData };
        updateUI(false);
    }

    // Set current date
    const now = new Date();
    if (currentDateEl) {
        currentDateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    renderHolidays();
    calculateTenure();
}

async function fetchUserData() {
    if (!USER_ID) return;
    
    if (isOfflineMode) {
        console.log("Loading data from local storage (Offline Mode).");
        const localVal = localStorage.getItem('aarorntech_userdata_local');
        if (localVal) {
            try {
                userData = JSON.parse(localVal);
                console.log("Data loaded from local storage successfully.");
            } catch (e) {
                console.error("Failed to parse local storage data, using defaults:", e);
                userData = { ...defaultData };
            }
        } else {
            console.log("No local data found. Seeding with defaults.");
            userData = { ...defaultData };
            localStorage.setItem('aarorntech_userdata_local', JSON.stringify(userData));
        }
        updateUI(false);
        return;
    }

    if (!supabaseClient) {
        throw new Error("Supabase client is not available.");
    }
    
    let { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', USER_ID)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            // Check for data migration from the old hardcoded ID
            console.log("Checking for data to migrate from 'aarorn_user_01'...");
            const { data: oldData, error: oldError } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', 'aarorn_user_01')
                .single();

            if (!oldError && oldData) {
                console.log("Migrating legacy data...");
                userData = {
                    joinDate: oldData.join_date || defaultData.joinDate,
                    balances: {
                        mc: parseFloat(oldData.mc_balance) || defaultData.balances.mc,
                        cl: parseFloat(oldData.cl_balance) || defaultData.balances.cl
                    },
                    el_taken: parseFloat(oldData.el_taken) || 0,
                    history: oldData.leave_history || []
                };
                await saveToSupabase(userData);
            } else {
                console.log("No legacy data, seeding with defaults...");
                userData = { ...defaultData };
                await saveToSupabase(userData);
            }
        } else {
            throw error;
        }
    } else if (data) {
        console.log("Data loaded from Supabase.");
        userData = {
            joinDate: '2024-03-14', // Hardcoded fix to override corrupted DB join_date
            balances: {
                mc: parseFloat(data.mc_balance) || defaultData.balances.mc,
                cl: parseFloat(data.cl_balance) || defaultData.balances.cl
            },
            el_taken: parseFloat(data.el_taken) || 0,
            history: data.leave_history || []
        };

        // Special Fix: If user was accidentally seeded with MC 14 and has no history, 
        // try migrating from legacy OR just fix the defaults.
        if (userData.balances.mc === 14 && userData.history.length === 0) {
            console.log("Detected accidental MC 14 seed. Attempting to fix/migrate...");
            const { data: oldData } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', 'aarorn_user_01')
                .single();
            
            if (oldData) {
                console.log("Migrating legacy data to fix defaults...");
                userData.balances.mc = parseFloat(oldData.mc_balance) || 18;
                userData.balances.cl = parseFloat(oldData.cl_balance) || 5;
                userData.el_taken = parseFloat(oldData.el_taken) || 0;
                userData.history = oldData.leave_history || [];
                await saveToSupabase(userData);
            } else {
                console.log("No legacy data found, just fixing defaults to 18...");
                userData.balances.mc = 18;
                userData.balances.cl = 5;
                await saveToSupabase(userData);
            }
        }
    }
    updateUI(false);
}

async function saveToSupabase(dataToSave) {
    if (isOfflineMode) {
        console.log("Saving data to local storage (Offline Mode).");
        localStorage.setItem('aarorntech_userdata_local', JSON.stringify(dataToSave));
        return;
    }

    if (!supabaseClient || !USER_ID) return;
    try {
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
    } catch (e) {
        console.error("Save failed due to network error:", e);
    }
}

function updateUI(shouldSave = true) {
    const alRemaining = getALRemaining();
    const alEarned = calculateALEarned();

    if (mcBalanceEl) mcBalanceEl.textContent = userData.balances.mc;
    if (alBalanceEl) alBalanceEl.textContent = alRemaining;

    // Update AL progress bar (out of 16 total)
    const alProgressBar = document.getElementById('al-progress-bar');
    if (alProgressBar) {
        const pct = Math.min((alRemaining / (AL_ANNUAL + AL_ADDITIONAL)) * 100, 100);
        alProgressBar.style.width = pct + '%';
    }

    if (historyBody) {
        historyBody.innerHTML = userData.history.map((item, index) => `
            <tr>
                <td>${item.type === 'Earned Leave' ? 'Annual Leave' : item.type}</td>
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
    if (item.type === 'Earned Leave' || item.type === 'Annual Leave') {
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
    
    const sinceEl = document.getElementById('service-since');
    if (sinceEl) sinceEl.textContent = `Since ${joinDate.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}`;
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

    if (type === 'AL' || type === 'EL') {
        const remaining = getALRemaining();
        if (remaining >= diffDays) {
            userData.el_taken = (userData.el_taken || 0) + diffDays;
        } else {
            alert(`Insufficient Annual Leave! You have ${remaining} days remaining.`);
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
        type: (type === 'AL' || type === 'EL') ? 'Annual Leave' : type === 'MC' ? 'Medical Leave' : 'Compassionate Leave',
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
    disableMobile: true,
    onChange: function(selectedDates) {
        endPicker.set("minDate", selectedDates[0]);
    }
});

const endPicker = flatpickr("#endDate", {
    dateFormat: "Y-m-d",
    disableMobile: true
});

checkUser();

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
