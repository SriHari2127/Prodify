// ===== NOTIFICATION ENGINE (ORCHESTRATOR) =====
// Main coordinator for the notification system

/**
 * Notification Engine
 * Orchestrates all notification modules and provides high-level API
 */
class NotificationEngine {
    constructor() {
        this.initialized = false;
        this.modules = {};
        this.eventListeners = new Map();
    }

    /**
     * Initialize notification engine
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.initialized) return;

        try {
            console.log('🚀 Initializing NotificationEngine...');

            // Wait for all modules to be available
            await this.waitForModules();

            // Reference all modules
            this.modules = {
                queue: window.notificationQueue,
                rules: window.notificationRules,
                scheduler: window.notificationScheduler,
                local: window.localNotificationManager,
                push: window.pushNotificationManager,
                behavior: window.behaviorAnalyzer,
                analytics: window.notificationAnalytics
            };

            // Setup event listeners
            this.setupEventListeners();

            // Start scheduler
            if (this.modules.scheduler) {
                this.modules.scheduler.start?.();
            }

            this.initialized = true;
            console.log('✅ NotificationEngine initialized');

            // Emit ready event
            this.emit('ready');

        } catch (error) {
            console.error('❌ Failed to initialize NotificationEngine:', error);
        }
    }

    /**
     * Wait for all required modules to load
     * @returns {Promise<void>}
     */
    async waitForModules() {
        const maxWait = 10000; // 10 seconds
        const checkInterval = 100; // 100ms
        const startTime = Date.now();

        const requiredModules = [
            'notificationQueue',
            'notificationRules',
            'notificationScheduler'
        ];

        while (Date.now() - startTime < maxWait) {
            const allLoaded = requiredModules.every(
                module => typeof window[module] !== 'undefined'
            );

            if (allLoaded) {
                console.log('✅ All required modules loaded');
                return;
            }

            await new Promise(resolve => setTimeout(resolve, checkInterval));
        }

        throw new Error('Timeout waiting for notification modules');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for notification events from other parts of the app
        window.addEventListener('notification:schedule', (e) => {
            this.handleScheduleRequest(e.detail);
        });

        window.addEventListener('notification:cancel', (e) => {
            this.handleCancelRequest(e.detail);
        });

        console.log('✅ Event listeners setup');
    }

    /**
     * Schedule a notification
     * @param {Object} notification - Notification data
     * @returns {Promise<string|null>} Notification ID or null
     */
    async scheduleNotification(notification) {
        try {
            if (!this.initialized) {
                console.warn('⚠️ NotificationEngine not initialized');
                return null;
            }

            console.log('📅 Scheduling notification:', notification.type);

            // Validate notification
            if (!notification.type || !notification.title || !notification.message) {
                console.error('❌ Invalid notification data');
                return null;
            }

            // Check behavior analyzer recommendations
            if (this.modules.behavior) {
                const shouldSend = this.modules.behavior.shouldSendType(notification.type);
                
                if (!shouldSend) {
                    console.log(`⚠️ Skipping ${notification.type} - poor historical performance`);
                    return null;
                }
            }

            // Use scheduler to handle the notification
            if (this.modules.scheduler) {
                return await this.modules.scheduler.scheduleNotification(notification);
            }

            return null;

        } catch (error) {
            console.error('❌ Error scheduling notification:', error);
            return null;
        }
    }

    /**
     * Schedule task reminder
     * @param {Object} task - Task object
     * @returns {Promise<string|null>} Notification ID
     */
    async scheduleTaskReminder(task) {
        try {
            if (!this.modules.scheduler) return null;

            return await this.modules.scheduler.scheduleTaskReminder(task);

        } catch (error) {
            console.error('❌ Error scheduling task reminder:', error);
            return null;
        }
    }

    /**
     * Schedule exam alert
     * @param {Object} exam - Exam object
     * @returns {Promise<string|null>} Notification ID
     */
    async scheduleExamAlert(exam) {
        try {
            if (!this.modules.scheduler) return null;

            return await this.modules.scheduler.scheduleExamAlert(exam);

        } catch (error) {
            console.error('❌ Error scheduling exam alert:', error);
            return null;
        }
    }

    /**
     * Schedule habit reminder
     * @param {Object} habit - Habit object
     * @returns {Promise<string|null>} Notification ID
     */
    async scheduleHabitReminder(habit) {
        try {
            if (!this.modules.scheduler) return null;

            return await this.modules.scheduler.scheduleHabitReminder(habit);

        } catch (error) {
            console.error('❌ Error scheduling habit reminder:', error);
            return null;
        }
    }

