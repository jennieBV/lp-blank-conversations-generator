// DOM Page Views & Sub-header Navbar Triggers
const navBtnGenerator = document.getElementById('nav-btn-generator');
const navBtnHistory = document.getElementById('nav-btn-history');
const pageGenerator = document.getElementById('page-generator');
const pageHistory = document.getElementById('page-history');

// DOM Elements - Settings Column
const windowAccountIdInput = document.getElementById('window-accountId');
const windowAuthModeSelect = document.getElementById('window-authMode');
const btnGenerateWindowApi = document.getElementById('btn-generate-window-api');
const windowConvoCountInput = document.getElementById('window-convo-count');
const windowSkillIdInput = document.getElementById('window-skillId');

// Open list card & controls (inside page-generator)
const openConversationsTitle = document.getElementById('open-conversations-title');
const windowConversationsList = document.getElementById('window-conversations-list');
const windowBtnBatchClose = document.getElementById('window-btn-batch-close');
const windowSelectAllContainer = document.getElementById('window-select-all-container');
const windowConvoSelectAll = document.getElementById('window-convo-select-all');
const windowSelectAllLabel = document.getElementById('window-select-all-label');
const closeSuccessBanner = document.getElementById('close-success-banner');

// Closed history page card & controls (inside page-history)
const historyConversationsTitle = document.getElementById('history-conversations-title');
const historyConversationsList = document.getElementById('history-conversations-list');
const historyControlsContainer = document.getElementById('history-controls-container');
const btnClearHistory = document.getElementById('btn-clear-history');

// Terminal debug logs
const windowTerminalLogs = document.getElementById('window-terminal-logs');
const windowClearLogsBtn = document.getElementById('window-clear-logs-btn');

// Steppers
const windowConvoDecrement = document.getElementById('window-convo-decrement');
const windowConvoIncrement = document.getElementById('window-convo-increment');

// Theme Toggle
const btnThemeToggle = document.getElementById('btn-theme-toggle');

// Debug Logs Switch state
const btnToggleLogs = document.getElementById('btn-toggle-logs');
let logsEnabled = false;

// App Global State
let currentConversations = [];
let activePage = 'generator'; // 'generator' or 'history'

// Helper to log to the terminal console panel
function logToTerminal(message, type = 'info') {
  if (!logsEnabled) return;
  
  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];
  line.textContent = `[${timeStr}] ${message}`;
  
  if (windowTerminalLogs) {
    windowTerminalLogs.appendChild(line);
    windowTerminalLogs.scrollTop = windowTerminalLogs.scrollHeight;
  }
}

// Helper to render server-side detailed logs to the UI terminal console
function renderServerLogs(logs) {
  if (!logsEnabled || !logs || !Array.isArray(logs)) return;
  logs.forEach(logLine => {
    let type = 'info';
    if (logLine.includes('[SUCCESS]')) type = 'success';
    else if (logLine.includes('[ERROR]')) type = 'error';
    else if (logLine.includes('[API REQUEST]')) type = 'request';
    else if (logLine.includes('[API RESPONSE SUCCESS]')) type = 'response-success';
    else if (logLine.includes('[API RESPONSE ERROR]')) type = 'response-error';
    else if (logLine.includes('[INFO]')) type = 'info';
    logToTerminal(logLine, type);
  });
}

// Catch runtime errors
window.addEventListener('error', (event) => {
  const errorMsg = event.error ? event.error.message : event.message;
  logToTerminal(`[RUNTIME ERROR] ${errorMsg}`, 'error');
});

window.addEventListener('unhandledrejection', (event) => {
  logToTerminal(`[PROMISE REJECTION] ${event.reason}`, 'error');
});

// Clear Terminal Logs
if (windowClearLogsBtn) {
  windowClearLogsBtn.addEventListener('click', () => {
    if (windowTerminalLogs) {
      windowTerminalLogs.innerHTML = '';
      logToTerminal('Logs cleared.', 'system-msg');
    }
  });
}

