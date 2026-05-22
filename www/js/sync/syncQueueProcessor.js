// ===== SYNC QUEUE PROCESSOR =====
// Processes sync queue from IndexedDB and manages batch operations

class SyncQueueProcessor {
    constructor() {
        this.isProcessing = false;
        this.processingBatch = [];
        this.batchSize = 20;
        this.retrySchedule = [5000, 30000, 300000, 1800000]; // 5s, 30s, 5m, 30m
        this.maxRetries = 4;
        this.processedCount = 0;
        this.failedCount = 0;
    }

    /**
     * Process sync queue in batches
     * @param {number} batchSize - Number of operations per batch
     * @returns {Promise<Object>} Processing results
     */
    async processQueue(batchSize = this.batchSize) {
        if (this.isProcessing) {
            console.log('⚠️ Sync already in progress');
            return {
                success: 0,
                failed: 0,
                skipped: true,
                message: 'Sync already in progress'
            };
        }

        // Check if IndexedDB is ready
        if (typeof db === 'undefined' || !db.isOpen()) {
            console.error('❌ IndexedDB not ready');
            return {
                success: 0,
                failed: 0,
                skipped: true,
                message: 'IndexedDB not ready'
            };
        }

        // Check network
        if (!networkMonitor.isOnline) {
            console.log('📴 Offline - sync will resume when online');
            return {
                success: 0,
                failed: 0,
                skipped: true,
                message: 'Offline'
            };
        }

        // Check if connection is good enough
        if (!networkMonitor.isConnectionGoodForSync()) {
            console.log('⚠️ Connection quality insufficient for sync');
            return {
                success: 0,
                failed: 0,
                skipped: true,
                message: 'Poor connection quality'
            };
        }

        // Check authentication
        if (!firestoreSyncAdapter.isReady()) {
            console.log('⚠️ Firebase not ready');
            return {
                success: 0,
                failed: 0,
                skipped: true,
                message: 'Firebase not authenticated'
            };
        }

        this.isProcessing = true;
        const startTime = Date.now();

        try {
            // Get pending operations from IndexedDB
            const operations = await this.getPendingOperations(batchSize);

            if (operations.length === 0) {
                console.log('✅ Sync queue is empty');
                this.isProcessing = false;
                return {
                    success: 0,
                    failed: 0,
                    total: 0,
                    duration: Date.now() - startTime
                };
            }

            console.log(`🔄 Processing ${operations.length} sync operations...`);
            this.processingBatch = operations;

            let successCount = 0;
            let failedCount = 0;

            // Process each operation
            for (const operation of operations) {
                try {
                    // Sync to Firestore with retry
                    await firestoreSyncAdapter.syncWithRetry(operation, operation.retries || 0);
                    
                    // Mark as synced in IndexedDB
                    await this.markOperationSynced(operation.id);
                    
                    successCount++;
                    this.processedCount++;
                    
                } catch (error) {
                    console.error(`❌ Failed to sync operation ${operation.id}:`, error);
                    
                    // Update retry count and error
                    await this.markOperationFailed(operation.id, error.message || error.error);
                    
                    failedCount++;
                    this.failedCount++;
                }
            }

            const duration = Date.now() - startTime;
            console.log(`✅ Sync completed: ${successCount} success, ${failedCount} failed (${duration}ms)`);

            this.processingBatch = [];
            this.isProcessing = false;

            return {
                success: successCount,
                failed: failedCount,
                total: operations.length,
                duration
            };

        } catch (error) {
            console.error('❌ Error processing sync queue:', error);
            this.isProcessing = false;
            this.processingBatch = [];
            
            return {
                success: 0,
                failed: 0,
                error: error.message,
                duration: Date.now() - startTime
            };
        }
    }

