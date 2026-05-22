// ===== NOTES MODULE =====
// Manages study notes with CRUD operations, search, and Firebase sync

const NotesManager = (function() {
    'use strict';

    let notes = [];
    let editingNoteId = null;
    let searchTerm = '';
    let activeTagFilter = 'all';

    // DOM Elements
    let elements = {};

    // === Initialization ===
    function init() {
        cacheElements();
        bindEvents();
        loadNotes();
    }

    function cacheElements() {
        elements = {
            notesList: document.getElementById('notesList'),
            notesEmptyState: document.getElementById('notesEmptyState'),
            searchInput: document.getElementById('notesSearchInput'),
            addNoteBtn: document.getElementById('addNoteBtn'),
            noteTitleInput: document.getElementById('noteTitleInput'),
            noteContentInput: document.getElementById('noteContentInput'),
            noteSubjectSelect: document.getElementById('noteSubjectSelect'),
            noteTagsInput: document.getElementById('noteTagsInput'),
            saveNoteBtn: document.getElementById('saveNoteBtn'),
            cancelNoteBtn: document.getElementById('cancelNoteBtn'),
            noteForm: document.getElementById('noteForm'),
            addNoteSection: document.getElementById('addNoteSection'),
            tagFilter: document.getElementById('notesTagFilter')
        };
    }

    function bindEvents() {
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', handleSearch);
        }

        if (elements.addNoteBtn) {
            elements.addNoteBtn.addEventListener('click', showNoteForm);
        }

        if (elements.saveNoteBtn) {
            elements.saveNoteBtn.addEventListener('click', saveNote);
        }

        if (elements.cancelNoteBtn) {
            elements.cancelNoteBtn.addEventListener('click', cancelNoteForm);
        }
    }

    // === Load Notes from Firebase ===
    function loadNotes() {
        const user = firebase.auth().currentUser;
        if (!user) return;

        firebase.firestore().collection('users').doc(user.uid).collection('notes')
            .orderBy('createdAt', 'desc')
            .onSnapshot((snapshot) => {
                notes = [];
                snapshot.forEach(doc => {
                    notes.push({ id: doc.id, ...doc.data() });
                });
                renderNotes();
            }, (error) => {
                console.error('Error loading notes:', error);
            });
    }

    // === Render Notes ===
    function renderNotes() {
        if (!elements.notesList || !elements.notesEmptyState) return;

        const filteredNotes = notes.filter(note => {
            // Apply tag filter
            if (activeTagFilter !== 'all') {
                const noteTags = note.tags || [];
                if (!noteTags.includes(activeTagFilter)) return false;
            }

            // Apply search filter
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                const hasTitleMatch = note.title.toLowerCase().includes(searchLower);
                const hasContentMatch = note.content.toLowerCase().includes(searchLower);
                const hasSubjectMatch = note.subject && note.subject.toLowerCase().includes(searchLower);
                const hasTagMatch = note.tags && note.tags.some(tag => tag.toLowerCase().includes(searchLower));
                
                return hasTitleMatch || hasContentMatch || hasSubjectMatch || hasTagMatch;
            }
            
            return true;
        });

        // Render tag filter buttons
        renderTagFilters();

        if (filteredNotes.length === 0) {
            elements.notesList.style.display = 'none';
            elements.notesEmptyState.style.display = 'flex';
            return;
        }

        elements.notesList.style.display = 'grid';
        elements.notesEmptyState.style.display = 'none';

        const html = filteredNotes.map(note => {
            const date = note.createdAt ? new Date(note.createdAt.toDate()).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            }) : 'Today';

            const preview = note.content.length > 120 
                ? note.content.substring(0, 120) + '...' 
                : note.content;

            const subjectColor = note.subject ? getSubjectColor(note.subject) : '#6b7280';
            const subjectBadge = note.subject 
                ? `<span class="note-subject-badge" style="background: ${subjectColor}12; color: ${subjectColor}; border: 1px solid ${subjectColor}25;">
                    📚 ${note.subject}
                </span>` 
                : '';

            // Render tags
            const tags = note.tags || [];
            const tagsHTML = tags.length > 0
                ? `<div class="note-tags" style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px;">
                    ${tags.map(tag => `<span class="note-tag" style="font-size: 11px; padding: 3px 8px; background: var(--accent-color)15; color: var(--accent-color); border-radius: 4px; font-weight: 500;">#${escapeHtml(tag)}</span>`).join('')}
                </div>`
                : '';

            return `
                <div class="note-card" data-note-id="${note.id}">
                    <div class="note-card-header">
                        <h3 class="note-title">${escapeHtml(note.title)}</h3>
                        <div class="note-actions">
                            <button class="note-action-btn edit-note-btn" data-note-id="${note.id}" title="Edit">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button class="note-action-btn delete-note-btn" data-note-id="${note.id}" title="Delete">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    ${subjectBadge}
                    ${tagsHTML}
                    <p class="note-preview">${escapeHtml(preview)}</p>
                    <div class="note-footer">
                        <span class="note-date">
                            <i class="fa-regular fa-calendar"></i> ${date}
                        </span>
                    </div>
                </div>
            `;
        }).join('');

        elements.notesList.innerHTML = html;

        // Bind action buttons
        document.querySelectorAll('.edit-note-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const noteId = btn.getAttribute('data-note-id');
                editNote(noteId);
            });
        });

        document.querySelectorAll('.delete-note-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const noteId = btn.getAttribute('data-note-id');
                deleteNote(noteId);
            });
        });

        // Click on card to view/edit
        document.querySelectorAll('.note-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.note-action-btn')) {
                    const noteId = card.getAttribute('data-note-id');
                    editNote(noteId);
                }
            });
        });
    }

    // === Show Note Form ===
    function showNoteForm() {
        if (!elements.noteForm || !elements.addNoteSection) return;

        elements.noteForm.style.display = 'block';
        elements.addNoteSection.classList.remove('collapsed');
        elements.noteTitleInput.focus();

        // Populate subject select if not already done
        populateSubjectSelect();
    }

    // === Cancel Note Form ===
    function cancelNoteForm() {
        if (!elements.noteForm) return;

        elements.noteForm.style.display = 'none';
        elements.addNoteSection.classList.add('collapsed');
        clearForm();
        editingNoteId = null;
    }

    // === Clear Form ===
    function clearForm() {
        if (elements.noteTitleInput) elements.noteTitleInput.value = '';
        if (elements.noteContentInput) elements.noteContentInput.value = '';
        if (elements.noteSubjectSelect) elements.noteSubjectSelect.value = '';
        if (elements.noteTagsInput) elements.noteTagsInput.value = '';
    }

    // === Save Note ===
    function saveNote() {
        const title = elements.noteTitleInput?.value.trim();
        const content = elements.noteContentInput?.value.trim();
        const subject = elements.noteSubjectSelect?.value || '';
        
        // Parse tags from comma-separated input
        const tagsInput = elements.noteTagsInput?.value.trim() || '';
        const tags = tagsInput ? tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(t => t) : [];

        if (!title) {
            showToast('❌ Please enter a note title', 'error');
            return;
        }

        if (!content) {
            showToast('❌ Please enter note content', 'error');
            return;
        }

        const user = firebase.auth().currentUser;
        if (!user) {
            showToast('❌ Please log in to save notes', 'error');
            return;
        }

        const noteData = {
            title,
            content,
            subject,
            tags,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (editingNoteId) {
            // Update existing note
            db.collection('users').doc(user.uid).collection('notes').doc(editingNoteId)
                .update(noteData)
                .then(() => {
                    showToast('✅ Note updated successfully', 'success');
                    cancelNoteForm();
                })
                .catch((error) => {
                    console.error('Error updating note:', error);
                    showToast('❌ Failed to update note', 'error');
                });
        } else {
            // Create new note
            noteData.createdAt = firebase.firestore.FieldValue.serverTimestamp();

            db.collection('users').doc(user.uid).collection('notes')
                .add(noteData)
                .then(() => {
                    showToast('✅ Note created successfully', 'success');
                    cancelNoteForm();
                })
                .catch((error) => {
                    console.error('Error creating note:', error);
                    showToast('❌ Failed to create note', 'error');
                });
        }
    }

    // === Edit Note ===
    function editNote(noteId) {
        const note = notes.find(n => n.id === noteId);
        if (!note) return;

        if (elements.noteTagsInput) {
            const tags = note.tags || [];
            elements.noteTagsInput.value = tags.join(', ');
        }
        editingNoteId = noteId;
        
        if (elements.noteTitleInput) elements.noteTitleInput.value = note.title;
        if (elements.noteContentInput) elements.noteContentInput.value = note.content;
        if (elements.noteSubjectSelect) elements.noteSubjectSelect.value = note.subject || '';
        
        showNoteForm();
        
        // Scroll to form
        elements.addNoteSection?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // === Delete Note ===
    function deleteNote(noteId) {
        const note = notes.find(n => n.id === noteId);
        if (!note) return;

        if (!confirm(`Delete "${note.title}"?`)) return;

        const user = firebase.auth().currentUser;
        if (!user) return;

        db.collection('users').doc(user.uid).collection('notes').doc(noteId)
            .delete()
            .then(() => {
                showToast('🗑️ Note deleted', 'success');
                if (editingNoteId === noteId) {
                    cancelNoteForm();
                }
            })
            .catch((error) => {
                console.error('Error deleting note:', error);
                showToast('❌ Failed to delete note', 'error');
            });
    }

    // === Search Notes ===
    function handleSearch(e) {
        searchTerm = e.target.value.trim();
        renderNotes();
    }

    // === Populate Subject Select ===
    function populateSubjectSelect() {
        if (!elements.noteSubjectSelect) return;

        const user = firebase.auth().currentUser;
        if (!user) return;

        db.collection('users').doc(user.uid).collection('subjects')
            .orderBy('name')
            .get()
            .then((snapshot) => {
                let options = '<option value="">No Subject</option>';
                snapshot.forEach(doc => {
                    const subject = doc.data();
                    options += `<option value="${subject.name}">${subject.name}</option>`;
                });
                elements.noteSubjectSelect.innerHTML = options;
            })
            .catch((error) => {
                console.error('Error loading subjects:', error);
            });
    }

    // === Get Subject Color ===
    function getSubjectColor(subjectName) {
        // Color mapping for subjects
        const colors = [
            '#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
            '#EC4899', '#06B6D4', '#F97316', '#14B8A6', '#6366F1'
        ];
        
        // Generate consistent color based on subject name
        let hash = 0;
        for (let i = 0; i < subjectName.length; i++) {
            hash = subjectName.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }

    // === Show Toast ===
    function showToast(message, type = 'info') {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            alert(message);
        }
    }

    // === Render Tag Filters ===
    function renderTagFilters() {
        if (!elements.tagFilter) return;

        // Collect all unique tags from notes
        const allTags = new Set();
        notes.forEach(note => {
            if (note.tags && Array.isArray(note.tags)) {
                note.tags.forEach(tag => allTags.add(tag));
            }
        });

        // Sort tags alphabetically
        const sortedTags = Array.from(allTags).sort();

        // Build filter HTML
        let html = `<button class="tag-filter-btn ${activeTagFilter === 'all' ? 'active' : ''}" data-tag="all">All</button>`;
        sortedTags.forEach(tag => {
            html += `<button class="tag-filter-btn ${activeTagFilter === tag ? 'active' : ''}" data-tag="${tag}">#${escapeHtml(tag)}</button>`;
        });

        elements.tagFilter.innerHTML = html;

        // Bind click events
        document.querySelectorAll('.tag-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                activeTagFilter = btn.getAttribute('data-tag');
                renderNotes();
            });
        });
    }

    // === Escape HTML ===
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // === Public API ===
    return {
        init,
        showNoteForm
    };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Wait for Firebase and auth to be ready
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            NotesManager.init();
        }
    });
});

// Export for FAB button
window.NotesManager = NotesManager;
