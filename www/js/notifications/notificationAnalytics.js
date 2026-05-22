// ===== NOTIFICATION ANALYTICS =====
// Tracks notification metrics and analytics

/**
 * Notification Analytics
 * Tracks delivery, opens, clicks, and other notification metrics
 */
class NotificationAnalytics {
    constructor() {
        this.initialized = false;
        this.metrics = {
            sent: 0,
            delivered: 0,
            opened: 0,
            clicked: 0,
            dismissed: 0,
            failed: 0
        };
        this.events = [];
    }

    /**
     * Initialize notification analytics
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.initialized) return;

        try {
            console.log('📊 Initializing NotificationAnalytics...');

            // Load metrics from storage
            await this.loadMetrics();

            // Setup periodic sync to Firestore
            this.setupPeriodicSync();

            this.initialized = true;
            console.log('✅ NotificationAnalytics initialized');

        } catch (error) {
            console.error('❌ Failed to initialize NotificationAnalytics:', error);
        }
    }

    /**
     * Load metrics from storage
     * @returns {Promise<void>}
     */
    async loadMetrics() {
        try {
            const stored = localStorage.getItem('notificationMetrics');
            
            if (stored) {
                const data = JSON.parse(stored);
                this.metrics = data.metrics || this.metrics;
                this.events = data.events || [];
                
                console.log('✅ Metrics loaded');
            }

        } catch (error) {
            console.error('❌ Error loading metrics:', error);
        }
    }

    /**
     * Save metrics to storage
     * @returns {Promise<void>}
     */
    async saveMetrics() {
        try {
            const data = {
                metrics: this.metrics,
                events: this.events.slice(-500), // Keep last 500 events
                lastUpdated: new Date().toISOString()
            };

            localStorage.setItem('notificationMetrics', JSON.stringify(data));

        } catch (error) {
            console.error('❌ Error saving metrics:', error);
        }
    }

    /**
     * Setup periodic sync to Firestore
     */
    setupPeriodicSync() {
        // Sync every 5 minutes
        setInterval(() => {
            this.syncToFirestore().catch(console.error);
        }, 5 * 60 * 1000);

        // Also sync on page unload
        window.addEventListener('beforeunload', () => {
            this.syncToFirestore().catch(console.error);
        });
    }

    /**
     * Sync analytics to Firestore
     * @returns {Promise<void>}
     */
    async syncToFirestore() {
        try {
            if (!window.currentUserId || typeof firebase === 'undefined') {
                return;
            }

            const analyticsData = {
                metrics: this.metrics,
                recentEvents: this.events.slice(-100), // Last 100 events
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };

            await firebase.firestore()
                .collection('users')
                .doc(window.currentUserId)
                .collection('analytics')
                .doc('notifications')
                .set(analyticsData, { merge: true });

            console.log('✅ Analytics synced to Firestore');

        } catch (error) {
            console.error('❌ Error syncing to Firestore:', error);
        }
    }

    /**
     * Track notification sent
     * @param {Object} notification - Notification object
     * @returns {Promise<void>}
     */
    async trackSent(notification) {
        try {
            this.metrics.sent++;

            const event = {
                type: 'sent',
                notificationId: notification.id,
                notificationType: notification.type,
                timestamp: new Date().toISOString(),
                priority: notification.priority
            };

            this.events.push(event);
            await this.saveMetrics();

            console.log(`📤 Tracked sent: ${notification.type}`);

        } catch (error) {
            console.error('❌ Error tracking sent:', error);
        }
    }

    /**
     * Track notification delivered
     * @param {Object} notification - Notification object
     * @returns {Promise<void>}
     */
    async trackDelivered(notification) {
        try {
            this.metrics.delivered++;

            const event = {
                type: 'delivered',
                notificationId: notification.id,
                notificationType: notification.type,
                timestamp: new Date().toISOString()
            };

            this.events.push(event);
            await this.saveMetrics();

            console.log(`📥 Tracked delivered: ${notification.type}`);

        } catch (error) {
            console.error('❌ Error tracking delivered:', error);
        }
    }

