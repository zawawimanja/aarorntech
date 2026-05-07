// Supabase Configuration
const SUPABASE_URL = 'https://zrtbhkjqpivojwwsicwn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_NM-SZ8pV2fl19Ee1C0eCZg_anEYKtjv'; // Updated key
const supabase = typeof supabase !== 'undefined' ? supabase : window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const USER_ID = 'aarorn_user_01'; // Hardcoded for personal use without auth

// Initial Data
const defaultData = {
    joinDate: '2024-03-14',
    balances: {
        mc: 17,
        el: 4.5,
        cl: 5
    },
    history: [
        { type: 'Earned Leave', dates: 'Apr 12 - Apr 15, 2026', days: 3.0, status: 'Approved' },
        { type: 'Medical Leave', dates: 'Mar 02, 2026', days: 1.0, status: 'Approved' }
    ]
};

// Holidays from PDF
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
    await fetchUserData();
    
    // Set current date
    const now = new Date('2026-05-07');
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    currentDateEl.textContent = now.toLocaleDateString('en-US', options);

    renderHolidays();
    calculateTenure();
}

async function fetchUserData() {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', USER_ID)
            .single();

        if (error && error.code === 'PGRST116') {
            // No user found, create one from localData or default
            console.log("No profile found, creating one...");
            const localData = JSON.parse(localStorage.getItem('aarornPortalData')) || defaultData;
            await saveToSupabase(localData);
            userData = localData;
        } else if (data) {
            userData = {
                joinDate: data.join_date,
                balances: {
                    mc: data.mc_balance,
                    el: data.el_balance,
                    cl: data.cl_balance
                },
                history: data.leave_history
            };
        }
        updateUI(false); // Update UI but don't re-save to DB
    } catch (err) {
        console.error("Supabase Error:", err);
        // Fallback to local storage if DB fails
        userData = JSON.parse(localStorage.getItem('aarornPortalData')) || defaultData;
        updateUI();
    }
}

async function saveToSupabase(dataToSave) {
    const { error } = await supabase
        .from('profiles')
        .upsert({
            id: USER_ID,
            join_date: dataToSave.joinDate,
            mc_balance: dataToSave.balances.mc,
            el_balance: dataToSave.balances.el,
            cl_balance: dataToSave.balances.cl,
            leave_history: dataToSave.history
        });
    
    if (error) console.error("Error saving to Supabase:", error);
}

function updateUI(shouldSave = true) {
    mcBalanceEl.textContent = userData.balances.mc;
    elBalanceEl.textContent = userData.balances.el;
    
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

    if (shouldSave) {
        localStorage.setItem('aarornPortalData', JSON.stringify(userData));
        saveToSupabase(userData);
    }
}

async function deleteLeave(index) {
    if (!confirm('Are you sure you want to delete this leave request? The days will be added back to your balance.')) return;

    const item = userData.history[index];
    
    // Restore balance
    if (item.type === 'Earned Leave') {
        userData.balances.el += item.days;
    } else if (item.type === 'Medical Leave') {
        userData.balances.mc += item.days;
    }

    // Remove from history
    userData.history.splice(index, 1);
    
    updateUI();
    alert('Leave deleted and balance restored!');
}

function calculateTenure() {
    const joinDate = new Date(userData.joinDate);
    const now = new Date('2026-05-07');
    
    let years = now.getFullYear() - joinDate.getFullYear();
    let months = now.getMonth() - joinDate.getMonth();
    let days = now.getDate() - joinDate.getDate();

    if (days < 0) {
        months--;
        days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    }
    if (months < 0) {
        years--;
        months += 12;
    }

    const tenureEl = document.getElementById('service-tenure');
    if (tenureEl) {
        tenureEl.textContent = `${years}Y ${months}M ${days}D`;
    }
}

function renderHolidays() {
    const holidayListEl = document.getElementById('holiday-list');
    if (!holidayListEl) return;

    const upcomingHolidays = holidays2026
        .filter(h => new Date(h.date) >= new Date('2026-05-01'))
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 4);
    
    holidayListEl.innerHTML = upcomingHolidays.map(h => {
        const date = new Date(h.date);
        return `
            <div class="stat-card" style="margin-bottom: 0.75rem; padding: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 600;">${h.name}</span>
                    <span style="font-size: 0.8rem; color: var(--accent);">${date.toLocaleDateString('en-US', {month:'short', day:'2-digit'})} (${date.toLocaleDateString('en-US', {weekday:'short'})})</span>
                </div>
            </div>
        `;
    }).join('');

    const holidayValueEl = document.querySelector('.stat-card:nth-child(4) .value');
    if (holidayValueEl) holidayValueEl.textContent = upcomingHolidays.length;
}

leaveForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const type = document.getElementById('leaveType').value;
    const start = new Date(document.getElementById('startDate').value);
    const end = new Date(document.getElementById('endDate').value);
    
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (type === 'EL') {
        if (userData.balances.el >= diffDays) userData.balances.el -= diffDays;
        else { alert('Insufficient EL balance!'); return; }
    } else if (type === 'MC') {
        if (userData.balances.mc >= diffDays) userData.balances.mc -= diffDays;
        else { alert('Insufficient MC balance!'); return; }
    }

    userData.history.unshift({
        type: type === 'EL' ? 'Earned Leave' : type === 'MC' ? 'Medical Leave' : 'Compassionate Leave',
        dates: `${start.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})} - ${end.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}`,
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

init();
