// ===== NOTIFICATION QUEUE SYSTEM =====
// Persistent notification queue stored in IndexedDB
// Survives app restarts and manages notification lifecycle

/**
 * Notification Queue Manager
 * Handles queuing, prioritization, and persistence of notifications
 */
class NotificationQueue {
    constructor() {
        this.db = null;
        this.queueTable = 'notificationQueue';
        this.maxQueueSize = 100;
        this.isInitialized = false;
    }

    /**
     * Initialize the queue system
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.isInitialized) return;

        try {
            // Wait for IndexedDB to be ready
            if (window.db) {
                this.db = window.db;
                console.log('✅ NotificationQueue initialized with existing DB');
            } else {
                console.warn('⚠️ IndexedDB not ready, waiting...');
                await this.waitForDB();
            }

            this.isInitialized = true;
            
            // Clean up old processed notifications
            await this.cleanupOldNotifications();
            
        } catch (error) {
            console.error('❌ Failed to initialize NotificationQueue:', error);
            throw error;
        }
    }

    /**
     * Wait for IndexedDB to be ready
     * @returns {Promise<void>}
     */
    async waitForDB() {
        return new Promise((resolve) => {
            const checkDB = setInterval(() => {
                if (window.db) {
                    this.db = window.db;
                    clearInterval(checkDB);
                    resolve();
                }
            }, 100);
            
            // Timeout after 10 seconds
            setTimeout(() => {
                clearInterval(checkDB);
                throw new Error('IndexedDB not available after timeout');
            }, 10000);
        });
    }

    /**
     * Enqueue a notification
     * @param {Object} notification - Notification object
     * @returns {Promise<string>} Notification ID
     */
    async enqueue(notification) {
        try {
            if (!this.isInitialized) await this.initialize();

            // Validate notification
            this.validateNotification(notification);

            // Check for duplicates
            const isDuplicate = await this.checkDuplicate(notification);
            if (isDuplicate) {
                console.log('⚠️ Duplicate notification detected, skipping:', notification.type);
                return null;
            }

            // Check queue size limit
            const queueSize = await this.getQueueSize();
            if (queueSize >= this.maxQueueSize) {
                console.warn('⚠️ Queue at max capacity, removing oldest notification');
                await this.removeOldest();
            }

            // Create queue item
            const queueItem = {
                id: notification.id || this.generateId(),
                type: notification.type,
                title: notification.title,
                message: notification.message,
                priority: notification.priority || 'medium',
                scheduledTime: notification.scheduledTime || new Date().toISOString(),
                actions: notification.actions || [],
                metadata: notification.metadata || {},
                status: 'pending', // pending, scheduled, sent, failed, cancelled
                attempts: 0,
                maxAttempts: 3,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                userId: window.currentUserId || null
            };

            // Calculate priority score
            queueItem.priorityScore = this.calculatePriorityScore(queueItem);

            // Store in IndexedDB
            if (this.db && this.db.db) {
                await this.db.db.notificationQueue.add(queueItem);
                console.log('✅ Notification enqueued:', queueItem.id, queueItem.type);
            }

            return queueItem.id;

        } catch (error) {
            console.error('❌ Failed to enqueue notification:', error);
            throw error;
        }
    }

    /**
     * Dequeue notifications ready for delivery
     * @param {number} limit - Max number to dequeue
     * @returns {Promise<Array>} Array of notifications
     */
    async dequeue(limit = 10) {
        try {
            if (!this.isInitialized) await this.initialize();

            const now = new Date().toISOString();

            // Get pending notifications that are ready
            const notifications = await this.db.db.notificationQueue
                .where('status')
                .equals('pending')
                .filter(n => n.scheduledTime <= now)
                .sortBy('priorityScore');

            // Return top priority notifications (highest score first)
            return notifications.reverse().slice(0, limit);

        } catch (error) {
            console.error('❌ Failed to dequeue notifications:', error);
            return [];
        }
    }

    /**
     * Get notification by ID
     * @param {string} notificationId - Notification ID
     * @returns {Promise<Object|null>} Notification object
     */
    async getNotification(notificationId) {
        try {
            if (!this.isInitialized) await this.initialize();

            return await this.db.db.notificationQueue.get(notificationId);

        } catch (error) {
            console.error('❌ Failed to get notification:', error);
            return null;
        }
    }

