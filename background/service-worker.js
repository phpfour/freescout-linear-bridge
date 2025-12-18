/**
 * FreeScout to Linear Bridge - Background Service Worker
 * Handles Linear API communication and context menu management
 */

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const LINEAR_API_ENDPOINT = 'https://api.linear.app/graphql';

const CONTEXT_MENU_ID = 'create-linear-issue';

// ============================================================================
// INITIALIZATION
// ============================================================================

// Create context menu on extension install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: 'Create Linear Issue from Ticket',
    contexts: ['page', 'selection']
  });
  
  console.log('[FreeScout-Linear] Extension installed and context menu created');
});

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[FreeScout-Linear] Received message:', message.action);
  
  switch (message.action) {
    case 'createLinearIssue':
      handleCreateLinearIssue(message.data)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep channel open for async response
      
    case 'getLinearTeams':
      fetchLinearTeams()
        .then(teams => sendResponse({ success: true, data: teams }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'getLinearProjects':
      fetchLinearProjects(message.teamId)
        .then(projects => sendResponse({ success: true, data: projects }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'getLinearLabels':
      fetchLinearLabels(message.teamId)
        .then(labels => sendResponse({ success: true, data: labels }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'testLinearConnection':
      testLinearConnection()
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'getSettings':
      getStoredSettings()
        .then(settings => sendResponse({ success: true, data: settings }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_ID) {
    // Send message to content script to extract ticket data
    chrome.tabs.sendMessage(tab.id, { action: 'extractTicketData' });
  }
});

// ============================================================================
// LINEAR API FUNCTIONS
// ============================================================================

/**
 * Execute a GraphQL query against Linear API
 */
async function linearGraphQL(query, variables = {}) {
  const settings = await getStoredSettings();
  
  if (!settings.linearApiKey) {
    throw new Error('Linear API key not configured. Please set it in extension options.');
  }
  
  const response = await fetch(LINEAR_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': settings.linearApiKey
    },
    body: JSON.stringify({ query, variables })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Linear API error: ${response.status} - ${errorText}`);
  }
  
  const result = await response.json();
  
  if (result.errors) {
    throw new Error(`Linear GraphQL error: ${result.errors.map(e => e.message).join(', ')}`);
  }
  
  return result.data;
}

/**
 * Create a new Linear issue
 */
async function handleCreateLinearIssue(ticketData) {
  const settings = await getStoredSettings();
  
  // Build description from ticket data
  const description = buildIssueDescription(ticketData);
  
  const mutation = `
    mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          title
          url
        }
      }
    }
  `;
  
  const input = {
    teamId: ticketData.teamId || settings.defaultTeamId,
    title: ticketData.subject || 'Support Ticket',
    description: description,
    priority: mapPriorityToLinear(ticketData.priority),
  };
  
  // Add optional fields if provided
  if (ticketData.projectId || settings.defaultProjectId) {
    input.projectId = ticketData.projectId || settings.defaultProjectId;
  }
  
  if (ticketData.labelIds && ticketData.labelIds.length > 0) {
    input.labelIds = ticketData.labelIds;
  } else if (settings.defaultLabelIds && settings.defaultLabelIds.length > 0) {
    input.labelIds = settings.defaultLabelIds;
  }
  
  if (ticketData.assigneeId) {
    input.assigneeId = ticketData.assigneeId;
  }
  
  const data = await linearGraphQL(mutation, { input });
  
  if (data.issueCreate.success) {
    // Show success notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Linear Issue Created',
      message: `Issue ${data.issueCreate.issue.identifier} created successfully!`
    });
    
    return data.issueCreate.issue;
  } else {
    throw new Error('Failed to create Linear issue');
  }
}

/**
 * Fetch available Linear teams
 */
async function fetchLinearTeams() {
  const query = `
    query Teams {
      teams {
        nodes {
          id
          name
          key
        }
      }
    }
  `;
  
  const data = await linearGraphQL(query);
  return data.teams.nodes;
}

/**
 * Fetch projects for a specific team
 */
async function fetchLinearProjects(teamId) {
  const query = `
    query Projects($teamId: String!) {
      team(id: $teamId) {
        projects {
          nodes {
            id
            name
            state
          }
        }
      }
    }
  `;
  
  const data = await linearGraphQL(query, { teamId });
  return data.team.projects.nodes.filter(p => p.state !== 'completed' && p.state !== 'canceled');
}

/**
 * Fetch labels for a specific team
 */
async function fetchLinearLabels(teamId) {
  const query = `
    query Labels($teamId: String!) {
      team(id: $teamId) {
        labels {
          nodes {
            id
            name
            color
          }
        }
      }
    }
  `;
  
  const data = await linearGraphQL(query, { teamId });
  return data.team.labels.nodes;
}

/**
 * Test Linear API connection
 */
async function testLinearConnection() {
  const query = `
    query Viewer {
      viewer {
        id
        name
        email
      }
    }
  `;
  
  const data = await linearGraphQL(query);
  return data.viewer;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build Linear issue description from FreeScout ticket data
 */
function buildIssueDescription(ticketData) {
  const parts = [];
  
  // Header with FreeScout reference
  parts.push(`## Support Ticket Reference`);
  parts.push('');
  
  if (ticketData.ticketId) {
    parts.push(`**Ticket ID:** #${ticketData.ticketId}`);
  }
  
  if (ticketData.ticketUrl) {
    parts.push(`**Source:** [View in FreeScout](${ticketData.ticketUrl})`);
  }
  
  if (ticketData.customerName || ticketData.customerEmail) {
    parts.push('');
    parts.push(`### Customer Information`);
    if (ticketData.customerName) {
      parts.push(`**Name:** ${ticketData.customerName}`);
    }
    if (ticketData.customerEmail) {
      parts.push(`**Email:** ${ticketData.customerEmail}`);
    }
  }
  
  if (ticketData.status) {
    parts.push(`**Status:** ${ticketData.status}`);
  }
  
  if (ticketData.createdAt) {
    parts.push(`**Created:** ${ticketData.createdAt}`);
  }
  
  // Main content (first/most recent message body)
  parts.push('');
  parts.push('---');
  parts.push('');
  parts.push(`## Ticket Content`);
  parts.push('');
  
  if (ticketData.body) {
    parts.push(ticketData.body);
  }
  
  // Add conversation thread if available
  if (ticketData.messages && ticketData.messages.length > 0) {
    parts.push('');
    parts.push('---');
    parts.push('');
    parts.push(`## Conversation Thread`);
    parts.push('');
    
    ticketData.messages.forEach((msg, index) => {
      // Add horizontal rule between messages (not before the first one)
      if (index > 0) {
        parts.push('---');
        parts.push('');
      }
      
      // Message header with sender and date
      const senderType = msg.isCustomer ? '👤' : '💬';
      parts.push(`### ${senderType} ${msg.from || 'Message'} ${msg.date ? `(${msg.date})` : ''}`);
      parts.push('');
      
      // Message content
      parts.push(msg.content || '');
      
      // Add attachments if present
      if (msg.attachments && msg.attachments.length > 0) {
        parts.push('');
        parts.push(`**📎 Attachments:**`);
        msg.attachments.forEach(att => {
          const sizeStr = att.size ? ` (${att.size})` : '';
          // Check if it's an image to use image syntax
          const isImage = att.mime && att.mime.startsWith('image/');
          if (isImage) {
            // For images, show as embedded image with link
            parts.push(`- ![${att.name}](${att.url})${sizeStr}`);
          } else {
            // For other files, just show as link
            parts.push(`- [${att.name}](${att.url})${sizeStr}`);
          }
        });
      }
      
      parts.push('');
    });
  }
  
  return parts.join('\n');
}

/**
 * Map FreeScout priority to Linear priority (0-4 scale)
 * Linear: 0 = No priority, 1 = Urgent, 2 = High, 3 = Medium, 4 = Low
 * 
 * Accepts either:
 * - A string from FreeScout (e.g., "urgent", "high")
 * - A number already in Linear format (0-4)
 */
function mapPriorityToLinear(freescoutPriority) {
  // If it's already a number (from the modal dropdown), use it directly
  if (typeof freescoutPriority === 'number') {
    return freescoutPriority;
  }
  
  // If null/undefined, return no priority
  if (!freescoutPriority) return 0;
  
  // If it's a string, map from FreeScout priority names
  const priorityMap = {
    'urgent': 1,
    'high': 2,
    'medium': 3,
    'normal': 3,
    'low': 4,
    'none': 0
  };
  
  const normalized = String(freescoutPriority).toLowerCase().trim();
  return priorityMap[normalized] || 0;
}

/**
 * Get stored extension settings
 */
async function getStoredSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({
      linearApiKey: '',
      defaultTeamId: '',
      defaultProjectId: '',
      defaultLabelIds: [],
      freescoutDomain: '',
      autoDetectDomain: true
    }, resolve);
  });
}

// ============================================================================
// EXPORTS (for module usage)
// ============================================================================

// Service workers don't need exports, but we keep functions available globally
