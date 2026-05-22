// ===== NOTIFICATION RULES ENGINE =====
// Implements business rules, priority scoring, and notification generation logic

/**
 * Notification Rules Engine
 * Determines when, what, and how to send notifications
 */
class NotificationRules {
    constructor() {
        this.dailyLimit = 5;
        this.minimumGapMinutes = 60;
        this.quietHours = {
            enabled: false,
            start: '22:00', // 10 PM
            end: '07:00'    // 7 AM
        };
        this.spamProtection = true;
        this.initialized = false;
    }

    /**
     * Initialize rules engine
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // Load user preferences
            await this.loadUserPreferences();
            
            this.initialized = true;
            console.log('✅ NotificationRules initialized');

        } catch (error) {
            console.error('❌ Failed to initialize NotificationRules:', error);
        }
    }

    /**
     * Load user notification preferences
     * @returns {Promise<void>}
     */
    async loadUserPreferences() {
        try {
            const prefs = localStorage.getItem('notificationPreferences');
            if (prefs) {
                const parsed = JSON.parse(prefs);
                this.dailyLimit = parsed.dailyLimit || 5;
                this.minimumGapMinutes = parsed.minimumGap || 60;
                this.quietHours = parsed.quietHours || this.quietHours;
                this.spamProtection = parsed.spamProtection !== false;
            }

        } catch (error) {
            console.error('❌ Failed to load preferences:', error);
        }
    }

    /**
     * Save user notification preferences
     * @param {Object} preferences - User preferences
     * @returns {Promise<void>}
     */
    async saveUserPreferences(preferences) {
        try {
            const prefs = {
                dailyLimit: preferences.dailyLimit || this.dailyLimit,
                minimumGap: preferences.minimumGap || this.minimumGapMinutes,
                quietHours: preferences.quietHours || this.quietHours,
                spamProtection: preferences.spamProtection !== false
            };

            localStorage.setItem('notificationPreferences', JSON.stringify(prefs));
            
            // Apply immediately
            this.dailyLimit = prefs.dailyLimit;
            this.minimumGapMinutes = prefs.minimumGap;
            this.quietHours = prefs.quietHours;
            this.spamProtection = prefs.spamProtection;

            console.log('✅ Notification preferences saved:', prefs);

        } catch (error) {
            console.error('❌ Failed to save preferences:', error);
        }
    }

    /**
     * Check if notification should be sent based on all rules
     * @param {Object} notification - Notification to check
     * @returns {Promise<Object>} Result with allowed flag and reason
     */
    async shouldSendNotification(notification) {
        if (!this.initialized) await this.initialize();

        try {
            // Check quiet hours
            if (this.isQuietHours()) {
                return {
                    allowed: false,
                    reason: 'quiet_hours',
                    message: 'Currently in quiet hours'
                };
            }

            // Check daily limit
            const dailyCount = await this.getDailySentCount();
            if (dailyCount >= this.dailyLimit) {
                return {
                    allowed: false,
                    reason: 'daily_limit_reached',
                    message: `Daily limit of ${this.dailyLimit} notifications reached`
                };
            }

            // Check minimum gap between notifications
            const timeSinceLastSent = await this.getTimeSinceLastSent();
            if (timeSinceLastSent < this.minimumGapMinutes) {
                return {
                    allowed: false,
                    reason: 'too_frequent',
                    message: `Must wait ${this.minimumGapMinutes - timeSinceLastSent} more minutes`
                };
            }

            // Check duplicate (spam protection)
            if (this.spamProtection) {
                const isDuplicate = await window.notificationQueue.checkDuplicate(notification);
                if (isDuplicate) {
                    return {
                        allowed: false,
                        reason: 'duplicate',
                        message: 'Similar notification already sent recently'
                    };
                }
            }

            // All checks passed
            return {
                allowed: true,
                reason: 'approved',
                message: 'Notification approved for delivery'
            };

        } catch (error) {
            console.error('❌ Error checking notification rules:', error);
            return {
                allowed: false,
                reason: 'error',
                message: error.message
            };
        }
    }

