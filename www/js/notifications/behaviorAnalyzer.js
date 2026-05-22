// ===== BEHAVIOR ANALYZER =====
// Analyzes user behavior to optimize notification timing and delivery

/**
 * Behavior Analyzer
 * Tracks user patterns and optimizes notification delivery based on behavior
 */
class BehaviorAnalyzer {
    constructor() {
        this.initialized = false;
        this.behaviorData = {
            notificationInteractions: [],
            studySessions: [],
            activeHours: {},
            responseRates: {},
            bestTimes: []
        };
    }

    /**
     * Initialize behavior analyzer
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.initialized) return;

        try {
            console.log('🧠 Initializing BehaviorAnalyzer...');

            // Load behavior data from IndexedDB
            await this.loadBehaviorData();

            // Analyze patterns
            await this.analyzePatterns();

            this.initialized = true;
            console.log('✅ BehaviorAnalyzer initialized');

        } catch (error) {
            console.error('❌ Failed to initialize BehaviorAnalyzer:', error);
        }
    }

    /**
     * Load behavior data from storage
     * @returns {Promise<void>}
     */
    async loadBehaviorData() {
        try {
            // Load from localStorage (could be IndexedDB)
            const stored = localStorage.getItem('behaviorAnalyzerData');
            
            if (stored) {
                this.behaviorData = JSON.parse(stored);
                console.log('✅ Behavior data loaded');
            }

        } catch (error) {
            console.error('❌ Error loading behavior data:', error);
        }
    }

    /**
     * Save behavior data to storage
     * @returns {Promise<void>}
     */
    async saveBehaviorData() {
        try {
            localStorage.setItem('behaviorAnalyzerData', JSON.stringify(this.behaviorData));
            console.log('✅ Behavior data saved');
        } catch (error) {
            console.error('❌ Error saving behavior data:', error);
        }
    }

    /**
     * Track notification interaction
     * @param {Object} interaction - Interaction data
     * @returns {Promise<void>}
     */
    async trackInteraction(interaction) {
        try {
            const interactionRecord = {
                notificationId: interaction.notificationId,
                type: interaction.type,
                action: interaction.action, // opened, dismissed, actioned
                timestamp: new Date().toISOString(),
                timeOfDay: new Date().getHours(),
                dayOfWeek: new Date().getDay()
            };

            this.behaviorData.notificationInteractions.push(interactionRecord);

            // Keep only last 1000 interactions
            if (this.behaviorData.notificationInteractions.length > 1000) {
                this.behaviorData.notificationInteractions = 
                    this.behaviorData.notificationInteractions.slice(-1000);
            }

            await this.saveBehaviorData();
            
            // Reanalyze patterns
            await this.analyzePatterns();

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
            const sessionRecord = {
                startTime: session.startTime,
                endTime: session.endTime,
                duration: session.duration,
                timeOfDay: new Date(session.startTime).getHours(),
                dayOfWeek: new Date(session.startTime).getDay(),
                subject: session.subject
            };

            this.behaviorData.studySessions.push(sessionRecord);

            // Keep only last 500 sessions
            if (this.behaviorData.studySessions.length > 500) {
                this.behaviorData.studySessions = 
                    this.behaviorData.studySessions.slice(-500);
            }

            await this.saveBehaviorData();
            
            // Reanalyze patterns
            await this.analyzePatterns();

        } catch (error) {
            console.error('❌ Error tracking study session:', error);
        }
    }

    /**
     * Analyze behavior patterns
     * @returns {Promise<void>}
     */
    async analyzePatterns() {
        try {
            console.log('🔍 Analyzing behavior patterns...');

            // Analyze active hours
            this.analyzeActiveHours();

            // Analyze response rates by type
            this.analyzeResponseRates();

            // Find best times to send notifications
            this.findBestTimes();

            console.log('✅ Behavior patterns analyzed');

        } catch (error) {
            console.error('❌ Error analyzing patterns:', error);
        }
    }

    /**
     * Analyze active hours (when user is most active)
     */
    analyzeActiveHours() {
        const hourCounts = {};

        // Count interactions by hour
        this.behaviorData.notificationInteractions.forEach(interaction => {
            const hour = new Date(interaction.timestamp).getHours();
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });

        // Count study sessions by hour
        this.behaviorData.studySessions.forEach(session => {
            const hour = new Date(session.startTime).getHours();
            hourCounts[hour] = (hourCounts[hour] || 0) + 2; // Weight sessions more
        });

        this.behaviorData.activeHours = hourCounts;
    }