    /**
     * Get pending operations from IndexedDB sync queue
     * @param {number} limit - Maximum number of operations
     * @returns {Promise<Array>} Pending operations
     */
    async getPendingOperations(limit = this.batchSize) {
        try {
            // Get unsynced operations, ordered by priority and timestamp
            const operations = await db.syncQueue
                .where('synced')
                .equals(0)
                .and(op => (op.retries || 0) < this.maxRetries)
                .toArray();

            // Sort by priority (high first) then timestamp (oldest first)
            operations.sort((a, b) => {
                // Priority: 1 = high, 0 = low
                if (b.priority !== a.priority) {
                    return (b.priority || 0) - (a.priority || 0);
                }
                // Then by timestamp (oldest first)
                return new Date(a.timestamp) - new Date(b.timestamp);
            });

            // Return limited batch
            return operations.slice(0, limit);

        } catch (error) {
            console.error('❌ Error getting pending operations:', error);
            return [];
        }
    }

    /**
     * Mark operation as successfully synced
     * @param {number} operationId - Queue entry ID
     * @returns {Promise<void>}
     */
    async markOperationSynced(operationId) {
        try {
            await db.syncQueue.update(operationId, {
                synced: true,
                syncedAt: new Date().toISOString(),
                error: null
            });
        } catch (error) {
            console.error('❌ Error marking operation synced:', error);
        }
    }

    /**
     * Mark operation as failed and increment retry count
     * @param {number} operationId - Queue entry ID
     * @param {string} errorMessage - Error description
     * @returns {Promise<void>}
     */
    async markOperationFailed(operationId, errorMessage) {
        try {
            const operation = await db.syncQueue.get(operationId);
            const retries = (operation.retries || 0) + 1;

            await db.syncQueue.update(operationId, {
                retries: retries,
                error: errorMessage,
                lastAttempt: new Date().toISOString(),
                nextRetry: this.calculateNextRetry(retries)
            });

            // If max retries exceeded, log permanent failure
            if (retries >= this.maxRetries) {
                console.error(`❌ Operation ${operationId} permanently failed after ${retries} retries`);
            }

        } catch (error) {
            console.error('❌ Error marking operation failed:', error);
        }
    }

    /**
     * Calculate next retry time based on exponential backoff
     * @param {number} retryCount - Current retry count
     * @returns {string} ISO timestamp for next retry
     */
    calculateNextRetry(retryCount) {
        const delayIndex = Math.min(retryCount - 1, this.retrySchedule.length - 1);
        const delay = this.retrySchedule[delayIndex];
        const nextRetry = new Date(Date.now() + delay);
        return nextRetry.toISOString();
    }

    /**
     * Retry failed operations that are ready
     * @returns {Promise<Object>} Retry results
     */
    async retryFailed() {
        try {
            const now = new Date().toISOString();
            
            // Get failed operations that are ready to retry
            const failedOps = await db.syncQueue
                .where('synced')
                .equals(0)
                .and(op => {
                    const hasRetries = op.retries > 0 && op.retries < this.maxRetries;
                    const isReadyToRetry = !op.nextRetry || op.nextRetry <= now;
                    return hasRetries && isReadyToRetry;
                })
                .toArray();

            if (failedOps.length === 0) {
                console.log('✅ No failed operations ready to retry');
                return { retried: 0, success: 0 };
            }

            console.log(`🔄 Retrying ${failedOps.length} failed operations...`);

            let successCount = 0;

            for (const op of failedOps) {
                try {
                    await firestoreSyncAdapter.syncWithRetry(op, op.retries);
                    await this.markOperationSynced(op.id);
                    successCount++;
                } catch (error) {
                    await this.markOperationFailed(op.id, error.message || error.error);
                }
            }

            console.log(`✅ Retry completed: ${successCount}/${failedOps.length} successful`);

            return {
                retried: failedOps.length,
                success: successCount,
                failed: failedOps.length - successCount
            };

        } catch (error) {
            console.error('❌ Error retrying failed operations:', error);
            return { retried: 0, success: 0, error: error.message };
        }
    }

