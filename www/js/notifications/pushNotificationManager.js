// ===== PUSH NOTIFICATION MANAGER =====
// Handles Firebase Cloud Messaging (FCM) for remote push notifications

/**
 * Push Notification Manager
 * Manages FCM registration, token management, and push notifications
 */
class PushNotificationManager {
    constructor() {
        this.fcmToken = null;
        this.isCapacitorAvailable = false;
        this.pushNotifications = null;
        this.initialized = false;
        this.permissionGranted = false;
    }

    /**
     * Initialize push notification system
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.initialized) return;

        try {
            console.log('☁️ Initializing PushNotificationManager...');

            // Check if Capacitor is available
            this.isCapacitorAvailable = this.checkCapacitorAvailability();

            if (this.isCapacitorAvailable) {
                // Use Capacitor Push Notifications
                this.pushNotifications = window.Capacitor?.Plugins?.PushNotifications;

                if (this.pushNotifications) {
                    await this.initializeCapacitorPush();
                } else {
                    console.warn('⚠️ PushNotifications plugin not found');
                }
            } else {
                console.log('ℹ️ Running in web mode, FCM web push available');
                await this.initializeWebPush();
            }

            this.initialized = true;
            console.log('✅ PushNotificationManager initialized');

        } catch (error) {
            console.error('❌ Failed to initialize PushNotificationManager:', error);
        }
    }

    /**
     * Check if Capacitor is available
     * @returns {boolean} True if Capacitor available
     */
    checkCapacitorAvailability() {
        return typeof window.Capacitor !== 'undefined' && 
               window.Capacitor.isNativePlatform?.();
    }

    /**
     * Initialize Capacitor Push Notifications
     * @returns {Promise<void>}
     */
    async initializeCapacitorPush() {
        try {
            // Request permissions
            const permResult = await this.pushNotifications.requestPermissions();
            
            if (permResult.receive === 'granted') {
                this.permissionGranted = true;
                console.log('✅ Push notification permission granted');

                // Register for push
                await this.pushNotifications.register();

                // Setup listeners
                this.setupCapacitorListeners();
            } else {
                console.warn('⚠️ Push notification permission denied');
                this.permissionGranted = false;
            }

        } catch (error) {
            console.error('❌ Error initializing Capacitor push:', error);
        }
    }

