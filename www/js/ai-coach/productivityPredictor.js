// ===== PRODUCTIVITY PREDICTOR MODULE =====
// Statistical forecasting for study behavior and productivity
// Uses moving averages and trend analysis for predictions

const ProductivityPredictor = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    const CONFIG = {
        // Historical data window for predictions (days)
        HISTORICAL_WINDOW: 21, // 3 weeks
        
        // Moving average window
        MA_WINDOW: 7, // 7-day moving average
        
        // Prediction confidence thresholds
        MIN_DATA_POINTS: 10, // Minimum data points for reliable prediction
        HIGH_CONFIDENCE_THRESHOLD: 20, // Data points for high confidence
        
        // Trend sensitivity
        TREND_THRESHOLD: 0.1 // 10% change to detect trend
    };

    let isInitialized = false;

    // ===== INITIALIZATION =====
    function init() {
        if (isInitialized) return;
        console.log('🔮 Productivity Predictor initialized');
        isInitialized = true;
    }

    // ===== DATA RETRIEVAL =====
    
    function getFocusSessions() {
        return JSON.parse(localStorage.getItem('focusSessions')) || [];
    }

    function getTasks() {
        return JSON.parse(localStorage.getItem('tasks')) || [];
    }

    function getHabits() {
        return JSON.parse(localStorage.getItem('habits')) || [];
    }

    // ===== HELPER FUNCTIONS =====
    
    /**
     * Get date range for historical analysis
     * @param {number} days - Number of days
     * @returns {Object} Start and end dates
     */
    function getDateRange(days) {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }

    /**
     * Calculate simple moving average
     * @param {Array} values - Array of numbers
     * @param {number} window - Window size
     * @returns {number} Moving average
     */
    function movingAverage(values, window = CONFIG.MA_WINDOW) {
        if (values.length === 0) return 0;
        const slice = values.slice(-window);
        const sum = slice.reduce((a, b) => a + b, 0);
        return sum / slice.length;
    }

    /**
     * Calculate trend (positive/negative/stable)
     * @param {Array} values - Array of numbers
     * @returns {Object} Trend analysis
     */
    function calculateTrend(values) {
        if (values.length < 2) {
            return { direction: 'stable', change: 0, changePercent: 0 };
        }

        const halfPoint = Math.floor(values.length / 2);
        const firstHalf = values.slice(0, halfPoint);
        const secondHalf = values.slice(halfPoint);

        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

        const change = secondAvg - firstAvg;
        const changePercent = firstAvg !== 0 ? (change / firstAvg) : 0;

        let direction = 'stable';
        if (Math.abs(changePercent) > CONFIG.TREND_THRESHOLD) {
            direction = changePercent > 0 ? 'increasing' : 'decreasing';
        }

        return {
            direction,
            change: Math.round(change * 10) / 10,
            changePercent: Math.round(changePercent * 100)
        };
    }

    /**
     * Calculate confidence level based on data points
     * @param {number} dataPoints - Number of historical data points
     * @returns {Object} Confidence assessment
     */
    function calculateConfidence(dataPoints) {
        let level = 'low';
        let score = 0;

        if (dataPoints >= CONFIG.HIGH_CONFIDENCE_THRESHOLD) {
            level = 'high';
            score = 0.9;
        } else if (dataPoints >= CONFIG.MIN_DATA_POINTS) {
            level = 'medium';
            score = 0.6;
        } else {
            level = 'low';
            score = 0.3;
        }

        return { level, score, dataPoints };
    }

    // ===== PREDICTION FUNCTIONS =====
    
    /**
     * Predict expected study hours for next week
     * @returns {Object} Study hour prediction
     */
    function predictStudyHours() {
        const sessions = getFocusSessions();
        const { start, end } = getDateRange(CONFIG.HISTORICAL_WINDOW);

        // Get completed sessions in historical window
        const historicalSessions = sessions.filter(s => {
            if (!s.completedAt || !s.completed) return false;
            const date = new Date(s.completedAt);
            return date >= start && date <= end;
        });

        if (historicalSessions.length < CONFIG.MIN_DATA_POINTS) {
            return {
                expectedHours: 0,
                confidence: calculateConfidence(historicalSessions.length),
                trend: { direction: 'stable', change: 0, changePercent: 0 },
                message: 'Not enough data for reliable prediction. Keep studying to build history!'
            };
        }

        // Group by week
        const weeklyHours = [];
        const weeks = Math.ceil(CONFIG.HISTORICAL_WINDOW / 7);

        for (let i = 0; i < weeks; i++) {
            const weekStart = new Date(start);
            weekStart.setDate(start.getDate() + (i * 7));
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);

            const weekSessions = historicalSessions.filter(s => {
                const date = new Date(s.completedAt);
                return date >= weekStart && date <= weekEnd;
            });

            const weekMinutes = weekSessions.reduce((sum, s) => sum + (s.duration || 0) / 60, 0);
            weeklyHours.push(weekMinutes / 60);
        }

        // Calculate prediction using moving average
        const predicted = movingAverage(weeklyHours);
        const trend = calculateTrend(weeklyHours);
        const confidence = calculateConfidence(historicalSessions.length);

        // Adjust prediction based on trend
        let adjustedPrediction = predicted;
        if (trend.direction === 'increasing') {
            adjustedPrediction *= 1.1; // 10% optimistic adjustment
        } else if (trend.direction === 'decreasing') {
            adjustedPrediction *= 0.9; // 10% pessimistic adjustment
        }

        let message = '';
        if (trend.direction === 'increasing') {
            message = `Your study time is trending up by ${Math.abs(trend.changePercent)}%! Keep it going.`;
        } else if (trend.direction === 'decreasing') {
            message = `Study time has decreased by ${Math.abs(trend.changePercent)}%. Time to refocus!`;
        } else {
            message = 'Your study pattern is consistent. Maintain the momentum!';
        }

        return {
            expectedHours: Math.round(adjustedPrediction * 10) / 10,
            baselineHours: Math.round(predicted * 10) / 10,
            confidence,
            trend,
            historicalAverage: Math.round(predicted * 10) / 10,
            message
        };
    }

    /**
     * Predict focus session success probability
     * @returns {Object} Focus success prediction
     */
    function predictFocusSuccess() {
        const sessions = getFocusSessions();
        const { start, end } = getDateRange(CONFIG.HISTORICAL_WINDOW);

        const historicalSessions = sessions.filter(s => {
            if (!s.completedAt) return false;
            const date = new Date(s.completedAt);
            return date >= start && date <= end;
        });

        if (historicalSessions.length < CONFIG.MIN_DATA_POINTS) {
            return {
                probability: 0,
                confidence: calculateConfidence(historicalSessions.length),
                message: 'Complete more focus sessions to get predictions.'
            };
        }

        // Calculate success rate
        const completed = historicalSessions.filter(s => s.completed).length;
        const total = historicalSessions.length;
        const successRate = completed / total;

        // Get recent trend
        const recentWeek = sessions.filter(s => {
            if (!s.completedAt) return false;
            const date = new Date(s.completedAt);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return date >= weekAgo;
        });

        const recentSuccess = recentWeek.filter(s => s.completed).length;
        const recentTotal = recentWeek.length;
        const recentRate = recentTotal > 0 ? recentSuccess / recentTotal : successRate;

        // Weighted average (60% recent, 40% historical)
        const predictedRate = (recentRate * 0.6) + (successRate * 0.4);
        const confidence = calculateConfidence(historicalSessions.length);

        let message = '';
        if (predictedRate > 0.8) {
            message = 'Excellent focus discipline! You rarely get distracted.';
        } else if (predictedRate > 0.6) {
            message = 'Good focus success rate. Room for improvement.';
        } else {
            message = 'Try Focus Lock Mode to improve completion rate.';
        }

        return {
            probability: Math.round(predictedRate * 100),
            rate: Math.round(predictedRate * 100) / 100,
            historicalRate: Math.round(successRate * 100),
            recentRate: Math.round(recentRate * 100),
            confidence,
            totalSessions: total,
            message
        };
    }

    /**
     * Predict task completion likelihood
     * @returns {Object} Task completion prediction
     */
    function predictTaskCompletion() {
        const tasks = getTasks();
        const { start, end } = getDateRange(CONFIG.HISTORICAL_WINDOW);

        // Historical task completion
        const historicalTasks = tasks.filter(t => {
            const created = new Date(t.createdAt);
            return created >= start && created <= end;
        });

        if (historicalTasks.length < CONFIG.MIN_DATA_POINTS) {
            return {
                likelihood: 0,
                confidence: calculateConfidence(historicalTasks.length),
                message: 'Create and complete more tasks to get predictions.'
            };
        }

        const completed = historicalTasks.filter(t => t.completed).length;
        const completionRate = completed / historicalTasks.length;

        // Check recent trend
        const recentWeek = tasks.filter(t => {
            const created = new Date(t.createdAt);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return created >= weekAgo;
        });

        const recentCompleted = recentWeek.filter(t => t.completed).length;
        const recentTotal = recentWeek.length;
        const recentRate = recentTotal > 0 ? recentCompleted / recentTotal : completionRate;

        // Weighted prediction
        const predictedRate = (recentRate * 0.6) + (completionRate * 0.4);
        const confidence = calculateConfidence(historicalTasks.length);

        let message = '';
        if (predictedRate > 0.7) {
            message = 'You have a strong task completion track record!';
        } else if (predictedRate > 0.5) {
            message = 'Decent completion rate. Try breaking tasks into smaller pieces.';
        } else {
            message = 'Focus on completing fewer tasks with higher quality.';
        }

        return {
            likelihood: Math.round(predictedRate * 100),
            rate: Math.round(predictedRate * 100) / 100,
            historicalRate: Math.round(completionRate * 100),
            recentRate: Math.round(recentRate * 100),
            confidence,
            totalTasks: historicalTasks.length,
            completedTasks: completed,
            message
        };
    }

    /**
     * Predict most productive days for upcoming week
     * @returns {Object} Productivity day prediction
     */
    function predictProductiveDays() {
        const sessions = getFocusSessions();
        const { start, end } = getDateRange(CONFIG.HISTORICAL_WINDOW);

        const historicalSessions = sessions.filter(s => {
            if (!s.completedAt || !s.completed) return false;
            const date = new Date(s.completedAt);
            return date >= start && date <= end;
        });

        if (historicalSessions.length < CONFIG.MIN_DATA_POINTS) {
            return {
                predictions: [],
                confidence: calculateConfidence(historicalSessions.length),
                message: 'Not enough data to predict productive days.'
            };
        }

        // Group by day of week
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayStats = {};

        dayNames.forEach(day => {
            dayStats[day] = { sessions: 0, minutes: 0 };
        });

        historicalSessions.forEach(session => {
            const date = new Date(session.completedAt);
            const dayName = dayNames[date.getDay()];
            dayStats[dayName].sessions++;
            dayStats[dayName].minutes += (session.duration || 0) / 60;
        });

        // Convert to array and sort
        const predictions = Object.keys(dayStats).map(day => ({
            day,
            sessions: dayStats[day].sessions,
            avgMinutes: dayStats[day].sessions > 0
                ? Math.round(dayStats[day].minutes / dayStats[day].sessions)
                : 0,
            totalHours: Math.round(dayStats[day].minutes / 60 * 10) / 10
        })).sort((a, b) => b.totalHours - a.totalHours);

        const topDay = predictions[0];
        const confidence = calculateConfidence(historicalSessions.length);

        return {
            predictions,
            mostProductiveDay: topDay.day,
            confidence,
            message: `You're most productive on ${topDay.day}s with an average of ${topDay.totalHours} hours of study.`
        };
    }

    // ===== MAIN PREDICTION FUNCTION =====
    
    /**
     * Generate all predictions
     * @returns {Object} Comprehensive predictions
     */
    function predict() {
        console.log('🔮 Generating productivity predictions...');
        
        const startTime = performance.now();

        try {
            const predictions = {
                timestamp: new Date().toISOString(),
                studyHours: predictStudyHours(),
                focusSuccess: predictFocusSuccess(),
                taskCompletion: predictTaskCompletion(),
                productiveDays: predictProductiveDays()
            };

            // Overall confidence
            const confidenceScores = [
                predictions.studyHours.confidence.score,
                predictions.focusSuccess.confidence.score,
                predictions.taskCompletion.confidence.score,
                predictions.productiveDays.confidence.score
            ];
            const avgConfidence = confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length;

            predictions.overallConfidence = {
                score: Math.round(avgConfidence * 100) / 100,
                level: avgConfidence > 0.7 ? 'high' : avgConfidence > 0.4 ? 'medium' : 'low'
            };

            const duration = (performance.now() - startTime).toFixed(2);
            console.log(`✅ Predictions generated in ${duration}ms`);

            return predictions;

        } catch (error) {
            console.error('❌ Error generating predictions:', error);
            return null;
        }
    }

    // ===== PUBLIC API =====
    return {
        init,
        predict,
        
        // Expose individual predictors for testing
        predictStudyHours,
        predictFocusSuccess,
        predictTaskCompletion,
        predictProductiveDays
    };
})();
