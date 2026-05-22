// ===== NOTIFICATION UI COMPONENTS =====
// UI components for notification center and management

/**
 * Notification UI
 * Provides UI components for viewing and managing notifications
 */
class NotificationUI {
    constructor() {
        this.initialized = false;
        this.unreadCount = 0;
        this.notifications = [];
        this.centerVisible = false;
    }

    /**
     * Initialize notification UI
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.initialized) return;

        try {
            console.log('🎨 Initializing NotificationUI...');

            // Load notifications
            await this.loadNotifications();

            // Setup UI elements
            this.setupUI();

            // Start periodic updates
            this.startPeriodicUpdates();

            this.initialized = true;
            console.log('✅ NotificationUI initialized');

        } catch (error) {
            console.error('❌ Failed to initialize NotificationUI:', error);
        }
    }

    /**
     * Load notifications from queue
     * @returns {Promise<void>}
     */
    async loadNotifications() {
        try {
            if (window.notificationEngine) {
                this.notifications = await window.notificationEngine.getPendingNotifications();
                this.updateUnreadCount();
            }
        } catch (error) {
            console.error('❌ Error loading notifications:', error);
        }
    }

    /**
     * Setup UI elements
     */
    setupUI() {
        // Create notification center button if not exists
        this.createNotificationButton();

        // Create notification center panel
        this.createNotificationCenter();

        // Update badge
        this.updateBadge();

        console.log('✅ UI elements setup');
    }

    /**
     * Create notification button in header
     */
    createNotificationButton() {
        const existingButton = document.getElementById('notificationButton');
        if (existingButton) return;

        // Find header or create container
        let container = document.querySelector('.app-header');
        
        if (!container) {
            // Create a container if header doesn't exist
            container = document.createElement('div');
            container.className = 'notification-container';
            container.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 1000;';
            document.body.appendChild(container);
        }

        // Create button
        const button = document.createElement('button');
        button.id = 'notificationButton';
        button.className = 'notification-button';
        button.innerHTML = `
            <span class="notification-icon">🔔</span>
            <span class="notification-badge" id="notificationBadge" style="display: none;">0</span>
        `;
        button.onclick = () => this.toggleNotificationCenter();

        container.appendChild(button);
    }

    /**
     * Create notification center panel
     */
    createNotificationCenter() {
        const existingCenter = document.getElementById('notificationCenter');
        if (existingCenter) return;

        const center = document.createElement('div');
        center.id = 'notificationCenter';
        center.className = 'notification-center';
        center.style.cssText = `
            position: fixed;
            top: 60px;
            right: 10px;
            width: 350px;
            max-height: 500px;
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: none;
            z-index: 1001;
            overflow: hidden;
        `;

        center.innerHTML = `
            <div class="notification-header" style="padding: 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 16px;">Notifications</h3>
                <div>
                    <button onclick="notificationUI.markAllAsRead()" style="background: none; border: none; color: #007bff; cursor: pointer; font-size: 12px; margin-right: 10px;">Mark all read</button>
                    <button onclick="notificationUI.closeNotificationCenter()" style="background: none; border: none; font-size: 20px; cursor: pointer;">×</button>
                </div>
            </div>
            <div class="notification-list" id="notificationList" style="max-height: 400px; overflow-y: auto; padding: 10px;">
                <div class="notification-empty" style="text-align: center; padding: 40px 20px; color: #999;">
                    <div style="font-size: 48px;">🔕</div>
                    <p>No notifications</p>
                </div>
            </div>
        `;

        document.body.appendChild(center);
    }

    /**
     * Toggle notification center visibility
     */
    toggleNotificationCenter() {
        const center = document.getElementById('notificationCenter');
        
        if (this.centerVisible) {
            this.closeNotificationCenter();
        } else {
            this.openNotificationCenter();
        }
    }

    /**
     * Open notification center
     */
    async openNotificationCenter() {
        const center = document.getElementById('notificationCenter');
        center.style.display = 'block';
        this.centerVisible = true;

        // Reload notifications
        await this.loadNotifications();
        
        // Render notifications
        this.renderNotifications();
    }

    /**
     * Close notification center
     */
    closeNotificationCenter() {
        const center = document.getElementById('notificationCenter');
        center.style.display = 'none';
        this.centerVisible = false;
    }

    /**
     * Render notifications in the center
     */
    renderNotifications() {
        const list = document.getElementById('notificationList');
        
        if (!list) return;

        if (this.notifications.length === 0) {
            list.innerHTML = `
                <div class="notification-empty" style="text-align: center; padding: 40px 20px; color: #999;">
                    <div style="font-size: 48px;">🔕</div>
                    <p>No notifications</p>
                </div>
            `;
            return;
        }

        // Sort by scheduled time (newest first)
        const sorted = [...this.notifications].sort((a, b) => 
            new Date(b.scheduledTime) - new Date(a.scheduledTime)
        );

        list.innerHTML = sorted.map(notif => this.renderNotificationItem(notif)).join('');
    }