// Toggle Logs State
if (btnToggleLogs) {
  btnToggleLogs.addEventListener('click', () => {
    logsEnabled = !logsEnabled;
    if (logsEnabled) {
      btnToggleLogs.textContent = 'Disable Logs';
      btnToggleLogs.classList.add('active');
      if (windowTerminalLogs) {
        windowTerminalLogs.classList.remove('logs-disabled');
        windowTerminalLogs.innerHTML = '';
      }
      logToTerminal('Logs enabled. Capturing server logs...', 'system-msg');
    } else {
      btnToggleLogs.textContent = 'Enable Logs';
      btnToggleLogs.classList.remove('active');
      if (windowTerminalLogs) {
        windowTerminalLogs.classList.add('logs-disabled');
        windowTerminalLogs.innerHTML = '<div class="log-line system-msg">[SYSTEM] Logs are disabled by default. Click "Enable Logs" to begin capture.</div>';
      }
    }
  });
}

// Toggle Page Navigation Views
function switchPage(targetPage) {
  activePage = targetPage;
  
  if (targetPage === 'generator') {
    if (navBtnGenerator) navBtnGenerator.classList.add('active');
    if (navBtnHistory) navBtnHistory.classList.remove('active');
    if (pageGenerator) pageGenerator.style.display = 'block';
    if (pageHistory) pageHistory.style.display = 'none';
    logToTerminal('Navigated to Generator view.', 'system-msg');
  } else {
    if (navBtnGenerator) navBtnGenerator.classList.remove('active');
    if (navBtnHistory) navBtnHistory.classList.add('active');
    if (pageGenerator) pageGenerator.style.display = 'none';
    if (pageHistory) pageHistory.style.display = 'block';
    
    // Explicitly hide open-list success confirmation message on moving to history view
    if (closeSuccessBanner) {
      closeSuccessBanner.style.display = 'none';
    }
    logToTerminal('Navigated to Closed History logs view.', 'system-msg');
  }
}

if (navBtnGenerator) {
  navBtnGenerator.addEventListener('click', () => switchPage('generator'));
}

if (navBtnHistory) {
  navBtnHistory.addEventListener('click', () => switchPage('history'));
}

// Apply light or dark theme
function applyTheme(theme) {
  const body = document.body;
  const html = document.documentElement;
  const sunIcon = document.querySelector('.sun-icon');
  const moonIcon = document.querySelector('.moon-icon');
  
  if (theme === 'light') {
    if (body) body.classList.add('light-theme');
    if (html) html.setAttribute('data-theme', 'light');
    if (sunIcon) sunIcon.classList.add('hidden');
    if (moonIcon) moonIcon.classList.remove('hidden');
  } else {
    if (body) body.classList.remove('light-theme');
    if (html) html.setAttribute('data-theme', 'dark');
    if (sunIcon) sunIcon.classList.remove('hidden');
    if (moonIcon) moonIcon.classList.add('hidden');
  }
}

// Theme toggler click event
if (btnThemeToggle) {
  btnThemeToggle.addEventListener('click', () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const newTheme = isLight ? 'dark' : 'light';
    applyTheme(newTheme);
    localStorage.setItem('lp_theme', newTheme);
    logToTerminal(`Theme switched to ${newTheme.toUpperCase()} mode.`, 'system-msg');
  });
}

// Preferences pre-populate
function loadSavedPreferences() {
  const savedTheme = localStorage.getItem('lp_theme') || 'dark';
  applyTheme(savedTheme);

  const savedSiteId = localStorage.getItem('lp_site_id') || '';
  if (windowAccountIdInput) {
    windowAccountIdInput.value = savedSiteId;
  }
}

if (windowAccountIdInput) {
  windowAccountIdInput.addEventListener('input', () => {
    const val = windowAccountIdInput.value.trim();
    localStorage.setItem('lp_site_id', val);
  });
}

// Stepper inputs
if (windowConvoCountInput) {
  windowConvoCountInput.addEventListener('input', () => {
    let val = parseInt(windowConvoCountInput.value);
    if (isNaN(val) || val < 1) val = 1;
    else if (val > 10) val = 10;
    windowConvoCountInput.value = val;
    updateStepperState();
  });
}

