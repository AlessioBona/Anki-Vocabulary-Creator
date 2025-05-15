// Client ID from the Google Cloud Console
const CLIENT_ID = '273823503699-q2qcv5ceopn41bjil0ihuqkjka7puclp.apps.googleusercontent.com';

// API key from the Google Cloud Console - set to null if you don't have one
const API_KEY = null;

// Discovery doc URL for APIs used by the quickstart
const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';

// Authorization scopes required by the API
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

// Google OAuth token client
let tokenClient;

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
                        appState.spreadsheetId = savedSpreadsheetId;
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