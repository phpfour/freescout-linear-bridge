/**
 * FreeScout to Linear Bridge - Options Page Script
 */

// ============================================================================
// DOM ELEMENTS
// ============================================================================

const elements = {
  // Status
  statusBanner: document.getElementById('status-banner'),
  
  // Linear API
  linearApiKey: document.getElementById('linear-api-key'),
  toggleApiKey: document.getElementById('toggle-api-key'),
  testConnection: document.getElementById('test-connection'),
  connectionResult: document.getElementById('connection-result'),
  
  // Defaults
  defaultTeam: document.getElementById('default-team'),
  defaultProject: document.getElementById('default-project'),
  labelsContainer: document.getElementById('labels-container'),
  
  // FreeScout
  freescoutDomain: document.getElementById('freescout-domain'),
  autoDetectDomain: document.getElementById('auto-detect-domain'),
  
  // Actions
  saveSettings: document.getElementById('save-settings'),
  resetSettings: document.getElementById('reset-settings')
};

// ============================================================================
// STATE
// ============================================================================

let currentSettings = {};
let selectedLabelIds = [];

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  setupEventListeners();
});

// ============================================================================
// SETTINGS MANAGEMENT
// ============================================================================

async function loadSettings() {
  try {
    currentSettings = await chrome.storage.sync.get({
      linearApiKey: '',
      defaultTeamId: '',
      defaultProjectId: '',
      defaultLabelIds: [],
      freescoutDomain: '',
      autoDetectDomain: true
    });
    
    // Populate form
    elements.linearApiKey.value = currentSettings.linearApiKey;
    elements.freescoutDomain.value = currentSettings.freescoutDomain;
    elements.autoDetectDomain.checked = currentSettings.autoDetectDomain;
    selectedLabelIds = currentSettings.defaultLabelIds || [];
    
    // If API key exists, load teams
    if (currentSettings.linearApiKey) {
      await loadTeams();
    }
    
  } catch (error) {
    console.error('Failed to load settings:', error);
    showStatus('error', 'Failed to load settings');
  }
}

async function saveSettings() {
  const btn = elements.saveSettings;
  const originalContent = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span> Saving...';
  
  try {
    const settings = {
      linearApiKey: elements.linearApiKey.value.trim(),
      defaultTeamId: elements.defaultTeam.value,
      defaultProjectId: elements.defaultProject.value,
      defaultLabelIds: selectedLabelIds,
      freescoutDomain: elements.freescoutDomain.value.trim(),
      autoDetectDomain: elements.autoDetectDomain.checked
    };
    
    await chrome.storage.sync.set(settings);
    currentSettings = settings;
    
    showStatus('success', 'Settings saved successfully!');
    
    // Refresh teams/projects if API key changed
    if (settings.linearApiKey !== currentSettings.linearApiKey) {
      await loadTeams();
    }
    
  } catch (error) {
    console.error('Failed to save settings:', error);
    showStatus('error', 'Failed to save settings');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalContent;
  }
}

async function resetSettings() {
  if (!confirm('Are you sure you want to reset all settings to defaults?')) {
    return;
  }
  
  try {
    await chrome.storage.sync.clear();
    
    // Reset form
    elements.linearApiKey.value = '';
    elements.freescoutDomain.value = '';
    elements.autoDetectDomain.checked = true;
    elements.defaultTeam.innerHTML = '<option value="">Select a team (connect first)</option>';
    elements.defaultProject.innerHTML = '<option value="">None</option>';
    elements.labelsContainer.innerHTML = '<span class="labels-placeholder">Connect to Linear to load labels</span>';
    selectedLabelIds = [];
    
    showStatus('success', 'Settings reset to defaults');
    
  } catch (error) {
    console.error('Failed to reset settings:', error);
    showStatus('error', 'Failed to reset settings');
  }
}

// ============================================================================
// LINEAR API INTEGRATION
// ============================================================================

async function testConnection() {
  const btn = elements.testConnection;
  const result = elements.connectionResult;
  const originalContent = btn.innerHTML;
  
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span> Testing...';
  result.textContent = '';
  result.className = 'connection-result';
  
  try {
    // Temporarily save the API key for testing
    const apiKey = elements.linearApiKey.value.trim();
    if (!apiKey) {
      throw new Error('Please enter an API key');
    }
    
    await chrome.storage.sync.set({ linearApiKey: apiKey });
    
    const response = await chrome.runtime.sendMessage({ action: 'testLinearConnection' });
    
    if (response.success) {
      result.textContent = `✓ Connected as ${response.data.name}`;
      result.className = 'connection-result success';
      
      // Load teams after successful connection
      await loadTeams();
    } else {
      throw new Error(response.error);
    }
    
  } catch (error) {
    result.textContent = `✗ ${error.message}`;
    result.className = 'connection-result error';
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalContent;
  }
}