    /**
     * Update notification status
     * @param {string} notificationId - Notification ID
     * @param {string} status - New status
     * @param {Object} updates - Additional updates
     * @returns {Promise<void>}
     */
    async updateStatus(notificationId, status, updates = {}) {
        try {
            if (!this.isInitialized) await this.initialize();

            const notification = await this.getNotification(notificationId);
            if (!notification) {
                console.warn('⚠️ Notification not found:', notificationId);
                return;
            }

            await this.db.db.notificationQueue.update(notificationId, {
                status: status,
                updatedAt: new Date().toISOString(),
                ...updates
            });

            console.log(`✅ Notification ${notificationId} status updated to ${status}`);

        } catch (error) {
            console.error('❌ Failed to update notification status:', error);
        }
    }

    /**
     * Mark notification as sent
     * @param {string} notificationId - Notification ID
     * @returns {Promise<void>}
     */
    async markAsSent(notificationId) {
        await this.updateStatus(notificationId, 'sent', {
            sentAt: new Date().toISOString()
        });
    }

    /**
     * Mark notification as failed
     * @param {string} notificationId - Notification ID
     * @param {string} error - Error message
     * @returns {Promise<void>}
     */
    async markAsFailed(notificationId, error) {
        const notification = await this.getNotification(notificationId);
        if (!notification) return;

        const attempts = (notification.attempts || 0) + 1;
        const status = attempts >= notification.maxAttempts ? 'failed' : 'pending';

        await this.updateStatus(notificationId, status, {
            attempts: attempts,
            lastError: error,
            lastAttemptAt: new Date().toISOString()
        });
    }

    /**
     * Cancel notification
     * @param {string} notificationId - Notification ID
     * @returns {Promise<void>}
     */
    async cancel(notificationId) {
        await this.updateStatus(notificationId, 'cancelled', {
            cancelledAt: new Date().toISOString()
        });
    }

    /**
     * Get all pending notifications
     * @returns {Promise<Array>} Array of pending notifications
     */
    async getPending() {
        try {
            if (!this.isInitialized) await this.initialize();

            return await this.db.db.notificationQueue
                .where('status')
                .equals('pending')
                .sortBy('priorityScore');

        } catch (error) {
            console.error('❌ Failed to get pending notifications:', error);
            return [];
        }
    }

    /**
     * Get notifications by type
     * @param {string} type - Notification type
     * @returns {Promise<Array>} Array of notifications
     */
    async getByType(type) {
        try {
            if (!this.isInitialized) await this.initialize();

            return await this.db.db.notificationQueue
                .where('type')
                .equals(type)
                .toArray();

        } catch (error) {
            console.error('❌ Failed to get notifications by type:', error);
            return [];
        }
    }

    /**
     * Get queue statistics
     * @returns {Promise<Object>} Queue stats
     */
    async getStats() {
        try {
            if (!this.isInitialized) await this.initialize();

            const all = await this.db.db.notificationQueue.toArray();

            const stats = {
                total: all.length,
                pending: all.filter(n => n.status === 'pending').length,
                scheduled: all.filter(n => n.status === 'scheduled').length,
                sent: all.filter(n => n.status === 'sent').length,
                failed: all.filter(n => n.status === 'failed').length,
                cancelled: all.filter(n => n.status === 'cancelled').length,
                byType: {},
                byPriority: {
                    high: all.filter(n => n.priority === 'high').length,
                    medium: all.filter(n => n.priority === 'medium').length,
                    low: all.filter(n => n.priority === 'low').length
                }
            };

            // Count by type
            all.forEach(n => {
                stats.byType[n.type] = (stats.byType[n.type] || 0) + 1;
            });

            return stats;

        } catch (error) {
            console.error('❌ Failed to get queue stats:', error);
            return {
                total: 0,
                pending: 0,
                scheduled: 0,
                sent: 0,
                failed: 0,
                cancelled: 0,
                byType: {},
                byPriority: { high: 0, medium: 0, low: 0 }
            };
        }
    }

    /**
     * Calculate priority score for notification
     * @param {Object} notification - Notification object
     * @returns {number} Priority score (0-100)
     */
    calculatePriorityScore(notification) {
        let score = 50; // Base score

        // Priority weight (30 points)
        const priorityWeights = {
            'high': 30,
            'medium': 15,
            'low': 5
        };
        score += priorityWeights[notification.priority] || 15;

        // Type weight (20 points)
        const typeWeights = {
            'exam_alert': 20,
            'task_reminder': 15,
            'habit_reminder': 10,
            'focus_session': 10,
            'study_suggestion': 8,
            'achievement': 5,
            'productivity_nudge': 5
        };
        score += typeWeights[notification.type] || 5;

        // Time proximity (10 points)
        const scheduledTime = new Date(notification.scheduledTime);
        const now = new Date();
        const hoursUntil = (scheduledTime - now) / (1000 * 60 * 60);
        
        if (hoursUntil < 1) score += 10; // Very urgent
        else if (hoursUntil < 24) score += 8;
        else if (hoursUntil < 48) score += 5;
        else score += 2;

        // Metadata bonuses
        if (notification.metadata) {
            if (notification.metadata.examDaysAway <= 2) score += 10;
            if (notification.metadata.taskOverdue) score += 15;
            if (notification.metadata.habitStreak >= 7) score += 5;
        }

        return Math.min(score, 100); // Cap at 100
    }

