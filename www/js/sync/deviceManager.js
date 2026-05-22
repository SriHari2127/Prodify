// ===== DEVICE MANAGER MODULE =====
// Handles device identification, registration, and metadata management
// Supports cross-device synchronization for Android, desktop browsers, and tablets

const DeviceManager = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    
    const CONFIG = {
        DEVICE_ID_KEY: 'prodify_device_id',
        DEVICE_METADATA_KEY: 'prodify_device_metadata',
        DEVICE_COLLECTION: 'devices',
        DEVICE_UPDATE_INTERVAL: 60000, // 1 minute
        HEARTBEAT_INTERVAL: 300000, // 5 minutes
        DEVICE_TIMEOUT: 900000 // 15 minutes (mark device as inactive)
    };

    // ===== STATE =====
    
    let currentDevice = null;
    let updateInterval = null;
    let heartbeatInterval = null;
    let isInitialized = false;

    // ===== DEVICE DETECTION =====

    /**
     * Detect device type based on user agent and screen size
     * @returns {string} Device type: 'android', 'tablet', 'desktop'
     */
    function detectDeviceType() {
        const userAgent = navigator.userAgent.toLowerCase();
        const isAndroid = /android/i.test(userAgent);
        const isTablet = /(ipad|tablet|playbook|silk)|(android(?!.*mobile))/i.test(userAgent);
        
        // Screen size detection
        const screenWidth = window.screen.width;
        const screenHeight = window.screen.height;
        const isLargeScreen = Math.max(screenWidth, screenHeight) >= 768;

        // Capacitor detection for native Android app
        const isCapacitorAndroid = typeof Capacitor !== 'undefined' && 
                                   Capacitor.getPlatform() === 'android';

        if (isCapacitorAndroid || (isAndroid && !isTablet)) {
            return 'android';
        } else if (isTablet || (isAndroid && isLargeScreen)) {
            return 'tablet';
        } else {
            return 'desktop';
        }
    }

    /**
     * Get device capabilities and specifications
     * @returns {Object} Device capabilities
     */
    function getDeviceCapabilities() {
        const screenWidth = window.screen.width;
        const screenHeight = window.screen.height;
        const pixelRatio = window.devicePixelRatio || 1;

        return {
            screenWidth: screenWidth,
            screenHeight: screenHeight,
            screenResolution: `${screenWidth}x${screenHeight}`,
            pixelRatio: pixelRatio,
            screenSize: Math.sqrt(screenWidth * screenWidth + screenHeight * screenHeight) / pixelRatio,
            isHighDPI: pixelRatio >= 2,
            supportsTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
            orientation: screenWidth > screenHeight ? 'landscape' : 'portrait',
            colorDepth: window.screen.colorDepth,
            platform: navigator.platform,
            language: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            cookiesEnabled: navigator.cookieEnabled,
            doNotTrack: navigator.doNotTrack === '1',
            onLine: navigator.onLine,
            connectionType: navigator.connection ? navigator.connection.effectiveType : 'unknown',
            memory: navigator.deviceMemory || 'unknown',
            cores: navigator.hardwareConcurrency || 'unknown'
        };
    }

    /**
     * Generate a unique device fingerprint
     * @returns {string} Device fingerprint
     */
    function generateDeviceFingerprint() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Prodify Device', 2, 2);
        const canvasData = canvas.toDataURL();

        const fingerprint = {
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            timezone: new Date().getTimezoneOffset(),
            canvas: canvasData.substring(0, 50),
            plugins: Array.from(navigator.plugins || []).map(p => p.name).join(',')
        };

        // Create hash
        const fingerprintString = JSON.stringify(fingerprint);
        return hashString(fingerprintString);
    }

    /**
     * Simple string hashing function
     * @param {string} str - String to hash
     * @returns {string} Hash value
     */
    function hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Generate or retrieve device ID
     * @returns {string} Device ID
     */
    function getOrCreateDeviceId() {
        // Check localStorage first
        let deviceId = localStorage.getItem(CONFIG.DEVICE_ID_KEY);
        
        if (!deviceId) {
            // Generate new device ID using fingerprint and timestamp
            const fingerprint = generateDeviceFingerprint();
            const timestamp = Date.now().toString(36);
            const random = Math.random().toString(36).substring(2, 8);
            deviceId = `dev_${fingerprint}_${timestamp}_${random}`;
            
            // Store in localStorage
            localStorage.setItem(CONFIG.DEVICE_ID_KEY, deviceId);
            console.log('🆕 Generated new device ID:', deviceId);
        } else {
            console.log('✅ Retrieved existing device ID:', deviceId);
        }
        
        return deviceId;
    }

    /**
     * Get or generate device name
     * @param {string} deviceType - Device type
     * @returns {string} Device name
     */
    function generateDeviceName(deviceType) {
        const stored = localStorage.getItem('prodify_device_name');
        if (stored) return stored;

        const typeNames = {
            'android': 'Android Phone',
            'tablet': 'Tablet',
            'desktop': 'Desktop Browser'
        };

        const baseName = typeNames[deviceType] || 'Unknown Device';
        const browser = getBrowserName();
        const timestamp = new Date().toLocaleString('en-US', { 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const deviceName = `${baseName} (${browser})`;
        return deviceName;
    }

    /**
     * Get browser name
     * @returns {string} Browser name
     */
    function getBrowserName() {
        const userAgent = navigator.userAgent;
        
        if (userAgent.indexOf('Firefox') > -1) return 'Firefox';
        if (userAgent.indexOf('Opera') > -1 || userAgent.indexOf('OPR') > -1) return 'Opera';
        if (userAgent.indexOf('Trident') > -1) return 'IE';
        if (userAgent.indexOf('Edge') > -1) return 'Edge';
        if (userAgent.indexOf('Chrome') > -1) return 'Chrome';
        if (userAgent.indexOf('Safari') > -1) return 'Safari';
        
        return 'Browser';
    }

    // ===== DEVICE REGISTRATION =====

    /**
     * Initialize device manager
     * @returns {Promise<Object>} Current device metadata
     */
    async function initialize() {
        if (isInitialized) {
            console.log('⚠️ DeviceManager already initialized');
            return currentDevice;
        }

        try {
            const deviceId = getOrCreateDeviceId();
            const deviceType = detectDeviceType();
            const capabilities = getDeviceCapabilities();
            const deviceName = generateDeviceName(deviceType);

            currentDevice = {
                deviceId: deviceId,
                deviceType: deviceType,
                deviceName: deviceName,
                capabilities: capabilities,
                userAgent: navigator.userAgent,
                firstSeen: new Date().toISOString(),
                lastActive: new Date().toISOString(),
                isActive: true,
                syncEnabled: true
            };

            // Store metadata locally
            localStorage.setItem(CONFIG.DEVICE_METADATA_KEY, JSON.stringify(currentDevice));

            // Register device in Firestore
            await registerDevice();

            // Start update intervals
            startUpdateIntervals();

            isInitialized = true;
            console.log('✅ DeviceManager initialized:', currentDevice);

            return currentDevice;
        } catch (error) {
            console.error('❌ Error initializing DeviceManager:', error);
            throw error;
        }
    }

    /**
     * Register device in Firestore
     * @returns {Promise<void>}
     */
    async function registerDevice() {
        if (!currentUserId || typeof firebase === 'undefined') {
            console.log('⚠️ Cannot register device: No user or Firebase unavailable');
            return;
        }

        try {
            const deviceRef = firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection(CONFIG.DEVICE_COLLECTION)
                .doc(currentDevice.deviceId);

            // Check if device already exists
            const doc = await deviceRef.get();
            
            if (doc.exists) {
                // Update existing device
                await deviceRef.update({
                    lastActive: firebase.firestore.FieldValue.serverTimestamp(),
                    isActive: true,
                    capabilities: currentDevice.capabilities,
                    userAgent: currentDevice.userAgent,
                    deviceName: currentDevice.deviceName
                });
                console.log('🔄 Device updated in Firestore');
            } else {
                // Create new device entry
                await deviceRef.set({
                    deviceId: currentDevice.deviceId,
                    deviceType: currentDevice.deviceType,
                    deviceName: currentDevice.deviceName,
                    capabilities: currentDevice.capabilities,
                    userAgent: currentDevice.userAgent,
                    firstSeen: firebase.firestore.FieldValue.serverTimestamp(),
                    lastActive: firebase.firestore.FieldValue.serverTimestamp(),
                    isActive: true,
                    syncEnabled: true,
                    version: '1.0'
                });
                console.log('✅ Device registered in Firestore');
            }

            // Dispatch device registered event
            document.dispatchEvent(new CustomEvent('deviceRegistered', { 
                detail: currentDevice 
            }));

        } catch (error) {
            console.error('❌ Error registering device:', error);
            throw error;
        }
    }

    /**
     * Update device last active timestamp
     * @returns {Promise<void>}
     */
    async function updateLastActive() {
        if (!currentUserId || !currentDevice || typeof firebase === 'undefined') {
            return;
        }

        try {
            currentDevice.lastActive = new Date().toISOString();
            localStorage.setItem(CONFIG.DEVICE_METADATA_KEY, JSON.stringify(currentDevice));

            // Update in Firestore
            await firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection(CONFIG.DEVICE_COLLECTION)
                .doc(currentDevice.deviceId)
                .update({
                    lastActive: firebase.firestore.FieldValue.serverTimestamp(),
                    isActive: true
                });

        } catch (error) {
            console.error('❌ Error updating last active:', error);
        }
    }

    /**
     * Send heartbeat to indicate device is active
     * @returns {Promise<void>}
     */
    async function sendHeartbeat() {
        await updateLastActive();
        console.log('💓 Device heartbeat sent');
    }

    /**
     * Start update intervals for heartbeat and metadata
     */
    function startUpdateIntervals() {
        // Update device metadata periodically
        updateInterval = setInterval(async () => {
            if (document.visibilityState === 'visible') {
                await updateLastActive();
            }
        }, CONFIG.DEVICE_UPDATE_INTERVAL);

        // Send heartbeat periodically
        heartbeatInterval = setInterval(async () => {
            if (document.visibilityState === 'visible') {
                await sendHeartbeat();
            }
        }, CONFIG.HEARTBEAT_INTERVAL);

        // Update on visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                updateLastActive();
            }
        });

        // Update before page unload
        window.addEventListener('beforeunload', () => {
            if (currentDevice) {
                const timestamp = new Date().toISOString();
                currentDevice.lastActive = timestamp;
                localStorage.setItem(CONFIG.DEVICE_METADATA_KEY, JSON.stringify(currentDevice));
            }
        });
    }

    /**
     * Stop update intervals
     */
    function stopUpdateIntervals() {
        if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
        }
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }
    }

    // ===== DEVICE QUERIES =====

    /**
     * Get all registered devices for current user
     * @returns {Promise<Array>} Array of devices
     */
    async function getAllDevices() {
        if (!currentUserId || typeof firebase === 'undefined') {
            return [];
        }

        try {
            const snapshot = await firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection(CONFIG.DEVICE_COLLECTION)
                .orderBy('lastActive', 'desc')
                .get();

            const devices = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                devices.push({
                    deviceId: doc.id,
                    ...data,
                    lastActive: data.lastActive ? data.lastActive.toDate().toISOString() : null,
                    firstSeen: data.firstSeen ? data.firstSeen.toDate().toISOString() : null
                });
            });

            return devices;
        } catch (error) {
            console.error('❌ Error getting devices:', error);
            return [];
        }
    }

    /**
     * Get active devices (active within timeout period)
     * @returns {Promise<Array>} Array of active devices
     */
    async function getActiveDevices() {
        const allDevices = await getAllDevices();
        const now = Date.now();
        
        return allDevices.filter(device => {
            if (!device.lastActive) return false;
            const lastActiveTime = new Date(device.lastActive).getTime();
            const timeDiff = now - lastActiveTime;
            return timeDiff < CONFIG.DEVICE_TIMEOUT && device.isActive !== false;
        });
    }

    /**
     * Get current device metadata
     * @returns {Object|null} Current device
     */
    function getCurrentDevice() {
        return currentDevice;
    }

    /**
     * Get device by ID
     * @param {string} deviceId - Device ID
     * @returns {Promise<Object|null>} Device metadata
     */
    async function getDeviceById(deviceId) {
        if (!currentUserId || typeof firebase === 'undefined') {
            return null;
        }

        try {
            const doc = await firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection(CONFIG.DEVICE_COLLECTION)
                .doc(deviceId)
                .get();

            if (!doc.exists) return null;

            const data = doc.data();
            return {
                deviceId: doc.id,
                ...data,
                lastActive: data.lastActive ? data.lastActive.toDate().toISOString() : null,
                firstSeen: data.firstSeen ? data.firstSeen.toDate().toISOString() : null
            };
        } catch (error) {
            console.error('❌ Error getting device by ID:', error);
            return null;
        }
    }

    // ===== DEVICE MANAGEMENT =====

    /**
     * Update device name
     * @param {string} newName - New device name
     * @returns {Promise<void>}
     */
    async function updateDeviceName(newName) {
        if (!currentDevice) {
            throw new Error('Device not initialized');
        }

        currentDevice.deviceName = newName;
        localStorage.setItem(CONFIG.DEVICE_METADATA_KEY, JSON.stringify(currentDevice));
        localStorage.setItem('prodify_device_name', newName);

        if (currentUserId && typeof firebase !== 'undefined') {
            try {
                await firebase.firestore()
                    .collection('users')
                    .doc(currentUserId)
                    .collection(CONFIG.DEVICE_COLLECTION)
                    .doc(currentDevice.deviceId)
                    .update({
                        deviceName: newName,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                
                console.log('✅ Device name updated:', newName);
            } catch (error) {
                console.error('❌ Error updating device name:', error);
                throw error;
            }
        }
    }

    /**
     * Deactivate current device
     * @returns {Promise<void>}
     */
    async function deactivateDevice() {
        if (!currentDevice || !currentUserId || typeof firebase === 'undefined') {
            return;
        }

        try {
            await firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection(CONFIG.DEVICE_COLLECTION)
                .doc(currentDevice.deviceId)
                .update({
                    isActive: false,
                    deactivatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

            currentDevice.isActive = false;
            stopUpdateIntervals();
            
            console.log('🛑 Device deactivated');
        } catch (error) {
            console.error('❌ Error deactivating device:', error);
        }
    }

    /**
     * Remove device from Firestore
     * @param {string} deviceId - Device ID to remove
     * @returns {Promise<void>}
     */
    async function removeDevice(deviceId) {
        if (!currentUserId || typeof firebase === 'undefined') {
            throw new Error('Not authenticated');
        }

        try {
            await firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection(CONFIG.DEVICE_COLLECTION)
                .doc(deviceId)
                .delete();

            console.log('🗑️ Device removed:', deviceId);

            // If removing current device, clear local storage
            if (currentDevice && currentDevice.deviceId === deviceId) {
                localStorage.removeItem(CONFIG.DEVICE_ID_KEY);
                localStorage.removeItem(CONFIG.DEVICE_METADATA_KEY);
                currentDevice = null;
                stopUpdateIntervals();
            }

        } catch (error) {
            console.error('❌ Error removing device:', error);
            throw error;
        }
    }

    /**
     * Clean up inactive devices (older than 30 days)
     * @returns {Promise<number>} Number of devices removed
     */
    async function cleanupInactiveDevices() {
        if (!currentUserId || typeof firebase === 'undefined') {
            return 0;
        }

        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const snapshot = await firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection(CONFIG.DEVICE_COLLECTION)
                .where('lastActive', '<', firebase.firestore.Timestamp.fromDate(thirtyDaysAgo))
                .get();

            const batch = firebase.firestore().batch();
            let count = 0;

            snapshot.forEach(doc => {
                // Don't delete current device
                if (currentDevice && doc.id !== currentDevice.deviceId) {
                    batch.delete(doc.ref);
                    count++;
                }
            });

            if (count > 0) {
                await batch.commit();
                console.log(`🧹 Cleaned up ${count} inactive devices`);
            }

            return count;
        } catch (error) {
            console.error('❌ Error cleaning up devices:', error);
            return 0;
        }
    }

    // ===== UTILITY FUNCTIONS =====

    /**
     * Check if device manager is initialized
     * @returns {boolean} Initialization status
     */
    function isReady() {
        return isInitialized && currentDevice !== null;
    }

    /**
     * Get device type icon
     * @param {string} deviceType - Device type
     * @returns {string} Icon emoji or character
     */
    function getDeviceIcon(deviceType) {
        const icons = {
            'android': '📱',
            'tablet': '📲',
            'desktop': '💻'
        };
        return icons[deviceType] || '📱';
    }

    /**
     * Format last active time as relative string
     * @param {string} lastActiveISO - ISO timestamp
     * @returns {string} Relative time string
     */
    function formatLastActive(lastActiveISO) {
        if (!lastActiveISO) return 'Never';

        const now = new Date();
        const lastActive = new Date(lastActiveISO);
        const diffMs = now - lastActive;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        
        return lastActive.toLocaleDateString();
    }

    // ===== PUBLIC API =====

    return {
        // Initialization
        initialize,
        isReady,

        // Device info
        getCurrentDevice,
        getDeviceById,
        getAllDevices,
        getActiveDevices,
        detectDeviceType,
        getDeviceCapabilities,

        // Device management
        updateDeviceName,
        deactivateDevice,
        removeDevice,
        cleanupInactiveDevices,
        updateLastActive,
        sendHeartbeat,

        // Utilities
        getDeviceIcon,
        formatLastActive,

        // Constants
        CONFIG
    };

})();

// Auto-initialize when user is authenticated
document.addEventListener('userAuthenticated', () => {
    setTimeout(() => {
        DeviceManager.initialize().catch(console.error);
    }, 1000);
});

console.log('📱 DeviceManager module loaded');
