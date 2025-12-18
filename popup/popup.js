/**
 * FreeScout to Linear Bridge - Popup Script
 */

// ============================================================================
// DOM ELEMENTS
// ============================================================================

const elements = {
  connectionStatus: document.getElementById('connection-status'),
  createIssueBtn: document.getElementById('create-issue-btn'),
  actionHint: document.getElementById('action-hint'),
  settingsBtn: document.getElementById('settings-btn'),
  recentSection: document.getElementById('recent-section'),
  recentIssues: document.getElementById('recent-issues')
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Check Linear connection
  await checkLinearConnection();
  
  // Check current tab context
  await checkCurrentTab();
  
  // Load recent issues
  await loadRecentIssues();
  
  // Set up event listeners
  setupEventListeners();
});

// ============================================================================
// CONNECTION STATUS
// ============================================================================

async function checkLinearConnection() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'testLinearConnection' });
    
    if (response.success) {
      updateConnectionStatus('connected', `Connected as ${response.data.name}`);
    } else {
      updateConnectionStatus('error', 'Not connected - Configure API key');
    }
  } catch (error) {
    updateConnectionStatus('error', 'Connection error');
    console.error('[FreeScout-Linear] Connection check failed:', error);
  }
}

function updateConnectionStatus(status, message) {
  const dot = elements.connectionStatus.querySelector('.status-dot');
  const text = elements.connectionStatus.querySelector('.status-text');
  
  dot.className = `status-dot status-${status}`;
  text.textContent = message;
}

// ============================================================================
// TAB CONTEXT
// ============================================================================

async function checkCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      disableCreateButton('No active tab');
      return;
    }
    
    // Check if tab URL might be FreeScout
    const url = tab.url || '';
    const isFreeScout = await detectFreeScoutTab(tab);
    
    if (isFreeScout) {
      enableCreateButton();
      elements.actionHint.textContent = 'Create a Linear issue from the current ticket';
    } else {
      disableCreateButton('Navigate to a FreeScout ticket to create an issue');
    }
  } catch (error) {
    console.error('[FreeScout-Linear] Tab check failed:', error);
    disableCreateButton('Unable to detect FreeScout');
  }
}

async function detectFreeScoutTab(tab) {
  // First check URL patterns
  const url = tab.url || '';
  const urlPatterns = [
    /freescout/i,
    /\/conversation\/\d+/i,
    /\/mailbox\/\d+/i
  ];
  
  if (urlPatterns.some(pattern => pattern.test(url))) {
    return true;
  }
  
  // Try to execute content script check
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Check for FreeScout indicators in the DOM
        return !!(
          document.querySelector('.conv-wrap, .conversation-wrap') ||
          document.querySelector('[class*="freescout"]') ||
          document.body.innerHTML.toLowerCase().includes('freescout')
        );
      }
    });
    
    return results[0]?.result === true;
  } catch (error) {
    // Script execution failed (e.g., restricted page)
    return false;
  }
}

function enableCreateButton() {
  elements.createIssueBtn.disabled = false;
}

function disableCreateButton(hint) {
  elements.createIssueBtn.disabled = true;
  elements.actionHint.textContent = hint;
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function setupEventListeners() {
  // Create Issue button
  elements.createIssueBtn.addEventListener('click', handleCreateIssue);
  
  // Settings button
  elements.settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

async function handleCreateIssue() {
  const btn = elements.createIssueBtn;
  const originalContent = btn.innerHTML;
  
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span> Extracting...';
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      throw new Error('No active tab');
    }
    
    // Send message to content script to extract and show modal
    await chrome.tabs.sendMessage(tab.id, { action: 'extractTicketData' });
    
    // Close popup (the modal will handle the rest)
    window.close();
    
  } catch (error) {
    console.error('[FreeScout-Linear] Create issue failed:', error);
    btn.disabled = false;
    btn.innerHTML = originalContent;
    
    // Show error in hint
    elements.actionHint.textContent = `Error: ${error.message}`;
    elements.actionHint.style.color = '#ef4444';
  }
}

// ============================================================================
// RECENT ISSUES
// ============================================================================

async function loadRecentIssues() {
  try {
    const { recentIssues = [] } = await chrome.storage.local.get('recentIssues');
    
    if (recentIssues.length > 0) {
      elements.recentSection.style.display = 'block';
      renderRecentIssues(recentIssues);
    }
  } catch (error) {
    console.error('[FreeScout-Linear] Failed to load recent issues:', error);
  }
}

function renderRecentIssues(issues) {
  elements.recentIssues.innerHTML = issues.slice(0, 3).map(issue => `
    <a href="${issue.url}" target="_blank" class="recent-issue-item">
      <span class="recent-issue-id">${issue.identifier}</span>
      <span class="recent-issue-title">${escapeHtml(issue.title)}</span>
      <span class="recent-issue-time">${formatTimeAgo(issue.createdAt)}</span>
    </a>
  `).join('');
}

// ============================================================================
// UTILITIES
// ============================================================================

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}
