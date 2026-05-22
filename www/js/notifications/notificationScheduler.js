// ===== NOTIFICATION SCHEDULER =====
// Handles scheduling, timing, and delivery coordination of notifications

/**
 * Notification Scheduler
 * Manages notification timing and delivery coordination
 */
class NotificationScheduler {
    constructor() {
        this.scheduledTimers = new Map(); // Store active timers
        this.checkInterval = 60000; // Check every minute
        this.checkIntervalId = null;
        this.isRunning = false;
        this.initialized = false;
    }

    /**
     * Initialize scheduler
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.initialized) return;

        try {
            console.log('⏰ Initializing NotificationScheduler...');

            // Wait for dependencies
            await this.waitForDependencies();

            // Start scheduler
            await this.start();

            this.initialized = true;
            console.log('✅ NotificationScheduler initialized');

        } catch (error) {
            console.error('❌ Failed to initialize NotificationScheduler:', error);
            throw error;
        }
    }

    /**
     * Wait for required dependencies
     * @returns {Promise<void>}
     */
    async waitForDependencies() {
        return new Promise((resolve) => {
            const check = setInterval(() => {
                if (window.notificationQueue && 
                    window.notificationRules &&
                    window.notificationQueue.isInitialized) {
                    clearInterval(check);
                    resolve();
                }
            }, 100);

            // Timeout after 10 seconds
            setTimeout(() => {
                clearInterval(check);
                console.warn('⚠️ Some dependencies not loaded, continuing anyway');
                resolve();
            }, 10000);
        });
    }

    /**
     * Start the scheduler
     * @returns {Promise<void>}
     */
    async start() {
        if (this.isRunning) {
            console.log('⚠️ Scheduler already running');
            return;
        }

        console.log('▶️ Starting notification scheduler...');

        // Run immediate check
        await this.checkAndScheduleNotifications();

        // Set up periodic checking
        this.checkIntervalId = setInterval(() => {
            this.checkAndScheduleNotifications().catch(console.error);
        }, this.checkInterval);

        this.isRunning = true;
        console.log('✅ Scheduler started');
    }

    /**
     * Stop the scheduler
     */
    stop() {
        if (this.checkIntervalId) {
            clearInterval(this.checkIntervalId);
            this.checkIntervalId = null;
        }

        // Clear all scheduled timers
        this.clearAllTimers();

        this.isRunning = false;
        console.log('⏸️ Scheduler stopped');
    }

    /**
     * Check queue and schedule notifications
     * @returns {Promise<void>}
     */
    async checkAndScheduleNotifications() {
        try {
            // Get notifications ready for delivery
            const readyNotifications = await window.notificationQueue.dequeue(10);

            if (readyNotifications.length === 0) {
                return; // Nothing to schedule
            }

            console.log(`📋 Found ${readyNotifications.length} notifications ready for delivery`);

            // Process each notification
            for (const notification of readyNotifications) {
                await this.scheduleNotification(notification);
            }

        } catch (error) {
            console.error('❌ Error checking notifications:', error);
        }
    }

    /**
     * Schedule a single notification for delivery
     * @param {Object} notification - Notification to schedule
     * @returns {Promise<void>}
     */
    async scheduleNotification(notification) {
        try {
            // Check if notification passes all rules
            const checkResult = await window.notificationRules.shouldSendNotification(notification);

            if (!checkResult.allowed) {
                console.log(`⛔ Notification blocked: ${checkResult.reason}`);
                
                // Reschedule if blocked due to timing
                if (checkResult.reason === 'quiet_hours' || 
                    checkResult.reason === 'too_frequent') {
                    await this.rescheduleNotification(notification, checkResult.reason);
                } else {
                    // Cancel if blocked for other reasons
                    await window.notificationQueue.cancel(notification.id);
                }
                return;
            }

            // Calculate delay until scheduled time
            const scheduledTime = new Date(notification.scheduledTime);
            const now = new Date();
            const delay = scheduledTime - now;

            if (delay <= 0) {
                // Send immediately
                await this.sendNotification(notification);
            } else if (delay < 24 * 60 * 60 * 1000) {
                // Schedule within 24 hours using setTimeout
                this.scheduleWithTimer(notification, delay);
            } else {
                // Too far in future, will be picked up on next check
                console.log(`⏰ Notification ${notification.id} scheduled for ${scheduledTime.toLocaleString()}`);
                await window.notificationQueue.updateStatus(notification.id, 'scheduled');
            }

        } catch (error) {
            console.error('❌ Error scheduling notification:', error);
            await window.notificationQueue.markAsFailed(notification.id, error.message);
        }
    }

    /**
     * Schedule notification using setTimeout
     * @param {Object} notification - Notification object
     * @param {number} delay - Delay in milliseconds
     */
    scheduleWithTimer(notification, delay) {
        // Clear existing timer if any
        if (this.scheduledTimers.has(notification.id)) {
            clearTimeout(this.scheduledTimers.get(notification.id));
        }

        // Schedule new timer
        const timerId = setTimeout(async () => {
            await this.sendNotification(notification);
            this.scheduledTimers.delete(notification.id);
        }, delay);

        this.scheduledTimers.set(notification.id, timerId);

        const scheduledTime = new Date(Date.now() + delay);
        console.log(`⏰ Notification ${notification.id} will send at ${scheduledTime.toLocaleTimeString()}`);
    }

