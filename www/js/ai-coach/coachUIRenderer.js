// ===== AI COACH UI RENDERER MODULE =====
// Renders AI Coach dashboard and all insights in the UI
// Provides interactive visualizations and actionable recommendations

const CoachUIRenderer = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    const CONFIG = {
        CONTAINER_ID: 'aiCoachDashboard',
        REFRESH_INTERVAL: 300000, // 5 minutes
        
        PRIORITY_COLORS: {
            critical: '#ef4444',
            high: '#f59e0b',
            medium: '#3b82f6',
            low: '#10b981'
        },
        
        PRIORITY_ICONS: {
            critical: '<i class="fa-solid fa-circle-exclamation"></i>',
            high: '<i class="fa-solid fa-triangle-exclamation"></i>',
            medium: '<i class="fa-solid fa-circle-info"></i>',
            low: '<i class="fa-solid fa-sparkles"></i>'
        }
    };

    let isInitialized = false;
    let refreshTimer = null;

    // ===== INITIALIZATION =====
    function init() {
        if (isInitialized) return;
        console.log('🎨 AI Coach UI Renderer initialized');
        
        // Listen for AI coach updates
        document.addEventListener('aiCoachUpdated', (event) => {
            console.log('🔄 AI Coach data updated, refreshing UI');
            // Only render if we're currently on the ai-coach tab to avoid double renders
            const aiCoachTab = document.getElementById('ai-coach-tab');
            if (aiCoachTab && aiCoachTab.classList.contains('active')) {
                renderDashboard();
            }
        });
        
        // Listen for calculation start
        document.addEventListener('aiCoachCalculating', (event) => {
            console.log('⏳ AI Coach calculation started');
            const aiCoachTab = document.getElementById('ai-coach-tab');
            if (aiCoachTab && aiCoachTab.classList.contains('active')) {
                showLoadingState();
            }
        });
        
        // Listen for errors
        document.addEventListener('aiCoachError', (event) => {
            console.error('❌ AI Coach error:', event.detail);
            const aiCoachTab = document.getElementById('ai-coach-tab');
            if (aiCoachTab && aiCoachTab.classList.contains('active')) {
                showErrorState(event.detail.error);
            }
        });
        
        // Set up auto-refresh
        setupAutoRefresh();
        
        isInitialized = true;
    }

    function setupAutoRefresh() {
        if (refreshTimer) clearInterval(refreshTimer);
        
        refreshTimer = setInterval(() => {
            if (document.getElementById(CONFIG.CONTAINER_ID)) {
                console.log('🔄 Auto-refreshing AI Coach dashboard');
                AICoachEngine.recalculateInsights('auto_refresh');
            }
        }, CONFIG.REFRESH_INTERVAL);
    }

    // ===== UI STATE FUNCTIONS =====
    
    /**
     * Show skeleton loading state
     */
    function showLoadingState() {
        const container = document.getElementById(CONFIG.CONTAINER_ID);
        if (!container) return;
        
        container.innerHTML = `
            <div class="ai-coach-dashboard">
                <div class="ai-coach-loading">
                    <i class="fa-solid fa-spinner fa-spin"></i>
                    <p>Generating personalized insights...</p>
                </div>
                
                <div class="ai-coach-grid">
                    ${generateSkeletonCard()}
                    ${generateSkeletonCard()}
                    ${generateSkeletonCard()}
                    ${generateSkeletonCard()}
                </div>
            </div>
        `;
    }
    
    /**
     * Generate skeleton loading card
     * @returns {string} Skeleton HTML
     */
    function generateSkeletonCard() {
        return `
            <div class="ai-coach-skeleton-card">
                <div class="ai-coach-skeleton ai-coach-skeleton-header"></div>
                <div class="ai-coach-skeleton ai-coach-skeleton-text"></div>
                <div class="ai-coach-skeleton ai-coach-skeleton-text"></div>
                <div class="ai-coach-skeleton ai-coach-skeleton-text"></div>
            </div>
        `;
    }
    
    /**
     * Show error state
     * @param {string} errorMessage - Error message to display
     */
    function showErrorState(errorMessage) {
        const container = document.getElementById(CONFIG.CONTAINER_ID);
        if (!container) return;
        
        container.innerHTML = `
            <div class="ai-coach-dashboard">
                <div class="ai-coach-card">
                    <div class="ai-coach-empty">
                        <i class="fa-solid fa-triangle-exclamation" style="color: #ef4444;"></i>
                        <p style="color: #ef4444; font-weight: 600;">Error loading AI insights</p>
                        <p style="margin-top: 8px;">${errorMessage || 'Unable to analyze your study data'}</p>
                        <button 
                            onclick="CoachUIRenderer.refreshData()" 
                            style="margin-top: 16px; padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                            <i class="fa-solid fa-rotate"></i> Try Again
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // ===== HELPER FUNCTIONS =====
    
    function formatDate(date) {
        return new Date(date).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
    }

    function getPriorityColor(priority) {
        return CONFIG.PRIORITY_COLORS[priority] || CONFIG.PRIORITY_COLORS.low;
    }

    function getPriorityIcon(priority) {
        return CONFIG.PRIORITY_ICONS[priority] || CONFIG.PRIORITY_ICONS.low;
    }

    // ===== RENDERING FUNCTIONS =====
    
    /**
     * Render performance summary card
     * @param {Object} insights - Behavior insights
     * @returns {string} HTML
     */
    function renderPerformanceSummary(insights) {
        if (!insights) return '';

        const studyHours = insights.weeklyStudyHours || 0;
        const taskRate = insights.taskCompletion?.percentage || 0;
        const focusRate = insights.focusSuccess?.percentage || 0;
        const habitScore = Math.round((insights.habitConsistency?.score || 0) * 100);

        return `
            <div class="ai-coach-card performance-summary">
                <div class="ai-coach-card-header">
                    <h3><i class="fa-solid fa-chart-bar"></i> Weekly Performance</h3>
                    <button class="ai-coach-refresh-btn" onclick="CoachUIRenderer.refreshData()" 
                            aria-label="Refresh AI Coach data" 
                            title="Refresh insights">
                        <i class="fa-solid fa-rotate"></i>
                    </button>
                </div>
                <div class="ai-coach-metrics-grid">
                    <div class="ai-coach-metric" role="button" tabindex="0" 
                         title="Total hours spent studying this week">
                        <div class="ai-coach-metric-icon"><i class="fa-solid fa-book"></i></div>
                        <div class="ai-coach-metric-value">${studyHours}h</div>
                        <div class="ai-coach-metric-label">Study Hours</div>
                    </div>
                    <div class="ai-coach-metric" role="button" tabindex="0" 
                         title="Percentage of tasks completed">
                        <div class="ai-coach-metric-icon"><i class="fa-solid fa-check-circle"></i></div>
                        <div class="ai-coach-metric-value">${taskRate}%</div>
                        <div class="ai-coach-metric-label">Tasks Done</div>
                    </div>
                    <div class="ai-coach-metric" role="button" tabindex="0" 
                         title="Focus session success rate">
                        <div class="ai-coach-metric-icon"><i class="fa-solid fa-bullseye"></i></div>
                        <div class="ai-coach-metric-value">${focusRate}%</div>
                        <div class="ai-coach-metric-label">Focus Success</div>
                    </div>
                    <div class="ai-coach-metric" role="button" tabindex="0" 
                         title="Study habit consistency score">
                        <div class="ai-coach-metric-icon"><i class="fa-solid fa-fire"></i></div>
                        <div class="ai-coach-metric-value">${habitScore}%</div>
                        <div class="ai-coach-metric-label">Consistency</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render recommendations card
     * @param {Array} recommendations - Recommendations array
     * @returns {string} HTML
     */
    function renderRecommendations(recommendations) {
        if (!recommendations || recommendations.length === 0) {
            return `
                <div class="ai-coach-card">
                    <div class="ai-coach-card-header">
                        <h3><i class="fa-solid fa-lightbulb"></i> AI Recommendations</h3>
                    </div>
                    <div class="ai-coach-empty">
                        <i class="fa-solid fa-check-circle"></i>
                        <p>Great job! No urgent recommendations right now.</p>
                    </div>
                </div>
            `;
        }

        const recommendationHTML = recommendations.map(rec => `
            <div class="ai-coach-recommendation" data-priority="${rec.priority}">
                <div class="ai-coach-rec-icon">${rec.icon}</div>
                <div class="ai-coach-rec-content">
                    <div class="ai-coach-rec-header">
                        <h4>${rec.title}</h4>
                        <span class="ai-coach-priority-badge" style="background: ${getPriorityColor(rec.priority)}">
                            ${rec.priority}
                        </span>
                    </div>
                    <p class="ai-coach-rec-message">${rec.message}</p>
                    <p class="ai-coach-rec-action"><strong>Action:</strong> ${rec.action}</p>
                </div>
            </div>
        `).join('');

        return `
            <div class="ai-coach-card">
                <div class="ai-coach-card-header">
                    <h3><i class="fa-solid fa-lightbulb"></i> AI Recommendations</h3>
                    <span class="ai-coach-badge">${recommendations.length}</span>
                </div>
                <div class="ai-coach-recommendations-list">
                    ${recommendationHTML}
                </div>
            </div>
        `;
    }

    /**
     * Render predictions card
     * @param {Object} predictions - Predictions object
     * @returns {string} HTML
     */
    function renderPredictions(predictions) {
        if (!predictions) return '';

        const studyHours = predictions.studyHours || {};
        const focusSuccess = predictions.focusSuccess || {};
        const taskCompletion = predictions.taskCompletion || {};
        const productiveDays = predictions.productiveDays || {};

        return `
            <div class="ai-coach-card">
                <div class="ai-coach-card-header">
                    <h3><i class="fa-solid fa-crystal-ball"></i> AI Predictions</h3>
                </div>
                
                <div class="ai-coach-prediction-group">
                    <div class="ai-coach-prediction">
                        <div class="ai-coach-pred-icon"><i class="fa-solid fa-book"></i></div>
                        <div class="ai-coach-pred-content">
                            <h4>Expected Study Hours Next Week</h4>
                            <div class="ai-coach-pred-value">${studyHours.expectedHours || 0}h</div>
                            <p class="ai-coach-pred-detail">${studyHours.message || ''}</p>
                            <div class="ai-coach-confidence">
                                <span class="ai-coach-confidence-badge confidence-${studyHours.confidence?.level || 'low'}">
                                    Confidence: ${studyHours.confidence?.level || 'low'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="ai-coach-prediction">
                        <div class="ai-coach-pred-icon"><i class="fa-solid fa-bullseye"></i></div>
                        <div class="ai-coach-pred-content">
                            <h4>Focus Success Probability</h4>
                            <div class="ai-coach-pred-value">${focusSuccess.probability || 0}%</div>
                            <p class="ai-coach-pred-detail">${focusSuccess.message || ''}</p>
                        </div>
                    </div>

                    <div class="ai-coach-prediction">
                        <div class="ai-coach-pred-icon"><i class="fa-solid fa-check-circle"></i></div>
                        <div class="ai-coach-pred-content">
                            <h4>Task Completion Likelihood</h4>
                            <div class="ai-coach-pred-value">${taskCompletion.likelihood || 0}%</div>
                            <p class="ai-coach-pred-detail">${taskCompletion.message || ''}</p>
                        </div>
                    </div>

                    ${productiveDays.mostProductiveDay ? `
                    <div class="ai-coach-prediction">
                        <div class="ai-coach-pred-icon"><i class="fa-solid fa-calendar-days"></i></div>
                        <div class="ai-coach-pred-content">
                            <h4>Most Productive Day</h4>
                            <div class="ai-coach-pred-value">${productiveDays.mostProductiveDay}</div>
                            <p class="ai-coach-pred-detail">${productiveDays.message || ''}</p>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Render study patterns card
     * @param {Object} patterns - Study patterns object
     * @returns {string} HTML
     */
    function renderPatterns(patterns) {
        if (!patterns) return '';

        const timePattern = patterns.timePatterns || {};
        const durationPattern = patterns.durationPatterns || {};
        const consistencyPattern = patterns.consistencyPatterns || {};
        const streakPattern = patterns.streakPatterns || {};

        return `
            <div class="ai-coach-card">
                <div class="ai-coach-card-header">
                    <h3><i class="fa-solid fa-chart-line"></i> Study Patterns</h3>
                </div>
                
                <div class="ai-coach-pattern-list">
                    ${timePattern.hasPattern ? `
                    <div class="ai-coach-pattern">
                        <div class="ai-coach-pattern-icon"><i class="fa-solid fa-clock"></i></div>
                        <div class="ai-coach-pattern-content">
                            <h4>Best Study Time</h4>
                            <p class="ai-coach-pattern-value">${timePattern.mostProductiveTime}</p>
                            <p class="ai-coach-pattern-detail">${timePattern.message}</p>
                            <p class="ai-coach-pattern-rec"><strong>Tip:</strong> ${timePattern.recommendation}</p>
                        </div>
                    </div>
                    ` : ''}

                    ${durationPattern.hasPattern ? `
                    <div class="ai-coach-pattern">
                        <div class="ai-coach-pattern-icon"><i class="fa-solid fa-stopwatch"></i></div>
                        <div class="ai-coach-pattern-content">
                            <h4>Optimal Session Length</h4>
                            <p class="ai-coach-pattern-value">${durationPattern.optimalRange}</p>
                            <p class="ai-coach-pattern-detail">${durationPattern.message}</p>
                            <p class="ai-coach-pattern-rec"><strong>Tip:</strong> ${durationPattern.recommendation}</p>
                        </div>
                    </div>
                    ` : ''}

                    ${consistencyPattern.hasPattern ? `
                    <div class="ai-coach-pattern">
                        <div class="ai-coach-pattern-icon"><i class="fa-solid fa-calendar-days"></i></div>
                        <div class="ai-coach-pattern-content">
                            <h4>Weekly Consistency</h4>
                            <p class="ai-coach-pattern-value">${consistencyPattern.consistencyLevel} (${consistencyPattern.consistencyScore}%)</p>
                            <p class="ai-coach-pattern-detail">${consistencyPattern.message}</p>
                            <p class="ai-coach-pattern-rec"><strong>Tip:</strong> ${consistencyPattern.recommendation}</p>
                        </div>
                    </div>
                    ` : ''}

                    <div class="ai-coach-pattern">
                        <div class="ai-coach-pattern-icon"><i class="fa-solid fa-fire"></i></div>
                        <div class="ai-coach-pattern-content">
                            <h4>Study Streak</h4>
                            <p class="ai-coach-pattern-value">
                                Current: ${streakPattern.currentStreak} days | Best: ${streakPattern.longestStreak} days
                            </p>
                            <p class="ai-coach-pattern-detail">${streakPattern.message}</p>
                            <p class="ai-coach-pattern-rec"><strong>Tip:</strong> ${streakPattern.recommendation}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render weak subjects alert card
     * @param {Object} weakSubjects - Weak subjects detection
     * @returns {string} HTML
     */
    function renderWeakSubjects(weakSubjects) {
        if (!weakSubjects || !weakSubjects.weakSubjects || weakSubjects.weakSubjects.length === 0) {
            return `
                <div class="ai-coach-card">
                    <div class="ai-coach-card-header">
                        <h3><i class="fa-solid fa-book-open"></i> Subject Analysis</h3>
                    </div>
                    <div class="ai-coach-empty">
                        <i class="fa-solid fa-check-circle"></i>
                        <p>All subjects are getting adequate attention!</p>
                    </div>
                </div>
            `;
        }

        const subjectsHTML = weakSubjects.weakSubjects.slice(0, 5).map(subject => `
            <div class="ai-coach-weak-subject" data-priority="${subject.priority}">
                <div class="ai-coach-ws-header">
                    <div class="ai-coach-ws-name" style="border-left: 4px solid ${subject.subjectColor}">
                        ${subject.subjectName}
                    </div>
                    <span class="ai-coach-priority-badge" style="background: ${getPriorityColor(subject.priority)}">
                        ${getPriorityIcon(subject.priority)} ${subject.priority}
                    </span>
                </div>
                <div class="ai-coach-ws-stats">
                    <div class="ai-coach-ws-stat">
                        <span class="ai-coach-ws-label">Expected:</span>
                        <span class="ai-coach-ws-value">${subject.expectedMinutes}min</span>
                    </div>
                    <div class="ai-coach-ws-stat">
                        <span class="ai-coach-ws-label">Actual:</span>
                        <span class="ai-coach-ws-value">${subject.actualMinutes}min</span>
                    </div>
                    <div class="ai-coach-ws-stat">
                        <span class="ai-coach-ws-label">Deficit:</span>
                        <span class="ai-coach-ws-value deficit">${subject.deficitHours}h</span>
                    </div>
                </div>
                <div class="ai-coach-ws-progress">
                    <div class="ai-coach-progress-bar">
                        <div class="ai-coach-progress-fill" 
                             style="width: ${subject.percentage}%; background: ${subject.subjectColor}">
                        </div>
                    </div>
                    <span class="ai-coach-ws-percentage">${subject.percentage}% complete</span>
                </div>
            </div>
        `).join('');

        return `
            <div class="ai-coach-card">
                <div class="ai-coach-card-header">
                    <h3><i class="fa-solid fa-triangle-exclamation"></i> Subjects Need Attention</h3>
                    <span class="ai-coach-badge">${weakSubjects.weakSubjects.length}</span>
                </div>
                <div class="ai-coach-weak-subjects-list">
                    ${subjectsHTML}
                </div>
            </div>
        `;
    }

    /**
     * Render motivation messages card
     * @param {Array} motivation - Motivation messages
     * @returns {string} HTML
     */
    function renderMotivation(motivation) {
        if (!motivation || motivation.length === 0) return '';

        const messagesHTML = motivation.map(msg => `
            <div class="ai-coach-motivation-message">
                <div class="ai-coach-msg-icon">${msg.icon}</div>
                <p class="ai-coach-msg-text">${msg.message}</p>
            </div>
        `).join('');

        return `
            <div class="ai-coach-card motivation-card">
                <div class="ai-coach-card-header">
                    <h3><i class="fa-solid fa-star"></i> Motivation</h3>
                </div>
                <div class="ai-coach-motivation-list">
                    ${messagesHTML}
                </div>
            </div>
        `;
    }

    /**
     * Render exam preparation card
     * @param {Object} examAdvice - Exam preparation advice
     * @returns {string} HTML
     */
    function renderExamPreparation(examAdvice) {
        if (!examAdvice || !examAdvice.upcomingExams || examAdvice.upcomingExams.length === 0) {
            return '';
        }

        const examsHTML = examAdvice.upcomingExams.slice(0, 3).map(exam => {
            const urgencyClass = exam.daysUntil <= 3 ? 'urgent' : exam.daysUntil <= 7 ? 'high' : 'medium';
            
            return `
            <div class="ai-coach-exam ${urgencyClass}">
                <div class="ai-coach-exam-header">
                    <h4>${exam.examName}</h4>
                    <span class="ai-coach-exam-countdown">${exam.daysUntil === 0 ? 'TODAY' : exam.daysUntil === 1 ? 'TOMORROW' : exam.daysUntil + ' days'}</span>
                </div>
                <div class="ai-coach-exam-subject">${exam.subjectName}</div>
                <div class="ai-coach-exam-strategy">
                    <strong>${exam.phase}:</strong> ${exam.focus}
                </div>
                <div class="ai-coach-exam-readiness">
                    <span class="ai-coach-readiness-label">Readiness:</span>
                    <div class="ai-coach-readiness-bar">
                        <div class="ai-coach-readiness-fill" 
                             style="width: ${exam.readiness.score}%; background: ${exam.readiness.score >= 80 ? '#10b981' : exam.readiness.score >= 60 ? '#3b82f6' : '#f59e0b'}">
                        </div>
                    </div>
                    <span class="ai-coach-readiness-score">${exam.readiness.level}</span>
                </div>
                <ul class="ai-coach-exam-tips">
                    ${exam.tips.slice(0, 2).map(tip => `<li>${tip}</li>`).join('')}
                </ul>
            </div>
            `;
        }).join('');

        return `
            <div class="ai-coach-card">
                <div class="ai-coach-card-header">
                    <h3><i class="fa-solid fa-graduation-cap"></i> Exam Preparation</h3>
                    <span class="ai-coach-badge">${examAdvice.upcomingExams.length}</span>
                </div>
                <div class="ai-coach-exams-list">
                    ${examsHTML}
                </div>
            </div>
        `;
    }

    // ===== MAIN RENDER FUNCTION =====
    
    /**
     * Render complete AI Coach dashboard
     */
    function renderDashboard() {
        console.log('🎨 Rendering AI Coach dashboard...');
        
        const container = document.getElementById(CONFIG.CONTAINER_ID);
        if (!container) {
            console.error('❌ AI Coach dashboard container not found');
            return;
        }

        // Get AI coach data
        const coachData = AICoachEngine.getCoachData();
        
        if (!coachData || !coachData.lastUpdate) {
            // No data yet - trigger calculation and show loading
            showLoadingState();
            AICoachEngine.recalculateInsights('initial_load');
            return;
        }

        // Build dashboard HTML only; the page title lives in the tab header now.
        const dashboardHTML = `
            <div class="ai-coach-dashboard" role="main" aria-label="AI Study Coach Dashboard">
                <div class="ai-coach-grid" role="region" aria-label="AI Coach Insights">
                    ${renderPerformanceSummary(coachData.insights)}
                    ${renderMotivation(coachData.motivation)}
                    ${renderRecommendations(coachData.recommendations)}
                    ${renderExamPreparation(coachData.examAdvice)}
                    ${renderWeakSubjects(coachData.weakSubjects)}
                    ${renderPredictions(coachData.predictions)}
                    ${renderPatterns(coachData.patterns)}
                </div>

                <div class="ai-coach-footer">
                    <p class="ai-coach-updated">Last updated: ${new Date(coachData.lastUpdate).toLocaleString()}</p>
                </div>
            </div>
        `;

        container.innerHTML = dashboardHTML;
        console.log('✅ AI Coach dashboard rendered');
        
        // Add intersection observer for card animations
        setupIntersectionObserver();
    }
    
    /**
     * Setup intersection observer for lazy animations
     */
    function setupIntersectionObserver() {
        if (!window.IntersectionObserver) return;
        
        const options = {
            root: null,
            rootMargin: '0px',
            threshold: 0.1
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                    observer.unobserve(entry.target);
                }
            });
        }, options);
        
        // Observe all cards
        const cards = document.querySelectorAll('.ai-coach-card');
        cards.forEach(card => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(card);
        });
    }

    /**
     * Refresh AI coach data and re-render
     */
    async function refreshData() {
        console.log('🔄 Manually refreshing AI Coach data...');
        showLoadingState();
        try {
            await AICoachEngine.recalculateInsights('manual_refresh');
            // renderDashboard will be called by the event listener
        } catch (error) {
            console.error('❌ Error refreshing data:', error);
            showErrorState(error.message);
        }
    }

    // ===== PUBLIC API =====
    return {
        init,
        renderDashboard,
        refreshData,
        
        // Expose individual renderers for custom implementations
        renderPerformanceSummary,
        renderRecommendations,
        renderPredictions,
        renderPatterns,
        renderWeakSubjects,
        renderMotivation,
        renderExamPreparation
    };
})();

// NOTE: No auto-initialization - controlled by StartupManager Phase 3 (lazy loading)
// CoachUI renders only when user opens the AI Coach tab for optimal startup performance