    /**
     * Schedule all daily habit reminders
     * @returns {Promise<void>}
     */
    async scheduleDailyHabitReminders() {
        try {
            if (!this.modules.scheduler) return;

            await this.modules.scheduler.scheduleDailyHabitReminders();

        } catch (error) {
            console.error('❌ Error scheduling daily habit reminders:', error);
        }
    }

    /**
     * Schedule study suggestion
     * @param {string} subject - Subject name
     * @param {string} reason - Reason for suggestion
     * @returns {Promise<string|null>} Notification ID
     */
    async scheduleStudySuggestion(subject, reason) {
        try {
            if (!this.modules.scheduler) return null;

            return await this.modules.scheduler.scheduleStudySuggestion(subject, reason);

        } catch (error) {
            console.error('❌ Error scheduling study suggestion:', error);
            return null;
        }
    }

    /**
     * Schedule focus session reminder
     * @param {Object} session - Focus session object
     * @returns {Promise<string|null>} Notification ID
     */
    async scheduleFocusSessionReminder(session) {
        try {
            if (!this.modules.scheduler) return null;

            return await this.modules.scheduler.scheduleFocusSessionReminder(session);

        } catch (error) {
            console.error('❌ Error scheduling focus session reminder:', error);
            return null;
        }
    }

    /**
     * Send achievement notification (immediate)
     * @param {Object} achievement - Achievement object
     * @returns {Promise<void>}
     */
    async sendAchievement(achievement) {
        try {
            if (!this.modules.scheduler) return;

            await this.modules.scheduler.sendAchievement(achievement);

        } catch (error) {
            console.error('❌ Error sending achievement:', error);
        }
    }

    /**
     * Schedule productivity nudge
     * @param {string} nudgeType - Type of nudge
     * @param {Date} time - When to send (optional)
     * @returns {Promise<string|null>} Notification ID
     */
    async scheduleProductivityNudge(nudgeType, time = null) {
        try {
            if (!this.modules.scheduler) return null;

            return await this.modules.scheduler.scheduleProductivityNudge(nudgeType, time);

        } catch (error) {
            console.error('❌ Error scheduling productivity nudge:', error);
            return null;
        }
    }

    /**
     * Cancel a notification
     * @param {string} id - Notification ID
     * @returns {Promise<boolean>} True if cancelled
     */
    async cancelNotification(id) {
        try {
            if (!this.modules.queue) return false;

            await this.modules.queue.cancel(id);
            
            // Also cancel from local notifications
            if (this.modules.local) {
                await this.modules.local.cancelNotification(id);
            }

            console.log(`✅ Notification ${id} cancelled`);
            return true;

        } catch (error) {
            console.error('❌ Error cancelling notification:', error);
            return false;
        }
    }

    /**
     * Get pending notifications
     * @returns {Promise<Array>} Pending notifications
     */
    async getPendingNotifications() {
        try {
            if (!this.modules.queue) return [];

            return await this.modules.queue.getPending();

        } catch (error) {
            console.error('❌ Error getting pending notifications:', error);
            return [];
        }
    }

    /**
     * Get notification statistics
     * @returns {Promise<Object>} Statistics
     */
    async getStatistics() {
        try {
            const stats = {
                queue: null,
                behavior: null,
                analytics: null
            };

            if (this.modules.queue) {
                stats.queue = await this.modules.queue.getStats();
            }

            if (this.modules.behavior) {
                stats.behavior = this.modules.behavior.getAnalytics();
            }

            if (this.modules.analytics) {
                stats.analytics = await this.modules.analytics.getStats();
            }

            return stats;

        } catch (error) {
            console.error('❌ Error getting statistics:', error);
            return null;
        }
    }

    /**
     * Get optimal notification time
     * @param {string} type - Notification type
     * @returns {Object} Optimal time recommendation
     */
    getOptimalTime(type = null) {
        try {
            if (!this.modules.behavior) {
                // Default to 1 hour from now
                const time = new Date();
                time.setHours(time.getHours() + 1);
                return {
                    time,
                    confidence: 'low'
                };
            }

            return this.modules.behavior.getOptimalTime(type);

        } catch (error) {
            console.error('❌ Error getting optimal time:', error);
            const time = new Date();
            time.setHours(time.getHours() + 1);
            return { time, confidence: 'low' };
        }
    }

