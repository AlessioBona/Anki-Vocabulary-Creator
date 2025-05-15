// Global application state (shared across modules)
const appState = {
    isAuthenticated: false,
    spreadsheetId: null,
    sheetData: {},
    columnIndexes: {},
    openaiApiKey: null,
    aiConfigured: false
};

// Define the expected column structure
const EXPECTED_COLUMNS = [
    'Word',
    'Pronunciation',
    'Translation',
    'Sentence_01_zh',
    'Sentence_01_py',
    'Sentence_01_en',
    'Sentence_02_zh',
    'Sentence_02_py',
    'Sentence_02_en',
    'Hanzis',
    'Sentence_01_audio',
    'Sentence_02_audio'
];

// Column groupings for related functionality
const COLUMN_GROUPS = {
    basic: ['Word', 'Pronunciation', 'Translation', 'Hanzis'],
    sentence1: ['Sentence_01_zh', 'Sentence_01_py', 'Sentence_01_en', 'Sentence_01_audio'],
    sentence2: ['Sentence_02_zh', 'Sentence_02_py', 'Sentence_02_en', 'Sentence_02_audio']
};

/**
 * Display error message to user
 * @param {string} message - Error message to display
 */
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    
    // Hide after 5 seconds
    setTimeout(() => {
        errorDiv.classList.add('hidden');
    }, 5000);
}

/**
 * Display success message to user
 * @param {string} message - Success message to display
 * @param {string} containerId - ID of the container element
 */
function showSuccess(message, containerId = 'data-table') {
    const successMessage = document.createElement('div');
    successMessage.className = 'success-message';
    successMessage.textContent = message;
    
    const container = document.getElementById(containerId);
    if (container) {
        container.prepend(successMessage);
        
        // Remove the success message after a few seconds
        setTimeout(() => {
            successMessage.remove();
        }, 3000);
    }
}

/**
 * Extract spreadsheet ID from Google Sheets URL
 * @param {string} url - Google Sheets URL 
 * @returns {string|null} - Extracted spreadsheet ID
 */
function extractSpreadsheetId(url) {
    const regex = /\/d\/([a-zA-Z0-9-_]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

/**
 * Validate sheet columns against expected structure
 * @param {Array} headers - Array of column headers from the sheet
 * @returns {boolean} - Whether the sheet has the minimum required columns
 */
function validateSheetStructure(headers) {
    // Reset column indexes
    appState.columnIndexes = {};
    
    // Check for essential columns (Word, Translation)
    const essentialColumns = ['Word', 'Translation'];
    const missingEssentials = essentialColumns.filter(col => !headers.includes(col));
    
    if (missingEssentials.length > 0) {
        showError(`Missing essential columns: ${missingEssentials.join(', ')}`);
        return false;
    }
    
    // Map all found expected columns to their indexes
    EXPECTED_COLUMNS.forEach(colName => {
        const index = headers.indexOf(colName);
        if (index !== -1) {
            appState.columnIndexes[colName] = index;
        }
    });
    
    // Log found columns
    console.log('Found columns:', Object.keys(appState.columnIndexes));
    console.log('Column indexes:', appState.columnIndexes);
    
    return true;
}

/**
 * Determine which column group a column belongs to
 * @param {string} colName - Column name
 * @returns {string|null} - Group name or null if not in any group
 */
function getColumnGroup(colName) {
    for (const [group, columns] of Object.entries(COLUMN_GROUPS)) {
        if (columns.includes(colName)) {
            return group;
        }
    }
    return null;
}

/**
 * Download a data URL as a file
 * @param {string} dataUrl - The data URL to download
 * @param {string} fileName - The name for the downloaded file
 */
function downloadDataUrl(dataUrl, fileName) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
