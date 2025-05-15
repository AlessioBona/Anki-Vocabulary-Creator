// Main entry point for the application
// All globals have been moved to utils.js in appState

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
    
    // Restore OpenAI API key if available
    const savedApiKey = localStorage.getItem('openaiApiKey');
    if (savedApiKey && window.openAIAPI) {
        appState.openaiApiKey = savedApiKey;
        document.getElementById('openai-key').value = savedApiKey;
    }
    
    // Initialize the Google API client
    gapi.load('client', initializeGapiClient);
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', initializeApp);