    /**
     * Track notification interaction
     * @param {Object} interaction - Interaction data
     * @returns {Promise<void>}
     */
    async trackInteraction(interaction) {
        try {
            // Track in behavior analyzer
            if (this.modules.behavior) {
                await this.modules.behavior.trackInteraction(interaction);
            }

            // Track in analytics
            if (this.modules.analytics) {
                if (interaction.action === 'opened') {
                    await this.modules.analytics.trackOpened(interaction);
                } else if (interaction.action === 'clicked') {
                    await this.modules.analytics.trackClicked(interaction);
                } else if (interaction.action === 'dismissed') {
                    await this.modules.analytics.trackDismissed(interaction);
                }
            }

        } catch (error) {
            console.error('❌ Error tracking interaction:', error);
        }
    }

    /**
     * Track study session
     * @param {Object} session - Study session data
     * @returns {Promise<void>}
     */
    async trackStudySession(session) {
        try {
            if (this.modules.behavior) {
                await this.modules.behavior.trackStudySession(session);
            }

        } catch (error) {
            console.error('❌ Error tracking study session:', error);
        }
    }

    /**
     * Update user preferences
     * @param {Object} preferences - User preferences
     * @returns {Promise<void>}
     */
    async updatePreferences(preferences) {
        try {
            if (this.modules.rules) {
                await this.modules.rules.saveUserPreferences(preferences);
            }

            console.log('✅ Preferences updated');

        } catch (error) {
            console.error('❌ Error updating preferences:', error);
        }
    }

    /**
     * Get user preferences
     * @returns {Promise<Object>} User preferences
     */
    async getPreferences() {
        try {
            if (this.modules.rules) {
                return await this.modules.rules.loadUserPreferences();
            }

            return null;

        } catch (error) {
            console.error('❌ Error getting preferences:', error);
            return null;
        }
    }

    /**
     * Handle schedule request event
     * @param {Object} detail - Event detail
     */
    async handleScheduleRequest(detail) {
        try {
            await this.scheduleNotification(detail);
        } catch (error) {
            console.error('❌ Error handling schedule request:', error);
        }
    }

    /**
     * Handle cancel request event
     * @param {Object} detail - Event detail
     */
    async handleCancelRequest(detail) {
        try {
            await this.cancelNotification(detail.id);
        } catch (error) {
            console.error('❌ Error handling cancel request:', error);
        }
    }

    /**
     * Register event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }

        this.eventListeners.get(event).push(callback);
    }

    /**
     * Emit event
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data = null) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`❌ Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    /**
     * Get system status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            initialized: this.initialized,
            modules: {
                queue: !!this.modules.queue,
                rules: !!this.modules.rules,
                scheduler: !!this.modules.scheduler,
                local: !!this.modules.local,
                push: !!this.modules.push,
                behavior: !!this.modules.behavior,
                analytics: !!this.modules.analytics
            },
            pushEnabled: this.modules.push?.isEnabled?.() || false,
            localEnabled: this.modules.local?.isSupported?.() || false
        };
    }

    /**
     * Clear all notifications
     * @returns {Promise<void>}
     */
    async clearAll() {
        try {
            // Clear queue
            if (this.modules.queue) {
                const pending = await this.modules.queue.getPending();
                for (const notif of pending) {
                    await this.modules.queue.cancel(notif.id);
                }
            }

            // Clear local notifications
            if (this.modules.local) {
                await this.modules.local.clearAll?.();
            }

            console.log('✅ All notifications cleared');

        } catch (error) {
            console.error('❌ Error clearing notifications:', error);
        }
    }
}

// ===== EXPORT SINGLETON =====
const notificationEngine = new NotificationEngine();
window.notificationEngine = notificationEngine;

// ===== CONVENIENCE GLOBAL FUNCTIONS =====
// These allow easy access from anywhere in the app

/**
 * Schedule a task reminder
 * @param {Object} task - Task object
 */
window.scheduleTaskReminder = async function(task) {
    return await notificationEngine.scheduleTaskReminder(task);
};

/**
 * Schedule an exam alert
 * @param {Object} exam - Exam object
 */
window.scheduleExamAlert = async function(exam) {
    return await notificationEngine.scheduleExamAlert(exam);
};

/**
 * Schedule a habit reminder
 * @param {Object} habit - Habit object
 */
window.scheduleHabitReminder = async function(habit) {
    return await notificationEngine.scheduleHabitReminder(habit);
};

/**
 * Send achievement notification
 * @param {Object} achievement - Achievement object
 */
window.sendAchievement = async function(achievement) {
    return await notificationEngine.sendAchievement(achievement);
};

/**
 * Cancel a notification
 * @param {string} id - Notification ID
 */
window.cancelNotification = async function(id) {
    return await notificationEngine.cancelNotification(id);
};

// ===== AUTO-INITIALIZE =====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        notificationEngine.initialize().catch(console.error);
    });
} else {
    notificationEngine.initialize().catch(console.error);
}

console.log('✅ NotificationEngine module loaded');
