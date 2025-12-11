// Data Models and Constants
const SLOT_IDS = ['morning', 'noon', 'evening', 'bedtime'];
const SLOT_LABELS = {
    morning: '朝',
    noon: '昼', 
    evening: '夕',
    bedtime: '寝前'
};

const DEFAULT_SETTINGS = {
    slots: {
        morning: '07:00',
        noon: '12:00',
        evening: '18:00',
        bedtime: '22:00'
    },
    eyeDrops: [
        { id: 'A', name: '目薬A', slots: ['morning', 'noon', 'evening', 'bedtime'], color: '#4CAF50' },
        { id: 'B', name: '目薬B', slots: ['morning', 'noon', 'evening', 'bedtime'], color: '#2196F3' },
        { id: 'C', name: '目薬C', slots: ['morning', 'evening'], color: '#FF9800' }
    ]
};

// Global State
let settings = null;
let dayLogs = [];
let todayLog = null;
let timerInterval = null;
let timerEndTime = null;

// LocalStorage Utilities
function saveSettings() {
    try {
        localStorage.setItem('eyedrops_settings', JSON.stringify(settings));
    } catch (error) {
        console.error('Failed to save settings:', error);
        alert('設定の保存に失敗しました。');
    }
}

function loadSettings() {
    try {
        const stored = localStorage.getItem('eyedrops_settings');
        if (stored) {
            const parsed = JSON.parse(stored);
            // Validate and merge with defaults to handle missing properties
            return {
                slots: { ...DEFAULT_SETTINGS.slots, ...parsed.slots },
                eyeDrops: parsed.eyeDrops || DEFAULT_SETTINGS.eyeDrops
            };
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

function saveDayLogs() {
    try {
        localStorage.setItem('eyedrops_logs', JSON.stringify(dayLogs));
    } catch (error) {
        console.error('Failed to save day logs:', error);
        alert('記録の保存に失敗しました。');
    }
}

function loadDayLogs() {
    try {
        const stored = localStorage.getItem('eyedrops_logs');
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Failed to load day logs:', error);
    }
    return [];
}

// Date Utilities
function getTodayString() {
    const today = new Date();
    // Use local time instead of UTC to avoid timezone issues
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`; // YYYY-MM-DD format in local time
}

function formatDateForDisplay(dateString) {
    // Parse date string as local date to avoid timezone shift
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed in Date constructor
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const weekday = weekdays[date.getDay()];
    return `${year}年${month}月${day}日（${weekday}）`;
}

function getCurrentTime() {
    const now = new Date();
    // Ensure local time formatting
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`; // HH:mm format in local time
}

// Day Log Management
function getOrCreateTodayLog() {
    const today = getTodayString();
    let log = dayLogs.find(dl => dl.date === today);
    
    if (!log) {
        log = createDayLog(today, settings);
        dayLogs.push(log);
        saveDayLogs();
    }
    
    return log;
}

function createDayLog(date, currentSettings) {
    const doses = [];
    
    currentSettings.eyeDrops.forEach(eyeDrop => {
        eyeDrop.slots.forEach(slot => {
            doses.push({
                dropId: eyeDrop.id,
                slot: slot,
                plannedTime: currentSettings.slots[slot],
                takenAt: null
            });
        });
    });
    
    return { date, doses };
}

// UI Rendering Functions
function renderTodayView() {
    // Update date display
    document.getElementById('today-date').textContent = formatDateForDisplay(getTodayString());
    
    // Update time displays in header
    SLOT_IDS.forEach(slotId => {
        const element = document.getElementById(`time-${slotId}`);
        if (element) {
            element.textContent = settings.slots[slotId];
        }
    });
    
    // Render dose grid
    const doseGrid = document.getElementById('dose-grid');
    doseGrid.innerHTML = '';
    
    settings.eyeDrops.forEach(eyeDrop => {
        // Create eyedrop label cell
        const labelCell = document.createElement('div');
        labelCell.className = 'eyedrop-label';
        labelCell.textContent = eyeDrop.name;
        labelCell.style.backgroundColor = eyeDrop.color + '20'; // 20% opacity
        labelCell.style.borderLeft = `4px solid ${eyeDrop.color}`;
        labelCell.style.color = eyeDrop.color;
        labelCell.style.fontWeight = '700';
        doseGrid.appendChild(labelCell);
        
        // Create dose buttons for each slot
        SLOT_IDS.forEach(slotId => {
            const cell = document.createElement('div');
            cell.className = 'dose-cell';
            
            if (eyeDrop.slots.includes(slotId)) {
                const dose = todayLog.doses.find(d => d.dropId === eyeDrop.id && d.slot === slotId);
                const button = document.createElement('button');
                button.className = `dose-button ${dose.takenAt ? 'completed' : 'pending'}`;
                button.dataset.dropId = eyeDrop.id;
                button.dataset.slot = slotId;
                
                if (dose.takenAt) {
                    const time = new Date(dose.takenAt).toTimeString().slice(0, 5);
                    button.innerHTML = `済<br>${time}`;
                    button.style.borderColor = eyeDrop.color;
                    button.style.backgroundColor = eyeDrop.color + '20';
                } else {
                    button.textContent = '未';
                    button.style.borderColor = eyeDrop.color + '80';
                    button.style.backgroundColor = eyeDrop.color + '10';
                }
                
                button.addEventListener('click', handleDoseClick);
                cell.appendChild(button);
            } else {
                const disabledButton = document.createElement('div');
                disabledButton.className = 'dose-button disabled';
                disabledButton.textContent = '―';
                cell.appendChild(disabledButton);
            }
            
            doseGrid.appendChild(cell);
        });
    });
    
    updateProgress();
}

function handleDoseClick(event) {
    const button = event.target;
    const dropId = button.dataset.dropId;
    const slot = button.dataset.slot;
    
    if (button.classList.contains('completed')) {
        // Optionally implement undo functionality
        const confirm = window.confirm('この記録を取り消しますか？');
        if (confirm) {
            undoDose(dropId, slot);
        }
        return;
    }
    
    // Mark as taken
    markDoseAsTaken(dropId, slot);
    
    // Show timer option
    showTimerOption();
}

function markDoseAsTaken(dropId, slot) {
    const dose = todayLog.doses.find(d => d.dropId === dropId && d.slot === slot);
    if (dose) {
        dose.takenAt = new Date().toISOString();
        saveDayLogs();
        renderTodayView();
    }
}

function undoDose(dropId, slot) {
    const dose = todayLog.doses.find(d => d.dropId === dropId && d.slot === slot);
    if (dose) {
        dose.takenAt = null;
        saveDayLogs();
        renderTodayView();
    }
}

function updateProgress() {
    const total = todayLog.doses.length;
    const completed = todayLog.doses.filter(d => d.takenAt).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    document.getElementById('progress-count').textContent = `${completed} / ${total} 回済`;
    document.getElementById('progress-percent').textContent = `${percentage}%`;
    document.getElementById('progress-fill').style.width = `${percentage}%`;
}

// Timer Functions
function showTimerOption() {
    document.getElementById('timer-section').classList.remove('hidden');
    startTimer();
}

function startTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    const duration = 5 * 60 * 1000; // 5 minutes in milliseconds
    timerEndTime = Date.now() + duration;
    
    updateTimerDisplay();
    timerInterval = setInterval(updateTimerDisplay, 1000);
}

function updateTimerDisplay() {
    const remaining = Math.max(0, timerEndTime - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('timer-countdown').textContent = display;
    
    if (remaining <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        alert('次の目薬の時間です！');
        document.getElementById('timer-section').classList.add('hidden');
    }
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    document.getElementById('timer-section').classList.add('hidden');
}

// Settings Functions
function renderSettingsView() {
    // Update time inputs
    SLOT_IDS.forEach(slotId => {
        const input = document.getElementById(`time-setting-${slotId}`);
        if (input) {
            input.value = settings.slots[slotId];
        }
    });
    
    // Render eyedrop settings
    const container = document.getElementById('eyedrop-settings');
    container.innerHTML = '';
    
    settings.eyeDrops.forEach(eyeDrop => {
        const settingDiv = document.createElement('div');
        settingDiv.className = 'eyedrop-setting';
        
        const title = document.createElement('h3');
        title.textContent = `目薬 ${eyeDrop.id}`;
        settingDiv.appendChild(title);
        
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'eyedrop-name';
        nameInput.value = eyeDrop.name;
        nameInput.dataset.dropId = eyeDrop.id;
        settingDiv.appendChild(nameInput);
        
        // Color input group
        const colorGroup = document.createElement('div');
        colorGroup.className = 'color-input-group';
        
        const colorLabel = document.createElement('label');
        colorLabel.textContent = 'パッケージの色:';
        
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.className = 'color-picker';
        colorInput.value = eyeDrop.color;
        colorInput.dataset.dropId = eyeDrop.id;
        
        const colorPreview = document.createElement('div');
        colorPreview.className = 'color-preview';
        colorPreview.style.backgroundColor = eyeDrop.color;
        colorPreview.textContent = eyeDrop.name;
        
        colorInput.addEventListener('input', (e) => {
            colorPreview.style.backgroundColor = e.target.value;
        });
        
        colorGroup.appendChild(colorLabel);
        colorGroup.appendChild(colorInput);
        colorGroup.appendChild(colorPreview);
        settingDiv.appendChild(colorGroup);
        
        const checkboxContainer = document.createElement('div');
        checkboxContainer.className = 'slot-checkboxes';
        
        SLOT_IDS.forEach(slotId => {
            const checkboxGroup = document.createElement('div');
            checkboxGroup.className = 'checkbox-group';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `${eyeDrop.id}-${slotId}`;
            checkbox.checked = eyeDrop.slots.includes(slotId);
            checkbox.dataset.dropId = eyeDrop.id;
            checkbox.dataset.slot = slotId;
            
            const label = document.createElement('label');
            label.htmlFor = `${eyeDrop.id}-${slotId}`;
            label.textContent = SLOT_LABELS[slotId];
            
            checkboxGroup.appendChild(checkbox);
            checkboxGroup.appendChild(label);
            checkboxContainer.appendChild(checkboxGroup);
        });
        
        settingDiv.appendChild(checkboxContainer);
        container.appendChild(settingDiv);
    });
}

function saveSettingsFromForm() {
    // Save time slots
    SLOT_IDS.forEach(slotId => {
        const input = document.getElementById(`time-setting-${slotId}`);
        if (input) {
            settings.slots[slotId] = input.value;
        }
    });
    
    // Save eyedrop settings
    settings.eyeDrops.forEach(eyeDrop => {
        const nameInput = document.querySelector(`input[data-drop-id="${eyeDrop.id}"].eyedrop-name`);
        if (nameInput) {
            eyeDrop.name = nameInput.value;
        }
        
        const colorInput = document.querySelector(`input[data-drop-id="${eyeDrop.id}"].color-picker`);
        if (colorInput) {
            eyeDrop.color = colorInput.value;
        }
        
        eyeDrop.slots = [];
        SLOT_IDS.forEach(slotId => {
            const checkbox = document.getElementById(`${eyeDrop.id}-${slotId}`);
            if (checkbox && checkbox.checked) {
                eyeDrop.slots.push(slotId);
            }
        });
    });
    
    saveSettings();
    
    // Regenerate today's log if needed (when slots change)
    todayLog = getOrCreateTodayLog();
    
    renderTodayView();
    alert('設定を保存しました。');
}

function resetSettings() {
    if (confirm('設定をデフォルトに戻しますか？現在の設定は失われます。')) {
        settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        saveSettings();
        renderSettingsView();
        renderTodayView();
        alert('設定をリセットしました。');
    }
}

// History Functions
function renderHistoryView() {
    const container = document.getElementById('history-content');
    container.innerHTML = '';
    
    if (dayLogs.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">記録がありません。</p>';
        return;
    }
    
    // Sort by date (newest first)
    const sortedLogs = [...dayLogs].sort((a, b) => b.date.localeCompare(a.date));
    
    sortedLogs.forEach(dayLog => {
        const item = document.createElement('div');
        item.className = 'history-item';
        
        const total = dayLog.doses.length;
        const completed = dayLog.doses.filter(d => d.takenAt).length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        const header = document.createElement('div');
        header.className = 'history-header';
        header.innerHTML = `
            <div class="history-date">${formatDateForDisplay(dayLog.date)}</div>
            <div class="history-stats">
                <span class="history-progress">${completed} / ${total} 回（${percentage}%）</span>
            </div>
        `;
        
        const details = document.createElement('div');
        details.className = 'history-details';
        details.innerHTML = renderHistoryDetails(dayLog);
        
        header.addEventListener('click', () => {
            details.classList.toggle('expanded');
        });
        
        item.appendChild(header);
        item.appendChild(details);
        container.appendChild(item);
    });
}

function renderHistoryDetails(dayLog) {
    const grid = ['', '朝', '昼', '夕', '寝前'];
    
    settings.eyeDrops.forEach(eyeDrop => {
        grid.push(eyeDrop.name);
        
        SLOT_IDS.forEach(slotId => {
            if (eyeDrop.slots.includes(slotId)) {
                const dose = dayLog.doses.find(d => d.dropId === eyeDrop.id && d.slot === slotId);
                if (dose && dose.takenAt) {
                    const time = new Date(dose.takenAt).toTimeString().slice(0, 5);
                    grid.push(`済 ${time}`);
                } else {
                    grid.push('未');
                }
            } else {
                grid.push('―');
            }
        });
    });
    
    return `
        <div class="history-grid">
            ${grid.map((cell, index) => {
                let className = 'history-cell';
                if (index < 5) className += ' header';
                else if (cell.includes('済')) className += ' completed';
                else if (cell === '未') className += ' pending';
                
                return `<div class="${className}">${cell}</div>`;
            }).join('')}
        </div>
    `;
}

// Tab Navigation
function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanels = document.querySelectorAll('.tab-panel');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;
            
            // Update button states
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update panel visibility
            tabPanels.forEach(panel => panel.classList.remove('active'));
            document.getElementById(`${targetTab}-tab`).classList.add('active');
            
            // Render appropriate content
            switch(targetTab) {
                case 'today':
                    renderTodayView();
                    break;
                case 'history':
                    renderHistoryView();
                    break;
                case 'settings':
                    renderSettingsView();
                    break;
            }
        });
    });
}

// Application Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Load data
    settings = loadSettings();
    dayLogs = loadDayLogs();
    todayLog = getOrCreateTodayLog();
    
    // Setup event listeners
    setupTabNavigation();
    
    document.getElementById('save-settings').addEventListener('click', saveSettingsFromForm);
    document.getElementById('reset-settings').addEventListener('click', resetSettings);
    document.getElementById('stop-timer').addEventListener('click', stopTimer);
    
    // Initial render
    renderTodayView();
    renderSettingsView();
    renderHistoryView();
    
    console.log('DropTime app initialized successfully');
});