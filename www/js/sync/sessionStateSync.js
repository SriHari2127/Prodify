// ===== SESSION STATE SYNC MODULE =====
// Synchronizes active user sessions across devices in real-time
// Handles focus sessions, study plans, habit progress, and active UI state

const SessionStateSync = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    
    const CONFIG = {
        SESSION_COLLECTION: 'activeSessions',
        UPDATE_INTERVAL: 5000, // 5 seconds
        SESSION_TIMEOUT: 300000, // 5 minutes
        HEARTBEAT_INTERVAL: 10000, // 10 seconds
        STATE_KEY: 'prodify_session_state'
    };

    // ===== STATE =====
    
    let currentSession = null;
    let sessionListener = null;
    let updateInterval = null;
    let heartbeatInterval = null;
    let isInitialized = false;
    let otherActiveSessions = [];

    // ===== SESSION TYPES =====

    const SESSION_TYPES = {
        FOCUS: 'focus',
        STUDY: 'study',
        HABIT: 'habit',
        EXAM_PREP: 'exam_prep',
        IDLE: 'idle'
    };

    // ===== INITIALIZATION =====

    /**
     * Initialize session state sync
     * @returns {Promise<void>}
     */
    async function initialize() {
        if (isInitialized) {
            console.log('⚠️ SessionStateSync already initialized');
            return;
        }

        try {
            // Load local session state
            loadLocalSessionState();

            // Setup Firestore listener for other devices' sessions
            await setupSessionListener();

            // Start heartbeat
            startHeartbeat();

            isInitialized = true;
            console.log('✅ SessionStateSync initialized');

        } catch (error) {
            console.error('❌ Error initializing SessionStateSync:', error);
            throw error;
        }
    }

    /**
     * Load session state from localStorage
     */
    function loadLocalSessionState() {
        const stored = localStorage.getItem(CONFIG.STATE_KEY);
        if (stored) {
            try {
                currentSession = JSON.parse(stored);
                
                // Check if session is stale
                if (currentSession && currentSession.lastUpdate) {
                    const timeSinceUpdate = Date.now() - new Date(currentSession.lastUpdate).getTime();
                    if (timeSinceUpdate > CONFIG.SESSION_TIMEOUT) {
                        console.log('🕐 Session expired, clearing state');
                        currentSession = null;
                        localStorage.removeItem(CONFIG.STATE_KEY);
                    }
                }
            } catch (error) {
                console.error('Error parsing session state:', error);
            }
        }
    }

    /**
     * Save session state to localStorage
     */
    function saveLocalSessionState() {
        if (currentSession) {
            localStorage.setItem(CONFIG.STATE_KEY, JSON.stringify(currentSession));
        } else {
            localStorage.removeItem(CONFIG.STATE_KEY);
        }
    }

    // ===== SESSION MANAGEMENT =====

    /**
     * Start a new session
     * @param {string} type - Session type
     * @param {Object} data - Session data
     * @returns {Promise<Object>} Session object
     */
    async function startSession(type, data = {}) {
        if (!DeviceManager.isReady()) {
            throw new Error('DeviceManager not initialized');
        }

        const device = DeviceManager.getCurrentDevice();
        const timestamp = new Date().toISOString();

        currentSession = {
            sessionId: generateSessionId(),
            type: type,
            deviceId: device.deviceId,
            deviceType: device.deviceType,
            deviceName: device.deviceName,
            startTime: timestamp,
            lastUpdate: timestamp,
            isActive: true,
            data: data
        };

        // Save locally
        saveLocalSessionState();

        // Sync to Firestore
        await syncSessionToFirestore();

        // Dispatch event
        document.dispatchEvent(new CustomEvent('sessionStarted', {
            detail: currentSession
        }));

        console.log('▶️ Session started:', currentSession);

        return currentSession;
    }

    /**
     * Update current session
     * @param {Object} updates - Data to update
     * @returns {Promise<Object>} Updated session
     */
    async function updateSession(updates = {}) {
        if (!currentSession) {
            throw new Error('No active session');
        }

        currentSession.data = {
            ...currentSession.data,
            ...updates
        };
        currentSession.lastUpdate = new Date().toISOString();

        // Save locally
        saveLocalSessionState();

        // Sync to Firestore
        await syncSessionToFirestore();

        // Dispatch event
        document.dispatchEvent(new CustomEvent('sessionUpdated', {
            detail: currentSession
        }));

        return currentSession;
    }

    /**
     * End current session
     * @returns {Promise<void>}
     */
    async function endSession() {
        if (!currentSession) {
            return;
        }

        const sessionToEnd = { ...currentSession };
        sessionToEnd.endTime = new Date().toISOString();
        sessionToEnd.isActive = false;
        sessionToEnd.duration = calculateSessionDuration(sessionToEnd);

        // Remove from Firestore
        await removeSessionFromFirestore();

        // Clear local state
        currentSession = null;
        saveLocalSessionState();

        // Dispatch event
        document.dispatchEvent(new CustomEvent('sessionEnded', {
            detail: sessionToEnd
        }));

        console.log('⏹️ Session ended:', sessionToEnd);
    }

    /**
     * Pause current session
     * @returns {Promise<void>}
     */
    async function pauseSession() {
        if (!currentSession) {
            return;
        }

        currentSession.isPaused = true;
        currentSession.pausedAt = new Date().toISOString();
        await updateSession({ isPaused: true, pausedAt: currentSession.pausedAt });

        console.log('⏸️ Session paused');
    }

    /**
     * Resume paused session
     * @returns {Promise<void>}
     */
    async function resumeSession() {
        if (!currentSession || !currentSession.isPaused) {
            return;
        }

        currentSession.isPaused = false;
        currentSession.resumedAt = new Date().toISOString();
        await updateSession({ isPaused: false, resumedAt: currentSession.resumedAt });

        console.log('▶️ Session resumed');
    }

    // ===== FIRESTORE SYNC =====

    /**
     * Sync current session to Firestore
     * @returns {Promise<void>}
     */
    async function syncSessionToFirestore() {
        if (!currentUserId || typeof firebase === 'undefined' || !currentSession) {
            return;
        }

        try {
            const sessionRef = firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection(CONFIG.SESSION_COLLECTION)
                .doc(currentSession.sessionId);

            await sessionRef.set({
                ...currentSession,
                lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
            });

        } catch (error) {
            console.error('❌ Error syncing session to Firestore:', error);
        }
    }

    /**
     * Remove session from Firestore
     * @returns {Promise<void>}
     */
    async function removeSessionFromFirestore() {
        if (!currentUserId || typeof firebase === 'undefined' || !currentSession) {
            return;
        }

        try {
            await firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection(CONFIG.SESSION_COLLECTION)
                .doc(currentSession.sessionId)
                .delete();

        } catch (error) {
            console.error('❌ Error removing session from Firestore:', error);
        }
    }

    /**
     * Setup real-time listener for other devices' sessions
     * @returns {Promise<void>}
     */
    async function setupSessionListener() {
        if (!currentUserId || typeof firebase === 'undefined') {
            return;
        }

        if (sessionListener) {
            sessionListener(); // Unsubscribe existing listener
        }

        try {
            const deviceId = DeviceManager.isReady() ? DeviceManager.getCurrentDevice().deviceId : null;

            sessionListener = firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection(CONFIG.SESSION_COLLECTION)
                .where('isActive', '==', true)
                .onSnapshot(snapshot => {
                    otherActiveSessions = [];

                    snapshot.forEach(doc => {
                        const session = doc.data();
                        
                        // Only include sessions from other devices
                        if (session.deviceId !== deviceId) {
                            otherActiveSessions.push({
                                sessionId: doc.id,
                                ...session,
                                lastUpdate: session.lastUpdate ? session.lastUpdate.toDate().toISOString() : null
                            });
                        }
                    });

                    // Dispatch event with other active sessions
                    document.dispatchEvent(new CustomEvent('otherSessionsUpdated', {
                        detail: { sessions: otherActiveSessions }
                    }));

                    if (otherActiveSessions.length > 0) {
                        console.log(`📱 ${otherActiveSessions.length} active session(s) on other devices`);
                    }
                }, error => {
                    console.error('❌ Session listener error:', error);
                });

        } catch (error) {
            console.error('❌ Error setting up session listener:', error);
        }
    }

    // ===== HEARTBEAT =====

    /**
     * Start session heartbeat
     */
    function startHeartbeat() {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }

        heartbeatInterval = setInterval(async () => {
            if (currentSession && currentSession.isActive) {
                currentSession.lastUpdate = new Date().toISOString();
                await syncSessionToFirestore();
            }
        }, CONFIG.HEARTBEAT_INTERVAL);

        // Update on visibility change
        document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible' && currentSession) {
                currentSession.lastUpdate = new Date().toISOString();
                await syncSessionToFirestore();
            }
        });

        // End session on page unload
        window.addEventListener('beforeunload', () => {
            if (currentSession) {
                // Synchronous cleanup
                navigator.sendBeacon && endSessionBeacon();
            }
        });
    }

    /**
     * Send session end beacon (for page unload)
     */
    function endSessionBeacon() {
        if (!currentSession || !currentUserId) return;

        // Use sendBeacon for reliable cleanup
        const url = `https://firestore.googleapis.com/v1/projects/prodify-9f3bb/databases/(default)/documents/users/${currentUserId}/${CONFIG.SESSION_COLLECTION}/${currentSession.sessionId}`;
        
        // Mark as inactive
        currentSession.isActive = false;
        saveLocalSessionState();
    }

    // ===== SPECIFIC SESSION TYPES =====

    /**
     * Start a focus session
     * @param {Object} focusData - Focus session details
     * @returns {Promise<Object>} Session object
     */
    async function startFocusSession(focusData = {}) {
        return await startSession(SESSION_TYPES.FOCUS, {
            subject: focusData.subject || null,
            duration: focusData.duration || 25,
            mode: focusData.mode || 'pomodoro',
            blockedSites: focusData.blockedSites || [],
            ...focusData
        });
    }

    /**
     * Start a study session
     * @param {Object} studyData - Study session details
     * @returns {Promise<Object>} Session object
     */
    async function startStudySession(studyData = {}) {
        return await startSession(SESSION_TYPES.STUDY, {
            subject: studyData.subject || null,
            topic: studyData.topic || null,
            plan: studyData.plan || [],
            ...studyData
        });
    }

    /**
     * Start habit tracking session
     * @param {Object} habitData - Habit details
     * @returns {Promise<Object>} Session object
     */
    async function startHabitSession(habitData = {}) {
        return await startSession(SESSION_TYPES.HABIT, {
            habitId: habitData.habitId || null,
            habitName: habitData.habitName || null,
            progress: habitData.progress || 0,
            ...habitData
        });
    }

    /**
     * Update focus session progress
     * @param {number} elapsed - Elapsed time in seconds
     * @param {number} remaining - Remaining time in seconds
     * @returns {Promise<Object>} Updated session
     */
    async function updateFocusProgress(elapsed, remaining) {
        if (!currentSession || currentSession.type !== SESSION_TYPES.FOCUS) {
            return null;
        }

        return await updateSession({
            elapsed: elapsed,
            remaining: remaining,
            progress: (elapsed / (elapsed + remaining)) * 100
        });
    }

    // ===== SESSION QUERIES =====

    /**
     * Get current active session
     * @returns {Object|null} Current session
     */
    function getCurrentSession() {
        return currentSession ? { ...currentSession } : null;
    }

    /**
     * Get other active sessions (from other devices)
     * @returns {Array} Array of sessions
     */
    function getOtherActiveSessions() {
        return [...otherActiveSessions];
    }

    /**
     * Check if a specific session type is active on any device
     * @param {string} type - Session type
     * @returns {boolean} True if active
     */
    function isSessionTypeActive(type) {
        if (currentSession && currentSession.type === type && currentSession.isActive) {
            return true;
        }

        return otherActiveSessions.some(s => s.type === type && s.isActive);
    }

    /**
     * Get active focus session from any device
     * @returns {Object|null} Focus session or null
     */
    function getActiveFocusSession() {
        if (currentSession && currentSession.type === SESSION_TYPES.FOCUS) {
            return currentSession;
        }

        const focusSession = otherActiveSessions.find(s => s.type === SESSION_TYPES.FOCUS);
        return focusSession || null;
    }

    // ===== CLEANUP =====

    /**
     * Clean up stale sessions from Firestore
     * @returns {Promise<number>} Number of sessions cleaned
     */
    async function cleanupStaleSessions() {
        if (!currentUserId || typeof firebase === 'undefined') {
            return 0;
        }

        try {
            const cutoffTime = new Date(Date.now() - CONFIG.SESSION_TIMEOUT);

            const snapshot = await firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection(CONFIG.SESSION_COLLECTION)
                .where('lastUpdate', '<', firebase.firestore.Timestamp.fromDate(cutoffTime))
                .get();

            const batch = firebase.firestore().batch();
            let count = 0;

            snapshot.forEach(doc => {
                batch.delete(doc.ref);
                count++;
            });

            if (count > 0) {
                await batch.commit();
                console.log(`🧹 Cleaned up ${count} stale sessions`);
            }

            return count;
        } catch (error) {
            console.error('❌ Error cleaning up stale sessions:', error);
            return 0;
        }
    }

    /**
     * Stop session sync
     */
    function stopSync() {
        if (sessionListener) {
            sessionListener();
            sessionListener = null;
        }

        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }

        if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
        }

        console.log('🛑 Session sync stopped');
    }

    // ===== UTILITIES =====

    /**
     * Generate unique session ID
     * @returns {string} Session ID
     */
    function generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Calculate session duration
     * @param {Object} session - Session object
     * @returns {number} Duration in milliseconds
     */
    function calculateSessionDuration(session) {
        if (!session.startTime) return 0;
        
        const endTime = session.endTime ? new Date(session.endTime) : new Date();
        const startTime = new Date(session.startTime);
        
        return endTime - startTime;
    }

    /**
     * Format session duration as readable string
     * @param {number} durationMs - Duration in milliseconds
     * @returns {string} Formatted duration
     */
    function formatDuration(durationMs) {
        const seconds = Math.floor(durationMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Get session status for UI display
     * @param {Object} session - Session object
     * @returns {Object} Status info
     */
    function getSessionStatus(session) {
        if (!session) {
            return {
                isActive: false,
                message: 'No active session',
                icon: '⚪'
            };
        }

        const duration = calculateSessionDuration(session);
        const formattedDuration = formatDuration(duration);

        if (session.isPaused) {
            return {
                isActive: true,
                isPaused: true,
                message: `Paused - ${formattedDuration}`,
                icon: '⏸️'
            };
        }

        const typeIcons = {
            focus: '🎯',
            study: '📚',
            habit: '✅',
            exam_prep: '📝',
            idle: '⚪'
        };

        return {
            isActive: true,
            isPaused: false,
            message: `Active - ${formattedDuration}`,
            icon: typeIcons[session.type] || '▶️',
            duration: duration,
            formattedDuration: formattedDuration
        };
    }

    // ===== PUBLIC API =====

    return {
        // Initialization
        initialize,
        stopSync,

        // Session management
        startSession,
        updateSession,
        endSession,
        pauseSession,
        resumeSession,

        // Specific session types
        startFocusSession,
        startStudySession,
        startHabitSession,
        updateFocusProgress,

        // Queries
        getCurrentSession,
        getOtherActiveSessions,
        isSessionTypeActive,
        getActiveFocusSession,

        // Utilities
        getSessionStatus,
        formatDuration,
        calculateSessionDuration,
        cleanupStaleSessions,

        // Constants
        SESSION_TYPES,
        CONFIG
    };

})();

// Auto-initialize when user is authenticated and DeviceManager is ready
document.addEventListener('deviceRegistered', () => {
    setTimeout(() => {
        SessionStateSync.initialize().catch(console.error);
    }, 500);
});

console.log('🔄 SessionStateSync module loaded');
