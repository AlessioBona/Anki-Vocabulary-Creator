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
    
    // Set up AI controls if authenticated
    if (isAuthorized) {
        setupAIControls();
    }
    
    // Hide the data and API sections when signing out
    if (!isAuthorized) {
        document.getElementById('data-section').classList.add('hidden');
        document.getElementById('sheet-info').classList.add('hidden');
        document.getElementById('api-section').classList.add('hidden');
        document.getElementById('ai-tools-section').classList.add('hidden');
    }
    
    // Refresh the data display if data is available
    if (isAuthorized && appState.sheetData && appState.sheetData.values) {
        displayData(appState.sheetData.values);
    }
}

/**
 * Load the sheet information
 * @param {boolean} isRetry - Whether this is a retry attempt after token refresh
 */
async function loadSheet(isRetry = false) {
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
        
        // Show loading indicator
        const loadSheetButton = document.getElementById('load-sheet');
        const originalText = loadSheetButton.textContent;
        loadSheetButton.disabled = true;
        loadSheetButton.textContent = 'Loading...';
        
        try {
            // Fetch sheet names using the API
            await fetchSheetNames();
        } catch (error) {
            console.error('Error in loadSheet:', error);
            
            // If this is an API error and not a retry attempt yet, try refreshing the token and retrying
            if (!isRetry && error.result && error.result.error && error.result.error.code >= 401) {
                console.log('API error encountered. Attempting to refresh token and retry...');
                const refreshed = await refreshToken();
                
                if (refreshed) {
                    // Reset button and retry
                    loadSheetButton.disabled = false;
                    loadSheetButton.textContent = originalText;
                    return loadSheet(true); // Retry with refreshed token
                }
            }
            
            // Show error and re-enable button
            showError('Error loading sheet: ' + (error.message || 'Unknown error'));
            loadSheetButton.disabled = false;
            loadSheetButton.textContent = originalText;
            return;
        }
        
        // Reset button state
        loadSheetButton.disabled = false;
        loadSheetButton.textContent = originalText;
    } catch (error) {
        showError('Error loading sheet: ' + error.message);
        console.error('Error loading sheet:', error);
        
        // Reset any UI elements that might be in loading state
        const loadSheetButton = document.getElementById('load-sheet');
        if (loadSheetButton) {
            loadSheetButton.disabled = false;
            loadSheetButton.textContent = 'Load Sheet';
        }
    }
}

/**
 * Load data from the selected sheet
 * @param {boolean} isRetry - Whether this is a retry attempt after token refresh
 */
