// ===== PERFORMANCE CALCULATOR MODULE (js/performanceCalculator.js) =====
// Calculates Weekly Performance Percentage
// Formula: (Task Completion × 50%) + (Habit Completion × 30%) + (Focus Completion × 20%)

const PerformanceCalculator = (function () {
    'use strict';

    // --- Helper: Get week boundaries ---
    function getWeekBounds() {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Sunday
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        return { start: startOfWeek, end: endOfWeek };
    }

    // --- Helper: Format date as YYYY-MM-DD ---
    function toDateStr(d) {
        return d.toISOString().split('T')[0];
    }

    // --- Calculate Task Completion Rate ---
    function calculateTaskCompletion() {
        const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
        const { start, end } = getWeekBounds();

        // Tasks created this week (or that exist in current active list)
        const totalTasks = tasks.length;

        // Tasks completed this week
        const completedThisWeek = tasks.filter(t => {
            if (!t.completed || !t.completedDate) return false;
            const completedDate = new Date(t.completedDate);
            return completedDate >= start && completedDate <= end;
        }).length;

        // Rate: completed / total (with fallback to 0 if no tasks)
        const rate = totalTasks > 0 ? (completedThisWeek / totalTasks) : 0;

        return {
            completed: completedThisWeek,
            total: totalTasks,
            rate: Math.min(rate, 1) // Cap at 100%
        };
    }

    // --- Calculate Habit Completion Rate ---
    function calculateHabitCompletion() {
        const habits = JSON.parse(localStorage.getItem('habits')) || [];
        const { start, end } = getWeekBounds();

        if (habits.length === 0) {
            return { completed: 0, expected: 0, rate: 0 };
        }

        let totalExpected = 0;
        let totalCompleted = 0;

        // Generate all dates in the current week
        const weekDates = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            weekDates.push(toDateStr(new Date(d)));
        }

        habits.forEach(habit => {
            const history = habit.history || [];
            const frequency = habit.frequency || 'daily';
            const targetDays = habit.targetDays || [];

            weekDates.forEach(dateStr => {
                const dayName = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
                let isExpected = false;

                if (frequency === 'daily') {
                    isExpected = true;
                } else if (frequency === 'weekly') {
                    // Weekly = any 3 days, so we expect 3 completions per week total
                    isExpected = false; // Handled separately
                } else if (frequency === 'specific_days') {
                    isExpected = targetDays.includes(dayName);
                }

                if (isExpected) {
                    totalExpected++;
                    if (history.includes(dateStr)) {
                        totalCompleted++;
                    }
                }
            });

            // Handle 'weekly' frequency separately (expecting 3 completions/week)
            if (frequency === 'weekly') {
                totalExpected += 3;
                const weeklyCompletions = history.filter(h => weekDates.includes(h)).length;
                totalCompleted += Math.min(weeklyCompletions, 3);
            }
        });

        const rate = totalExpected > 0 ? (totalCompleted / totalExpected) : 0;

        return {
            completed: totalCompleted,
            expected: totalExpected,
            rate: Math.min(rate, 1)
        };
    }

    // --- Calculate Focus Session Completion Rate ---
    function calculateFocusCompletion() {
        const sessions = JSON.parse(localStorage.getItem('focusSessions')) || [];
        const { start, end } = getWeekBounds();

        // Sessions completed this week
        const weekSessions = sessions.filter(s => {
            const completedAt = new Date(s.completedAt);
            return completedAt >= start && completedAt <= end;
        });

        const totalMinutes = weekSessions.reduce((sum, s) => sum + ((s.duration || 0) / 60), 0);
        const sessionCount = weekSessions.length;

        // Target: 5 focus sessions per week (reasonable baseline)
        // Enhanced: Consider 10 hours (600 mins) as optimal weekly focus
        const TARGET_SESSIONS = 5;
        const TARGET_HOURS = 10;

        // Weighted: 70% sessions, 30% time
        const sessionRate = Math.min(sessionCount / TARGET_SESSIONS, 1);
        const timeRate = Math.min((totalMinutes / 60) / TARGET_HOURS, 1);
        const combinedRate = (sessionRate * 0.7) + (timeRate * 0.3);

        return {
            sessions: sessionCount,
            totalMinutes: Math.round(totalMinutes),
            totalHours: (totalMinutes / 60).toFixed(1),
            rate: Math.min(combinedRate, 1)
        };
    }

    // --- Get Performance Interpretation ---
    function getInterpretation(percentage) {
        if (percentage >= 80) {
            return { message: 'Excellent Week!', emoji: '🌟', level: 'excellent' };
        } else if (percentage >= 60) {
            return { message: 'Good Progress', emoji: '👍', level: 'good' };
        } else if (percentage >= 40) {
            return { message: 'Needs Improvement', emoji: '💪', level: 'moderate' };
        } else {
            return { message: 'Low Productivity Week', emoji: '📈', level: 'low' };
        }
    }

    // --- Calculate Weekly Performance Percentage ---
    function calculate() {
        const taskData = calculateTaskCompletion();
        const habitData = calculateHabitCompletion();
        const focusData = calculateFocusCompletion();

        // Weighted formula:
        // Task Completion × 50% + Habit Completion × 30% + Focus Completion × 20%
        const weightedScore = (
            (taskData.rate * 0.5) +
            (habitData.rate * 0.3) +
            (focusData.rate * 0.2)
        );

        const percentage = Math.round(weightedScore * 100);
        const interpretation = getInterpretation(percentage);

        return {
            percentage,
            interpretation,
            breakdown: {
                tasks: {
                    ...taskData,
                    contribution: Math.round(taskData.rate * 50)
                },
                habits: {
                    ...habitData,
                    contribution: Math.round(habitData.rate * 30)
                },
                focus: {
                    ...focusData,
                    contribution: Math.round(focusData.rate * 20)
                }
            },
            calculatedAt: new Date().toISOString()
        };
    }

    // --- Public API ---
    return {
        calculate,
        calculateTaskCompletion,
        calculateHabitCompletion,
        calculateFocusCompletion,
        getInterpretation,
        getWeekBounds
    };
})();

// Make available globally
if (typeof window !== 'undefined') {
    window.PerformanceCalculator = PerformanceCalculator;
}
