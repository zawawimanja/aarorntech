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
    ot_credit: 0,
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
const otModal = document.getElementById('otModal');
const otForm = document.getElementById('otForm');

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

// --- Helper to get leave year ---
function getLeaveYear(item) {
    if (item.year) return item.year;
    const match = item.dates.match(/(\d{4})$/);
    if (match) return parseInt(match[1], 10);
    return new Date().getFullYear();
}

// --- Date Formatting Helper (DD/MM/YYYY) ---
function toDMYStr(d) {
    if (!d || isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

function formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    const str = String(dateStr).trim();
    
    // Check if already in DD/MM/YYYY or DD/MM/YYYY - DD/MM/YYYY format
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
        return str;
    }

    // Range with " - "
    if (str.includes(' - ')) {
        const parts = str.split(' - ');
        const d1 = new Date(parts[0]);
        const d2 = new Date(parts[1]);
        if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
            const s1 = toDMYStr(d1);
            const s2 = toDMYStr(d2);
            return s1 === s2 ? s1 : `${s1} - ${s2}`;
        }
    }

    // Single date parse
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
        return toDMYStr(d);
    }

    return str;
}

// --- Medical Leave (MC) Cycle Helper ---
function getMCCycleInfo() {
    const joinDate = new Date(userData.joinDate || '2024-03-14');
    const annivMonth = joinDate.getMonth(); // March (0-indexed: 2)
    const annivDay = joinDate.getDate(); // 14
    
    const now = new Date();
    const currentYear = now.getFullYear();
    
    let cycleStart = new Date(currentYear, annivMonth, annivDay);
    if (now < cycleStart) {
        cycleStart = new Date(currentYear - 1, annivMonth, annivDay);
    }
    
    let cycleEnd = new Date(cycleStart.getFullYear() + 1, annivMonth, annivDay - 1, 23, 59, 59);
    let nextResetDate = new Date(cycleStart.getFullYear() + 1, annivMonth, annivDay);
    
    return { cycleStart, cycleEnd, nextResetDate };
}

function parseLeaveStartDate(item) {
    if (item.startDate) return new Date(item.startDate);
    if (item.dates) {
        const parts = String(item.dates).split(' - ');
        const dmyMatch = parts[0].match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (dmyMatch) {
            return new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
        }
        const d = new Date(parts[0]);
        if (!isNaN(d.getTime())) return d;
    }
    return new Date();
}

function getMCRemaining() {
    const { cycleStart, cycleEnd } = getMCCycleInfo();
    const mcTakenInCycle = (userData.history || [])
        .filter(item => {
            const isMC = item.type && (item.type.includes('Medical Leave') || item.type === 'MC');
            if (!isMC) return false;
            const itemDate = parseLeaveStartDate(item);
            return itemDate >= cycleStart && itemDate <= cycleEnd;
        })
        .reduce((sum, item) => sum + (parseFloat(item.days) || 0), 0);

    return Math.max(0, parseFloat((18 - mcTakenInCycle).toFixed(1)));
}

// --- Carry Forward Calculation ---
function getCarryForward(year) {
    if (year <= 2025) {
        return 0;
    }
    if (year === 2026) {
        return 4; // Hardcoded carry-forward for 2026
    }
    const prevYear = year - 1;
    const prevAccrued = 12;
    const prevCarryForward = getCarryForward(prevYear);
    const prevTaken = userData.history
        .filter(item => (item.type.includes('Annual Leave') || item.type === 'Earned Leave') && getLeaveYear(item) === prevYear)
        .reduce((sum, item) => sum + item.days, 0);
    const prevRemaining = prevAccrued + prevCarryForward - prevTaken;
    return Math.max(0, parseFloat(prevRemaining.toFixed(1)));
}

// --- Auto AL Accrual ---
function calculateALEarned() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const monthsCompleted = now.getMonth();
    const partial = now.getDate() >= 15 ? 1.0 : 0.5;
    const carryForward = getCarryForward(currentYear);
    return Math.min(monthsCompleted + partial, AL_ANNUAL) + carryForward;
}