async function loadData(isRetry = false) {
    try {
        const sheetSelector = document.getElementById('sheet-selector');
        const selectedSheet = sheetSelector.value;
        
        if (!selectedSheet) {
            showError('Please select a sheet');
            return;
        }
        
        // Show loading indicator
        const loadDataButton = document.getElementById('load-data');
        const originalText = loadDataButton.textContent;
        loadDataButton.disabled = true;
        loadDataButton.textContent = 'Loading...';
        
        try {
            // Fetch sheet data using the API
            await fetchSheetData(selectedSheet);
        } catch (error) {
            console.error('Error in loadData:', error);
            
            // If this is an API error and not a retry attempt yet, try refreshing the token and retrying
            if (!isRetry && error.result && error.result.error && error.result.error.code >= 401) {
                console.log('API error encountered. Attempting to refresh token and retry...');
                const refreshed = await refreshToken();
                
                if (refreshed) {
                    // Reset button and retry
                    loadDataButton.disabled = false;
                    loadDataButton.textContent = originalText;
                    return loadData(true); // Retry with refreshed token
                }
            }
            
            // Show error and re-enable button
            showError('Error loading data: ' + (error.message || 'Unknown error'));
            loadDataButton.disabled = false;
            loadDataButton.textContent = originalText;
            return;
        }
        
        // Reset button state
        loadDataButton.disabled = false;
        loadDataButton.textContent = originalText;
    } catch (error) {
        showError('Error loading data: ' + error.message);
        console.error('Error loading data:', error);
        
        // Reset any UI elements that might be in loading state
        const loadDataButton = document.getElementById('load-data');
        if (loadDataButton) {
            loadDataButton.disabled = false;
            loadDataButton.textContent = 'Load Data';
        }
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
        // Only consider the text node, ignore button text
        // Get text content excluding buttons or other child elements
        let cellText = '';
        if (cell) {
            // Iterate through child nodes and only consider direct text nodes
            for (const node of cell.childNodes) {
                if (node.nodeType === Node.TEXT_NODE) {
                    cellText += node.textContent;
                }
            }
            cellText = cellText.trim();
        }
        const isEmpty = !cellText;
        
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
 * Apply row range filter
 */
function applyRowRangeFilter() {
    const startRow = parseInt(document.getElementById('start-row').value) || 1;
    const endRow = parseInt(document.getElementById('end-row').value) || Number.MAX_SAFE_INTEGER;
    
    if (startRow < 1) {
        showError('Start row must be at least 1');
        return;
    }
    
    if (endRow < startRow) {
        showError('End row must be greater than or equal to start row');
        return;
    }
    
    const table = document.getElementById('sheet-data-table');
    const rows = table.querySelectorAll('tbody tr');
    
    // First reset all row visibility from previous range filters
    // but keep column filters intact
    const columnIndex = document.getElementById('filter-column')?.value;
    const filterType = document.getElementById('filter-type')?.value;
    
    rows.forEach((row, index) => {
        // Check if it's hidden by column filter
        let hiddenByColumnFilter = false;
        
        if (columnIndex && filterType) {
            const cell = row.querySelector(`td[data-column-index="${columnIndex}"]`);
            let cellText = '';
            if (cell) {
                for (const node of cell.childNodes) {
                    if (node.nodeType === Node.TEXT_NODE) {
                        cellText += node.textContent;
                    }
                }
                cellText = cellText.trim();
            }
            const isEmpty = !cellText;
            
            hiddenByColumnFilter = (filterType === 'is-empty' && !isEmpty) || 
                                  (filterType === 'is-not-empty' && isEmpty);
        }
        
        // Reset visibility first, respecting column filters
        row.style.display = hiddenByColumnFilter ? 'none' : '';
        
        // Then apply range filter
        const rowNumber = index + 1;
        if (rowNumber < startRow || rowNumber > endRow) {
            row.style.display = 'none';
        }
    });
}

// Modify the clearRowFilter function to also reset the range inputs
function clearRowFilter() {
    const table = document.getElementById('sheet-data-table');
    const rows = table.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
        row.style.display = '';
    });
    
    // Clear range inputs if they exist
    const startRowInput = document.getElementById('start-row');
    const endRowInput = document.getElementById('end-row');
    
    if (startRowInput) startRowInput.value = '';
    if (endRowInput) endRowInput.value = '';
}

/**
 * Initialize OpenAI API key from storage and set up event listeners
 */
function setupAIControls() {
    // Show API section when authenticated
    document.getElementById('api-section').classList.remove('hidden');
    
    // Check for saved API key
    const savedApiKey = localStorage.getItem('openaiApiKey');
    if (savedApiKey) {
        document.getElementById('openai-key').value = savedApiKey;
        window.openAIAPI.initializeOpenAI(savedApiKey);
        appState.aiConfigured = true;
        
        // Show AI tools section
        document.getElementById('ai-tools-section').classList.remove('hidden');
        
        // If we have sheet data, populate the column selectors
        if (appState.sheetData && appState.sheetData.values) {
            populateAIToolSelectors();
        }
    }
    
    // Set up API key save button
    document.getElementById('save-openai-key').addEventListener('click', saveOpenAIKey);
    
    // Set up AI action buttons
    document.getElementById('run-generation').addEventListener('click', runTextGeneration);
    document.getElementById('run-tts').addEventListener('click', runSpeechGeneration);
}

/**
 * Save OpenAI API key
 */
function saveOpenAIKey() {
    const apiKey = document.getElementById('openai-key').value.trim();
    
    if (!apiKey) {
        showError('Please enter an OpenAI API key');
        return;
    }
    
    // Initialize OpenAI with the API key
    window.openAIAPI.initializeOpenAI(apiKey);
    appState.aiConfigured = true;
    
    // Show AI tools section
    document.getElementById('ai-tools-section').classList.remove('hidden');
    
    // If we have sheet data, populate the column selectors and refresh the display
    if (appState.sheetData && appState.sheetData.values) {
        populateAIToolSelectors();
        
        // Refresh the data table to show regeneration buttons
        displayData(appState.sheetData.values);
    }
}

