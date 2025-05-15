/**
 * Update UI based on authentication status
 * @param {boolean} isAuthorized - Whether the user is authorized
 */
function updateUIForAuth(isAuthorized) {
    appState.isAuthenticated = isAuthorized;
    
    document.getElementById('authorize-button').classList.toggle('hidden', isAuthorized);
    document.getElementById('signout-button').classList.toggle('hidden', !isAuthorized);
    document.getElementById('auth-status').textContent = isAuthorized ? 'Authenticated' : 'Not authenticated';
    document.getElementById('sheet-section').classList.toggle('hidden', !isAuthorized);
    
    // Hide the data section when signing out
    if (!isAuthorized) {
        document.getElementById('data-section').classList.add('hidden');
        document.getElementById('sheet-info').classList.add('hidden');
    }
}

/**
 * Load the sheet information
 */
async function loadSheet() {
    try {
        if (!appState.isAuthenticated) {
            showError('Please authenticate first');
            return;
        }
        
        // Get spreadsheet URL from input
        const sheetUrl = document.getElementById('sheet-url').value;
        appState.spreadsheetId = extractSpreadsheetId(sheetUrl);
        
        if (!appState.spreadsheetId) {
            showError('Invalid Google Sheets URL');
            return;
        }
        
        // Save the URL and spreadsheet ID to localStorage
        localStorage.setItem('sheetUrl', sheetUrl);
        localStorage.setItem('spreadsheetId', appState.spreadsheetId);
        
        // Fetch sheet names using the API
        await fetchSheetNames();
    } catch (error) {
        showError('Error loading sheet: ' + error.message);
        console.error('Error loading sheet:', error);
    }
}

/**
 * Load data from the selected sheet
 */
async function loadData() {
    try {
        const sheetSelector = document.getElementById('sheet-selector');
        const selectedSheet = sheetSelector.value;
        
        if (!selectedSheet) {
            showError('Please select a sheet');
            return;
        }
        
        // Fetch sheet data using the API
        await fetchSheetData(selectedSheet);
    } catch (error) {
        showError('Error loading data: ' + error.message);
        console.error('Error loading data:', error);
    }
}

/**
 * Apply filter to rows
 */
function applyRowFilter() {
    const columnIndex = document.getElementById('filter-column').value;
    const filterType = document.getElementById('filter-type').value;
    const table = document.getElementById('sheet-data-table');
    const rows = table.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
        const cell = row.querySelector(`td[data-column-index="${columnIndex}"]`);
        const isEmpty = !cell.textContent.trim();
        
        if (filterType === 'is-empty' && !isEmpty) {
            row.style.display = 'none';
        } else if (filterType === 'is-not-empty' && isEmpty) {
            row.style.display = 'none';
        } else {
            row.style.display = '';
        }
    });
}

/**
 * Clear row filters
 */
function clearRowFilter() {
    const table = document.getElementById('sheet-data-table');
    const rows = table.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
        row.style.display = '';
    });
}
