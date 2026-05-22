// ===== LOCAL NOTIFICATION MANAGER =====
// Handles Capacitor Local Notifications (works offline)

/**
 * Local Notification Manager
 * Manages local/scheduled notifications via Capacitor plugin
 */
class LocalNotificationManager {
    constructor() {
        this.isCapacitorAvailable = false;
        this.permissionGranted = false;
        this.initialized = false;
        this.localNotifications = null;
        this.notificationIdCounter = 1000;
    }

    /**
     * Initialize local notification system
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.initialized) return;

        try {
            console.log('📱 Initializing LocalNotificationManager...');

            // Check if Capacitor is available
            this.isCapacitorAvailable = this.checkCapacitorAvailability();

            if (this.isCapacitorAvailable) {
                // Import local notifications plugin
                this.localNotifications = window.Capacitor?.Plugins?.LocalNotifications;

                if (this.localNotifications) {
                    // Request permissions
                    await this.requestPermissions();

                    // Setup listeners
                    this.setupListeners();

                    console.log('✅ Capacitor Local Notifications available');
                } else {
                    console.warn('⚠️ LocalNotifications plugin not found');
                    this.fallbackToWebNotifications();
                }
            } else {
                console.log('ℹ️ Running in web mode, using Web Notifications API');
                this.fallbackToWebNotifications();
            }

            this.initialized = true;
            console.log('✅ LocalNotificationManager initialized');

        } catch (error) {
            console.error('❌ Failed to initialize LocalNotificationManager:', error);
            this.fallbackToWebNotifications();
        }
    }

    /**
     * Check if Capacitor is available
     * @returns {boolean} True if Capacitor is available
     */
    checkCapacitorAvailability() {
        return typeof window.Capacitor !== 'undefined' && 
               window.Capacitor.isNativePlatform?.();
    }

    /**
     * Request notification permissions
     * @returns {Promise<boolean>} True if granted
     */
    async requestPermissions() {
        try {
            if (this.localNotifications) {
                const result = await this.localNotifications.requestPermissions();
                this.permissionGranted = result.display === 'granted';
                
                console.log('🔔 Notification permission:', this.permissionGranted ? 'Granted' : 'Denied');
                return this.permissionGranted;
            } else if ('Notification' in window) {
                // Web Notifications API
                const permission = await Notification.requestPermission();
                this.permissionGranted = permission === 'granted';
                
                console.log('🔔 Web notification permission:', this.permissionGranted ? 'Granted' : 'Denied');
                return this.permissionGranted;
            }

            return false;

        } catch (error) {
            console.error('❌ Error requesting permissions:', error);
            return false;
        }
    }

    /**
     * Setup notification listeners
     */
    setupListeners() {
        if (!this.localNotifications) return;

        try {
            // Notification received
            this.localNotifications.addListener('localNotificationReceived', (notification) => {
                console.log('📬 Local notification received:', notification);
                
                if (window.notificationAnalytics) {
                    window.notificationAnalytics.trackReceived({
                        id: notification.id,
                        type: notification.extra?.type || 'unknown'
                    });
                }
            });

            // Notification clicked
            this.localNotifications.addListener('localNotificationActionPerformed', (action) => {
                console.log('👆 Local notification action:', action);
                
                this.handleNotificationAction(action);
                
                if (window.notificationAnalytics) {
                    window.notificationAnalytics.trackClicked({
                        id: action.notification.id,
                        type: action.notification.extra?.type || 'unknown',
                        actionId: action.actionId
                    });
                }
            });

            console.log('✅ Notification listeners setup');

        } catch (error) {
            console.error('❌ Error setting up listeners:', error);
        }
    }

    /**
     * Send local notification
     * @param {Object} notification - Notification object
     * @returns {Promise<boolean>} True if sent successfully
     */
    async sendNotification(notification) {
        try {
            if (!this.permissionGranted) {
                console.warn('⚠️ Notification permission not granted');
                return false;
            }

            if (this.localNotifications && this.isCapacitorAvailable) {
                // Use Capacitor Local Notifications
                await this.sendCapacitorNotification(notification);
            } else if ('Notification' in window) {
                // Use Web Notifications API
                this.sendWebNotification(notification);
            } else {
                console.warn('⚠️ No notification API available');
                return false;
            }

            return true;

        } catch (error) {
            console.error('❌ Error sending notification:', error);
            return false;
        }
    }

