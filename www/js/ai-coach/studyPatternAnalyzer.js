// ===== STUDY PATTERN ANALYZER MODULE =====
// Detects patterns in study behavior and provides insights
// Analyzes timing, duration, consistency, and performance patterns

const StudyPatternAnalyzer = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    const CONFIG = {
        ANALYSIS_WINDOW: 30, // Days to analyze
        MIN_SESSIONS_FOR_PATTERN: 5, // Minimum sessions to detect patterns
        
        // Time of day categories (24-hour format)
        TIME_SLOTS: {
            'Early Morning (5-8 AM)': { start: 5, end: 8 },
            'Morning (8-12 PM)': { start: 8, end: 12 },
            'Afternoon (12-5 PM)': { start: 12, end: 17 },
            'Evening (5-9 PM)': { start: 17, end: 21 },
            'Night (9 PM-1 AM)': { start: 21, end: 24 },
            'Late Night (1-5 AM)': { start: 1, end: 5 }
        }
    };

    let isInitialized = false;

    // ===== INITIALIZATION =====
    function init() {
        if (isInitialized) return;
        console.log('🔍 Study Pattern Analyzer initialized');
        isInitialized = true;
    }

    // ===== DATA RETRIEVAL =====
    
    function getFocusSessions() {
        return JSON.parse(localStorage.getItem('focusSessions')) || [];
    }

    function getSubjects() {
        return JSON.parse(localStorage.getItem('subjects')) || [];
    }

    // ===== HELPER FUNCTIONS =====
    
    function getDateRange(days) {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }

    function getTimeSlot(date) {
        const hour = date.getHours();
        
        for (const [slotName, range] of Object.entries(CONFIG.TIME_SLOTS)) {
            if (range.start < range.end) {
                // Normal range (e.g., 8-12)
                if (hour >= range.start && hour < range.end) {
                    return slotName;
                }
            } else {
                // Wrapped range (e.g., 21-24 or 0-5)
                if (hour >= range.start || hour < range.end) {
                    return slotName;
                }
            }
        }
        
        return 'Unknown';
    }

    // ===== PATTERN DETECTION =====
    
    /**
     * Detect most productive time of day
     * @returns {Object} Time pattern analysis
     */
    function detectTimePatterns() {
        const sessions = getFocusSessions();
        const { start, end } = getDateRange(CONFIG.ANALYSIS_WINDOW);
        
        const recentSessions = sessions.filter(s => {
            if (!s.completedAt || !s.completed) return false;
            const date = new Date(s.completedAt);
            return date >= start && date <= end;
        });

        if (recentSessions.length < CONFIG.MIN_SESSIONS_FOR_PATTERN) {
            return {
                hasPattern: false,
                message: 'Not enough data to detect time patterns.'
            };
        }

        // Group by time slot
        const timeSlotStats = {};
        Object.keys(CONFIG.TIME_SLOTS).forEach(slot => {
            timeSlotStats[slot] = {
                sessions: 0,
                totalMinutes: 0,
                completedSessions: 0
            };
        });

        recentSessions.forEach(session => {
            const date = new Date(session.completedAt);
            const slot = getTimeSlot(date);
            
            if (timeSlotStats[slot]) {
                timeSlotStats[slot].sessions++;
                timeSlotStats[slot].totalMinutes += (session.duration || 0) / 60;
                if (session.completed) {
                    timeSlotStats[slot].completedSessions++;
                }
            }
        });

        // Calculate productivity score for each slot
        const slotAnalysis = Object.entries(timeSlotStats).map(([slot, stats]) => {
            const successRate = stats.sessions > 0 
                ? stats.completedSessions / stats.sessions 
                : 0;
            const avgDuration = stats.sessions > 0 
                ? stats.totalMinutes / stats.sessions 
                : 0;
            
            // Productivity score: weighted by success rate and duration
            const productivityScore = (successRate * 0.6) + ((avgDuration / 60) * 0.4);
            
            return {
                timeSlot: slot,
                sessions: stats.sessions,
                hours: Math.round(stats.totalMinutes / 60 * 10) / 10,
                successRate: Math.round(successRate * 100),
                avgDurationMinutes: Math.round(avgDuration),
                productivityScore: Math.round(productivityScore * 100)
            };
        }).filter(item => item.sessions > 0)
          .sort((a, b) => b.productivityScore - a.productivityScore);

        const mostProductive = slotAnalysis[0];
        const leastProductive = slotAnalysis[slotAnalysis.length - 1];

        return {
            hasPattern: true,
            mostProductiveTime: mostProductive.timeSlot,
            mostProductiveStats: mostProductive,
            leastProductiveTime: leastProductive?.timeSlot,
            allTimeSlots: slotAnalysis,
            message: `You are most productive during ${mostProductive.timeSlot} with ${mostProductive.successRate}% success rate.`,
            recommendation: `Schedule your most important study sessions during ${mostProductive.timeSlot}.`
        };
    }

    /**
     * Detect optimal session duration pattern
     * @returns {Object} Duration pattern analysis
     */
    function detectDurationPatterns() {
        const sessions = getFocusSessions();
        const { start, end } = getDateRange(CONFIG.ANALYSIS_WINDOW);
        
        const recentSessions = sessions.filter(s => {
            if (!s.completedAt || !s.completed) return false;
            const date = new Date(s.completedAt);
            return date >= start && date <= end;
        });

        if (recentSessions.length < CONFIG.MIN_SESSIONS_FOR_PATTERN) {
            return {
                hasPattern: false,
                message: 'Not enough data to analyze session durations.'
            };
        }

        // Group by duration ranges
        const ranges = {
            'Short (< 20 min)': { min: 0, max: 20, sessions: [], successes: 0 },
            'Medium (20-40 min)': { min: 20, max: 40, sessions: [], successes: 0 },
            'Standard (40-60 min)': { min: 40, max: 60, sessions: [], successes: 0 },
            'Long (> 60 min)': { min: 60, max: 999, sessions: [], successes: 0 }
        };

        recentSessions.forEach(session => {
            const minutes = (session.duration || 0) / 60;
            
            for (const [rangeName, range] of Object.entries(ranges)) {
                if (minutes >= range.min && minutes < range.max) {
                    range.sessions.push(session);
                    if (session.completed) range.successes++;
                    break;
                }
            }
        });

        // Analyze each range
        const analysis = Object.entries(ranges).map(([name, data]) => {
            const count = data.sessions.length;
            const successRate = count > 0 ? data.successes / count : 0;
            const avgDuration = count > 0
                ? data.sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / count / 60
                : 0;

            return {
                range: name,
                sessionsCount: count,
                successRate: Math.round(successRate * 100),
                avgDurationMinutes: Math.round(avgDuration)
            };
        }).filter(item => item.sessionsCount > 0)
          .sort((a, b) => b.successRate - a.successRate);

        const optimal = analysis[0];
        
        // Calculate overall average
        const allDurations = recentSessions.map(s => (s.duration || 0) / 60);
        const avgDuration = allDurations.reduce((a, b) => a + b, 0) / allDurations.length;
        const longestSession = Math.max(...allDurations);

        return {
            hasPattern: true,
            optimalRange: optimal.range,
            optimalSuccessRate: optimal.successRate,
            avgSessionMinutes: Math.round(avgDuration),
            longestSessionMinutes: Math.round(longestSession),
            rangeAnalysis: analysis,
            message: `Your optimal session length is ${optimal.range} with ${optimal.successRate}% success rate.`,
            recommendation: optimal.range === 'Short (< 20 min)' 
                ? 'Try extending sessions to 25-30 minutes for deeper focus.'
                : `Continue with ${optimal.range} sessions - they work well for you!`
        };
    }

    /**
     * Detect weekly consistency patterns
     * @returns {Object} Consistency pattern analysis
     */
    function detectConsistencyPatterns() {
        const sessions = getFocusSessions();
        const { start, end } = getDateRange(CONFIG.ANALYSIS_WINDOW);
        
        const recentSessions = sessions.filter(s => {
            if (!s.completedAt || !s.completed) return false;
            const date = new Date(s.completedAt);
            return date >= start && date <= end;
        });

        if (recentSessions.length < CONFIG.MIN_SESSIONS_FOR_PATTERN) {
            return {
                hasPattern: false,
                message: 'Not enough data to analyze consistency.'
            };
        }

        // Group by day of week
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayStats = {};
        
        dayNames.forEach(day => {
            dayStats[day] = { sessions: 0, minutes: 0 };
        });

        recentSessions.forEach(session => {
            const date = new Date(session.completedAt);
            const dayName = dayNames[date.getDay()];
            dayStats[dayName].sessions++;
            dayStats[dayName].minutes += (session.duration || 0) / 60;
        });

        // Analyze each day
        const dayAnalysis = Object.entries(dayStats).map(([day, stats]) => ({
            day,
            sessions: stats.sessions,
            hours: Math.round(stats.minutes / 60 * 10) / 10,
            avgSessionMinutes: stats.sessions > 0 
                ? Math.round(stats.minutes / stats.sessions) 
                : 0
        })).sort((a, b) => b.hours - a.hours);

        const mostProductiveDay = dayAnalysis[0];
        const leastProductiveDay = dayAnalysis[dayAnalysis.length - 1];
        
        // Calculate consistency score (coefficient of variation)
        const hours = dayAnalysis.map(d => d.hours);
        const avgHours = hours.reduce((a, b) => a + b, 0) / hours.length;
        const variance = hours.reduce((sum, h) => sum + Math.pow(h - avgHours, 2), 0) / hours.length;
        const stdDev = Math.sqrt(variance);
        const consistencyScore = avgHours > 0 ? 1 - (stdDev / avgHours) : 0;

        let consistencyLevel = 'low';
        if (consistencyScore > 0.7) consistencyLevel = 'excellent';
        else if (consistencyScore > 0.5) consistencyLevel = 'good';
        else if (consistencyScore > 0.3) consistencyLevel = 'moderate';

        return {
            hasPattern: true,
            mostProductiveDay: mostProductiveDay.day,
            leastProductiveDay: leastProductiveDay.day,
            weeklyPattern: dayAnalysis,
            consistencyScore: Math.round(consistencyScore * 100),
            consistencyLevel,
            message: `You're most consistent on ${mostProductiveDay.day} and least on ${leastProductiveDay.day}.`,
            recommendation: consistencyLevel === 'low' || consistencyLevel === 'moderate'
                ? `Try to establish a more regular study routine. Add sessions on ${leastProductiveDay.day}.`
                : 'Great consistency! Keep maintaining your study routine.'
        };
    }

    /**
     * Detect best performing subjects
     * @returns {Object} Subject performance patterns
     */
    function detectSubjectPatterns() {
        const sessions = getFocusSessions();
        const subjects = getSubjects();
        const { start, end } = getDateRange(CONFIG.ANALYSIS_WINDOW);
        
        const recentSessions = sessions.filter(s => {
            if (!s.completedAt) return false;
            const date = new Date(s.completedAt);
            return date >= start && date <= end;
        });

        if (recentSessions.length < CONFIG.MIN_SESSIONS_FOR_PATTERN) {
            return {
                hasPattern: false,
                message: 'Not enough data to analyze subject patterns.'
            };
        }

        // Group by subject
        const subjectStats = {};
        
        recentSessions.forEach(session => {
            const subjectId = session.subject || 'unassigned';
            
            if (!subjectStats[subjectId]) {
                subjectStats[subjectId] = {
                    sessions: 0,
                    completed: 0,
                    minutes: 0
                };
            }
            
            subjectStats[subjectId].sessions++;
            if (session.completed) subjectStats[subjectId].completed++;
            subjectStats[subjectId].minutes += (session.duration || 0) / 60;
        });

        // Analyze each subject
        const analysis = Object.entries(subjectStats).map(([subjectId, stats]) => {
            const subject = subjects.find(s => s.id === subjectId);
            const successRate = stats.sessions > 0 ? stats.completed / stats.sessions : 0;
            
            return {
                subjectId,
                subjectName: subject ? subject.name : 'Unassigned',
                sessions: stats.sessions,
                hours: Math.round(stats.minutes / 60 * 10) / 10,
                successRate: Math.round(successRate * 100),
                avgSessionMinutes: stats.sessions > 0 
                    ? Math.round(stats.minutes / stats.sessions) 
                    : 0
            };
        }).filter(item => item.sessions >= 2) // At least 2 sessions
          .sort((a, b) => b.successRate - a.successRate);

        if (analysis.length === 0) {
            return {
                hasPattern: false,
                message: 'Not enough subject data to analyze.'
            };
        }

        const bestPerforming = analysis[0];
        const needsWork = analysis[analysis.length - 1];

        return {
            hasPattern: true,
            bestPerformingSubject: bestPerforming.subjectName,
            bestSuccessRate: bestPerforming.successRate,
            needsWorkSubject: needsWork.successRate < 70 ? needsWork.subjectName : null,
            subjectAnalysis: analysis,
            message: `You focus best on ${bestPerforming.subjectName} with ${bestPerforming.successRate}% success rate.`,
            recommendation: needsWork.successRate < 70
                ? `${needsWork.subjectName} has lower focus success (${needsWork.successRate}%). Try breaking it into smaller chunks.`
                : 'All subjects show good focus patterns!'
        };
    }

    /**
     * Detect study streaks
     * @returns {Object} Streak analysis
     */
    function detectStreakPatterns() {
        const sessions = getFocusSessions();
        const sortedSessions = sessions
            .filter(s => s.completed && s.completedAt)
            .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));

        if (sortedSessions.length === 0) {
            return {
                currentStreak: 0,
                longestStreak: 0,
                message: 'Start your study streak today!'
            };
        }

        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 1;
        let lastDate = null;

        sortedSessions.forEach((session, index) => {
            const sessionDate = new Date(session.completedAt);
            sessionDate.setHours(0, 0, 0, 0);

            if (lastDate) {
                const diffDays = Math.floor((sessionDate - lastDate) / (1000 * 60 * 60 * 24));
                
                if (diffDays === 0) {
                    // Same day, continue streak
                } else if (diffDays === 1) {
                    // Consecutive day
                    tempStreak++;
                } else {
                    // Streak broken
                    longestStreak = Math.max(longestStreak, tempStreak);
                    tempStreak = 1;
                }
            }

            lastDate = sessionDate;
        });

        longestStreak = Math.max(longestStreak, tempStreak);

        // Check if there's a session today or yesterday
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const lastSessionDate = new Date(sortedSessions[sortedSessions.length - 1].completedAt);
        lastSessionDate.setHours(0, 0, 0, 0);

        if (lastSessionDate.getTime() === today.getTime()) {
            currentStreak = tempStreak;
        } else if (lastSessionDate.getTime() === yesterday.getTime()) {
            currentStreak = tempStreak;
        } else {
            currentStreak = 0; // Streak broken
        }

        let message = '';
        if (currentStreak === 0) {
            message = 'Your streak is broken. Start fresh today!';
        } else if (currentStreak === 1) {
            message = 'Good start! Study tomorrow to build your streak.';
        } else {
            message = `${currentStreak} day streak! Keep going!`;
        }

        return {
            currentStreak,
            longestStreak,
            message,
            recommendation: currentStreak > 0 
                ? `Maintain your ${currentStreak}-day streak with at least one session today!`
                : 'Start a new streak by completing a focus session today.'
        };
    }

    // ===== MAIN ANALYSIS FUNCTION =====
    
    /**
     * Analyze all study patterns
     * @returns {Object} Comprehensive pattern analysis
     */
    function analyzePatterns() {
        console.log('🔍 Analyzing study patterns...');
        
        const startTime = performance.now();

        try {
            const patterns = {
                timestamp: new Date().toISOString(),
                timePatterns: detectTimePatterns(),
                durationPatterns: detectDurationPatterns(),
                consistencyPatterns: detectConsistencyPatterns(),
                subjectPatterns: detectSubjectPatterns(),
                streakPatterns: detectStreakPatterns()
            };

            const duration = (performance.now() - startTime).toFixed(2);
            console.log(`✅ Pattern analysis complete in ${duration}ms`);

            return patterns;

        } catch (error) {
            console.error('❌ Error analyzing patterns:', error);
            return null;
        }
    }

    // ===== PUBLIC API =====
    return {
        init,
        analyzePatterns,
        
        // Expose individual detectors for testing
        detectTimePatterns,
        detectDurationPatterns,
        detectConsistencyPatterns,
        detectSubjectPatterns,
        detectStreakPatterns
    };
})();
