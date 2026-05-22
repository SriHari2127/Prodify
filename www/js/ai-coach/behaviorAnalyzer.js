// ===== BEHAVIOR ANALYZER MODULE =====
// Analyzes historical user productivity data and calculates key metrics
// Works offline-first using IndexedDB with Firestore sync

const BehaviorAnalyzer = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    const CONFIG = {
        ANALYSIS_WINDOW_DAYS: 30, // Analyze last 30 days
        CURRENT_WEEK_DAYS: 7,
        MIN_DATA_POINTS: 3 // Minimum data points for reliable analysis
    };

    let isInitialized = false;

    // ===== INITIALIZATION =====
    function init() {
        if (isInitialized) return;
        console.log('📊 Behavior Analyzer initialized');
        isInitialized = true;
    }

    // ===== HELPER FUNCTIONS =====
    
    /**
     * Get date range for analysis
     * @param {number} days - Number of days to look back
     * @returns {Object} Start and end dates
     */
    function getDateRange(days = CONFIG.ANALYSIS_WINDOW_DAYS) {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        
        return { start, end };
    }

    /**
     * Get current week date range (Sunday to Saturday)
     * @returns {Object} Start and end dates of current week
     */
    function getCurrentWeekRange() {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const start = new Date(now);
        start.setDate(now.getDate() - dayOfWeek);
        start.setHours(0, 0, 0, 0);

        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);

        return { start, end };
    }

    /**
     * Filter items by date range
     * @param {Array} items - Items with date/timestamp fields
     * @param {Date} start - Start date
     * @param {Date} end - End date
     * @param {string} dateField - Field name containing date
     * @returns {Array} Filtered items
     */
    function filterByDateRange(items, start, end, dateField = 'createdAt') {
        return items.filter(item => {
            const itemDate = new Date(item[dateField]);
            return itemDate >= start && itemDate <= end;
        });
    }

    // ===== DATA RETRIEVAL =====
    
    /**
     * Get all focus sessions from storage
     * @returns {Array} Focus sessions
     */
    function getFocusSessions() {
        try {
            return JSON.parse(localStorage.getItem('focusSessions')) || [];
        } catch (error) {
            console.error('Error parsing focusSessions:', error);
            return [];
        }
    }

    /**
     * Get all tasks from storage
     * @returns {Array} Tasks
     */
    function getTasks() {
        try {
            return JSON.parse(localStorage.getItem('tasks')) || [];
        } catch (error) {
            console.error('Error parsing tasks:', error);
            return [];
        }
    }

    /**
     * Get all habits from storage
     * @returns {Array} Habits
     */
    function getHabits() {
        try {
            return JSON.parse(localStorage.getItem('habits')) || [];
        } catch (error) {
            console.error('Error parsing habits:', error);
            return [];
        }
    }

    /**
     * Get all subjects from storage
     * @returns {Array} Subjects
     */
    function getSubjects() {
        try {
            return JSON.parse(localStorage.getItem('subjects')) || [];
        } catch (error) {
            console.error('Error parsing subjects:', error);
            return [];
        }
    }

    /**
     * Get study blocks (planned schedule)
     * @returns {Array} Study blocks
     */
    function getStudyBlocks() {
        try {
            return JSON.parse(localStorage.getItem('studyBlocks')) || [];
        } catch (error) {
            console.error('Error parsing studyBlocks:', error);
            return [];
        }
    }

    // ===== METRIC CALCULATIONS =====

    /**
     * Calculate weekly study hours from focus sessions
     * @returns {number} Total study hours this week
     */
    function calculateWeeklyStudyHours() {
        const sessions = getFocusSessions();
        const { start, end } = getCurrentWeekRange();
        
        const weekSessions = sessions.filter(s => {
            if (!s.completedAt) return false;
            const completedDate = new Date(s.completedAt);
            return completedDate >= start && completedDate <= end && s.completed;
        });

        const totalMinutes = weekSessions.reduce((sum, s) => {
            return sum + ((s.duration || 0) / 60); // duration is in seconds
        }, 0);

        return Math.round((totalMinutes / 60) * 10) / 10; // Round to 1 decimal
    }

    /**
     * Calculate task completion rate
     * @returns {Object} Completion rate and counts
     */
    function calculateTaskCompletionRate() {
        const tasks = getTasks();
        const { start, end } = getCurrentWeekRange();
        
        // Tasks created this week
        const weekTasks = filterByDateRange(tasks, start, end, 'createdAt');
        
        // Completed tasks this week
        const completedTasks = weekTasks.filter(t => {
            if (!t.completed || !t.completedDate) return false;
            const completedDate = new Date(t.completedDate);
            return completedDate >= start && completedDate <= end;
        });

        const total = weekTasks.length;
        const completed = completedTasks.length;
        const rate = total > 0 ? completed / total : 0;

        return {
            rate: Math.round(rate * 100) / 100,
            completed,
            total,
            percentage: Math.round(rate * 100)
        };
    }

    /**
     * Calculate habit consistency score
     * @returns {Object} Consistency metrics
     */
    function calculateHabitConsistency() {
        const habits = getHabits();
        
        if (habits.length === 0) {
            return {
                score: 0,
                avgStreak: 0,
                maxStreak: 0,
                totalHabits: 0,
                activeHabits: 0
            };
        }

        const streaks = habits.map(h => h.streak || 0);
        const avgStreak = streaks.reduce((a, b) => a + b, 0) / habits.length;
        const maxStreak = Math.max(...streaks, 0);
        
        // Count active habits (streak > 0)
        const activeHabits = habits.filter(h => (h.streak || 0) > 0).length;
        
        // Consistency score: weighted by streak length
        // Perfect score (1.0) if average streak is 7+ days
        const TARGET_STREAK = 7;
        const score = Math.min(avgStreak / TARGET_STREAK, 1);

        return {
            score: Math.round(score * 100) / 100,
            avgStreak: Math.round(avgStreak * 10) / 10,
            maxStreak,
            totalHabits: habits.length,
            activeHabits
        };
    }

    /**
     * Calculate focus success rate
     * @returns {Object} Focus session success metrics
     */
    function calculateFocusSuccessRate() {
        const sessions = getFocusSessions();
        const { start, end } = getCurrentWeekRange();
        
        const weekSessions = filterByDateRange(sessions, start, end, 'completedAt');
        
        const total = weekSessions.length;
        const completed = weekSessions.filter(s => s.completed === true).length;
        const rate = total > 0 ? completed / total : 0;

        // Calculate average focus duration
        const avgDuration = total > 0
            ? weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / total / 60
            : 0;

        return {
            rate: Math.round(rate * 100) / 100,
            completed,
            total,
            percentage: Math.round(rate * 100),
            avgDurationMinutes: Math.round(avgDuration)
        };
    }

    /**
     * Calculate study time distribution by subject
     * @returns {Array} Subject study distribution
     */
    function calculateSubjectDistribution() {
        const sessions = getFocusSessions();
        const subjects = getSubjects();
        const { start, end } = getCurrentWeekRange();
        
        const weekSessions = filterByDateRange(sessions, start, end, 'completedAt')
            .filter(s => s.completed);

        // Group by subject
        const distribution = {};
        let totalMinutes = 0;

        weekSessions.forEach(session => {
            const subjectId = session.subject || 'unassigned';
            const minutes = (session.duration || 0) / 60;
            
            if (!distribution[subjectId]) {
                distribution[subjectId] = {
                    subjectId,
                    minutes: 0,
                    sessions: 0
                };
            }
            
            distribution[subjectId].minutes += minutes;
            distribution[subjectId].sessions += 1;
            totalMinutes += minutes;
        });

        // Convert to array and add subject names and percentages
        const result = Object.values(distribution).map(item => {
            const subject = subjects.find(s => s.id === item.subjectId);
            return {
                subjectId: item.subjectId,
                subjectName: subject ? subject.name : 'Unassigned',
                subjectColor: subject ? subject.color : '#888888',
                minutes: Math.round(item.minutes),
                hours: Math.round(item.minutes / 60 * 10) / 10,
                sessions: item.sessions,
                percentage: totalMinutes > 0 
                    ? Math.round((item.minutes / totalMinutes) * 100) 
                    : 0
            };
        });

        // Sort by time spent (descending)
        result.sort((a, b) => b.minutes - a.minutes);

        return result;
    }

    /**
     * Calculate daily productivity trend
     * @returns {Array} Daily metrics for the past week
     */
    function calculateDailyTrend() {
        const sessions = getFocusSessions();
        const tasks = getTasks();
        const { start, end } = getCurrentWeekRange();
        
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const trend = [];

        for (let i = 0; i < 7; i++) {
            const dayStart = new Date(start);
            dayStart.setDate(start.getDate() + i);
            dayStart.setHours(0, 0, 0, 0);
            
            const dayEnd = new Date(dayStart);
            dayEnd.setHours(23, 59, 59, 999);

            // Focus sessions for this day
            const daySessions = sessions.filter(s => {
                if (!s.completedAt) return false;
                const date = new Date(s.completedAt);
                return date >= dayStart && date <= dayEnd && s.completed;
            });

            // Tasks completed on this day
            const dayTasks = tasks.filter(t => {
                if (!t.completed || !t.completedDate) return false;
                const date = new Date(t.completedDate);
                return date >= dayStart && date <= dayEnd;
            });

            const studyMinutes = daySessions.reduce((sum, s) => sum + (s.duration || 0) / 60, 0);

            trend.push({
                day: days[i],
                date: dayStart.toISOString().split('T')[0],
                studyHours: Math.round(studyMinutes / 60 * 10) / 10,
                studyMinutes: Math.round(studyMinutes),
                focusSessions: daySessions.length,
                tasksCompleted: dayTasks.length
            });
        }

        return trend;
    }

    /**
     * Get historical comparison (this week vs last week)
     * @returns {Object} Week-over-week comparison
     */
    function getWeeklyComparison() {
        const sessions = getFocusSessions();
        const tasks = getTasks();
        
        // Current week
        const currentWeek = getCurrentWeekRange();
        
        // Last week
        const lastWeekStart = new Date(currentWeek.start);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);
        const lastWeekEnd = new Date(currentWeek.end);
        lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);

        // Current week metrics
        const currentSessions = filterByDateRange(sessions, currentWeek.start, currentWeek.end, 'completedAt')
            .filter(s => s.completed);
        const currentMinutes = currentSessions.reduce((sum, s) => sum + (s.duration || 0) / 60, 0);
        const currentTasks = tasks.filter(t => {
            if (!t.completed || !t.completedDate) return false;
            const date = new Date(t.completedDate);
            return date >= currentWeek.start && date <= currentWeek.end;
        });

        // Last week metrics
        const lastSessions = filterByDateRange(sessions, lastWeekStart, lastWeekEnd, 'completedAt')
            .filter(s => s.completed);
        const lastMinutes = lastSessions.reduce((sum, s) => sum + (s.duration || 0) / 60, 0);
        const lastTasks = tasks.filter(t => {
            if (!t.completed || !t.completedDate) return false;
            const date = new Date(t.completedDate);
            return date >= lastWeekStart && date <= lastWeekEnd;
        });

        // Calculate changes
        const studyChange = lastMinutes > 0 
            ? Math.round(((currentMinutes - lastMinutes) / lastMinutes) * 100) 
            : 0;
        const taskChange = lastTasks.length > 0 
            ? Math.round(((currentTasks.length - lastTasks.length) / lastTasks.length) * 100) 
            : 0;

        return {
            currentWeek: {
                studyHours: Math.round(currentMinutes / 60 * 10) / 10,
                focusSessions: currentSessions.length,
                tasksCompleted: currentTasks.length
            },
            lastWeek: {
                studyHours: Math.round(lastMinutes / 60 * 10) / 10,
                focusSessions: lastSessions.length,
                tasksCompleted: lastTasks.length
            },
            changes: {
                studyHours: studyChange,
                focusSessions: currentSessions.length - lastSessions.length,
                tasksCompleted: taskChange
            }
        };
    }

    // ===== MAIN ANALYSIS FUNCTION =====
    
    /**
     * Perform complete behavior analysis
     * @returns {Object} Comprehensive behavior metrics
     */
    function analyze() {
        console.log('📊 Analyzing user behavior...');
        
        const startTime = performance.now();

        try {
            const metrics = {
                timestamp: new Date().toISOString(),
                weeklyStudyHours: calculateWeeklyStudyHours(),
                taskCompletion: calculateTaskCompletionRate(),
                habitConsistency: calculateHabitConsistency(),
                focusSuccess: calculateFocusSuccessRate(),
                subjectDistribution: calculateSubjectDistribution(),
                dailyTrend: calculateDailyTrend(),
                weeklyComparison: getWeeklyComparison(),
                
                // Simplified metrics for quick access
                taskCompletionRate: calculateTaskCompletionRate().rate,
                habitConsistencyScore: calculateHabitConsistency().score,
                focusSuccessRate: calculateFocusSuccessRate().rate
            };

            const duration = (performance.now() - startTime).toFixed(2);
            console.log(`✅ Behavior analysis complete in ${duration}ms`);

            return metrics;

        } catch (error) {
            console.error('❌ Error analyzing behavior:', error);
            return null;
        }
    }

    // ===== PUBLIC API =====
    return {
        init,
        analyze,
        
        // Expose individual calculators for testing
        calculateWeeklyStudyHours,
        calculateTaskCompletionRate,
        calculateHabitConsistency,
        calculateFocusSuccessRate,
        calculateSubjectDistribution,
        calculateDailyTrend,
        getWeeklyComparison
    };
})();