    /**
     * Send notification using Capacitor
     * @param {Object} notification - Notification object
     * @returns {Promise<void>}
     */
    async sendCapacitorNotification(notification) {
        try {
            const localNotif = {
                id: this.getNotificationId(notification.id),
                title: notification.title,
                body: notification.message,
                schedule: {
                    at: new Date(notification.scheduledTime || new Date())
                },
                sound: notification.priority === 'high' ? 'default' : null,
                attachments: null,
                actionTypeId: notification.type,
                extra: {
                    notificationId: notification.id,
                    type: notification.type,
                    priority: notification.priority,
                    metadata: notification.metadata || {}
                }
            };

            // Add actions if specified
            if (notification.actions && notification.actions.length > 0) {
                localNotif.actionTypeId = notification.type;
            }

            await this.localNotifications.schedule({
                notifications: [localNotif]
            });

            console.log(`✅ Capacitor notification scheduled: ${notification.id}`);

        } catch (error) {
            console.error('❌ Error sending Capacitor notification:', error);
            throw error;
        }
    }

    /**
     * Send notification using Web Notifications API
     * @param {Object} notification - Notification object
     */
    sendWebNotification(notification) {
        try {
            const options = {
                body: notification.message,
                icon: '/icons/icon-192.png',
                badge: '/icons/badge-72.png',
                tag: notification.id,
                requireInteraction: notification.priority === 'high',
                data: {
                    notificationId: notification.id,
                    type: notification.type,
                    metadata: notification.metadata || {}
                }
            };

            // Create notification
            const webNotif = new Notification(notification.title, options);

            // Handle click
            webNotif.onclick = () => {
                console.log('👆 Web notification clicked:', notification.id);
                
                this.handleNotificationAction({
                    notification: notification,
                    actionId: 'tap'
                });
                
                webNotif.close();
            };

            console.log(`✅ Web notification sent: ${notification.id}`);

        } catch (error) {
            console.error('❌ Error sending web notification:', error);
        }
    }

    /**
     * Handle notification action (click, button tap, etc.)
     * @param {Object} action - Action object
     */
    handleNotificationAction(action) {
        try {
            const notification = action.notification;
            const actionId = action.actionId;
            const notificationData = notification.extra || notification.data || {};

            console.log(`🎯 Handling action: ${actionId} for notification: ${notificationData.notificationId}`);

            // Route based on notification type
            switch (notificationData.type) {
                case 'task_reminder':
                    this.handleTaskReminder(notificationData, actionId);
                    break;

                case 'exam_alert':
                    this.handleExamAlert(notificationData, actionId);
                    break;

                case 'habit_reminder':
                    this.handleHabitReminder(notificationData, actionId);
                    break;

                case 'focus_session':
                    this.handleFocusSession(notificationData, actionId);
                    break;

                case 'study_suggestion':
                    this.handleStudySuggestion(notificationData, actionId);
                    break;

                case 'achievement':
                    this.handleAchievement(notificationData, actionId);
                    break;

                case 'productivity_nudge':
                    this.handleProductivityNudge(notificationData, actionId);
                    break;

                default:
                    console.log('ℹ️ No specific handler for type:', notificationData.type);
                    // Open app to main screen
                    this.openApp();
            }

        } catch (error) {
            console.error('❌ Error handling notification action:', error);
        }
    }

    /**
     * Handle task reminder action
     * @param {Object} data - Notification data
     * @param {string} actionId - Action ID
     */
    handleTaskReminder(data, actionId) {
        if (actionId === 'Complete Task' || actionId === 'complete') {
            // Mark task as complete
            if (data.metadata?.taskId && window.updateTaskCompletion) {
                window.updateTaskCompletion(data.metadata.taskId);
            }
        } else if (actionId === 'View Details' || actionId === 'tap') {
            // Open app to task
            this.openApp('/tasks');
        }
    }

    /**
     * Handle exam alert action
     * @param {Object} data - Notification data
     * @param {string} actionId - Action ID
     */
    handleExamAlert(data, actionId) {
        if (actionId === 'Start Focus Session' || actionId === 'focus') {
            // Start focus session
            this.openApp('/focus');
        } else if (actionId === 'Open Study Plan' || actionId === 'tap') {
            // Open study plan
            this.openApp('/academic');
        }
    }

    /**
     * Handle habit reminder action
     * @param {Object} data - Notification data
     * @param {string} actionId - Action ID
     */
    handleHabitReminder(data, actionId) {
        if (actionId === 'Mark Complete' || actionId === 'complete') {
            // Mark habit complete
            if (data.metadata?.habitId && window.toggleHabitDay) {
                const today = new Date().toISOString().split('T')[0];
                window.toggleHabitDay(data.metadata.habitId, today);
            }
        } else if (actionId === 'tap') {
            this.openApp('/habits');
        }
    }

    /**
     * Handle focus session action
     * @param {Object} data - Notification data
     * @param {string} actionId - Action ID
     */
    handleFocusSession(data, actionId) {
        if (actionId === 'Start Now' || actionId === 'tap') {
            this.openApp('/focus');
        } else if (actionId === 'Snooze 15min') {
            // Snooze notification
            this.snoozeNotification(data.notificationId, 15);
        }
    }

