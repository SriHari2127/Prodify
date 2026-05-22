// ===== BACKGROUND TASK RUNNER =====
// Manages background synchronization using Capacitor BackgroundTask plugin

class BackgroundTaskRunner {
    constructor() {
        this.isRunning = false;
        this.taskId = null;
        this.lastRunTime = null;
        this.runCount = 0;
        this.isCapacitorAvailable = false;
        this.checkCapacitorAvailability();
    }

    /**
     * Check if Capacitor and required plugins are available
     */
    checkCapacitorAvailability() {
        try {
            this.isCapacitorAvailable = typeof Capacitor !== 'undefined' && 
                                       Capacitor.getPlatform() !== 'web';
            
            if (this.isCapacitorAvailable) {
                console.log('✅ Capacitor detected:', Capacitor.getPlatform());
            } else {
                console.log('ℹ️ Running in web mode (Capacitor not available)');
            }
        } catch (error) {
            this.isCapacitorAvailable = false;
            console.log('ℹ️ Capacitor not available');
        }
    }

    /**
     * Register background task for Android
     * @returns {Promise<void>}
     */
    async registerBackgroundTask() {
        if (!this.isCapacitorAvailable) {
            console.log('⚠️ Background tasks not available in web mode');
            return;
        }

        try {
            // Check if BackgroundTask plugin is available
            if (typeof Capacitor.Plugins.BackgroundTask === 'undefined') {
                console.warn('⚠️ BackgroundTask plugin not available');
                return;
            }

            // Register periodic background task
            await Capacitor.Plugins.BackgroundTask.registerPeriodicTask({
                taskId: 'sync-task',
                interval: 900, // 15 minutes (minimum on Android)
                requiresCharging: false,
                requiresNetworkType: 'any', // any, none, unmetered
                requiresDeviceIdle: false
            });

            console.log('✅ Background sync task registered');

        } catch (error) {
            console.error('❌ Error registering background task:', error);
        }
    }

    /**
     * Start background sync
     * @returns {Promise<void>}
     */
    async startBackgroundSync() {
        if (!this.isCapacitorAvailable) {
            console.log('ℹ️ Using web-based periodic sync');
            this.startWebPeriodicSync();
            return;
        }

        try {
            console.log('🔄 Starting background sync...');
            
            this.taskId = `sync-${Date.now()}`;
            this.isRunning = true;

            // Run sync
            const result = await syncManager.triggerSync('BACKGROUND');
            
            this.lastRunTime = new Date().toISOString();
            this.runCount++;
            
            console.log(`✅ Background sync completed:`, result);

            this.isRunning = false;

            // Finish background task (important for Android)
            if (typeof Capacitor.Plugins.BackgroundTask !== 'undefined') {
                await Capacitor.Plugins.BackgroundTask.finish({
                    taskId: this.taskId
                });
            }

        } catch (error) {
            console.error('❌ Background sync failed:', error);
            this.isRunning = false;

            // Still finish the task to avoid system penalties
            if (this.isCapacitorAvailable && typeof Capacitor.Plugins.BackgroundTask !== 'undefined') {
                await Capacitor.Plugins.BackgroundTask.finish({
                    taskId: this.taskId
                });
            }
        }
    }

