/**
 * Word Regeneration Module
 * Provides functionality to regenerate Pinyin and English translations for Chinese words
 */

/**
 * Generate pinyin for a Chinese word
 * @param {string} chineseWord - The Chinese word to transliterate
 * @returns {Promise<string>} - The pinyin transliteration
 */
async function generateWordPinyin(chineseWord) {
    if (!window.openAIAPI.isOpenAIConfigured()) {
        throw new Error('OpenAI API key not configured');
    }
    
    const prompt = `Provide the pinyin transliteration for this Chinese word: "${chineseWord}"
                    Only provide the pinyin with tone marks, nothing else.`;
    
    try {
        const pinyin = await window.openAIAPI.generateText(prompt, {
            model: 'gpt-4-turbo',
            systemPrompt: 'You are a Chinese language expert. Provide accurate pinyin transliterations with tone marks.',
            temperature: 0.3,
            maxTokens: 50
        });
        
        return pinyin.trim();
    } catch (error) {
        console.error('Error generating word pinyin:', error);
        throw error;
    }
}

/**
 * Generate English translation for a Chinese word
 * @param {string} chineseWord - The Chinese word to translate
 * @returns {Promise<string>} - The English translation
 */
async function generateWordTranslation(chineseWord) {
    if (!window.openAIAPI.isOpenAIConfigured()) {
        throw new Error('OpenAI API key not configured');
    }
    
    const prompt = `Translate this Chinese word to natural English: "${chineseWord}"
                    Only provide the most accurate English translation, nothing else.`;
    
    try {
        const translation = await window.openAIAPI.generateText(prompt, {
            model: 'gpt-4-turbo',
            systemPrompt: 'You are a translation expert. Provide accurate and natural-sounding translations from Chinese to English.',
            temperature: 0.3,
            maxTokens: 50
        });
        
        return translation.trim();
    } catch (error) {
        console.error('Error generating word translation:', error);
        throw error;
    }
}

/**
 * Regenerate word pronunciation and translation
 * @param {string} word - The Chinese word
 * @returns {Promise<Object>} - Object containing the generated content
 */
async function regenerateWordInfo(word) {
    try {
        // Show loading state
        const progressElement = document.createElement('div');
        progressElement.id = 'regenerate-word-progress';
        progressElement.className = 'progress-bar';
        progressElement.innerHTML = `<div class="progress-text">Generating Pinyin...</div><div class="progress-fill" style="width: 0%"></div>`;
        document.getElementById('data-table').prepend(progressElement);
        
        // Step 1: Generate Pinyin
        const pinyin = await generateWordPinyin(word);
        progressElement.innerHTML = `<div class="progress-text">Generating English translation...</div><div class="progress-fill" style="width: 50%"></div>`;
        
        // Step 2: Generate English translation
        const englishTranslation = await generateWordTranslation(word);
        progressElement.innerHTML = `<div class="progress-text">Completed regeneration</div><div class="progress-fill" style="width: 100%"></div>`;
        
        // Remove progress element after delay
        setTimeout(() => {
            progressElement.remove();
        }, 2000);
        
        // Return the generated content
        return {
            pinyin: pinyin,
            translation: englishTranslation
        };
    } catch (error) {
        // Remove progress element if there's an error
        const progressElement = document.getElementById('regenerate-word-progress');
        if (progressElement) {
            progressElement.remove();
        }
        
        throw error;
    }
}

/**
 * Update the table cells with the regenerated word information
 * @param {number} rowIndex - The row index in the data table
 * @param {Object} content - The content to update (pinyin, translation)
 */