    /**
     * Check if currently in quiet hours
     * @returns {boolean} True if in quiet hours
     */
    isQuietHours() {
        if (!this.quietHours.enabled) return false;

        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        const [startHour, startMin] = this.quietHours.start.split(':').map(Number);
        const [endHour, endMin] = this.quietHours.end.split(':').map(Number);
        const [currHour, currMin] = currentTime.split(':').map(Number);

        const start = startHour * 60 + startMin;
        const end = endHour * 60 + endMin;
        const current = currHour * 60 + currMin;

        // Handle overnight quiet hours (e.g., 22:00 - 07:00)
        if (start > end) {
            return current >= start || current < end;
        } else {
            return current >= start && current < end;
        }
    }

    /**
     * Get count of notifications sent today
     * @returns {Promise<number>} Count
     */
    async getDailySentCount() {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (!window.notificationQueue.isInitialized) {
                await window.notificationQueue.initialize();
            }

            const all = await window.notificationQueue.db.db.notificationQueue
                .where('status')
                .equals('sent')
                .filter(n => new Date(n.sentAt) >= today)
                .count();

            return all;

        } catch (error) {
            console.error('❌ Failed to get daily count:', error);
            return 0;
        }
    }

    /**
     * Get minutes since last notification was sent
     * @returns {Promise<number>} Minutes since last sent
     */
    async getTimeSinceLastSent() {
        try {
            if (!window.notificationQueue.isInitialized) {
                await window.notificationQueue.initialize();
            }

            const lastSent = await window.notificationQueue.db.db.notificationQueue
                .where('status')
                .equals('sent')
                .reverse()
                .sortBy('sentAt');

            if (lastSent.length === 0) {
                return Infinity; // No notifications sent yet
            }

            const lastSentTime = new Date(lastSent[0].sentAt);
            const now = new Date();
            const minutesSince = (now - lastSentTime) / (1000 * 60);

            return minutesSince;

        } catch (error) {
            console.error('❌ Failed to get time since last sent:', error);
            return Infinity;
        }
    }

    /**
     * Generate notification for task reminder
     * @param {Object} task - Task object
     * @returns {Object} Notification object
     */
    generateTaskReminder(task) {
        const dueDate = task.dueDate ? new Date(task.dueDate) : null;
        const now = new Date();
        const hoursUntilDue = dueDate ? (dueDate - now) / (1000 * 60 * 60) : null;

        let message = `Task: ${task.text}`;
        let priority = 'medium';
        let scheduledTime = new Date();

        if (dueDate) {
            if (hoursUntilDue < 0) {
                message = `Overdue: ${task.text}`;
                priority = 'high';
            } else if (hoursUntilDue < 2) {
                message = `Due in ${Math.round(hoursUntilDue)} hours: ${task.text}`;
                priority = 'high';
            } else if (hoursUntilDue < 24) {
                message = `Due today: ${task.text}`;
                priority = 'high';
                // Schedule for 2 hours before due time
                scheduledTime = new Date(dueDate.getTime() - 2 * 60 * 60 * 1000);
            } else {
                message = `Upcoming: ${task.text}`;
                priority = 'medium';
                // Schedule for evening before due date (8 PM)
                scheduledTime = new Date(dueDate);
                scheduledTime.setDate(scheduledTime.getDate() - 1);
                scheduledTime.setHours(20, 0, 0, 0);
            }
        }

        return {
            type: 'task_reminder',
            title: 'Task Reminder',
            message: message,
            priority: priority,
            scheduledTime: scheduledTime.toISOString(),
            actions: ['Complete Task', 'View Details'],
            metadata: {
                taskId: task.id,
                dueDate: task.dueDate,
                taskOverdue: hoursUntilDue < 0,
                hoursUntilDue: hoursUntilDue
            }
        };
    }

    /**
     * Generate notification for exam alert
     * @param {Object} exam - Exam object
     * @returns {Object} Notification object
     */
    generateExamAlert(exam) {
        const examDate = new Date(exam.date);
        const now = new Date();
        const daysUntil = Math.ceil((examDate - now) / (1000 * 60 * 60 * 24));

        let message = '';
        let priority = 'medium';

        if (daysUntil <= 0) {
            message = `${exam.name} exam is today!`;
            priority = 'high';
        } else if (daysUntil === 1) {
            message = `${exam.name} exam is tomorrow!`;
            priority = 'high';
        } else if (daysUntil === 2) {
            message = `${exam.name} exam in 2 days. Schedule a revision session.`;
            priority = 'high';
        } else if (daysUntil <= 7) {
            message = `${exam.name} exam in ${daysUntil} days. Start preparing!`;
            priority = 'medium';
        } else {
            message = `Upcoming: ${exam.name} exam in ${daysUntil} days`;
            priority = 'low';
        }

        return {
            type: 'exam_alert',
            title: 'Exam Alert',
            message: message,
            priority: priority,
            scheduledTime: new Date().toISOString(),
            actions: ['Start Focus Session', 'Open Study Plan'],
            metadata: {
                examId: exam.id,
                examDate: exam.date,
                examDaysAway: daysUntil,
                subjectId: exam.subjectId
            }
        };
    }

    /**
     * Generate notification for habit reminder
     * @param {Object} habit - Habit object
     * @returns {Object} Notification object
     */
    generateHabitReminder(habit) {
        const today = new Date().toISOString().split('T')[0];
        const completedToday = habit.completedDates?.includes(today);

        if (completedToday) {
            return null; // Don't remind if already completed
        }

        const streak = habit.streak || 0;
        let message = `Time to complete: ${habit.text}`;
        let priority = 'medium';

        if (streak >= 7) {
            message = `Keep your ${streak}-day streak going! ${habit.text}`;
            priority = 'high';
        } else if (streak >= 3) {
            message = `${streak} days strong! Don't break the streak: ${habit.text}`;
            priority = 'medium';
        }

        // Schedule for habit's preferred time or default to 8 AM
        const scheduledTime = new Date();
        if (habit.reminderTime && habit.reminderTime.length > 0 && typeof habit.reminderTime[0] === 'string') {
            const timeParts = habit.reminderTime[0].split(':');
            if (timeParts.length >= 2) {
                const hours = parseInt(timeParts[0]);
                const minutes = parseInt(timeParts[1]);
                if (!isNaN(hours) && !isNaN(minutes)) {
                    scheduledTime.setHours(hours, minutes, 0, 0);
                } else {
                    scheduledTime.setHours(8, 0, 0, 0);
                }
            } else {
                scheduledTime.setHours(8, 0, 0, 0);
            }
        } else {
            scheduledTime.setHours(8, 0, 0, 0);
        }

        return {
            type: 'habit_reminder',
            title: 'Habit Reminder',
            message: message,
            priority: priority,
            scheduledTime: scheduledTime.toISOString(),
            actions: ['Mark Complete', 'Skip Today'],
            metadata: {
                habitId: habit.id,
                habitStreak: streak,
                habitText: habit.text
            }
        };
    }

    /**
     * Generate study session suggestion
     * @param {Object} subject - Subject to study
     * @param {string} reason - Reason for suggestion
     * @returns {Object} Notification object
     */
    generateStudySuggestion(subject, reason = 'general') {
        let message = `Time to study ${subject.name}`;
        let priority = 'medium';

        if (reason === 'exam_approaching') {
            message = `Study ${subject.name} - Exam approaching`;
            priority = 'high';
        } else if (reason === 'low_study_time') {
            message = `You haven't studied ${subject.name} recently`;
            priority = 'medium';
        } else if (reason === 'scheduled') {
            message = `Scheduled study time: ${subject.name}`;
            priority = 'medium';
        }

        return {
            type: 'study_suggestion',
            title: 'Study Suggestion',
            message: message,
            priority: priority,
            scheduledTime: new Date().toISOString(),
            actions: ['Start Focus Session', 'Reschedule'],
            metadata: {
                subjectId: subject.id,
                subjectName: subject.name,
                suggestionReason: reason
            }
        };
    }

    /**
     * Generate focus session reminder
     * @param {Object} session - Session details
     * @returns {Object} Notification object
     */
    generateFocusSessionReminder(session) {
        return {
            type: 'focus_session',
            title: 'Focus Session Reminder',
            message: `Start your ${session.duration || 25}-minute focus session`,
            priority: 'medium',
            scheduledTime: new Date(session.scheduledTime).toISOString(),
            actions: ['Start Now', 'Snooze 15min'],
            metadata: {
                sessionId: session.id,
                duration: session.duration,
                subjectId: session.subjectId
            }
        };
    }

    /**
     * Generate achievement notification
     * @param {Object} achievement - Achievement unlocked
     * @returns {Object} Notification object
     */
    generateAchievement(achievement) {
        return {
            type: 'achievement',
            title: '🏆 Achievement Unlocked!',
            message: achievement.message || `You earned: ${achievement.name}`,
            priority: 'low',
            scheduledTime: new Date().toISOString(),
            actions: ['View Badge', 'Share'],
            metadata: {
                achievementId: achievement.id,
                achievementName: achievement.name,
                xpEarned: achievement.xp
            }
        };
    }

    /**
     * Generate productivity nudge
     * @param {string} nudgeType - Type of nudge
     * @returns {Object} Notification object
     */
    generateProductivityNudge(nudgeType) {
        const nudges = {
            'start_day': {
                title: 'Good Morning!',
                message: 'Ready to tackle your tasks today?',
                actions: ['View Tasks', 'Start Focus Session']
            },
            'break_reminder': {
                title: 'Take a Break',
                message: "You've been working hard. Take a 5-minute break!",
                actions: ['Start Break', 'Continue Working']
            },
            'end_day_review': {
                title: 'Daily Review',
                message: 'Review your accomplishments and plan for tomorrow',
                actions: ['View Analytics', 'Plan Tomorrow']
            },
            'inactivity': {
                title: 'Still There?',
                message: "Haven't seen you today. Check your tasks!",
                actions: ['Open App', 'View Tasks']
            }
        };

        const nudge = nudges[nudgeType] || nudges['start_day'];

        return {
            type: 'productivity_nudge',
            title: nudge.title,
            message: nudge.message,
            priority: 'low',
            scheduledTime: new Date().toISOString(),
            actions: nudge.actions,
            metadata: {
                nudgeType: nudgeType
            }
        };
    }

    /**
     * Calculate weighted priority score
     * @param {Object} notification - Notification object
     * @param {Object} context - Additional context (user behavior, etc.)
     * @returns {number} Priority score (0-100)
     */
    calculateWeightedScore(notification, context = {}) {
        let score = 50; // Base score

        // Task priority weight (0-30 points)
        const taskPriorityWeight = {
            'high': 30,
            'medium': 15,
            'low': 5
        }[notification.priority] || 15;
        score += taskPriorityWeight;

        // Exam proximity weight (0-20 points)
        if (notification.metadata?.examDaysAway !== undefined) {
            const daysAway = notification.metadata.examDaysAway;
            if (daysAway <= 1) score += 20;
            else if (daysAway <= 2) score += 18;
            else if (daysAway <= 7) score += 12;
            else if (daysAway <= 14) score += 6;
        }

        // Habit miss penalty/bonus (0-15 points)
        if (notification.metadata?.habitStreak !== undefined) {
            const streak = notification.metadata.habitStreak;
            if (streak >= 21) score += 15; // 3 weeks
            else if (streak >= 7) score += 12; // 1 week
            else if (streak >= 3) score += 8;
            else score += 5;
        }

        // Inactivity penalty (0-10 points)
        if (context.hoursSinceLastActivity !== undefined) {
            const hours = context.hoursSinceLastActivity;
            if (hours >= 48) score += 10; // 2 days inactive
            else if (hours >= 24) score += 7;
            else if (hours >= 12) score += 4;
        }

        // Task overdue bonus (+15 points)
        if (notification.metadata?.taskOverdue) {
            score += 15;
        }

        // Type-specific adjustments
        const typeModifiers = {
            'exam_alert': 1.2,
            'task_reminder': 1.1,
            'habit_reminder': 1.0,
            'focus_session': 0.9,
            'study_suggestion': 0.8,
            'productivity_nudge': 0.7,
            'achievement': 0.6
        };
        score *= typeModifiers[notification.type] || 1.0;

        return Math.min(Math.round(score), 100);
    }

    /**
     * Get notification delivery rules
     * @returns {Object} Current rules configuration
     */
    getRules() {
        return {
            dailyLimit: this.dailyLimit,
            minimumGapMinutes: this.minimumGapMinutes,
            quietHours: this.quietHours,
            spamProtection: this.spamProtection
        };
    }

    /**
     * Update notification rules
     * @param {Object} rules - New rules
     * @returns {Promise<void>}
     */
    async updateRules(rules) {
        await this.saveUserPreferences(rules);
    }
}

// ===== EXPORT SINGLETON =====
const notificationRules = new NotificationRules();
window.notificationRules = notificationRules;

// ===== AUTO-INITIALIZE =====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        notificationRules.initialize().catch(console.error);
    });
} else {
    notificationRules.initialize().catch(console.error);
}

console.log('✅ NotificationRules module loaded');