    /**
     * Start periodic sync for web (fallback)
     */
    startWebPeriodicSync() {
        // Use Page Visibility API to sync when app becomes visible
        document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible') {
                console.log('👁️ App became visible - checking for pending sync');
                
                const pendingCount = await syncQueueProcessor.getPendingCount();
                if (pendingCount > 0 && networkMonitor.isOnline) {
                    await syncManager.triggerSync('VISIBILITY_CHANGE');
                }
            }
        });

        // Sync when page is about to unload (beforeunload)
        window.addEventListener('beforeunload', async () => {
            const pendingCount = await syncQueueProcessor.getPendingCount();
            if (pendingCount > 0 && networkMonitor.isOnline) {
                // Quick sync before unload (limited time available)
                await syncQueueProcessor.processQueue(5); // Small batch
            }
        });

        console.log('✅ Web periodic sync handlers registered');
    }

    /**
     * Schedule sync when app goes to background
     * @returns {Promise<void>}
     */
    async scheduleBackgroundSync() {
        if (!this.isCapacitorAvailable) {
            return;
        }

        try {
            // Use Capacitor App plugin to detect background state
            const { App } = Capacitor.Plugins;
            
            if (typeof App !== 'undefined') {
                App.addListener('appStateChange', async ({ isActive }) => {
                    if (!isActive) {
                        console.log('📱 App moved to background - scheduling sync');
                        await this.startBackgroundSync();
                    } else {
                        console.log('📱 App moved to foreground - checking pending sync');
                        await syncManager.triggerSync('FOREGROUND');
                    }
                });

                console.log('✅ Background sync scheduler initialized');
            }

        } catch (error) {
            console.error('❌ Error setting up background sync scheduler:', error);
        }
    }

    /**
     * Sync when device resumes from sleep
     * @returns {Promise<void>}
     */
    async syncOnResume() {
        if (!this.isCapacitorAvailable) {
            return;
        }

        try {
            const { App } = Capacitor.Plugins;
            
            if (typeof App !== 'undefined') {
                App.addListener('resume', async () => {
                    console.log('⏰ Device resumed from sleep - syncing');
                    await syncManager.triggerSync('RESUME');
                });
            }

        } catch (error) {
            console.error('❌ Error setting up resume sync:', error);
        }
    }

    /**
     * Initialize all background sync mechanisms
     * @returns {Promise<void>}
     */
    async initialize() {
        console.log('🔄 Initializing Background Task Runner...');

        try {
            // Register platform-specific background tasks
            if (this.isCapacitorAvailable) {
                await this.registerBackgroundTask();
                await this.scheduleBackgroundSync();
                await this.syncOnResume();
            } else {
                this.startWebPeriodicSync();
            }

            // Set up focus session completion handler
            this.setupFocusSessionHandler();

            console.log('✅ Background Task Runner initialized');

        } catch (error) {
            console.error('❌ Error initializing Background Task Runner:', error);
        }
    }

    /**
     * Set up handler for focus session completion
     */
    setupFocusSessionHandler() {
        // Listen for custom focus session complete event
        window.addEventListener('focusSessionComplete', async () => {
            console.log('🎯 Focus session completed - triggering sync');
            await syncManager.syncAfterFocusSession();
        });

        console.log('✅ Focus session sync handler registered');
    }

    /**
     * Manually trigger background sync
     * @returns {Promise<Object>} Sync result
     */
    async triggerManualBackgroundSync() {
        console.log('🔄 Manual background sync triggered');
        return await this.startBackgroundSync();
    }

    /**
     * Get background task status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            taskId: this.taskId,
            lastRunTime: this.lastRunTime,
            runCount: this.runCount,
            isCapacitorAvailable: this.isCapacitorAvailable,
            platform: this.isCapacitorAvailable ? Capacitor.getPlatform() : 'web'
        };
    }

    /**
     * Get background task statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            ...this.getStatus(),
            averageTimeBetweenRuns: this.calculateAverageTimeBetweenRuns()
        };
    }

    /**
     * Calculate average time between background runs
     * @returns {number|null} Average time in milliseconds
     */
    calculateAverageTimeBetweenRuns() {
        // Placeholder - would need to track run times
        return null;
    }

    /**
     * Cancel background task (Android)
     * @returns {Promise<void>}
     */
    async cancelBackgroundTask() {
        if (!this.isCapacitorAvailable) {
            return;
        }

        try {
            if (typeof Capacitor.Plugins.BackgroundTask !== 'undefined') {
                await Capacitor.Plugins.BackgroundTask.cancel({
                    taskId: 'sync-task'
                });
                console.log('✅ Background task cancelled');
            }
        } catch (error) {
            console.error('❌ Error cancelling background task:', error);
        }
    }

    /**
     * Cleanup and destroy
     */
    destroy() {
        this.isRunning = false;
        this.taskId = null;
        console.log('✅ Background Task Runner destroyed');
    }
}

// Create singleton instance
const backgroundTaskRunner = new BackgroundTaskRunner();

// Export to window for global access
window.backgroundTaskRunner = backgroundTaskRunner;

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = backgroundTaskRunner;
}

// NOTE: No auto-initialization - controlled by StartupManager Phase 2
// Background Task Runner initializes after UI is visible for optimal startup performance