async function loadTeams() {
  const select = elements.defaultTeam;
  select.innerHTML = '<option value="">Loading teams...</option>';
  
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getLinearTeams' });
    
    if (!response.success) {
      throw new Error(response.error);
    }
    
    select.innerHTML = '<option value="">Select a team</option>';
    
    response.data.forEach(team => {
      const option = document.createElement('option');
      option.value = team.id;
      option.textContent = `${team.name} (${team.key})`;
      if (team.id === currentSettings.defaultTeamId) {
        option.selected = true;
      }
      select.appendChild(option);
    });
    
    // Load projects and labels for selected team
    if (currentSettings.defaultTeamId) {
      await loadProjects(currentSettings.defaultTeamId);
      await loadLabels(currentSettings.defaultTeamId);
    }
    
  } catch (error) {
    console.error('Failed to load teams:', error);
    select.innerHTML = '<option value="">Error loading teams</option>';
  }
}

async function loadProjects(teamId) {
  const select = elements.defaultProject;
  select.innerHTML = '<option value="">Loading projects...</option>';
  
  try {
    const response = await chrome.runtime.sendMessage({ 
      action: 'getLinearProjects',
      teamId: teamId
    });
    
    if (!response.success) {
      throw new Error(response.error);
    }
    
    select.innerHTML = '<option value="">None</option>';
    
    response.data.forEach(project => {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name;
      if (project.id === currentSettings.defaultProjectId) {
        option.selected = true;
      }
      select.appendChild(option);
    });
    
  } catch (error) {
    console.error('Failed to load projects:', error);
    select.innerHTML = '<option value="">Error loading projects</option>';
  }
}

async function loadLabels(teamId) {
  const container = elements.labelsContainer;
  container.innerHTML = '<span class="labels-placeholder">Loading labels...</span>';
  
  try {
    const response = await chrome.runtime.sendMessage({ 
      action: 'getLinearLabels',
      teamId: teamId
    });
    
    if (!response.success) {
      throw new Error(response.error);
    }
    
    if (response.data.length === 0) {
      container.innerHTML = '<span class="labels-placeholder">No labels available</span>';
      return;
    }
    
    container.innerHTML = '';
    
    response.data.forEach(label => {
      const labelEl = document.createElement('label');
      labelEl.className = 'label-item';
      
      const isChecked = selectedLabelIds.includes(label.id);
      
      labelEl.innerHTML = `
        <input type="checkbox" value="${label.id}" ${isChecked ? 'checked' : ''}>
        <span class="label-color" style="background-color: ${label.color}"></span>
        <span class="label-name">${escapeHtml(label.name)}</span>
      `;
      
      // Handle checkbox change
      labelEl.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) {
          if (!selectedLabelIds.includes(label.id)) {
            selectedLabelIds.push(label.id);
          }
        } else {
          selectedLabelIds = selectedLabelIds.filter(id => id !== label.id);
        }
      });
      
      container.appendChild(labelEl);
    });
    
  } catch (error) {
    console.error('Failed to load labels:', error);
    container.innerHTML = '<span class="labels-placeholder">Error loading labels</span>';
  }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function setupEventListeners() {
  // Toggle API key visibility
  elements.toggleApiKey.addEventListener('click', () => {
    const input = elements.linearApiKey;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    elements.toggleApiKey.title = isPassword ? 'Hide' : 'Show';
  });
  
  // Test connection
  elements.testConnection.addEventListener('click', testConnection);
  
  // Team change
  elements.defaultTeam.addEventListener('change', async (e) => {
    const teamId = e.target.value;
    if (teamId) {
      await loadProjects(teamId);
      await loadLabels(teamId);
    } else {
      elements.defaultProject.innerHTML = '<option value="">None</option>';
      elements.labelsContainer.innerHTML = '<span class="labels-placeholder">Select a team first</span>';
    }
  });
  
  // Save settings
  elements.saveSettings.addEventListener('click', saveSettings);
  
  // Reset settings
  elements.resetSettings.addEventListener('click', resetSettings);
  
  // Auto-save on Enter in API key field
  elements.linearApiKey.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      testConnection();
    }
  });
}

// ============================================================================
// UTILITIES
// ============================================================================

function showStatus(type, message) {
  const banner = elements.statusBanner;
  banner.className = `status-banner ${type}`;
  banner.innerHTML = `
    <span class="status-icon">${type === 'success' ? '✓' : '✗'}</span>
    <span class="status-message">${escapeHtml(message)}</span>
  `;
  banner.style.display = 'flex';
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    banner.style.display = 'none';
  }, 5000);
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