    /**
     * Handle study suggestion action
     * @param {Object} data - Notification data
     * @param {string} actionId - Action ID
     */
    handleStudySuggestion(data, actionId) {
        if (actionId === 'Start Focus Session' || actionId === 'tap') {
            this.openApp('/focus');
        } else if (actionId === 'Reschedule') {
            // Reschedule study session
            this.openApp('/calendar');
        }
    }

    /**
     * Handle achievement action
     * @param {Object} data - Notification data
     * @param {string} actionId - Action ID
     */
    handleAchievement(data, actionId) {
        if (actionId === 'View Badge' || actionId === 'tap') {
            this.openApp('/profile');
        }
    }

    /**
     * Handle productivity nudge action
     * @param {Object} data - Notification data
     * @param {string} actionId - Action ID
     */
    handleProductivityNudge(data, actionId) {
        this.openApp('/tasks');
    }

    /**
     * Open app to specific route
     * @param {string} route - Route to open
     */
    openApp(route = '/') {
        if (this.isCapacitorAvailable) {
            // App is already open, just navigate
            if (window.location.pathname !== route) {
                window.location.href = route;
            }
        } else {
            // In browser, focus window
            window.focus();
            if (route && window.location.pathname !== route) {
                window.location.href = route;
            }
        }
    }

    /**
     * Snooze notification
     * @param {string} notificationId - Original notification ID
     * @param {number} minutes - Minutes to snooze
     * @returns {Promise<void>}
     */
    async snoozeNotification(notificationId, minutes) {
        try {
            const snoozedTime = new Date(Date.now() + minutes * 60 * 1000);
            
            if (window.notificationScheduler) {
                // Reschedule via scheduler
                await window.notificationScheduler.rescheduleNotification({
                    id: notificationId
                }, 'snoozed');
            }

            console.log(`😴 Notification snoozed for ${minutes} minutes`);

        } catch (error) {
            console.error('❌ Error snoozing notification:', error);
        }
    }

    /**
     * Cancel local notification
     * @param {string} notificationId - Notification ID to cancel
     * @returns {Promise<void>}
     */
    async cancelNotification(notificationId) {
        try {
            if (this.localNotifications && this.isCapacitorAvailable) {
                const id = this.getNotificationId(notificationId);
                await this.localNotifications.cancel({
                    notifications: [{ id: id }]
                });
                console.log(`🚫 Local notification cancelled: ${notificationId}`);
            }
        } catch (error) {
            console.error('❌ Error cancelling notification:', error);
        }
    }

    /**
     * Get pending local notifications
     * @returns {Promise<Array>} Array of pending notifications
     */
    async getPendingNotifications() {
        try {
            if (this.localNotifications && this.isCapacitorAvailable) {
                const result = await this.localNotifications.getPending();
                return result.notifications || [];
            }
            return [];
        } catch (error) {
            console.error('❌ Error getting pending notifications:', error);
            return [];
        }
    }

    /**
     * Clear all local notifications
     * @returns {Promise<void>}
     */
    async clearAll() {
        try {
            if (this.localNotifications && this.isCapacitorAvailable) {
                await this.localNotifications.cancel({
                    notifications: []
                });
                console.log('🗑️ All local notifications cleared');
            }
        } catch (error) {
            console.error('❌ Error clearing notifications:', error);
        }
    }

    /**
     * Get numeric notification ID
     * @param {string} notificationId - String notification ID
     * @returns {number} Numeric ID for Capacitor
     */
    getNotificationId(notificationId) {
        // Convert string ID to numeric ID for Capacitor
        // Use a hash or counter-based approach
        if (typeof notificationId === 'number') {
            return notificationId;
        }

        // Simple hash function
        let hash = 0;
        for (let i = 0; i < notificationId.length; i++) {
            hash = ((hash << 5) - hash) + notificationId.charCodeAt(i);
            hash = hash & hash; // Convert to 32bit integer
        }
        
        return Math.abs(hash);
    }

    /**
     * Fallback to web notifications
     */
    fallbackToWebNotifications() {
        if ('Notification' in window) {
            console.log('ℹ️ Using Web Notifications API as fallback');
            this.requestPermissions();
        } else {
            console.warn('⚠️ No notification support available');
        }
    }

    /**
     * Check if notifications are supported
     * @returns {boolean} True if supported
     */
    isSupported() {
        return this.isCapacitorAvailable || ('Notification' in window);
    }

    /**
     * Get manager status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            initialized: this.initialized,
            capacitorAvailable: this.isCapacitorAvailable,
            permissionGranted: this.permissionGranted,
            supported: this.isSupported()
        };
    }
}

// ===== EXPORT SINGLETON =====
const localNotificationManager = new LocalNotificationManager();
window.localNotificationManager = localNotificationManager;

// ===== AUTO-INITIALIZE =====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        localNotificationManager.initialize().catch(console.error);
    });
} else {
    localNotificationManager.initialize().catch(console.error);
}

console.log('✅ LocalNotificationManager module loaded');
