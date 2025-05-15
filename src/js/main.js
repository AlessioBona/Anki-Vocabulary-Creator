// Global variables to store authentication and sheet data
let accessToken = null;
let spreadsheetId = null;
let sheetData = {};

/**
 * Handle the response from Google Identity Services
 * @param {Object} response - Google Identity response object
 */
function handleCredentialResponse(response) {
    // Extract the JWT token
    const credential = response.credential;
    
    // Exchange the ID token for an access token
    // Note: In production, you'd need to validate the token and exchange it for OAuth access token
    // For this prototype, we'll simulate having an access token
    accessToken = 'SIMULATED_TOKEN';

    // Update UI to show authenticated state
    document.getElementById('auth-status').textContent = 'Authenticated';
    document.getElementById('sheet-section').classList.remove('hidden');
    
    // For production, you would use:
    // gapi.client.setApiKey('YOUR_API_KEY');
    // gapi.client.load('sheets', 'v4', function() {
    //    // API is loaded and ready to use
    // });

    console.log('Authentication successful');
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
    loadSheetButton.addEventListener('click', () => {
        // Get spreadsheet URL from input
        const sheetUrl = document.getElementById('sheet-url').value;
        spreadsheetId = extractSpreadsheetId(sheetUrl);
        
        if (!spreadsheetId) {
            showError('Invalid Google Sheets URL');
            return;
        }
        
        // For the prototype, we'll simulate fetching sheet names
        fetchSheetNames();
    });
    
    const loadDataButton = document.getElementById('load-data');
    loadDataButton.addEventListener('click', () => {
        const sheetSelector = document.getElementById('sheet-selector');
        const selectedSheet = sheetSelector.value;
        
        if (!selectedSheet) {
            showError('Please select a sheet');
            return;
        }
        
        // For the prototype, we'll simulate fetching sheet data
        fetchSheetData(selectedSheet);
    });
});

/**
 * Simulate fetching sheet names from Google Sheets API
 */
function fetchSheetNames() {
    // In a real implementation, you would make an API call like:
    // gapi.client.sheets.spreadsheets.get({ spreadsheetId: spreadsheetId })
    
    // For prototype, simulate API response
    setTimeout(() => {
        const sheetNames = ['Sheet1', 'Sheet2', 'Vocabulary'];
        
        const sheetSelector = document.getElementById('sheet-selector');
        sheetSelector.innerHTML = '';
        
        sheetNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            sheetSelector.appendChild(option);
        });
        
        document.getElementById('sheet-info').classList.remove('hidden');
    }, 500);
}

/**
 * Simulate fetching sheet data from Google Sheets API
 * @param {string} sheetName - Name of the sheet to fetch data from
 */
function fetchSheetData(sheetName) {
    // In a real implementation, you would make an API call like:
    // gapi.client.sheets.spreadsheets.values.get({
    //     spreadsheetId: spreadsheetId,
    //     range: sheetName
    // })
    
    // For prototype, simulate API response
    setTimeout(() => {
        const sampleData = [
            ['Word', 'Definition', 'Example', 'Notes'],
            ['Apple', 'A fruit', 'I ate an apple', ''],
            ['Book', 'A written work', 'I read a book', ''],
            ['Computer', 'An electronic device', 'I use a computer', '']
        ];
        
        displayData(sampleData);
    }, 500);
}

/**
 * Display sheet data in HTML table
 * @param {Array} data - 2D array of sheet data
 */
function displayData(data) {
    const dataSection = document.getElementById('data-section');
    const dataTable = document.getElementById('data-table');
    
    const table = document.createElement('table');
    
    // Create header row
    const headerRow = document.createElement('tr');
    data[0].forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    
    table.appendChild(headerRow);
    
    // Create data rows
    for (let i = 1; i < data.length; i++) {
        const row = document.createElement('tr');
        
        data[i].forEach(cellText => {
            const td = document.createElement('td');
            td.textContent = cellText;
            row.appendChild(td);
        });
        
        table.appendChild(row);
    }
    
    dataTable.innerHTML = '';
    dataTable.appendChild(table);
    dataSection.classList.remove('hidden');
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