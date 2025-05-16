/**
 * Sentence Regeneration Module
 * Provides functionality to regenerate Chinese sentences and their translations
 */

/**
 * Generate a new Chinese sentence using the given word
 * @param {string} word - The Chinese word to include in the sentence
 * @param {number} rowIndex - The row index in the data table
 * @param {string} targetSentencePrefix - The prefix of the sentence being generated
 * @returns {Promise<string>} - The generated Chinese sentence
 */
async function generateChineseSentence(word, rowIndex, targetSentencePrefix) {
    if (!window.openAIAPI.isOpenAIConfigured()) {
        throw new Error('OpenAI API key not configured');
    }
    
    // Get existing sentences in this row to avoid duplicates
    let existingSentences = [];
    const sentencePrefixes = ['Sentence_01', 'Sentence_02'];
    
    // Check all sentence columns including the one we're regenerating
    sentencePrefixes.forEach(prefix => {
        const zhColumnName = `${prefix}_zh`;
        const zhColumnIndex = appState.columnIndexes[zhColumnName];
        
        if (zhColumnIndex !== undefined && appState.sheetData.values[rowIndex][zhColumnIndex]) {
            const sentence = appState.sheetData.values[rowIndex][zhColumnIndex];
            
            // For the target sentence, mark it as the current one
            if (prefix === targetSentencePrefix) {
                existingSentences.push(`${sentence} (current sentence to replace)`);
            } else {
                existingSentences.push(sentence);
            }
        }
    });
    
    // Build the prompt with instructions to avoid existing sentences
    let prompt = `Generate a natural-sounding sentence in simplified Chinese (HSK3-HSK4 level) using the word "${word}". 
                The sentence should be appropriate for a language learner studying at an intermediate level.`;
    
    if (existingSentences.length > 0) {
        prompt += `\nIMPORTANT: Create a sentence that is DIFFERENT from these existing sentences:
                ${existingSentences.map((s, i) => `${i+1}. ${s}`).join('\n')}`;
    }
    
    prompt += `\nOnly provide the sentence in Chinese characters, nothing else.`;
    
    try {
        const sentence = await window.openAIAPI.generateText(prompt, {
            model: 'gpt-4-turbo',
            systemPrompt: 'You are a Chinese language expert. Your responses should be in simplified Chinese characters only. Always create unique, diverse examples when asked for multiple sentences.',
            temperature: 0.8, // Slightly increased temperature for more variety
            maxTokens: 100
        });
        
        return stripOuterQuotes(sentence.trim());
    } catch (error) {
        console.error('Error generating Chinese sentence:', error);
        throw error;
    }
}

/**
 * Generate pinyin for a Chinese sentence
 * @param {string} chineseSentence - The Chinese sentence to transliterate
 * @returns {Promise<string>} - The pinyin transliteration
 */
async function generatePinyin(chineseSentence) {
    if (!window.openAIAPI.isOpenAIConfigured()) {
        throw new Error('OpenAI API key not configured');
    }
    
    const prompt = `Provide the pinyin transliteration for this Chinese sentence: "${chineseSentence}"
                    Only provide the pinyin with tone marks, nothing else.`;
    
    try {
        const pinyin = await window.openAIAPI.generateText(prompt, {
            model: 'gpt-4-turbo',
            systemPrompt: 'You are a Chinese language expert. Provide accurate pinyin transliterations with tone marks.',
            temperature: 0.3,
            maxTokens: 100
        });
        
        return stripOuterQuotes(pinyin.trim());
    } catch (error) {
        console.error('Error generating pinyin:', error);
        throw error;
    }
}

/**
 * Generate English translation for a Chinese sentence
 * @param {string} chineseSentence - The Chinese sentence to translate
 * @returns {Promise<string>} - The English translation
 */