    /**
     * Render single notification item
     * @param {Object} notification - Notification object
     * @returns {string} HTML string
     */
    renderNotificationItem(notification) {
        const icon = this.getNotificationIcon(notification.type);
        const timeAgo = this.getTimeAgo(notification.scheduledTime);
        const priorityColor = this.getPriorityColor(notification.priority);

        return `
            <div class="notification-item" data-id="${notification.id}" style="
                padding: 12px;
                border-bottom: 1px solid #f0f0f0;
                cursor: pointer;
                transition: background 0.2s;
            " onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='white'" onclick="notificationUI.handleNotificationClick('${notification.id}')">
                <div style="display: flex; align-items: start;">
                    <div style="font-size: 24px; margin-right: 12px;">${icon}</div>
                    <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; align-items: start;">
                            <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600;">${notification.title}</h4>
                            <span style="background: ${priorityColor}; color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px; text-transform: uppercase;">${notification.priority}</span>
                        </div>
                        <p style="margin: 0 0 6px 0; font-size: 12px; color: #666;">${notification.message}</p>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 11px; color: #999;">${timeAgo}</span>
                            <button onclick="event.stopPropagation(); notificationUI.dismissNotification('${notification.id}')" style="background: none; border: none; color: #999; cursor: pointer; font-size: 11px; padding: 4px 8px;">Dismiss</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Get notification icon based on type
     * @param {string} type - Notification type
     * @returns {string} Icon emoji
     */
    getNotificationIcon(type) {
        const icons = {
            'task_reminder': '✅',
            'exam_alert': '📝',
            'habit_reminder': '💪',
            'study_suggestion': '📚',
            'focus_session': '🎯',
            'achievement': '🏆',
            'productivity_nudge': '⚡'
        };

        return icons[type] || '🔔';
    }

    /**
     * Get priority color
     * @param {string} priority - Priority level
     * @returns {string} Color hex
     */
    getPriorityColor(priority) {
        const colors = {
            'high': '#dc3545',
            'medium': '#ffc107',
            'low': '#28a745'
        };

        return colors[priority] || '#6c757d';
    }

    /**
     * Get time ago string
     * @param {string} timestamp - ISO timestamp
     * @returns {string} Time ago string
     */
    getTimeAgo(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);

        if (seconds < 0) {
            // Future notification
            const futureSeconds = Math.abs(seconds);
            
            if (futureSeconds < 3600) {
                return `in ${Math.floor(futureSeconds / 60)} min`;
            } else if (futureSeconds < 86400) {
                return `in ${Math.floor(futureSeconds / 3600)} hrs`;
            } else {
                return `in ${Math.floor(futureSeconds / 86400)} days`;
            }
        }

        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hrs ago`;
        return `${Math.floor(seconds / 86400)} days ago`;
    }

    /**
     * Handle notification click
     * @param {string} id - Notification ID
     */
    async handleNotificationClick(id) {
        try {
            const notification = this.notifications.find(n => n.id === id);
            
            if (!notification) return;

            // Track click
            if (window.notificationEngine) {
                await window.notificationEngine.trackInteraction({
                    notificationId: id,
                    type: notification.type,
                    action: 'opened'
                });
            }

            // Navigate based on type
            this.navigateToNotification(notification);

            // Mark as read (cancel from queue)
            await this.dismissNotification(id);

        } catch (error) {
            console.error('❌ Error handling notification click:', error);
        }
    }

    /**
     * Navigate based on notification type
     * @param {Object} notification - Notification object
     */
    navigateToNotification(notification) {
        const routes = {
            'task_reminder': '/tasks',
            'exam_alert': '/academic',
            'habit_reminder': '/habits',
            'study_suggestion': '/focus',
            'focus_session': '/focus',
            'achievement': '/profile',
            'productivity_nudge': '/tasks'
        };

        const route = routes[notification.type];
        
        if (route && window.location.pathname !== route) {
            window.location.href = route;
        }

        this.closeNotificationCenter();
    }

    /**
     * Dismiss a notification
     * @param {string} id - Notification ID
     */
    async dismissNotification(id) {
        try {
            // Cancel from queue
            if (window.notificationEngine) {
                await window.notificationEngine.cancelNotification(id);
            }

            // Remove from UI
            this.notifications = this.notifications.filter(n => n.id !== id);
            
            // Re-render
            this.renderNotifications();
            this.updateUnreadCount();
            this.updateBadge();

            console.log(`✅ Notification ${id} dismissed`);

        } catch (error) {
            console.error('❌ Error dismissing notification:', error);
        }
    }

