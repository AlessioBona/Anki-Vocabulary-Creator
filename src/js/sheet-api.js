/**
 * Fetch sheet names from Google Sheets API
 */
async function fetchSheetNames() {
    try {
        console.log('Fetching sheet names for spreadsheet ID:', appState.spreadsheetId);
        
        const response = await gapi.client.sheets.spreadsheets.get({
            spreadsheetId: appState.spreadsheetId
        });
        
        // Check if we have a valid response
        if (!response || !response.result) {
            const errorMsg = 'Invalid response from Google Sheets API';
            console.error(errorMsg, response);
            showError(errorMsg);
            return;
        }
        
        const sheets = response.result.sheets;
        if (!sheets || !Array.isArray(sheets)) {
            const errorMsg = 'No sheets found in the spreadsheet';
            console.error(errorMsg, response.result);
            showError(errorMsg);
            return;
        }
        
        const sheetNames = sheets.map(sheet => sheet.properties.title);
        console.log('Found sheet names:', sheetNames);
        
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
        // Get detailed error information
        let errorMessage = 'Failed to fetch sheet names: ' + error.message;
        
        // Check for Google API specific error format
        if (error.result && error.result.error) {
            const apiError = error.result.error;
            errorMessage = `Google Sheets API error (${apiError.code}): ${apiError.message}`;
            console.error('Google API Error Details:', apiError);
        }
        
        showError(errorMessage);
        console.error('Error fetching sheet names:', error);
    }
}

/**
 * Fetch sheet data from Google Sheets API
 * @param {string} sheetName - Name of the sheet to fetch data from
 */
async function fetchSheetData(sheetName) {
    try {
        console.log(`Fetching data from sheet "${sheetName}" with spreadsheet ID: ${appState.spreadsheetId}`);
        
        // Check token validity first
        const token = gapi.client.getToken();
        if (!token) {
            console.warn('No valid token found, attempting to re-authenticate...');
            showError('Authentication token missing. Please sign in again.');
            // Reset auth state and prompt for sign-in
            updateUIForAuth(false);
            return;
        }
        
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: appState.spreadsheetId,
            range: sheetName
        });
        
        // Check if we have a valid response
        if (!response || !response.result) {
            const errorMsg = 'Invalid response from Google Sheets API';
            console.error(errorMsg, response);
            showError(errorMsg);
            return;
        }
        
        const data = response.result.values;
        
        if (!data || data.length === 0) {
            showError('No data found in the sheet');
            return;
        }
        
        console.log(`Successfully fetched ${data.length} rows from "${sheetName}"`);
        
        // Validate sheet structure
        const headers = data[0];
        if (!validateSheetStructure(headers)) {
            return;
        }
        
        // Display data with enhanced column handling
        displayData(data);
        
        // Store the data for later use
        appState.sheetData = {
            sheetName: sheetName,
            values: data
        };
    } catch (error) {
        // Get detailed error information
        let errorMessage = 'Failed to fetch sheet data: ' + error.message;
        
        // Check for Google API specific error format
        if (error.result && error.result.error) {
            const apiError = error.result.error;
            errorMessage = `Google Sheets API error (${apiError.code}): ${apiError.message}`;
            
            // Special handling for common errors
            if (apiError.code === 403) {
                errorMessage += '. You may not have permission to access this sheet.';
            } else if (apiError.code === 404) {
                errorMessage += '. The sheet may not exist or have been deleted.';
            } else if (apiError.code === 500) {
                errorMessage += '. Try refreshing the page and signing in again.';
            }
            
            console.error('Google API Error Details:', apiError);
        }
        
        showError(errorMessage);
        console.error('Error fetching sheet data:', error);
        
        // If we get a 401 Unauthorized error, the token might be invalid
        if (error.status === 401) {
            console.warn('Unauthorized: Token may be invalid. Clearing token and prompting for sign-in.');
            localStorage.removeItem('googleToken');
            updateUIForAuth(false);
        }
    }
}

/**
 * Save changes back to Google Sheet
 */
async function saveChanges() {
    try {
        if (!appState.sheetData.sheetName || !appState.sheetData.values) {
            showError('No data to save');
            return;
        }
        
        const response = await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: appState.spreadsheetId,
            range: appState.sheetData.sheetName,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: appState.sheetData.values
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
 * Download the current sheet data as a CSV file using Google's export URL
 */
function downloadCsv() {
    try {
        if (!appState.spreadsheetId || !appState.sheetData.sheetName) {
            showError('No sheet data to download');
            return;
        }
        
        // We need to get the sheet's GID (numeric ID) instead of just the name
        gapi.client.sheets.spreadsheets.get({
            spreadsheetId: appState.spreadsheetId
        }).then(response => {
            const sheets = response.result.sheets;
            const currentSheet = sheets.find(s => s.properties.title === appState.sheetData.sheetName);
            
            if (!currentSheet) {
                showError('Could not find sheet information');
                return;
            }
            
            const sheetId = currentSheet.properties.sheetId;
            
            // Construct the direct export URL
            const exportUrl = `https://docs.google.com/spreadsheets/d/${appState.spreadsheetId}/export?format=csv&gid=${sheetId}&range=A2:LL`;
            
            // Create an invisible link and trigger the download
            const link = document.createElement('a');
            link.href = exportUrl;
            link.setAttribute('download', `${appState.sheetData.sheetName || 'sheet-data'}.csv`);
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Show success message
            const successMessage = document.createElement('div');
            successMessage.className = 'success-message';
            successMessage.textContent = 'CSV file downloaded!';
            
            const dataTable = document.getElementById('data-table');
            dataTable.prepend(successMessage);
            
            // Remove the success message after a few seconds
            setTimeout(() => {
                successMessage.remove();
            }, 3000);
        }).catch(error => {
            showError('Error getting sheet information: ' + error.message);
            console.error('Error getting sheet information:', error);
        });
    } catch (error) {
        showError('Error downloading CSV: ' + error.message);
        console.error('Error downloading CSV:', error);
    }
}
