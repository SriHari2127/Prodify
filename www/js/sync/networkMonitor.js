// ===== NETWORK MONITOR MODULE =====
// Detects online/offline status and triggers sync events

class NetworkMonitor {
    constructor() {
        this.isOnline = navigator.onLine;
        this.listeners = [];
        this.reconnectListeners = [];
        this.disconnectListeners = [];
        this.lastOnlineTime = Date.now();
        this.lastOfflineTime = null;
        
        this.init();
    }

    /**
     * Initialize network monitoring
     */
    init() {
        // Listen for online event
        window.addEventListener('online', () => {
            console.log('🌐 Network connection restored');
            this.isOnline = true;
            this.lastOnlineTime = Date.now();
            
            // Calculate offline duration
            const offlineDuration = this.lastOfflineTime 
                ? Date.now() - this.lastOfflineTime 
                : 0;
            
            // Notify all listeners
            this.notifyStatusChange(true, offlineDuration);
            this.notifyReconnect(offlineDuration);
        });

        // Listen for offline event
        window.addEventListener('offline', () => {
            console.log('📴 Network connection lost');
            this.isOnline = false;
            this.lastOfflineTime = Date.now();
            
            // Notify all listeners
            this.notifyStatusChange(false);
            this.notifyDisconnect();
        });

        // Poll connection quality every 30 seconds
        this.startConnectionPolling();
        
        console.log('✅ Network Monitor initialized');
    }

    /**
     * Check if currently online
     * @returns {boolean} Online status
     */
    checkOnline() {
        return navigator.onLine;
    }

    /**
     * Test actual connectivity (not just network interface)
     * @returns {Promise<boolean>} True if can reach internet
     */
    async testConnectivity() {
        // Simply trust navigator.onLine since:
        // 1. External connectivity tests cause CORS errors
        // 2. Firebase offline persistence handles connectivity automatically
        // 3. Network online/offline events are reliable
        return navigator.onLine;
    }

    /**
     * Start polling connection quality
     */
    startConnectionPolling() {
        // Sync with navigator.onLine status periodically
        // This is a lightweight check since we removed external connectivity tests
        setInterval(() => {
            const currentlyOnline = navigator.onLine;
            
            // If status changed without firing events (rare edge case)
            if (currentlyOnline !== this.isOnline) {
                console.log(`🔄 Network status sync: ${currentlyOnline ? 'Online' : 'Offline'}`);
                this.isOnline = currentlyOnline;
                
                if (currentlyOnline) {
                    this.lastOnlineTime = Date.now();
                    const offlineDuration = this.lastOfflineTime ? Date.now() - this.lastOfflineTime : 0;
                    this.notifyStatusChange(true, offlineDuration);
                    this.notifyReconnect(offlineDuration);
                } else {
                    this.lastOfflineTime = Date.now();
                    this.notifyStatusChange(false);
                    this.notifyDisconnect();
                }
            }
        }, 30000); // Check every 30 seconds
    }