    /**
     * Send notification immediately
     * @param {Object} notification - Notification to send
     * @returns {Promise<void>}
     */
    async sendNotification(notification) {
        try {
            console.log(`📤 Sending notification: ${notification.type}`);

            // Determine delivery method based on type and context
            const deliveryMethod = this.determineDeliveryMethod(notification);

            let success = false;

            if (deliveryMethod === 'push' && window.pushNotificationManager) {
                // Send via push notification
                success = await window.pushNotificationManager.sendNotification(notification);
            } else if (window.localNotificationManager) {
                // Send via local notification
                success = await window.localNotificationManager.sendNotification(notification);
            }

            if (success) {
                await window.notificationQueue.markAsSent(notification.id);
                
                // Track analytics
                if (window.notificationAnalytics) {
                    await window.notificationAnalytics.trackSent(notification);
                }
                
                console.log(`✅ Notification ${notification.id} sent successfully`);
            } else {
                throw new Error('Failed to send notification');
            }

        } catch (error) {
            console.error('❌ Error sending notification:', error);
            await window.notificationQueue.markAsFailed(notification.id, error.message);
        }
    }

    /**
     * Determine best delivery method for notification
     * @param {Object} notification - Notification object
     * @returns {string} Delivery method ('push' or 'local')
     */
    determineDeliveryMethod(notification) {
        // Use push for high priority and certain types
        if (notification.priority === 'high') {
            return 'push';
        }

        // Use push for achievements and cross-device syncing
        if (notification.type === 'achievement' || 
            notification.type === 'exam_alert') {
            return 'push';
        }

        // Default to local notifications
        return 'local';
    }

    /**
     * Reschedule notification for later
     * @param {Object} notification - Notification to reschedule
     * @param {string} reason - Reason for rescheduling
     * @returns {Promise<void>}
     */
    async rescheduleNotification(notification, reason) {
        try {
            let newScheduledTime = new Date();

            if (reason === 'quiet_hours') {
                // Schedule for end of quiet hours
                const quietEnd = window.notificationRules.quietHours.end;
                const [hours, minutes] = quietEnd.split(':').map(Number);
                newScheduledTime.setHours(hours, minutes, 0, 0);
                
                // If time has passed today, schedule for tomorrow
                if (newScheduledTime <= new Date()) {
                    newScheduledTime.setDate(newScheduledTime.getDate() + 1);
                }
            } else if (reason === 'too_frequent') {
                // Schedule for minimum gap from now
                const gapMinutes = window.notificationRules.minimumGapMinutes;
                newScheduledTime = new Date(Date.now() + gapMinutes * 60 * 1000);
            } else if (reason === 'daily_limit_reached') {
                // Schedule for tomorrow morning
                newScheduledTime.setDate(newScheduledTime.getDate() + 1);
                newScheduledTime.setHours(8, 0, 0, 0);
            } else {
                // Default: 1 hour from now
                newScheduledTime = new Date(Date.now() + 60 * 60 * 1000);
            }

            await window.notificationQueue.updateStatus(notification.id, 'pending', {
                scheduledTime: newScheduledTime.toISOString(),
                rescheduledReason: reason
            });

            console.log(`⏰ Notification ${notification.id} rescheduled to ${newScheduledTime.toLocaleString()}`);

        } catch (error) {
            console.error('❌ Error rescheduling notification:', error);
        }
    }

    /**
     * Cancel scheduled notification
     * @param {string} notificationId - Notification ID
     * @returns {Promise<void>}
     */
    async cancelScheduled(notificationId) {
        try {
            // Clear timer if exists
            if (this.scheduledTimers.has(notificationId)) {
                clearTimeout(this.scheduledTimers.get(notificationId));
                this.scheduledTimers.delete(notificationId);
            }

            // Update in queue
            await window.notificationQueue.cancel(notificationId);

            console.log(`🚫 Notification ${notificationId} cancelled`);

        } catch (error) {
            console.error('❌ Error cancelling notification:', error);
        }
    }

    /**
     * Clear all scheduled timers
     */
    clearAllTimers() {
        for (const [id, timerId] of this.scheduledTimers.entries()) {
            clearTimeout(timerId);
        }
        this.scheduledTimers.clear();
        console.log('🗑️ All timers cleared');
    }

    /**
     * Schedule task reminder
     * @param {Object} task - Task object
     * @returns {Promise<string>} Notification ID
     */
    async scheduleTaskReminder(task) {
        try {
            const notification = window.notificationRules.generateTaskReminder(task);
            if (!notification) return null;

            const notificationId = await window.notificationQueue.enqueue(notification);
            console.log(`✅ Task reminder scheduled for task ${task.id}`);
            
            return notificationId;

        } catch (error) {
            console.error('❌ Error scheduling task reminder:', error);
            return null;
        }
    }

