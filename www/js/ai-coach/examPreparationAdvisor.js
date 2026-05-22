// ===== EXAM PREPARATION ADVISOR MODULE =====
// Generates strategic exam preparation advice based on exam proximity
// Provides adaptive study strategies for different timeframes

const ExamPreparationAdvisor = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    const CONFIG = {
        // Time-based strategy thresholds (days before exam)
        STRATEGY_THRESHOLDS: {
            TODAY: 0,
            TOMORROW: 1,
            CRITICAL: 3,    // 1-3 days
            ONE_WEEK: 7,    // 4-7 days
            TWO_WEEKS: 14,  // 8-14 days
            THREE_WEEKS: 21 // 15-21 days
        },
        
        // Recommended study hours per day based on proximity
        RECOMMENDED_HOURS: {
            TODAY: 2,        // Quick review only
            TOMORROW: 4,     // Intensive review
            CRITICAL: 3,     // Practice-focused
            ONE_WEEK: 2,     // Balanced study
            TWO_WEEKS: 1.5,  // Gradual preparation
            THREE_WEEKS: 1   // Early start
        }
    };

    let isInitialized = false;

    // ===== INITIALIZATION =====
    function init() {
        if (isInitialized) return;
        console.log('📅 Exam Preparation Advisor initialized');
        isInitialized = true;
    }

    // ===== DATA RETRIEVAL =====
    
    function getExams() {
        return JSON.parse(localStorage.getItem('exams')) || [];
    }

    function getSubjects() {
        return JSON.parse(localStorage.getItem('subjects')) || [];
    }

    function getFocusSessions() {
        return JSON.parse(localStorage.getItem('focusSessions')) || [];
    }

    // ===== HELPER FUNCTIONS =====
    
    /**
     * Calculate days until exam
     * @param {string} examDate - Exam date (ISO format)
     * @returns {number} Days until exam
     */
    function getDaysUntilExam(examDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const exam = new Date(examDate);
        exam.setHours(0, 0, 0, 0);
        const diffTime = exam - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    /**
     * Get subject name by ID
     * @param {string} subjectId - Subject ID
     * @returns {string} Subject name
     */
    function getSubjectName(subjectId) {
        const subjects = getSubjects();
        const subject = subjects.find(s => s.id === subjectId);
        return subject ? subject.name : 'Unknown Subject';
    }

    /**
     * Calculate study time for subject in last N days
     * @param {string} subjectId - Subject ID
     * @param {number} days - Number of days to look back
     * @returns {number} Total study hours
     */
    function getRecentStudyTime(subjectId, days) {
        const sessions = getFocusSessions();
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        const relevantSessions = sessions.filter(s => {
            if (s.subject !== subjectId || !s.completed) return false;
            const sessionDate = new Date(s.completedAt);
            return sessionDate >= cutoff;
        });

        const totalMinutes = relevantSessions.reduce((sum, s) => sum + (s.duration || 0) / 60, 0);
        return Math.round(totalMinutes / 60 * 10) / 10;
    }

    // ===== STRATEGY GENERATION =====
    
    /**
     * Generate strategy for exam happening today
     * @param {Object} exam - Exam data
     * @returns {Object} Strategy
     */
    function strategyForToday(exam) {
        return {
            phase: 'EXAM_DAY',
            title: '🔥 Exam Day - Final Review',
            focus: 'Quick review of key concepts',
            activities: [
                'Review summary notes and key formulas',
                'Look over past mistakes and corrections',
                'Stay calm and avoid cramming',
                'Get to exam location early'
            ],
            timeframe: 'Last 1-2 hours before exam',
            recommendedHours: CONFIG.RECOMMENDED_HOURS.TODAY,
            priority: 'critical',
            tips: [
                'Eat a good meal',
                'Stay hydrated',
                'Trust your preparation'
            ]
        };
    }

    /**
     * Generate strategy for exam tomorrow
     * @param {Object} exam - Exam data
     * @returns {Object} Strategy
     */
    function strategyForTomorrow(exam) {
        const recentStudy = getRecentStudyTime(exam.subjectId, 3);
        
        return {
            phase: 'FINAL_PREP',
            title: '⚡ Tomorrow - Intensive Review',
            focus: 'Practice problems and weak areas',
            activities: [
                'Complete practice tests under time pressure',
                'Review most difficult topics',
                'Create quick reference cheat sheet',
                'Get adequate sleep tonight'
            ],
            timeframe: 'Today',
            recommendedHours: CONFIG.RECOMMENDED_HOURS.TOMORROW,
            priority: 'critical',
            tips: [
                'Focus on understanding, not memorization',
                'Take short breaks to avoid burnout',
                recentStudy < 2 ? '⚠️ Low recent study time - focus on key concepts' : '✓ Good preparation momentum'
            ]
        };
    }

    /**
     * Generate strategy for 1-3 days before exam
     * @param {Object} exam - Exam data
     * @param {number} daysUntil - Days until exam
     * @returns {Object} Strategy
     */
    function strategyForCriticalPeriod(exam, daysUntil) {
        const recentStudy = getRecentStudyTime(exam.subjectId, 7);
        
        return {
            phase: 'CRITICAL_REVIEW',
            title: `🎯 ${daysUntil} Days Left - Practice Intensive`,
            focus: 'Solve problems and take practice tests',
            activities: [
                'Complete past exam papers',
                'Time yourself on practice problems',
                'Identify and drill weak topics',
                'Review lecture notes systematically'
            ],
            timeframe: `Next ${daysUntil} days`,
            recommendedHours: CONFIG.RECOMMENDED_HOURS.CRITICAL,
            priority: 'high',
            tips: [
                'Practice under exam conditions',
                'Focus on high-yield topics',
                recentStudy < 5 ? '⚠️ Increase study intensity now' : '✓ Maintain current pace'
            ]
        };
    }

    /**
     * Generate strategy for 4-7 days before exam
     * @param {Object} exam - Exam data
     * @param {number} daysUntil - Days until exam
     * @returns {Object} Strategy
     */
    function strategyForOneWeek(exam, daysUntil) {
        return {
            phase: 'ACTIVE_REVISION',
            title: `📝 ${daysUntil} Days - Active Revision Phase`,
            focus: 'Comprehensive review and practice',
            activities: [
                'Review all course material from start',
                'Solve practice problems daily',
                'Create summary notes',
                'Attend review sessions if available'
            ],
            timeframe: `Next ${daysUntil} days`,
            recommendedHours: CONFIG.RECOMMENDED_HOURS.ONE_WEEK,
            priority: 'high',
            tips: [
                'Cover all topics systematically',
                'Mix theory review with problem-solving',
                'Test yourself regularly'
            ]
        };
    }

    /**
     * Generate strategy for 8-14 days before exam
     * @param {Object} exam - Exam data
     * @param {number} daysUntil - Days until exam
     * @returns {Object} Strategy
     */
    function strategyForTwoWeeks(exam, daysUntil) {
        return {
            phase: 'STRUCTURED_PREP',
            title: `📚 ${daysUntil} Days - Structured Preparation`,
            focus: 'Build comprehensive understanding',
            activities: [
                'Study each topic in depth',
                'Complete homework and assignments',
                'Make detailed notes',
                'Start solving practice problems'
            ],
            timeframe: `Next ${daysUntil} days`,
            recommendedHours: CONFIG.RECOMMENDED_HOURS.TWO_WEEKS,
            priority: 'medium',
            tips: [
                'Focus on understanding concepts',
                'Build a study schedule',
                'Study consistently every day'
            ]
        };
    }

    /**
     * Generate strategy for 15-21 days before exam
     * @param {Object} exam - Exam data
     * @param {number} daysUntil - Days until exam
     * @returns {Object} Strategy
     */
    function strategyForThreeWeeks(exam, daysUntil) {
        return {
            phase: 'EARLY_START',
            title: `🌱 ${daysUntil} Days - Early Preparation`,
            focus: 'Foundation building',
            activities: [
                'Review syllabus and exam format',
                'Organize study materials',
                'Start with fundamentals',
                'Create a study plan'
            ],
            timeframe: `Next ${daysUntil} days`,
            recommendedHours: CONFIG.RECOMMENDED_HOURS.THREE_WEEKS,
            priority: 'medium',
            tips: [
                'Start early to reduce stress later',
                'Build strong fundamentals',
                'Consistent daily progress'
            ]
        };
    }

    /**
     * Get appropriate strategy based on days remaining
     * @param {Object} exam - Exam data
     * @param {number} daysUntil - Days until exam
     * @returns {Object} Strategy
     */
    function getStrategy(exam, daysUntil) {
        if (daysUntil === 0) {
            return strategyForToday(exam);
        } else if (daysUntil === 1) {
            return strategyForTomorrow(exam);
        } else if (daysUntil <= 3) {
            return strategyForCriticalPeriod(exam, daysUntil);
        } else if (daysUntil <= 7) {
            return strategyForOneWeek(exam, daysUntil);
        } else if (daysUntil <= 14) {
            return strategyForTwoWeeks(exam, daysUntil);
        } else if (daysUntil <= 21) {
            return strategyForThreeWeeks(exam, daysUntil);
        } else {
            return {
                phase: 'EARLY_PHASE',
                title: `📖 ${daysUntil} Days - Plenty of Time`,
                focus: 'Regular study routine',
                activities: [
                    'Follow your regular study schedule',
                    'Stay current with coursework',
                    'Build understanding gradually'
                ],
                timeframe: `${daysUntil} days remaining`,
                recommendedHours: 1,
                priority: 'low',
                tips: ['No rush yet - maintain consistent study habits']
            };
        }
    }

    /**
     * Assess preparation readiness for an exam
     * @param {Object} exam - Exam data
     * @param {number} daysUntil - Days until exam
     * @returns {Object} Readiness assessment
     */
    function assessReadiness(exam, daysUntil) {
        const recentStudy = getRecentStudyTime(exam.subjectId, 7);
        const strategy = getStrategy(exam, daysUntil);
        const expectedStudy = strategy.recommendedHours * Math.min(daysUntil, 7);
        
        let readinessLevel = 'unknown';
        let readinessScore = 0;
        
        if (expectedStudy > 0) {
            readinessScore = Math.min((recentStudy / expectedStudy) * 100, 100);
            
            if (readinessScore >= 80) {
                readinessLevel = 'excellent';
            } else if (readinessScore >= 60) {
                readinessLevel = 'good';
            } else if (readinessScore >= 40) {
                readinessLevel = 'moderate';
            } else {
                readinessLevel = 'low';
            }
        }
        
        return {
            level: readinessLevel,
            score: Math.round(readinessScore),
            actualHours: recentStudy,
            expectedHours: Math.round(expectedStudy * 10) / 10,
            message: readinessLevel === 'excellent' 
                ? 'Great preparation! Keep it up.'
                : readinessLevel === 'good'
                ? 'Good progress, stay consistent.'
                : readinessLevel === 'moderate'
                ? 'Need more study time to be confident.'
                : 'Increase study intensity now!'
        };
    }

    // ===== MAIN ADVICE GENERATION =====
    
    /**
     * Generate exam preparation advice for all upcoming exams
     * @returns {Object} Comprehensive exam advice
     */
    function generateAdvice() {
        console.log('📅 Generating exam preparation advice...');
        
        const startTime = performance.now();
        const exams = getExams();
        
        if (exams.length === 0) {
            console.log('ℹ️ No exams scheduled');
            return {
                upcomingExams: [],
                hasUrgentExams: false,
                summary: {
                    total: 0,
                    thisWeek: 0,
                    nextWeek: 0
                }
            };
        }

        // Process each exam
        const upcomingExams = exams
            .map(exam => {
                const daysUntil = getDaysUntilExam(exam.date);
                
                // Only include upcoming exams (not past)
                if (daysUntil < 0) return null;
                
                const strategy = getStrategy(exam, daysUntil);
                const readiness = assessReadiness(exam, daysUntil);
                const subjectName = getSubjectName(exam.subjectId);
                
                return {
                    examId: exam.id,
                    examName: exam.name,
                    subjectId: exam.subjectId,
                    subjectName,
                    examDate: exam.date,
                    daysUntil,
                    strategy: strategy.title,
                    phase: strategy.phase,
                    focus: strategy.focus,
                    activities: strategy.activities,
                    timeframe: strategy.timeframe,
                    recommendedHours: strategy.recommendedHours,
                    tips: strategy.tips,
                    priority: strategy.priority,
                    readiness
                };
            })
            .filter(exam => exam !== null)
            .sort((a, b) => a.daysUntil - b.daysUntil); // Sort by urgency

        // Calculate summary
        const thisWeek = upcomingExams.filter(e => e.daysUntil <= 7).length;
        const nextWeek = upcomingExams.filter(e => e.daysUntil > 7 && e.daysUntil <= 14).length;
        const hasUrgentExams = upcomingExams.some(e => e.daysUntil <= 3);

        const summary = {
            total: upcomingExams.length,
            thisWeek,
            nextWeek,
            hasUrgentExams
        };

        const duration = (performance.now() - startTime).toFixed(2);
        console.log(`✅ Exam advice generated in ${duration}ms`);
        console.log(`📊 ${upcomingExams.length} upcoming exams analyzed`);

        return {
            upcomingExams,
            hasUrgentExams,
            summary,
            timestamp: new Date().toISOString()
        };
    }

    // ===== PUBLIC API =====
    return {
        init,
        generateAdvice,
        
        // Expose individual functions for testing
        getStrategy,
        assessReadiness,
        getDaysUntilExam,
        getRecentStudyTime
    };
})();
