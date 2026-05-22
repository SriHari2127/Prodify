// ===== FIRESTORE SYNC ADAPTER =====
// Handles all Firebase Firestore synchronization operations

class FirestoreSyncAdapter {
    constructor() {
        this.maxRetries = 4;
        this.baseDelay = 5000; // 5 seconds
        this.syncLog = [];
        this.maxLogSize = 100;
    }

    /**
     * Check if Firebase is initialized and user is authenticated
     * @returns {boolean} True if ready to sync
     */
    isReady() {
        if (typeof firebase === 'undefined') {
            console.error('❌ Firebase not initialized');
            return false;
        }

        if (!currentUserId) {
            console.error('❌ No user authenticated');
            return false;
        }

        return true;
    }

    /**
     * Sync a single operation to Firestore
     * @param {Object} operation - Sync queue operation
     * @returns {Promise<Object>} Sync result
     */
    async syncOperation(operation) {
        if (!this.isReady()) {
            throw new Error('Firebase not ready for sync');
        }

        const startTime = Date.now();
        
        try {
            const { table, operation: op, payload } = operation;
            
            console.log(`🔄 Syncing ${op} to ${table}...`);
            
            let result;
            switch (op) {
                case 'create':
                case 'CREATE':
                    result = await this.createDocument(table, payload);
                    break;
                    
                case 'update':
                case 'UPDATE':
                    result = await this.updateDocument(table, payload);
                    break;
                    
                case 'delete':
                case 'DELETE':
                    result = await this.deleteDocument(table, payload);
                    break;
                    
                case 'bulkCreate':
                    result = await this.bulkCreateDocuments(table, payload);
                    break;
                    
                default:
                    throw new Error(`Unknown operation: ${op}`);
            }

            const duration = Date.now() - startTime;
            this.logSync(operation, 'success', duration);
            
            return {
                success: true,
                operation,
                result,
                duration
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            this.logSync(operation, 'failed', duration, error.message);
            
            throw {
                success: false,
                operation,
                error: error.message,
                duration
            };
        }
    }

    /**
     * Create document in Firestore
     * @param {string} table - Collection name
     * @param {Object} payload - Document data
     * @returns {Promise<string>} Document ID
     */
    async createDocument(table, payload) {
        const collectionRef = firebase.firestore()
            .collection('users')
            .doc(currentUserId)
            .collection(table);

        // Remove internal IndexedDB ID if auto-generated
        const data = { ...payload };
        const docId = data.id ? data.id.toString() : collectionRef.doc().id;
        delete data.id;

        // Add timestamps for Firestore
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

        await collectionRef.doc(docId).set(data);
        
        console.log(`✅ Created document ${docId} in ${table}`);
        return docId;
    }

    /**
     * Update document in Firestore
     * @param {string} table - Collection name
     * @param {Object} payload - Document data with id
     * @returns {Promise<string>} Document ID
     */
    async updateDocument(table, payload) {
        const { id, ...updates } = payload;
        
        if (!id) {
            throw new Error('Document ID required for update');
        }

        const docRef = firebase.firestore()
            .collection('users')
            .doc(currentUserId)
            .collection(table)
            .doc(id.toString());

        // Add update timestamp
        updates.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

        await docRef.set(updates, { merge: true });
        
        console.log(`✅ Updated document ${id} in ${table}`);
        return id;
    }

    /**
     * Delete document from Firestore
     * @param {string} table - Collection name
     * @param {Object} payload - Must contain id
     * @returns {Promise<string>} Deleted document ID
     */
    async deleteDocument(table, payload) {
        const { id } = payload;
        
        if (!id) {
            throw new Error('Document ID required for delete');
        }

        await firebase.firestore()
            .collection('users')
            .doc(currentUserId)
            .collection(table)
            .doc(id.toString())
            .delete();
        
        console.log(`✅ Deleted document ${id} from ${table}`);
        return id;
    }

    /**
     * Bulk create documents
     * @param {string} table - Collection name
     * @param {Array} payload - Array of documents
     * @returns {Promise<number>} Number of documents created
     */
    async bulkCreateDocuments(table, payload) {
        const batch = firebase.firestore().batch();
        const collectionRef = firebase.firestore()
            .collection('users')
            .doc(currentUserId)
            .collection(table);

        let count = 0;
        for (const item of payload) {
            const data = { ...item };
            const docId = data.id ? data.id.toString() : collectionRef.doc().id;
            delete data.id;

            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

            const docRef = collectionRef.doc(docId);
            batch.set(docRef, data);
            count++;

            // Firestore batch limit is 500
            if (count >= 500) break;
        }

        await batch.commit();
        
        console.log(`✅ Bulk created ${count} documents in ${table}`);
        return count;
    }

    /**
     * Fetch document from Firestore
     * @param {string} table - Collection name
     * @param {string} id - Document ID
     * @returns {Promise<Object>} Document data
     */
    async fetchDocument(table, id) {
        const doc = await firebase.firestore()
            .collection('users')
            .doc(currentUserId)
            .collection(table)
            .doc(id.toString())
            .get();

        if (!doc.exists) {
            throw new Error(`Document ${id} not found in ${table}`);
        }

        return {
            id: doc.id,
            ...doc.data()
        };
    }

    /**
     * Fetch all documents from collection
     * @param {string} table - Collection name
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of documents
     */
    async fetchCollection(table, options = {}) {
        let query = firebase.firestore()
            .collection('users')
            .doc(currentUserId)
            .collection(table);

        // Apply filters
        if (options.where) {
            options.where.forEach(([field, op, value]) => {
                query = query.where(field, op, value);
            });
        }

        // Apply ordering
        if (options.orderBy) {
            query = query.orderBy(options.orderBy.field, options.orderBy.direction || 'asc');
        }

        // Apply limit
        if (options.limit) {
            query = query.limit(options.limit);
        }

        const snapshot = await query.get();
        const documents = [];

        snapshot.forEach(doc => {
            documents.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return documents;
    }

    /**
     * Resolve conflict between local and cloud data
     * @param {Object} localData - Local document
     * @param {Object} cloudData - Cloud document
     * @returns {Promise<Object>} Resolved document with merge strategy
     */
    async resolveConflict(localData, cloudData) {
        console.log('🔀 Resolving conflict...');

        // Extract timestamps
        const localTime = this.getTimestamp(localData.updatedAt || localData.createdAt);
        const cloudTime = this.getTimestamp(cloudData.updatedAt || cloudData.createdAt);

        // Local is newer - use local
        if (localTime > cloudTime) {
            console.log('✅ Local data is newer - using local');
            return {
                data: localData,
                strategy: 'USE_LOCAL',
                source: 'local'
            };
        }

        // Cloud is newer - use cloud
        if (cloudTime > localTime) {
            console.log('✅ Cloud data is newer - using cloud');
            return {
                data: cloudData,
                strategy: 'USE_CLOUD',
                source: 'cloud'
            };
        }

        // Same timestamp - merge both
        console.log('⚠️ Same timestamp - merging data');
        const merged = this.mergeData(localData, cloudData);
        return {
            data: merged,
            strategy: 'MERGE',
            source: 'merged'
        };
    }

    /**
     * Get timestamp from various formats
     * @param {any} timestamp - Timestamp in various formats
     * @returns {number} Unix timestamp in milliseconds
     */
    getTimestamp(timestamp) {
        if (!timestamp) return 0;
        
        // ISO string
        if (typeof timestamp === 'string') {
            return new Date(timestamp).getTime();
        }
        
        // Firebase Timestamp
        if (timestamp.toDate && typeof timestamp.toDate === 'function') {
            return timestamp.toDate().getTime();
        }
        
        // Unix timestamp
        if (typeof timestamp === 'number') {
            return timestamp;
        }
        
        // Date object
        if (timestamp instanceof Date) {
            return timestamp.getTime();
        }
        
        return 0;
    }

    /**
     * Merge two data objects
     * @param {Object} local - Local data
     * @param {Object} cloud - Cloud data
     * @returns {Object} Merged data
     */
    mergeData(local, cloud) {
        const merged = { ...cloud };

        for (const key in local) {
            // Skip internal fields
            if (key.startsWith('_')) continue;

            const localValue = local[key];
            const cloudValue = cloud[key];

            // Local has value, cloud doesn't
            if (localValue !== null && localValue !== undefined && 
                (cloudValue === null || cloudValue === undefined)) {
                merged[key] = localValue;
            }

            // Both have arrays - merge uniquely
            if (Array.isArray(localValue) && Array.isArray(cloudValue)) {
                merged[key] = [...new Set([...cloudValue, ...localValue])];
            }

            // Both have objects - deep merge
            if (typeof localValue === 'object' && !Array.isArray(localValue) &&
                typeof cloudValue === 'object' && !Array.isArray(cloudValue) &&
                localValue !== null && cloudValue !== null) {
                merged[key] = this.mergeData(localValue, cloudValue);
            }
        }

        return merged;
    }

    /**
     * Sync with exponential backoff
     * @param {Object} operation - Sync queue operation
     * @param {number} retryCount - Current retry attempt
     * @returns {Promise<Object>} Sync result
     */
    async syncWithRetry(operation, retryCount = 0) {
        try {
            return await this.syncOperation(operation);
        } catch (error) {
            if (retryCount >= this.maxRetries) {
                console.error(`❌ Max retries (${this.maxRetries}) exceeded for operation`, operation);
                throw error;
            }

            // Calculate exponential backoff delay
            const delay = this.baseDelay * Math.pow(2, retryCount);
            console.log(`⏳ Retry ${retryCount + 1}/${this.maxRetries} in ${delay}ms...`);

            await this.sleep(delay);
            return this.syncWithRetry(operation, retryCount + 1);
        }
    }

    /**
     * Sleep utility
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise<void>}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Log sync operation
     * @param {Object} operation - Operation details
     * @param {string} status - success/failed
     * @param {number} duration - Operation duration (ms)
     * @param {string} error - Error message if failed
     */
    logSync(operation, status, duration, error = null) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            table: operation.table,
            operation: operation.operation,
            status: status,
            duration: duration,
            error: error,
            operationId: operation.id
        };

        this.syncLog.push(logEntry);

        // Keep log size manageable
        if (this.syncLog.length > this.maxLogSize) {
            this.syncLog.shift();
        }

        // Log to console
        if (status === 'success') {
            console.log(`✅ Sync log: ${operation.operation} ${operation.table} (${duration}ms)`);
        } else {
            console.error(`❌ Sync log: ${operation.operation} ${operation.table} failed: ${error}`);
        }
    }

    /**
     * Get sync logs
     * @param {number} limit - Number of logs to return
     * @returns {Array} Recent sync logs
     */
    getSyncLogs(limit = 20) {
        return this.syncLog.slice(-limit);
    }

    /**
     * Clear sync logs
     */
    clearSyncLogs() {
        this.syncLog = [];
        console.log('✅ Sync logs cleared');
    }

    /**
     * Get sync statistics
     * @returns {Object} Sync stats
     */
    getStats() {
        const totalSyncs = this.syncLog.length;
        const successfulSyncs = this.syncLog.filter(log => log.status === 'success').length;
        const failedSyncs = this.syncLog.filter(log => log.status === 'failed').length;
        const avgDuration = totalSyncs > 0
            ? this.syncLog.reduce((sum, log) => sum + log.duration, 0) / totalSyncs
            : 0;

        return {
            totalSyncs,
            successfulSyncs,
            failedSyncs,
            successRate: totalSyncs > 0 ? (successfulSyncs / totalSyncs * 100).toFixed(2) : 0,
            avgDuration: avgDuration.toFixed(2),
            recentLogs: this.getSyncLogs(10)
        };
    }
}

// Create singleton instance
const firestoreSyncAdapter = new FirestoreSyncAdapter();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = firestoreSyncAdapter;
}