    /**
     * Analyze response rates by notification type
     */
    analyzeResponseRates() {
        const typeStats = {};

        this.behaviorData.notificationInteractions.forEach(interaction => {
            if (!typeStats[interaction.type]) {
                typeStats[interaction.type] = {
                    total: 0,
                    opened: 0,
                    actioned: 0,
                    dismissed: 0
                };
            }

            typeStats[interaction.type].total++;
            
            if (interaction.action === 'opened') {
                typeStats[interaction.type].opened++;
            } else if (interaction.action === 'actioned') {
                typeStats[interaction.type].actioned++;
            } else if (interaction.action === 'dismissed') {
                typeStats[interaction.type].dismissed++;
            }
        });

        // Calculate rates
        Object.keys(typeStats).forEach(type => {
            const stats = typeStats[type];
            stats.openRate = stats.total > 0 ? (stats.opened / stats.total) : 0;
            stats.actionRate = stats.total > 0 ? (stats.actioned / stats.total) : 0;
            stats.dismissRate = stats.total > 0 ? (stats.dismissed / stats.total) : 0;
        });

        this.behaviorData.responseRates = typeStats;
    }

    /**
     * Find best times to send notifications
     */
    findBestTimes() {
        const hourScores = {};

        // Score each hour based on activity and positive interactions
        for (let hour = 0; hour < 24; hour++) {
            let score = 0;

            // Activity score (from active hours)
            const activityCount = this.behaviorData.activeHours[hour] || 0;
            score += activityCount * 10;

            // Positive interaction score
            const hourInteractions = this.behaviorData.notificationInteractions.filter(
                i => new Date(i.timestamp).getHours() === hour
            );

            const positiveCount = hourInteractions.filter(
                i => i.action === 'opened' || i.action === 'actioned'
            ).length;

            score += positiveCount * 20;

            // Penalize dismissed notifications
            const dismissedCount = hourInteractions.filter(
                i => i.action === 'dismissed'
            ).length;

            score -= dismissedCount * 10;

            hourScores[hour] = Math.max(0, score);
        }

        // Sort hours by score
        const sortedHours = Object.entries(hourScores)
            .sort((a, b) => b[1] - a[1])
            .map(([hour, score]) => ({
                hour: parseInt(hour),
                score: score
            }));

        // Take top 5 hours
        this.behaviorData.bestTimes = sortedHours.slice(0, 5);
    }

    /**
     * Get optimal notification time
     * @param {string} type - Notification type
     * @returns {Object} Recommended time
     */
    getOptimalTime(type = null) {
        try {
            // If we have best times, use them
            if (this.behaviorData.bestTimes.length > 0) {
                const now = new Date();
                const currentHour = now.getHours();

                // Find next best time after current hour
                const nextBest = this.behaviorData.bestTimes.find(
                    time => time.hour > currentHour
                );

                if (nextBest) {
                    const recommendedTime = new Date();
                    recommendedTime.setHours(nextBest.hour, 0, 0, 0);
                    
                    return {
                        time: recommendedTime,
                        hour: nextBest.hour,
                        score: nextBest.score,
                        confidence: this.getConfidenceLevel()
                    };
                } else {
                    // Use first best time (tomorrow)
                    const recommendedTime = new Date();
                    recommendedTime.setDate(recommendedTime.getDate() + 1);
                    recommendedTime.setHours(this.behaviorData.bestTimes[0].hour, 0, 0, 0);
                    
                    return {
                        time: recommendedTime,
                        hour: this.behaviorData.bestTimes[0].hour,
                        score: this.behaviorData.bestTimes[0].score,
                        confidence: this.getConfidenceLevel()
                    };
                }
            }

            // Default: recommend based on time of day
            const hour = new Date().getHours();
            let recommendedHour = 9; // Default to 9 AM

            if (hour < 9) {
                recommendedHour = 9;
            } else if (hour < 14) {
                recommendedHour = 14; // 2 PM
            } else if (hour < 18) {
                recommendedHour = 18; // 6 PM
            } else {
                // Next morning
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(9, 0, 0, 0);
                return {
                    time: tomorrow,
                    hour: 9,
                    score: 0,
                    confidence: 'low'
                };
            }

            const recommendedTime = new Date();
            recommendedTime.setHours(recommendedHour, 0, 0, 0);

            return {
                time: recommendedTime,
                hour: recommendedHour,
                score: 0,
                confidence: 'low'
            };

        } catch (error) {
            console.error('❌ Error getting optimal time:', error);
            
            // Fallback to 1 hour from now
            const fallbackTime = new Date();
            fallbackTime.setHours(fallbackTime.getHours() + 1);
            
            return {
                time: fallbackTime,
                hour: fallbackTime.getHours(),
                score: 0,
                confidence: 'low'
            };
        }
    }

