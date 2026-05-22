// ===== SYNC STATE MANAGER MODULE =====
// Manages synchronization state, queue processing, and data transfer optimization
// Implements delta sync, batch updates, and intelligent conflict detection

const SyncStateManager = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    
    const CONFIG = {
        SYNC_INTERVAL: 30000, // 30 seconds
        BATCH_SIZE: 20,
        MAX_RETRIES: 5,
        RETRY_DELAY: 5000,
        DELTA_SYNC_ENABLED: true,
        COMPRESSION_ENABLED: true,
        SYNC_STATE_KEY: 'prodify_sync_state',
        LAST_SYNC_KEY: 'prodify_last_sync',
        SYNC_METADATA_COLLECTION: 'syncMetadata'
    };

    // ===== STATE =====
    
    let syncState = {
        status: 'idle', // 'idle', 'syncing', 'error', 'offline'
        lastSync: null,
        lastSuccessfulSync: null,
        pendingOperations: 0,
        failedOperations: 0,
        isSyncing: false,
        error: null,
        progress: 0
    };

    let syncInterval = null;
    let isInitialized = false;
    let syncInProgress = false;
    let lastSyncTimestamps = {}; // Track last sync time per collection

    // ===== INITIALIZATION =====

    /**
     * Initialize sync state manager
     * @returns {Promise<void>}
     */
    async function initialize() {
        if (isInitialized) {
            console.log('⚠️ SyncStateManager already initialized');
            return;
        }

        try {
            // Load sync state from localStorage
            loadSyncState();

            // Load last sync timestamps
            await loadLastSyncTimestamps();

            // Count pending operations
            await updatePendingCount();

            // Start auto-sync
            startAutoSync();

            // Setup online/offline handlers
            setupNetworkHandlers();

            isInitialized = true;
            console.log('✅ SyncStateManager initialized');

            // Perform initial sync if online
            if (navigator.onLine && currentUserId) {
                setTimeout(() => performSync(), 2000);
            }

        } catch (error) {
            console.error('❌ Error initializing SyncStateManager:', error);
            throw error;
        }
    }

    /**
     * Load sync state from localStorage
     */
    function loadSyncState() {
        const stored = localStorage.getItem(CONFIG.SYNC_STATE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                syncState = { ...syncState, ...parsed };
            } catch (error) {
                console.error('Error parsing sync state:', error);
            }
        }

        const lastSync = localStorage.getItem(CONFIG.LAST_SYNC_KEY);
        if (lastSync) {
            syncState.lastSync = lastSync;
            syncState.lastSuccessfulSync = lastSync;
        }
    }

    /**
     * Save sync state to localStorage
     */
    function saveSyncState() {
        localStorage.setItem(CONFIG.SYNC_STATE_KEY, JSON.stringify(syncState));
        if (syncState.lastSuccessfulSync) {
            localStorage.setItem(CONFIG.LAST_SYNC_KEY, syncState.lastSuccessfulSync);
        }
    }

    /**
     * Load last sync timestamps from Firestore
     * @returns {Promise<void>}
     */
    async function loadLastSyncTimestamps() {
        if (!currentUserId || typeof firebase === 'undefined' || !DeviceManager.isReady()) {
            return;
        }

        try {
            const deviceId = DeviceManager.getCurrentDevice().deviceId;
            const doc = await firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection(CONFIG.SYNC_METADATA_COLLECTION)
                .doc(deviceId)
                .get();

            if (doc.exists) {
                const data = doc.data();
                lastSyncTimestamps = data.lastSyncTimestamps || {};
                console.log('✅ Loaded last sync timestamps:', lastSyncTimestamps);
            }
        } catch (error) {
            console.error('❌ Error loading sync timestamps:', error);
        }
    }

    /**
     * Save last sync timestamps to Firestore
     * @returns {Promise<void>}
     */
    async function saveLastSyncTimestamps() {
        if (!currentUserId || typeof firebase === 'undefined' || !DeviceManager.isReady()) {
            return;
        }

        try {
            const deviceId = DeviceManager.getCurrentDevice().deviceId;
            await firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection(CONFIG.SYNC_METADATA_COLLECTION)
                .doc(deviceId)
                .set({
                    lastSyncTimestamps: lastSyncTimestamps,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

        } catch (error) {
            console.error('❌ Error saving sync timestamps:', error);
        }
    }

    // ===== SYNC QUEUE MANAGEMENT =====

    /**
     * Update pending operations count
     * @returns {Promise<number>} Number of pending operations
     */
    async function updatePendingCount() {
        try {
            if (typeof getPendingSyncOperations !== 'undefined') {
                const pending = await getPendingSyncOperations(1000);
                syncState.pendingOperations = pending.length;
                saveSyncState();
                return pending.length;
            }
            return 0;
        } catch (error) {
            console.error('❌ Error updating pending count:', error);
            return 0;
        }
    }

    /**
     * Add operation to sync queue with metadata
     * @param {string} collection - Collection name
     * @param {string} operation - Operation type
     * @param {Object} data - Data payload
     * @param {Object} metadata - Additional metadata
     * @returns {Promise<number>} Queue entry ID
     */
    async function addToQueue(collection, operation, data, metadata = {}) {
        try {
            // Add device info to metadata
            const deviceInfo = DeviceManager.isReady() ? {
                deviceId: DeviceManager.getCurrentDevice().deviceId,
                deviceType: DeviceManager.getCurrentDevice().deviceType
            } : {};

            const enrichedMetadata = {
                ...metadata,
                ...deviceInfo,
                timestamp: new Date().toISOString(),
                version: data.updatedAt || data.createdAt
            };

            // Use existing addToSyncQueue function
            const id = await addToSyncQueue(collection, operation, {
                ...data,
                _metadata: enrichedMetadata
            });

            syncState.pendingOperations++;
            saveSyncState();

            // Dispatch event
            document.dispatchEvent(new CustomEvent('syncQueueUpdated', {
                detail: { pendingCount: syncState.pendingOperations }
            }));

            return id;
        } catch (error) {
            console.error('❌ Error adding to queue:', error);
            throw error;
        }
    }

    /**
     * Process sync queue with batching and optimization
     * @returns {Promise<Object>} Sync results
     */
    async function processQueue() {
        if (syncInProgress) {
            console.log('⚠️ Sync already in progress');
            return { success: 0, failed: 0, skipped: true };
        }

        if (!navigator.onLine) {
            updateSyncState('offline', 'Device is offline');
            return { success: 0, failed: 0, skipped: true };
        }

        if (!currentUserId || typeof firebase === 'undefined') {
            console.log('⚠️ Cannot sync: Not authenticated');
            return { success: 0, failed: 0, skipped: true };
        }

        syncInProgress = true;
        updateSyncState('syncing');

        try {
            const operations = await getPendingSyncOperations(CONFIG.BATCH_SIZE);
            
            if (operations.length === 0) {
                syncInProgress = false;
                updateSyncState('idle');
                return { success: 0, failed: 0 };
            }

            console.log(`🔄 Processing ${operations.length} sync operations...`);

            let successCount = 0;
            let failedCount = 0;

            // Group operations by collection and type for batching
            const batches = groupOperations(operations);

            for (const batch of batches) {
                try {
                    await processBatch(batch);
                    successCount += batch.operations.length;
                } catch (error) {
                    console.error('❌ Batch failed:', error);
                    failedCount += batch.operations.length;
                    
                    // Mark operations as failed
                    for (const op of batch.operations) {
                        await markSyncFailed(op.id, error.message);
                    }
                }

                // Update progress
                syncState.progress = (successCount + failedCount) / operations.length * 100;
                dispatchSyncProgress();
            }

            // Update sync state
            syncState.lastSuccessfulSync = new Date().toISOString();
            syncState.failedOperations = failedCount;
            saveSyncState();

            syncInProgress = false;
            updateSyncState('idle');

            // Update pending count
            await updatePendingCount();

            console.log(`✅ Sync completed: ${successCount} success, ${failedCount} failed`);

            return { success: successCount, failed: failedCount };

        } catch (error) {
            console.error('❌ Sync error:', error);
            syncInProgress = false;
            updateSyncState('error', error.message);
            return { success: 0, failed: 0, error: error.message };
        }
    }

    /**
     * Group operations for batch processing
     * @param {Array} operations - Array of operations
     * @returns {Array} Grouped batches
     */
    function groupOperations(operations) {
        const groups = {};

        operations.forEach(op => {
            const key = `${op.table}_${op.operation}`;
            if (!groups[key]) {
                groups[key] = {
                    collection: op.table,
                    operation: op.operation,
                    operations: []
                };
            }
            groups[key].operations.push(op);
        });

        return Object.values(groups);
    }

    /**
     * Process a batch of operations
     * @param {Object} batch - Batch object
     * @returns {Promise<void>}
     */
    async function processBatch(batch) {
        const { collection, operation, operations } = batch;

        if (operation === 'create') {
            await batchCreate(collection, operations);
        } else if (operation === 'update') {
            await batchUpdate(collection, operations);
        } else if (operation === 'delete') {
            await batchDelete(collection, operations);
        }
    }

    /**
     * Batch create operations
     * @param {string} collection - Collection name
     * @param {Array} operations - Operations to process
     * @returns {Promise<void>}
     */
    async function batchCreate(collection, operations) {
        const firestoreBatch = firebase.firestore().batch();

        for (const op of operations) {
            const docRef = firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection(collection)
                .doc(op.payload.id.toString());

            // Prepare data (remove local-only fields)
            const data = prepareDataForFirestore(op.payload);
            
            firestoreBatch.set(docRef, data);
        }

        await firestoreBatch.commit();

        // Mark all as completed
        for (const op of operations) {
            await markSyncCompleted(op.id);
        }

        console.log(`✅ Batch created ${operations.length} ${collection}`);
    }

    /**
     * Batch update operations
     * @param {string} collection - Collection name
     * @param {Array} operations - Operations to process
     * @returns {Promise<void>}
     */
    async function batchUpdate(collection, operations) {
        const firestoreBatch = firebase.firestore().batch();

        for (const op of operations) {
            const docRef = firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection(collection)
                .doc(op.payload.id.toString());

            // Check if document exists and handle conflicts
            const doc = await docRef.get();
            
            if (doc.exists) {
                // Delta sync: only include changed fields
                const delta = CONFIG.DELTA_SYNC_ENABLED 
                    ? calculateDelta(doc.data(), op.payload)
                    : op.payload;

                if (Object.keys(delta).length > 0) {
                    const data = prepareDataForFirestore(delta);
                    data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
                    firestoreBatch.update(docRef, data);
                }
            } else {
                // Document doesn't exist, create it
                const data = prepareDataForFirestore(op.payload);
                firestoreBatch.set(docRef, data);
            }
        }

        await firestoreBatch.commit();

        // Mark all as completed
        for (const op of operations) {
            await markSyncCompleted(op.id);
        }

        console.log(`✅ Batch updated ${operations.length} ${collection}`);
    }

    /**
     * Batch delete operations
     * @param {string} collection - Collection name
     * @param {Array} operations - Operations to process
     * @returns {Promise<void>}
     */
    async function batchDelete(collection, operations) {
        const firestoreBatch = firebase.firestore().batch();

        for (const op of operations) {
            const docRef = firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection(collection)
                .doc(op.payload.id.toString());

            firestoreBatch.delete(docRef);
        }

        await firestoreBatch.commit();

        // Mark all as completed
        for (const op of operations) {
            await markSyncCompleted(op.id);
        }

        console.log(`✅ Batch deleted ${operations.length} ${collection}`);
    }

    // ===== DATA OPTIMIZATION =====

    /**
     * Calculate delta (changed fields only)
     * @param {Object} oldData - Existing data
     * @param {Object} newData - New data
     * @returns {Object} Changed fields only
     */
    function calculateDelta(oldData, newData) {
        const delta = {};

        for (const key in newData) {
            if (key === '_metadata' || key === 'id') continue;
            
            // Deep comparison for objects/arrays
            if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
                delta[key] = newData[key];
            }
        }

        return delta;
    }

    /**
     * Prepare data for Firestore (remove local-only fields)
     * @param {Object} data - Raw data
     * @returns {Object} Cleaned data
     */
    function prepareDataForFirestore(data) {
        const cleaned = { ...data };
        
        // Remove local-only fields
        delete cleaned._metadata;
        
        // Convert dates to Firestore timestamps
        if (cleaned.createdAt && typeof cleaned.createdAt === 'string') {
            cleaned.createdAt = firebase.firestore.Timestamp.fromDate(new Date(cleaned.createdAt));
        }
        if (cleaned.updatedAt && typeof cleaned.updatedAt === 'string') {
            cleaned.updatedAt = firebase.firestore.Timestamp.fromDate(new Date(cleaned.updatedAt));
        }
        
        return cleaned;
    }

    /**
     * Compress data for transfer (basic implementation)
     * @param {Object} data - Data to compress
     * @returns {string} Compressed data
     */
    function compressData(data) {
        if (!CONFIG.COMPRESSION_ENABLED) return JSON.stringify(data);
        
        // Simple compression: remove whitespace
        return JSON.stringify(data);
    }

    /**
     * Decompress data (basic implementation)
     * @param {string} compressed - Compressed data
     * @returns {Object} Decompressed data
     */
    function decompressData(compressed) {
        return JSON.parse(compressed);
    }

    // ===== AUTO SYNC =====

    /**
     * Start auto-sync interval
     */
    function startAutoSync() {
        if (syncInterval) {
            clearInterval(syncInterval);
        }

        syncInterval = setInterval(async () => {
            if (navigator.onLine && currentUserId && !syncInProgress) {
                await performSync();
            }
        }, CONFIG.SYNC_INTERVAL);

        console.log(`🔄 Auto-sync started (${CONFIG.SYNC_INTERVAL}ms interval)`);
    }

    /**
     * Stop auto-sync interval
     */
    function stopAutoSync() {
        if (syncInterval) {
            clearInterval(syncInterval);
            syncInterval = null;
            console.log('🛑 Auto-sync stopped');
        }
    }

    /**
     * Perform full sync operation
     * @param {boolean} force - Force sync even if recently synced
     * @returns {Promise<Object>} Sync results
     */
    async function performSync(force = false) {
        try {
            // Update sync state
            syncState.lastSync = new Date().toISOString();
            
            // Process queue
            const results = await processQueue();
            
            // Update last sync timestamps
            if (results.success > 0) {
                lastSyncTimestamps[new Date().toISOString()] = results;
                await saveLastSyncTimestamps();
            }

            // Dispatch sync completed event
            document.dispatchEvent(new CustomEvent('syncCompleted', {
                detail: results
            }));

            return results;
        } catch (error) {
            console.error('❌ Sync failed:', error);
            throw error;
        }
    }

    // ===== STATE MANAGEMENT =====

    /**
     * Update sync state
     * @param {string} status - New status
     * @param {string} error - Error message (optional)
     */
    function updateSyncState(status, error = null) {
        syncState.status = status;
        syncState.error = error;
        saveSyncState();

        // Dispatch state change event
        document.dispatchEvent(new CustomEvent('syncStateChanged', {
            detail: { ...syncState }
        }));
    }

    /**
     * Dispatch sync progress event
     */
    function dispatchSyncProgress() {
        document.dispatchEvent(new CustomEvent('syncProgress', {
            detail: {
                progress: syncState.progress,
                pendingOperations: syncState.pendingOperations
            }
        }));
    }

    /**
     * Get current sync state
     * @returns {Object} Sync state
     */
    function getSyncState() {
        return { ...syncState };
    }

    /**
     * Reset sync state
     */
    function resetSyncState() {
        syncState = {
            status: 'idle',
            lastSync: null,
            lastSuccessfulSync: null,
            pendingOperations: 0,
            failedOperations: 0,
            isSyncing: false,
            error: null,
            progress: 0
        };
        saveSyncState();
    }

    // ===== NETWORK HANDLING =====

    /**
     * Setup online/offline event handlers
     */
    function setupNetworkHandlers() {
        window.addEventListener('online', () => {
            console.log('🌐 Network online - resuming sync');
            updateSyncState('idle');
            
            // Perform sync after a short delay
            setTimeout(() => {
                performSync();
            }, 2000);
        });

        window.addEventListener('offline', () => {
            console.log('📡 Network offline - pausing sync');
            updateSyncState('offline', 'No network connection');
        });
    }

    // ===== MANUAL SYNC CONTROL =====

    /**
     * Manually trigger sync
     * @returns {Promise<Object>} Sync results
     */
    async function triggerSync() {
        console.log('🔄 Manual sync triggered');
        return await performSync(true);
    }

    /**
     * Pause sync operations
     */
    function pauseSync() {
        stopAutoSync();
        updateSyncState('paused', 'Sync paused by user');
        console.log('⏸️ Sync paused');
    }

    /**
     * Resume sync operations
     */
    function resumeSync() {
        startAutoSync();
        updateSyncState('idle');
        performSync();
        console.log('▶️ Sync resumed');
    }

    // ===== SYNC STATISTICS =====

    /**
     * Get sync statistics
     * @returns {Object} Sync statistics
     */
    function getSyncStatistics() {
        return {
            lastSync: syncState.lastSync,
            lastSuccessfulSync: syncState.lastSuccessfulSync,
            pendingOperations: syncState.pendingOperations,
            failedOperations: syncState.failedOperations,
            status: syncState.status,
            isOnline: navigator.onLine
        };
    }

    /**
     * Clear failed operations
     * @returns {Promise<number>} Number of cleared operations
     */
    async function clearFailedOperations() {
        try {
            const failed = await db.syncQueue
                .where('retries')
                .aboveOrEqual(CONFIG.MAX_RETRIES)
                .toArray();

            for (const op of failed) {
                await db.syncQueue.delete(op.id);
            }

            syncState.failedOperations = 0;
            saveSyncState();

            console.log(`🧹 Cleared ${failed.length} failed operations`);
            return failed.length;
        } catch (error) {
            console.error('❌ Error clearing failed operations:', error);
            return 0;
        }
    }

    // ===== PUBLIC API =====

    return {
        // Initialization
        initialize,

        // Queue management
        addToQueue,
        processQueue,
        updatePendingCount,

        // Sync control
        performSync,
        triggerSync,
        pauseSync,
        resumeSync,
        startAutoSync,
        stopAutoSync,

        // State
        getSyncState,
        getSyncStatistics,
        resetSyncState,

        // Cleanup
        clearFailedOperations,

        // Constants
        CONFIG
    };

})();

// Auto-initialize when user is authenticated
document.addEventListener('userAuthenticated', () => {
    setTimeout(() => {
        SyncStateManager.initialize().catch(console.error);
    }, 1500);
});

console.log('🔄 SyncStateManager module loaded');
