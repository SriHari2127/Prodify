// ===== PRODUCTIVITY SCORE MODULE (js/productivityScore.js) =====
// Smart Metric (0-100) combining tasks, focus, habits, and study planner
// Stores weekly score in Firestore: users/{userId}/weeklyStats/{year-weekNumber}

const ProductivityScore = (function () {
    'use strict';

    // --- Helper: Get ISO week number ---
    function getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return { year: d.getUTCFullYear(), week: weekNo };
    }

    // --- Helper: Get week identifier ---
    function getWeekId(date = new Date()) {
        const { year, week } = getWeekNumber(date);
        return `${year}-W${String(week).padStart(2, '0')}`;
    }

    // --- Helper: Get week start and end dates ---
    function getWeekBounds(date = new Date()) {
        const now = new Date(date);
        const dayOfWeek = now.getDay();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        return {
            start: startOfWeek,
            end: endOfWeek,
            startISO: startOfWeek.toISOString().split('T')[0],
            endISO: endOfWeek.toISOString().split('T')[0]
        };
    }

    // --- Calculate Study Planner Adherence ---
    function calculateStudyPlannerAdherence() {
        const studyBlocks = JSON.parse(localStorage.getItem('studyBlocks')) || [];
        const focusSessions = JSON.parse(localStorage.getItem('focusSessions')) || [];
        const { start, end } = getWeekBounds();

        if (studyBlocks.length === 0) {
            return { adherence: 1, planned: 0, actual: 0 }; // No planned blocks = 100% adherence
        }

        // Calculate planned minutes per week from study blocks
        const plannedMinutes = studyBlocks.reduce((sum, block) => sum + (block.duration || 0), 0);

        // Calculate actual focus minutes this week
        const weekSessions = focusSessions.filter(s => {
            const completedAt = new Date(s.completedAt);
            return completedAt >= start && completedAt <= end;
        });
        const actualMinutes = weekSessions.reduce((sum, s) => sum + ((s.duration || 0) / 60), 0);

        // Adherence rate: actual / planned (capped at 1)
        const adherence = plannedMinutes > 0 ? Math.min(actualMinutes / plannedMinutes, 1) : 1;

        return {
            adherence,
            planned: plannedMinutes,
            actual: Math.round(actualMinutes)
        };
    }

    // --- Calculate Habit Streak Consistency ---
    function calculateHabitStreakConsistency() {
        const habits = JSON.parse(localStorage.getItem('habits')) || [];

        if (habits.length === 0) {
            return { consistency: 0, avgStreak: 0, maxStreak: 0 };
        }

        const streaks = habits.map(h => h.streak || 0);
        const avgStreak = streaks.reduce((a, b) => a + b, 0) / habits.length;
        const maxStreak = Math.max(...streaks);

        // Consistency score based on average streak
        // 7+ days average = 100%, linear scale below
        const TARGET_STREAK = 7;
        const consistency = Math.min(avgStreak / TARGET_STREAK, 1);

        return {
            consistency,
            avgStreak: Math.round(avgStreak * 10) / 10,
            maxStreak
        };
    }

    // --- Calculate Weekly Productivity Score (0-100) ---
    function calculate() {
        // Use PerformanceCalculator for base metrics
        let taskRate = 0, habitRate = 0, focusHours = 0, focusSessions = 0;

        if (typeof PerformanceCalculator !== 'undefined') {
            const taskData = PerformanceCalculator.calculateTaskCompletion();
            const habitData = PerformanceCalculator.calculateHabitCompletion();
            const focusData = PerformanceCalculator.calculateFocusCompletion();

            taskRate = taskData.rate;
            habitRate = habitData.rate;
            focusHours = parseFloat(focusData.totalHours) || 0;
            focusSessions = focusData.sessions;
        }

        const streakData = calculateHabitStreakConsistency();
        const plannerData = calculateStudyPlannerAdherence();

        // Enhanced formula with multiple factors:
        // Task completion:       30%
        // Focus hours:           25%
        // Habit completion:      20%
        // Habit streak:          15%
        // Planner adherence:     10%

        const focusScore = Math.min(focusHours / 10, 1); // 10 hours = 100%

        const weightedScore = (
            (taskRate * 0.30) +
            (focusScore * 0.25) +
            (habitRate * 0.20) +
            (streakData.consistency * 0.15) +
            (plannerData.adherence * 0.10)
        );

        const score = Math.round(weightedScore * 100);

        return {
            score: Math.max(0, Math.min(100, score)),
            breakdown: {
                taskCompletion: Math.round(taskRate * 100),
                focusHours: focusHours,
                focusSessions: focusSessions,
                habitCompletion: Math.round(habitRate * 100),
                habitStreak: streakData.avgStreak,
                plannerAdherence: Math.round(plannerData.adherence * 100)
            },
            weekId: getWeekId(),
            calculatedAt: new Date().toISOString()
        };
    }

    // --- Get Score Level ---
    function getScoreLevel(score) {
        const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#3b82f6';
        if (score >= 90) return { label: 'Outstanding', color: '#10b981', icon: '🏆' };
        if (score >= 75) return { label: 'Excellent', color: '#22c55e', icon: '🌟' };
        if (score >= 60) return { label: 'Good', color: accentColor, icon: '👍' };
        if (score >= 40) return { label: 'Fair', color: '#f59e0b', icon: '💪' };
        return { label: 'Needs Work', color: '#ef4444', icon: '📈' };
    }

    // --- Save Weekly Stats to Firestore ---
    async function saveWeeklyStats() {
        if (typeof currentUserId === 'undefined' || !currentUserId) {
            console.log('⚠️ No user logged in, skipping Firestore save');
            return null;
        }

        if (typeof firebase === 'undefined' || !firebase.firestore) {
            console.log('⚠️ Firebase not available, skipping Firestore save');
            return null;
        }

        const scoreData = calculate();
        const { startISO, endISO } = getWeekBounds();
        const weekId = getWeekId();

        const statsDoc = {
            weekStart: startISO,
            weekEnd: endISO,
            productivityScore: scoreData.score,
            totalStudyHours: scoreData.breakdown.focusHours,
            completedTasks: scoreData.breakdown.taskCompletion,
            habitCompletionRate: scoreData.breakdown.habitCompletion,
            focusSessions: scoreData.breakdown.focusSessions,
            avgHabitStreak: scoreData.breakdown.habitStreak,
            plannerAdherence: scoreData.breakdown.plannerAdherence,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            await firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection('weeklyStats')
                .doc(weekId)
                .set(statsDoc, { merge: true });

            console.log('✅ Weekly stats saved to Firestore:', weekId);
            return statsDoc;
        } catch (error) {
            console.error('❌ Error saving weekly stats:', error);
            return null;
        }
    }

    // --- Load Weekly Stats History from Firestore ---
    async function loadWeeklyStatsHistory(weeksBack = 8) {
        if (typeof currentUserId === 'undefined' || !currentUserId) {
            return [];
        }

        if (typeof firebase === 'undefined' || !firebase.firestore) {
            return [];
        }

        try {
            const snapshot = await firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection('weeklyStats')
                .orderBy('weekStart', 'desc')
                .limit(weeksBack)
                .get();

            const history = [];
            snapshot.forEach(doc => {
                history.push({ id: doc.id, ...doc.data() });
            });

            return history.reverse(); // Oldest first for charting
        } catch (error) {
            console.error('❌ Error loading weekly stats history:', error);
            return [];
        }
    }

    // --- Get Last Week's Score for Comparison ---
    async function getLastWeekScore() {
        const history = await loadWeeklyStatsHistory(2);
        if (history.length >= 2) {
            return history[history.length - 2].productivityScore;
        }
        return null;
    }

    // --- Public API ---
    return {
        calculate,
        getScoreLevel,
        saveWeeklyStats,
        loadWeeklyStatsHistory,
        getLastWeekScore,
        getWeekId,
        getWeekBounds,
        calculateStudyPlannerAdherence,
        calculateHabitStreakConsistency
    };
})();

// Make available globally
if (typeof window !== 'undefined') {
    window.ProductivityScore = ProductivityScore;
}
