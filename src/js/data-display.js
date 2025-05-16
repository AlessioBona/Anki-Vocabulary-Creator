/**
 * Display sheet data in HTML table
 * @param {Array} data - 2D array of sheet data
 */
function displayData(data) {
    const dataSection = document.getElementById('data-section');
    const dataTable = document.getElementById('data-table');
    
    // Get the actual header row from the sheet
    const sheetHeader = data[0];
    // Build an array of indexes for the desired display order
    const displayOrder = EXPECTED_COLUMNS
        .map(col => sheetHeader.indexOf(col))
        .filter(idx => idx !== -1); // Only include columns that exist in the sheet
    
    // Clear existing table
    dataTable.innerHTML = '';
    
    // Create a container for column filters with column groups
    const filterContainer = document.createElement('div');
    filterContainer.className = 'filter-container';
    filterContainer.innerHTML = '<h3>Column Visibility</h3>';
    
    // Create container for column group checkboxes
    const groupContainer = document.createElement('div');
    groupContainer.className = 'group-container';
    
    // Create column group toggle buttons
    Object.entries(COLUMN_GROUPS).forEach(([groupName, columns]) => {
        const groupButton = document.createElement('button');
        groupButton.textContent = `Toggle ${groupName.charAt(0).toUpperCase() + groupName.slice(1)}`;
        groupButton.className = 'group-toggle';
        groupButton.dataset.group = groupName;
        
        groupButton.addEventListener('click', () => {
            // Check if all columns in this group are visible
            const columnsInGroup = columns.filter(col => appState.columnIndexes.hasOwnProperty(col));
            const tableHeaders = document.querySelectorAll('#sheet-data-table th');
            
            // Determine if all columns in this group are currently visible
            const allVisible = columnsInGroup.every(col => {
                const index = appState.columnIndexes[col];
                const header = [...tableHeaders].find(th => parseInt(th.dataset.columnIndex) === index);
                return header && header.style.display !== 'none';
            });
            
            // Toggle visibility of all columns in this group
            columnsInGroup.forEach(col => {
                if (appState.columnIndexes.hasOwnProperty(col)) {
                    const checkbox = document.getElementById(`col-${appState.columnIndexes[col]}`);
                    if (checkbox) {
                        checkbox.checked = !allVisible;
                        toggleColumnVisibility(appState.columnIndexes[col], !allVisible);
                    }
                }
            });
        });
        
        groupContainer.appendChild(groupButton);
    });
    
    filterContainer.appendChild(groupContainer);
    
    // Create individual column checkboxes
    const checkboxContainer = document.createElement('div');
    checkboxContainer.className = 'checkbox-container';
    
    data[0].forEach((header, index) => {
        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = 'checkbox-item';
        
        // Add special class if the column belongs to a predefined group
        const columnGroup = getColumnGroup(header);
        if (columnGroup) {
            checkboxDiv.classList.add(`group-${columnGroup}`);
        }
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `col-${index}`;
        checkbox.checked = true;
        checkbox.addEventListener('change', () => toggleColumnVisibility(index, checkbox.checked));
        
        const label = document.createElement('label');
        label.htmlFor = `col-${index}`;
        label.textContent = header;
        
        checkboxDiv.appendChild(checkbox);
        checkboxDiv.appendChild(label);
        checkboxContainer.appendChild(checkboxDiv);
    });
    
    filterContainer.appendChild(checkboxContainer);
    dataTable.appendChild(filterContainer);
    
    // Create the table
    const table = document.createElement('table');
    table.id = 'sheet-data-table';
    
    // Create header row
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    // Add row number header before other headers
    const rowNumberHeader = document.createElement('th');
    rowNumberHeader.textContent = '#';
    rowNumberHeader.className = 'row-number-header';
    rowNumberHeader.style.width = '40px'; // Make it narrow
    headerRow.appendChild(rowNumberHeader);
    
    displayOrder.forEach(index => {
        const headerText = sheetHeader[index];
        const th = document.createElement('th');
        th.textContent = headerText;
        th.dataset.columnIndex = index;
        
        // Add classes based on column group
        const columnGroup = getColumnGroup(headerText);
        if (columnGroup) {
            th.classList.add(`group-${columnGroup}`);
        }
        
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create table body
    const tbody = document.createElement('tbody');
    
    for (let i = 1; i < data.length; i++) {
        const row = document.createElement('tr');
        
        // Add row number cell first
        const rowNumberCell = document.createElement('td');
        rowNumberCell.textContent = i; // 1-based row number (matches data structure)
        rowNumberCell.className = 'row-number';
        rowNumberCell.style.backgroundColor = '#2a2a2a';
        rowNumberCell.style.color = '#aaa';
        rowNumberCell.style.textAlign = 'center';
        rowNumberCell.style.fontWeight = 'bold';
        rowNumberCell.style.userSelect = 'none'; // Prevent selection for better usability
        row.appendChild(rowNumberCell);
        
        // Continue with your existing row cells
        displayOrder.forEach(index => {
            const td = document.createElement('td');
            // Check if the cell data exists, otherwise use empty string
            let cellText = data[i][index] || '';
            td.dataset.columnIndex = index;
            td.addEventListener('dblclick', () => makeEditable(td, i, index));
            
            // Add classes based on column group
            const columnGroup = getColumnGroup(data[0][index]);
            if (columnGroup) {
                td.classList.add(`group-${columnGroup}`);
            }
            
            // Add regenerate buttons to Chinese sentence cells if sentenceRegenerator is available
            if (window.sentenceRegenerator && window.openAIAPI && window.openAIAPI.isOpenAIConfigured()) {
                const columnName = data[0][index];
                window.sentenceRegenerator.addRegenerateButtonToCell(td, i, index, columnName);
            }
            
            // Add regenerate buttons to Word cells if wordRegenerator is available
            if (window.wordRegenerator && window.openAIAPI && window.openAIAPI.isOpenAIConfigured()) {
                const columnName = data[0][index];
                window.wordRegenerator.addRegenerateButtonToWordCell(td, i, index, columnName);
            }
            
            // Add PLAY/REGENERATE buttons for audio columns if file is in mp3Files
            const colName = data[0][index];
            if ((colName === 'Sentence_01_audio' || colName === 'Sentence_02_audio') && window.mp3Files && Array.isArray(window.mp3Files)) {
                // Extract filename from [sound:filename.mp3]
                const match = cellText.match(/\[sound:(.+?)\]/);
                const filename = match ? match[1] : null;
                const fileObj = filename && window.mp3Files.find(f => f.filename === filename);
                if (fileObj) {
                    // PLAY button
                    const playBtn = document.createElement('button');
                    playBtn.textContent = '▶';
                    playBtn.title = 'Play audio';
                    playBtn.className = 'audio-play-btn';
                    playBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const url = URL.createObjectURL(fileObj.blob);
                        const audio = new Audio(url);
                        audio.play();
                        audio.onended = () => URL.revokeObjectURL(url);
                    });
                    td.appendChild(playBtn);
                    // REGENERATE button
                    const regenBtn = document.createElement('button');
                    regenBtn.textContent = '⟳';
                    regenBtn.title = 'Regenerate audio';
                    regenBtn.className = 'audio-regen-btn';
                    regenBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        if (!window.generateTTSForCell) return;
                        regenBtn.disabled = true;
                        regenBtn.textContent = '...';
                        await window.generateTTSForCell(i, index, filename, td, regenBtn);
                        regenBtn.disabled = false;
                        regenBtn.textContent = '⟳';
                    });
                    td.appendChild(regenBtn);
                }
            }
            // Always show the [sound:filename.mp3] tag as text
            td.appendChild(document.createTextNode(cellText));
            row.appendChild(td);
        });
        
        tbody.appendChild(row);
    }
    
    table.appendChild(tbody);
    dataTable.appendChild(table);
    
    // Create a container for filtering rows
    const rowFilterContainer = document.createElement('div');
    rowFilterContainer.className = 'row-filter-container';
    rowFilterContainer.innerHTML = '<h3>Filter Rows</h3>';
    
    const rowFilterForm = document.createElement('form');
    const selectColumn = document.createElement('select');
    selectColumn.id = 'filter-column';
    
    displayOrder.forEach(index => {
        const header = sheetHeader[index];
        const option = document.createElement('option');
        option.value = index;
        option.textContent = header;
        selectColumn.appendChild(option);
    });
    
    const filterTypeSelect = document.createElement('select');
    filterTypeSelect.id = 'filter-type';

    // Check localStorage for previously selected filter column and type
    const storedFilterColumn = localStorage.getItem('filter-column');
    const storedFilterType = localStorage.getItem('filter-type');
    if (storedFilterColumn !== null) selectColumn.value = storedFilterColumn;
    if (storedFilterType !== null) filterTypeSelect.value = storedFilterType;
    
    ['Is Empty', 'Is Not Empty'].forEach(type => {
        const option = document.createElement('option');
        option.value = type.toLowerCase().replace(' ', '-');
        option.textContent = type;
        filterTypeSelect.appendChild(option);
    });
    filterTypeSelect.value = 'is-not-empty'; // Set default here
    
    const applyFilterButton = document.createElement('button');
    applyFilterButton.textContent = 'Apply Filter';
    applyFilterButton.type = 'button';
    applyFilterButton.addEventListener('click', applyRowFilter);
    
    const clearFilterButton = document.createElement('button');
    clearFilterButton.textContent = 'Clear Filter';
    clearFilterButton.type = 'button';
    clearFilterButton.addEventListener('click', clearRowFilter);
      rowFilterForm.appendChild(document.createTextNode('Show rows where '));
    rowFilterForm.appendChild(selectColumn);
    rowFilterForm.appendChild(document.createTextNode(' '));
    rowFilterForm.appendChild(filterTypeSelect);
    rowFilterForm.appendChild(document.createTextNode(' '));
    rowFilterForm.appendChild(applyFilterButton);
    rowFilterForm.appendChild(document.createTextNode(' '));
    rowFilterForm.appendChild(clearFilterButton);
    
    rowFilterContainer.appendChild(rowFilterForm);
    
    // Add row range filtering
    const rangeFilterDiv = document.createElement('div');
    rangeFilterDiv.className = 'range-filter';
    rangeFilterDiv.style.marginTop = '10px';

    const rangeFilterLabel = document.createElement('label');
    rangeFilterLabel.textContent = 'Row range: ';

    const startRowInput = document.createElement('input');
    startRowInput.type = 'number';
    startRowInput.id = 'start-row';
    startRowInput.min = '1';
    startRowInput.placeholder = 'From';
    startRowInput.style.width = '70px';

    const rangeToText = document.createTextNode(' to ');

    const endRowInput = document.createElement('input');
    endRowInput.type = 'number';
    endRowInput.id = 'end-row';
    endRowInput.min = '1';
    endRowInput.placeholder = 'To';
    endRowInput.style.width = '70px';

    // Check localStorage for previously selected row range
    const storedStartRow = localStorage.getItem('start-row');
    const storedEndRow = localStorage.getItem('end-row');
    if (storedStartRow !== null) startRowInput.value = storedStartRow;
    if (storedEndRow !== null) endRowInput.value = storedEndRow;

    const applyRangeButton = document.createElement('button');
    applyRangeButton.textContent = 'Apply Range';
    applyRangeButton.type = 'button';
    applyRangeButton.addEventListener('click', applyRowRangeFilter);

    rangeFilterDiv.appendChild(rangeFilterLabel);
    rangeFilterDiv.appendChild(startRowInput);
    rangeFilterDiv.appendChild(rangeToText);
    rangeFilterDiv.appendChild(endRowInput);
    rangeFilterDiv.appendChild(document.createTextNode(' '));
    rangeFilterDiv.appendChild(applyRangeButton);

    rowFilterForm.appendChild(rangeFilterDiv);
    
    // Add AI action buttons if OpenAI is configured
    if (window.openAIAPI && window.openAIAPI.isOpenAIConfigured()) {
        const aiActionsDiv = document.createElement('div');
        aiActionsDiv.className = 'ai-actions-container';
        aiActionsDiv.style.marginTop = '15px';
        
        if (window.sentenceRegenerator) {
            const createSentencesBtn = document.createElement('button');
            createSentencesBtn.textContent = 'Create Sentences';
            createSentencesBtn.className = 'create-sentences-btn ai-action';
            createSentencesBtn.addEventListener('click', window.sentenceRegenerator.createSentencesForVisibleRows);
            aiActionsDiv.appendChild(createSentencesBtn);
        }
        
        if (window.contentGenerator) {
            const createAllContentBtn = document.createElement('button');
            createAllContentBtn.textContent = 'Create All Content';
            createAllContentBtn.className = 'create-all-content-btn ai-action';
            createAllContentBtn.title = 'Regenerate word information and sentences for all visible rows';
            createAllContentBtn.addEventListener('click', window.contentGenerator.regenerateAllContent);
            aiActionsDiv.appendChild(createAllContentBtn);
        }
        
        rowFilterContainer.appendChild(aiActionsDiv);

    }
    
    dataTable.appendChild(rowFilterContainer);
    
    // Add save and download buttons
    const saveButtonContainer = document.createElement('div');
    saveButtonContainer.className = 'save-button-container';

    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save Changes';
    saveButton.addEventListener('click', saveChanges);

    const downloadCsvButton = document.createElement('button');
    downloadCsvButton.textContent = 'Download CSV';
    downloadCsvButton.classList.add('download-button');
    downloadCsvButton.addEventListener('click', downloadCsv);

    saveButtonContainer.appendChild(saveButton);
    saveButtonContainer.appendChild(downloadCsvButton);
    dataTable.appendChild(saveButtonContainer);
    dataSection.classList.remove('hidden');
    
    setTimeout(() => {
        if (storedFilterColumn !== null && storedFilterType !== null && window.applyRowFilter) {
            window.applyRowFilter();
        }
        if ((storedStartRow || storedEndRow) && window.applyRowRangeFilter) {
            window.applyRowRangeFilter();
        }
    }, 0);
    
    dataTable.appendChild(rowFilterContainer);
}