/**
 * Populate AI tool selectors with column names
 */
function populateAIToolSelectors() {
    if (!appState.sheetData || !appState.sheetData.values || appState.sheetData.values.length === 0) {
        return;
    }
    
    const headers = appState.sheetData.values[0];
    const selectors = [
        'gen-source-col', 
        'gen-target-col',
        'tts-source-col',
        'tts-target-col'
    ];
    
    selectors.forEach(selectorId => {
        const select = document.getElementById(selectorId);
        select.innerHTML = '';
        select.disabled = !appState.aiConfigured;
        
        headers.forEach((header, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = header;
            
            // Pre-select appropriate columns
            if (selectorId === 'gen-source-col' && header === 'Sentence_01_zh') {
                option.selected = true;
            } else if (selectorId === 'gen-target-col' && header === 'Sentence_01_en') {
                option.selected = true;
            } else if (selectorId === 'tts-source-col' && header === 'Sentence_01_zh') {
                option.selected = true;
            } else if (selectorId === 'tts-target-col' && header === 'Sentence_01_audio') {
                option.selected = true;
            }
            
            select.appendChild(option);
        });
    });
    
    // Enable text areas
    document.getElementById('gen-template').disabled = !appState.aiConfigured;
}

/**
 * Run text generation for selected columns
 */
async function runTextGeneration() {
    if (!appState.aiConfigured) {
        showError('Please configure OpenAI API key first');
        return;
    }
    
    try {
        const sourceColIndex = parseInt(document.getElementById('gen-source-col').value);
        const targetColIndex = parseInt(document.getElementById('gen-target-col').value);
        const promptTemplate = document.getElementById('gen-template').value;
        
        if (isNaN(sourceColIndex) || isNaN(targetColIndex)) {
            showError('Please select source and target columns');
            return;
        }
        
        if (!promptTemplate) {
            showError('Please provide a prompt template');
            return;
        }
        
        const columnMapping = {
            source: sourceColIndex,
            target: targetColIndex
        };
        
        // Get table rows (skip header)
        const rows = appState.sheetData.values.slice(1);
        
        // Run batch generation
        const updatedRows = await window.openAIAPI.generateContentBatch(
            rows, 
            columnMapping, 
            promptTemplate,
            { 
                model: 'gpt-4-turbo',
                systemPrompt: 'You are an expert linguist and translator.',
                temperature: 0.2
            }
        );
        
        // Update sheet data
        appState.sheetData.values = [appState.sheetData.values[0], ...updatedRows];
        
        // Update display
        displayData(appState.sheetData.values);
        
        // Show success message
        showSuccess('Text generation completed!');
        
    } catch (error) {
        showError(`Error generating text: ${error.message}`);
    }
}

/**
 * Run speech generation for selected columns
 */
async function runSpeechGeneration() {
    if (!appState.aiConfigured) {
        showError('Please configure OpenAI API key first');
        return;
    }
    
    try {
        const sourceColIndex = parseInt(document.getElementById('tts-source-col').value);
        const targetColIndex = parseInt(document.getElementById('tts-target-col').value);
        const voice = document.getElementById('tts-voice').value;
        
        if (isNaN(sourceColIndex) || isNaN(targetColIndex)) {
            showError('Please select source and target columns');
            return;
        }
        
        // Get table rows (skip header)
        const rows = appState.sheetData.values.slice(1);
        
        // Run batch speech generation
        const updatedRows = await window.openAIAPI.generateBatchAudio(
            rows,
            sourceColIndex,
            targetColIndex,
            { 
                model: 'tts-1',
                voice: voice
            }
        );
        
        // Update sheet data
        appState.sheetData.values = [appState.sheetData.values[0], ...updatedRows];
        
        // Update display
        displayData(appState.sheetData.values);
        
        // Show success message
        showSuccess('Audio generation completed!');
        
    } catch (error) {
        showError(`Error generating audio: ${error.message}`);
    }
}

window.applyRowRangeFilter = applyRowRangeFilter;