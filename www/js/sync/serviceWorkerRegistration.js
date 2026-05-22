// ===== SERVICE WORKER REGISTRATION =====
// Handles Service Worker registration and communication

/**
 * Service Worker Registration Manager
 */
class ServiceWorkerManager {
    constructor() {
        this.registration = null;
        this.isSupported = 'serviceWorker' in navigator;
        this.isSyncSupported = this.isSupported && 'SyncManager' in window;
        this.isPeriodicSyncSupported = this.isSupported && 'PeriodicSyncManager' in window;
    }

    /**
     * Register the service worker
     * @returns {Promise<ServiceWorkerRegistration>}
     */
    async register() {
        if (!this.isSupported) {
            console.warn('⚠️ Service Workers not supported in this browser');
            return null;
        }

        try {
            console.log('📝 Registering Service Worker...');
            
            // Use relative path that works from index.html location
            this.registration = await navigator.serviceWorker.register('./service-worker.js');

            console.log('✅ Service Worker registered:', this.registration.scope);

            // Handle updates
            this.registration.addEventListener('updatefound', () => {
                const newWorker = this.registration.installing;
                console.log('🔄 Service Worker update found');
                
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New service worker available
                        this.onUpdateAvailable();
                    }
                });
            });

            // Listen for controller change
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('🔄 Service Worker controller changed');
                window.location.reload();
            });

            // Listen for messages from service worker
            navigator.serviceWorker.addEventListener('message', (event) => {
                this.handleMessage(event.data);
            });

            // Check for background sync support
            await this.checkSyncSupport();

            return this.registration;
            
        } catch (error) {
            console.error('❌ Service Worker registration failed:', error);
            return null;
        }
    }

    /**
     * Check background sync support
     * @returns {Promise<void>}
     */
    async checkSyncSupport() {
        if (this.registration) {
            this.isSyncSupported = 'sync' in this.registration;
            
            if ('periodicSync' in this.registration) {
                try {
                    const status = await navigator.permissions.query({
                        name: 'periodic-background-sync'
                    });
                    this.isPeriodicSyncSupported = status.state === 'granted';
                } catch (error) {
                    this.isPeriodicSyncSupported = false;
                }
            }
            
            console.log('🔍 Background Sync supported:', this.isSyncSupported);
            console.log('🔍 Periodic Sync supported:', this.isPeriodicSyncSupported);
        }
    }

    /**
     * Register background sync
     * @returns {Promise<void>}
     */
    async registerBackgroundSync() {
        if (!this.isSyncSupported) {
            console.log('ℹ️ Background Sync not available - app will use real-time sync instead');
            return;
        }

        if (!this.registration) {
            console.log('ℹ️ Service Worker not registered - background sync unavailable');
            return;
        }

        // Wait for service worker to be active
        if (this.registration.active) {
            try {
                await this.registration.sync.register('prodify-sync');
                console.log('✅ Background sync registered');
            } catch (error) {
                console.error('❌ Failed to register background sync:', error);
            }
        } else {
            console.log('ℹ️ Service Worker activating... background sync will be enabled shortly');
        }
    }

    /**
     * Register periodic background sync (Chrome 80+)
     * @param {number} minInterval - Minimum interval in milliseconds
     * @returns {Promise<void>}
     */
    async registerPeriodicSync(minInterval = 900000) { // 15 minutes
        if (!this.isPeriodicSyncSupported) {
            console.log('ℹ️ Periodic Background Sync not available (Chrome 80+ PWA only) - using standard sync instead');
            return;
        }

        if (!this.registration) {
            console.log('ℹ️ Service Worker not registered - periodic sync unavailable');
            return;
        }

        // Wait for service worker to be active
        if (this.registration.active) {
            try {
                await this.registration.periodicSync.register('prodify-periodic-sync', {
                    minInterval: minInterval
                });
                console.log('✅ Periodic background sync registered');
            } catch (error) {
                console.error('❌ Failed to register periodic sync:', error);
            }
        } else {
            console.log('ℹ️ Service Worker activating... periodic sync will be enabled shortly');
        }
    }

    /**
     * Unregister periodic background sync
     * @returns {Promise<void>}
     */
    async unregisterPeriodicSync() {
        if (!this.isPeriodicSyncSupported) {
            return;
        }

        try {
            await this.registration.periodicSync.unregister('prodify-periodic-sync');
            console.log('✅ Periodic background sync unregistered');
        } catch (error) {
            console.error('❌ Failed to unregister periodic sync:', error);
        }
    }

    /**
     * Get periodic sync tags
     * @returns {Promise<Array<string>>}
     */
    async getPeriodicSyncTags() {
        if (!this.isPeriodicSyncSupported) {
            return [];
        }

        try {
            return await this.registration.periodicSync.getTags();
        } catch (error) {
            console.error('❌ Failed to get periodic sync tags:', error);
            return [];
        }
    }

    /**
     * Send message to service worker
     * @param {Object} message - Message to send
     * @returns {Promise<void>}
     */
    async sendMessage(message) {
        if (!this.registration || !navigator.serviceWorker.controller) {
            console.warn('⚠️ No active service worker controller');
            return;
        }

        navigator.serviceWorker.controller.postMessage(message);
    }

    /**
     * Handle message from service worker
     * @param {Object} data - Message data
     */
    handleMessage(data) {
        const { type, success, failed } = data;

        switch (type) {
            case 'SYNC_COMPLETE':
                console.log(`✅ Sync complete: ${success} success, ${failed} failed`);
                
                // Trigger UI update
                if (window.syncManager) {
                    window.syncManager.triggerSync({ reason: 'SERVICE_WORKER_COMPLETE' });
                }
                
                // Dispatch custom event
                window.dispatchEvent(new CustomEvent('backgroundSyncComplete', {
                    detail: { success, failed }
                }));
                break;

            default:
                console.log('📬 Received message from Service Worker:', data);
        }
    }

    /**
     * Called when service worker update is available
     */
    onUpdateAvailable() {
        console.log('🔔 New version available');
        
        // Show notification to user
        if (window.confirm('A new version is available. Reload to update?')) {
            this.skipWaiting();
        }
    }

    /**
     * Skip waiting and activate new service worker
     * @returns {Promise<void>}
     */
    async skipWaiting() {
        if (!this.registration || !this.registration.waiting) {
            return;
        }

        await this.sendMessage({ type: 'SKIP_WAITING' });
    }

    /**
     * Unregister service worker
     * @returns {Promise<boolean>}
     */
    async unregister() {
        if (!this.registration) {
            return false;
        }

        try {
            const result = await this.registration.unregister();
            console.log('✅ Service Worker unregistered');
            return result;
        } catch (error) {
            console.error('❌ Failed to unregister service worker:', error);
            return false;
        }
    }

    /**
     * Clear cache
     * @returns {Promise<void>}
     */
    async clearCache() {
        await this.sendMessage({ type: 'CLEAR_CACHE' });
    }

    /**
     * Get registration details
     * @returns {Object}
     */
    getInfo() {
        if (!this.registration) {
            return {
                supported: this.isSupported,
                registered: false,
                syncSupported: false,
                periodicSyncSupported: false
            };
        }

        return {
            supported: this.isSupported,
            registered: true,
            scope: this.registration.scope,
            active: !!this.registration.active,
            installing: !!this.registration.installing,
            waiting: !!this.registration.waiting,
            syncSupported: this.isSyncSupported,
            periodicSyncSupported: this.isPeriodicSyncSupported
        };
    }
}