    /**
     * Track notification received (on device)
     * @param {Object} notification - Notification object
     * @returns {Promise<void>}
     */
    async trackReceived(notification) {
        try {
            const event = {
                type: 'received',
                notificationId: notification.id,
                notificationType: notification.type,
                timestamp: new Date().toISOString()
            };

            this.events.push(event);
            await this.saveMetrics();

            console.log(`📬 Tracked received: ${notification.type}`);

        } catch (error) {
            console.error('❌ Error tracking received:', error);
        }
    }

    /**
     * Track notification opened
     * @param {Object} notification - Notification object
     * @returns {Promise<void>}
     */
    async trackOpened(notification) {
        try {
            this.metrics.opened++;

            const event = {
                type: 'opened',
                notificationId: notification.id || notification.notificationId,
                notificationType: notification.type,
                timestamp: new Date().toISOString(),
                timeToOpen: this.calculateTimeToOpen(notification)
            };

            this.events.push(event);
            await this.saveMetrics();

            console.log(`👀 Tracked opened: ${notification.type}`);

        } catch (error) {
            console.error('❌ Error tracking opened:', error);
        }
    }

    /**
     * Track notification clicked (action performed)
     * @param {Object} notification - Notification object
     * @returns {Promise<void>}
     */
    async trackClicked(notification) {
        try {
            this.metrics.clicked++;

            const event = {
                type: 'clicked',
                notificationId: notification.id || notification.notificationId,
                notificationType: notification.type,
                actionId: notification.actionId,
                timestamp: new Date().toISOString(),
                timeToClick: this.calculateTimeToOpen(notification)
            };

            this.events.push(event);
            await this.saveMetrics();

            console.log(`👆 Tracked clicked: ${notification.type} - ${notification.actionId}`);

        } catch (error) {
            console.error('❌ Error tracking clicked:', error);
        }
    }

    /**
     * Track notification dismissed
     * @param {Object} notification - Notification object
     * @returns {Promise<void>}
     */
    async trackDismissed(notification) {
        try {
            this.metrics.dismissed++;

            const event = {
                type: 'dismissed',
                notificationId: notification.id || notification.notificationId,
                notificationType: notification.type,
                timestamp: new Date().toISOString()
            };

            this.events.push(event);
            await this.saveMetrics();

            console.log(`❌ Tracked dismissed: ${notification.type}`);

        } catch (error) {
            console.error('❌ Error tracking dismissed:', error);
        }
    }

    /**
     * Track notification failed
     * @param {Object} notification - Notification object
     * @param {string} reason - Failure reason
     * @returns {Promise<void>}
     */
    async trackFailed(notification, reason) {
        try {
            this.metrics.failed++;

            const event = {
                type: 'failed',
                notificationId: notification.id,
                notificationType: notification.type,
                timestamp: new Date().toISOString(),
                reason: reason
            };

            this.events.push(event);
            await this.saveMetrics();

            console.log(`⚠️ Tracked failed: ${notification.type} - ${reason}`);

        } catch (error) {
            console.error('❌ Error tracking failed:', error);
        }
    }

    /**
     * Calculate time between notification sent and opened/clicked
     * @param {Object} notification - Notification object
     * @returns {number} Time in seconds
     */
    calculateTimeToOpen(notification) {
        try {
            const sentEvent = this.events.find(
                e => e.notificationId === notification.id && e.type === 'sent'
            );

            if (sentEvent) {
                const sentTime = new Date(sentEvent.timestamp);
                const now = new Date();
                return Math.floor((now - sentTime) / 1000); // seconds
            }

            return 0;

        } catch (error) {
            console.error('❌ Error calculating time to open:', error);
            return 0;
        }
    }

    /**
     * Get overall statistics
     * @returns {Object} Statistics
     */
    getStats() {
        const stats = {
            ...this.metrics,
            deliveryRate: this.metrics.sent > 0 
                ? (this.metrics.delivered / this.metrics.sent) * 100 
                : 0,
            openRate: this.metrics.delivered > 0 
                ? (this.metrics.opened / this.metrics.delivered) * 100 
                : 0,
            clickRate: this.metrics.delivered > 0 
                ? (this.metrics.clicked / this.metrics.delivered) * 100 
                : 0,
            dismissRate: this.metrics.delivered > 0 
                ? (this.metrics.dismissed / this.metrics.delivered) * 100 
                : 0,
            failureRate: this.metrics.sent > 0 
                ? (this.metrics.failed / this.metrics.sent) * 100 
                : 0
        };

        // Round percentages
        stats.deliveryRate = Math.round(stats.deliveryRate * 10) / 10;
        stats.openRate = Math.round(stats.openRate * 10) / 10;
        stats.clickRate = Math.round(stats.clickRate * 10) / 10;
        stats.dismissRate = Math.round(stats.dismissRate * 10) / 10;
        stats.failureRate = Math.round(stats.failureRate * 10) / 10;

        return stats;
    }