/**
 * Toggle column visibility
 * @param {number} columnIndex - Index of column to toggle
 * @param {boolean} visible - Whether column should be visible
 */
function toggleColumnVisibility(columnIndex, visible) {
    const table = document.getElementById('sheet-data-table');
    const cells = table.querySelectorAll(`th[data-column-index="${columnIndex}"], td[data-column-index="${columnIndex}"]`);
    
    cells.forEach(cell => {
        // Skip row number cells
        if (!cell.classList.contains('row-number')) {
            cell.style.display = visible ? '' : 'none';
        }
    });
}

/**
 * Make a cell editable on double-click
 * @param {HTMLElement} cell - The table cell to make editable
 * @param {number} rowIndex - The row index in the data array
 * @param {number} columnIndex - The column index in the data array
 */
function makeEditable(cell, rowIndex, columnIndex) {
    // Save original content without the button
    const regenerateBtn = cell.querySelector('.regenerate-btn');
    if (regenerateBtn) {
        regenerateBtn.remove(); // Temporarily remove button
    }
    
    const originalContent = cell.textContent;
    
    // Create an input element
    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalContent;
    input.style.width = '100%';
    
    // Replace cell content with input
    cell.textContent = '';
    cell.appendChild(input);
    input.focus();
    
    // Handle input blur to save changes
    input.addEventListener('blur', () => {
        cell.textContent = input.value;
        
        // Update the stored data
        appState.sheetData.values[rowIndex][columnIndex] = input.value;
        
        // Re-add regenerate button if this cell had one
        if (regenerateBtn) {
            cell.appendChild(regenerateBtn);
        }
    });
    
    // Handle Enter key
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            input.blur();
        } else if (event.key === 'Escape') {
            cell.textContent = originalContent;
            
            // Re-add regenerate button if this cell had one
            if (regenerateBtn) {
                cell.appendChild(regenerateBtn);
            }
        }
    });
}


