// Global variables to store authentication and sheet data
let isAuthenticated = false;
let spreadsheetId = null;
let sheetData = {};

// Client ID from the Google Cloud Console
const CLIENT_ID = '273823503699-q2qcv5ceopn41bjil0ihuqkjka7puclp.apps.googleusercontent.com';

// API key from the Google Cloud Console - set to null if you don't have one
const API_KEY = null;

// Discovery doc URL for APIs used by the quickstart
const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';

// Authorization scopes required by the API
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

let tokenClient;

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

// Column indexes for quick access (to be populated after loading data)
let columnIndexes = {};

/**
 * Initialize the API client and set up event listeners
 */
function initializeApp() {
    document.getElementById('authorize-button').addEventListener('click', handleAuthClick);
    document.getElementById('signout-button').addEventListener('click', handleSignoutClick);
    
    const loadSheetButton = document.getElementById('load-sheet');
    loadSheetButton.addEventListener('click', loadSheet);
    
    const loadDataButton = document.getElementById('load-data');
    loadDataButton.addEventListener('click', loadData);
    
    // Restore sheet URL from localStorage if available
    const savedSheetUrl = localStorage.getItem('sheetUrl');
    if (savedSheetUrl) {
        document.getElementById('sheet-url').value = savedSheetUrl;
    }
    
    // Initialize the Google API client
    gapi.load('client', initializeGapiClient);
}

/**
 * Initialize the Google API client library
 */
async function initializeGapiClient() {
    try {
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: [DISCOVERY_DOC],
        });
        
        // Initialize the Google Identity Services client
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: handleTokenResponse,
        });
        
        // Try to restore session from localStorage
        const savedToken = localStorage.getItem('googleToken');
        if (savedToken) {
            try {
                const tokenObject = JSON.parse(savedToken);
                // Check if token is still valid (not expired)
                const tokenExpiry = new Date(tokenObject.expiry_date);
                const now = new Date();
                
                if (tokenExpiry > now) {
                    // Token is still valid
                    gapi.client.setToken(tokenObject);
                    updateUIForAuth(true);
                    console.log('Restored authentication from saved token');
                    
                    // If we have a spreadsheet ID saved, try to load it
                    const savedSpreadsheetId = localStorage.getItem('spreadsheetId');
                    if (savedSpreadsheetId) {
                        spreadsheetId = savedSpreadsheetId;
                        fetchSheetNames().catch(error => {
                            console.error('Error fetching saved sheet:', error);
                            // If there's an error, clear the saved data
                            localStorage.removeItem('spreadsheetId');
                            localStorage.removeItem('sheetUrl');
                        });
                    }
                } else {
                    // Token expired, clear it
                    localStorage.removeItem('googleToken');
                }
            } catch (error) {
                console.error('Error restoring token:', error);
                localStorage.removeItem('googleToken');
            }
        }
    } catch (error) {
        showError(`Error initializing GAPI client: ${error.message}`);
        console.error('Error initializing GAPI client:', error);
    }
}

/**
 * Handle the token response from OAuth flow
 * @param {Object} response - The token response
 */
function handleTokenResponse(response) {
    if (response.error !== undefined) {
        showError(`Error authenticating: ${response.error}`);
        return;
    }
    
    // Successfully authenticated
    const token = gapi.client.getToken();
    if (token) {
        // Add expiry date if not present
        if (!token.expiry_date) {
            // Set expiry to 1 hour from now (typical Google token lifespan)
            token.expiry_date = new Date().getTime() + 3600000;
        }
        // Save token to localStorage
        localStorage.setItem('googleToken', JSON.stringify(token));
    }
    
    updateUIForAuth(true);
    console.log('Authentication successful');
}

/**
 * Handle sign-in button click
 */
