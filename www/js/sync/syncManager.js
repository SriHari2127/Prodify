// ===== SYNC MANAGER =====
// Orchestrates all synchronization activities and manages sync lifecycle

class SyncManager {
    constructor() {
        this.status = 'IDLE'; // IDLE, SYNCING, SYNCED, FAILED, OFFLINE
        this.autoSyncInterval = null;
        this.autoSyncDelay = 30000; // 30 seconds
        this.lastSyncTime = null;
        this.lastSyncResult = null;
        this.statusListeners = [];
        this.initialized = false;
    }

    /**
     * Check if sync manager is running
     * @returns {boolean} True if sync is initialized and auto-sync is active
     */
    isRunning() {
        return this.initialized && this.autoSyncInterval !== null;
    }

    /**
     * Initialize sync manager
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.initialized) {
            console.log('⚠️ Sync Manager already initialized');
            return;
        }

        console.log('🔄 Initializing Sync Manager...');

        try {
            // Subscribe to network changes
            networkMonitor.onReconnect(async (offlineDuration) => {
                console.log(`🌐 Reconnected after ${Math.round(offlineDuration / 1000)}s offline`);
                await this.triggerSync('RECONNECT');
            });

            networkMonitor.onDisconnect(() => {
                console.log('📴 Disconnected - pausing sync');
                this.updateStatus('OFFLINE');
                this.stopAutoSync();
            });

            networkMonitor.onStatusChange(async (isOnline) => {
                if (isOnline) {
                    this.startAutoSync();
                } else {
                    this.stopAutoSync();
                }
            });

            // Start auto-sync if online
            if (networkMonitor.isOnline) {
                this.startAutoSync();
            } else {
                this.updateStatus('OFFLINE');
            }

            // Initial sync if we have pending operations
            const pendingCount = await syncQueueProcessor.getPendingCount();
            if (pendingCount > 0 && networkMonitor.isOnline) {
                console.log(`📦 Found ${pendingCount} pending operations - syncing...`);
                await this.triggerSync('STARTUP');
            }

            this.initialized = true;
            console.log('✅ Sync Manager initialized successfully');

        } catch (error) {
            console.error('❌ Error initializing Sync Manager:', error);
            throw error;
        }
    }

    /**
     * Trigger manual sync
     * @param {string} trigger - Sync trigger reason
     * @returns {Promise<Object>} Sync result
     */
    async triggerSync(trigger = 'MANUAL') {
        console.log(`🔄 Sync triggered: ${trigger}`);

        // Don't sync if offline
        if (!networkMonitor.isOnline) {
            console.log('📴 Cannot sync while offline');
            this.updateStatus('OFFLINE');
            return {
                success: false,
                reason: 'offline',
                trigger
            };
        }

        // Don't sync if already syncing
        if (this.status === 'SYNCING') {
            console.log('⚠️ Sync already in progress');
            return {
                success: false,
                reason: 'already_syncing',
                trigger
            };
        }

        // Update status to syncing
        this.updateStatus('SYNCING');

        try {
            const startTime = Date.now();

            // Process sync queue
            const result = await syncQueueProcessor.processQueue();

            const duration = Date.now() - startTime;
            const success = result.success > 0 || (result.failed === 0 && result.skipped);

            // Update status based on result
            if (result.skipped) {
                this.updateStatus('SYNCED');
            } else if (result.failed > 0) {
                this.updateStatus('FAILED');
            } else {
                this.updateStatus('SYNCED');
            }

            // Save result
            this.lastSyncTime = new Date().toISOString();
            this.lastSyncResult = {
                ...result,
                trigger,
                timestamp: this.lastSyncTime,
                duration
            };

            console.log(`✅ Sync completed: ${result.success} success, ${result.failed} failed (${duration}ms)`);

            return {
                success: true,
                ...result,
                trigger,
                duration
            };

        } catch (error) {
            console.error('❌ Sync failed:', error);
            this.updateStatus('FAILED');
            
            this.lastSyncResult = {
                success: false,
                error: error.message,
                trigger,
                timestamp: new Date().toISOString()
            };

            return {
                success: false,
                error: error.message,
                trigger
            };
        }
    }