async function generateEnglishTranslation(chineseSentence) {
    if (!window.openAIAPI.isOpenAIConfigured()) {
        throw new Error('OpenAI API key not configured');
    }
    
    const prompt = `Translate this Chinese sentence to natural English: "${chineseSentence}"
                    Only provide the English translation, nothing else.`;
    
    try {
        const translation = await window.openAIAPI.generateText(prompt, {
            model: 'gpt-4-turbo',
            systemPrompt: 'You are a translation expert. Provide accurate and natural-sounding translations from Chinese to English.',
            temperature: 0.3,
            maxTokens: 100
        });
        
        // Remove outer quotes if present
        return stripOuterQuotes(translation.trim());
    } catch (error) {
        console.error('Error generating English translation:', error);
        throw error;
    }
}

/**
 * Regenerate a complete sentence block (Chinese, Pinyin, and English)
 * @param {string} word - The Chinese word to use in the sentence
 * @param {number} rowIndex - The row index in the data table
 * @param {string} sentencePrefix - The prefix for the sentence columns ('Sentence_01' or 'Sentence_02')
 * @returns {Promise<Object>} - Object containing the generated content
 */
async function regenerateSentenceBlock(word, rowIndex, sentencePrefix) {
    try {
        // Show loading state
        const progressElement = document.createElement('div');
        progressElement.id = 'regenerate-progress';
        progressElement.className = 'progress-bar';
        progressElement.innerHTML = `<div class="progress-text">Generating Chinese sentence...</div><div class="progress-fill" style="width: 0%"></div>`;
        document.getElementById('data-table').prepend(progressElement);
        
        // Step 1: Generate Chinese sentence - pass rowIndex and sentencePrefix to avoid duplicates
        const chineseSentence = await generateChineseSentence(word, rowIndex, sentencePrefix);
        progressElement.innerHTML = `<div class="progress-text">Generating Pinyin...</div><div class="progress-fill" style="width: 33%"></div>`;
        
        // Step 2: Generate Pinyin
        const pinyin = await generatePinyin(chineseSentence);
        progressElement.innerHTML = `<div class="progress-text">Generating English translation...</div><div class="progress-fill" style="width: 66%"></div>`;
        
        // Step 3: Generate English translation
        const englishTranslation = await generateEnglishTranslation(chineseSentence);
        progressElement.innerHTML = `<div class="progress-text">Completed regeneration</div><div class="progress-fill" style="width: 100%"></div>`;
        
        // Remove progress element after delay
        setTimeout(() => {
            progressElement.remove();
        }, 2000);
        
        // Return the generated content
        return {
            chinese: chineseSentence,
            pinyin: pinyin,
            english: englishTranslation
        };
    } catch (error) {
        // Remove progress element if there's an error
        const progressElement = document.getElementById('regenerate-progress');
        if (progressElement) {
            progressElement.remove();
        }
        
        throw error;
    }
}

/**
 * Update the table cells with the regenerated content
 * @param {number} rowIndex - The row index in the data table
 * @param {string} sentencePrefix - The prefix for the sentence columns ('Sentence_01' or 'Sentence_02')
 * @param {Object} content - The content to update (chinese, pinyin, english)
 */