    /**
     * Get count of pending operations
     * @returns {Promise<number>} Number of pending operations
     */
    async getPendingCount() {
        try {
            return await db.syncQueue
                .where('synced')
                .equals(0)
                .and(op => (op.retries || 0) < this.maxRetries)
                .count();
        } catch (error) {
            console.error('❌ Error getting pending count:', error);
            return 0;
        }
    }

    /**
     * Get count of failed operations
     * @returns {Promise<number>} Number of failed operations
     */
    async getFailedCount() {
        try {
            return await db.syncQueue
                .where('synced')
                .equals(0)
                .and(op => (op.retries || 0) > 0)
                .count();
        } catch (error) {
            console.error('❌ Error getting failed count:', error);
            return 0;
        }
    }

    /**
     * Clear permanently failed operations (exceeded max retries)
     * @returns {Promise<number>} Number of operations cleared
     */
    async clearPermanentlyFailed() {
        try {
            const failed = await db.syncQueue
                .where('synced')
                .equals(0)
                .and(op => (op.retries || 0) >= this.maxRetries)
                .toArray();

            const ids = failed.map(op => op.id);
            
            for (const id of ids) {
                await db.syncQueue.delete(id);
            }

            console.log(`✅ Cleared ${ids.length} permanently failed operations`);
            return ids.length;

        } catch (error) {
            console.error('❌ Error clearing failed operations:', error);
            return 0;
        }
    }

    /**
     * Clear successfully synced operations (cleanup)
     * @param {number} olderThanDays - Clear synced ops older than N days
     * @returns {Promise<number>} Number of operations cleared
     */
    async clearSyncedOperations(olderThanDays = 7) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
            const cutoffISO = cutoffDate.toISOString();

            const synced = await db.syncQueue
                .where('synced')
                .equals(1)
                .and(op => op.syncedAt < cutoffISO)
                .toArray();

            const ids = synced.map(op => op.id);
            
            for (const id of ids) {
                await db.syncQueue.delete(id);
            }

            console.log(`✅ Cleaned up ${ids.length} old synced operations`);
            return ids.length;

        } catch (error) {
            console.error('❌ Error clearing synced operations:', error);
            return 0;
        }
    }

    /**
     * Get queue statistics
     * @returns {Promise<Object>} Queue stats
     */
    async getStats() {
        try {
            const pending = await this.getPendingCount();
            const failed = await this.getFailedCount();
            const synced = await db.syncQueue.where('synced').equals(1).count();

            return {
                pending,
                failed,
                synced,
                totalProcessed: this.processedCount,
                totalFailed: this.failedCount,
                isProcessing: this.isProcessing,
                currentBatchSize: this.processingBatch.length,
                batchSize: this.batchSize,
                maxRetries: this.maxRetries,
                retrySchedule: this.retrySchedule
            };

        } catch (error) {
            console.error('❌ Error getting queue stats:', error);
            return null;
        }
    }

    /**
     * Get detailed queue status for UI
     * @returns {Promise<Object>} Detailed status
     */
    async getDetailedStatus() {
        const stats = await this.getStats();
        const operations = await this.getPendingOperations(10);

        return {
            ...stats,
            recentOperations: operations.map(op => ({
                id: op.id,
                table: op.table,
                operation: op.operation,
                timestamp: op.timestamp,
                retries: op.retries || 0,
                error: op.error
            }))
        };
    }

    /**
     * Reset processing state (use in case of stuck state)
     */
    reset() {
        this.isProcessing = false;
        this.processingBatch = [];
        console.log('✅ Sync queue processor reset');
    }

    /**
     * Set batch size
     * @param {number} size - New batch size
     */
    setBatchSize(size) {
        if (size > 0 && size <= 100) {
            this.batchSize = size;
            console.log(`✅ Batch size set to ${size}`);
        } else {
            console.error('❌ Invalid batch size (must be 1-100)');
        }
    }
}

// Create singleton instance
const syncQueueProcessor = new SyncQueueProcessor();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = syncQueueProcessor;
}
