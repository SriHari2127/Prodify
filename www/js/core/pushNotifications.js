// ===== PUSH NOTIFICATIONS MODULE (pushNotifications.js) =====
// Handles FCM registration, token storage, and notification display via Capacitor

const PushNotif = (function () {
    'use strict';

    let initialized = false;

    // ─── Check if Capacitor is available ────────────────────────────
    function isNative() {
        return typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
    }

    // ─── Initialize Push Notifications ─────────────────────────────
    async function init() {
        if (initialized) return;
        if (!isNative()) {
            console.log('📱 Push Notifications: Not on native platform, skipping.');
            return;
        }

        try {
            const { PushNotifications } = Capacitor.Plugins;
            if (!PushNotifications) {
                console.warn('⚠️ PushNotifications plugin not available');
                return;
            }

            // Set up listeners BEFORE registering
            await addListeners();

            // Request permission & register
            await registerForPush();

            initialized = true;
            console.log('✅ Push Notifications initialized');
        } catch (error) {
            console.error('❌ Push Notifications init error:', error);
        }
    }

    // ─── Request Permission & Register ─────────────────────────────
    async function registerForPush() {
        const { PushNotifications } = Capacitor.Plugins;

        // Check current permission status
        let permStatus = await PushNotifications.checkPermissions();
        console.log('📱 Push permission status:', permStatus.receive);

        // Request permission if needed (required for Android 13+)
        if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
            console.warn('⚠️ Push notification permission denied');
            return;
        }

        // Register with FCM
        await PushNotifications.register();
        console.log('📱 FCM registration requested...');
    }

    // ─── Add Event Listeners ───────────────────────────────────────
    async function addListeners() {
        const { PushNotifications } = Capacitor.Plugins;

        // Registration success — save token
        await PushNotifications.addListener('registration', (token) => {
            console.log('✅ FCM Token:', token.value);
            saveTokenToFirestore(token.value);
        });

        // Registration error
        await PushNotifications.addListener('registrationError', (error) => {
            console.error('❌ FCM Registration error:', error.error);
        });

        // Notification received while app is in FOREGROUND
        await PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('📬 Push received (foreground):', notification);

            // Show in-app toast using existing Notify system
            if (typeof Notify !== 'undefined') {
                Notify.info(notification.body || 'You have a new notification', {
                    title: notification.title || 'Prodify'
                });
            }
        });

        // User TAPPED on a notification
        await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            console.log('👆 Push notification tapped:', action);

            const data = action.notification.data || {};

            // Navigate to the relevant tab if specified in notification data
            if (data.tab && typeof switchTab === 'function') {
                setTimeout(() => {
                    switchTab(data.tab);
                }, 500);
            }
        });
    }

    // ─── Save FCM Token to Firestore ───────────────────────────────
    async function saveTokenToFirestore(token) {
        if (!token) return;
        if (typeof firebase === 'undefined' || typeof currentUserId === 'undefined' || !currentUserId) {
            console.warn('⚠️ Cannot save FCM token: Firebase or user not ready');
            return;
        }

        try {
            await firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection('settings')
                .doc('pushToken')
                .set({
                    token: token,
                    platform: 'android',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

            console.log('✅ FCM token saved to Firestore');
        } catch (error) {
            console.error('❌ Error saving FCM token:', error);
        }
    }

    // ─── Public API ────────────────────────────────────────────────
    return {
        init
    };
})();