function updateTableCells(rowIndex, sentencePrefix, content) {
    // Update the internal data structure
    const zhColumnName = `${sentencePrefix}_zh`;
    const pyColumnName = `${sentencePrefix}_py`;
    const enColumnName = `${sentencePrefix}_en`;
    
    // Get column indexes
    const zhColumnIndex = appState.columnIndexes[zhColumnName];
    const pyColumnIndex = appState.columnIndexes[pyColumnName];
    const enColumnIndex = appState.columnIndexes[enColumnName];
    
    // Update the data in the appState
    if (zhColumnIndex !== undefined) {
        appState.sheetData.values[rowIndex][zhColumnIndex] = content.chinese;
    }
    
    if (pyColumnIndex !== undefined) {
        appState.sheetData.values[rowIndex][pyColumnIndex] = content.pinyin;
    }
    
    if (enColumnIndex !== undefined) {
        appState.sheetData.values[rowIndex][enColumnIndex] = content.english;
    }
    
    // Update the displayed table cells
    const table = document.getElementById('sheet-data-table');
    
    // IMPORTANT FIX: Since our rowIndex includes the header row (rowIndex 1 = first data row)
    // but tbody tr:nth-child() starts at 1 for the first row in tbody,
    // we need to use rowIndex directly as the child selector
    const row = table.querySelector(`tbody tr:nth-child(${rowIndex})`);
    
    if (row) {
        console.log(`Updating cells for row ${rowIndex}, ${sentencePrefix}`);
        
        if (zhColumnIndex !== undefined) {
            const zhCell = row.querySelector(`td[data-column-index="${zhColumnIndex}"]`);
            if (zhCell) {
                // Preserve the regenerate button if it exists
                const button = zhCell.querySelector('.regenerate-btn');
                zhCell.textContent = content.chinese;
                if (button) {
                    zhCell.appendChild(button);
                }
                console.log(`Updated Chinese cell: ${content.chinese}`);
            }
        }
        
        if (pyColumnIndex !== undefined) {
            const pyCell = row.querySelector(`td[data-column-index="${pyColumnIndex}"]`);
            if (pyCell) {
                pyCell.textContent = content.pinyin;
                console.log(`Updated Pinyin cell: ${content.pinyin}`);
            }
        }
        
        if (enColumnIndex !== undefined) {
            const enCell = row.querySelector(`td[data-column-index="${enColumnIndex}"]`);
            if (enCell) {
                enCell.textContent = content.english;
                console.log(`Updated English cell: ${content.english}`);
            }
        }
    } else {
        console.error(`Row not found for rowIndex ${rowIndex}`);
    }
}

/**
 * Handle regeneration button click
 * @param {Event} event - The click event
 * @param {number} rowIndex - The row index in the data table
 * @param {number} columnIndex - The column index in the data table
 */
async function handleRegenerateClick(event, rowIndex, columnIndex) {
    // Prevent the default action and propagation
    event.preventDefault();
    event.stopPropagation();
    
    console.log('Regenerating for row:', rowIndex, 'column:', columnIndex);
    
    try {
        const headerRow = appState.sheetData.values[0];
        const columnName = headerRow[columnIndex];
        
        // Extract the sentence prefix (Sentence_01 or Sentence_02)
        const sentencePrefix = columnName.match(/Sentence_0[12]/)?.[0];

        console.log('Regenerating for row:', rowIndex, 'column:', columnIndex, 'prefix:', sentencePrefix);

        if (!sentencePrefix) {
            showError('Invalid column name for regeneration');
            return;
        }
        
        // Get the word from this row
        const wordColumnIndex = appState.columnIndexes['Word'];
        
        if (wordColumnIndex === undefined) {
            showError('Cannot find the "Word" column');
            return;
        }
        
        const word = appState.sheetData.values[rowIndex][wordColumnIndex];
        
        if (!word) {
            showError('No word found in this row to generate a sentence');
            return;
        }
        
        // Disable the button during regeneration
        const button = event.target;
        button.disabled = true;
        button.textContent = 'Generating...';
        
        // Regenerate the sentence block
        const content = await regenerateSentenceBlock(word, rowIndex, sentencePrefix);
        
        // Update the table cells with the new content
        updateTableCells(rowIndex, sentencePrefix, content);
        
        // Re-enable the button
        button.disabled = false;
        button.textContent = '🔄';
        
        // Show success message
        showSuccess(`Regenerated ${sentencePrefix} successfully!`);
    } catch (error) {
        showError(`Error regenerating sentence: ${error.message}`);
        
        // Re-enable the button if there was an error
        const button = event.target;
        if (button) {
            button.disabled = false;
            button.textContent = '🔄';
        }
    }
}

/**
 * Add regeneration buttons to Chinese sentence cells
 * @param {HTMLTableCellElement} cell - The table cell to add a button to
 * @param {number} rowIndex - The row index in the data array
 * @param {number} columnIndex - The column index in the data array
 * @param {string} columnName - The name of the column
 */
function addRegenerateButtonToCell(cell, rowIndex, columnIndex, columnName) {
    // Only add to Sentence_01_zh and Sentence_02_zh cells
    if (columnName === 'Sentence_01_zh' || columnName === 'Sentence_02_zh') {
        // Create regenerate button
        const regenerateBtn = document.createElement('button');
        regenerateBtn.className = 'regenerate-btn';
        regenerateBtn.textContent = '🔄';
        regenerateBtn.title = `Regenerate ${columnName}`;
        regenerateBtn.style.marginLeft = '8px';
        regenerateBtn.addEventListener('click', (event) => handleRegenerateClick(event, rowIndex, columnIndex));
        
        // Add button to cell
        cell.appendChild(regenerateBtn);
    }
}