function handleAuthClick() {
    if (gapi.client.getToken() === null) {
        // Prompt the user to select an account
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        // Skip display of account chooser for an existing session
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

/**
 * Handle sign-out button click
 */
function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token, () => {
            console.log('Token revoked');
        });
        gapi.client.setToken('');
        updateUIForAuth(false);
        
        // Clear saved authentication data
        localStorage.removeItem('googleToken');
        localStorage.removeItem('spreadsheetId');
        localStorage.removeItem('sheetUrl');
    }
}

/**
 * Update UI based on authentication status
 * @param {boolean} isAuthorized - Whether the user is authorized
 */
function updateUIForAuth(isAuthorized) {
    isAuthenticated = isAuthorized;
    
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
 * Load the sheet information
 */
async function loadSheet() {
    try {
        if (!isAuthenticated) {
            showError('Please authenticate first');
            return;
        }
        
        // Get spreadsheet URL from input
        const sheetUrl = document.getElementById('sheet-url').value;
        spreadsheetId = extractSpreadsheetId(sheetUrl);
        
        if (!spreadsheetId) {
            showError('Invalid Google Sheets URL');
            return;
        }
        
        // Save the URL and spreadsheet ID to localStorage
        localStorage.setItem('sheetUrl', sheetUrl);
        localStorage.setItem('spreadsheetId', spreadsheetId);
        
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
 * Fetch sheet names from Google Sheets API
 */
async function fetchSheetNames() {
    try {
        const response = await gapi.client.sheets.spreadsheets.get({
            spreadsheetId: spreadsheetId
        });
        
        const sheets = response.result.sheets;
        const sheetNames = sheets.map(sheet => sheet.properties.title);
        
        const sheetSelector = document.getElementById('sheet-selector');
        sheetSelector.innerHTML = '';
        
        sheetNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            sheetSelector.appendChild(option);
        });
        
        document.getElementById('sheet-info').classList.remove('hidden');
    } catch (error) {
        showError('Failed to fetch sheet names: ' + error.message);
        console.error('Error fetching sheet names:', error);
    }
}

/**
 * Fetch sheet data from Google Sheets API
 * @param {string} sheetName - Name of the sheet to fetch data from
 */
async function fetchSheetData(sheetName) {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: sheetName
        });
        
        const data = response.result.values;
        
        if (!data || data.length === 0) {
            showError('No data found in the sheet');
            return;
        }
        
        // Validate sheet structure
        const headers = data[0];
        if (!validateSheetStructure(headers)) {
            return;
        }
        
        // Display data with enhanced column handling
        displayData(data);
        
        // Store the data for later use
        sheetData = {
            sheetName: sheetName,
            values: data
        };
    } catch (error) {
        showError('Failed to fetch sheet data: ' + error.message);
        console.error('Error fetching sheet data:', error);
    }
}

/**
 * Display sheet data in HTML table
 * @param {Array} data - 2D array of sheet data
 */
