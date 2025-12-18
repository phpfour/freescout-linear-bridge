/**
 * FreeScout to Linear Bridge - Content Script
 * Handles DOM interaction and ticket data extraction from FreeScout
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // FreeScout DOM selectors - based on actual FreeScout HTML structure
  selectors: {
    // Ticket identification - from body data attribute and .conv-numnav
    ticketContainer: '#conv-layout-main',
    ticketSubject: '.conv-subjtext span',
    ticketId: 'body[data-conversation_id]', // Use body data attribute
    
    // Customer information - from sidebar
    customerName: '.conv-customer-block .customer-name',
    customerEmail: '.conv-customer-block .customer-email a, .customer-contacts .customer-email a',
    
    // Thread messages
    messageContainer: '#conv-layout-main',
    threadItem: '.thread',
    threadPerson: '.thread-person strong a',
    threadDate: '.thread-date',
    threadStatus: '.thread-status',
    threadBody: '.thread-body .thread-content',
    
    // Action buttons area (for injecting our button)
    actionBar: '.conv-action-block, .conv-top-block',
    sidebarActions: '.conv-sidebar-block'
  }
};

// ============================================================================
// STATE
// ============================================================================

let isButtonInjected = false;
let lastExtractedData = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize content script
 */
function initialize() {
  console.log('[FreeScout-Linear] Content script loaded');
  
  // Check if we're on a FreeScout page
  if (isFreeScoutPage()) {
    console.log('[FreeScout-Linear] FreeScout page detected');
    injectLinearButton();
    observeDOMChanges();
  }
}

/**
 * Check if current page is a FreeScout ticket page
 */
function isFreeScoutPage() {
  // Multiple detection methods for different FreeScout setups
  const indicators = [
    // Check for FreeScout-specific elements
    document.querySelector('.freescout-logo, [class*="freescout"]'),
    document.querySelector('.conv-wrap, .conversation-wrap'),
    document.querySelector('meta[name="generator"][content*="FreeScout"]'),
    // Check URL patterns common in FreeScout
    /\/conversation\/\d+/i.test(window.location.pathname),
    /\/mailbox\/\d+\/conversation/i.test(window.location.pathname),
    // Check for FreeScout in page content
    document.body.innerHTML.includes('freescout') || document.body.innerHTML.includes('FreeScout')
  ];
  
  return indicators.some(indicator => indicator);
}

// ============================================================================
// DOM INTERACTION
// ============================================================================

/**
 * Inject the "Create Linear Issue" button into FreeScout UI
 */
function injectLinearButton() {
  if (isButtonInjected) return;
  
  // Try to find the action bar or sidebar
  const actionBar = document.querySelector(CONFIG.selectors.actionBar);
  const sidebar = document.querySelector(CONFIG.selectors.sidebarActions);
  const targetContainer = actionBar || sidebar;
  
  if (!targetContainer) {
    // Create floating button if no suitable container found
    createFloatingButton();
    return;
  }
  
  // Create button element
  const button = createLinearButton();
  targetContainer.appendChild(button);
  isButtonInjected = true;
  
  console.log('[FreeScout-Linear] Button injected into action bar');
}

/**
 * Create the Linear button element
 */
