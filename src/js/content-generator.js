/**
 * Content Generator Module
 * Coordinates the regeneration of all content (words and sentences) for visible rows
 */

/**
 * Regenerate all content (word info and sentences) for all visible rows
 * This function coordinates the calls to word and sentence regeneration functions
 * in the correct order, waiting for each step to complete before proceeding.
 */
async function regenerateAllContent() {
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
        
        // Create main progress element
        const progressElement = document.createElement('div');
        progressElement.id = 'all-content-progress';
        progressElement.className = 'progress-bar main-progress';
        progressElement.innerHTML = `<div class="progress-text">Starting content generation for ${visibleRows.length} rows...</div><div class="progress-fill" style="width: 0%"></div>`;
        document.getElementById('data-table').prepend(progressElement);
        
        // Step 1: Regenerate word info for all visible rows (33%)
        progressElement.innerHTML = `<div class="progress-text">Step 1/3: Regenerating word information...</div><div class="progress-fill" style="width: 0%"></div>`;
        
        const wordRegenerationSuccess = await window.wordRegenerator.regenerateWordInfoForVisibleRows();
        if (!wordRegenerationSuccess) {
            throw new Error('Word regeneration failed');
        }
        
        // Step 2: Regenerate Sentence_01 for all visible rows (66%)
        progressElement.innerHTML = `<div class="progress-text">Step 2/3: Regenerating first sentences...</div><div class="progress-fill" style="width: 33%"></div>`;
        
        // Since we want to call the internal function and not the exported one,
        // we'll need to handle the sentence generation ourselves based on the existing pattern
        await regenerateSentencesForRows(visibleRows, 'Sentence_01');
        
        // Step 3: Regenerate Sentence_02 for all visible rows (100%)
        progressElement.innerHTML = `<div class="progress-text">Step 3/3: Regenerating second sentences...</div><div class="progress-fill" style="width: 66%"></div>`;
        
        await regenerateSentencesForRows(visibleRows, 'Sentence_02');
        
        // Complete progress
        progressElement.innerHTML = `<div class="progress-text">All content regenerated successfully!</div><div class="progress-fill" style="width: 100%"></div>`;
        
        // Remove progress bar after delay
        setTimeout(() => {
            progressElement.remove();
        }, 3000);
        
        // Show success message
        showSuccess('All content regeneration completed for all visible rows!');
        
    } catch (error) {
        showError(`Error in content regeneration: ${error.message}`);
        
        // Remove progress element if there's an error
        const progressElement = document.getElementById('all-content-progress');
        if (progressElement) {
            progressElement.remove();
        }
    }
}

/**
 * Helper function to regenerate sentences for specific rows
 * @param {NodeListOf<HTMLTableRowElement>} visibleRows - The visible rows to process
 * @param {string} sentencePrefix - The sentence prefix ('Sentence_01' or 'Sentence_02')
 * @returns {Promise<void>}
 */
async function regenerateSentencesForRows(visibleRows, sentencePrefix) {
    try {
        // Get the Word column index
        const wordColumnIndex = appState.columnIndexes['Word'];
        if (wordColumnIndex === undefined) {
            throw new Error('Cannot find "Word" column');
        }
        
        // Process each visible row
        for (let i = 0; i < visibleRows.length; i++) {
            const row = visibleRows[i];
            const rowIndex = parseInt(row.rowIndex);
            
            // Table rows include the header row, so we need to adjust the index
            const dataRowIndex = rowIndex;
            
            // Get the word from this row
            const word = appState.sheetData.values[dataRowIndex][wordColumnIndex];
            
            if (!word) continue;
            
            // Update the main progress element with additional info
            const progressElement = document.getElementById('all-content-progress');
            if (progressElement) {
                const baseProgress = sentencePrefix === 'Sentence_01' ? 33 : 66;
                const percentage = baseProgress + Math.round(((i) / visibleRows.length) * 33);
                progressElement.innerHTML = `<div class="progress-text">Processing ${sentencePrefix} for row ${i+1}/${visibleRows.length}</div><div class="progress-fill" style="width: ${percentage}%"></div>`;
            }
            
            // Regenerate sentence
            try {
                const content = await window.sentenceRegenerator.regenerateSentenceBlock(word, dataRowIndex, sentencePrefix);
                window.sentenceRegenerator.updateTableCells(dataRowIndex, sentencePrefix, content);
            } catch (error) {
                console.error(`Error regenerating ${sentencePrefix} for row ${dataRowIndex}:`, error);
                // Continue with next row
            }
        }
        
    } catch (error) {
        console.error(`Error in batch sentence regeneration for ${sentencePrefix}:`, error);
        throw error;
    }
}

// Export functions for use in other modules
window.contentGenerator = {
    regenerateAllContent
};
