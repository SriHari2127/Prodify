// ===== ANALYTICS CHARTS MODULE (js/charts.js) =====
// Handles Study Hours Graph and other analytics visualizations
// Uses Chart.js (already included in the app)

const AnalyticsCharts = (function () {
    'use strict';

    let studyHoursChartInstance = null;
    let scoreHistoryChartInstance = null;

    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // --- Helper: Get theme colors ---
    function getThemeColors() {
        const isDark = !document.body.classList.contains('light');
        const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#3b82f6';
        return {
            primary: accentColor,
            secondary: '#8b5cf6',
            success: '#22c55e',
            warning: '#f59e0b',
            danger: '#ef4444',
            text: isDark ? '#e5e7eb' : '#374151',
            textMuted: isDark ? 'rgba(229, 231, 235, 0.6)' : 'rgba(55, 65, 81, 0.6)',
            grid: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            background: isDark ? '#1f2937' : '#ffffff'
        };
    }

    // --- Get Weekly Study Hours by Day ---
    function getWeeklyStudyHoursByDay() {
        const focusSessions = JSON.parse(localStorage.getItem('focusSessions')) || [];
        const now = new Date();
        const dayOfWeek = now.getDay();
        
        // Start of week (Sunday)
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);

        // Initialize daily data (Sun-Sat)
        const dailyMinutes = [0, 0, 0, 0, 0, 0, 0];

        focusSessions.forEach(session => {
            const sessionDate = new Date(session.completedAt);
            
            // Check if session is within current week
            if (sessionDate >= startOfWeek && sessionDate <= now) {
                const dayIndex = sessionDate.getDay();
                const durationMinutes = (session.duration || 0) / 60; // duration is in seconds
                dailyMinutes[dayIndex] += durationMinutes;
            }
        });

        // Convert to hours with 1 decimal
        const dailyHours = dailyMinutes.map(mins => Math.round(mins / 6) / 10); // Round to 0.1h

        return {
            labels: DAY_NAMES,
            data: dailyHours,
            totalHours: dailyHours.reduce((a, b) => a + b, 0).toFixed(1)
        };
    }

    // --- Render Study Hours Chart ---
    function renderStudyHoursChart(canvasId = 'studyHoursChart') {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn('Study hours chart canvas not found:', canvasId);
            return null;
        }

        const ctx = canvas.getContext('2d');
        const colors = getThemeColors();
        const weeklyData = getWeeklyStudyHoursByDay();

        // Destroy existing chart if it exists
        if (studyHoursChartInstance) {
            studyHoursChartInstance.destroy();
            studyHoursChartInstance = null;
        }

        // Create gradient using accent color
        const accentRgb = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim() || '59, 130, 246';
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, `rgba(${accentRgb}, 0.4)`);
        gradient.addColorStop(1, `rgba(${accentRgb}, 0.05)`);

        studyHoursChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: weeklyData.labels,
                datasets: [{
                    label: 'Study Hours',
                    data: weeklyData.data,
                    backgroundColor: gradient,
                    borderColor: colors.primary,
                    borderWidth: 2,
                    borderRadius: 6,
                    borderSkipped: false,
                    hoverBackgroundColor: colors.primary,
                    hoverBorderColor: colors.primary
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: colors.background,
                        titleColor: colors.text,
                        bodyColor: colors.text,
                        borderColor: colors.primary,
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                const hours = context.raw;
                                if (hours === 0) return 'No study time';
                                return `${hours} hour${hours !== 1 ? 's' : ''}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: colors.textMuted,
                            font: {
                                family: 'Jost',
                                size: 12
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: colors.grid,
                            drawBorder: false
                        },
                        ticks: {
                            color: colors.textMuted,
                            font: {
                                family: 'Jost',
                                size: 11
                            },
                            callback: function(value) {
                                return value + 'h';
                            },
                            stepSize: 1
                        }
                    }
                }
            }
        });

        return studyHoursChartInstance;
    }

    // --- Render Score History Chart (mini trend line) ---
    async function renderScoreHistoryChart(canvasId = 'scoreHistoryChart') {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        const ctx = canvas.getContext('2d');
        const colors = getThemeColors();

        // Get history from ProductivityScore module
        let history = [];
        if (typeof ProductivityScore !== 'undefined') {
            history = await ProductivityScore.loadWeeklyStatsHistory(6);
        }

        // Add current week if not in history
        if (typeof ProductivityScore !== 'undefined') {
            const currentScore = ProductivityScore.calculate();
            const currentWeekId = ProductivityScore.getWeekId();
            
            if (!history.find(h => h.id === currentWeekId)) {
                history.push({
                    id: currentWeekId,
                    productivityScore: currentScore.score
                });
            }
        }

        // Destroy existing chart
        if (scoreHistoryChartInstance) {
            scoreHistoryChartInstance.destroy();
            scoreHistoryChartInstance = null;
        }

        if (history.length === 0) {
            return null;
        }

        const labels = history.map(h => {
            const weekStr = h.id.replace(/^\d{4}-W/, '');
            return `week ${weekStr}`; // Show week 01, week 02, etc.
        });
        const data = history.map(h => h.productivityScore);

        // Create gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, 'rgba(34, 197, 94, 0.3)');
        gradient.addColorStop(1, 'rgba(34, 197, 94, 0.05)');

        scoreHistoryChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Score',
                    data: data,
                    borderColor: colors.success,
                    backgroundColor: gradient,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: colors.success,
                    pointBorderColor: colors.background,
                    pointBorderWidth: 2,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: colors.background,
                        titleColor: colors.text,
                        bodyColor: colors.text,
                        borderColor: colors.success,
                        borderWidth: 1,
                        padding: 10,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return `Score: ${context.raw}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: colors.textMuted,
                            font: {
                                family: 'Jost',
                                size: 10
                            }
                        }
                    },
                    y: {
                        min: 0,
                        max: 100,
                        grid: {
                            color: colors.grid,
                            drawBorder: false
                        },
                        ticks: {
                            color: colors.textMuted,
                            font: {
                                family: 'Jost',
                                size: 10
                            },
                            stepSize: 25
                        }
                    }
                }
            }
        });

        return scoreHistoryChartInstance;
    }

    // --- Refresh All Charts (e.g., on theme change) ---
    function refreshCharts() {
        if (studyHoursChartInstance) {
            renderStudyHoursChart();
        }
        if (scoreHistoryChartInstance) {
            renderScoreHistoryChart();
        }
    }

    // --- Destroy All Charts ---
    function destroyCharts() {
        if (studyHoursChartInstance) {
            studyHoursChartInstance.destroy();
            studyHoursChartInstance = null;
        }
        if (scoreHistoryChartInstance) {
            scoreHistoryChartInstance.destroy();
            scoreHistoryChartInstance = null;
        }
    }

    // --- Get Study Data for External Use ---
    function getStudyDataSummary() {
        const weeklyData = getWeeklyStudyHoursByDay();
        const maxDay = weeklyData.data.indexOf(Math.max(...weeklyData.data));
        const minDay = weeklyData.data.indexOf(Math.min(...weeklyData.data.filter(h => h > 0)));

        return {
            ...weeklyData,
            mostProductiveDay: weeklyData.data[maxDay] > 0 ? DAY_NAMES_FULL[maxDay] : null,
            leastProductiveDay: minDay >= 0 ? DAY_NAMES_FULL[minDay] : null,
            avgHoursPerDay: (parseFloat(weeklyData.totalHours) / 7).toFixed(1)
        };
    }

    // --- Public API ---
    return {
        renderStudyHoursChart,
        renderScoreHistoryChart,
        refreshCharts,
        destroyCharts,
        getWeeklyStudyHoursByDay,
        getStudyDataSummary
    };
})();

// Make available globally
if (typeof window !== 'undefined') {
    window.AnalyticsCharts = AnalyticsCharts;

    // Auto-refresh charts when theme or accent color changes
    window.addEventListener('themeChanged', () => {
        setTimeout(() => AnalyticsCharts.refreshCharts(), 50);
    });
}