function getALRemaining() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const earned = calculateALEarned();
    const takenInCurrentYear = userData.history
        .filter(item => (item.type.includes('Annual Leave') || item.type === 'Earned Leave') && getLeaveYear(item) === currentYear)
        .reduce((sum, item) => sum + item.days, 0);
    const otCredit = userData.ot_credit || 0;
    const remaining = parseFloat((earned + otCredit - takenInCurrentYear).toFixed(1));
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
                const history = userData.history || [];
                const otFromHistory = history
                    .filter(item => item.type && (item.type.includes('OT Credit') || item.type.includes('Overtime') || item.type.includes('OT')))
                    .reduce((sum, item) => sum + (parseFloat(item.days) || 0), 0);
                if (userData.ot_credit === undefined) {
                    userData.ot_credit = otFromHistory;
                }
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
                const oldHistory = oldData.leave_history || [];
                const otFromHist = oldHistory
                    .filter(item => item.type && (item.type.includes('OT Credit') || item.type.includes('Overtime') || item.type.includes('OT')))
                    .reduce((sum, item) => sum + (parseFloat(item.days) || 0), 0);

                userData = {
                    joinDate: oldData.join_date || defaultData.joinDate,
                    balances: {
                        mc: parseFloat(oldData.mc_balance) || defaultData.balances.mc,
                        cl: parseFloat(oldData.cl_balance) || defaultData.balances.cl
                    },
                    el_taken: parseFloat(oldData.el_taken) || 0,
                    ot_credit: parseFloat(oldData.ot_credit) || otFromHist,
                    history: oldHistory
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
        let history = data.leave_history || [];

        // Check if local storage has newer history entries that failed to save to Supabase
        const localKey = USER_ID ? `aarorntech_userdata_${USER_ID}` : 'aarorntech_userdata_local';
        const localVal = localStorage.getItem(localKey) || localStorage.getItem('aarorntech_userdata_local');
        if (localVal) {
            try {
                const localParsed = JSON.parse(localVal);
                if (localParsed.history && localParsed.history.length > history.length) {
                    console.log("Local storage has newer history entries. Merging local data.");
                    history = localParsed.history;
                }
            } catch (e) {
                console.warn("Error parsing local backup data:", e);
            }
        }

        const otFromHistory = history
            .filter(item => item.type && (item.type.includes('OT Credit') || item.type.includes('Overtime') || item.type.includes('OT')))
            .reduce((sum, item) => sum + (parseFloat(item.days) || 0), 0);

        const elTakenFromHistory = history
            .filter(item => item.type && (item.type.includes('Annual Leave') || item.type === 'Earned Leave'))
            .reduce((sum, item) => sum + (parseFloat(item.days) || 0), 0);

        userData = {
            joinDate: '2024-03-14', // Hardcoded fix to override corrupted DB join_date
            balances: {
                mc: data.mc_balance !== undefined ? parseFloat(data.mc_balance) : defaultData.balances.mc,
                cl: data.cl_balance !== undefined ? parseFloat(data.cl_balance) : defaultData.balances.cl
            },
            el_taken: Math.max(parseFloat(data.el_taken) || 0, elTakenFromHistory),
            ot_credit: data.ot_credit !== undefined && !isNaN(parseFloat(data.ot_credit)) ? Math.max(parseFloat(data.ot_credit), otFromHistory) : otFromHistory,
            history: history
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
                userData.ot_credit = parseFloat(oldData.ot_credit) || 0;
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
    // Always persist to local storage first under user key and default key
    const localKey = USER_ID ? `aarorntech_userdata_${USER_ID}` : 'aarorntech_userdata_local';
    localStorage.setItem(localKey, JSON.stringify(dataToSave));
    localStorage.setItem('aarorntech_userdata_local', JSON.stringify(dataToSave));

    if (isOfflineMode || !supabaseClient || !USER_ID) return;
    try {
        const payload = {
            id: USER_ID,
            join_date: dataToSave.joinDate,
            mc_balance: dataToSave.balances.mc,
            cl_balance: dataToSave.balances.cl,
            el_taken: dataToSave.el_taken || 0,
            leave_history: dataToSave.history
        };

        if (dataToSave.ot_credit !== undefined) {
            payload.ot_credit = dataToSave.ot_credit;
        }

        const { error } = await supabaseClient
            .from('profiles')
            .upsert(payload);

        if (error) {
            console.warn("Supabase Save Warning (retrying without ot_credit column):", error);
            delete payload.ot_credit;
            const { error: retryError } = await supabaseClient
                .from('profiles')
                .upsert(payload);
            if (retryError) console.error("Supabase retry save failed:", retryError);
        }
    } catch (e) {
        console.error("Save failed due to network error:", e);
    }
}

function updateUI(shouldSave = true) {
    const alRemaining = getALRemaining();
    const currentYear = new Date().getFullYear();
    const carryForward = getCarryForward(currentYear);
    const totalForYear = AL_ANNUAL + carryForward;

    const mcRemaining = getMCRemaining();
    const { nextResetDate } = getMCCycleInfo();
    const resetDateStr = toDMYStr(nextResetDate);

    if (mcBalanceEl) mcBalanceEl.textContent = mcRemaining;
    if (alBalanceEl) alBalanceEl.textContent = alRemaining;

    const mcTotalLabel = document.getElementById('mc-total-label');
    if (mcTotalLabel) {
        mcTotalLabel.textContent = `Days remaining / 18 total (Resets ${resetDateStr})`;
    }

    const alTotalLabel = document.getElementById('al-total-label');
    if (alTotalLabel) {
        const otText = (userData.ot_credit || 0) > 0 ? ` (incl. +${userData.ot_credit}d OT)` : '';
        alTotalLabel.textContent = `Days remaining / ${totalForYear} total${otText}`;
    }

    // Update AL progress bar
    const alProgressBar = document.getElementById('al-progress-bar');
    if (alProgressBar) {
        const pct = Math.min((alRemaining / (totalForYear + (userData.ot_credit || 0))) * 100, 100);
        alProgressBar.style.width = pct + '%';
    }

    if (historyBody) {
        historyBody.innerHTML = userData.history.map((item, index) => {
            const isOT = item.type ? (item.type.includes('OT Credit') || item.type.includes('Overtime') || item.type.includes('OT')) : false;
            const statusClass = isOT ? 'status-ot' : `status-${(item.status || 'Approved').toLowerCase()}`;
            const daysText = isOT ? `+${item.days.toFixed(1)}` : item.days.toFixed(1);
            const displayDates = formatDisplayDate(item.dates);
            return `
            <tr>
                <td>${item.type === 'Earned Leave' ? 'Annual Leave' : item.type}</td>
                <td>${displayDates}</td>
                <td>${daysText}</td>
                <td>
                    <span class="status-badge ${statusClass}">${isOT ? 'Credited' : item.status}</span>
                    <button onclick="deleteLeave(${index})" style="background:none; border:none; color:var(--md-error); cursor:pointer; margin-left:10px;"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
        }).join('');
    }

    if (shouldSave) {
        saveToSupabase(userData);
    }
}

async function deleteLeave(index) {
    if (!confirm('Delete this entry and adjust balance?')) return;
    const item = userData.history[index];
    const isOT = item.type ? (item.type.includes('OT Credit') || item.type.includes('Overtime') || item.type.includes('OT')) : false;
    if (isOT) {
        userData.ot_credit = Math.max(0, parseFloat(((userData.ot_credit || 0) - item.days).toFixed(1)));
    } else if (item.type.includes('Annual Leave') || item.type === 'Earned Leave') {
        userData.el_taken = Math.max(0, parseFloat(((userData.el_taken || 0) - item.days).toFixed(1)));
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

function calculateLeaveDays() {
    const startVal = document.getElementById('startDate').value;
    const endVal = document.getElementById('endDate').value;
    const durationVal = document.getElementById('leaveDuration').value;
    const calcDaysCountEl = document.getElementById('calcDaysCount');

    if (!startVal || !endVal) {
        const defaultDays = (durationVal === 'HALF_AM' || durationVal === 'HALF_PM') ? 0.5 : 1.0;
        if (calcDaysCountEl) calcDaysCountEl.textContent = defaultDays.toFixed(1);
        return defaultDays;
    }

    const start = new Date(startVal);
    const end = new Date(endVal);
    const rawDiffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;

    let finalDays = rawDiffDays;
    if (durationVal === 'HALF_AM' || durationVal === 'HALF_PM') {
        if (rawDiffDays === 1) {
            finalDays = 0.5;
        } else {
            finalDays = rawDiffDays - 0.5;
        }
    }

    if (calcDaysCountEl) calcDaysCountEl.textContent = finalDays.toFixed(1);
    return finalDays;
}

leaveForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const type = document.getElementById('leaveType').value;
    const duration = document.getElementById('leaveDuration').value;
    const startStr = document.getElementById('startDate').value;
    const endStr = document.getElementById('endDate').value;

    if (!startStr || !endStr) return;

    const start = new Date(startStr);
    const end = new Date(endStr);
    const calcDays = calculateLeaveDays();

    let typeTitle = type === 'AL' ? 'Annual Leave' : type === 'MC' ? 'Medical Leave' : 'Compassionate Leave';
    if (duration === 'HALF_AM') {
        typeTitle += ' (Half Day AM)';
    } else if (duration === 'HALF_PM') {
        typeTitle += ' (Half Day PM)';
    }

    if (type === 'AL' || type === 'EL') {
        const remaining = getALRemaining();
        if (remaining >= calcDays) {
            userData.el_taken = (userData.el_taken || 0) + calcDays;
        } else {
            alert(`Insufficient Annual Leave! You have ${remaining} days remaining.`);
            return;
        }
    } else if (type === 'MC') {
        const remainingMC = getMCRemaining();
        if (remainingMC >= calcDays) {
            // MC balance is calculated dynamically from history
        } else {
            alert(`Insufficient MC! You have ${remainingMC} days remaining.`);
            return;
        }
    }

    const dateRangeStr = startStr === endStr 
        ? toDMYStr(start)
        : `${toDMYStr(start)} - ${toDMYStr(end)}`;

    userData.history.unshift({
        type: typeTitle,
        dates: dateRangeStr,
        days: calcDays,
        status: 'Approved',
        year: start.getFullYear(),
        startDate: startStr,
        endDate: endStr
    });

    updateUI();
    closeModal();
    leaveForm.reset();
    calculateLeaveDays();
});

function openModal() { leaveModal.style.display = 'flex'; }
function closeModal() { leaveModal.style.display = 'none'; }
function openOtModal() { 
    if (otModal) {
        otModal.style.display = 'flex'; 
        if (typeof otStartPicker !== 'undefined') otStartPicker.clear();
        if (typeof otEndPicker !== 'undefined') otEndPicker.clear();
        calculateOtDays();
    }
}
function closeOtModal() { if (otModal) otModal.style.display = 'none'; }

window.onclick = (e) => { 
    if (e.target == leaveModal) closeModal();
    if (e.target == otModal) closeOtModal();
}

// Initialize Flatpickr date pickers
let startPicker, endPicker, otStartPicker, otEndPicker;

startPicker = flatpickr("#startDate", {
    dateFormat: "Y-m-d",
    disableMobile: true,
    onChange: function(selectedDates) {
        if (endPicker) endPicker.set("minDate", selectedDates[0]);
        calculateLeaveDays();
    }
});

endPicker = flatpickr("#endDate", {
    dateFormat: "Y-m-d",
    disableMobile: true,
    onChange: function() {
        calculateLeaveDays();
    }
});

const leaveDurationEl = document.getElementById('leaveDuration');
if (leaveDurationEl) {
    leaveDurationEl.addEventListener('change', calculateLeaveDays);
}

function calculateOtDays() {
    const startEl = document.getElementById('otStartDate');
    const endEl = document.getElementById('otEndDate');
    const startStr = startEl ? startEl.value : '';
    const endStr = endEl ? endEl.value : '';
    const durationVal = parseFloat(document.getElementById('otDuration').value) || 1.0;
    const otCalcCountEl = document.getElementById('otCalcCount');

    if (!startStr || !endStr) {
        if (otCalcCountEl) otCalcCountEl.textContent = `+${durationVal.toFixed(1)}`;
        return durationVal;
    }

    const start = new Date(startStr);
    const end = new Date(endStr);
    const rawDiffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;
    const totalOtDays = rawDiffDays * durationVal;

    if (otCalcCountEl) otCalcCountEl.textContent = `+${totalOtDays.toFixed(1)}`;
    return totalOtDays;
}

otStartPicker = flatpickr("#otStartDate", {
    dateFormat: "Y-m-d",
    disableMobile: true,
    maxDate: "today",
    onChange: function(selectedDates) {
        if (otEndPicker) otEndPicker.set("minDate", selectedDates[0]);
        calculateOtDays();
    }
});

otEndPicker = flatpickr("#otEndDate", {
    dateFormat: "Y-m-d",
    disableMobile: true,
    maxDate: "today",
    onChange: function() {
        calculateOtDays();
    }
});

const otDurationEl = document.getElementById('otDuration');
if (otDurationEl) {
    otDurationEl.addEventListener('change', calculateOtDays);
}

if (otForm) {
    otForm.addEventListener('submit', (e) => {
        e.preventDefault();
        let startStr = document.getElementById('otStartDate').value;
        let endStr = document.getElementById('otEndDate').value;
        const durationVal = parseFloat(document.getElementById('otDuration').value) || 1.0;
        const otReason = document.getElementById('otReason').value;

        if (!startStr && !endStr) {
            alert('Please select the OT date worked.');
            return;
        }

        if (startStr && !endStr) {
            endStr = startStr;
            document.getElementById('otEndDate').value = startStr;
        } else if (!startStr && endStr) {
            startStr = endStr;
            document.getElementById('otStartDate').value = endStr;
        }

        const start = new Date(startStr);
        const end = new Date(endStr);
        const totalOtDays = calculateOtDays();

        userData.ot_credit = parseFloat(((userData.ot_credit || 0) + totalOtDays).toFixed(1));

        const dateRangeStr = startStr === endStr
            ? toDMYStr(start)
            : `${toDMYStr(start)} - ${toDMYStr(end)}`;

        const typeLabel = durationVal === 0.5 ? 'OT Credit (Half Day)' : 'OT Credit';

        userData.history.unshift({
            type: typeLabel,
            dates: dateRangeStr,
            days: totalOtDays,
            status: 'Approved',
            year: start.getFullYear(),
            reason: otReason,
            startDate: startStr,
            endDate: endStr
        });

        updateUI();
        closeOtModal();
        otForm.reset();
        calculateOtDays();
    });
}

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