    /**
     * Get statistics by notification type
     * @returns {Object} Type-specific statistics
     */
    getStatsByType() {
        const typeStats = {};

        this.events.forEach(event => {
            const type = event.notificationType;
            
            if (!typeStats[type]) {
                typeStats[type] = {
                    sent: 0,
                    delivered: 0,
                    opened: 0,
                    clicked: 0,
                    dismissed: 0,
                    failed: 0
                };
            }

            typeStats[type][event.type]++;
        });

        // Calculate rates for each type
        Object.keys(typeStats).forEach(type => {
            const stats = typeStats[type];
            
            stats.openRate = stats.delivered > 0 
                ? Math.round((stats.opened / stats.delivered) * 1000) / 10 
                : 0;
            
            stats.clickRate = stats.delivered > 0 
                ? Math.round((stats.clicked / stats.delivered) * 1000) / 10 
                : 0;
            
            stats.dismissRate = stats.delivered > 0 
                ? Math.round((stats.dismissed / stats.delivered) * 1000) / 10 
                : 0;
        });

        return typeStats;
    }

    /**
     * Get recent events
     * @param {number} limit - Number of events to return
     * @returns {Array} Recent events
     */
    getRecentEvents(limit = 50) {
        return this.events.slice(-limit).reverse();
    }

    /**
     * Get events for a specific notification
     * @param {string} notificationId - Notification ID
     * @returns {Array} Events for this notification
     */
    getNotificationEvents(notificationId) {
        return this.events.filter(e => e.notificationId === notificationId);
    }

    /**
     * Get average time to open
     * @returns {number} Average time in seconds
     */
    getAverageTimeToOpen() {
        const openedEvents = this.events.filter(e => e.type === 'opened' && e.timeToOpen);
        
        if (openedEvents.length === 0) return 0;

        const total = openedEvents.reduce((sum, e) => sum + e.timeToOpen, 0);
        return Math.round(total / openedEvents.length);
    }

    /**
     * Get analytics summary
     * @returns {Object} Analytics summary
     */
    getSummary() {
        return {
            overall: this.getStats(),
            byType: this.getStatsByType(),
            averageTimeToOpen: this.getAverageTimeToOpen(),
            totalEvents: this.events.length,
            recentEvents: this.getRecentEvents(10)
        };
    }

    /**
     * Reset all metrics
     * @returns {Promise<void>}
     */
    async reset() {
        this.metrics = {
            sent: 0,
            delivered: 0,
            opened: 0,
            clicked: 0,
            dismissed: 0,
            failed: 0
        };
        this.events = [];

        await this.saveMetrics();
        console.log('✅ Analytics reset');
    }

    /**
     * Export analytics data
     * @returns {Object} Exported data
     */
    exportData() {
        return {
            metrics: this.metrics,
            events: this.events,
            summary: this.getSummary(),
            exportedAt: new Date().toISOString()
        };
    }

    /**
     * Get notification performance score
     * @returns {number} Score 0-100
     */
    getPerformanceScore() {
        const stats = this.getStats();
        
        // Weight different metrics
        const deliveryScore = stats.deliveryRate * 0.2;
        const openScore = stats.openRate * 0.4;
        const clickScore = stats.clickRate * 0.3;
        const failurePenalty = stats.failureRate * 0.1;

        const score = deliveryScore + openScore + clickScore - failurePenalty;
        
        return Math.max(0, Math.min(100, Math.round(score)));
    }
}

// ===== EXPORT SINGLETON =====
const notificationAnalytics = new NotificationAnalytics();
window.notificationAnalytics = notificationAnalytics;

// ===== AUTO-INITIALIZE =====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        notificationAnalytics.initialize().catch(console.error);
    });
} else {
    notificationAnalytics.initialize().catch(console.error);
}

console.log('✅ NotificationAnalytics module loaded');
