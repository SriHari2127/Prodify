// ===== STUDY RECOMMENDATION ENGINE =====
// Generates intelligent study recommendations based on multiple data sources
// Considers weak subjects, exams, habits, tasks, and study patterns

const StudyRecommendationEngine = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    const CONFIG = {
        MAX_RECOMMENDATIONS: 8,
        
        RECOMMENDATION_TYPES: {
            WEAK_SUBJECT: 'weak_subject',
            EXAM_PREP: 'exam_prep',
            TASK_BACKLOG: 'task_backlog',
            HABIT_STREAK: 'habit_streak',
            FOCUS_IMPROVEMENT: 'focus_improvement',
            BALANCED_STUDY: 'balanced_study',
            CONSISTENCY: 'consistency',
            BREAK_REMINDER: 'break_reminder'
        },
        
        PRIORITY_WEIGHTS: {
            critical: 10,
            high: 7,
            medium: 5,
            low: 3
        }
    };

    let isInitialized = false;

    // ===== INITIALIZATION =====
    function init() {
        if (isInitialized) return;
        console.log('💡 Study Recommendation Engine initialized');
        isInitialized = true;
    }

    // ===== DATA RETRIEVAL =====
    
    function getTasks() {
        return JSON.parse(localStorage.getItem('tasks')) || [];
    }

    function getHabits() {
        return JSON.parse(localStorage.getItem('habits')) || [];
    }

    function getSubjects() {
        return JSON.parse(localStorage.getItem('subjects')) || [];
    }

    // ===== RECOMMENDATION GENERATORS =====
    
    /**
     * Generate recommendations for weak subjects
     * @param {Object} weakSubjects - Weak subject detection results
     * @returns {Array} Recommendations
     */
    function generateWeakSubjectRecommendations(weakSubjects) {
        const recommendations = [];
        
        if (!weakSubjects || !weakSubjects.weakSubjects) return recommendations;
        
        // Take top 3 weakest subjects
        const topWeak = weakSubjects.weakSubjects.slice(0, 3);
        
        topWeak.forEach(subject => {
            let icon = '📚';
            let title = '';
            let message = '';
            let action = '';
            let priority = subject.priority;
            
            if (subject.priority === 'critical') {
                icon = '🚨';
                title = `Critical: Focus on ${subject.subjectName}`;
                message = `You've only studied ${subject.percentage}% of expected time. This needs urgent attention!`;
                action = `Schedule ${subject.deficitHours} hours of focused study sessions this week.`;
            } else if (subject.priority === 'high') {
                icon = '⚠️';
                title = `${subject.subjectName} Needs More Attention`;
                message = `Expected: ${subject.expectedMinutes}min, Actual: ${subject.actualMinutes}min.`;
                action = `Add ${Math.round(subject.deficitMinutes)} minutes of study time.`;
            } else {
                icon = '📖';
                title = `Consider More ${subject.subjectName}`;
                message = `You're ${subject.deficitHours} hours behind your study goal.`;
                action = `Try to schedule additional focus sessions.`;
            }
            
            recommendations.push({
                type: CONFIG.RECOMMENDATION_TYPES.WEAK_SUBJECT,
                priority,
                icon,
                title,
                message,
                action,
                subjectId: subject.subjectId,
                subjectName: subject.subjectName,
                metadata: {
                    weaknessScore: subject.weaknessScore,
                    deficit: subject.deficitHours
                }
            });
        });
        
        return recommendations;
    }

    /**
     * Generate exam preparation recommendations
     * @param {Object} examAdvice - Exam preparation advisor results
     * @returns {Array} Recommendations
     */
    function generateExamRecommendations(examAdvice) {
        const recommendations = [];
        
        if (!examAdvice || !examAdvice.upcomingExams) return recommendations;
        
        examAdvice.upcomingExams.forEach(exam => {
            let icon = '📅';
            let priority = 'medium';
            let title = '';
            let message = '';
            let action = '';
            
            if (exam.daysUntil === 0) {
                icon = '🔥';
                priority = 'critical';
                title = `${exam.examName} is TODAY!`;
                message = 'Last minute revision time. Stay calm and focused.';
                action = 'Do a quick review of key concepts and formulas.';
            } else if (exam.daysUntil === 1) {
                icon = '⚡';
                priority = 'critical';
                title = `${exam.examName} Tomorrow`;
                message = 'Final preparation day - focus on weak areas.';
                action = exam.strategy || 'Review notes and practice problems.';
            } else if (exam.daysUntil <= 3) {
                icon = '🎯';
                priority = 'high';
                title = `${exam.examName} in ${exam.daysUntil} Days`;
                message = 'Intensive review period.';
                action = exam.strategy || 'Practice tests and problem solving.';
            } else if (exam.daysUntil <= 7) {
                icon = '📝';
                priority = 'high';
                title = `${exam.examName} Next Week`;
                message = `${exam.daysUntil} days to prepare.`;
                action = exam.strategy || 'Schedule daily revision sessions.';
            } else if (exam.daysUntil <= 14) {
                icon = '📚';
                priority = 'medium';
                title = `Prepare for ${exam.examName}`;
                message = `Start preparing - ${exam.daysUntil} days remaining.`;
                action = exam.strategy || 'Review course material systematically.';
            }
            
            if (exam.daysUntil <= 14) {
                recommendations.push({
                    type: CONFIG.RECOMMENDATION_TYPES.EXAM_PREP,
                    priority,
                    icon,
                    title,
                    message,
                    action,
                    subjectId: exam.subjectId,
                    subjectName: exam.subjectName,
                    metadata: {
                        examId: exam.examId,
                        examDate: exam.examDate,
                        daysUntil: exam.daysUntil
                    }
                });
            }
        });
        
        return recommendations;
    }

    /**
     * Generate task backlog recommendations
     * @param {Object} behaviorMetrics - Behavior analysis results
     * @returns {Array} Recommendations
     */
    function generateTaskRecommendations(behaviorMetrics) {
        const recommendations = [];
        const tasks = getTasks();
        
        // Count overdue and upcoming tasks
        const now = new Date();
        const overdueTasks = tasks.filter(t => {
            if (t.completed || !t.dueDate) return false;
            return new Date(t.dueDate) < now;
        });
        
        const upcomingTasks = tasks.filter(t => {
            if (t.completed || !t.dueDate) return false;
            const dueDate = new Date(t.dueDate);
            const daysUntil = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
            return daysUntil >= 0 && daysUntil <= 3;
        });
        
        if (overdueTasks.length > 0) {
            recommendations.push({
                type: CONFIG.RECOMMENDATION_TYPES.TASK_BACKLOG,
                priority: 'high',
                icon: '⏰',
                title: `${overdueTasks.length} Overdue Tasks`,
                message: 'You have tasks past their due date.',
                action: 'Prioritize completing these tasks today.',
                metadata: {
                    overdueCount: overdueTasks.length
                }
            });
        }
        
        if (upcomingTasks.length > 0) {
            recommendations.push({
                type: CONFIG.RECOMMENDATION_TYPES.TASK_BACKLOG,
                priority: 'medium',
                icon: '📋',
                title: `${upcomingTasks.length} Tasks Due Soon`,
                message: 'Tasks due within 3 days.',
                action: 'Plan time to complete these tasks.',
                metadata: {
                    upcomingCount: upcomingTasks.length
                }
            });
        }
        
        // Check task completion rate
        if (behaviorMetrics && behaviorMetrics.taskCompletion) {
            const rate = behaviorMetrics.taskCompletion.rate;
            if (rate < 0.5 && behaviorMetrics.taskCompletion.total > 0) {
                recommendations.push({
                    type: CONFIG.RECOMMENDATION_TYPES.TASK_BACKLOG,
                    priority: 'medium',
                    icon: '✅',
                    title: 'Low Task Completion Rate',
                    message: `Only ${Math.round(rate * 100)}% of tasks completed this week.`,
                    action: 'Break down large tasks into smaller actionable items.',
                    metadata: {
                        completionRate: rate
                    }
                });
            }
        }
        
        return recommendations;
    }

    /**
     * Generate habit streak recommendations
     * @param {Object} behaviorMetrics - Behavior analysis results
     * @returns {Array} Recommendations
     */
    function generateHabitRecommendations(behaviorMetrics) {
        const recommendations = [];
        const habits = getHabits();
        
        if (habits.length === 0) return recommendations;
        
        // Find habits with broken streaks (streak = 0)
        const brokenStreaks = habits.filter(h => (h.streak || 0) === 0);
        
        if (brokenStreaks.length > 0) {
            recommendations.push({
                type: CONFIG.RECOMMENDATION_TYPES.HABIT_STREAK,
                priority: 'medium',
                icon: '🔄',
                title: 'Rebuild Your Habit Streaks',
                message: `${brokenStreaks.length} habit${brokenStreaks.length > 1 ? 's' : ''} need attention.`,
                action: 'Complete your daily habits to restart your streaks.',
                metadata: {
                    brokenCount: brokenStreaks.length
                }
            });
        }
        
        // Find habits with good streaks (encourage continuation)
        const goodStreaks = habits.filter(h => (h.streak || 0) >= 7);
        
        if (goodStreaks.length > 0 && brokenStreaks.length === 0) {
            recommendations.push({
                type: CONFIG.RECOMMENDATION_TYPES.HABIT_STREAK,
                priority: 'low',
                icon: '🔥',
                title: 'Keep Your Streaks Going!',
                message: `You have ${goodStreaks.length} strong habit streak${goodStreaks.length > 1 ? 's' : ''}.`,
                action: 'Maintain consistency to keep building momentum.',
                metadata: {
                    goodStreakCount: goodStreaks.length,
                    maxStreak: Math.max(...habits.map(h => h.streak || 0))
                }
            });
        }
        
        return recommendations;
    }

    /**
     * Generate focus improvement recommendations
     * @param {Object} behaviorMetrics - Behavior analysis results
     * @returns {Array} Recommendations
     */
    function generateFocusRecommendations(behaviorMetrics) {
        const recommendations = [];
        
        if (!behaviorMetrics || !behaviorMetrics.focusSuccess) return recommendations;
        
        const focusRate = behaviorMetrics.focusSuccess.rate;
        const avgDuration = behaviorMetrics.focusSuccess.avgDurationMinutes;
        
        // Low focus success rate
        if (focusRate < 0.7 && behaviorMetrics.focusSuccess.total > 0) {
            recommendations.push({
                type: CONFIG.RECOMMENDATION_TYPES.FOCUS_IMPROVEMENT,
                priority: 'medium',
                icon: '🎯',
                title: 'Improve Focus Session Success',
                message: `${Math.round((1 - focusRate) * 100)}% of focus sessions were interrupted.`,
                action: 'Try enabling Focus Lock Mode to minimize distractions.',
                metadata: {
                    successRate: focusRate
                }
            });
        }
        
        // Short focus sessions
        if (avgDuration > 0 && avgDuration < 20) {
            recommendations.push({
                type: CONFIG.RECOMMENDATION_TYPES.FOCUS_IMPROVEMENT,
                priority: 'low',
                icon: '⏱️',
                title: 'Extend Focus Sessions',
                message: `Average focus time is only ${avgDuration} minutes.`,
                action: 'Try 25-minute Pomodoro sessions for deeper work.',
                metadata: {
                    avgDuration
                }
            });
        }
        
        return recommendations;
    }

    /**
     * Generate balanced study recommendations
     * @param {Object} behaviorMetrics - Behavior analysis results
     * @returns {Array} Recommendations
     */
    function generateBalanceRecommendations(behaviorMetrics) {
        const recommendations = [];
        
        if (!behaviorMetrics || !behaviorMetrics.subjectDistribution) return recommendations;
        
        const distribution = behaviorMetrics.subjectDistribution;
        
        if (distribution.length < 2) return recommendations;
        
        // Check if distribution is imbalanced (one subject > 60%)
        const dominantSubject = distribution[0];
        if (dominantSubject.percentage > 60) {
            const others = distribution.slice(1);
            recommendations.push({
                type: CONFIG.RECOMMENDATION_TYPES.BALANCED_STUDY,
                priority: 'low',
                icon: '⚖️',
                title: 'Balance Your Study Time',
                message: `${dominantSubject.subjectName} accounts for ${dominantSubject.percentage}% of study time.`,
                action: `Consider dedicating more time to ${others.map(s => s.subjectName).join(', ')}.`,
                metadata: {
                    dominantSubject: dominantSubject.subjectName,
                    percentage: dominantSubject.percentage
                }
            });
        }
        
        return recommendations;
    }

    /**
     * Generate consistency recommendations
     * @param {Object} behaviorMetrics - Behavior analysis results
     * @returns {Array} Recommendations
     */
    function generateConsistencyRecommendations(behaviorMetrics) {
        const recommendations = [];
        
        if (!behaviorMetrics || !behaviorMetrics.dailyTrend) return recommendations;
        
        const trend = behaviorMetrics.dailyTrend;
        
        // Count days with no study
        const daysWithNoStudy = trend.filter(day => day.studyHours === 0).length;
        
        if (daysWithNoStudy >= 3) {
            recommendations.push({
                type: CONFIG.RECOMMENDATION_TYPES.CONSISTENCY,
                priority: 'medium',
                icon: '📆',
                title: 'Study More Consistently',
                message: `${daysWithNoStudy} days this week with no study sessions.`,
                action: 'Try to study at least 30 minutes every day.',
                metadata: {
                    daysWithNoStudy
                }
            });
        }
        
        return recommendations;
    }

    // ===== MAIN GENERATION FUNCTION =====
    
    /**
     * Generate all recommendations
     * @param {Object} context - Combined context from all analyzers
     * @returns {Array} Prioritized recommendations
     */
    function generate(context = {}) {
        console.log('💡 Generating study recommendations...');
        
        const startTime = performance.now();
        let allRecommendations = [];
        
        try {
            // Generate from all sources
            allRecommendations = [
                ...generateWeakSubjectRecommendations(context.weakSubjects),
                ...generateExamRecommendations(context.examAdvice),
                ...generateTaskRecommendations(context.behaviorMetrics),
                ...generateHabitRecommendations(context.behaviorMetrics),
                ...generateFocusRecommendations(context.behaviorMetrics),
                ...generateBalanceRecommendations(context.behaviorMetrics),
                ...generateConsistencyRecommendations(context.behaviorMetrics)
            ];
            
            // Sort by priority
            allRecommendations.sort((a, b) => {
                const weightA = CONFIG.PRIORITY_WEIGHTS[a.priority] || 0;
                const weightB = CONFIG.PRIORITY_WEIGHTS[b.priority] || 0;
                return weightB - weightA;
            });
            
            // Limit to top recommendations
            const topRecommendations = allRecommendations.slice(0, CONFIG.MAX_RECOMMENDATIONS);
            
            const duration = (performance.now() - startTime).toFixed(2);
            console.log(`✅ Generated ${topRecommendations.length} recommendations in ${duration}ms`);
            
            return topRecommendations;
            
        } catch (error) {
            console.error('❌ Error generating recommendations:', error);
            return [];
        }
    }

    // ===== PUBLIC API =====
    return {
        init,
        generate,
        
        // Expose individual generators for testing
        generateWeakSubjectRecommendations,
        generateExamRecommendations,
        generateTaskRecommendations,
        generateHabitRecommendations,
        generateFocusRecommendations,
        generateBalanceRecommendations,
        generateConsistencyRecommendations
    };
})();