    /**
     * Check for duplicate notification
     * @param {Object} notification - Notification to check
     * @returns {Promise<boolean>} True if duplicate exists
     */
    async checkDuplicate(notification) {
        try {
            const recent = await this.db.db.notificationQueue
                .where('type')
                .equals(notification.type)
                .filter(n => {
                    // Check if sent in last 24 hours
                    const sentAt = new Date(n.sentAt || n.createdAt);
                    const hoursSince = (new Date() - sentAt) / (1000 * 60 * 60);
                    return hoursSince < 24 && n.status === 'sent';
                })
                .toArray();

            // Check if same message exists
            return recent.some(n => 
                n.title === notification.title && 
                n.message === notification.message
            );

        } catch (error) {
            console.error('❌ Failed to check duplicate:', error);
            return false;
        }
    }

    /**
     * Get queue size
     * @returns {Promise<number>} Number of items in queue
     */
    async getQueueSize() {
        try {
            return await this.db.db.notificationQueue.count();
        } catch (error) {
            console.error('❌ Failed to get queue size:', error);
            return 0;
        }
    }

    /**
     * Remove oldest notification from queue
     * @returns {Promise<void>}
     */
    async removeOldest() {
        try {
            const oldest = await this.db.db.notificationQueue
                .orderBy('createdAt')
                .first();

            if (oldest) {
                await this.db.db.notificationQueue.delete(oldest.id);
                console.log('🗑️ Removed oldest notification:', oldest.id);
            }

        } catch (error) {
            console.error('❌ Failed to remove oldest notification:', error);
        }
    }

    /**
     * Clean up old notifications (older than 30 days)
     * @returns {Promise<number>} Number of deleted notifications
     */
    async cleanupOldNotifications() {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const old = await this.db.db.notificationQueue
                .where('createdAt')
                .below(thirtyDaysAgo.toISOString())
                .toArray();

            const ids = old.map(n => n.id);
            
            if (ids.length > 0) {
                await this.db.db.notificationQueue.bulkDelete(ids);
                console.log(`🗑️ Cleaned up ${ids.length} old notifications`);
            }

            return ids.length;

        } catch (error) {
            console.error('❌ Failed to cleanup old notifications:', error);
            return 0;
        }
    }

    /**
     * Clear all notifications
     * @returns {Promise<void>}
     */
    async clear() {
        try {
            if (!this.isInitialized) await this.initialize();

            await this.db.db.notificationQueue.clear();
            console.log('🗑️ Notification queue cleared');

        } catch (error) {
            console.error('❌ Failed to clear queue:', error);
        }
    }

    /**
     * Validate notification object
     * @param {Object} notification - Notification to validate
     * @throws {Error} If validation fails
     */
    validateNotification(notification) {
        if (!notification) {
            throw new Error('Notification is required');
        }

        const required = ['type', 'title', 'message'];
        for (const field of required) {
            if (!notification[field]) {
                throw new Error(`Notification ${field} is required`);
            }
        }

        const validTypes = [
            'task_reminder',
            'exam_alert',
            'habit_reminder',
            'study_suggestion',
            'focus_session',
            'achievement',
            'productivity_nudge'
        ];

        if (!validTypes.includes(notification.type)) {
            throw new Error(`Invalid notification type: ${notification.type}`);
        }

        const validPriorities = ['high', 'medium', 'low'];
        if (notification.priority && !validPriorities.includes(notification.priority)) {
            throw new Error(`Invalid priority: ${notification.priority}`);
        }
    }

    /**
     * Generate unique notification ID
     * @returns {string} Unique ID
     */
    generateId() {
        return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Export queue for debugging
     * @returns {Promise<Array>} All notifications
     */
    async exportQueue() {
        try {
            if (!this.isInitialized) await this.initialize();

            return await this.db.db.notificationQueue.toArray();

        } catch (error) {
            console.error('❌ Failed to export queue:', error);
            return [];
        }
    }
}

// ===== EXPORT SINGLETON =====
const notificationQueue = new NotificationQueue();
window.notificationQueue = notificationQueue;

// ===== AUTO-INITIALIZE =====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        notificationQueue.initialize().catch(console.error);
    });
} else {
    notificationQueue.initialize().catch(console.error);
}

console.log('✅ NotificationQueue module loaded');