/**
 * Create sentences in all visible rows
 * Uses the word in each row to generate sentences
 */
async function createSentencesForVisibleRows() {
    if (!window.openAIAPI.isOpenAIConfigured()) {
        showError('OpenAI API key not configured');
        return;
    }
    
    try {
        const table = document.getElementById('sheet-data-table');
        const visibleRows = table.querySelectorAll('tbody tr:not([style*="display: none"])');
        
        if (visibleRows.length === 0) {
            showError('No visible rows to process');
            return;
        }
        
        // Get column indexes
        const wordColumnIndex = appState.columnIndexes['Word'];
        
        if (wordColumnIndex === undefined) {
            showError('Cannot find the "Word" column');
            return;
        }
        
        // Create progress element
        const progressElement = document.createElement('div');
        progressElement.id = 'batch-progress';
        progressElement.className = 'progress-bar';
        progressElement.innerHTML = `<div class="progress-text">Processing 0/${visibleRows.length} rows</div><div class="progress-fill" style="width: 0%"></div>`;
        document.getElementById('data-table').prepend(progressElement);
        
        // Process each visible row
        for (let i = 0; i < visibleRows.length; i++) {
            const row = visibleRows[i];            // Get the index of this row in the tbody (0-based index)
            // visibleRows[i] is the i-th visible row in the tbody (0-based index)
            // To convert to our data array index, we add 1 to account for the header row at index 0
            const dataRowIndex = i + 1;

            if (isNaN(dataRowIndex) || dataRowIndex < 1) continue;
            
            const word = appState.sheetData.values[dataRowIndex][wordColumnIndex];
            
            if (!word) continue;
            
            // Update progress
            const percentage = Math.round(((i) / visibleRows.length) * 100);
            progressElement.innerHTML = `<div class="progress-text">Processing row ${i+1}/${visibleRows.length}</div><div class="progress-fill" style="width: ${percentage}%"></div>`;
            
            // Regenerate first sentence
            try {
                const content1 = await regenerateSentenceBlock(word, dataRowIndex, 'Sentence_01');
                updateTableCells(dataRowIndex, 'Sentence_01', content1);
            } catch (error) {
                console.error(`Error regenerating Sentence_01 for row ${dataRowIndex}:`, error);
                // Continue with next sentence
            }
            
            // Regenerate second sentence
            try {
                const content2 = await regenerateSentenceBlock(word, dataRowIndex, 'Sentence_02');
                updateTableCells(dataRowIndex, 'Sentence_02', content2);
            } catch (error) {
                console.error(`Error regenerating Sentence_02 for row ${dataRowIndex}:`, error);
                // Continue with next row
            }
        }
        
        // Complete progress
        progressElement.innerHTML = `<div class="progress-text">Completed ${visibleRows.length}/${visibleRows.length}</div><div class="progress-fill" style="width: 100%"></div>`;
        
        // Remove progress bar after delay
        setTimeout(() => {
            progressElement.remove();
        }, 3000);
        
        // Show success message
        showSuccess('Sentence generation completed for all visible rows!');
        
    } catch (error) {
        showError(`Error in batch sentence generation: ${error.message}`);
        
        // Remove progress element if there's an error
        const progressElement = document.getElementById('batch-progress');
        if (progressElement) {
            progressElement.remove();
        }
    }
}

/**
 * Remove matching leading and trailing quotes (single or double) from a string.
 * Only removes if both are present and matching.
 * @param {string} str
 * @returns {string}
 */
function stripOuterQuotes(str) {
    return str.replace(/^\s*(['"])(.*)\1\s*$/, '$2');
}

// Export the functions
window.sentenceRegenerator = {
    addRegenerateButtonToCell,
    handleRegenerateClick,
    createSentencesForVisibleRows,
    regenerateSentenceBlock,
    updateTableCells
};
