// Notes functionality
class Notes {    
    constructor() {
        this.notesBtn = document.getElementById('notesBtn');
        this.notesModal = document.getElementById('notesModal');
        this.closeNotesBtn = document.getElementById('closeNotesBtn');
                
        this.initEventListeners();
    }
    
    initEventListeners() {
        // Toggle notes modal when notes button is clicked
        if (this.notesBtn) {
            this.notesBtn.addEventListener('click', () => this.toggleNotesModal());
        }

        // Close notes modal when close button is clicked
        if (this.closeNotesBtn) {
            this.closeNotesBtn.addEventListener('click', () => this.hideNotesModal());
        }

        // Close notes modal when clicking outside
        document.addEventListener('click', (event) => {
            if (this.notesModal && 
                this.notesModal.classList.contains('visibility-managed') && 
                !this.notesModal.contains(event.target) && 
                event.target !== this.notesBtn &&
                !this.notesBtn.contains(event.target)) {
                this.hideNotesModal();
            }
        });
        
        // Close notes modal when pressing Escape key
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.notesModal && this.notesModal.classList.contains('visibility-managed')) {
                this.hideNotesModal();
            }
        });
    }

    toggleNotesModal() {
        if (this.notesModal) {
            this.notesModal.classList.toggle('visibility-managed');
        }
    }

    hideNotesModal() {
        if (this.notesModal) {
            this.notesModal.classList.remove('visibility-managed');
        }
    }

    showNotesModal() {
        if (this.notesModal) {
            this.notesModal.classList.add('visibility-managed');
        }
    }

    initElements() {
        // Create the modal content element first
        this.notesModalContent = document.createElement('div');
        this.notesModalContent.id = 'notesModalContent';
        this.notesModal.appendChild(this.notesModalContent);
        
        // Now update the content
        if (this.notesModalContent) {
            // Main structure for notes view
            this.notesModalContent.innerHTML = ` 
            <div class="notes-modal-body" id="notesModalBody">
                <!-- Main container div uses new class -->
                    <div class="main-container">
                        <!-- Header uses new class -->
                        <div class="app-header">
                                <!-- Button uses new classes -->
                                <button id="new-note-btn" class="button button-primary">
                                    <i class="fas fa-plus"></i> New Note
                                </button>
                            </div>
                        <!-- Pinned Notes Section -->
                        <!-- Removed transition/duration classes -->
                        <div id="pinned-section" class="mb-6">
                                <!-- Header uses new class and ID styles -->
                                <div id="pinned-header" class="section-header">
                                    <i class="fas fa-thumbtack"></i> <!-- Icon color/margin styled via CSS -->
                                    PINNED NOTES
                                </div>
                                <!-- Grid styles applied via ID -->
                                <div id="pinned-notes"></div>
                            </div>
    
                        <!-- All Notes Section -->
                        <div id="all-notes-section">
                                <!-- Header uses new class -->
                                <div class="section-header">ALL NOTES</div>
                                <!-- Grid styles applied via ID -->
                                <div id="notes-list"></div>
                            </div>
    
                        <!-- Note Editor Modal -->
                        <!-- Modal uses new overlay class and hidden for control -->
                        <div id="note-editor-modal" class="modal-overlay hidden">
                                <!-- Modal content uses new class -->
                                <div class="modal-content">
                                    <!-- Inner body uses new class -->
                                    <div class="modal-body">
                                        <!-- Title row uses new class -->
                                        <div class="modal-title-row">
                                            <!-- Input styled via ID -->
                                            <input id="note-title" type="text" placeholder="Note title">
                                            <!-- Header actions use new classes -->
                                            <div class="modal-header-actions">
                                                <button id="pin-note-btn" title="Pin Note" class="modal-action-button">
                                                    <i class="far fa-star"></i> <!-- Icon state managed by JS adding/removing 'fas' and parent button getting 'pinned' class -->
                                                </button>
                                                <button id="set-timer-btn" title="Set Reminder" class="modal-action-button">
                                                    <i class="far fa-clock"></i>
                                                </button>
                                            </div>
                                        </div>
    
                                        <!-- Editor tabs styled via ID -->
                                        <div id="editor-tabs">
                                            <!-- Tab buttons styled via CSS, JS toggles 'active' class -->
                                            <button id="preview-tab" class="active">Preview</button>
                                            <button id="edit-tab">Edit</button>
                                        </div>
    
                                        <!-- Preview styled via ID and markdown class, JS toggles 'hidden' -->
                                        <div id="preview-content" class="markdown-preview"></div>
                                        <!-- Textarea styled via ID, JS toggles 'hidden' -->
                                        <textarea id="note-content" class="hidden" placeholder="Type your note here... Standard Markdown syntax is supported!"></textarea>
    
                                        <!-- Timer display styled via ID, JS toggles 'hidden' -->
                                        <div id="timer-display" class="hidden">
                                            <i class="far fa-clock"></i>
                                            <span id="timer-text">No timer set</span>
                                        </div>
    
                                        <!-- Modal footer uses new class -->
                                        <div class="modal-footer">
                                            <!-- Delete button uses base button and danger text classes -->
                                            <button id="delete-note-btn" class="button button-danger-text">
                                                <i class="far fa-trash-alt"></i> Delete
                                            </button>
                                            <!-- Footer actions use new classes -->
                                            <div class="modal-footer-actions">
                                                <!-- Cancel button uses base and secondary classes -->
                                                <button id="cancel-edit-btn" class="button button-secondary">
                                                    Cancel
                                                </button>
                                                <!-- Save button uses base and primary classes -->
                                                <button id="save-note-btn" class="button button-primary">
                                                    Save
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
    
                        <!-- Timer Modal -->
                        <!-- Modal uses new overlay class and hidden for control -->
                        <div id="timer-modal" class="modal-overlay hidden">
                                <!-- Modal content uses new class and ID styles -->
                                <div class="modal-content">
                                    <!-- Content directly inside .modal-content for timer modal -->
                                    <!-- Title styled via CSS -->
                                    <h3>Set Reminder</h3>
                                    <!-- Input row uses new class -->
                                    <div class="timer-input-row">
                                        <!-- Select styled via ID -->
                                        <select id="timer-minutes" title="Select timer duration">
                                            <option value="1">1 minutes</option>
                                            <option value="5">5 minutes</option>
                                            <option value="10">10 minutes</option>
                                            <option value="15">15 minutes</option>
                                            <option value="30">30 minutes</option>
                                            <option value="60">1 hour</option>
                                            <option value="120">2 hours</option>
                                        </select>
                                        <!-- Span styled via CSS -->
                                        <span>from now</span>
                                    </div>
                                    <!-- Timer footer uses new class -->
                                    <div class="timer-footer">
                                        <!-- Cancel button uses base and secondary classes -->
                                        <button id="cancel-timer-btn" class="button button-secondary">
                                            Cancel
                                        </button>
                                        <!-- Confirm button uses base and primary classes -->
                                        <button id="confirm-timer-btn" class="button button-primary">
                                            Set Reminder
                                        </button>
                                    </div>
                                </div>
                            </div>
                    </div>
    
                
            </div>
            `;
        }
    }
}