function createLinearButton() {
  const button = document.createElement('button');
  button.id = 'freescout-linear-btn';
  button.className = 'btn btn-default freescout-linear-button';
  button.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 100 100" fill="currentColor" style="margin-right: 6px; vertical-align: middle;">
      <path d="M1.22541 61.5228c-.2225-.9485.90748-1.5459 1.59638-.857L39.3342 97.1782c.6889.6889.0915 1.8189-.857 1.5765-36.9824-10.0233-41.1973-13.0192-37.2518-37.2319ZM74.8989 83.5107c-4.0117 4.0117-10.6227 3.7124-13.5794.3476L8.34174 26.9553C4.97686 23.5904 4.67755 16.9795 8.68928 12.9677l2.22168-2.22168c4.0117-4.01171 10.6227-3.71249 13.5794-.34762L87.9898 69.7093c3.3649 3.3565 3.6642 9.9675-.3475 13.5792l-2.2222 2.2222c-.0001 0-.0001 0 0 0ZM41.0455 1.81989c7.6713-1.16688 14.9916 1.61561 19.8214 6.44541l.0001-.00001 4.8393 4.83932L50.1539 28.6569 28.6569 50.1539 13.1044 34.6014l4.8393-4.8393c4.8298-4.8298 11.5834-7.61225 19.2548-6.44536l1.8778.28403L41.0455 1.81989Z"/>
    </svg>
    Create Linear Issue
  `;
  
  button.addEventListener('click', handleCreateIssueClick);
  
  return button;
}

/**
 * Create floating button for pages without standard action bar
 */
function createFloatingButton() {
  const container = document.createElement('div');
  container.id = 'freescout-linear-floating';
  container.className = 'freescout-linear-floating-container';
  
  const button = document.createElement('button');
  button.className = 'freescout-linear-floating-btn';
  button.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 100 100" fill="white">
      <path d="M1.22541 61.5228c-.2225-.9485.90748-1.5459 1.59638-.857L39.3342 97.1782c.6889.6889.0915 1.8189-.857 1.5765-36.9824-10.0233-41.1973-13.0192-37.2518-37.2319ZM74.8989 83.5107c-4.0117 4.0117-10.6227 3.7124-13.5794.3476L8.34174 26.9553C4.97686 23.5904 4.67755 16.9795 8.68928 12.9677l2.22168-2.22168c4.0117-4.01171 10.6227-3.71249 13.5794-.34762L87.9898 69.7093c3.3649 3.3565 3.6642 9.9675-.3475 13.5792l-2.2222 2.2222c-.0001 0-.0001 0 0 0ZM41.0455 1.81989c7.6713-1.16688 14.9916 1.61561 19.8214 6.44541l.0001-.00001 4.8393 4.83932L50.1539 28.6569 28.6569 50.1539 13.1044 34.6014l4.8393-4.8393c4.8298-4.8298 11.5834-7.61225 19.2548-6.44536l1.8778.28403L41.0455 1.81989Z"/>
    </svg>
  `;
  button.title = 'Create Linear Issue';
  button.addEventListener('click', handleCreateIssueClick);
  
  container.appendChild(button);
  document.body.appendChild(container);
  isButtonInjected = true;
  
  console.log('[FreeScout-Linear] Floating button created');
}

/**
 * Observe DOM changes to re-inject button after navigation
 */
