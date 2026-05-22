// ===== MOTIVATION GENERATOR MODULE =====
// Generates personalized motivational messages based on user achievements
// Provides positive reinforcement and encouraging feedback

const MotivationGenerator = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    const CONFIG = {
        MESSAGE_CATEGORIES: {
            ACHIEVEMENT: 'achievement',
            IMPROVEMENT: 'improvement',
            ENCOURAGEMENT: 'encouragement',
            MILESTONE: 'milestone',
            CONSISTENCY: 'consistency',
            STREAK: 'streak'
        }
    };

    let isInitialized = false;

    // ===== INITIALIZATION =====
    function init() {
        if (isInitialized) return;
        console.log('🌟 Motivation Generator initialized');
        isInitialized = true;
    }

    // ===== MESSAGE TEMPLATES =====
    
    const TEMPLATES = {
        // Study hours achievements
        studyHours: {
            excellent: [
                '🌟 Outstanding! You studied {hours} hours this week - that\'s dedication!',
                '🔥 Incredible study ethic! {hours} hours of focused work this week.',
                '⭐ {hours} hours completed! You\'re crushing your study goals!'
            ],
            good: [
                '👍 Great work! {hours} hours of study is solid progress.',
                '💪 {hours} hours this week! You\'re building great habits.',
                '✨ Nice consistency! {hours} hours of focused study.'
            ],
            moderate: [
                '📚 You studied {hours} hours this week. Keep building momentum!',
                '🎯 {hours} hours done! Let\'s aim higher next week.',
                '🌱 {hours} hours is a good start. Keep going!'
            ]
        },
        
        // Task completion
        taskCompletion: {
            excellent: [
                '✅ Amazing! You completed {count} tasks this week with {rate}% completion rate!',
                '🎯 {count} tasks crushed! {rate}% completion is phenomenal!',
                '🏆 Task master! {count} tasks done at {rate}% completion rate!'
            ],
            good: [
                '👏 Nice work! {count} tasks completed this week.',
                '✔️ {count} tasks finished! You\'re making great progress.',
                '💯 {count} tasks done! Keep that momentum going!'
            ],
            improvement: [
                '📈 You\'re improving! {count} tasks completed this week.',
                '🚀 Great recovery! {count} tasks finished.',
                '⬆️ {count} tasks done - you\'re getting back on track!'
            ]
        },
        
        // Weekly comparison
        weeklyComparison: {
            improved: [
                '📈 You\'ve improved {percent}% from last week! Outstanding progress!',
                '🚀 {percent}% increase from last week! You\'re on fire!',
                '⬆️ Up {percent}% from last week! Keep this momentum!'
            ],
            maintained: [
                '⚖️ Consistent performance! Maintaining your {hours} hour weekly average.',
                '🎯 Steady as always! Another {hours} hour week.',
                '💪 Consistent excellence! {hours} hours again this week.'
            ],
            needsBoost: [
                '💪 Down a bit from last week, but you can bounce back!',
                '🌱 Time to rebuild momentum. You\'ve done it before!',
                '🔄 Let\'s turn it around this week. Start with one focus session!'
            ]
        },
        
        // Habit streaks
        habitStreak: {
            strong: [
                '🔥 {streak} day habit streak! You\'re unstoppable!',
                '⚡ {streak} days strong! Your consistency is inspiring!',
                '🌟 {streak} day streak! This is how winners build habits!'
            ],
            building: [
                '🌱 {streak} days in a row! Your habits are forming nicely.',
                '📈 {streak} day streak! Keep nurturing this growth!',
                '✨ {streak} days! Small steps lead to big changes!'
            ],
            restart: [
                '🔄 Fresh start! Begin a new streak today.',
                '🌅 Every day is a new opportunity. Start your streak now!',
                '💪 Streaks can be rebuilt. Let\'s start today!'
            ]
        },
        
        // Focus success
        focusSuccess: {
            excellent: [
                '🎯 {rate}% focus success rate! Your discipline is remarkable!',
                '🏆 {rate}% of sessions completed - that\'s elite performance!',
                '⭐ {rate}% success rate! You\'ve mastered deep work!'
            ],
            good: [
                '👍 {rate}% focus success! Solid concentration skills.',
                '💪 {rate}% completion rate - you\'re doing great!',
                '✨ {rate}% focus success shows good discipline!'
            ],
            improving: [
                '📈 Your focus is improving! Keep using Focus Lock Mode.',
                '🚀 Getting better at staying focused! Practice makes perfect.',
                '⬆️ Focus sessions improving! You\'re building that muscle!'
            ]
        },
        
        // Milestones
        milestones: {
            hours: [
                '🏆 Milestone achieved! You\'ve completed {total} total study hours!',
                '⭐ {total} hours of learning! That\'s tremendous dedication!',
                '🎯 {total} hours milestone reached! Knowledge is power!'
            ],
            sessions: [
                '🔥 {total} focus sessions completed! You\'re a productivity champion!',
                '💪 {total} focused sessions done! That\'s serious commitment!',
                '🌟 {total} sessions milestone! You\'re investing in yourself!'
            ],
            tasks: [
                '✅ {total} tasks conquered! You\'re a completion machine!',
                '🎯 {total} tasks finished! Your productivity is inspiring!',
                '👏 {total} tasks done! You make things happen!'
            ]
        },
        
        // Subject progress
        subjectProgress: [
            '📚 You\'ve studied {subject} for {hours} hours! Great dedication to this subject!',
            '🎓 {hours} hours on {subject}! You\'re mastering this!',
            '⭐ Strong focus on {subject} with {hours} hours invested!'
        ],
        
        // General encouragement
        encouragement: [
            '💫 Keep pushing forward! Every study session counts!',
            '🌟 You\'re building your future one day at a time!',
            '🚀 Remember: consistency beats intensity. Keep showing up!',
            '💪 Small daily improvements lead to stunning results!',
            '🎯 Your effort today shapes your success tomorrow!',
            '✨ Believe in yourself! You\'re capable of amazing things!',
            '🌱 Growth happens outside your comfort zone. Keep challenging yourself!',
            '🔥 Discipline is choosing what you want most over what you want now. Keep going!'
        ]
    };

    // ===== HELPER FUNCTIONS =====
    
    function randomChoice(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    function interpolate(template, data) {
        let result = template;
        Object.keys(data).forEach(key => {
            result = result.replace(new RegExp(`{${key}}`, 'g'), data[key]);
        });
        return result;
    }

    // ===== MESSAGE GENERATORS =====
    
    /**
     * Generate study hours motivation
     * @param {Object} behaviorMetrics - Behavior analysis results
     * @returns {Array} Motivational messages
     */
    function generateStudyHoursMotivation(behaviorMetrics) {
        const messages = [];
        
        if (!behaviorMetrics || behaviorMetrics.weeklyStudyHours === undefined) {
            return messages;
        }

        const hours = behaviorMetrics.weeklyStudyHours;
        
        let category = 'moderate';
        if (hours >= 15) category = 'excellent';
        else if (hours >= 8) category = 'good';
        
        if (hours > 0) {
            const template = randomChoice(TEMPLATES.studyHours[category]);
            messages.push({
                type: CONFIG.MESSAGE_CATEGORIES.ACHIEVEMENT,
                category: 'study_hours',
                message: interpolate(template, { hours }),
                icon: hours >= 15 ? '🌟' : hours >= 8 ? '👍' : '📚'
            });
        }
        
        return messages;
    }

    /**
     * Generate task completion motivation
     * @param {Object} behaviorMetrics - Behavior analysis results
     * @returns {Array} Motivational messages
     */
    function generateTaskMotivation(behaviorMetrics) {
        const messages = [];
        
        if (!behaviorMetrics || !behaviorMetrics.taskCompletion) {
            return messages;
        }

        const { completed, rate, percentage } = behaviorMetrics.taskCompletion;
        
        if (completed > 0) {
            let category = 'improvement';
            if (rate >= 0.7) category = 'excellent';
            else if (rate >= 0.5) category = 'good';
            
            const template = randomChoice(TEMPLATES.taskCompletion[category]);
            messages.push({
                type: CONFIG.MESSAGE_CATEGORIES.ACHIEVEMENT,
                category: 'tasks',
                message: interpolate(template, { count: completed, rate: percentage }),
                icon: rate >= 0.7 ? '🏆' : rate >= 0.5 ? '✅' : '📈'
            });
        }
        
        return messages;
    }

    /**
     * Generate weekly comparison motivation
     * @param {Object} behaviorMetrics - Behavior analysis results
     * @returns {Array} Motivational messages
     */
    function generateComparisonMotivation(behaviorMetrics) {
        const messages = [];
        
        if (!behaviorMetrics || !behaviorMetrics.weeklyComparison) {
            return messages;
        }

        const comparison = behaviorMetrics.weeklyComparison;
        const changePercent = comparison.changes?.studyHours || 0;
        const currentHours = comparison.currentWeek?.studyHours || 0;
        
        let category = 'maintained';
        if (changePercent > 10) category = 'improved';
        else if (changePercent < -10) category = 'needsBoost';
        
        const template = randomChoice(TEMPLATES.weeklyComparison[category]);
        messages.push({
            type: category === 'improved' ? CONFIG.MESSAGE_CATEGORIES.IMPROVEMENT : CONFIG.MESSAGE_CATEGORIES.ENCOURAGEMENT,
            category: 'weekly_comparison',
            message: interpolate(template, { 
                percent: Math.abs(changePercent), 
                hours: currentHours 
            }),
            icon: changePercent > 0 ? '📈' : changePercent < 0 ? '💪' : '⚖️'
        });
        
        return messages;
    }

    /**
     * Generate habit streak motivation
     * @param {Object} behaviorMetrics - Behavior analysis results
     * @returns {Array} Motivational messages
     */
    function generateHabitMotivation(behaviorMetrics) {
        const messages = [];
        
        if (!behaviorMetrics || !behaviorMetrics.habitConsistency) {
            return messages;
        }

        const { maxStreak } = behaviorMetrics.habitConsistency;
        
        let category = 'restart';
        if (maxStreak >= 7) category = 'strong';
        else if (maxStreak >= 3) category = 'building';
        
        if (maxStreak > 0) {
            const template = randomChoice(TEMPLATES.habitStreak[category]);
            messages.push({
                type: CONFIG.MESSAGE_CATEGORIES.STREAK,
                category: 'habits',
                message: interpolate(template, { streak: maxStreak }),
                icon: maxStreak >= 7 ? '🔥' : maxStreak >= 3 ? '🌱' : '🔄'
            });
        } else {
            const template = randomChoice(TEMPLATES.habitStreak.restart);
            messages.push({
                type: CONFIG.MESSAGE_CATEGORIES.ENCOURAGEMENT,
                category: 'habits',
                message: template,
                icon: '🔄'
            });
        }
        
        return messages;
    }

    /**
     * Generate focus success motivation
     * @param {Object} behaviorMetrics - Behavior analysis results
     * @returns {Array} Motivational messages
     */
    function generateFocusMotivation(behaviorMetrics) {
        const messages = [];
        
        if (!behaviorMetrics || !behaviorMetrics.focusSuccess) {
            return messages;
        }

        const { percentage, rate } = behaviorMetrics.focusSuccess;
        
        if (rate > 0) {
            let category = 'improving';
            if (rate >= 0.8) category = 'excellent';
            else if (rate >= 0.6) category = 'good';
            
            const template = randomChoice(TEMPLATES.focusSuccess[category]);
            messages.push({
                type: CONFIG.MESSAGE_CATEGORIES.ACHIEVEMENT,
                category: 'focus',
                message: interpolate(template, { rate: percentage }),
                icon: rate >= 0.8 ? '🎯' : rate >= 0.6 ? '👍' : '📈'
            });
        }
        
        return messages;
    }

    /**
     * Generate milestone celebrations
     * @param {Object} behaviorMetrics - Behavior analysis results
     * @returns {Array} Motivational messages
     */
    function generateMilestoneMotivation(behaviorMetrics) {
        const messages = [];
        
        // Check for study hour milestones
        const hours = behaviorMetrics?.weeklyStudyHours || 0;
        const milestoneHours = [10, 25, 50, 100, 200, 500];
        
        // This is simplified - in production, you'd track cumulative hours
        // For now, celebrate weekly milestones
        if (milestoneHours.includes(Math.floor(hours))) {
            const template = randomChoice(TEMPLATES.milestones.hours);
            messages.push({
                type: CONFIG.MESSAGE_CATEGORIES.MILESTONE,
                category: 'milestone_hours',
                message: interpolate(template, { total: Math.floor(hours) }),
                icon: '🏆'
            });
        }
        
        return messages;
    }

    /**
     * Generate subject-specific motivation
     * @param {Object} behaviorMetrics - Behavior analysis results
     * @returns {Array} Motivational messages
     */
    function generateSubjectMotivation(behaviorMetrics) {
        const messages = [];
        
        if (!behaviorMetrics || !behaviorMetrics.subjectDistribution) {
            return messages;
        }

        const topSubject = behaviorMetrics.subjectDistribution[0];
        
        if (topSubject && topSubject.hours >= 3) {
            const template = randomChoice(TEMPLATES.subjectProgress);
            messages.push({
                type: CONFIG.MESSAGE_CATEGORIES.ACHIEVEMENT,
                category: 'subject',
                message: interpolate(template, { 
                    subject: topSubject.subjectName,
                    hours: topSubject.hours
                }),
                icon: '📚'
            });
        }
        
        return messages;
    }

    /**
     * Generate general encouragement
     * @returns {Array} Motivational messages
     */
    function generateGeneralEncouragement() {
        const template = randomChoice(TEMPLATES.encouragement);
        
        return [{
            type: CONFIG.MESSAGE_CATEGORIES.ENCOURAGEMENT,
            category: 'general',
            message: template,
            icon: '💫'
        }];
    }

    // ===== MAIN GENERATION FUNCTION =====
    
    /**
     * Generate all motivational messages
     * @param {Object} context - Combined context from analyzers
     * @returns {Array} Motivational messages
     */
    function generate(context = {}) {
        console.log('🌟 Generating motivational messages...');
        
        const startTime = performance.now();
        const { behaviorMetrics, patterns, predictions } = context;
        
        try {
            let allMessages = [
                ...generateStudyHoursMotivation(behaviorMetrics),
                ...generateTaskMotivation(behaviorMetrics),
                ...generateComparisonMotivation(behaviorMetrics),
                ...generateHabitMotivation(behaviorMetrics),
                ...generateFocusMotivation(behaviorMetrics),
                ...generateMilestoneMotivation(behaviorMetrics),
                ...generateSubjectMotivation(behaviorMetrics)
            ];

            // Always include one general encouragement if no other messages
            if (allMessages.length === 0) {
                allMessages = generateGeneralEncouragement();
            } else if (allMessages.length < 3) {
                // Add general encouragement to pad messages
                allMessages.push(...generateGeneralEncouragement());
            }

            // Limit to top 5 messages
            const topMessages = allMessages.slice(0, 5);

            const duration = (performance.now() - startTime).toFixed(2);
            console.log(`✅ Generated ${topMessages.length} motivational messages in ${duration}ms`);

            return topMessages;

        } catch (error) {
            console.error('❌ Error generating motivation:', error);
            return generateGeneralEncouragement();
        }
    }

    // ===== PUBLIC API =====
    return {
        init,
        generate,
        
        // Expose individual generators for testing
        generateStudyHoursMotivation,
        generateTaskMotivation,
        generateComparisonMotivation,
        generateHabitMotivation,
        generateFocusMotivation,
        generateMilestoneMotivation,
        generateSubjectMotivation,
        generateGeneralEncouragement
    };
})();