    /**
     * Mark all notifications as read
     */
    async markAllAsRead() {
        try {
            // Dismiss all notifications
            for (const notification of this.notifications) {
                await this.dismissNotification(notification.id);
            }

            this.notifications = [];
            this.renderNotifications();
            this.updateUnreadCount();
            this.updateBadge();

            console.log('✅ All notifications marked as read');

        } catch (error) {
            console.error('❌ Error marking all as read:', error);
        }
    }

    /**
     * Update unread count
     */
    updateUnreadCount() {
        this.unreadCount = this.notifications.filter(n => n.status === 'pending' || n.status === 'scheduled').length;
    }

    /**
     * Update badge display
     */
    updateBadge() {
        const badge = document.getElementById('notificationBadge');
        
        if (!badge) return;

        if (this.unreadCount > 0) {
            badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }

    /**
     * Show notification settings dialog
     */
    showSettings() {
        // Create settings modal
        const modal = document.createElement('div');
        modal.id = 'notificationSettingsModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
        `;

        modal.innerHTML = `
            <div style="background: white; border-radius: 8px; padding: 24px; max-width: 500px; width: 90%;">
                <h2 style="margin-top: 0;">Notification Settings</h2>
                
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px;">Daily Notification Limit</label>
                    <input type="number" id="dailyLimit" min="1" max="20" value="5" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" />
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px;">Quiet Hours Start</label>
                    <input type="time" id="quietHoursStart" value="22:00" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" />
                </div>

                <div style="margin-bottom: 24px;">
                    <label style="display: block; margin-bottom: 8px;">Quiet Hours End</label>
                    <input type="time" id="quietHoursEnd" value="07:00" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" />
                </div>

                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button onclick="notificationUI.closeSettings()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
                    <button onclick="notificationUI.saveSettings()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Save</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Load current preferences
        this.loadSettingsValues();
    }

    /**
     * Load current settings into form
     */
    async loadSettingsValues() {
        try {
            if (window.notificationEngine) {
                const prefs = await window.notificationEngine.getPreferences();
                
                if (prefs) {
                    document.getElementById('dailyLimit').value = prefs.dailyLimit || 5;
                    document.getElementById('quietHoursStart').value = prefs.quietHours?.start || '22:00';
                    document.getElementById('quietHoursEnd').value = prefs.quietHours?.end || '07:00';
                }
            }
        } catch (error) {
            console.error('❌ Error loading settings:', error);
        }
    }

    /**
     * Save notification settings
     */
    async saveSettings() {
        try {
            const preferences = {
                dailyLimit: parseInt(document.getElementById('dailyLimit').value),
                quietHours: {
                    start: document.getElementById('quietHoursStart').value,
                    end: document.getElementById('quietHoursEnd').value
                },
                minGapMinutes: 60 // Could add UI for this
            };

            if (window.notificationEngine) {
                await window.notificationEngine.updatePreferences(preferences);
            }

            console.log('✅ Settings saved');
            this.closeSettings();

        } catch (error) {
            console.error('❌ Error saving settings:', error);
        }
    }

    /**
     * Close settings modal
     */
    closeSettings() {
        const modal = document.getElementById('notificationSettingsModal');
        if (modal) {
            modal.remove();
        }
    }

    /**
     * Start periodic updates
     */
    startPeriodicUpdates() {
        // Refresh notifications every 30 seconds
        setInterval(async () => {
            await this.loadNotifications();
            this.updateBadge();
            
            // Re-render if center is open
            if (this.centerVisible) {
                this.renderNotifications();
            }
        }, 30000);
    }

    /**
     * Show notification preview (for testing)
     * @param {Object} notification - Notification object
     */
    showPreview(notification) {
        const preview = document.createElement('div');
        preview.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 16px;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 3000;
            animation: slideIn 0.3s ease-out;
        `;

        const icon = this.getNotificationIcon(notification.type);

        preview.innerHTML = `
            <div style="display: flex; align-items: start;">
                <div style="font-size: 32px; margin-right: 12px;">${icon}</div>
                <div style="flex: 1;">
                    <h4 style="margin: 0 0 8px 0; font-size: 16px;">${notification.title}</h4>
                    <p style="margin: 0; font-size: 14px; color: #666;">${notification.message}</p>
                </div>
            </div>
        `;

        document.body.appendChild(preview);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            preview.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => preview.remove(), 300);
        }, 5000);
    }
}

// ===== EXPORT SINGLETON =====
const notificationUI = new NotificationUI();
window.notificationUI = notificationUI;

// ===== AUTO-INITIALIZE =====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        notificationUI.initialize().catch(console.error);
    });
} else {
    notificationUI.initialize().catch(console.error);
}

console.log('✅ NotificationUI module loaded');
