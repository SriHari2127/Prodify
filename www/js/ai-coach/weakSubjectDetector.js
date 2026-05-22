// ===== WEAK SUBJECT DETECTOR MODULE =====
// Identifies subjects that need more attention based on study time analysis
// Uses intelligent scoring algorithm to prioritize subjects

const WeakSubjectDetector = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    const CONFIG = {
        // Minimum expected study time per subject per week (minutes)
        MIN_EXPECTED_WEEKLY_MINUTES: 120, // 2 hours
        
        // Time window for analysis (days)
        ANALYSIS_WINDOW: 14, // Last 2 weeks
        
        // Weakness threshold (0.0 - 1.0)
        WEAKNESS_THRESHOLD: 0.3, // Subjects scoring > 0.3 are considered weak
        
        // Priority levels
        PRIORITY: {
            CRITICAL: 'critical', // > 0.7
            HIGH: 'high',         // 0.5 - 0.7
            MEDIUM: 'medium',     // 0.3 - 0.5
            LOW: 'low'            // < 0.3
        }
    };

    let isInitialized = false;

    // ===== INITIALIZATION =====
    function init() {
        if (isInitialized) return;
        console.log('🔍 Weak Subject Detector initialized');
        isInitialized = true;
    }

    // ===== DATA RETRIEVAL =====
    
    function getSubjects() {
        try {
            return JSON.parse(localStorage.getItem('subjects')) || [];
        } catch (error) {
            console.error('Error parsing subjects:', error);
            return [];
        }
    }

    function getFocusSessions() {
        try {
            return JSON.parse(localStorage.getItem('focusSessions')) || [];
        } catch (error) {
            console.error('Error parsing focusSessions:', error);
            return [];
        }
    }

    function getStudyBlocks() {
        try {
            return JSON.parse(localStorage.getItem('studyBlocks')) || [];
        } catch (error) {
            console.error('Error parsing studyBlocks:', error);
            return [];
        }
    }

    function getExams() {
        try {
            return JSON.parse(localStorage.getItem('exams')) || [];
        } catch (error) {
            console.error('Error parsing exams:', error);
            return [];
        }
    }

    // ===== HELPER FUNCTIONS =====
    
    function getDateRange(days) {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }

    function getDaysUntilExam(examDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const exam = new Date(examDate);
        exam.setHours(0, 0, 0, 0);
        const diffTime = exam - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // ===== CORE ANALYSIS =====
    
    /**
     * Calculate expected study time per subject
     * Based on study planner blocks and subject importance
     * @param {Object} subject - Subject data
     * @returns {number} Expected weekly minutes
     */
    function calculateExpectedTime(subject) {
        const studyBlocks = getStudyBlocks();
        const exams = getExams();
        
        // Base expectation
        let expectedMinutes = CONFIG.MIN_EXPECTED_WEEKLY_MINUTES;
        
        // Add planned study time from study blocks
        const subjectBlocks = studyBlocks.filter(block => block.subjectId === subject.id);
        const plannedMinutes = subjectBlocks.reduce((sum, block) => sum + (block.duration || 0), 0);
        
        if (plannedMinutes > 0) {
            expectedMinutes = plannedMinutes;
        }
        
        // Increase expectation if there's an upcoming exam
        const upcomingExams = exams.filter(exam => {
            if (exam.subjectId !== subject.id) return false;
            const daysUntil = getDaysUntilExam(exam.date);
            return daysUntil >= 0 && daysUntil <= 14; // Exams within 2 weeks
        });
        
        if (upcomingExams.length > 0) {
            const closestExam = upcomingExams.reduce((closest, exam) => {
                const days = getDaysUntilExam(exam.date);
                return days < getDaysUntilExam(closest.date) ? exam : closest;
            });
            
            const daysUntil = getDaysUntilExam(closestExam.date);
            
            // Exponentially increase expected time as exam approaches
            if (daysUntil <= 7) {
                expectedMinutes *= 2; // Double for exams within a week
            } else if (daysUntil <= 14) {
                expectedMinutes *= 1.5; // 50% increase for exams within 2 weeks
            }
        }
        
        return expectedMinutes;
    }

    /**
     * Calculate actual study time for a subject
     * @param {string} subjectId - Subject ID
     * @param {number} days - Number of days to analyze
     * @returns {number} Actual study minutes
     */
    function calculateActualTime(subjectId, days = CONFIG.ANALYSIS_WINDOW) {
        const sessions = getFocusSessions();
        const { start, end } = getDateRange(days);
        
        const subjectSessions = sessions.filter(session => {
            if (session.subject !== subjectId) return false;
            if (!session.completed) return false;
            if (!session.completedAt) return false;
            
            const completedDate = new Date(session.completedAt);
            return completedDate >= start && completedDate <= end;
        });
        
        const totalSeconds = subjectSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
        return totalSeconds / 60; // Convert to minutes
    }

    /**
     * Calculate weakness score for a subject
     * Formula: (expectedTime - actualTime) / expectedTime
     * Range: 0.0 (strong) to 1.0 (very weak)
     * @param {Object} subject - Subject data
     * @returns {Object} Weakness analysis
     */
    function calculateWeaknessScore(subject) {
        const expectedMinutes = calculateExpectedTime(subject);
        const actualMinutes = calculateActualTime(subject.id);
        
        // Calculate raw weakness score
        let weaknessScore = 0;
        if (expectedMinutes > 0) {
            weaknessScore = Math.max(0, (expectedMinutes - actualMinutes) / expectedMinutes);
            weaknessScore = Math.min(1, weaknessScore); // Cap at 1.0
        }
        
        // Determine priority level
        let priority = CONFIG.PRIORITY.LOW;
        if (weaknessScore > 0.7) {
            priority = CONFIG.PRIORITY.CRITICAL;
        } else if (weaknessScore > 0.5) {
            priority = CONFIG.PRIORITY.HIGH;
        } else if (weaknessScore > 0.3) {
            priority = CONFIG.PRIORITY.MEDIUM;
        }
        
        // Calculate deficit
        const deficitMinutes = Math.max(0, expectedMinutes - actualMinutes);
        const deficitHours = Math.round(deficitMinutes / 60 * 10) / 10;
        
        return {
            subjectId: subject.id,
            subjectName: subject.name,
            subjectColor: subject.color,
            weaknessScore: Math.round(weaknessScore * 100) / 100,
            priority,
            expectedMinutes: Math.round(expectedMinutes),
            actualMinutes: Math.round(actualMinutes),
            deficitMinutes: Math.round(deficitMinutes),
            deficitHours,
            percentage: expectedMinutes > 0 
                ? Math.round((actualMinutes / expectedMinutes) * 100) 
                : 0,
            isWeak: weaknessScore >= CONFIG.WEAKNESS_THRESHOLD
        };
    }

    /**
     * Detect subjects with upcoming exams
     * @returns {Array} Subjects with exam urgency
     */
    function detectExamUrgency() {
        const subjects = getSubjects();
        const exams = getExams();
        
        return subjects.map(subject => {
            const subjectExams = exams.filter(e => e.subjectId === subject.id);
            
            if (subjectExams.length === 0) {
                return null;
            }
            
            // Find closest exam
            const upcomingExams = subjectExams.filter(exam => {
                return getDaysUntilExam(exam.date) >= 0;
            });
            
            if (upcomingExams.length === 0) {
                return null;
            }
            
            const closestExam = upcomingExams.reduce((closest, exam) => {
                const days = getDaysUntilExam(exam.date);
                const closestDays = getDaysUntilExam(closest.date);
                return days < closestDays ? exam : closest;
            });
            
            const daysUntil = getDaysUntilExam(closestExam.date);
            
            let urgency = 'none';
            if (daysUntil === 0) {
                urgency = 'today';
            } else if (daysUntil === 1) {
                urgency = 'tomorrow';
            } else if (daysUntil <= 3) {
                urgency = 'critical';
            } else if (daysUntil <= 7) {
                urgency = 'high';
            } else if (daysUntil <= 14) {
                urgency = 'medium';
            }
            
            return {
                subjectId: subject.id,
                subjectName: subject.name,
                examName: closestExam.name,
                examDate: closestExam.date,
                daysUntil,
                urgency
            };
        }).filter(item => item !== null);
    }

    /**
     * Detect all weak subjects
     * @returns {Object} Comprehensive weak subject analysis
     */
    function detectWeakSubjects() {
        console.log('🔍 Detecting weak subjects...');
        
        const startTime = performance.now();
        const subjects = getSubjects();
        
        if (subjects.length === 0) {
            console.log('⚠️ No subjects found');
            return {
                weakSubjects: [],
                allSubjects: [],
                examUrgency: [],
                summary: {
                    total: 0,
                    weak: 0,
                    critical: 0,
                    high: 0,
                    medium: 0
                }
            };
        }
        
        // Analyze each subject
        const analysis = subjects.map(subject => calculateWeaknessScore(subject));
        
        // Filter weak subjects
        const weakSubjects = analysis
            .filter(a => a.isWeak)
            .sort((a, b) => b.weaknessScore - a.weaknessScore); // Sort by weakness (most weak first)
        
        // Get exam urgency
        const examUrgency = detectExamUrgency();
        
        // Calculate summary
        const summary = {
            total: subjects.length,
            weak: weakSubjects.length,
            critical: weakSubjects.filter(s => s.priority === CONFIG.PRIORITY.CRITICAL).length,
            high: weakSubjects.filter(s => s.priority === CONFIG.PRIORITY.HIGH).length,
            medium: weakSubjects.filter(s => s.priority === CONFIG.PRIORITY.MEDIUM).length
        };
        
        const duration = (performance.now() - startTime).toFixed(2);
        console.log(`✅ Weak subject detection complete in ${duration}ms`);
        console.log(`📊 Found ${weakSubjects.length} weak subjects out of ${subjects.length}`);
        
        return {
            weakSubjects,
            allSubjects: analysis,
            examUrgency: examUrgency.filter(e => e.urgency !== 'none'),
            summary,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get recommendations for weak subjects
     * @returns {Array} Actionable recommendations
     */
    function getRecommendations() {
        const detection = detectWeakSubjects();
        const recommendations = [];
        
        detection.weakSubjects.forEach(subject => {
            let message = '';
            let action = '';
            
            if (subject.priority === CONFIG.PRIORITY.CRITICAL) {
                message = `${subject.subjectName} needs urgent attention! You've studied only ${subject.percentage}% of expected time.`;
                action = `Schedule at least ${subject.deficitHours} hours this week.`;
            } else if (subject.priority === CONFIG.PRIORITY.HIGH) {
                message = `${subject.subjectName} is falling behind. Actual: ${subject.actualMinutes}min, Expected: ${subject.expectedMinutes}min.`;
                action = `Add ${Math.round(subject.deficitHours * 60)}min of focus sessions.`;
            } else if (subject.priority === CONFIG.PRIORITY.MEDIUM) {
                message = `Consider spending more time on ${subject.subjectName}.`;
                action = `Try to add ${subject.deficitHours} hours this week.`;
            }
            
            recommendations.push({
                subjectId: subject.subjectId,
                subjectName: subject.subjectName,
                priority: subject.priority,
                message,
                action,
                deficitHours: subject.deficitHours
            });
        });
        
        // Add exam urgency recommendations
        detection.examUrgency.forEach(exam => {
            if (exam.urgency === 'today' || exam.urgency === 'tomorrow' || exam.urgency === 'critical') {
                recommendations.push({
                    subjectId: exam.subjectId,
                    subjectName: exam.subjectName,
                    priority: 'critical',
                    message: `${exam.examName} is ${exam.urgency === 'today' ? 'TODAY' : exam.daysUntil === 1 ? 'TOMORROW' : 'in ' + exam.daysUntil + ' days'}!`,
                    action: 'Focus on revision and practice tests now.',
                    isExamUrgent: true,
                    examDate: exam.examDate,
                    daysUntil: exam.daysUntil
                });
            }
        });
        
        return recommendations;
    }

    // ===== PUBLIC API =====
    return {
        init,
        detectWeakSubjects,
        getRecommendations,
        
        // Expose for testing
        calculateWeaknessScore,
        calculateExpectedTime,
        calculateActualTime,
        detectExamUrgency
    };
})();
