// ===== DEVICE ANALYTICS MODULE =====
// Tracks device usage patterns, sync performance, and cross-device metrics
// Provides insights for optimization and user behavior analysis

const DeviceAnalytics = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    
    const CONFIG = {
        ANALYTICS_COLLECTION: 'deviceAnalytics',
        TRACK_INTERVAL: 60000, // 1 minute
        SAVE_INTERVAL: 300000, // 5 minutes
        RETENTION_DAYS: 90,
        ENABLE_DETAILED_TRACKING: true
    };

    // ===== STATE =====
    
    let currentMetrics = {
        deviceId: null,
        sessionStart: null,
        sessionDuration: 0,
        actionsPerformed: 0,
        syncEvents: 0,
        syncErrors: 0,
        dataTransferred: 0,
        conflictsResolved: 0,
        offlinePeriods: 0,
        networkSwitches: 0
    };

    let periodicMetrics = [];
    let isTracking = false;
    let trackingInterval = null;
    let saveInterval = null;

    // ===== INITIALIZATION =====

    /**
     * Initialize device analytics tracking
     * @returns {Promise<void>}
     */
    async function initialize() {
        if (isTracking) {
            console.log('⚠️ DeviceAnalytics already tracking');
            return;
        }

        if (!DeviceManager.isReady()) {
            console.log('⚠️ DeviceManager not ready');
            return;
        }

        try {
            const device = DeviceManager.getCurrentDevice();
            currentMetrics.deviceId = device.deviceId;
            currentMetrics.sessionStart = new Date().toISOString();

            // Setup event listeners
            setupEventListeners();

            // Start tracking intervals
            startTracking();

            isTracking = true;
            console.log('✅ DeviceAnalytics initialized');

        } catch (error) {
            console.error('❌ Error initializing DeviceAnalytics:', error);
            throw error;
        }
    }

    /**
     * Setup event listeners for tracking
     */
    function setupEventListeners() {
        // Sync events
        document.addEventListener('syncCompleted', (e) => {
            currentMetrics.syncEvents++;
            if (e.detail && e.detail.success) {
                trackSyncPerformance(e.detail);
            }
        });

        document.addEventListener('syncStateChanged', (e) => {
            if (e.detail && e.detail.status === 'error') {
                currentMetrics.syncErrors++;
            }
        });

        // Conflict events
        document.addEventListener('conflictResolved', () => {
            currentMetrics.conflictsResolved++;
        });

        // Network events
        window.addEventListener('online', () => {
            currentMetrics.networkSwitches++;
            trackNetworkEvent('online');
        });

        window.addEventListener('offline', () => {
            currentMetrics.offlinePeriods++;
            trackNetworkEvent('offline');
        });

        // Data events
        document.addEventListener('tasksUpdated', () => {
            currentMetrics.actionsPerformed++;
        });

        document.addEventListener('habitsUpdated', () => {
            currentMetrics.actionsPerformed++;
        });

        document.addEventListener('focusSessionsUpdated', () => {
            currentMetrics.actionsPerformed++;
        });
    }

    /**
     * Start periodic tracking
     */
    function startTracking() {
        // Update session duration
        trackingInterval = setInterval(() => {
            updateSessionDuration();
            capturePeriodicMetrics();
        }, CONFIG.TRACK_INTERVAL);

        // Save analytics periodically
        saveInterval = setInterval(() => {
            saveAnalytics();
        }, CONFIG.SAVE_INTERVAL);

        // Save on page unload
        window.addEventListener('beforeunload', () => {
            saveAnalytics();
        });
    }

    /**
     * Stop tracking
     */
    function stopTracking() {
        if (trackingInterval) {
            clearInterval(trackingInterval);
            trackingInterval = null;
        }

        if (saveInterval) {
            clearInterval(saveInterval);
            saveInterval = null;
        }

        isTracking = false;
        console.log('🛑 DeviceAnalytics tracking stopped');
    }

    // ===== METRICS TRACKING =====

    /**
     * Update session duration
     */
    function updateSessionDuration() {
        if (currentMetrics.sessionStart) {
            const start = new Date(currentMetrics.sessionStart);
            const now = new Date();
            currentMetrics.sessionDuration = Math.floor((now - start) / 1000); // seconds
        }
    }

    /**
     * Capture periodic metrics snapshot
     */
    function capturePeriodicMetrics() {
        const device = DeviceManager.getCurrentDevice();
        
        const snapshot = {
            timestamp: new Date().toISOString(),
            deviceId: currentMetrics.deviceId,
            deviceType: device.deviceType,
            sessionDuration: currentMetrics.sessionDuration,
            actionsPerformed: currentMetrics.actionsPerformed,
            syncEvents: currentMetrics.syncEvents,
            syncErrors: currentMetrics.syncErrors,
            dataTransferred: currentMetrics.dataTransferred,
            conflictsResolved: currentMetrics.conflictsResolved,
            online: navigator.onLine,
            batteryLevel: null, // Will be populated if Battery API available
            memoryUsage: null // Will be populated if available
        };

        // Get battery level if available
        if ('getBattery' in navigator) {
            navigator.getBattery().then(battery => {
                snapshot.batteryLevel = Math.round(battery.level * 100);
            });
        }

        // Get memory usage if available
        if ('memory' in performance && 'usedJSHeapSize' in performance.memory) {
            snapshot.memoryUsage = Math.round(performance.memory.usedJSHeapSize / 1048576); // MB
        }

        periodicMetrics.push(snapshot);

        // Keep only last 100 snapshots in memory
        if (periodicMetrics.length > 100) {
            periodicMetrics = periodicMetrics.slice(-100);
        }
    }

    /**
     * Track sync performance
     * @param {Object} syncResult - Sync result details
     */
    function trackSyncPerformance(syncResult) {
        const performance = {
            timestamp: new Date().toISOString(),
            success: syncResult.success || 0,
            failed: syncResult.failed || 0,
            duration: syncResult.duration || 0,
            dataSize: syncResult.dataSize || 0
        };

        // Add to data transferred
        if (performance.dataSize) {
            currentMetrics.dataTransferred += performance.dataSize;
        }

        // Store in IndexedDB analytics table if available
        if (typeof db !== 'undefined' && db.analytics) {
            db.analytics.add({
                date: new Date().toISOString(),
                metric: 'sync_performance',
                value: JSON.stringify(performance),
                createdAt: new Date().toISOString()
            }).catch(console.error);
        }
    }

    /**
     * Track network event
     * @param {string} type - Event type (online/offline)
     */
    function trackNetworkEvent(type) {
        const event = {
            timestamp: new Date().toISOString(),
            type: type,
            deviceId: currentMetrics.deviceId
        };

        // Store event
        if (typeof db !== 'undefined' && db.analytics) {
            db.analytics.add({
                date: new Date().toISOString(),
                metric: 'network_event',
                value: JSON.stringify(event),
                createdAt: new Date().toISOString()
            }).catch(console.error);
        }
    }

    // ===== ANALYTICS PERSISTENCE =====

    /**
     * Save analytics to Firestore
     * @returns {Promise<void>}
     */
    async function saveAnalytics() {
        if (!currentUserId || typeof firebase === 'undefined' || !DeviceManager.isReady()) {
            return;
        }

        try {
            updateSessionDuration();

            const device = DeviceManager.getCurrentDevice();
            const analyticsData = {
                deviceId: currentMetrics.deviceId,
                deviceType: device.deviceType,
                sessionStart: currentMetrics.sessionStart,
                sessionDuration: currentMetrics.sessionDuration,
                actionsPerformed: currentMetrics.actionsPerformed,
                syncEvents: currentMetrics.syncEvents,
                syncErrors: currentMetrics.syncErrors,
                dataTransferred: currentMetrics.dataTransferred,
                conflictsResolved: currentMetrics.conflictsResolved,
                offlinePeriods: currentMetrics.offlinePeriods,
                networkSwitches: currentMetrics.networkSwitches,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                date: new Date().toISOString().split('T')[0] // YYYY-MM-DD
            };

            await firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection(CONFIG.ANALYTICS_COLLECTION)
                .add(analyticsData);

            console.log('💾 Analytics saved to Firestore');

        } catch (error) {
            console.error('❌ Error saving analytics:', error);
        }
    }

    /**
     * Get analytics for date range
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @returns {Promise<Array>} Analytics data
     */
    async function getAnalytics(startDate, endDate) {
        if (!currentUserId || typeof firebase === 'undefined') {
            return [];
        }

        try {
            const snapshot = await firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection(CONFIG.ANALYTICS_COLLECTION)
                .where('date', '>=', startDate)
                .where('date', '<=', endDate)
                .orderBy('date', 'desc')
                .get();

            const analytics = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                analytics.push({
                    id: doc.id,
                    ...data,
                    timestamp: data.timestamp ? data.timestamp.toDate().toISOString() : null
                });
            });

            return analytics;
        } catch (error) {
            console.error('❌ Error getting analytics:', error);
            return [];
        }
    }

    /**
     * Clean up old analytics data
     * @returns {Promise<number>} Number of records deleted
     */
    async function cleanupOldAnalytics() {
        if (!currentUserId || typeof firebase === 'undefined') {
            return 0;
        }

        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - CONFIG.RETENTION_DAYS);
            const cutoffDateString = cutoffDate.toISOString().split('T')[0];

            const snapshot = await firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection(CONFIG.ANALYTICS_COLLECTION)
                .where('date', '<', cutoffDateString)
                .get();

            const batch = firebase.firestore().batch();
            let count = 0;

            snapshot.forEach(doc => {
                batch.delete(doc.ref);
                count++;
            });

            if (count > 0) {
                await batch.commit();
                console.log(`🧹 Cleaned up ${count} old analytics records`);
            }

            return count;
        } catch (error) {
            console.error('❌ Error cleaning up analytics:', error);
            return 0;
        }
    }

    // ===== ANALYTICS QUERIES =====

    /**
     * Get device usage summary
     * @param {number} days - Number of days to analyze
     * @returns {Promise<Object>} Usage summary
     */
    async function getDeviceUsageSummary(days = 7) {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const analytics = await getAnalytics(startDate, endDate);

        if (analytics.length === 0) {
            return null;
        }

        const summary = {
            totalSessions: analytics.length,
            totalDuration: 0,
            totalActions: 0,
            totalSyncEvents: 0,
            totalSyncErrors: 0,
            totalConflicts: 0,
            averageSessionDuration: 0,
            devicesUsed: new Set(),
            deviceBreakdown: {}
        };

        analytics.forEach(record => {
            summary.totalDuration += record.sessionDuration || 0;
            summary.totalActions += record.actionsPerformed || 0;
            summary.totalSyncEvents += record.syncEvents || 0;
            summary.totalSyncErrors += record.syncErrors || 0;
            summary.totalConflicts += record.conflictsResolved || 0;
            summary.devicesUsed.add(record.deviceId);

            // Device breakdown
            const deviceType = record.deviceType || 'unknown';
            if (!summary.deviceBreakdown[deviceType]) {
                summary.deviceBreakdown[deviceType] = {
                    sessions: 0,
                    duration: 0,
                    actions: 0
                };
            }
            summary.deviceBreakdown[deviceType].sessions++;
            summary.deviceBreakdown[deviceType].duration += record.sessionDuration || 0;
            summary.deviceBreakdown[deviceType].actions += record.actionsPerformed || 0;
        });

        summary.averageSessionDuration = Math.round(summary.totalDuration / summary.totalSessions);
        summary.devicesUsed = summary.devicesUsed.size;

        return summary;
    }

    /**
     * Get sync performance metrics
     * @param {number} days - Number of days to analyze
     * @returns {Promise<Object>} Sync metrics
     */
    async function getSyncMetrics(days = 7) {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const analytics = await getAnalytics(startDate, endDate);

        const metrics = {
            totalSyncEvents: 0,
            totalSyncErrors: 0,
            successRate: 0,
            averageLatency: 0,
            dataTransferred: 0,
            conflictsResolved: 0
        };

        let latencySum = 0;
        let latencyCount = 0;

        analytics.forEach(record => {
            metrics.totalSyncEvents += record.syncEvents || 0;
            metrics.totalSyncErrors += record.syncErrors || 0;
            metrics.dataTransferred += record.dataTransferred || 0;
            metrics.conflictsResolved += record.conflictsResolved || 0;
        });

        if (metrics.totalSyncEvents > 0) {
            metrics.successRate = ((metrics.totalSyncEvents - metrics.totalSyncErrors) / metrics.totalSyncEvents * 100).toFixed(2);
        }

        return metrics;
    }

    /**
     * Get device comparison
     * @param {number} days - Number of days to analyze
     * @returns {Promise<Object>} Device comparison
     */
    async function getDeviceComparison(days = 7) {
        const summary = await getDeviceUsageSummary(days);
        
        if (!summary || !summary.deviceBreakdown) {
            return null;
        }

        const devices = Object.keys(summary.deviceBreakdown).map(deviceType => {
            const data = summary.deviceBreakdown[deviceType];
            return {
                deviceType: deviceType,
                sessions: data.sessions,
                duration: data.duration,
                actions: data.actions,
                averageDuration: Math.round(data.duration / data.sessions),
                actionsPerSession: Math.round(data.actions / data.sessions)
            };
        });

        // Sort by total duration
        devices.sort((a, b) => b.duration - a.duration);

        return {
            devices: devices,
            mostUsedDevice: devices[0]?.deviceType || 'unknown',
            leastUsedDevice: devices[devices.length - 1]?.deviceType || 'unknown'
        };
    }

    /**
     * Get real-time metrics
     * @returns {Object} Current session metrics
     */
    function getCurrentMetrics() {
        updateSessionDuration();
        return { ...currentMetrics };
    }

    /**
     * Get network statistics
     * @param {number} days - Number of days to analyze
     * @returns {Promise<Object>} Network stats
     */
    async function getNetworkStatistics(days = 7) {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const analytics = await getAnalytics(startDate, endDate);

        const stats = {
            totalOfflinePeriods: 0,
            totalNetworkSwitches: 0,
            averageOfflinePeriodsPerSession: 0,
            averageNetworkSwitchesPerSession: 0
        };

        analytics.forEach(record => {
            stats.totalOfflinePeriods += record.offlinePeriods || 0;
            stats.totalNetworkSwitches += record.networkSwitches || 0;
        });

        if (analytics.length > 0) {
            stats.averageOfflinePeriodsPerSession = (stats.totalOfflinePeriods / analytics.length).toFixed(2);
            stats.averageNetworkSwitchesPerSession = (stats.totalNetworkSwitches / analytics.length).toFixed(2);
        }

        return stats;
    }

    // ===== ANALYTICS VISUALIZATION DATA =====

    /**
     * Get data for charts (daily breakdown)
     * @param {number} days - Number of days
     * @returns {Promise<Object>} Chart data
     */
    async function getChartData(days = 7) {
        const endDate = new Date();
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const analytics = await getAnalytics(
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0]
        );

        // Group by date
        const dailyData = {};

        analytics.forEach(record => {
            const date = record.date;
            if (!dailyData[date]) {
                dailyData[date] = {
                    date: date,
                    sessions: 0,
                    duration: 0,
                    actions: 0,
                    syncEvents: 0,
                    conflicts: 0
                };
            }

            dailyData[date].sessions++;
            dailyData[date].duration += record.sessionDuration || 0;
            dailyData[date].actions += record.actionsPerformed || 0;
            dailyData[date].syncEvents += record.syncEvents || 0;
            dailyData[date].conflicts += record.conflictsResolved || 0;
        });

        // Convert to array and sort by date
        const chartData = Object.values(dailyData).sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );

        return {
            labels: chartData.map(d => d.date),
            sessions: chartData.map(d => d.sessions),
            duration: chartData.map(d => Math.round(d.duration / 60)), // minutes
            actions: chartData.map(d => d.actions),
            syncEvents: chartData.map(d => d.syncEvents),
            conflicts: chartData.map(d => d.conflicts)
        };
    }

    // ===== PUBLIC API =====

    return {
        // Initialization
        initialize,
        stopTracking,

        // Metrics
        getCurrentMetrics,
        capturePeriodicMetrics,

        // Persistence
        saveAnalytics,
        getAnalytics,
        cleanupOldAnalytics,

        // Queries
        getDeviceUsageSummary,
        getSyncMetrics,
        getDeviceComparison,
        getNetworkStatistics,
        getChartData,

        // Configuration
        CONFIG
    };

})();

// Auto-initialize when device is registered
document.addEventListener('deviceRegistered', () => {
    setTimeout(() => {
        DeviceAnalytics.initialize().catch(console.error);
    }, 1000);
});

console.log('📊 DeviceAnalytics module loaded');
