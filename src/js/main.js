// Global variables to store authentication and sheet data
let accessToken = null;
let spreadsheetId = null;
let sheetData = {};

// Define API scopes needed for the application
const API_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

/**
 * Handle the response from Google Identity Services
 * @param {Object} response - Google Identity response object
 */
function handleCredentialResponse(response) {
    try {
        // Extract the JWT token
        const credential = response.credential;
        console.log("Received Google identity token");
        
        // We need to load gapi client for Sheets API calls
        loadGapiClient(credential);
        
        // Update UI to show authenticated state
        document.getElementById('auth-status').textContent = 'Authenticated';
        document.getElementById('sheet-section').classList.remove('hidden');
    } catch (error) {
        showError('Authentication error: ' + error.message);
        console.error('Authentication error:', error);
    }
}

/**
 * Load the Google API Client Library
 * @param {string} credential - The ID token from Google Identity
 */
function loadGapiClient(credential) {
    // Load the Google API Client Library
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
        gapi.load('client', async () => {
            try {
                await gapi.client.init({});
                
                // Set up the Sheets API with the token
                await gapi.client.setToken({
                    access_token: parseJwt(credential).sub
                });
                
                // Load the Sheets API
                await gapi.client.load('sheets', 'v4');
                
                console.log('GAPI client loaded for API');
                accessToken = credential;
            } catch (error) {
                showError('Failed to initialize Google API: ' + error.message);
                console.error('Error initializing GAPI client:', error);
            }
        });
    };
    document.body.appendChild(script);
}

/**
 * Parse the JWT token to extract relevant information
 * @param {string} token - JWT token
 * @returns {Object} - Decoded token payload
 */
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error('Error parsing JWT:', error);
        return {};
    }
}

/**
 * Extract spreadsheet ID from Google Sheets URL
 * @param {string} url - Google Sheets URL 
 * @returns {string} - Extracted spreadsheet ID
 */
function extractSpreadsheetId(url) {
    const regex = /\/d\/([a-zA-Z0-9-_]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    const loadSheetButton = document.getElementById('load-sheet');
    loadSheetButton.addEventListener('click', async () => {
        try {
            if (!accessToken) {
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
            
            // Fetch sheet names using the API
            await fetchSheetNames();
        } catch (error) {
            showError('Error loading sheet: ' + error.message);
            console.error('Error loading sheet:', error);
        }
    });
    
    const loadDataButton = document.getElementById('load-data');
    loadDataButton.addEventListener('click', async () => {
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
    });
});

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
        
        if (data && data.length > 0) {
            displayData(data);
            // Store the data for later use
            sheetData = {
                sheetName: sheetName,
                values: data
            };
        } else {
            showError('No data found in the sheet');
        }
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
    
    // Create a container for column filters
    const filterContainer = document.createElement('div');
    filterContainer.className = 'filter-container';
    filterContainer.innerHTML = '<h3>Column Visibility</h3>';
    
    // Create checkboxes for each column
    const checkboxContainer = document.createElement('div');
    checkboxContainer.className = 'checkbox-container';
    
    data[0].forEach((header, index) => {
        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = 'checkbox-item';
        
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