    /**
     * Setup Capacitor push notification listeners
     */
    setupCapacitorListeners() {
        if (!this.pushNotifications) return;

        // Registration success
        this.pushNotifications.addListener('registration', async (token) => {
            console.log('📱 FCM Token received:', token.value);
            this.fcmToken = token.value;
            
            // Save token to Firestore
            await this.saveFCMToken(token.value);
        });

        // Registration error
        this.pushNotifications.addListener('registrationError', (error) => {
            console.error('❌ FCM registration error:', error);
        });

        // Push notification received
        this.pushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('📬 Push notification received:', notification);
            
            this.handlePushReceived(notification);
        });

        // Push notification action performed
        this.pushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            console.log('👆 Push notification action:', action);
            
            this.handlePushAction(action);
        });

        console.log('✅ Capacitor push listeners setup');
    }

    /**
     * Initialize Web Push (FCM for web)
     * @returns {Promise<void>}
     */
    async initializeWebPush() {
        try {
            // Check if Firebase is available
            if (typeof firebase === 'undefined') {
                console.warn('⚠️ Firebase not available for web push');
                return;
            }

            // Check if FCM is initialized
            if (!firebase.messaging) {
                console.warn('⚠️ Firebase Messaging not available');
                return;
            }

            const messaging = firebase.messaging();

            // Request notification permission
            const permission = await Notification.requestPermission();
            
            if (permission === 'granted') {
                this.permissionGranted = true;
                console.log('✅ Web push permission granted');

                // Get FCM token
                const token = await messaging.getToken({
                    vapidKey: 'YOUR_VAPID_KEY' // Replace with your VAPID key
                });

                if (token) {
                    console.log('📱 FCM Token (web):', token);
                    this.fcmToken = token;
                    
                    // Save token to Firestore
                    await this.saveFCMToken(token);

                    // Setup web push listeners
                    this.setupWebPushListeners(messaging);
                }
            } else {
                console.warn('⚠️ Web push permission denied');
                this.permissionGranted = false;
            }

        } catch (error) {
            console.error('❌ Error initializing web push:', error);
        }
    }

    /**
     * Setup web push listeners
     * @param {Object} messaging - Firebase messaging instance
     */
    setupWebPushListeners(messaging) {
        // Handle foreground messages
        messaging.onMessage((payload) => {
            console.log('📬 Foreground push message:', payload);
            
            this.handlePushReceived({
                title: payload.notification?.title,
                body: payload.notification?.body,
                data: payload.data
            });
        });

        // Handle token refresh
        messaging.onTokenRefresh(async () => {
            try {
                const newToken = await messaging.getToken();
                console.log('🔄 FCM token refreshed:', newToken);
                this.fcmToken = newToken;
                await this.saveFCMToken(newToken);
            } catch (error) {
                console.error('❌ Error refreshing token:', error);
            }
        });

        console.log('✅ Web push listeners setup');
    }

    /**
     * Save FCM token to Firestore
     * @param {string} token - FCM token
     * @returns {Promise<void>}
     */
    async saveFCMToken(token) {
        try {
            if (!window.currentUserId || typeof firebase === 'undefined') {
                console.warn('⚠️ User not logged in, cannot save FCM token');
                return;
            }

            const deviceInfo = {
                fcmToken: token,
                platform: this.isCapacitorAvailable ? 'android' : 'web',
                userId: window.currentUserId,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                appVersion: '1.0.0' // You can track app version
            };

            await firebase.firestore()
                .collection('users')
                .doc(window.currentUserId)
                .collection('devices')
                .doc(token)
                .set(deviceInfo, { merge: true });

            console.log('✅ FCM token saved to Firestore');

        } catch (error) {
            console.error('❌ Error saving FCM token:', error);
        }
    }

    /**
     * Handle push notification received
     * @param {Object} notification - Push notification data
     */
    handlePushReceived(notification) {
        try {
            console.log('📨 Processing received push:', notification);

            // Track analytics
            if (window.notificationAnalytics) {
                window.notificationAnalytics.trackReceived({
                    id: notification.data?.notificationId || 'push_' + Date.now(),
                    type: notification.data?.type || 'push',
                    title: notification.title,
                    source: 'push'
                });
            }

            // Show local notification if app is in foreground
            if (document.visibilityState === 'visible') {
                this.showForegroundNotification(notification);
            }

        } catch (error) {
            console.error('❌ Error handling push received:', error);
        }
    }

    /**
     * Show notification when app is in foreground
     * @param {Object} notification - Notification data
     */
    showForegroundNotification(notification) {
        try {
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(notification.title || 'Prodify', {
                    body: notification.body || notification.message,
                    icon: '/icons/icon-192.png',
                    badge: '/icons/badge-72.png',
                    data: notification.data
                });
            }
        } catch (error) {
            console.error('❌ Error showing foreground notification:', error);
        }
    }

    /**
     * Handle push notification action
     * @param {Object} action - Action data
     */
    handlePushAction(action) {
        try {
            console.log('🎯 Processing push action:', action);

            const notification = action.notification;
            const data = notification.data || {};

            // Track analytics
            if (window.notificationAnalytics) {
                window.notificationAnalytics.trackClicked({
                    id: data.notificationId || 'push_' + Date.now(),
                    type: data.type || 'push',
                    actionId: action.actionId,
                    source: 'push'
                });
            }

            // Route based on notification type
            this.routeNotification(data);

        } catch (error) {
            console.error('❌ Error handling push action:', error);
        }
    }

    /**
     * Route notification based on type
     * @param {Object} data - Notification data
     */
    routeNotification(data) {
        const routes = {
            'task_reminder': '/tasks',
            'exam_alert': '/academic',
            'habit_reminder': '/habits',
            'focus_session': '/focus',
            'study_suggestion': '/focus',
            'achievement': '/profile',
            'productivity_nudge': '/tasks'
        };

        const route = routes[data.type] || '/';
        
        if (window.location.pathname !== route) {
            window.location.href = route;
        }
    }

    /**
     * Send push notification (server-side, this prepares the request)
     * Note: Actual sending happens on backend
     * @param {Object} notification - Notification object
     * @returns {Promise<boolean>} True if prepared successfully
     */
    async sendNotification(notification) {
        try {
            // In a real implementation, you would call your backend API
            // which then uses Firebase Admin SDK to send the push
            
            console.log('📤 Preparing push notification:', notification);

            // For now, we'll just log and return true
            // Your backend should have an endpoint like:
            // POST /api/notifications/send
            // Body: { userId, notification }

            const payload = {
                userId: window.currentUserId,
                notification: {
                    title: notification.title,
                    body: notification.message,
                    data: {
                        notificationId: notification.id,
                        type: notification.type,
                        priority: notification.priority,
                        ...notification.metadata
                    }
                }
            };

            // Example API call (implement this in your backend)
            /*
            const response = await fetch('/api/notifications/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await firebase.auth().currentUser.getIdToken()}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error('Failed to send push notification');
            }
            */

            console.log('✅ Push notification prepared (backend integration needed)');
            return true;

        } catch (error) {
            console.error('❌ Error sending push notification:', error);
            return false;
        }
    }

    /**
     * Get current FCM token
     * @returns {string|null} FCM token
     */
    getToken() {
        return this.fcmToken;
    }

    /**
     * Check if push notifications are enabled
     * @returns {boolean} True if enabled
     */
    isEnabled() {
        return this.permissionGranted && this.fcmToken !== null;
    }

    /**
     * Get push notification status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            initialized: this.initialized,
            capacitorAvailable: this.isCapacitorAvailable,
            permissionGranted: this.permissionGranted,
            hasToken: this.fcmToken !== null,
            token: this.fcmToken
        };
    }

    /**
     * Unregister from push notifications
     * @returns {Promise<void>}
     */
    async unregister() {
        try {
            if (this.pushNotifications && this.isCapacitorAvailable) {
                // Remove from FCM
                // Note: Capacitor doesn't have built-in unregister, 
                // just remove token from backend
            }

            // Remove token from Firestore
            if (this.fcmToken && window.currentUserId) {
                await firebase.firestore()
                    .collection('users')
                    .doc(window.currentUserId)
                    .collection('devices')
                    .doc(this.fcmToken)
                    .delete();

                console.log('✅ FCM token removed from Firestore');
            }

            this.fcmToken = null;
            this.permissionGranted = false;

        } catch (error) {
            console.error('❌ Error unregistering push notifications:', error);
        }
    }
}

// ===== EXPORT SINGLETON =====
const pushNotificationManager = new PushNotificationManager();
window.pushNotificationManager = pushNotificationManager;

// ===== AUTO-INITIALIZE =====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        pushNotificationManager.initialize().catch(console.error);
    });
} else {
    pushNotificationManager.initialize().catch(console.error);
}

console.log('✅ PushNotificationManager module loaded');