function observeDOMChanges() {
  const observer = new MutationObserver((mutations) => {
    // Check if conversation content changed
    const relevantChange = mutations.some(mutation => {
      return mutation.addedNodes.length > 0 && 
             (mutation.target.matches?.(CONFIG.selectors.ticketContainer) ||
              mutation.target.querySelector?.(CONFIG.selectors.ticketContainer));
    });
    
    if (relevantChange && !document.getElementById('freescout-linear-btn') && 
        !document.getElementById('freescout-linear-floating')) {
      isButtonInjected = false;
      injectLinearButton();
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// ============================================================================
// DATA EXTRACTION
// ============================================================================

/**
 * Extract ticket data from FreeScout DOM
 */
function extractTicketData() {
  console.log('[FreeScout-Linear] Extracting ticket data...');
  
  const data = {
    ticketId: extractTicketId(),
    ticketUrl: window.location.href,
    subject: extractSubject(),
    body: extractBody(),
    customerName: extractCustomerName(),
    customerEmail: extractCustomerEmail(),
    status: extractStatus(),
    priority: extractPriority(),
    createdAt: extractCreatedAt(),
    messages: extractMessages()
  };
  
  // Clean up undefined values
  Object.keys(data).forEach(key => {
    if (data[key] === undefined || data[key] === null) {
      delete data[key];
    }
  });
  
  console.log('[FreeScout-Linear] Extracted data:', data);
  lastExtractedData = data;
  
  return data;
}

/**
 * Extract ticket ID from body data attribute or conv-numnav
 */
function extractTicketId() {
  console.log('[FreeScout-Linear] Extracting ticket ID...');
  
  // Method 1: Body data attribute (most reliable)
  const conversationId = document.body.getAttribute('data-conversation_id');
  if (conversationId) {
    console.log('[FreeScout-Linear] Found ticket ID from body attribute:', conversationId);
    return conversationId;
  }
  
  // Method 2: Look in conv-numnav
  const convNum = document.querySelector('.conv-numnav strong');
  if (convNum) {
    const id = convNum.textContent.trim();
    console.log('[FreeScout-Linear] Found ticket ID from conv-numnav:', id);
    return id;
  }
  
  // Method 3: URL extraction
  const urlPatterns = [
    /\/conversation\/(\d+)/i,
    /conversation_id=(\d+)/i
  ];
  
  for (const pattern of urlPatterns) {
    const match = window.location.href.match(pattern);
    if (match) {
      console.log('[FreeScout-Linear] Found ticket ID from URL:', match[1]);
      return match[1];
    }
  }
  
  // Method 4: Page title
  const titleMatch = document.title.match(/#(\d+)/);
  if (titleMatch) {
    console.log('[FreeScout-Linear] Found ticket ID from title:', titleMatch[1]);
    return titleMatch[1];
  }
  
  console.log('[FreeScout-Linear] Could not extract ticket ID');
  return null;
}

/**
 * Extract ticket subject from conv-subjtext
 */
function extractSubject() {
  console.log('[FreeScout-Linear] Extracting subject...');
  
  // Method 1: conv-subjtext span (exact match from FreeScout HTML)
  const subjText = document.querySelector('.conv-subjtext > span');
  if (subjText) {
    const subject = subjText.textContent.trim();
    console.log('[FreeScout-Linear] Found subject from conv-subjtext:', subject);
    return subject;
  }
  
  // Method 2: Input field value
  const subjInput = document.querySelector('#conv-subj-value');
  if (subjInput && subjInput.value) {
    console.log('[FreeScout-Linear] Found subject from input:', subjInput.value);
    return subjInput.value.trim();
  }
  
  // Method 3: Page title (fallback) - format is "#ID Subject - Customer"
  const pageTitle = document.title;
  if (pageTitle) {
    // Remove leading #ID and trailing customer name
    const cleaned = pageTitle.replace(/^#\d+\s*/, '').replace(/\s*-\s*[^-]+\s*$/, '').trim();
    if (cleaned) {
      console.log('[FreeScout-Linear] Found subject from title:', cleaned);
      return cleaned;
    }
  }
  
  console.log('[FreeScout-Linear] Could not extract subject');
  return null;
}

/**
 * Extract main ticket body - gets content from the first (most recent) message
 */
function extractBody() {
  console.log('[FreeScout-Linear] Extracting body...');
  
  // In FreeScout, threads are in #conv-layout-main, each thread has class .thread
  // The body is in .thread-body .thread-content
  
  // Get the first thread (most recent message)
  const firstThread = document.querySelector('#conv-layout-main .thread .thread-body .thread-content');
  if (firstThread) {
    const content = cleanHtmlContent(firstThread);
    console.log('[FreeScout-Linear] Extracted body from first thread:', content.substring(0, 100));
    return content;
  }
  
  // Fallback: try just .thread-content
  const threadContent = document.querySelector('.thread-content');
  if (threadContent) {
    const content = cleanHtmlContent(threadContent);
    console.log('[FreeScout-Linear] Extracted body from thread-content:', content.substring(0, 100));
    return content;
  }
  
  console.log('[FreeScout-Linear] Could not extract body');
  return null;
}

/**
 * Extract customer name from sidebar
 */
function extractCustomerName() {
  console.log('[FreeScout-Linear] Extracting customer name...');
  
  // Method 1: Sidebar customer-name (exact FreeScout selector)
  const customerName = document.querySelector('.conv-customer-block .customer-name');
  if (customerName) {
    const name = customerName.textContent.trim();
    console.log('[FreeScout-Linear] Found customer name from sidebar:', name);
    return name;
  }
  
  // Method 2: Customer data section
  const customerData = document.querySelector('.customer-data .customer-name');
  if (customerData) {
    const name = customerData.textContent.trim();
    console.log('[FreeScout-Linear] Found customer name from customer-data:', name);
    return name;
  }
  
  // Method 3: First customer thread person
  const customerThread = document.querySelector('.thread-type-customer .thread-person strong a');
  if (customerThread) {
    const name = customerThread.textContent.trim();
    console.log('[FreeScout-Linear] Found customer name from thread:', name);
    return name;
  }
  
  console.log('[FreeScout-Linear] Could not extract customer name');
  return null;
}

/**
 * Extract customer email from sidebar
 */
function extractCustomerEmail() {
  console.log('[FreeScout-Linear] Extracting customer email...');
  
  // Method 1: Sidebar customer email (exact FreeScout selector)
  const emailEl = document.querySelector('.conv-customer-block .customer-email a');
  if (emailEl) {
    // Check for Cloudflare email protection
    const cfEmail = emailEl.querySelector('[data-cfemail]');
    if (cfEmail) {
      const decoded = decodeCfEmail(cfEmail.getAttribute('data-cfemail'));
      if (decoded) {
        console.log('[FreeScout-Linear] Found email (decoded CF):', decoded);
        return decoded;
      }
    }
    // Try href mailto
    if (emailEl.href && emailEl.href.includes('mailto:')) {
      const email = emailEl.href.replace('mailto:', '').split('?')[0];
      console.log('[FreeScout-Linear] Found email from mailto:', email);
      return email;
    }
    // Try text content
    const text = emailEl.textContent.trim();
    if (text.includes('@')) {
      console.log('[FreeScout-Linear] Found email from text:', text);
      return text;
    }
  }
  
  // Method 2: Customer contacts section
  const contactEmail = document.querySelector('.customer-contacts .customer-email a');
  if (contactEmail) {
    const cfEmail = contactEmail.querySelector('[data-cfemail]');
    if (cfEmail) {
      const decoded = decodeCfEmail(cfEmail.getAttribute('data-cfemail'));
      if (decoded) {
        console.log('[FreeScout-Linear] Found email from contacts (decoded):', decoded);
        return decoded;
      }
    }
  }
  
  // Method 3: Look for any __cf_email__ with data attribute
  const allCfEmails = document.querySelectorAll('.conv-customer-block [data-cfemail]');
  for (const el of allCfEmails) {
    const decoded = decodeCfEmail(el.getAttribute('data-cfemail'));
    if (decoded) {
      console.log('[FreeScout-Linear] Found email from CF element:', decoded);
      return decoded;
    }
  }
  
  // Method 4: Find email pattern in sidebar
  const sidebar = document.querySelector('.conv-customer-block');
  if (sidebar) {
    const emailMatch = sidebar.textContent.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch) {
      console.log('[FreeScout-Linear] Found email via regex:', emailMatch[0]);
      return emailMatch[0];
    }
  }
  
  console.log('[FreeScout-Linear] Could not extract customer email');
  return null;
}

/**
 * Decode Cloudflare-protected email
 */
function decodeCfEmail(encodedString) {
  if (!encodedString) return null;
  
  try {
    let email = '';
    const r = parseInt(encodedString.substr(0, 2), 16);
    for (let n = 2; n < encodedString.length; n += 2) {
      const charCode = parseInt(encodedString.substr(n, 2), 16) ^ r;
      email += String.fromCharCode(charCode);
    }
    return email;
  } catch (e) {
    console.error('[FreeScout-Linear] Failed to decode CF email:', e);
    return null;
  }
}

/**
 * Extract ticket status from the status button
 */
function extractStatus() {
  console.log('[FreeScout-Linear] Extracting status...');
  
  // Method 1: Look for the status dropdown button text
  // In FreeScout, status is shown as "Active ▼" in a button
  const statusBtns = document.querySelectorAll('.btn-group .btn');
  for (const btn of statusBtns) {
    const text = btn.textContent.trim();
    // Check if it's one of the known status values
    const statuses = ['Active', 'Pending', 'Closed', 'Spam'];
    for (const status of statuses) {
      if (text.includes(status)) {
        console.log('[FreeScout-Linear] Found status from button:', status);
        return status;
      }
    }
  }
  
  // Method 2: Look at the first thread status (most recent)
  const threadStatus = document.querySelector('.thread:first-of-type .thread-status');
  if (threadStatus) {
    const text = threadStatus.textContent.trim();
    // Extract just the status word (avoid "Anyone, Active" -> just "Active")
    const statuses = ['Active', 'Pending', 'Closed', 'Spam'];
    for (const status of statuses) {
      if (text.includes(status)) {
        console.log('[FreeScout-Linear] Found status from thread:', status);
        return status;
      }
    }
  }
  
  console.log('[FreeScout-Linear] Could not extract status');
  return null;
}

/**
 * Extract ticket priority
 * Note: FreeScout doesn't have a visible priority field in standard UI
 */
function extractPriority() {
  console.log('[FreeScout-Linear] Extracting priority...');
  
  // FreeScout doesn't show priority in the standard conversation view
  // Priority would need to be extracted from custom fields if configured
  // For now, return null and let the user select in the modal
  
  // Try to find any priority indicator (custom implementations)
  const priorityEl = document.querySelector('[data-priority], .priority-badge, .conv-priority');
  if (priorityEl) {
    const priority = priorityEl.dataset.priority || priorityEl.textContent.trim();
    console.log('[FreeScout-Linear] Found priority:', priority);
    return priority;
  }
  
  console.log('[FreeScout-Linear] No priority found (normal for FreeScout)');
  return null;
}

/**
 * Extract creation date - from the oldest (last) thread
 */
function extractCreatedAt() {
  console.log('[FreeScout-Linear] Extracting created at...');
  
  // Get all threads and find the last one (oldest message)
  const threads = document.querySelectorAll('#conv-layout-main .thread');
  if (threads.length > 0) {
    const lastThread = threads[threads.length - 1];
    const dateEl = lastThread.querySelector('.thread-date');
    if (dateEl) {
      const date = dateEl.getAttribute('title') || dateEl.textContent.trim();
      console.log('[FreeScout-Linear] Found created date from last thread:', date);
      return date;
    }
  }
  
  // Fallback: first thread date visible
  const firstDate = document.querySelector('.thread .thread-date');
  if (firstDate) {
    const date = firstDate.getAttribute('title') || firstDate.textContent.trim();
    console.log('[FreeScout-Linear] Found date from first thread:', date);
    return date;
  }
  
  console.log('[FreeScout-Linear] Could not extract created date');
  return null;
}

/**
 * Extract all messages in conversation thread
 */
function extractMessages() {
  const messages = [];
  
  console.log('[FreeScout-Linear] Extracting messages...');
  
  // In FreeScout, each message is a .thread element inside #conv-layout-main
  const threads = document.querySelectorAll('#conv-layout-main .thread');
  
  console.log('[FreeScout-Linear] Found threads:', threads.length);
  
  threads.forEach((thread, index) => {
    // Get sender name from .thread-person strong a
    const personEl = thread.querySelector('.thread-person strong a');
    const from = personEl ? personEl.textContent.trim() : `Message ${index + 1}`;
    
    // Get date from .thread-date (has title attribute with full date)
    const dateEl = thread.querySelector('.thread-date');
    let date = null;
    if (dateEl) {
      date = dateEl.getAttribute('title') || dateEl.textContent.trim();
    }
    
    // Get message content from .thread-body .thread-content
    const contentEl = thread.querySelector('.thread-body .thread-content');
    const content = contentEl ? cleanHtmlContent(contentEl) : '';
    
    // Get thread type (customer or agent message)
    const isCustomer = thread.classList.contains('thread-type-customer');
    
    // Extract attachments from .thread-attachments
    const attachments = extractThreadAttachments(thread);
    
    if (content && content.length > 5) {
      messages.push({
        index: index + 1,
        from: from,
        date: date,
        content: content,
        isCustomer: isCustomer,
        attachments: attachments
      });
      console.log(`[FreeScout-Linear] Extracted message ${index + 1} from ${from} (${isCustomer ? 'customer' : 'agent'}) with ${attachments.length} attachments`);
    }
  });
  
  console.log('[FreeScout-Linear] Total messages extracted:', messages.length);
  return messages;
}

/**
 * Extract attachments from a thread element
 */
function extractThreadAttachments(thread) {
  const attachments = [];
  
  // Find the attachments container within this thread
  const attachmentsList = thread.querySelectorAll('.thread-attachments li[data-attachment-id]');
  
  attachmentsList.forEach(li => {
    const link = li.querySelector('a.attachment-link');
    const sizeEl = li.querySelector('.text-help');
    
    if (link) {
      const attachment = {
        id: li.getAttribute('data-attachment-id'),
        name: link.textContent.trim(),
        url: link.href,
        mime: li.getAttribute('data-mime') || 'application/octet-stream',
        size: sizeEl ? sizeEl.textContent.trim().replace(/[()]/g, '') : null
      };
      attachments.push(attachment);
    }
  });
  
  return attachments;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Find element using multiple selectors
 */
function findElement(selectorString) {
  const selectors = selectorString.split(',').map(s => s.trim());
  
  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element) return element;
    } catch (e) {
      // Invalid selector, continue
    }
  }
  
  return null;
}

/**
 * Clean HTML content and convert to markdown-like text
 */
function cleanHtmlContent(element) {
  if (!element) return '';
  
  // Clone to avoid modifying original
  const clone = element.cloneNode(true);
  
  // Remove script and style tags
  clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
  
  // Convert common HTML elements to markdown
  clone.querySelectorAll('strong, b').forEach(el => {
    el.replaceWith(`**${el.textContent}**`);
  });
  
  clone.querySelectorAll('em, i').forEach(el => {
    el.replaceWith(`*${el.textContent}*`);
  });
  
  clone.querySelectorAll('a').forEach(el => {
    const href = el.getAttribute('href');
    const text = el.textContent;
    if (href && href !== text) {
      el.replaceWith(`[${text}](${href})`);
    }
  });
  
  clone.querySelectorAll('br').forEach(el => {
    el.replaceWith('\n');
  });
  
  clone.querySelectorAll('p, div').forEach(el => {
    el.insertAdjacentText('afterend', '\n\n');
  });
  
  clone.querySelectorAll('li').forEach(el => {
    el.insertAdjacentText('beforebegin', '• ');
    el.insertAdjacentText('afterend', '\n');
  });
  
  // Get text and clean up whitespace
  let text = clone.textContent || clone.innerText || '';
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  
  return text;
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Handle click on "Create Linear Issue" button
 */
async function handleCreateIssueClick(event) {
  event.preventDefault();
  event.stopPropagation();
  
  // Show loading state
  const button = event.currentTarget;
  const originalContent = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `
    <span class="freescout-linear-spinner"></span>
    Creating...
  `;
  
  try {
    // Extract ticket data
    const ticketData = extractTicketData();
    
    if (!ticketData.subject && !ticketData.body) {
      throw new Error('Could not extract ticket data. Make sure you are on a FreeScout ticket page.');
    }
    
    // Open popup/modal for team selection
    showIssueCreationModal(ticketData);
    
  } catch (error) {
    console.error('[FreeScout-Linear] Error:', error);
    showNotification('Error', error.message, 'error');
  } finally {
    // Restore button state
    button.disabled = false;
    button.innerHTML = originalContent;
  }
}

/**
 * Show issue creation modal
 */
function showIssueCreationModal(ticketData) {
  // Remove existing modal if any
  const existingModal = document.getElementById('freescout-linear-modal');
  if (existingModal) existingModal.remove();
  
  const modal = document.createElement('div');
  modal.id = 'freescout-linear-modal';
  modal.className = 'freescout-linear-modal-overlay';
  modal.innerHTML = `
    <div class="freescout-linear-modal">
      <div class="freescout-linear-modal-header">
        <h3>
          <svg width="20" height="20" viewBox="0 0 100 100" fill="#5E6AD2" style="vertical-align: middle; margin-right: 8px;">
            <path d="M1.22541 61.5228c-.2225-.9485.90748-1.5459 1.59638-.857L39.3342 97.1782c.6889.6889.0915 1.8189-.857 1.5765-36.9824-10.0233-41.1973-13.0192-37.2518-37.2319ZM74.8989 83.5107c-4.0117 4.0117-10.6227 3.7124-13.5794.3476L8.34174 26.9553C4.97686 23.5904 4.67755 16.9795 8.68928 12.9677l2.22168-2.22168c4.0117-4.01171 10.6227-3.71249 13.5794-.34762L87.9898 69.7093c3.3649 3.3565 3.6642 9.9675-.3475 13.5792l-2.2222 2.2222c-.0001 0-.0001 0 0 0ZM41.0455 1.81989c7.6713-1.16688 14.9916 1.61561 19.8214 6.44541l.0001-.00001 4.8393 4.83932L50.1539 28.6569 28.6569 50.1539 13.1044 34.6014l4.8393-4.8393c4.8298-4.8298 11.5834-7.61225 19.2548-6.44536l1.8778.28403L41.0455 1.81989Z"/>
          </svg>
          Create Linear Issue
        </h3>
        <button class="freescout-linear-modal-close" id="modal-close">&times;</button>
      </div>
      
      <div class="freescout-linear-modal-body">
        <div class="freescout-linear-form-group">
          <label>Title</label>
          <input type="text" id="linear-issue-title" value="${escapeHtml(ticketData.subject || '')}" placeholder="Issue title">
        </div>
        
        <div class="freescout-linear-form-group">
          <label>Team</label>
          <select id="linear-team-select">
            <option value="">Loading teams...</option>
          </select>
        </div>
        
        <div class="freescout-linear-form-group">
          <label>Project (optional)</label>
          <select id="linear-project-select">
            <option value="">Select a team first</option>
          </select>
        </div>
        
        <div class="freescout-linear-form-group">
          <label>Labels</label>
          <div id="linear-labels-container" class="freescout-linear-labels">
            <span class="freescout-linear-labels-placeholder">Select a team first</span>
          </div>
        </div>
        
        <div class="freescout-linear-form-group">
          <label>Priority</label>
          <select id="linear-priority-select">
            <option value="0">No priority</option>
            <option value="1">🔴 Urgent</option>
            <option value="2">🟠 High</option>
            <option value="3" selected>🟡 Medium</option>
            <option value="4">🟢 Low</option>
          </select>
        </div>
        
        <div class="freescout-linear-ticket-preview">
          <label>Ticket Preview</label>
          <div class="freescout-linear-preview-content">
            <strong>ID:</strong> #${escapeHtml(ticketData.ticketId || 'N/A')}<br>
            <strong>Customer:</strong> ${escapeHtml(ticketData.customerName || ticketData.customerEmail || 'N/A')}<br>
            <strong>Status:</strong> ${escapeHtml(ticketData.status || 'N/A')}
          </div>
        </div>
      </div>
      
      <div class="freescout-linear-modal-footer">
        <button class="freescout-linear-btn-secondary" id="modal-cancel">Cancel</button>
        <button class="freescout-linear-btn-primary" id="modal-create">
          Create Issue
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Store ticket data for later use
  modal.ticketData = ticketData;
  
  // Add event listeners
  const closeBtn = modal.querySelector('#modal-close');
  const cancelBtn = modal.querySelector('#modal-cancel');
  const createBtn = modal.querySelector('#modal-create');
  const teamSelect = modal.querySelector('#linear-team-select');
  
  if (closeBtn) closeBtn.addEventListener('click', () => modal.remove());
  if (cancelBtn) cancelBtn.addEventListener('click', () => modal.remove());
  
  // Click on overlay background to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  
  if (createBtn) createBtn.addEventListener('click', () => handleModalCreate(modal));
  if (teamSelect) teamSelect.addEventListener('change', (e) => handleTeamChange(e.target.value));
  
  // Load teams
  loadLinearTeams();
}

/**
 * Load Linear teams into select
 */
async function loadLinearTeams() {
  const select = document.getElementById('linear-team-select');
  
  if (!select) {
    console.error('[FreeScout-Linear] Team select element not found');
    return;
  }
  
  try {
    console.log('[FreeScout-Linear] Loading teams...');
    const response = await chrome.runtime.sendMessage({ action: 'getLinearTeams' });
    
    console.log('[FreeScout-Linear] Teams response:', response);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to load teams');
    }
    
    if (!response.data || response.data.length === 0) {
      select.innerHTML = '<option value="">No teams found</option>';
      return;
    }
    
    select.innerHTML = '<option value="">Select a team</option>';
    
    response.data.forEach(team => {
      const option = document.createElement('option');
      option.value = team.id;
      option.textContent = `${team.name} (${team.key})`;
      select.appendChild(option);
    });
    
    // Auto-select if only one team
    if (response.data.length === 1) {
      select.value = response.data[0].id;
      handleTeamChange(response.data[0].id);
    }
    
  } catch (error) {
    console.error('[FreeScout-Linear] Error loading teams:', error);
    select.innerHTML = `<option value="">Error: ${error.message}</option>`;
  }
}

/**
 * Handle team selection change
 */
async function handleTeamChange(teamId) {
  if (!teamId) return;
  
  console.log('[FreeScout-Linear] Team changed to:', teamId);
  
  // Load projects
  const projectSelect = document.getElementById('linear-project-select');
  if (projectSelect) {
    projectSelect.innerHTML = '<option value="">Loading projects...</option>';
    
    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'getLinearProjects',
        teamId: teamId
      });
      
      console.log('[FreeScout-Linear] Projects response:', response);
      
      if (response.success) {
        projectSelect.innerHTML = '<option value="">None</option>';
        if (response.data && response.data.length > 0) {
          response.data.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            projectSelect.appendChild(option);
          });
        }
      } else {
        projectSelect.innerHTML = '<option value="">Error loading projects</option>';
      }
    } catch (error) {
      console.error('[FreeScout-Linear] Error loading projects:', error);
      projectSelect.innerHTML = '<option value="">Error loading projects</option>';
    }
  }
  
  // Load labels
  const labelsContainer = document.getElementById('linear-labels-container');
  if (labelsContainer) {
    labelsContainer.innerHTML = '<span class="freescout-linear-labels-placeholder">Loading labels...</span>';
    
    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'getLinearLabels',
        teamId: teamId
      });
      
      console.log('[FreeScout-Linear] Labels response:', response);
      
      if (response.success && response.data && response.data.length > 0) {
        labelsContainer.innerHTML = '';
        response.data.forEach(label => {
          const labelEl = document.createElement('label');
          labelEl.className = 'freescout-linear-label-item';
          labelEl.innerHTML = `
            <input type="checkbox" value="${label.id}" data-label-name="${escapeHtml(label.name)}">
            <span class="freescout-linear-label-color" style="background-color: ${label.color}"></span>
            <span class="freescout-linear-label-name">${escapeHtml(label.name)}</span>
          `;
          labelsContainer.appendChild(labelEl);
        });
      } else {
        labelsContainer.innerHTML = '<span class="freescout-linear-labels-placeholder">No labels available</span>';
      }
    } catch (error) {
      console.error('[FreeScout-Linear] Error loading labels:', error);
      labelsContainer.innerHTML = '<span class="freescout-linear-labels-placeholder">Error loading labels</span>';
    }
  }
}

/**
 * Handle create button click in modal
 */
async function handleModalCreate(modal) {
  const createBtn = modal.querySelector('#modal-create');
  if (!createBtn) return;
  
  const originalText = createBtn.textContent;
  createBtn.disabled = true;
  createBtn.innerHTML = '<span class="freescout-linear-spinner"></span> Creating...';
  
  try {
    const ticketData = modal.ticketData || {};
    
    // Get form values with null checks
    const titleInput = document.getElementById('linear-issue-title');
    const teamSelect = document.getElementById('linear-team-select');
    const projectSelect = document.getElementById('linear-project-select');
    const prioritySelect = document.getElementById('linear-priority-select');
    
    ticketData.subject = titleInput ? titleInput.value : ticketData.subject;
    ticketData.teamId = teamSelect ? teamSelect.value : '';
    ticketData.projectId = projectSelect ? (projectSelect.value || null) : null;
    ticketData.priority = prioritySelect ? parseInt(prioritySelect.value) : 0;
    
    // Get selected labels
    const selectedLabels = [];
    const labelCheckboxes = document.querySelectorAll('#linear-labels-container input:checked');
    labelCheckboxes.forEach(cb => {
      selectedLabels.push(cb.value);
    });
    ticketData.labelIds = selectedLabels;
    
    console.log('[FreeScout-Linear] Creating issue with data:', ticketData);
    
    if (!ticketData.teamId) {
      throw new Error('Please select a team');
    }
    
    if (!ticketData.subject) {
      throw new Error('Please enter a title');
    }
    
    // Send to background script
    const response = await chrome.runtime.sendMessage({
      action: 'createLinearIssue',
      data: ticketData
    });
    
    console.log('[FreeScout-Linear] Create issue response:', response);
    
    if (response.success) {
      showNotification(
        'Issue Created!', 
        `${response.data.identifier}: ${response.data.title}`,
        'success'
      );
      
      // Show link to issue
      setTimeout(() => {
        if (confirm(`Issue ${response.data.identifier} created!\n\nOpen in Linear?`)) {
          window.open(response.data.url, '_blank');
        }
      }, 500);
      
      modal.remove();
    } else {
      throw new Error(response.error || 'Failed to create issue');
    }
    
  } catch (error) {
    console.error('[FreeScout-Linear] Error creating issue:', error);
    showNotification('Error', error.message, 'error');
    createBtn.disabled = false;
    createBtn.textContent = originalText;
  }
}

/**
 * Show notification toast
 */
function showNotification(title, message, type = 'info') {
  const existing = document.querySelector('.freescout-linear-toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = `freescout-linear-toast freescout-linear-toast-${type}`;
  toast.innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    <p>${escapeHtml(message)}</p>
  `;
  
  document.body.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Auto remove
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================================
// MESSAGE LISTENER
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extractTicketData') {
    const data = extractTicketData();
    showIssueCreationModal(data);
    sendResponse({ success: true, data });
  }
  return true;
});

// ============================================================================
// INITIALIZE
// ============================================================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