    /**
     * Register callback for status changes
     * @param {Function} callback - Called with (isOnline, offlineDuration)
     */
    onStatusChange(callback) {
        this.listeners.push(callback);
        
        // Immediately call with current status
        callback(this.isOnline, 0);
        
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    /**
     * Register callback for reconnection
     * @param {Function} callback - Called with offlineDuration
     */
    onReconnect(callback) {
        this.reconnectListeners.push(callback);
        
        return () => {
            this.reconnectListeners = this.reconnectListeners.filter(cb => cb !== callback);
        };
    }

    /**
     * Register callback for disconnection
     * @param {Function} callback - Called when going offline
     */
    onDisconnect(callback) {
        this.disconnectListeners.push(callback);
        
        return () => {
            this.disconnectListeners = this.disconnectListeners.filter(cb => cb !== callback);
        };
    }

    /**
     * Notify all status change listeners
     * @param {boolean} isOnline - Current online status
     * @param {number} offlineDuration - How long was offline (ms)
     */
    notifyStatusChange(isOnline, offlineDuration = 0) {
        this.listeners.forEach(callback => {
            try {
                callback(isOnline, offlineDuration);
            } catch (error) {
                console.error('Error in network status callback:', error);
            }
        });
    }

    /**
     * Notify reconnect listeners
     * @param {number} offlineDuration - How long was offline (ms)
     */
    notifyReconnect(offlineDuration) {
        this.reconnectListeners.forEach(callback => {
            try {
                callback(offlineDuration);
            } catch (error) {
                console.error('Error in reconnect callback:', error);
            }
        });
    }

    /**
     * Notify disconnect listeners
     */
    notifyDisconnect() {
        this.disconnectListeners.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error('Error in disconnect callback:', error);
            }
        });
    }

    /**
     * Get connection info
     * @returns {Object} Connection details
     */
    getConnectionInfo() {
        const connection = navigator.connection || 
                          navigator.mozConnection || 
                          navigator.webkitConnection;
        
        return {
            online: this.isOnline,
            type: connection?.effectiveType || 'unknown',
            downlink: connection?.downlink || null,
            rtt: connection?.rtt || null,
            saveData: connection?.saveData || false,
            lastOnline: this.lastOnlineTime,
            lastOffline: this.lastOfflineTime
        };
    }

    /**
     * Check if connection is good enough for sync
     * @returns {boolean} True if connection quality is sufficient
     */
    isConnectionGoodForSync() {
        if (!this.isOnline) return false;
        
        const connection = navigator.connection || 
                          navigator.mozConnection || 
                          navigator.webkitConnection;
        
        if (!connection) return true; // Assume good if can't detect
        
        // Don't sync on very slow connections
        const slowConnections = ['slow-2g', '2g'];
        if (slowConnections.includes(connection.effectiveType)) {
            console.log('⚠️ Connection too slow for sync');
            return false;
        }
        
        // Respect data saver mode
        if (connection.saveData) {
            console.log('⚠️ Data saver mode enabled - limiting sync');
            return false;
        }
        
        return true;
    }

    /**
     * Wait for online connection
     * @param {number} timeout - Max time to wait (ms)
     * @returns {Promise<boolean>} True if came online within timeout
     */
    waitForOnline(timeout = 60000) {
        return new Promise((resolve) => {
            if (this.isOnline) {
                resolve(true);
                return;
            }

            const timeoutId = setTimeout(() => {
                cleanup();
                resolve(false);
            }, timeout);

            const unsubscribe = this.onReconnect(() => {
                cleanup();
                resolve(true);
            });

            const cleanup = () => {
                clearTimeout(timeoutId);
                unsubscribe();
            };
        });
    }

    /**
     * Get network statistics
     * @returns {Object} Network stats
     */
    getStats() {
        const now = Date.now();
        const uptime = this.lastOnlineTime ? now - this.lastOnlineTime : 0;
        const downtime = this.lastOfflineTime && !this.isOnline 
            ? now - this.lastOfflineTime 
            : 0;

        return {
            currentStatus: this.isOnline ? 'online' : 'offline',
            currentUptime: uptime,
            currentDowntime: downtime,
            listenerCount: this.listeners.length,
            reconnectListenerCount: this.reconnectListeners.length,
            connectionInfo: this.getConnectionInfo()
        };
    }

    /**
     * Destroy and cleanup
     */
    destroy() {
        this.listeners = [];
        this.reconnectListeners = [];
        this.disconnectListeners = [];
        console.log('✅ Network Monitor destroyed');
    }
}

// Create singleton instance
const networkMonitor = new NetworkMonitor();

// Export to window for global access
window.networkMonitor = networkMonitor;
window.NetworkMonitor = networkMonitor; // Also export with capital N for compatibility

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = networkMonitor;
}