    /**
     * Schedule exam alert
     * @param {Object} exam - Exam object
     * @returns {Promise<string>} Notification ID
     */
    async scheduleExamAlert(exam) {
        try {
            const notification = window.notificationRules.generateExamAlert(exam);
            if (!notification) return null;

            const notificationId = await window.notificationQueue.enqueue(notification);
            console.log(`✅ Exam alert scheduled for exam ${exam.id}`);
            
            return notificationId;

        } catch (error) {
            console.error('❌ Error scheduling exam alert:', error);
            return null;
        }
    }

    /**
     * Schedule habit reminder
     * @param {Object} habit - Habit object
     * @returns {Promise<string>} Notification ID
     */
    async scheduleHabitReminder(habit) {
        try {
            const notification = window.notificationRules.generateHabitReminder(habit);
            if (!notification) return null;

            const notificationId = await window.notificationQueue.enqueue(notification);
            console.log(`✅ Habit reminder scheduled for habit ${habit.id}`);
            
            return notificationId;

        } catch (error) {
            console.error('❌ Error scheduling habit reminder:', error);
            return null;
        }
    }

    /**
     * Schedule daily habit reminders for all habits
     * @returns {Promise<number>} Number of reminders scheduled
     */
    async scheduleDailyHabitReminders() {
        try {
            if (!window.db) return 0;

            const habits = await window.db.getHabits();
            let count = 0;

            for (const habit of habits) {
                const notificationId = await this.scheduleHabitReminder(habit);
                if (notificationId) count++;
            }

            console.log(`✅ Scheduled ${count} daily habit reminders`);
            return count;

        } catch (error) {
            console.error('❌ Error scheduling daily habit reminders:', error);
            return 0;
        }
    }

    /**
     * Schedule study suggestion
     * @param {Object} subject - Subject object
     * @param {string} reason - Reason for suggestion
     * @returns {Promise<string>} Notification ID
     */
    async scheduleStudySuggestion(subject, reason = 'general') {
        try {
            const notification = window.notificationRules.generateStudySuggestion(subject, reason);
            if (!notification) return null;

            const notificationId = await window.notificationQueue.enqueue(notification);
            console.log(`✅ Study suggestion scheduled for ${subject.name}`);
            
            return notificationId;

        } catch (error) {
            console.error('❌ Error scheduling study suggestion:', error);
            return null;
        }
    }

    /**
     * Schedule focus session reminder
     * @param {Object} session - Session details
     * @returns {Promise<string>} Notification ID
     */
    async scheduleFocusSessionReminder(session) {
        try {
            const notification = window.notificationRules.generateFocusSessionReminder(session);
            if (!notification) return null;

            const notificationId = await window.notificationQueue.enqueue(notification);
            console.log(`✅ Focus session reminder scheduled`);
            
            return notificationId;

        } catch (error) {
            console.error('❌ Error scheduling focus session reminder:', error);
            return null;
        }
    }

    /**
     * Send achievement notification
     * @param {Object} achievement - Achievement object
     * @returns {Promise<string>} Notification ID
     */
    async sendAchievement(achievement) {
        try {
            const notification = window.notificationRules.generateAchievement(achievement);
            if (!notification) return null;

            // Send immediately (don't queue)
            await this.sendNotification(notification);
            
            return notification.id;

        } catch (error) {
            console.error('❌ Error sending achievement:', error);
            return null;
        }
    }

    /**
     * Schedule productivity nudge
     * @param {string} nudgeType - Type of nudge
     * @param {Date} scheduledTime - When to send
     * @returns {Promise<string>} Notification ID
     */
    async scheduleProductivityNudge(nudgeType, scheduledTime) {
        try {
            const notification = window.notificationRules.generateProductivityNudge(nudgeType);
            if (!notification) return null;

            notification.scheduledTime = scheduledTime.toISOString();

            const notificationId = await window.notificationQueue.enqueue(notification);
            console.log(`✅ Productivity nudge scheduled: ${nudgeType}`);
            
            return notificationId;

        } catch (error) {
            console.error('❌ Error scheduling productivity nudge:', error);
            return null;
        }
    }

    /**
     * Get scheduler status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            scheduledCount: this.scheduledTimers.size,
            checkInterval: this.checkInterval,
            initialized: this.initialized
        };
    }

    /**
     * Get scheduled notifications
     * @returns {Array} Array of scheduled notification IDs
     */
    getScheduled() {
        return Array.from(this.scheduledTimers.keys());
    }
}

// ===== EXPORT SINGLETON =====
const notificationScheduler = new NotificationScheduler();
window.notificationScheduler = notificationScheduler;

// ===== AUTO-INITIALIZE =====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        notificationScheduler.initialize().catch(console.error);
    });
} else {
    notificationScheduler.initialize().catch(console.error);
}

console.log('✅ NotificationScheduler module loaded');