if (windowConvoDecrement && windowConvoCountInput) {
  windowConvoDecrement.addEventListener('click', () => {
    const val = parseInt(windowConvoCountInput.value) || 1;
    if (val > 1) {
      windowConvoCountInput.value = val - 1;
      updateStepperState();
    }
  });
}

if (windowConvoIncrement && windowConvoCountInput) {
  windowConvoIncrement.addEventListener('click', () => {
    const val = parseInt(windowConvoCountInput.value) || 1;
    if (val < 10) {
      windowConvoCountInput.value = val + 1;
      updateStepperState();
    }
  });
}

function updateStepperState() {
  if (!windowConvoCountInput) return;
  const val = parseInt(windowConvoCountInput.value) || 1;
  if (windowConvoDecrement) windowConvoDecrement.disabled = val <= 1;
  if (windowConvoIncrement) windowConvoIncrement.disabled = val >= 10;
}

// Fetch Active & Closed records from server db
async function fetchConversations() {
  try {
    const response = await fetch('/api/conversations');
    if (!response.ok) throw new Error('API fetch failed');
    currentConversations = await response.json();
    renderAllViews(currentConversations);
  } catch (error) {
    console.error('Fetch error:', error);
    logToTerminal('Error loading persistent conversations from backend server.', 'error');
  }
}

