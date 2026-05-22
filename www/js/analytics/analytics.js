// ===== SMART ANALYTICS MODULE (js/analytics.js) =====
// Main module that orchestrates all analytics features
// Includes: Insight Engine, UI Rendering, Data Aggregation

const SmartAnalytics = (function () {
    'use strict';

    let isInitialized = false;
    let analyticsTabActive = false;

    // --- Insight Engine: Rule-Based Intelligence ---
    const InsightEngine = {
        // Generate all insights
        generateInsights: function () {
            const insights = [];

            // Get all required data
            const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
            const habits = JSON.parse(localStorage.getItem('habits')) || [];
            const focusSessions = JSON.parse(localStorage.getItem('focusSessions')) || [];

            // Calculate metrics
            let performanceData = null, scoreData = null, studyData = null;

            if (typeof PerformanceCalculator !== 'undefined') {
                performanceData = PerformanceCalculator.calculate();
            }

            if (typeof ProductivityScore !== 'undefined') {
                scoreData = ProductivityScore.calculate();
            }

            if (typeof AnalyticsCharts !== 'undefined') {
                studyData = AnalyticsCharts.getStudyDataSummary();
            }

            // --- Rule 1: Week-over-week study comparison ---
            const lastWeekHours = this.getLastWeekStudyHours(focusSessions);
            const thisWeekHours = parseFloat(studyData?.totalHours || 0);

            if (lastWeekHours > 0 && thisWeekHours > 0) {
                const diff = thisWeekHours - lastWeekHours;
                const pctChange = Math.round((diff / lastWeekHours) * 100);

                if (pctChange > 10) {
                    insights.push({
                        type: 'improvement',
                        icon: '<i class="fa-solid fa-arrow-trend-up"></i>',
                        text: `You studied ${Math.abs(pctChange)}% more than last week! Keep it up!`,
                        priority: 1
                    });
                } else if (pctChange < -10) {
                    insights.push({
                        type: 'warning',
                        icon: '<i class="fa-solid fa-arrow-trend-down"></i>',
                        text: `Study time dropped ${Math.abs(pctChange)}% from last week. Try to schedule more focus sessions.`,
                        priority: 2
                    });
                }
            }

            // --- Rule 2: Most productive day ---
            if (studyData?.mostProductiveDay) {
                insights.push({
                    type: 'info',
                    icon: '<i class="fa-solid fa-trophy text-yellow-500"></i>',
                    text: `Your most productive day is ${studyData.mostProductiveDay}. Consider scheduling important tasks then.`,
                    priority: 3
                });
            }

            // --- Rule 3: Focus drops pattern ---
            if (studyData?.data) {
                const focusDropDay = this.detectFocusDrop(studyData.data);
                if (focusDropDay) {
                    insights.push({
                        type: 'observation',
                        icon: '<i class="fa-solid fa-chart-column"></i>',
                        text: `Your focus tends to drop after ${focusDropDay}. Plan lighter tasks for late week.`,
                        priority: 4
                    });
                }
            }

            // --- Rule 4: Habit consistency vs deep work ---
            const habitRate = performanceData?.breakdown?.habits?.rate || 0;
            const focusRate = performanceData?.breakdown?.focus?.rate || 0;

            if (habitRate > 0.7 && focusRate < 0.4) {
                insights.push({
                    type: 'suggestion',
                    icon: '<i class="fa-solid fa-bullseye text-red-500"></i>',
                    text: 'Great habit consistency! Now try adding more deep work sessions to boost productivity.',
                    priority: 2
                });
            } else if (focusRate > 0.7 && habitRate < 0.4) {
                insights.push({
                    type: 'suggestion',
                    icon: '<i class="fa-solid fa-seedling text-green-500"></i>',
                    text: 'Strong focus game! Balance it with better habit tracking for overall wellness.',
                    priority: 2
                });
            }

            // --- Rule 5: Task completion guidance ---
            const taskRate = performanceData?.breakdown?.tasks?.rate || 0;
            if (taskRate < 0.5 && tasks.length > 5) {
                insights.push({
                    type: 'suggestion',
                    icon: '<i class="fa-solid fa-clipboard-list"></i>',
                    text: 'Less than half your tasks are done. Try breaking large tasks into smaller steps.',
                    priority: 1
                });
            }

            // --- Rule 6: Low focus hours warning ---
            if (thisWeekHours < 5 && focusSessions.length < 3) {
                insights.push({
                    type: 'warning',
                    icon: '<i class="fa-solid fa-clock"></i>',
                    text: `Only ${thisWeekHours} hours of deep work this week. Aim for at least 5-10 hours.`,
                    priority: 1
                });
            }

            // --- Rule 7: Streak celebration ---
            const maxStreak = Math.max(...habits.map(h => h.streak || 0), 0);
            if (maxStreak >= 7) {
                const streakHabit = habits.find(h => h.streak === maxStreak);
                insights.push({
                    type: 'achievement',
                    icon: '<i class="fa-solid fa-fire text-orange-500"></i>',
                    text: `Amazing ${maxStreak}-day streak with "${streakHabit?.name}"! You're building strong habits.`,
                    priority: 1
                });
            }

            // --- Rule 8: Productivity score trend ---
            if (scoreData?.score) {
                if (scoreData.score >= 80) {
                    insights.push({
                        type: 'achievement',
                        icon: '<i class="fa-solid fa-star text-yellow-400"></i>',
                        text: `Productivity score of ${scoreData.score}/100! You're in the excellence zone.`,
                        priority: 2
                    });
                } else if (scoreData.score < 40) {
                    insights.push({
                        type: 'motivation',
                        icon: '<i class="fa-solid fa-dumbbell text-slate-500"></i>',
                        text: `Score at ${scoreData.score}/100. Small daily improvements add up. Start with one focus session today.`,
                        priority: 1
                    });
                }
            }

            // --- Rule 9: Best task completion day ---
            const bestTaskDay = this.findBestTaskDay(tasks);
            if (bestTaskDay && bestTaskDay !== studyData?.mostProductiveDay) {
                insights.push({
                    type: 'info',
                    icon: '<i class="fa-solid fa-check text-green-500"></i>',
                    text: `${bestTaskDay} is your best day for completing tasks. Use it for important deadlines.`,
                    priority: 4
                });
            }

            // --- Rule 10: Weekend productivity check ---
            const weekendFocus = this.getWeekendFocusHours(studyData?.data || []);
            if (weekendFocus > 3) {
                insights.push({
                    type: 'observation',
                    icon: '<i class="fa-solid fa-calendar-days"></i>',
                    text: `You're putting in ${weekendFocus.toFixed(1)} hours on weekends. Great dedication!`,
                    priority: 5
                });
            }

            // Sort by priority and return top insights
            return insights.sort((a, b) => a.priority - b.priority).slice(0, 5);
        },

        // Helper: Get last week's study hours
        getLastWeekStudyHours: function (sessions) {
            const now = new Date();
            const lastWeekEnd = new Date(now);
            lastWeekEnd.setDate(now.getDate() - now.getDay());
            lastWeekEnd.setHours(0, 0, 0, 0);

            const lastWeekStart = new Date(lastWeekEnd);
            lastWeekStart.setDate(lastWeekEnd.getDate() - 7);

            const lastWeekSessions = sessions.filter(s => {
                const d = new Date(s.completedAt);
                return d >= lastWeekStart && d < lastWeekEnd;
            });

            const totalSeconds = lastWeekSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
            return totalSeconds / 3600; // Convert to hours
        },

        // Helper: Detect focus drop pattern
        detectFocusDrop: function (dailyData) {
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

            // Find peak day (Mon-Wed range)
            let peakValue = 0, peakIndex = -1;
            for (let i = 1; i <= 3; i++) {
                if (dailyData[i] > peakValue) {
                    peakValue = dailyData[i];
                    peakIndex = i;
                }
            }

            // Check if Thu-Sat has significant drop (>50% drop)
            if (peakValue > 0) {
                const lateWeekAvg = (dailyData[4] + dailyData[5] + dailyData[6]) / 3;
                if (lateWeekAvg < peakValue * 0.5) {
                    return dayNames[peakIndex];
                }
            }

            return null;
        },

        // Helper: Find best day for task completion
        findBestTaskDay: function (tasks) {
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dayCounts = [0, 0, 0, 0, 0, 0, 0];

            tasks.forEach(t => {
                if (t.completed && t.completedDate) {
                    const dayIndex = new Date(t.completedDate).getDay();
                    dayCounts[dayIndex]++;
                }
            });

            const maxCount = Math.max(...dayCounts);
            if (maxCount >= 3) {
                return dayNames[dayCounts.indexOf(maxCount)];
            }
            return null;
        },

        // Helper: Get weekend focus hours
        getWeekendFocusHours: function (dailyData) {
            // Sunday (0) and Saturday (6)
            return (dailyData[0] || 0) + (dailyData[6] || 0);
        }
    };

    // --- UI Rendering Functions ---

    // Render Performance Card
    function renderPerformanceCard() {
        const container = document.getElementById('performanceCardContainer');
        if (!container) return;

        if (typeof PerformanceCalculator === 'undefined') {
            container.innerHTML = '<div class="ana-card ana-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';
            return;
        }

        const data = PerformanceCalculator.calculate();
        const circumference = 2 * Math.PI * 42;
        const offset = circumference - (circumference * data.percentage / 100);
        const perfColor = data.percentage >= 80 ? '#10b981' : data.percentage >= 50 ? 'var(--accent-color)' : data.percentage >= 25 ? '#f59e0b' : '#ef4444';

        const bars = [
            { label: 'Tasks',  val: data.breakdown.tasks.contribution,  max: 50, color: 'var(--accent-color)' },
            { label: 'Habits', val: data.breakdown.habits.contribution, max: 30, color: '#8b5cf6' },
            { label: 'Focus',  val: data.breakdown.focus.contribution,  max: 20, color: '#06b6d4' }
        ];

        const barsHtml = bars.map(b => {
            const pct = Math.round((b.val / b.max) * 100);
            return `
            <div class="ana-perf__row">
                <span class="ana-perf__row-label">${b.label}</span>
                <div class="ana-perf__row-track"><div class="ana-perf__row-fill" style="width:${pct}%;background:${b.color}"></div></div>
                <span class="ana-perf__row-val">${b.val}/${b.max}</span>
            </div>`;
        }).join('');

        container.innerHTML = `
            <div class="ana-card ana-perf">
                <div class="ana-card__head">
                    <div class="ana-card__title"><i class="fa-solid fa-gauge-high"></i> Weekly Performance</div>
                    <span class="ana-perf__level" style="color:${perfColor}">${data.interpretation.emoji}</span>
                </div>
                <div class="ana-perf__ring-wrap">
                    <div class="ana-perf__ring">
                        <svg viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--surface-border)" stroke-width="6"/>
                            <circle cx="50" cy="50" r="42" fill="none" stroke="${perfColor}" stroke-width="6"
                                stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                                transform="rotate(-90 50 50)"
                                style="transition:stroke-dashoffset 0.8s cubic-bezier(0.34,1.56,0.64,1)"/>
                        </svg>
                        <div class="ana-perf__val">${data.percentage}<small>%</small></div>
                    </div>
                    <span class="ana-perf__msg">${data.interpretation.message}</span>
                </div>
                <div class="ana-perf__bars">${barsHtml}</div>
            </div>
        `;
        
        // Remove skeleton loader after performance card is rendered
        if (typeof SkeletonLoader !== 'undefined') {
            setTimeout(() => SkeletonLoader.remove('#performanceCardContainer'), 800);
        }
    }

    // Render Productivity Score Card
    function renderScoreCard() {
        const container = document.getElementById('scoreCardContainer');
        if (!container) return;

        if (typeof ProductivityScore === 'undefined') {
            container.innerHTML = '<div class="ana-card ana-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';
            return;
        }

        const data = ProductivityScore.calculate();
        const level = ProductivityScore.getScoreLevel(data.score);

        const details = [
            { icon: 'fa-book',  value: data.breakdown.focusHours + 'h', label: 'Study',  color: '#6366f1' },
            { icon: 'fa-check', value: data.breakdown.taskCompletion + '%', label: 'Tasks', color: '#10b981' },
            { icon: 'fa-fire',  value: data.breakdown.habitStreak + 'd',  label: 'Streak', color: '#f97316' }
        ];

        container.innerHTML = `
            <div class="ana-card ana-score">
                <div class="ana-card__head">
                    <div class="ana-card__title"><i class="fa-solid fa-bolt"></i> Productivity Score</div>
                </div>
                <div class="ana-score__hero">
                    <span class="ana-score__number" style="color:${level.color}">${data.score}</span>
                    <span class="ana-score__max">/100</span>
                </div>
                <div class="ana-score__level" style="color:${level.color};background:${level.color}15;">
                    <span>${level.icon}</span> ${level.label}
                </div>
                <div class="ana-score__details">
                    ${details.map(d => `
                    <div class="ana-score__detail">
                        <div class="ana-score__detail-icon" style="color:${d.color};background:${d.color}12;">
                            <i class="fa-solid ${d.icon}"></i>
                        </div>
                        <span class="ana-score__detail-val">${d.value}</span>
                        <span class="ana-score__detail-label">${d.label}</span>
                    </div>`).join('')}
                </div>
                <div class="ana-score__chart">
                    <canvas id="scoreHistoryChart"></canvas>
                </div>
            </div>
        `;

        // Render mini chart after DOM update
        setTimeout(() => {
            if (typeof AnalyticsCharts !== 'undefined') {
                AnalyticsCharts.renderScoreHistoryChart('scoreHistoryChart');
            }
        }, 50);
    }

    // Render Study Hours Graph
    function renderStudyHoursGraph() {
        const container = document.getElementById('studyHoursContainer');
        if (!container) return;

        const studyData = typeof AnalyticsCharts !== 'undefined' 
            ? AnalyticsCharts.getStudyDataSummary() 
            : { totalHours: '0', avgHoursPerDay: '0' };

        container.innerHTML = `
            <div class="ana-card ana-study">
                <div class="ana-card__head">
                    <div class="ana-card__title"><i class="fa-solid fa-clock"></i> Study Hours</div>
                    <span class="ana-study__total">${studyData.totalHours}h</span>
                </div>
                <div class="ana-study__chart">
                    <canvas id="studyHoursChart"></canvas>
                </div>
                <div class="ana-study__footer">
                    <div class="ana-study__stat">
                        <i class="fa-solid fa-chart-simple"></i>
                        <span>Avg: <strong>${studyData.avgHoursPerDay}h</strong>/day</span>
                    </div>
                    ${studyData.mostProductiveDay ? `
                    <div class="ana-study__stat">
                        <i class="fa-solid fa-trophy"></i>
                        <span>Best: <strong>${studyData.mostProductiveDay}</strong></span>
                    </div>` : ''}
                </div>
            </div>
        `;

        setTimeout(() => {
            if (typeof AnalyticsCharts !== 'undefined') {
                AnalyticsCharts.renderStudyHoursChart('studyHoursChart');
            }
        }, 50);
    }

    // Render Insights Card
    function renderInsightsCard() {
        const container = document.getElementById('insightsContainer');
        if (!container) return;

        const insights = InsightEngine.generateInsights();

        const typeStyles = {
            improvement:  { bg: 'rgba(16,185,129,0.08)',  border: '#10b981' },
            warning:      { bg: 'rgba(245,158,11,0.08)',  border: '#f59e0b' },
            achievement:  { bg: 'rgba(139,92,246,0.08)',  border: '#8b5cf6' },
            suggestion:   { bg: 'rgba(var(--accent-rgb),0.06)',  border: 'var(--accent-color)' },
            observation:  { bg: 'rgba(148,163,184,0.08)', border: '#94a3b8' },
            info:         { bg: 'rgba(148,163,184,0.08)', border: '#94a3b8' },
            motivation:   { bg: 'rgba(236,72,153,0.08)',  border: '#ec4899' }
        };

        if (insights.length === 0) {
            container.innerHTML = `
                <div class="ana-card ana-insights">
                    <div class="ana-card__head">
                        <div class="ana-card__title"><i class="fa-solid fa-lightbulb"></i> Weekly Insights</div>
                    </div>
                    <div class="ana-insights__empty">
                        <i class="fa-solid fa-chart-line"></i>
                        <span>No insights yet<br>Complete tasks and focus sessions to unlock personalized insights</span>
                    </div>
                </div>
            `;
            return;
        }

        const insightsHtml = insights.map(ins => {
            const style = typeStyles[ins.type] || typeStyles.info;
            return `
            <div class="ana-insights__item" style="background:${style.bg};border-left-color:${style.border}">
                <span class="ana-insights__icon">${ins.icon}</span>
                <p class="ana-insights__text">${ins.text}</p>
            </div>`;
        }).join('');

        container.innerHTML = `
            <div class="ana-card ana-insights">
                <div class="ana-card__head">
                    <div class="ana-card__title"><i class="fa-solid fa-lightbulb"></i> Weekly Insights</div>
                    <span class="ana-insights__count">${insights.length}</span>
                </div>
                <div class="ana-insights__list">${insightsHtml}</div>
            </div>
        `;
    }

    // Render All Analytics
    function renderAll() {
        renderPerformanceCard();
        renderScoreCard();
        renderStudyHoursGraph();
        renderInsightsCard();
    }

    // --- Save Weekly Stats (called periodically) ---
    async function saveWeeklyStats() {
        if (typeof ProductivityScore !== 'undefined') {
            await ProductivityScore.saveWeeklyStats();
        }
    }

    // --- Initialize Analytics Module ---
    function init() {
        if (isInitialized) return;

        console.log('📊 Initializing Smart Analytics module');

        // Check if user is logged in
        if (typeof currentUserId === 'undefined' || !currentUserId) {
            console.log('⏳ Analytics: Waiting for user login');
            return;
        }

        isInitialized = true;

        // Initial render if analytics section exists
        if (document.getElementById('analyticsSection')) {
            renderAll();
        }

        // Save weekly stats on init
        saveWeeklyStats();

        // Setup periodic save (every 5 minutes while app is active)
        setInterval(() => {
            if (document.visibilityState === 'visible') {
                saveWeeklyStats();
            }
        }, 5 * 60 * 1000);

        console.log('✅ Smart Analytics initialized');
    }

    // --- Refresh Analytics (when tab is shown) ---
    function refresh() {
        renderAll();
    }

    // --- Cleanup ---
    function cleanup() {
        if (typeof AnalyticsCharts !== 'undefined') {
            AnalyticsCharts.destroyCharts();
        }
        isInitialized = false;
    }

    // --- Public API ---
    return {
        init,
        refresh,
        cleanup,
        renderAll,
        renderPerformanceCard,
        renderScoreCard,
        renderStudyHoursGraph,
        renderInsightsCard,
        saveWeeklyStats,
        InsightEngine
    };
})();

// Make available globally
if (typeof window !== 'undefined') {
    window.SmartAnalytics = SmartAnalytics;
}

// NOTE: No auto-initialization - controlled by StartupManager Phase 3 (lazy loading)
// Analytics loads only when user opens the Analytics tab for optimal startup performance