function displayData(data) {
    const dataSection = document.getElementById('data-section');
    const dataTable = document.getElementById('data-table');
    
    // Clear existing table
    dataTable.innerHTML = '';
    
    // Create a container for column filters with column groups
    const filterContainer = document.createElement('div');
    filterContainer.className = 'filter-container';
    filterContainer.innerHTML = '<h3>Column Visibility</h3>';
    
    // Create container for column group checkboxes
    const groupContainer = document.createElement('div');
    groupContainer.className = 'group-container';
    
    // Create column group toggle buttons
    Object.entries(COLUMN_GROUPS).forEach(([groupName, columns]) => {
        const groupButton = document.createElement('button');
        groupButton.textContent = `Toggle ${groupName.charAt(0).toUpperCase() + groupName.slice(1)}`;
        groupButton.className = 'group-toggle';
        groupButton.dataset.group = groupName;
        
        groupButton.addEventListener('click', () => {
            // Check if all columns in this group are visible
            const columnsInGroup = columns.filter(col => columnIndexes.hasOwnProperty(col));
            const tableHeaders = document.querySelectorAll('#sheet-data-table th');
            
            // Determine if all columns in this group are currently visible
            const allVisible = columnsInGroup.every(col => {
                const index = columnIndexes[col];
                const header = [...tableHeaders].find(th => parseInt(th.dataset.columnIndex) === index);
                return header && header.style.display !== 'none';
            });
            
            // Toggle visibility of all columns in this group
            columnsInGroup.forEach(col => {
                if (columnIndexes.hasOwnProperty(col)) {
                    const checkbox = document.getElementById(`col-${columnIndexes[col]}`);
                    if (checkbox) {
                        checkbox.checked = !allVisible;
                        toggleColumnVisibility(columnIndexes[col], !allVisible);
                    }
                }
            });
        });
        
        groupContainer.appendChild(groupButton);
    });
    
    filterContainer.appendChild(groupContainer);
    
    // Create individual column checkboxes
    const checkboxContainer = document.createElement('div');
    checkboxContainer.className = 'checkbox-container';
    
    // Function to determine which group a column belongs to
    function getColumnGroup(colName) {
        for (const [group, columns] of Object.entries(COLUMN_GROUPS)) {
            if (columns.includes(colName)) {
                return group;
            }
        }
        return null;
    }
    
    data[0].forEach((header, index) => {
        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = 'checkbox-item';
        
        // Add special class if the column belongs to a predefined group
        const columnGroup = getColumnGroup(header);
        if (columnGroup) {
            checkboxDiv.classList.add(`group-${columnGroup}`);
        }
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `col-${index}`;
        checkbox.checked = true;
        checkbox.addEventListener('change', () => toggleColumnVisibility(index, checkbox.checked));
        
        const label = document.createElement('label');
        label.htmlFor = `col-${index}`;
        label.textContent = header;
        
        checkboxDiv.appendChild(checkbox);
        checkboxDiv.appendChild(label);
        checkboxContainer.appendChild(checkboxDiv);
    });
    
    filterContainer.appendChild(checkboxContainer);
    dataTable.appendChild(filterContainer);
    
    // Create the table
    const table = document.createElement('table');
    table.id = 'sheet-data-table';
    
    // Create header row
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    data[0].forEach((headerText, index) => {
        const th = document.createElement('th');
        th.textContent = headerText;
        th.dataset.columnIndex = index;
        
        // Add classes based on column group
        const columnGroup = getColumnGroup(headerText);
        if (columnGroup) {
            th.classList.add(`group-${columnGroup}`);
        }
        
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create table body
    const tbody = document.createElement('tbody');
    
    for (let i = 1; i < data.length; i++) {
        const row = document.createElement('tr');
        
        data[i].forEach((cellText, index) => {
            const td = document.createElement('td');
            td.textContent = cellText || '';
            td.dataset.columnIndex = index;
            td.addEventListener('dblclick', () => makeEditable(td, i, index));
            
            // Add classes based on column group
            const columnGroup = getColumnGroup(data[0][index]);
            if (columnGroup) {
                td.classList.add(`group-${columnGroup}`);
            }
            
            row.appendChild(td);
        });
        
        tbody.appendChild(row);
    }
    
    table.appendChild(tbody);
    dataTable.appendChild(table);
    
    // Create a container for filtering rows
    const rowFilterContainer = document.createElement('div');
    rowFilterContainer.className = 'row-filter-container';
    rowFilterContainer.innerHTML = '<h3>Filter Rows</h3>';
    
    const rowFilterForm = document.createElement('form');
    const selectColumn = document.createElement('select');
    selectColumn.id = 'filter-column';
    
    data[0].forEach((header, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = header;
        selectColumn.appendChild(option);
    });
    
    const filterTypeSelect = document.createElement('select');
    filterTypeSelect.id = 'filter-type';
    
    ['Is Empty', 'Is Not Empty'].forEach(type => {
        const option = document.createElement('option');
        option.value = type.toLowerCase().replace(' ', '-');
        option.textContent = type;
        filterTypeSelect.appendChild(option);
    });
    
    const applyFilterButton = document.createElement('button');
    applyFilterButton.textContent = 'Apply Filter';
    applyFilterButton.type = 'button';
    applyFilterButton.addEventListener('click', applyRowFilter);
    
    const clearFilterButton = document.createElement('button');
    clearFilterButton.textContent = 'Clear Filter';
    clearFilterButton.type = 'button';
    clearFilterButton.addEventListener('click', clearRowFilter);
    
    rowFilterForm.appendChild(document.createTextNode('Show rows where '));
    rowFilterForm.appendChild(selectColumn);
    rowFilterForm.appendChild(document.createTextNode(' '));
    rowFilterForm.appendChild(filterTypeSelect);
    rowFilterForm.appendChild(document.createTextNode(' '));
    rowFilterForm.appendChild(applyFilterButton);
    rowFilterForm.appendChild(document.createTextNode(' '));
    rowFilterForm.appendChild(clearFilterButton);
    
    rowFilterContainer.appendChild(rowFilterForm);
    dataTable.appendChild(rowFilterContainer);
    
    // Add a save changes button
    const saveButtonContainer = document.createElement('div');
    saveButtonContainer.className = 'save-button-container';
    
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save Changes';
    saveButton.addEventListener('click', saveChanges);
    
    saveButtonContainer.appendChild(saveButton);
    dataTable.appendChild(saveButtonContainer);
    
    dataSection.classList.remove('hidden');
}

/**
 * Toggle column visibility
 * @param {number} columnIndex - Index of column to toggle
 * @param {boolean} visible - Whether column should be visible
 */
function toggleColumnVisibility(columnIndex, visible) {
    const table = document.getElementById('sheet-data-table');
    const cells = table.querySelectorAll(`th[data-column-index="${columnIndex}"], td[data-column-index="${columnIndex}"]`);
    
    cells.forEach(cell => {
        cell.style.display = visible ? '' : 'none';
    });
}

/**
 * Make a cell editable on double-click
 * @param {HTMLElement} cell - The table cell to make editable
 * @param {number} rowIndex - The row index in the data array
 * @param {number} columnIndex - The column index in the data array
 */
function makeEditable(cell, rowIndex, columnIndex) {
    const originalContent = cell.textContent;
    
    // Create an input element
    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalContent;
    input.style.width = '100%';
    
    // Replace cell content with input
    cell.textContent = '';
    cell.appendChild(input);
    input.focus();
    
    // Handle input blur to save changes
    input.addEventListener('blur', () => {
        cell.textContent = input.value;
        // Update the stored data
        sheetData.values[rowIndex][columnIndex] = input.value;
    });
    
    // Handle Enter key
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            input.blur();
        } else if (event.key === 'Escape') {
            cell.textContent = originalContent;
        }
    });
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