// Render open and closed list containers across respective views
function renderAllViews(conversations) {
  const uniqueConversations = Array.from(new Map(conversations.map(c => [c.conversationId, c])).values());
  
  const openConvos = uniqueConversations.filter(c => c.status !== 'CLOSED');
  const closedConvos = uniqueConversations.filter(c => c.status === 'CLOSED');
  
  // --- 1. RENDER OPEN LIST VIEW (Inside page-generator Column) ---
  if (openConversationsTitle) {
    openConversationsTitle.textContent = `Open blank conversations (${openConvos.length})`;
  }
  
  if (openConvos.length === 0) {
    if (windowConversationsList) {
      windowConversationsList.innerHTML = `
        <div class="empty-list-placeholder">
          <p>No open blank conversations found.</p>
        </div>
      `;
    }
    if (windowSelectAllContainer) windowSelectAllContainer.style.display = 'none';
    if (windowBtnBatchClose) windowBtnBatchClose.style.display = 'none';
  } else {
    if (windowConvoSelectAll) windowConvoSelectAll.checked = false;
    if (windowBtnBatchClose) {
      windowBtnBatchClose.disabled = true;
      windowBtnBatchClose.style.display = 'inline-block';
    }
    if (windowSelectAllContainer) {
      windowSelectAllContainer.style.display = 'flex';
      windowSelectAllLabel.textContent = `Select All (${openConvos.length})`;
    }
    
    const listHTML = openConvos.map(convo => {
      const date = new Date(convo.createdAt);
      const dateFormatted = date.toLocaleTimeString() + ' - ' + date.toLocaleDateString();
      const skillTagHTML = convo.transferredTo 
        ? `<span class="convo-badge badge-skill">Skill: ${convo.transferredTo}</span>` 
        : '';
      
      return `
        <div class="convo-item" id="convo-item-${convo.conversationId}">
          <div class="convo-item-checkbox">
            <label class="custom-checkbox-all">
              <input type="checkbox" class="convo-select-checkbox" data-id="${convo.conversationId}" data-consumer="${convo.extConsumerId}" data-account="${convo.accountId}">
              <span class="checkbox-checkmark-all"></span>
            </label>
          </div>
          <div class="convo-info">
            <div class="convo-id-row">
              <span class="convo-id-label" title="Conversation ID">${convo.conversationId}</span>
              ${skillTagHTML}
            </div>
            <div class="convo-details">
              <div>Brand ID: <span>${convo.accountId}</span> | Created: ${dateFormatted}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    if (windowConversationsList) windowConversationsList.innerHTML = listHTML;
  }

  // --- 2. RENDER CLOSED HISTORY VIEW (Inside page-history Card) ---
  if (historyConversationsTitle) {
    historyConversationsTitle.textContent = `Closed History logs (${closedConvos.length})`;
  }
  
  if (closedConvos.length === 0) {
    if (historyControlsContainer) historyControlsContainer.style.display = 'none';
    if (historyConversationsList) {
      historyConversationsList.innerHTML = `
        <div class="empty-list-placeholder">
          <p>No closed history logs found.</p>
        </div>
      `;
    }
  } else {
    if (historyControlsContainer) historyControlsContainer.style.display = 'flex';
    
    const listHTML = closedConvos.map(convo => {
      const createdDate = new Date(convo.createdAt);
      const closedDate = convo.closedAt ? new Date(convo.closedAt) : null;
      
      const createdFormatted = createdDate.toLocaleTimeString() + ' - ' + createdDate.toLocaleDateString();
      const closedFormatted = closedDate 
        ? closedDate.toLocaleTimeString() + ' - ' + closedDate.toLocaleDateString()
        : 'N/A';
        
      const skillTagHTML = convo.transferredTo 
        ? `<span class="convo-badge badge-skill">Skill: ${convo.transferredTo}</span>` 
        : '';

      return `
        <div class="convo-item closed-item" id="convo-item-${convo.conversationId}">
          <div class="convo-info full-width">
            <div class="convo-id-row">
              <span class="convo-id-label text-strike" title="Conversation ID">${convo.conversationId}</span>
              ${skillTagHTML}
              <span class="convo-badge badge-closed-status">Closed</span>
            </div>
            <div class="convo-details">
              <div>Brand ID: <span>${convo.accountId}</span> | Created: ${createdFormatted} | Closed: ${closedFormatted}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (historyConversationsList) historyConversationsList.innerHTML = listHTML;
  }
}

// Clear History logs event (inside history page view)
if (btnClearHistory) {
  btnClearHistory.addEventListener('click', async () => {
    const confirmClear = confirm('Are you sure you want to clear your closed history logs?');
    if (!confirmClear) return;
    
    try {
      const response = await fetch('/api/clear-history', {
        method: 'POST'
      });
      
      if (response.ok) {
        logToTerminal('[SUCCESS] Closed conversation history logs cleared.', 'success');
        await fetchConversations();
      } else {
        logToTerminal('[ERROR] Failed to clear closed history.', 'error');
      }
    } catch (err) {
      logToTerminal(`[ERROR] Clear history action error: ${err.message}`, 'error');
    }
  });
}

// Update the checkbox states
function updateBatchControlsState() {
  const checkboxes = document.querySelectorAll('.convo-select-checkbox');
  const checked = document.querySelectorAll('.convo-select-checkbox:checked');
  const hasChecked = checked.length > 0;
  
  if (windowBtnBatchClose && windowConvoSelectAll) {
    windowBtnBatchClose.disabled = !hasChecked;
    
    if (checkboxes.length > 0) {
      windowConvoSelectAll.checked = checkboxes.length === checked.length;
    } else {
      windowConvoSelectAll.checked = false;
    }
  }
}

// Init Checkbox actions (inside page-generator)
function initBatchControls() {
  if (windowConversationsList) {
    windowConversationsList.addEventListener('change', (e) => {
      if (e.target && e.target.classList.contains('convo-select-checkbox')) {
        const convoItem = e.target.closest('.convo-item');
        if (convoItem) {
          if (e.target.checked) convoItem.classList.add('selected');
          else convoItem.classList.remove('selected');
        }
        updateBatchControlsState();
      }
    });
  }

  if (windowConvoSelectAll) {
    windowConvoSelectAll.addEventListener('change', () => {
      const isChecked = windowConvoSelectAll.checked;
      document.querySelectorAll('.convo-select-checkbox').forEach(cb => {
        cb.checked = isChecked;
        const convoItem = cb.closest('.convo-item');
        if (convoItem) {
          if (isChecked) convoItem.classList.add('selected');
          else convoItem.classList.remove('selected');
        }
      });
      updateBatchControlsState();
    });
  }

  // Close Action
  if (windowBtnBatchClose) {
    windowBtnBatchClose.addEventListener('click', async () => {
      const checked = document.querySelectorAll('.convo-select-checkbox:checked');
      if (checked.length === 0) return;
      
      windowBtnBatchClose.disabled = true;
      if (windowConvoSelectAll) windowConvoSelectAll.disabled = true;
      document.querySelectorAll('.convo-select-checkbox').forEach(cb => cb.disabled = true);
      
      logToTerminal(`[INFO] Starting batch close processing of ${checked.length} conversation(s)...`);
      
      let successCount = 0;
      
      for (let i = 0; i < checked.length; i++) {
        const checkbox = checked[i];
        const conversationId = checkbox.getAttribute('data-id');
        const extConsumerId = checkbox.getAttribute('data-consumer');
        const accountId = checkbox.getAttribute('data-account');
        
        const itemEl = document.getElementById(`convo-item-${conversationId}`);
        if (itemEl) {
          itemEl.style.border = '1px solid var(--color-danger)';
          itemEl.style.backgroundColor = 'rgba(239, 68, 68, 0.05)';
        }
        
        logToTerminal(`[${i+1}/${checked.length}] Requesting closure for conversation: ${conversationId}...`);
        
        try {
          const payload = {
            accountId,
            conversationId,
            extConsumerId
          };

          const response = await fetch('/api/end-conversation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          
          const data = await response.json();
          if (data.logs) {
            renderServerLogs(data.logs);
          }
          
          if (response.ok && data.success) {
            successCount++;
            logToTerminal(`[${i+1}/${checked.length}] [SUCCESS] Conversation terminated: ${conversationId}`, 'success');
          } else {
            logToTerminal(`[${i+1}/${checked.length}] [ERROR] Failed to close ${conversationId}: ${data.error || 'Server error'}`, 'error');
          }
        } catch (err) {
          logToTerminal(`[${i+1}/${checked.length}] [ERROR] Close failed for ${conversationId}: ${err.message}`, 'error');
        }
      }
      
      logToTerminal(`[SUCCESS] Batch close complete! Closed ${successCount} conversation(s) successfully.`, 'success');
      
      if (windowConvoSelectAll) {
        windowConvoSelectAll.disabled = false;
        windowConvoSelectAll.checked = false;
      }
      
      // Open-page isolated confirmation banner
      if (closeSuccessBanner) {
        closeSuccessBanner.style.display = 'block';
        setTimeout(() => {
          closeSuccessBanner.style.display = 'none';
        }, 5000);
      }
      
      setTimeout(() => {
        fetchConversations();
      }, 400);
    });
  }
}

// Generator Dispatcher
if (btnGenerateWindowApi) {
  btnGenerateWindowApi.addEventListener('click', async () => {
    const accountId = windowAccountIdInput.value.trim();
    const count = parseInt(windowConvoCountInput.value) || 1;
    const skillId = windowSkillIdInput.value.trim();

    if (!accountId) {
      alert('Please enter your LivePerson Site ID.');
      return;
    }
    btnGenerateWindowApi.disabled = true;
    btnGenerateWindowApi.textContent = 'Generating...';

    logToTerminal(`Triggering unauthenticated handshake for ${count} blank conversation(s)...`);
    if (skillId) {
      logToTerminal(`Target direct Skill routing: ${skillId}`);
    }

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          count,
          skillId
        })
      });

      const data = await response.json();
      if (data.success) {
        renderServerLogs(data.logs);
        logToTerminal(`[SUCCESS] Blanks created successfully! Spawned ${data.conversations.length} session(s).`, 'success');
        await fetchConversations();
      } else {
        renderServerLogs(data.logs);
        logToTerminal(`[ERROR] Generation failed: ${data.error}`, 'error');
        alert(`Generation failed: ${data.error}`);
      }
    } catch (error) {
      logToTerminal(`[ERROR] Generation error: ${error.message}`, 'error');
      alert(`Error: ${error.message}`);
    } finally {
      btnGenerateWindowApi.disabled = false;
      btnGenerateWindowApi.textContent = 'Generate Conversations';
    }
  });
}

// On Launch
document.addEventListener('DOMContentLoaded', () => {
  loadSavedPreferences();
  updateStepperState();
  initBatchControls();
  fetchConversations();
  
  // Set default view on launch to Generator Dashboard
  switchPage('generator');
});