// ===== INITIALIZE ON DOM READY =====
const serviceWorkerManager = new ServiceWorkerManager();

// Export globally for use by StartupManager
window.serviceWorkerManager = serviceWorkerManager;

// NOTE: No auto-initialization - controlled by StartupManager Phase 2
// Service Worker registers after UI is visible (delayed 3 seconds) for optimal startup performance

/**
 * Initialize service worker
 * @returns {Promise<void>}
 */
async function initializeServiceWorker() {
    try {
        await serviceWorkerManager.register();
        
        // Wait a bit for service worker to activate
        if (serviceWorkerManager.registration) {
            await serviceWorkerManager.registration.update();
            
            // Wait for active state
            if (serviceWorkerManager.registration.active) {
                // Register background sync
                await serviceWorkerManager.registerBackgroundSync();
                
                // Register periodic sync (if supported)
                await serviceWorkerManager.registerPeriodicSync(900000); // 15 minutes
            } else {
                console.log('ℹ️ Service Worker not active yet, sync features will be registered when activated');
            }
        }
        
        console.log('✅ Service Worker initialized');
        
        // Log support info
        console.log('ℹ️ Service Worker info:', serviceWorkerManager.getInfo());
        
    } catch (error) {
        console.error('❌ Failed to initialize Service Worker:', error);
    }
}

// Export singleton
window.serviceWorkerManager = serviceWorkerManager;

// ===== UTILITY FUNCTIONS =====

/**
 * Trigger background sync manually
 * @returns {Promise<void>}
 */
async function triggerBackgroundSync() {
    await serviceWorkerManager.registerBackgroundSync();
}

/**
 * Check if offline
 * @returns {boolean}
 */
function isOffline() {
    return !navigator.onLine;
}

/**
 * Wait for service worker to be ready
 * @returns {Promise<ServiceWorkerRegistration>}
 */
async function waitForServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        throw new Error('Service Workers not supported');
    }
    
    return await navigator.serviceWorker.ready;
}

// Export utilities
window.triggerBackgroundSync = triggerBackgroundSync;
window.isOffline = isOffline;
window.waitForServiceWorker = waitForServiceWorker;

console.log('✅ Service Worker registration module loaded');