    /**
     * Start automatic sync
     * @param {number} interval - Sync interval in milliseconds
     */
    startAutoSync(interval = this.autoSyncDelay) {
        if (this.autoSyncInterval) {
            console.log('⚠️ Auto-sync already running');
            return;
        }

        this.autoSyncDelay = interval;

        this.autoSyncInterval = setInterval(async () => {
            // Only sync if online and not currently syncing
            if (networkMonitor.isOnline && this.status !== 'SYNCING') {
                const pendingCount = await syncQueueProcessor.getPendingCount();
                
                if (pendingCount > 0) {
                    console.log(`⏰ Auto-sync: ${pendingCount} pending operations`);
                    await this.triggerSync('AUTO');
                }
            }
        }, interval);

        console.log(`✅ Auto-sync started (interval: ${interval}ms)`);
    }

    /**
     * Stop automatic sync
     */
    stopAutoSync() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
            console.log('✅ Auto-sync stopped');
        }
    }

    /**
     * Sync after focus session completes
     * @returns {Promise<Object>} Sync result
     */
    async syncAfterFocusSession() {
        console.log('🎯 Syncing after focus session completion');
        return await this.triggerSync('FOCUS_COMPLETE');
    }

    /**
     * Sync after app launches
     * @returns {Promise<Object>} Sync result
     */
    async syncOnLaunch() {
        console.log('🚀 Syncing on app launch');
        return await this.triggerSync('LAUNCH');
    }

    /**
     * Sync specific table
     * @param {string} table - Table name to sync
     * @returns {Promise<Object>} Sync result
     */
    async syncTable(table) {
        console.log(`🔄 Syncing table: ${table}`);
        
        // Get operations for specific table
        const operations = await db.syncQueue
            .where('table')
            .equals(table)
            .and(op => op.synced === 0)
            .toArray();

        if (operations.length === 0) {
            console.log(`✅ No pending operations for ${table}`);
            return { success: 0, message: 'No pending operations' };
        }

        this.updateStatus('SYNCING');

        let successCount = 0;
        let failedCount = 0;

        for (const op of operations) {
            try {
                await firestoreSyncAdapter.syncWithRetry(op);
                await syncQueueProcessor.markOperationSynced(op.id);
                successCount++;
            } catch (error) {
                await syncQueueProcessor.markOperationFailed(op.id, error.message);
                failedCount++;
            }
        }

        this.updateStatus(failedCount > 0 ? 'FAILED' : 'SYNCED');

        return {
            success: successCount,
            failed: failedCount,
            total: operations.length,
            table
        };
    }

    /**
     * Retry all failed operations
     * @returns {Promise<Object>} Retry result
     */
    async retryFailedOperations() {
        console.log('🔄 Retrying failed operations');
        this.updateStatus('SYNCING');

        const result = await syncQueueProcessor.retryFailed();

        this.updateStatus(result.success > 0 ? 'SYNCED' : 'FAILED');

        return result;
    }

    /**
     * Force full sync (re-sync everything)
     * @returns {Promise<Object>} Sync result
     */
    async forceFullSync() {
        console.log('🔄 Force full sync initiated');
        
        // Reset all operations to unsynced
        const allOps = await db.syncQueue.toArray();
        
        for (const op of allOps) {
            await db.syncQueue.update(op.id, {
                synced: false,
                retries: 0,
                error: null
            });
        }

        return await this.triggerSync('FORCE_FULL');
    }

    /**
     * Update sync status
     * @param {string} newStatus - New status value
     */
    updateStatus(newStatus) {
        const oldStatus = this.status;
        this.status = newStatus;

        if (oldStatus !== newStatus) {
            console.log(`📊 Sync status: ${oldStatus} → ${newStatus}`);
            this.notifyStatusListeners(newStatus, oldStatus);
        }
    }

    /**
     * Register status change listener
     * @param {Function} callback - Called with (newStatus, oldStatus)
     * @returns {Function} Unsubscribe function
     */
    onStatusChange(callback) {
        this.statusListeners.push(callback);
        
        // Immediately call with current status
        callback(this.status, null);

        return () => {
            this.statusListeners = this.statusListeners.filter(cb => cb !== callback);
        };
    }

    /**
     * Notify all status listeners
     * @param {string} newStatus - New status
     * @param {string} oldStatus - Previous status
     */
    notifyStatusListeners(newStatus, oldStatus) {
        this.statusListeners.forEach(callback => {
            try {
                callback(newStatus, oldStatus);
            } catch (error) {
                console.error('Error in status listener:', error);
            }
        });
    }

    /**
     * Get current sync status
     * @returns {string} Current status
     */
    getStatus() {
        return this.status;
    }

    /**
     * Get detailed sync status
     * @returns {Promise<Object>} Detailed status
     */
    async getDetailedStatus() {
        const queueStats = await syncQueueProcessor.getStats();
        const networkInfo = networkMonitor.getConnectionInfo();

        return {
            status: this.status,
            online: networkMonitor.isOnline,
            autoSyncEnabled: this.autoSyncInterval !== null,
            autoSyncInterval: this.autoSyncDelay,
            lastSyncTime: this.lastSyncTime,
            lastSyncResult: this.lastSyncResult,
            queue: queueStats,
            network: networkInfo,
            initialized: this.initialized
        };
    }

    /**
     * Get sync statistics
     * @returns {Promise<Object>} Sync statistics
     */
    async getStats() {
        const queueStats = await syncQueueProcessor.getStats();
        const firestoreStats = firestoreSyncAdapter.getStats();
        const networkStats = networkMonitor.getStats();

        return {
            sync: {
                status: this.status,
                lastSync: this.lastSyncTime,
                lastResult: this.lastSyncResult
            },
            queue: queueStats,
            firestore: firestoreStats,
            network: networkStats
        };
    }

    /**
     * Pause all sync activities
     */
    pause() {
        this.stopAutoSync();
        this.updateStatus('IDLE');
        console.log('⏸️ Sync paused');
    }

    /**
     * Resume sync activities
     */
    resume() {
        if (networkMonitor.isOnline) {
            this.startAutoSync();
            this.triggerSync('RESUME');
        }
        console.log('▶️ Sync resumed');
    }

    /**
     * Clean up old synced operations
     * @param {number} days - Keep operations from last N days
     * @returns {Promise<number>} Number of operations cleaned
     */
    async cleanup(days = 7) {
        console.log(`🧹 Cleaning up synced operations older than ${days} days...`);
        const cleaned = await syncQueueProcessor.clearSyncedOperations(days);
        console.log(`✅ Cleaned up ${cleaned} operations`);
        return cleaned;
    }

    /**
     * Reset sync manager (use with caution)
     */
    async reset() {
        console.log('🔄 Resetting Sync Manager...');
        
        this.stopAutoSync();
        syncQueueProcessor.reset();
        
        this.status = 'IDLE';
        this.lastSyncTime = null;
        this.lastSyncResult = null;
        
        console.log('✅ Sync Manager reset');
    }

    /**
     * Destroy sync manager and cleanup
     */
    destroy() {
        this.stopAutoSync();
        this.statusListeners = [];
        this.initialized = false;
        console.log('✅ Sync Manager destroyed');
    }
}

// Create singleton instance
const syncManager = new SyncManager();

// Export to window for global access
window.syncManager = syncManager;

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = syncManager;
}

// NOTE: No auto-initialization - controlled by StartupManager Phase 2
// Sync Manager initializes after UI is visible for optimal startup performance
