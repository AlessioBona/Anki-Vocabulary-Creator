/**
 * Display sheet data in HTML table
 * @param {Array} data - 2D array of sheet data
 */
function displayData(data) {
    const dataSection = document.getElementById('data-section');
    const dataTable = document.getElementById('data-table');
    
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
    
    data[0].forEach((headerText, index) => {
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
        // Use the header row length to determine the number of columns
        const numColumns = data[0].length;

        for (let index = 0; index < numColumns; index++) {
            const td = document.createElement('td');
            // Check if the cell data exists, otherwise use empty string
            const cellText = data[i][index] || '';
            td.textContent = cellText;
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
            
            row.appendChild(td);
        }
        
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
    
    data[0].forEach((header, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = header;
        selectColumn.appendChild(option);
    });
    
    const filterTypeSelect = document.createElement('select');
    filterTypeSelect.id = 'filter-type';
    
    ['Is Empty', 'Is Not Empty'].forEach(type => {
        const option = document.createElement('option');
        option.value = type.toLowerCase().replace(' ', '-');
        option.textContent = type;
        filterTypeSelect.appendChild(option);
    });
    
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
    
    // Add "Create Sentences" button if OpenAI is configured
    if (window.sentenceRegenerator && window.openAIAPI && window.openAIAPI.isOpenAIConfigured()) {
        const aiActionsDiv = document.createElement('div');
        aiActionsDiv.className = 'ai-actions-container';
        aiActionsDiv.style.marginTop = '15px';
        
        const createSentencesBtn = document.createElement('button');
        createSentencesBtn.textContent = 'Create Sentences';
        createSentencesBtn.className = 'create-sentences-btn ai-action';
        createSentencesBtn.addEventListener('click', window.sentenceRegenerator.createSentencesForVisibleRows);
        
        aiActionsDiv.appendChild(createSentencesBtn);
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
        cell.style.display = visible ? '' : 'none';
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
