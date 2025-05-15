/**
 * API Handler for OpenAI interactions
 * Provides methods for text generation and text-to-speech
 */

// Store the API key (will be set by the user)
let openaiApiKey = '';

/**
 * Initialize the OpenAI API with the user's API key
 * @param {string} apiKey - The user's OpenAI API key
 */
function initializeOpenAI(apiKey) {
    openaiApiKey = apiKey;
    localStorage.setItem('openaiApiKey', apiKey);
    
    // Show success message
    const successMessage = document.createElement('div');
    successMessage.className = 'success-message';
    successMessage.textContent = 'OpenAI API key saved!';
    
    const apiSection = document.getElementById('api-section');
    apiSection.appendChild(successMessage);
    
    // Remove message after 3 seconds
    setTimeout(() => {
        successMessage.remove();
    }, 3000);
    
    // Enable AI action buttons
    const aiButtons = document.querySelectorAll('.ai-action');
    aiButtons.forEach(button => {
        button.disabled = false;
    });
}

/**
 * Check if the OpenAI API key is set
 * @returns {boolean} - Whether the API key is available
 */
function isOpenAIConfigured() {
    return openaiApiKey !== '';
}

/**
 * Generate text using OpenAI's GPT-4 model
 * @param {string} prompt - The prompt for text generation
 * @param {Object} options - Additional options for the API call
 * @returns {Promise<string>} - The generated text
 */
async function generateText(prompt, options = {}) {
    if (!isOpenAIConfigured()) {
        throw new Error('OpenAI API key not configured');
    }
    
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiApiKey}`
            },
            body: JSON.stringify({
                model: options.model || 'gpt-4-turbo',
                messages: [
                    { role: 'system', content: options.systemPrompt || 'You are a helpful assistant.' },
                    { role: 'user', content: prompt }
                ],
                temperature: options.temperature || 0.7,
                max_tokens: options.maxTokens || 500
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error('Error generating text:', error);
        throw error;
    }
}

/**
 * Generate speech from text using OpenAI's TTS model
 * @param {string} text - The text to convert to speech
 * @param {Object} options - Additional options for the API call
 * @returns {Promise<Blob>} - The audio data as a Blob
 */
async function generateSpeech(text, options = {}) {
    if (!isOpenAIConfigured()) {
        throw new Error('OpenAI API key not configured');
    }
    
    try {
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiApiKey}`
            },
            body: JSON.stringify({
                model: options.model || 'gpt-4o-mini-tts',
                input: text,
                voice: options.voice || 'verse',
                response_format: 'mp3'
            })
        });
        
        if (!response.ok) {
            let errorMessage;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error?.message || response.statusText;
            } catch {
                errorMessage = response.statusText;
            }
            throw new Error(`OpenAI API error: ${errorMessage}`);
        }
        
        // Get the audio data as a blob
        const audioBlob = await response.blob();
        return audioBlob;
    } catch (error) {
        console.error('Error generating speech:', error);
        throw error;
    }
}

/**
 * Generate batch audio files for selected rows
 * @param {Array} rows - Array of row data objects 
 * @param {string} textColumn - Column name containing text to convert to speech
 * @param {string} outputColumn - Column name to store audio file reference
 * @param {Object} options - TTS options like voice, model, etc.
 * @returns {Promise<Array>} - Updated rows with audio references
 */