/**
 * Save changes back to Google Sheet
 */
async function saveChanges() {
    try {
        if (!sheetData.sheetName || !sheetData.values) {
            showError('No data to save');
            return;
        }
        
        const response = await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: sheetData.sheetName,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: sheetData.values
            }
        });
        
        if (response.status === 200) {
            // Show success message
            const successMessage = document.createElement('div');
            successMessage.className = 'success-message';
            successMessage.textContent = 'Changes saved successfully!';
            
            const dataTable = document.getElementById('data-table');
            dataTable.prepend(successMessage);
            
            // Remove the success message after a few seconds
            setTimeout(() => {
                successMessage.remove();
            }, 3000);
        } else {
            showError('Failed to save changes: ' + response.statusText);
        }
    } catch (error) {
        showError('Error saving changes: ' + error.message);
        console.error('Error saving changes:', error);
    }
}

/**
 * Validate sheet columns against expected structure
 * @param {Array} headers - Array of column headers from the sheet
 * @returns {boolean} - Whether the sheet has the minimum required columns
 */
function validateSheetStructure(headers) {
    // Reset column indexes
    columnIndexes = {};
    
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
            columnIndexes[colName] = index;
        }
    });
    
    // Log found columns
    console.log('Found columns:', Object.keys(columnIndexes));
    console.log('Column indexes:', columnIndexes);
    
    return true;
}

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

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', initializeApp);