// Initialize the Notes feature when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    const notesFeature = new Notes();
    notesFeature.initElements();
    // State management
    let notes = JSON.parse(localStorage.getItem('minimal-notes')) || [];
    let currentNoteId = null;
    let editingNote = false;
    let timers = {};
    let isPreviewMode = true;
    let draggedNoteElement = null;

    // DOM elements
    const notesList = document.getElementById('notes-list');
    const pinnedNotes = document.getElementById('pinned-notes');
    const pinnedHeader = document.getElementById('pinned-header');
    const pinnedSection = document.getElementById('pinned-section');
    const noteEditorModal = document.getElementById('note-editor-modal');
    const newNoteBtn = document.getElementById('new-note-btn');
    const saveNoteBtn = document.getElementById('save-note-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const deleteNoteBtn = document.getElementById('delete-note-btn');
    const pinNoteBtn = document.getElementById('pin-note-btn');
    const setTimerBtn = document.getElementById('set-timer-btn');
    const noteTitle = document.getElementById('note-title');
    const noteContent = document.getElementById('note-content');
    const previewContent = document.getElementById('preview-content');
    const previewTab = document.getElementById('preview-tab');
    const editTab = document.getElementById('edit-tab');
    const timerDisplay = document.getElementById('timer-display');
    const timerText = document.getElementById('timer-text');
    const timerModal = document.getElementById('timer-modal');
    const cancelTimerBtn = document.getElementById('cancel-timer-btn');
    const confirmTimerBtn = document.getElementById('confirm-timer-btn');
    const timerMinutes = document.getElementById('timer-minutes');

    // Configure marked
    marked.setOptions({
      breaks: true, gfm: true, pedantic: false, smartLists: true, smartypants: false
    });

    // --- Core Functions ---

    function saveToLocalStorage() {
        localStorage.setItem('minimal-notes', JSON.stringify(notes));
    }

    function renderNotes() {
        notesList.innerHTML = '';
        pinnedNotes.innerHTML = '';
        const pinned = notes.filter(note => note.pinned);
        const unpinned = notes.filter(note => !note.pinned);
        // Use style.display instead of classList for simple show/hide
        pinnedSection.style.display = pinned.length > 0 ? 'block' : 'none';
        pinnedHeader.style.display = pinned.length > 0 ? 'flex' : 'none';
        pinned.forEach(note => pinnedNotes.appendChild(createNoteElement(note)));
        unpinned.forEach(note => notesList.appendChild(createNoteElement(note)));
        makeSortable();
    }

    // --- Function: Create Note Element (Card) ---
    function createNoteElement(note) {
        const noteElement = document.createElement('div');
        // Use only the .note-card class now
        noteElement.className = 'note-card';
        noteElement.dataset.id = note.id;

        const { finalHtml, progress, hasCheckboxes } = parseMarkdown(note.content, note.id);

        // Adjusted structure to match new CSS classes
        noteElement.innerHTML = `
            <div class="note-card-header">
                <h3>${note.title || 'Untitled Note'}</h3>
                ${note.pinned ? '<i class="fas fa-thumbtack"></i>' : ''}
            </div>
            <div class="markdown-preview">
                ${finalHtml}
            </div>
            <div class="note-card-footer">
                ${note.timer ? `<div class="note-card-timer"><i class="far fa-clock"></i> ${formatTimerText(note.timer)}</div>` : ''}
                ${hasCheckboxes ? `
                    <div class="progress-display">
                        <div class="progress-bar-container">
                            <div class="progress-bar" style="width: ${progress}%"></div>
                        </div>
                        <span class="progress-text">${progress}%</span>
                    </div>
                ` : '<div class="progress-display" style="display: none;"></div>'}
            </div>
        `;

        noteElement.addEventListener('click', (e) => {
            // Don't open note if clicking on a link, checkbox, or any interactive element
            if (e.target.tagName === 'A' || 
                e.target.tagName === 'INPUT' || 
                e.target.closest('a') ||
                (e.target.tagName !== 'INPUT' && e.target.closest('.task-list-item-checkbox'))) {
                e.stopPropagation();
                return;
            }
            
            // Only if clicking on the note card itself or non-interactive elements
            if (e.target.tagName !== 'INPUT' || !e.target.classList.contains('task-list-item-checkbox')) {
                editNote(note.id);
            }
        });

       noteElement.querySelectorAll('.markdown-preview li > input[type="checkbox"]').forEach(checkbox => {
           checkbox.addEventListener('click', function(e) {
               e.stopPropagation();
               if(this.dataset.noteId && this.dataset.lineNumber !== undefined) {
                   toggleCheckboxState(this.dataset.noteId, this.dataset.lineNumber, this.checked);
               } else {
                   console.warn("Checkbox clicked without necessary data attributes", this);
               }
           });
       });

        return noteElement;
    }

    // --- Function: Parse Markdown (No changes needed here) ---
    function parseMarkdown(rawContent, noteId = null) {
        if (!rawContent) return { finalHtml: '', progress: 0, hasCheckboxes: false };
        const lines = rawContent.split('\n');
        let totalCheckboxes = 0;
        let checkedCheckboxes = 0;
        const checkboxLineNumbers = [];
        lines.forEach((line, index) => {
            const checklistMatch = line.match(/^(\s*-\s)\[(x|\s)\]/i);
            if (checklistMatch) {
                totalCheckboxes++;
                if (checklistMatch[2].toLowerCase() === 'x') checkedCheckboxes++;
                checkboxLineNumbers.push(index);
            }
        });
        let html = marked.parse(rawContent);
        if (totalCheckboxes > 0 && noteId) {
            try {
                const parser = new DOMParser(); const doc = parser.parseFromString(html, 'text/html');
                const checkboxesInHtml = doc.querySelectorAll('li > input[type="checkbox"]');
                if (checkboxesInHtml.length === checkboxLineNumbers.length) {
                    checkboxesInHtml.forEach((checkbox, index) => {
                        const originalLineNumber = checkboxLineNumbers[index];
                        checkbox.setAttribute('data-note-id', noteId);
                        checkbox.setAttribute('data-line-number', String(originalLineNumber));
                        checkbox.removeAttribute('disabled');
                    });
                    html = doc.body.innerHTML;
                } else {
                    console.warn(`Checkbox count mismatch! Source: ${checkboxLineNumbers.length}, HTML: ${checkboxesInHtml.length}. Note ${noteId}. Attributes missing.`,{ rawContent });
                    html = doc.body.innerHTML;
                    const tempDoc = parser.parseFromString(html, 'text/html');
                    tempDoc.querySelectorAll('li > input[type="checkbox][disabled]').forEach(cb => cb.removeAttribute('disabled'));
                    html = tempDoc.body.innerHTML;
                }
            } catch (error) { console.error("Error post-processing markdown HTML:", error); }
        } else if (html.includes('<input disabled="" type="checkbox">')) {
            try {
                const parser = new DOMParser(); const doc = parser.parseFromString(html, 'text/html');
                doc.querySelectorAll('input[type="checkbox][disabled]').forEach(cb => cb.removeAttribute('disabled'));
                html = doc.body.innerHTML;
            } catch (error) { console.error("Error removing disabled attr in fallback:", error); }
        }
        const progress = totalCheckboxes > 0 ? Math.round((checkedCheckboxes / totalCheckboxes) * 100) : 0;
        const hasCheckboxes = totalCheckboxes > 0;
        return { finalHtml: html, progress, hasCheckboxes };
    }

    // --- Function: Toggle Checkbox State (No changes needed here) ---
    function toggleCheckboxState(noteId, lineNumberStr, isChecked) {
        const lineNumber = parseInt(lineNumberStr);
        const noteIndex = notes.findIndex(n => n.id === noteId);
        if (noteIndex === -1) { console.error("Note not found:", noteId); return; }
        const note = notes[noteIndex];
        const lines = note.content.split('\n');
        let lineUpdated = false;
        if (isNaN(lineNumber) || lineNumber < 0 || lineNumber >= lines.length) {
            console.error(`Invalid line number ${lineNumberStr} for note ${noteId}`); return;
        }
        const line = lines[lineNumber];
        const match = line.match(/^(\s*-\s)\[(x|\s)\](.*)/i);
        if (match) {
            const prefix = match[1]; const currentState = match[2]; const restOfLine = match[3];
            const newState = isChecked ? 'x' : ' ';
            if (currentState.toLowerCase() !== newState) {
                lines[lineNumber] = `${prefix}[${newState}]${restOfLine}`;
                lineUpdated = true;
            }
        } else { console.warn(`Checkbox markdown (- [ ]) not found on line ${lineNumber} of note ${noteId}. Line: "${line}"`); }
        if (lineUpdated) {
            note.content = lines.join('\n'); note.updatedAt = new Date().toISOString(); notes[noteIndex] = note; saveToLocalStorage();
            const cardElement = document.querySelector(`.note-card[data-id="${noteId}"]`);
            if (cardElement) {
                const { progress: newProgress, hasCheckboxes: stillHasCheckboxes } = parseMarkdown(note.content);
                const progressContainer = cardElement.querySelector('.progress-display');
                const progressBar = progressContainer?.querySelector('.progress-bar'); // Select inner bar directly
                const progressText = progressContainer?.querySelector('.progress-text');
                if (progressContainer) {
                    if (stillHasCheckboxes && progressBar && progressText) {
                        progressBar.style.width = `${newProgress}%`; progressText.textContent = `${newProgress}%`; progressContainer.style.display = 'flex';
                    } else { progressContainer.style.display = 'none'; }
                }
            }
            if (currentNoteId === noteId && isPreviewMode && noteEditorModal && !noteEditorModal.classList.contains('hidden')) {
                 const { finalHtml: updatedModalHtml } = parseMarkdown(note.content, noteId);
                 previewContent.innerHTML = updatedModalHtml;
                 attachModalPreviewCheckboxListeners();
            }
        }
    }

    // --- Modal and Editing Functions ---

    function openEditor(note, startInEditMode = false) {
        isPreviewMode = !startInEditMode;
        noteTitle.value = note.title || ''; noteContent.value = note.content || '';
        updateEditorUI(note);
        // Use classList.remove to show modal
        noteEditorModal.classList.remove('hidden');
        if (startInEditMode) noteContent.focus(); else noteTitle.focus();
    }

    function createNewNote() {
        currentNoteId = Date.now().toString(); 
        editingNote = true;
        const newNote = {
            id: currentNoteId, title: '', content: '',
            pinned: false, timer: null, updatedAt: new Date().toISOString()
        };
        openEditor(newNote, true); // Start in edit mode
    }

    function editNote(id) {
        const note = notes.find(n => n.id === id); if (!note) return;
        currentNoteId = id; 
        editingNote = true; 
        openEditor(note);
    }

    function updateEditorUI(note) {
         const { finalHtml } = parseMarkdown(note.content, note.id);
         previewContent.innerHTML = finalHtml;
         attachModalPreviewCheckboxListeners();
         if (isPreviewMode) switchTab('preview', false); else switchTab('edit', false);

         // Update pin button state (icon and class)
         const pinIcon = pinNoteBtn.querySelector('i');
         if (note.pinned) {
             pinIcon.classList.remove('far'); pinIcon.classList.add('fas'); // Solid star
             pinNoteBtn.classList.add('pinned'); // Add class for CSS styling
         } else {
             pinIcon.classList.remove('fas'); pinIcon.classList.add('far'); // Outline star
             pinNoteBtn.classList.remove('pinned'); // Remove class
         }

         // Toggle timer display visibility using 'hidden' class
         timerDisplay.classList.toggle('hidden', !note.timer);
         if (note.timer) timerText.textContent = formatTimerText(note.timer);
    }

    function attachModalPreviewCheckboxListeners() {
        previewContent.querySelectorAll('li > input[type="checkbox"]').forEach(checkbox => {
            checkbox.removeEventListener('click', handleModalCheckboxClick);
            checkbox.addEventListener('click', handleModalCheckboxClick);
        });
    }

    function handleModalCheckboxClick(e) {
         e.stopPropagation();
         if(this.dataset.noteId && this.dataset.lineNumber !== undefined) {
              updateNoteContentFromPreview(); // Trigger update immediately
         } else {
              console.warn("Modal checkbox clicked without necessary data attributes", this);
         }
     }

    // --- Function: updateNoteContentFromPreview (No changes needed) ---
    function updateNoteContentFromPreview() {
         if (!currentNoteId) return;
         const checkboxesInPreview = Array.from(previewContent.querySelectorAll('input[type="checkbox"][data-line-number]'));
         let currentTextareaValue = noteContent.value; const lines = currentTextareaValue.split('\n'); let changed = false;
         checkboxesInPreview.forEach(checkbox => {
            if (checkbox.dataset.lineNumber === undefined) { console.warn("Preview checkbox missing data-line-number", checkbox); return; }
            const lineNumber = parseInt(checkbox.dataset.lineNumber); const isCheckedInPreview = checkbox.checked;
            if (!isNaN(lineNumber) && lineNumber >= 0 && lineNumber < lines.length) {
                const line = lines[lineNumber]; const match = line.match(/^(\s*-\s)\[(x|\s)\](.*)/i);
                if (match) {
                    const prefix = match[1]; const currentState = match[2]; const restOfLine = match[3]; const newState = isCheckedInPreview ? 'x' : ' ';
                    if (currentState.toLowerCase() !== newState) { lines[lineNumber] = `${prefix}[${newState}]${restOfLine}`; changed = true; }
                } else { console.warn(`Checkbox markdown (- [ ]) not found on line ${lineNumber} in textarea during preview update. Line: "${line}"`); }
            } else { console.warn(`Invalid line number ${checkbox.dataset.lineNumber} found on modal preview checkbox`); }
         });
         if (changed) {
            noteContent.value = lines.join('\n');
            const existingNoteIndex = notes.findIndex(n => n.id === currentNoteId);
            if (existingNoteIndex !== -1) { notes[existingNoteIndex].content = noteContent.value; }
         }
     }

    function switchTab(tab, updateFromTextarea = true) {
        if (tab === 'preview') {
            isPreviewMode = true;
            if (updateFromTextarea) {
                 const { finalHtml } = parseMarkdown(noteContent.value, currentNoteId);
                 previewContent.innerHTML = finalHtml;
                 attachModalPreviewCheckboxListeners();
            }
            // Use hidden class to toggle visibility
            previewContent.classList.remove('hidden'); noteContent.classList.add('hidden');
            // Use active class for styling tabs
            previewTab.classList.add('active'); editTab.classList.remove('active');
        } else { // 'edit'
            isPreviewMode = false;
            // Use hidden class to toggle visibility
            previewContent.classList.add('hidden'); noteContent.classList.remove('hidden');
            // Use active class for styling tabs
            editTab.classList.add('active'); previewTab.classList.remove('active');
            noteContent.focus();
        }
    }

    function saveNote() {
        const title = noteTitle.value.trim(); const content = noteContent.value;
        const existingNoteIndex = notes.findIndex(n => n.id === currentNoteId);
        const isPinned = pinNoteBtn.classList.contains('pinned'); // Check our CSS class

        if (existingNoteIndex !== -1) { // Update existing
            notes[existingNoteIndex].title = title;
            notes[existingNoteIndex].content = content;
            notes[existingNoteIndex].pinned = isPinned; // Update pinned status from button state
            notes[existingNoteIndex].updatedAt = new Date().toISOString();
            // Timer status already updated in memory when set
        } else { // Add new note
             const newNote = {
                id: currentNoteId, title, content, pinned: isPinned,
                timer: null, // Timer needs to be set explicitly via modal
                updatedAt: new Date().toISOString()
            };
            // Find the temporary note object if timer was set before save? (Current logic assumes timer is only set on existing notes)
            notes.unshift(newNote);
        }
        saveToLocalStorage(); renderNotes(); cancelEdit();
    }

    function cancelEdit() {
        editingNote = false; 
        currentNoteId = null;
        // Add hidden class to hide modal
        noteEditorModal.classList.add('hidden');
    }

    function deleteNote() {
        if (!currentNoteId || !confirm('Are you sure you want to delete this note?')) return;
        const noteIndex = notes.findIndex(n => n.id === currentNoteId);
        if (noteIndex !== -1) {
            const deletedNoteId = notes[noteIndex].id;
            notes.splice(noteIndex, 1); saveToLocalStorage(); renderNotes();
            if (timers[deletedNoteId]) { clearTimeout(timers[deletedNoteId]); delete timers[deletedNoteId]; }
        }
         cancelEdit();
    }

    function togglePin() {
         if (!currentNoteId) return;
         const noteIndex = notes.findIndex(n => n.id === currentNoteId);
         const isCurrentlyPinned = pinNoteBtn.classList.contains('pinned');
         const newState = !isCurrentlyPinned;

         // Update the button UI immediately
         const pinIcon = pinNoteBtn.querySelector('i');
         if (newState) {
             pinIcon.classList.remove('far'); pinIcon.classList.add('fas');
             pinNoteBtn.classList.add('pinned');
         } else {
             pinIcon.classList.remove('fas'); pinIcon.classList.add('far');
             pinNoteBtn.classList.remove('pinned');
         }

         // Update the note object in memory (will be saved on modal save)
         if (noteIndex !== -1) {
             notes[noteIndex].pinned = newState;
         }
         // Note: If this is a *new* note being created, the pinned state
         // will be read from the button's class during the saveNote function.
     }


    // --- Timer Functions --- (Logic unchanged, just modal show/hide)
    function showTimerModal() { if (!currentNoteId) return; 
    timerModal.classList.remove('hidden'); }
    function hideTimerModal() { timerModal.classList.add('hidden'); }
    function setTimer() {
         if (!currentNoteId) return;
         const minutes = parseInt(timerMinutes.value); const milliseconds = minutes * 60 * 1000;
         const alarmTime = new Date(Date.now() + milliseconds);
         const noteIndex = notes.findIndex(n => n.id === currentNoteId);

         if (noteIndex !== -1) {
             const note = notes[noteIndex]; note.timer = alarmTime.toISOString(); note.updatedAt = new Date().toISOString();
             // Update UI in the editor modal
             timerDisplay.classList.remove('hidden');
             timerText.textContent = formatTimerText(note.timer);
             // Clear existing timer and schedule new one
             if (timers[note.id]) clearTimeout(timers[note.id]);
             scheduleTimer(note.id, note.title, milliseconds);
         } else { console.warn("Cannot set timer: Note not found in memory."); }
         hideTimerModal();
         // Save happens when 'Save Note' is clicked in the main editor
     }
    function scheduleTimer(noteId, noteTitle, milliseconds) {
         timers[noteId] = setTimeout(() => {
             alert(`Reminder: ${noteTitle || 'Untitled Note'}`);
             const noteIndex = notes.findIndex(n => n.id === noteId);
             if (noteIndex !== -1) {
                 notes[noteIndex].timer = null; notes[noteIndex].updatedAt = new Date().toISOString();
                 saveToLocalStorage(); renderNotes();
                 // If the editor for this note is open, hide the timer display
                 if (currentNoteId === noteId && !noteEditorModal.classList.contains('hidden')) {
                     timerDisplay.classList.add('hidden');
                 }
             }
             delete timers[noteId];
         }, milliseconds);
     }
    function formatTimerText(isoString) { // No changes needed
         if (!isoString) return 'No timer set'; const now = new Date(); const alarmTime = new Date(isoString);
         const diffMs = alarmTime - now; if (diffMs <= 0) return 'Timer expired';
         const diffMins = Math.round(diffMs / (1000 * 60)); if (diffMins === 0) return 'Alarm in < 1 minute';
         if (diffMins === 1) return 'Alarm in 1 minute'; if (diffMins < 60) return `Alarm in ${diffMins} minutes`;
         const diffHours = Math.floor(diffMins / 60); const remainingMins = diffMins % 60;
         let text = `Alarm in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
         if (remainingMins > 0) text += ` ${remainingMins} minute${remainingMins !== 1 ? 's' : ''}`; return text;
    }

    // --- Drag and Drop --- (Logic unchanged, ensure opacity/class toggling works)
    function makeSortable() {
        document.querySelectorAll('.note-card').forEach(note => {
            note.draggable = true;
            note.addEventListener('dragstart', handleDragStart); note.addEventListener('dragend', handleDragEnd);
            note.addEventListener('dragenter', handleDragEnter); note.addEventListener('dragleave', handleDragLeave);
        });
        [pinnedNotes, notesList].forEach(container => {
            container.addEventListener('dragover', handleDragOver); container.addEventListener('drop', handleDrop);
        });
    }
    function handleDragStart(e) {
        if (e.target.tagName === 'INPUT' && e.target.type === 'checkbox') { 
            e.preventDefault(); 
            return; 
        }
        
        // Store the ID in dataTransfer for the drop handler
        e.dataTransfer.setData('text/plain', this.dataset.id);
        e.dataTransfer.effectAllowed = 'move';
        
        // Store a reference to the dragged element
        draggedNoteElement = this;
        
        // Set opacity with a small delay to avoid flicker
        setTimeout(() => this.style.opacity = '0.5', 0);
    }
    
    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        // Skip if no element is being dragged
        if (!draggedNoteElement) return;
        
        // Get the note data from our stored reference instead of dataTransfer
        const draggingId = draggedNoteElement.dataset.id;
        const noteData = notes.find(n => n.id === draggingId);
        if (!noteData) return;
        
        const container = this;
        const targetIsPinnedList = container.id === 'pinned-notes';
        
        // Don't allow dropping between pinned and unpinned sections
        if (noteData.pinned !== targetIsPinnedList) {
            e.dataTransfer.dropEffect = 'none';
            return;
        }
        
        const afterElement = getDragAfterElement(container, e.clientY);
        if (afterElement == null) {
            container.appendChild(draggedNoteElement);
        } else {
            container.insertBefore(draggedNoteElement, afterElement);
        }
    }
    
    function handleDragEnd(e) {
        // Reset opacity
        this.style.opacity = '1';
        
        // Clear the reference
        draggedNoteElement = null;
        
        // Remove any drag-over visual cues
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    }
    function handleDragEnter(e) { e.preventDefault(); /* Optional: this.classList.add('drag-over'); */ }
    function handleDragLeave(e) { /* Optional: this.classList.remove('drag-over'); */ }
   
    function handleDrop(e) {
        e.preventDefault();
        // Optional: Remove visual cue from container
        // this.classList.remove('drag-over');
        const droppedNoteId = e.dataTransfer.getData('text/plain'); if (!droppedNoteId) return;
        updateNoteOrder();
    }
    function getDragAfterElement(container, y) {
         // Exclude the element currently being dragged (identified by low opacity)
         const draggableElements = [...container.querySelectorAll('.note-card:not([style*="opacity: 0.5"])')];
         return draggableElements.reduce((closest, child) => {
             const box = child.getBoundingClientRect(); const offset = y - box.top - box.height / 2;
             if (offset < 0 && offset > closest.offset) return { offset: offset, element: child }; else return closest;
         }, { offset: Number.NEGATIVE_INFINITY }).element;
     }
    function updateNoteOrder() { // No changes needed
         const pinnedIds = Array.from(pinnedNotes.querySelectorAll('.note-card')).map(el => el.dataset.id);
         const unpinnedIds = Array.from(notesList.querySelectorAll('.note-card')).map(el => el.dataset.id);
         const orderedNotesMap = new Map(); notes.forEach(n => orderedNotesMap.set(n.id, n));
         const orderedNotes = [];
         pinnedIds.forEach(id => { if(orderedNotesMap.has(id)) orderedNotes.push(orderedNotesMap.get(id)); });
         unpinnedIds.forEach(id => { if(orderedNotesMap.has(id)) orderedNotes.push(orderedNotesMap.get(id)); });
         notes = orderedNotes; saveToLocalStorage();
     }

    // --- Initialization ---
    function checkExpiredTimers() { // No changes needed
        const now = Date.now(); let changed = false;
        notes.forEach(note => {
            if (note.timer) {
                const alarmTime = new Date(note.timer).getTime();
                if (alarmTime <= now) { note.timer = null; changed = true; }
                else { scheduleTimer(note.id, note.title, alarmTime - now); }
            }
        });
        if (changed) saveToLocalStorage();
    }

    // Initial setup
    checkExpiredTimers();
    renderNotes();

    // Event listeners (No changes needed, target the same IDs)
    newNoteBtn.addEventListener('click', createNewNote);
    saveNoteBtn.addEventListener('click', saveNote);
    cancelEditBtn.addEventListener('click', cancelEdit);
    deleteNoteBtn.addEventListener('click', deleteNote);
    pinNoteBtn.addEventListener('click', togglePin);
    setTimerBtn.addEventListener('click', showTimerModal);
    cancelTimerBtn.addEventListener('click', hideTimerModal);
    confirmTimerBtn.addEventListener('click', setTimer);
    previewTab.addEventListener('click', () => switchTab('preview'));
    editTab.addEventListener('click', () => switchTab('edit'));

});