function updateWordTableCells(rowIndex, content) {
    // Update the internal data structure
    const pronunciationColumnIndex = appState.columnIndexes['Pronunciation'];
    const translationColumnIndex = appState.columnIndexes['Translation'];
    
    // Update the data in the appState
    if (pronunciationColumnIndex !== undefined) {
        appState.sheetData.values[rowIndex][pronunciationColumnIndex] = content.pinyin;
    }
    
    if (translationColumnIndex !== undefined) {
        appState.sheetData.values[rowIndex][translationColumnIndex] = content.translation;
    }
    
    // Update the displayed table cells
    const table = document.getElementById('sheet-data-table');
    const row = table.querySelector(`tbody tr:nth-child(${rowIndex})`);
    
    if (row) {
        console.log(`Updating word info cells for row ${rowIndex}`);
          if (pronunciationColumnIndex !== undefined) {
            const pyCell = row.querySelector(`td[data-column-index="${pronunciationColumnIndex}"]`);
            if (pyCell) {
                pyCell.textContent = content.pinyin;
                console.log(`Updated Pronunciation cell: ${content.pinyin}`);
            }
        }
        
        if (translationColumnIndex !== undefined) {
            const translationCell = row.querySelector(`td[data-column-index="${translationColumnIndex}"]`);
            if (translationCell) {
                translationCell.textContent = content.translation;
                console.log(`Updated Translation cell: ${content.translation}`);
            }
        }
        
        // Re-add the regenerate button to the Word cell if needed
        const wordColumnIndex = appState.columnIndexes['Word'];
        if (wordColumnIndex !== undefined) {
            const wordCell = row.querySelector(`td[data-column-index="${wordColumnIndex}"]`);
            if (wordCell) {
                const existingButton = wordCell.querySelector('.word-regenerate-btn');
                if (!existingButton) {
                    // Re-add the regenerate button if it was removed
                    addRegenerateButtonToWordCell(wordCell, rowIndex, wordColumnIndex, 'Word');
                }
            }
        }
    } else {
        console.error(`Row not found for rowIndex ${rowIndex}`);
    }
}

/**
 * Add regeneration button to Word cells
 * @param {HTMLTableCellElement} cell - The table cell to add a button to
 * @param {number} rowIndex - The row index in the data array
 * @param {number} columnIndex - The column index in the data array
 * @param {string} columnName - The name of the column
 */
function addRegenerateButtonToWordCell(cell, rowIndex, columnIndex, columnName) {
    // Only add to Word cells
    if (columnName === 'Word') {
        // Create regenerate button
        const regenerateBtn = document.createElement('button');
        regenerateBtn.className = 'regenerate-btn word-regenerate-btn';
        regenerateBtn.textContent = '🔄';
        regenerateBtn.title = 'Regenerate word pronunciation and translation';
        regenerateBtn.style.marginLeft = '8px';
        regenerateBtn.addEventListener('click', (event) => handleWordRegenerateClick(event, rowIndex, columnIndex));
        
        // Add button to cell
        cell.appendChild(regenerateBtn);
    }
}

/**
 * Handle word regeneration button click
 * @param {Event} event - The click event
 * @param {number} rowIndex - The row index in the data table
 * @param {number} columnIndex - The column index in the data table
 */
async function handleWordRegenerateClick(event, rowIndex, columnIndex) {
    // Prevent the default action and propagation
    event.preventDefault();
    event.stopPropagation();
    
    console.log('Regenerating word info for row:', rowIndex);
    
    try {
        // Get the word from this row
        const word = appState.sheetData.values[rowIndex][columnIndex];
        
        if (!word) {
            showError('No word found in this cell');
            return;
        }
        
        // Disable the button during regeneration
        const button = event.target;
        button.disabled = true;
        button.textContent = 'Generating...';
          // Regenerate the word info
        const content = await regenerateWordInfo(word);
          // Update the table cells with the new content
        updateWordTableCells(rowIndex, content);
        
        // Note: Changes are only displayed in the table and NOT saved to Google Sheets
        
        // Re-enable the button
        button.disabled = false;
        button.textContent = '🔄';
        
        // Show success message
        showSuccess('Regenerated word pronunciation and translation successfully!');
    } catch (error) {
        showError(`Error regenerating word info: ${error.message}`);
        
        // Re-enable the button if there was an error
        const button = event.target;
        if (button) {
            button.disabled = false;
            button.textContent = '🔄';
        }
    }
}

/**
 * Save changes to Google Sheet after updating word info
 * NOTE: This function is not called automatically when regenerating word info.
 * It's available for manual use if needed.
 */
async function saveChanges() {
    try {
        if (!appState.spreadsheetId || !appState.sheetData.values) {
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
            console.log('Word info changes saved to Google Sheet');
        } else {
            showError('Failed to save word info changes: ' + response.statusText);
        }
    } catch (error) {
        showError('Error saving word info changes: ' + error.message);
        console.error('Error saving word info changes:', error);
    }
}

// Export functions for use in other modules
window.wordRegenerator = {
    addRegenerateButtonToWordCell,
    handleWordRegenerateClick,
    regenerateWordInfo,
    updateWordTableCells,
    saveChanges  // Exposing this function but not calling it automatically
};
