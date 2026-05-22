// ===== REALTIME UPDATE HANDLER MODULE =====
// Manages Firestore real-time listeners for instant cross-device synchronization
// Handles tasks, habits, notes, focus sessions, and all user data collections

const RealtimeUpdateHandler = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    
    const CONFIG = {
        DEBOUNCE_DELAY: 500, // Debounce rapid updates
        MAX_RETRIES: 3,
        RETRY_DELAY: 5000,
        LISTENER_TIMEOUT: 60000, // 1 minute
        ENABLE_OFFLINE_PERSISTENCE: true
    };

    // ===== STATE =====
    
    let listeners = {
        tasks: null,
        habits: null,
        subjects: null,
        notes: null,
        focusSessions: null,
        studySessions: null,
        exams: null,
        studyBlocks: null,
        analytics: null
    };

    let isInitialized = false;
    let lastUpdateTimestamps = {};
    let pendingUpdates = {};
    let debounceTimers = {};

    // ===== INITIALIZATION =====

    /**
     * Initialize real-time update handler
     * @returns {Promise<void>}
     */
    async function initialize() {
        if (isInitialized) {
            console.log('⚠️ RealtimeUpdateHandler already initialized');
            return;
        }

        if (!currentUserId || typeof firebase === 'undefined') {
            console.log('⚠️ Cannot initialize: No user or Firebase unavailable');
            return;
        }

        try {
            // Persistence is already enabled in firebase-config.js
            // No need to enable it again here
            console.log('ℹ️ Firestore offline persistence already configured');

            // Setup listeners for all collections
            await setupAllListeners();

            isInitialized = true;
            console.log('✅ RealtimeUpdateHandler initialized');

        } catch (error) {
            console.error('❌ Error initializing RealtimeUpdateHandler:', error);
            throw error;
        }
    }

    /**
     * Setup listeners for all collections
     * @returns {Promise<void>}
     */
    async function setupAllListeners() {
        await setupTasksListener();
        await setupHabitsListener();
        await setupSubjectsListener();
        await setupNotesListener();
        await setupFocusSessionsListener();
        await setupStudySessionsListener();
        await setupExamsListener();
        await setupStudyBlocksListener();

        console.log('✅ All real-time listeners active');
    }

    // ===== COLLECTION LISTENERS =====

    /**
     * Setup real-time listener for tasks
     * @returns {Promise<void>}
     */
    async function setupTasksListener() {
        if (listeners.tasks) {
            listeners.tasks(); // Unsubscribe existing
        }

        try {
            listeners.tasks = firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection('tasks')
                .onSnapshot(
                    snapshot => handleTasksSnapshot(snapshot),
                    error => handleListenerError('tasks', error)
                );

            console.log('📝 Tasks listener active');
        } catch (error) {
            console.error('❌ Error setting up tasks listener:', error);
        }
    }

    /**
     * Setup real-time listener for habits
     * @returns {Promise<void>}
     */
    async function setupHabitsListener() {
        if (listeners.habits) {
            listeners.habits();
        }

        try {
            listeners.habits = firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection('habits')
                .onSnapshot(
                    snapshot => handleHabitsSnapshot(snapshot),
                    error => handleListenerError('habits', error)
                );

            console.log('✅ Habits listener active');
        } catch (error) {
            console.error('❌ Error setting up habits listener:', error);
        }
    }

    /**
     * Setup real-time listener for subjects
     * @returns {Promise<void>}
     */
    async function setupSubjectsListener() {
        if (listeners.subjects) {
            listeners.subjects();
        }

        try {
            listeners.subjects = firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection('subjects')
                .onSnapshot(
                    snapshot => handleSubjectsSnapshot(snapshot),
                    error => handleListenerError('subjects', error)
                );

            console.log('📚 Subjects listener active');
        } catch (error) {
            console.error('❌ Error setting up subjects listener:', error);
        }
    }

    /**
     * Setup real-time listener for notes
     * @returns {Promise<void>}
     */
    async function setupNotesListener() {
        if (listeners.notes) {
            listeners.notes();
        }

        try {
            listeners.notes = firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection('notes')
                .onSnapshot(
                    snapshot => handleNotesSnapshot(snapshot),
                    error => handleListenerError('notes', error)
                );

            console.log('📓 Notes listener active');
        } catch (error) {
            console.error('❌ Error setting up notes listener:', error);
        }
    }

    /**
     * Setup real-time listener for focus sessions
     * @returns {Promise<void>}
     */
    async function setupFocusSessionsListener() {
        if (listeners.focusSessions) {
            listeners.focusSessions();
        }

        try {
            listeners.focusSessions = firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection('focusSessions')
                .where('createdAt', '>=', getRecentTimestamp())
                .onSnapshot(
                    snapshot => handleFocusSessionsSnapshot(snapshot),
                    error => handleListenerError('focusSessions', error)
                );

            console.log('🎯 Focus sessions listener active');
        } catch (error) {
            console.error('❌ Error setting up focus sessions listener:', error);
        }
    }

    /**
     * Setup real-time listener for study sessions
     * @returns {Promise<void>}
     */
    async function setupStudySessionsListener() {
        if (listeners.studySessions) {
            listeners.studySessions();
        }

        try {
            listeners.studySessions = firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection('studySessions')
                .where('createdAt', '>=', getRecentTimestamp())
                .onSnapshot(
                    snapshot => handleStudySessionsSnapshot(snapshot),
                    error => handleListenerError('studySessions', error)
                );

            console.log('📖 Study sessions listener active');
        } catch (error) {
            console.error('❌ Error setting up study sessions listener:', error);
        }
    }

    /**
     * Setup real-time listener for exams
     * @returns {Promise<void>}
     */
    async function setupExamsListener() {
        if (listeners.exams) {
            listeners.exams();
        }

        try {
            listeners.exams = firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection('exams')
                .onSnapshot(
                    snapshot => handleExamsSnapshot(snapshot),
                    error => handleListenerError('exams', error)
                );

            console.log('📝 Exams listener active');
        } catch (error) {
            console.error('❌ Error setting up exams listener:', error);
        }
    }

    /**
     * Setup real-time listener for study blocks
     * @returns {Promise<void>}
     */
    async function setupStudyBlocksListener() {
        if (listeners.studyBlocks) {
            listeners.studyBlocks();
        }

        try {
            listeners.studyBlocks = firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection('studyBlocks')
                .onSnapshot(
                    snapshot => handleStudyBlocksSnapshot(snapshot),
                    error => handleListenerError('studyBlocks', error)
                );

            console.log('📅 Study blocks listener active');
        } catch (error) {
            console.error('❌ Error setting up study blocks listener:', error);
        }
    }

    // ===== SNAPSHOT HANDLERS =====

    /**
     * Handle tasks snapshot updates
     * @param {Object} snapshot - Firestore snapshot
     */
    function handleTasksSnapshot(snapshot) {
        if (shouldSkipUpdate('tasks', snapshot)) return;

        const changes = {
            added: [],
            modified: [],
            removed: []
        };

        snapshot.docChanges().forEach(change => {
            const data = prepareDataFromFirestore(change.doc.data(), change.doc.id);

            if (change.type === 'added') {
                changes.added.push(data);
            } else if (change.type === 'modified') {
                changes.modified.push(data);
            } else if (change.type === 'removed') {
                changes.removed.push({ id: change.doc.id });
            }
        });

        // Debounce updates
        debounceUpdate('tasks', () => {
            applyTasksUpdate(changes);
            
            // Dispatch event
            document.dispatchEvent(new CustomEvent('tasksUpdated', {
                detail: changes
            }));
        });
    }

    /**
     * Handle habits snapshot updates
     * @param {Object} snapshot - Firestore snapshot
     */
    function handleHabitsSnapshot(snapshot) {
        if (shouldSkipUpdate('habits', snapshot)) return;

        const changes = {
            added: [],
            modified: [],
            removed: []
        };

        snapshot.docChanges().forEach(change => {
            const data = prepareDataFromFirestore(change.doc.data(), change.doc.id);

            if (change.type === 'added') {
                changes.added.push(data);
            } else if (change.type === 'modified') {
                changes.modified.push(data);
            } else if (change.type === 'removed') {
                changes.removed.push({ id: change.doc.id });
            }
        });

        debounceUpdate('habits', () => {
            applyHabitsUpdate(changes);
            
            document.dispatchEvent(new CustomEvent('habitsUpdated', {
                detail: changes
            }));
        });
    }

    /**
     * Handle subjects snapshot updates
     * @param {Object} snapshot - Firestore snapshot
     */
    function handleSubjectsSnapshot(snapshot) {
        if (shouldSkipUpdate('subjects', snapshot)) return;

        const subjects = [];
        snapshot.forEach(doc => {
            subjects.push(prepareDataFromFirestore(doc.data(), doc.id));
        });

        debounceUpdate('subjects', () => {
            applySubjectsUpdate(subjects);
            
            document.dispatchEvent(new CustomEvent('subjectsUpdated', {
                detail: { subjects }
            }));
        });
    }

    /**
     * Handle notes snapshot updates
     * @param {Object} snapshot - Firestore snapshot
     */
    function handleNotesSnapshot(snapshot) {
        if (shouldSkipUpdate('notes', snapshot)) return;

        const changes = {
            added: [],
            modified: [],
            removed: []
        };

        snapshot.docChanges().forEach(change => {
            const data = prepareDataFromFirestore(change.doc.data(), change.doc.id);

            if (change.type === 'added') {
                changes.added.push(data);
            } else if (change.type === 'modified') {
                changes.modified.push(data);
            } else if (change.type === 'removed') {
                changes.removed.push({ id: change.doc.id });
            }
        });

        debounceUpdate('notes', () => {
            applyNotesUpdate(changes);
            
            document.dispatchEvent(new CustomEvent('notesUpdated', {
                detail: changes
            }));
        });
    }

    /**
     * Handle focus sessions snapshot updates
     * @param {Object} snapshot - Firestore snapshot
     */
    function handleFocusSessionsSnapshot(snapshot) {
        const changes = {
            added: [],
            modified: []
        };

        snapshot.docChanges().forEach(change => {
            const data = prepareDataFromFirestore(change.doc.data(), change.doc.id);

            if (change.type === 'added' || change.type === 'modified') {
                changes[change.type].push(data);
            }
        });

        if (changes.added.length > 0 || changes.modified.length > 0) {
            document.dispatchEvent(new CustomEvent('focusSessionsUpdated', {
                detail: changes
            }));
        }
    }

    /**
     * Handle study sessions snapshot updates
     * @param {Object} snapshot - Firestore snapshot
     */
    function handleStudySessionsSnapshot(snapshot) {
        const sessions = [];
        snapshot.forEach(doc => {
            sessions.push(prepareDataFromFirestore(doc.data(), doc.id));
        });

        if (sessions.length > 0) {
            document.dispatchEvent(new CustomEvent('studySessionsUpdated', {
                detail: { sessions }
            }));
        }
    }

    /**
     * Handle exams snapshot updates
     * @param {Object} snapshot - Firestore snapshot
     */
    function handleExamsSnapshot(snapshot) {
        const exams = [];
        snapshot.forEach(doc => {
            exams.push(prepareDataFromFirestore(doc.data(), doc.id));
        });

        debounceUpdate('exams', () => {
            applyExamsUpdate(exams);
            
            document.dispatchEvent(new CustomEvent('examsUpdated', {
                detail: { exams }
            }));
        });
    }

    /**
     * Handle study blocks snapshot updates
     * @param {Object} snapshot - Firestore snapshot
     */
    function handleStudyBlocksSnapshot(snapshot) {
        const blocks = [];
        snapshot.forEach(doc => {
            blocks.push(prepareDataFromFirestore(doc.data(), doc.id));
        });

        debounceUpdate('studyBlocks', () => {
            applyStudyBlocksUpdate(blocks);
            
            document.dispatchEvent(new CustomEvent('studyBlocksUpdated', {
                detail: { blocks }
            }));
        });
    }

    // ===== UPDATE APPLICATION =====

    /**
     * Apply tasks updates to IndexedDB and UI
     * @param {Object} changes - Changes object
     * @returns {Promise<void>}
     */
    async function applyTasksUpdate(changes) {
        try {
            // Update IndexedDB
            for (const task of changes.added) {
                const existing = await db.tasks.get(parseInt(task.id));
                if (!existing) {
                    await db.tasks.add(task);
                }
            }

            for (const task of changes.modified) {
                await db.tasks.update(parseInt(task.id), task);
            }

            for (const task of changes.removed) {
                await db.tasks.delete(parseInt(task.id));
            }

            // Trigger UI refresh
            if (typeof loadTasks !== 'undefined') {
                loadTasks();
            }

            console.log(`✅ Tasks updated: +${changes.added.length} ~${changes.modified.length} -${changes.removed.length}`);
        } catch (error) {
            console.error('❌ Error applying tasks update:', error);
        }
    }

    /**
     * Apply habits updates to IndexedDB and UI
     * @param {Object} changes - Changes object
     * @returns {Promise<void>}
     */
    async function applyHabitsUpdate(changes) {
        try {
            for (const habit of changes.added) {
                const existing = await db.habits.get(parseInt(habit.id));
                if (!existing) {
                    await db.habits.add(habit);
                }
            }

            for (const habit of changes.modified) {
                await db.habits.update(parseInt(habit.id), habit);
            }

            for (const habit of changes.removed) {
                await db.habits.delete(parseInt(habit.id));
            }

            // Trigger UI refresh
            if (typeof loadHabits !== 'undefined') {
                loadHabits();
            }

            console.log(`✅ Habits updated: +${changes.added.length} ~${changes.modified.length} -${changes.removed.length}`);
        } catch (error) {
            console.error('❌ Error applying habits update:', error);
        }
    }

    /**
     * Apply subjects updates
     * @param {Array} subjects - Subjects array
     * @returns {Promise<void>}
     */
    async function applySubjectsUpdate(subjects) {
        try {
            // Clear and reload subjects in IndexedDB
            await db.subjects.clear();
            await db.subjects.bulkAdd(subjects);

            console.log(`✅ Subjects updated: ${subjects.length} items`);
        } catch (error) {
            console.error('❌ Error applying subjects update:', error);
        }
    }

    /**
     * Apply notes updates
     * @param {Object} changes - Changes object
     * @returns {Promise<void>}
     */
    async function applyNotesUpdate(changes) {
        try {
            for (const note of changes.added) {
                const existing = await db.notes.get(parseInt(note.id));
                if (!existing) {
                    await db.notes.add(note);
                }
            }

            for (const note of changes.modified) {
                await db.notes.update(parseInt(note.id), note);
            }

            for (const note of changes.removed) {
                await db.notes.delete(parseInt(note.id));
            }

            console.log(`✅ Notes updated: +${changes.added.length} ~${changes.modified.length} -${changes.removed.length}`);
        } catch (error) {
            console.error('❌ Error applying notes update:', error);
        }
    }

    /**
     * Apply exams updates
     * @param {Array} exams - Exams array
     * @returns {Promise<void>}
     */
    async function applyExamsUpdate(exams) {
        try {
            // Store in localStorage (legacy compatibility)
            localStorage.setItem('exams', JSON.stringify(exams));

            console.log(`✅ Exams updated: ${exams.length} items`);
        } catch (error) {
            console.error('❌ Error applying exams update:', error);
        }
    }

    /**
     * Apply study blocks updates
     * @param {Array} blocks - Study blocks array
     * @returns {Promise<void>}
     */
    async function applyStudyBlocksUpdate(blocks) {
        try {
            localStorage.setItem('studyBlocks', JSON.stringify(blocks));

            console.log(`✅ Study blocks updated: ${blocks.length} items`);
        } catch (error) {
            console.error('❌ Error applying study blocks update:', error);
        }
    }

    // ===== UTILITIES =====

    /**
     * Check if update should be skipped (to prevent update loops)
     * @param {string} collection - Collection name
     * @param {Object} snapshot - Firestore snapshot
     * @returns {boolean} True if should skip
     */
    function shouldSkipUpdate(collection, snapshot) {
        // Skip if metadata-only change
        if (snapshot.metadata && snapshot.metadata.hasPendingWrites) {
            return true;
        }

        // Check timestamp
        const lastUpdate = lastUpdateTimestamps[collection];
        if (lastUpdate && Date.now() - lastUpdate < 100) {
            return true; // Skip rapid consecutive updates
        }

        lastUpdateTimestamps[collection] = Date.now();
        return false;
    }

    /**
     * Debounce updates to prevent rapid consecutive updates
     * @param {string} collection - Collection name
     * @param {Function} callback - Update function
     */
    function debounceUpdate(collection, callback) {
        if (debounceTimers[collection]) {
            clearTimeout(debounceTimers[collection]);
        }

        debounceTimers[collection] = setTimeout(() => {
            callback();
            delete debounceTimers[collection];
        }, CONFIG.DEBOUNCE_DELAY);
    }

    /**
     * Prepare data from Firestore (convert timestamps, etc.)
     * @param {Object} data - Raw Firestore data
     * @param {string} id - Document ID
     * @returns {Object} Prepared data
     */
    function prepareDataFromFirestore(data, id) {
        const prepared = { ...data, id: id };

        // Convert Firestore timestamps to ISO strings
        if (prepared.createdAt && typeof prepared.createdAt.toDate === 'function') {
            prepared.createdAt = prepared.createdAt.toDate().toISOString();
        }
        if (prepared.updatedAt && typeof prepared.updatedAt.toDate === 'function') {
            prepared.updatedAt = prepared.updatedAt.toDate().toISOString();
        }
        if (prepared.lastActive && typeof prepared.lastActive.toDate === 'function') {
            prepared.lastActive = prepared.lastActive.toDate().toISOString();
        }

        return prepared;
    }

    /**
     * Get recent timestamp for filtering (30 days ago)
     * @returns {firebase.firestore.Timestamp} Timestamp
     */
    function getRecentTimestamp() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return firebase.firestore.Timestamp.fromDate(thirtyDaysAgo);
    }

    /**
     * Handle listener error
     * @param {string} collection - Collection name
     * @param {Error} error - Error object
     */
    function handleListenerError(collection, error) {
        console.error(`❌ Listener error (${collection}):`, error);

        // Attempt to reconnect
        setTimeout(() => {
            console.log(`🔄 Attempting to reconnect ${collection} listener...`);
            initialize();
        }, CONFIG.RETRY_DELAY);
    }

    // ===== LISTENER CONTROL =====

    /**
     * Stop all listeners
     */
    function stopAllListeners() {
        Object.keys(listeners).forEach(key => {
            if (listeners[key]) {
                listeners[key]();
                listeners[key] = null;
            }
        });

        isInitialized = false;
        console.log('🛑 All listeners stopped');
    }

    /**
     * Restart all listeners
     * @returns {Promise<void>}
     */
    async function restartAllListeners() {
        stopAllListeners();
        await initialize();
    }

    /**
     * Stop specific listener
     * @param {string} collection - Collection name
     */
    function stopListener(collection) {
        if (listeners[collection]) {
            listeners[collection]();
            listeners[collection] = null;
            console.log(`🛑 ${collection} listener stopped`);
        }
    }

    /**
     * Check if all listeners are active
     * @returns {boolean} True if all active
     */
    function areListenersActive() {
        return Object.values(listeners).every(listener => listener !== null);
    }

    // ===== PUBLIC API =====

    return {
        // Initialization
        initialize,
        stopAllListeners,
        restartAllListeners,

        // Individual listener control
        stopListener,
        setupTasksListener,
        setupHabitsListener,
        setupSubjectsListener,
        setupNotesListener,
        setupFocusSessionsListener,

        // Status
        areListenersActive,

        // Configuration
        CONFIG
    };

})();

// Auto-initialize when user is authenticated
document.addEventListener('userAuthenticated', () => {
    setTimeout(() => {
        RealtimeUpdateHandler.initialize().catch(console.error);
    }, 2000);
});

console.log('⚡ RealtimeUpdateHandler module loaded');
