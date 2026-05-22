// ===== FOCUS BLOCKER ANALYTICS MODULE =====
// Displays focus blocker performance analytics

const FocusBlockerAnalytics = (function() {
    'use strict';

    let focusScoreChart = null;
    let blockedAttemptsChart = null;

    // Initialize
    function init() {
        setupEventListeners();
        
        // Load data when analytics tab is opened
        const analyticsTab = document.querySelector('[data-tab="analytics"]');
        if (analyticsTab) {
            analyticsTab.addEventListener('click', () => {
                setTimeout(loadAnalytics, 300);
            });
        }

        // Also check if already on analytics tab
        if (isAnalyticsTabActive()) {
            setTimeout(loadAnalytics, 500);
        }
    }

    // Setup event listeners
    function setupEventListeners() {
        const refreshBtn = document.getElementById('focusBlockerAnalyticsRefresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                loadAnalytics();
                if (typeof Notify !== 'undefined') {
                    Notify.info('Analytics refreshed');
                }
            });
        }
    }

    // Check if analytics tab is active
    function isAnalyticsTabActive() {
        const analyticsTab = document.getElementById('analytics-tab');
        return analyticsTab && analyticsTab.classList.contains('active');
    }

    // Load analytics
    function loadAnalytics() {
        if (!window.FocusBlocker) {
            showNoDataState();
            return;
        }

        try {
            renderSummaryStats();
            renderFocusScoreChart();
            renderBlockedAttemptsChart();
            renderTopBlockedItems();
        } catch (error) {
            console.error('Error loading focus blocker analytics:', error);
        }
    }

    // Render summary stats
    function renderSummaryStats() {
        const container = document.getElementById('focusBlockerSummary');
        if (!container) return;

        const totalStats = FocusBlocker.getTotalStats();
        const sessionStats = FocusBlocker.getSessionStats();

        const stats = [
            {
                icon: 'fa-calendar-check',
                label: 'Total Sessions',
                value: totalStats.totalSessions || 0,
                color: '#6366f1'
            },
            {
                icon: 'fa-ban',
                label: 'Total Blocked',
                value: totalStats.totalAttempts || 0,
                color: '#ef4444'
            },
            {
                icon: 'fa-trophy',
                label: 'Avg Focus Score',
                value: Math.round(totalStats.averageFocusScore || 100),
                color: '#22c55e',
                suffix: '%'
            },
            {
                icon: 'fa-check-circle',
                label: 'Completion Rate',
                value: Math.round((totalStats.completionRate || 0) * 100),
                color: '#8b5cf6',
                suffix: '%'
            }
        ];

        container.innerHTML = stats.map(stat => `
            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 32px; height: 32px; border-radius: 8px; background: ${stat.color}15; display: flex; align-items: center; justify-content: center;">
                        <i class="fa-solid ${stat.icon}" style="font-size: 14px; color: ${stat.color};"></i>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-size: 20px; font-weight: 700; color: var(--text-primary); line-height: 1;">${stat.value}${stat.suffix || ''}</div>
                        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">${stat.label}</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Render focus score chart
    function renderFocusScoreChart() {
        const canvas = document.getElementById('focusScoreChart');
        if (!canvas) return;

        // Get last 10 sessions
        const history = getSessionHistory().slice(-10);
        
        if (history.length === 0) {
            canvas.parentElement.innerHTML = `
                <h4 style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 0 0 12px 0;">Focus Score Trend</h4>
                <div style="text-align: center; padding: 40px; color: var(--text-secondary); font-size: 13px;">
                    <i class="fa-solid fa-chart-line" style="font-size: 32px; opacity: 0.3; margin-bottom: 12px; display: block;"></i>
                    No session data yet
                </div>
            `;
            return;
        }

        const ctx = canvas.getContext('2d');

        // Destroy existing chart
        if (focusScoreChart) {
            focusScoreChart.destroy();
        }

        // Prepare data
        const labels = history.map((session, index) => `Session ${index + 1}`);
        const scores = history.map(session => session.focusScore);

        // Create chart
        focusScoreChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Focus Score',
                    data: scores,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#6366f1'
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
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        titleFont: {
                            size: 13,
                            weight: 'bold'
                        },
                        bodyFont: {
                            size: 12
                        },
                        callbacks: {
                            label: function(context) {
                                return 'Score: ' + context.parsed.y + '%';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            },
                            color: getComputedStyle(document.body).getPropertyValue('--text-secondary'),
                            font: {
                                size: 11
                            }
                        },
                        grid: {
                            color: 'rgba(148, 163, 184, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: getComputedStyle(document.body).getPropertyValue('--text-secondary'),
                            font: {
                                size: 11
                            }
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    // Render blocked attempts chart
    function renderBlockedAttemptsChart() {
        const canvas = document.getElementById('blockedAttemptsChart');
        if (!canvas) return;

        // Get last 10 sessions
        const history = getSessionHistory().slice(-10);
        
        if (history.length === 0) {
            canvas.parentElement.innerHTML = `
                <h4 style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 0 0 12px 0;">Distraction Attempts</h4>
                <div style="text-align: center; padding: 40px; color: var(--text-secondary); font-size: 13px;">
                    <i class="fa-solid fa-chart-bar" style="font-size: 32px; opacity: 0.3; margin-bottom: 12px; display: block;"></i>
                    No session data yet
                </div>
            `;
            return;
        }

        const ctx = canvas.getContext('2d');

        // Destroy existing chart
        if (blockedAttemptsChart) {
            blockedAttemptsChart.destroy();
        }

        // Prepare data
        const labels = history.map((session, index) => `Session ${index + 1}`);
        const attempts = history.map(session => session.distractionAttempts);

        // Create chart
        blockedAttemptsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Blocked Attempts',
                    data: attempts,
                    backgroundColor: 'rgba(239, 68, 68, 0.7)',
                    borderColor: '#ef4444',
                    borderWidth: 1,
                    borderRadius: 6
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
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        titleFont: {
                            size: 13,
                            weight: 'bold'
                        },
                        bodyFont: {
                            size: 12
                        },
                        callbacks: {
                            label: function(context) {
                                return 'Attempts: ' + context.parsed.y;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            color: getComputedStyle(document.body).getPropertyValue('--text-secondary'),
                            font: {
                                size: 11
                            }
                        },
                        grid: {
                            color: 'rgba(148, 163, 184, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: getComputedStyle(document.body).getPropertyValue('--text-secondary'),
                            font: {
                                size: 11
                            }
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    // Render top blocked items
    function renderTopBlockedItems() {
        renderTopBlockedWebsites();
        renderTopBlockedApps();
    }

    // Render top blocked websites
    function renderTopBlockedWebsites() {
        const container = document.getElementById('topBlockedWebsites');
        if (!container) return;

        const history = getSessionHistory();
        const websiteCounts = {};

        // Count blocked websites across all sessions
        history.forEach(session => {
            if (session.blockedWebsites) {
                session.blockedWebsites.forEach(website => {
                    websiteCounts[website] = (websiteCounts[website] || 0) + 1;
                });
            }
        });

        // Sort and get top 5
        const topWebsites = Object.entries(websiteCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        if (topWebsites.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 20px 0; color: var(--text-secondary); font-size: 12px;">
                    No data yet
                </div>
            `;
            return;
        }

        const maxCount = topWebsites[0][1];

        container.innerHTML = topWebsites.map(([website, count]) => {
            const percentage = (count / maxCount) * 100;
            return `
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <span style="font-size: 12px; color: var(--text-primary); font-weight: 500;">${escapeHtml(website)}</span>
                        <span style="font-size: 11px; color: var(--text-secondary); font-weight: 600;">${count}</span>
                    </div>
                    <div style="height: 6px; background: var(--border-color); border-radius: 3px; overflow: hidden;">
                        <div style="height: 100%; background: linear-gradient(90deg, #ef4444, #f87171); border-radius: 3px; width: ${percentage}%;"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Render top blocked apps
    function renderTopBlockedApps() {
        const container = document.getElementById('topBlockedApps');
        if (!container) return;

        const history = getSessionHistory();
        const appCounts = {};

        // Count blocked apps across all sessions
        history.forEach(session => {
            if (session.blockedApps) {
                session.blockedApps.forEach(app => {
                    appCounts[app] = (appCounts[app] || 0) + 1;
                });
            }
        });

        // Sort and get top 5
        const topApps = Object.entries(appCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        if (topApps.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 20px 0; color: var(--text-secondary); font-size: 12px;">
                    No data yet
                </div>
            `;
            return;
        }

        const maxCount = topApps[0][1];

        container.innerHTML = topApps.map(([app, count]) => {
            const percentage = (count / maxCount) * 100;
            const appName = getAppDisplayName(app);
            return `
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <span style="font-size: 12px; color: var(--text-primary); font-weight: 500;">${escapeHtml(appName)}</span>
                        <span style="font-size: 11px; color: var(--text-secondary); font-weight: 600;">${count}</span>
                    </div>
                    <div style="height: 6px; background: var(--border-color); border-radius: 3px; overflow: hidden;">
                        <div style="height: 100%; background: linear-gradient(90deg, #8b5cf6, #a78bfa); border-radius: 3px; width: ${percentage}%;"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Get session history
    function getSessionHistory() {
        try {
            const saved = localStorage.getItem('focusBlocker_sessionStats');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    }

    // Get app display name
    function getAppDisplayName(packageName) {
        const knownApps = {
            'com.instagram.android': 'Instagram',
            'com.facebook.katana': 'Facebook',
            'com.twitter.android': 'Twitter',
            'com.reddit.frontpage': 'Reddit',
            'com.google.android.youtube': 'YouTube',
            'com.netflix.mediaclient': 'Netflix',
            'tv.twitch.android.app': 'Twitch',
            'com.discord': 'Discord',
            'com.pinterest': 'Pinterest',
            'com.snapchat.android': 'Snapchat',
            'com.tiktok.android': 'TikTok'
        };

        return knownApps[packageName] || packageName.split('.').pop();
    }

    // Show no data state
    function showNoDataState() {
        const container = document.getElementById('focusBlockerSummary');
        if (container) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-secondary);">
                    <i class="fa-solid fa-chart-pie" style="font-size: 48px; opacity: 0.2; margin-bottom: 16px; display: block;"></i>
                    <p style="font-size: 14px; margin: 0;">Focus Blocker not available</p>
                    <p style="font-size: 12px; margin: 8px 0 0 0; opacity: 0.7;">Start a focus session to see analytics</p>
                </div>
            `;
        }
    }

    // Escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Public API
    return {
        init,
        loadAnalytics
    };
})();

// NOTE: No auto-initialization - controlled by StartupManager Phase 3 (lazy loading)
// Focus Blocker Analytics loads only when needed for optimal startup performance
