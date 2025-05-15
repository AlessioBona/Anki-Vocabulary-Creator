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
    
    // If we have sheet data, populate the column selectors
    if (appState.sheetData && appState.sheetData.values) {
        populateAIToolSelectors();
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
