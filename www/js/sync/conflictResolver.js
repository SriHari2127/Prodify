// ===== CONFLICT RESOLVER MODULE =====
// Handles data conflicts during cross-device synchronization
// Implements multiple resolution strategies: timestamp-based, merge, custom rules

const ConflictResolver = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    
    const CONFIG = {
        DEFAULT_STRATEGY: 'timestamp', // 'timestamp', 'merge', 'manual', 'device-priority'
        CONFLICT_LOG_COLLECTION: 'conflictLogs',
        MERGE_ARRAYS: true,
        MERGE_NOTES: true,
        PRESERVE_HISTORY: true,
        MAX_CONFLICT_HISTORY: 100
    };

    // ===== CONFLICT RESOLUTION STRATEGIES =====

    /**
     * Resolve conflict using timestamp (last write wins)
     * @param {Object} localData - Local version of data
     * @param {Object} remoteData - Remote version of data
     * @param {Object} context - Additional context
     * @returns {Object} Resolved data with metadata
     */
    function resolveByTimestamp(localData, remoteData, context = {}) {
        const localTime = new Date(localData.updatedAt || localData.createdAt).getTime();
        const remoteTime = new Date(remoteData.updatedAt || remoteData.createdAt).getTime();

        const winner = remoteTime > localTime ? remoteData : localData;
        const loser = remoteTime > localTime ? localData : remoteData;

        return {
            resolved: { ...winner },
            strategy: 'timestamp',
            winner: remoteTime > localTime ? 'remote' : 'local',
            conflictDetected: true,
            localVersion: localData,
            remoteVersion: remoteData,
            timestamp: new Date().toISOString(),
            deviceId: context.deviceId || 'unknown'
        };
    }

    /**
     * Resolve conflict by merging both versions
     * @param {Object} localData - Local version of data
     * @param {Object} remoteData - Remote version of data
     * @param {Object} context - Additional context
     * @returns {Object} Merged data with metadata
     */
    function resolveByMerge(localData, remoteData, context = {}) {
        const merged = { ...remoteData }; // Start with remote as base

        // Merge strategy per field type
        for (const key in localData) {
            if (key === 'id') continue;

            const localValue = localData[key];
            const remoteValue = remoteData[key];

            // Skip if values are the same
            if (JSON.stringify(localValue) === JSON.stringify(remoteValue)) {
                continue;
            }

            // Array merging
            if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
                if (CONFIG.MERGE_ARRAYS) {
                    merged[key] = mergeArrays(localValue, remoteValue, key);
                } else {
                    // Use newer timestamp
                    merged[key] = resolveByTimestamp(
                        { [key]: localValue, updatedAt: localData.updatedAt },
                        { [key]: remoteValue, updatedAt: remoteData.updatedAt }
                    ).resolved[key];
                }
            }
            // String merging (for notes, descriptions)
            else if (typeof localValue === 'string' && typeof remoteValue === 'string') {
                if (key === 'notes' || key === 'description' || key === 'content') {
                    if (CONFIG.MERGE_NOTES) {
                        merged[key] = mergeStrings(localValue, remoteValue);
                    } else {
                        merged[key] = remoteValue; // Remote wins
                    }
                } else {
                    merged[key] = remoteValue; // Remote wins for other strings
                }
            }
            // Numeric merging (for counters, scores)
            else if (typeof localValue === 'number' && typeof remoteValue === 'number') {
                if (key === 'streak' || key === 'xp' || key === 'score' || key === 'count') {
                    merged[key] = Math.max(localValue, remoteValue); // Take maximum
                } else {
                    merged[key] = remoteValue; // Remote wins
                }
            }
            // Boolean merging
            else if (typeof localValue === 'boolean' && typeof remoteValue === 'boolean') {
                // For completion status, completed = true wins
                if (key === 'completed' || key === 'done' || key === 'finished') {
                    merged[key] = localValue || remoteValue;
                } else {
                    merged[key] = remoteValue; // Remote wins
                }
            }
            // Default: use remote value
            else {
                merged[key] = remoteValue;
            }
        }

        // Add any keys that exist only in local
        for (const key in localData) {
            if (!(key in merged) && key !== 'id') {
                merged[key] = localData[key];
            }
        }

        return {
            resolved: merged,
            strategy: 'merge',
            conflictDetected: true,
            localVersion: localData,
            remoteVersion: remoteData,
            mergedFields: Object.keys(merged),
            timestamp: new Date().toISOString(),
            deviceId: context.deviceId || 'unknown'
        };
    }

    /**
     * Merge two arrays intelligently
     * @param {Array} localArray - Local array
     * @param {Array} remoteArray - Remote array
     * @param {string} fieldName - Field name for context
     * @returns {Array} Merged array
     */
    function mergeArrays(localArray, remoteArray, fieldName) {
        // For subtasks, tags, history: merge unique items
        if (fieldName === 'subtasks') {
            return mergeSubtasks(localArray, remoteArray);
        } else if (fieldName === 'tags') {
            return [...new Set([...localArray, ...remoteArray])]; // Unique tags
        } else if (fieldName === 'history') {
            return mergeHistory(localArray, remoteArray);
        } else {
            // Default: combine and deduplicate
            const combined = [...remoteArray];
            localArray.forEach(item => {
                if (!combined.find(c => JSON.stringify(c) === JSON.stringify(item))) {
                    combined.push(item);
                }
            });
            return combined;
        }
    }

    /**
     * Merge subtasks arrays
     * @param {Array} localSubtasks - Local subtasks
     * @param {Array} remoteSubtasks - Remote subtasks
     * @returns {Array} Merged subtasks
     */
    function mergeSubtasks(localSubtasks, remoteSubtasks) {
        const merged = [...remoteSubtasks];
        const remoteTexts = new Set(remoteSubtasks.map(s => s.text || s));

        localSubtasks.forEach(localSub => {
            const localText = localSub.text || localSub;
            if (!remoteTexts.has(localText)) {
                merged.push(localSub);
            } else {
                // If both have the same subtask, merge completion status
                const remoteIndex = merged.findIndex(r => (r.text || r) === localText);
                if (remoteIndex >= 0) {
                    if (typeof localSub === 'object' && typeof merged[remoteIndex] === 'object') {
                        merged[remoteIndex].completed = localSub.completed || merged[remoteIndex].completed;
                    }
                }
            }
        });

        return merged;
    }

    /**
     * Merge history arrays (sorted by timestamp)
     * @param {Array} localHistory - Local history
     * @param {Array} remoteHistory - Remote history
     * @returns {Array} Merged and sorted history
     */
    function mergeHistory(localHistory, remoteHistory) {
        const combined = [...localHistory, ...remoteHistory];
        
        // Deduplicate by date
        const unique = {};
        combined.forEach(entry => {
            const date = entry.date || entry.timestamp || entry;
            if (!unique[date]) {
                unique[date] = entry;
            }
        });

        // Sort by date
        return Object.values(unique).sort((a, b) => {
            const dateA = new Date(a.date || a.timestamp || a);
            const dateB = new Date(b.date || b.timestamp || b);
            return dateA - dateB;
        });
    }

    /**
     * Merge two strings (typically notes or descriptions)
     * @param {string} localStr - Local string
     * @param {string} remoteStr - Remote string
     * @returns {string} Merged string
     */
    function mergeStrings(localStr, remoteStr) {
        // If one is empty, return the other
        if (!localStr) return remoteStr;
        if (!remoteStr) return localStr;

        // If they're the same, return either
        if (localStr === remoteStr) return localStr;

        // If one contains the other, return the longer one
        if (remoteStr.includes(localStr)) return remoteStr;
        if (localStr.includes(remoteStr)) return localStr;

        // Otherwise, concatenate with conflict marker
        return `${remoteStr}\n\n--- Local changes ---\n${localStr}`;
    }

    /**
     * Resolve conflict based on device priority
     * @param {Object} localData - Local version
     * @param {Object} remoteData - Remote version
     * @param {Object} context - Context with device priorities
     * @returns {Object} Resolved data
     */
    function resolveByDevicePriority(localData, remoteData, context = {}) {
        const devicePriorities = context.devicePriorities || {
            'desktop': 1,
            'tablet': 2,
            'android': 3
        };

        const localDevice = context.localDeviceType || 'android';
        const remoteDevice = context.remoteDeviceType || 'desktop';

        const localPriority = devicePriorities[localDevice] || 99;
        const remotePriority = devicePriorities[remoteDevice] || 99;

        const winner = localPriority < remotePriority ? localData : remoteData;

        return {
            resolved: { ...winner },
            strategy: 'device-priority',
            winner: localPriority < remotePriority ? 'local' : 'remote',
            conflictDetected: true,
            localVersion: localData,
            remoteVersion: remoteData,
            timestamp: new Date().toISOString(),
            deviceId: context.deviceId || 'unknown'
        };
    }

    // ===== CONFLICT DETECTION =====

    /**
     * Detect if there's a conflict between local and remote data
     * @param {Object} localData - Local version
     * @param {Object} remoteData - Remote version
     * @returns {boolean} True if conflict detected
     */
    function detectConflict(localData, remoteData) {
        if (!localData || !remoteData) return false;

        // Check timestamps
        const localTime = new Date(localData.updatedAt || localData.createdAt).getTime();
        const remoteTime = new Date(remoteData.updatedAt || remoteData.createdAt).getTime();

        // If timestamps are very close (within 1 second), check content
        if (Math.abs(localTime - remoteTime) < 1000) {
            return !areDataEqual(localData, remoteData);
        }

        // If timestamps differ and content differs, it's a conflict
        if (localTime !== remoteTime) {
            return !areDataEqual(localData, remoteData);
        }

        return false;
    }

    /**
     * Check if two data objects are equal
     * @param {Object} data1 - First object
     * @param {Object} data2 - Second object
     * @returns {boolean} True if equal
     */
    function areDataEqual(data1, data2) {
        // Ignore metadata fields
        const ignored = ['updatedAt', 'createdAt', 'id', '_metadata', 'syncedAt'];
        
        const keys1 = Object.keys(data1).filter(k => !ignored.includes(k));
        const keys2 = Object.keys(data2).filter(k => !ignored.includes(k));

        if (keys1.length !== keys2.length) return false;

        for (const key of keys1) {
            if (JSON.stringify(data1[key]) !== JSON.stringify(data2[key])) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get conflict severity level
     * @param {Object} localData - Local version
     * @param {Object} remoteData - Remote version
     * @returns {string} Severity: 'low', 'medium', 'high'
     */
    function getConflictSeverity(localData, remoteData) {
        let diffCount = 0;
        let criticalDiff = false;

        const criticalFields = ['completed', 'deleted', 'archived', 'title', 'name'];

        for (const key in localData) {
            if (key === 'id' || key === '_metadata') continue;

            if (JSON.stringify(localData[key]) !== JSON.stringify(remoteData[key])) {
                diffCount++;
                if (criticalFields.includes(key)) {
                    criticalDiff = true;
                }
            }
        }

        if (criticalDiff) return 'high';
        if (diffCount > 5) return 'medium';
        return 'low';
    }

    // ===== MAIN RESOLUTION FUNCTION =====

    /**
     * Resolve conflict between local and remote data
     * @param {Object} localData - Local version
     * @param {Object} remoteData - Remote version
     * @param {Object} options - Resolution options
     * @returns {Promise<Object>} Resolution result
     */
    async function resolveConflict(localData, remoteData, options = {}) {
        const strategy = options.strategy || CONFIG.DEFAULT_STRATEGY;
        const context = {
            deviceId: DeviceManager.isReady() ? DeviceManager.getCurrentDevice().deviceId : 'unknown',
            localDeviceType: DeviceManager.isReady() ? DeviceManager.getCurrentDevice().deviceType : 'unknown',
            remoteDeviceType: options.remoteDeviceType || 'unknown',
            collection: options.collection || 'unknown',
            ...options
        };

        // Detect conflict
        const hasConflict = detectConflict(localData, remoteData);
        
        if (!hasConflict) {
            return {
                resolved: remoteData,
                strategy: 'no-conflict',
                conflictDetected: false
            };
        }

        let result;

        // Apply resolution strategy
        switch (strategy) {
            case 'timestamp':
                result = resolveByTimestamp(localData, remoteData, context);
                break;
            
            case 'merge':
                result = resolveByMerge(localData, remoteData, context);
                break;
            
            case 'device-priority':
                result = resolveByDevicePriority(localData, remoteData, context);
                break;
            
            case 'manual':
                result = {
                    resolved: null,
                    strategy: 'manual',
                    conflictDetected: true,
                    requiresManualResolution: true,
                    localVersion: localData,
                    remoteVersion: remoteData,
                    timestamp: new Date().toISOString()
                };
                break;
            
            default:
                result = resolveByTimestamp(localData, remoteData, context);
        }

        // Log conflict
        if (CONFIG.PRESERVE_HISTORY && result.conflictDetected) {
            await logConflict(result);
        }

        // Dispatch conflict event
        document.dispatchEvent(new CustomEvent('conflictResolved', {
            detail: result
        }));

        console.log(`⚔️ Conflict resolved using ${strategy} strategy:`, result);

        return result;
    }

    // ===== CONFLICT LOGGING =====

    /**
     * Log conflict for history and debugging
     * @param {Object} conflictResult - Conflict resolution result
     * @returns {Promise<void>}
     */
    async function logConflict(conflictResult) {
        if (!currentUserId || typeof firebase === 'undefined') {
            return;
        }

        try {
            const log = {
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                strategy: conflictResult.strategy,
                winner: conflictResult.winner || 'merged',
                collection: conflictResult.collection || 'unknown',
                deviceId: conflictResult.deviceId,
                severity: getConflictSeverity(conflictResult.localVersion, conflictResult.remoteVersion),
                localVersion: conflictResult.localVersion,
                remoteVersion: conflictResult.remoteVersion,
                resolved: conflictResult.resolved
            };

            await firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection(CONFIG.CONFLICT_LOG_COLLECTION)
                .add(log);

            // Clean up old logs
            await cleanupOldConflictLogs();

        } catch (error) {
            console.error('❌ Error logging conflict:', error);
        }
    }

    /**
     * Get conflict history
     * @param {number} limit - Number of conflicts to retrieve
     * @returns {Promise<Array>} Array of conflict logs
     */
    async function getConflictHistory(limit = 50) {
        if (!currentUserId || typeof firebase === 'undefined') {
            return [];
        }

        try {
            const snapshot = await firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection(CONFIG.CONFLICT_LOG_COLLECTION)
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();

            const conflicts = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                conflicts.push({
                    id: doc.id,
                    ...data,
                    timestamp: data.timestamp ? data.timestamp.toDate().toISOString() : null
                });
            });

            return conflicts;
        } catch (error) {
            console.error('❌ Error getting conflict history:', error);
            return [];
        }
    }

    /**
     * Clean up old conflict logs (keep only MAX_CONFLICT_HISTORY)
     * @returns {Promise<number>} Number of logs deleted
     */
    async function cleanupOldConflictLogs() {
        if (!currentUserId || typeof firebase === 'undefined') {
            return 0;
        }

        try {
            const snapshot = await firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection(CONFIG.CONFLICT_LOG_COLLECTION)
                .orderBy('timestamp', 'desc')
                .get();

            if (snapshot.size <= CONFIG.MAX_CONFLICT_HISTORY) {
                return 0;
            }

            const toDelete = [];
            snapshot.forEach((doc, index) => {
                if (index >= CONFIG.MAX_CONFLICT_HISTORY) {
                    toDelete.push(doc.ref);
                }
            });

            const batch = firebase.firestore().batch();
            toDelete.forEach(ref => batch.delete(ref));
            await batch.commit();

            console.log(`🧹 Cleaned up ${toDelete.length} old conflict logs`);
            return toDelete.length;
        } catch (error) {
            console.error('❌ Error cleaning up conflict logs:', error);
            return 0;
        }
    }

    // ===== BULK CONFLICT RESOLUTION =====

    /**
     * Resolve multiple conflicts in batch
     * @param {Array} conflicts - Array of conflict objects
     * @param {Object} options - Resolution options
     * @returns {Promise<Array>} Array of resolved conflicts
     */
    async function resolveMultipleConflicts(conflicts, options = {}) {
        const results = [];

        for (const conflict of conflicts) {
            const result = await resolveConflict(
                conflict.localData,
                conflict.remoteData,
                { ...options, collection: conflict.collection }
            );
            results.push(result);
        }

        return results;
    }

    // ===== CONFLICT STATISTICS =====

    /**
     * Get conflict statistics
     * @param {number} days - Number of days to analyze
     * @returns {Promise<Object>} Conflict statistics
     */
    async function getConflictStatistics(days = 7) {
        const history = await getConflictHistory(1000);
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const recent = history.filter(c => 
            c.timestamp && new Date(c.timestamp) > cutoffDate
        );

        const stats = {
            total: recent.length,
            byStrategy: {},
            bySeverity: {},
            byCollection: {},
            averagePerDay: recent.length / days
        };

        recent.forEach(conflict => {
            // By strategy
            stats.byStrategy[conflict.strategy] = (stats.byStrategy[conflict.strategy] || 0) + 1;
            
            // By severity
            stats.bySeverity[conflict.severity] = (stats.bySeverity[conflict.severity] || 0) + 1;
            
            // By collection
            stats.byCollection[conflict.collection] = (stats.byCollection[conflict.collection] || 0) + 1;
        });

        return stats;
    }

    // ===== PUBLIC API =====

    return {
        // Main resolution
        resolveConflict,
        resolveMultipleConflicts,

        // Detection
        detectConflict,
        areDataEqual,
        getConflictSeverity,

        // Individual strategies
        resolveByTimestamp,
        resolveByMerge,
        resolveByDevicePriority,

        // History and logging
        getConflictHistory,
        getConflictStatistics,
        cleanupOldConflictLogs,

        // Configuration
        CONFIG
    };

})();

console.log('⚔️ ConflictResolver module loaded');