    /**
     * Get confidence level in recommendations
     * @returns {string} Confidence level (low/medium/high)
     */
    getConfidenceLevel() {
        const interactionCount = this.behaviorData.notificationInteractions.length;
        
        if (interactionCount >= 100) {
            return 'high';
        } else if (interactionCount >= 30) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    /**
     * Get response rate for notification type
     * @param {string} type - Notification type
     * @returns {number} Response rate (0-1)
     */
    getResponseRate(type) {
        const stats = this.behaviorData.responseRates[type];
        
        if (stats) {
            return stats.actionRate || 0;
        }
        
        return 0;
    }

    /**
     * Should send notification type? (based on historical performance)
     * @param {string} type - Notification type
     * @returns {boolean} True if type performs well
     */
    shouldSendType(type) {
        const stats = this.behaviorData.responseRates[type];
        
        if (!stats || stats.total < 5) {
            // Not enough data, allow
            return true;
        }

        // Allow if action rate > 20% OR dismiss rate < 50%
        return stats.actionRate > 0.2 || stats.dismissRate < 0.5;
    }

    /**
     * Get active hours
     * @returns {Array} Hours sorted by activity
     */
    getActiveHours() {
        return Object.entries(this.behaviorData.activeHours)
            .sort((a, b) => b[1] - a[1])
            .map(([hour, count]) => ({
                hour: parseInt(hour),
                activityCount: count
            }));
    }

    /**
     * Get notification type performance
     * @returns {Array} Types sorted by performance
     */
    getTypePerformance() {
        return Object.entries(this.behaviorData.responseRates)
            .map(([type, stats]) => ({
                type,
                ...stats
            }))
            .sort((a, b) => b.actionRate - a.actionRate);
    }

    /**
     * Get behavior insights
     * @returns {Object} Insights
     */
    getInsights() {
        const insights = {
            totalInteractions: this.behaviorData.notificationInteractions.length,
            totalSessions: this.behaviorData.studySessions.length,
            confidenceLevel: this.getConfidenceLevel(),
            bestTimes: this.behaviorData.bestTimes,
            topTypes: this.getTypePerformance().slice(0, 3),
            mostActiveHours: this.getActiveHours().slice(0, 3),
            recommendations: []
        };

        // Generate recommendations
        if (insights.confidenceLevel === 'high') {
            insights.recommendations.push({
                type: 'timing',
                message: 'Best notification times identified based on your activity'
            });
        }

        const poorPerformers = this.getTypePerformance().filter(
            t => t.total >= 10 && t.actionRate < 0.1
        );

        if (poorPerformers.length > 0) {
            insights.recommendations.push({
                type: 'frequency',
                message: `Consider reducing ${poorPerformers[0].type} notifications`
            });
        }

        return insights;
    }

    /**
     * Reset behavior data
     * @returns {Promise<void>}
     */
    async reset() {
        this.behaviorData = {
            notificationInteractions: [],
            studySessions: [],
            activeHours: {},
            responseRates: {},
            bestTimes: []
        };

        await this.saveBehaviorData();
        console.log('✅ Behavior data reset');
    }

    /**
     * Get behavior analytics data
     * @returns {Object} Analytics data
     */
    getAnalytics() {
        return {
            interactions: this.behaviorData.notificationInteractions.length,
            sessions: this.behaviorData.studySessions.length,
            activeHours: this.behaviorData.activeHours,
            responseRates: this.behaviorData.responseRates,
            bestTimes: this.behaviorData.bestTimes,
            insights: this.getInsights()
        };
    }
}

// ===== EXPORT SINGLETON =====
const behaviorAnalyzer = new BehaviorAnalyzer();
window.behaviorAnalyzer = behaviorAnalyzer;

// ===== AUTO-INITIALIZE =====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        behaviorAnalyzer.initialize().catch(console.error);
    });
} else {
    behaviorAnalyzer.initialize().catch(console.error);
}

console.log('✅ BehaviorAnalyzer module loaded');