async function generateBatchAudio(rows, textColumn, outputColumn, options = {}) {
    if (!isOpenAIConfigured()) {
        throw new Error('OpenAI API key not configured');
    }
    
    const updatedRows = [...rows];
    const progressElement = document.getElementById('batch-progress') || document.createElement('div');
    progressElement.id = 'batch-progress';
    progressElement.className = 'progress-bar';
    progressElement.innerHTML = `<div class="progress-text">Processing 0/${rows.length}</div><div class="progress-fill" style="width: 0%"></div>`;
    
    if (!document.getElementById('batch-progress')) {
        document.getElementById('data-table').prepend(progressElement);
    }
    
    try {
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const text = row[textColumn];
            
            if (!text) {
                continue; // Skip empty cells
            }
            
            // Update progress
            const percentage = Math.round(((i) / rows.length) * 100);
            progressElement.innerHTML = `<div class="progress-text">Processing ${i+1}/${rows.length}</div><div class="progress-fill" style="width: ${percentage}%"></div>`;
            
            try {
                const audioBlob = await generateSpeech(text, options);
                const fileName = `audio_${new Date().getTime()}_${i}.mp3`;
                
                // Convert blob to data URL for storage or use
                const reader = new FileReader();
                const audioDataUrl = await new Promise(resolve => {
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(audioBlob);
                });
                
                // Store the data URL in the output column
                updatedRows[i][outputColumn] = audioDataUrl;
                
            } catch (error) {
                console.error(`Error generating audio for row ${i}:`, error);
                // Continue with the next row rather than stopping the whole batch
            }
        }
        
        // Complete progress
        progressElement.innerHTML = `<div class="progress-text">Completed ${rows.length}/${rows.length}</div><div class="progress-fill" style="width: 100%"></div>`;
        
        // Remove progress bar after delay
        setTimeout(() => {
            progressElement.remove();
        }, 3000);
        
        return updatedRows;
    } catch (error) {
        progressElement.remove();
        throw error;
    }
}

/**
 * Generate translations or content based on sheet data
 * @param {Array} rows - Array of row data objects
 * @param {Object} columnMapping - Definition of source/target columns for generation
 * @param {Object} promptTemplate - Template for generation with placeholders
 * @param {Object} options - Additional options for the API call
 * @returns {Promise<Array>} - Updated rows with generated content
 */
async function generateContentBatch(rows, columnMapping, promptTemplate, options = {}) {
    if (!isOpenAIConfigured()) {
        throw new Error('OpenAI API key not configured');
    }
    
    const updatedRows = [...rows];
    const progressElement = document.createElement('div');
    progressElement.id = 'batch-progress';
    progressElement.className = 'progress-bar';
    progressElement.innerHTML = `<div class="progress-text">Processing 0/${rows.length}</div><div class="progress-fill" style="width: 0%"></div>`;
    
    document.getElementById('data-table').prepend(progressElement);
    
    try {
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            
            // Skip if target column already has content and we're not forcing overwrite
            if (row[columnMapping.target] && !options.forceOverwrite) {
                continue;
            }
            
            // Skip if source column is empty
            if (!row[columnMapping.source]) {
                continue;
            }
            
            // Create prompt by replacing placeholders in template
            let prompt = promptTemplate;
            Object.keys(row).forEach(key => {
                prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), row[key] || '');
            });
            
            // Update progress
            const percentage = Math.round(((i) / rows.length) * 100);
            progressElement.innerHTML = `<div class="progress-text">Processing ${i+1}/${rows.length}</div><div class="progress-fill" style="width: ${percentage}%"></div>`;
            
            try {
                // Generate content
                const generatedText = await generateText(prompt, options);
                updatedRows[i][columnMapping.target] = generatedText;
                
            } catch (error) {
                console.error(`Error generating content for row ${i}:`, error);
                // Continue with next row
            }
        }
        
        // Complete progress
        progressElement.innerHTML = `<div class="progress-text">Completed ${rows.length}/${rows.length}</div><div class="progress-fill" style="width: 100%"></div>`;
        
        // Remove progress bar after delay
        setTimeout(() => {
            progressElement.remove();
        }, 3000);
        
        return updatedRows;
    } catch (error) {
        progressElement.remove();
        throw error;
    }
}

// Export API functions
window.openAIAPI = {
    initializeOpenAI,
    isOpenAIConfigured,
    generateText,
    generateSpeech,
    generateBatchAudio,
    generateContentBatch
};