// ===== SMART STUDY SCHEDULING ENGINE =====
// Production-grade intelligent scheduling system for student productivity
// Architecture: Event-driven, offline-first, Firebase-synced

const StudyScheduler = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    
    const CONFIG = {
        // Priority weights (must sum to 1.0)
        weights: {
            examProximity: 0.5,
            subjectWeakness: 0.3,
            taskUrgency: 0.2
        },
        
        // Study session durations (minutes)
        sessionDurations: {
            deepWork: 90,
            practice: 60,
            revision: 45,
            mockTest: 30,
            flashReview: 20
        },
        
        // Break intervals (minutes)
        breaks: {
            short: 10,
            medium: 15,
            long: 20
        },
        
        // Default available study hours per day
        defaultStudyHours: 4,
        
        // Weak subject threshold (minutes in last 7 days)
        weakSubjectThreshold: 30,
        
        // Exam proximity thresholds (days)
        examThresholds: {
            intensive: 2,
            mixed: 5,
            coverage: 10
        },
        
        // Spaced repetition intervals (days)
        revisionIntervals: [1, 3, 7],
        
        // Cache expiry (milliseconds)
        cacheExpiry: 15 * 60 * 1000, // 15 minutes
        
        // Maximum sessions per day
        maxSessionsPerDay: 6
    };

    // ===== STATE MANAGEMENT =====
    
    let currentSchedule = null;
    let scheduleCache = new Map();
    let lastCalculation = null;
    let recalculationTimeout = null;

    // ===== INITIALIZATION =====
    
    function init() {
        console.log('📅 Study Scheduler initialized');
        loadCachedSchedule();
        setupEventListeners();
    }

    function setupEventListeners() {
        // Recalculate schedule when data changes
        document.addEventListener('examAdded', () => scheduleRecalculation());
        document.addEventListener('examDeleted', () => scheduleRecalculation());
        document.addEventListener('examUpdated', () => scheduleRecalculation());
        document.addEventListener('taskAdded', () => scheduleRecalculation());
        document.addEventListener('taskCompleted', () => scheduleRecalculation());
        document.addEventListener('taskDeleted', () => scheduleRecalculation());
        document.addEventListener('focusSessionComplete', () => scheduleRecalculation());
        document.addEventListener('subjectAdded', () => scheduleRecalculation());
        document.addEventListener('subjectUpdated', () => scheduleRecalculation());
        
        // Listen for auth state changes
        if (typeof firebase !== 'undefined') {
            firebase.auth().onAuthStateChanged(user => {
                if (user) {
                    currentUserId = user.uid;
                    // Regenerate schedule for new user
                    generateDailySchedule(getTodayDate(), { forceRefresh: true });
                } else {
                    currentUserId = null;
                    scheduleCache.clear();
                    currentSchedule = null;
                }
            });
        }
    }

    // ===== PRIORITY SCORING ALGORITHM =====
    
    /**
     * Calculate priority score for a study item
     * @param {Object} item - Study item (exam, task, or subject)
     * @param {Object} context - Current context (user performance, date, etc.)
     * @returns {number} Priority score (0-1000)
     */
    function calculatePriorityScore(item, context) {
        const scores = {
            examProximity: 0,
            subjectWeakness: 0,
            taskUrgency: 0,
            overduePenalty: 0
        };

        // 1. EXAM PROXIMITY SCORE
        if (item.examDate) {
            const daysToExam = getDaysUntilDate(item.examDate);
            const proximityScore = calculateExamProximityScore(daysToExam, item.difficulty);
            scores.examProximity = proximityScore * CONFIG.weights.examProximity;
        }

        // 2. SUBJECT WEAKNESS SCORE
        if (item.subjectId) {
            const weeklyFocusTime = getSubjectFocusTime(item.subjectId, 7);
            const weaknessScore = calculateWeaknessScore(weeklyFocusTime);
            scores.subjectWeakness = weaknessScore * CONFIG.weights.subjectWeakness;
        }

        // 3. TASK URGENCY SCORE
        if (item.dueDate) {
            const daysToDue = getDaysUntilDate(item.dueDate);
            const urgencyScore = calculateTaskUrgencyScore(daysToDue, item.priority);
            scores.taskUrgency = urgencyScore * CONFIG.weights.taskUrgency;
        }

        // 4. OVERDUE PENALTY
        if (item.dueDate && isOverdue(item.dueDate)) {
            scores.overduePenalty = 200; // High penalty for overdue items
        }

        // Calculate final weighted score
        const totalScore = 
            scores.examProximity +
            scores.subjectWeakness +
            scores.taskUrgency +
            scores.overduePenalty;

        return Math.min(totalScore * 10, 1000); // Cap at 1000
    }

    function calculateExamProximityScore(daysToExam, difficulty = 'medium') {
        if (daysToExam < 0) return 0; // Past exam
        
        const difficultyMultiplier = {
            'easy': 0.7,
            'medium': 1.0,
            'hard': 1.3
        }[difficulty] || 1.0;

        // Exponential urgency curve
        if (daysToExam <= 2) return 100 * difficultyMultiplier;
        if (daysToExam <= 5) return 80 * difficultyMultiplier;
        if (daysToExam <= 10) return 60 * difficultyMultiplier;
        if (daysToExam <= 20) return 40 * difficultyMultiplier;
        return 20 * difficultyMultiplier;
    }

    function calculateWeaknessScore(weeklyFocusMinutes) {
        if (weeklyFocusMinutes < CONFIG.weakSubjectThreshold) {
            return 100; // Very weak - high priority
        } else if (weeklyFocusMinutes < 60) {
            return 70; // Weak - medium priority
        } else if (weeklyFocusMinutes < 120) {
            return 40; // Below average
        }
        return 10; // Sufficient focus
    }

    function calculateTaskUrgencyScore(daysToDue, priority = 'medium') {
        const priorityMultiplier = {
            'high': 1.5,
            'medium': 1.0,
            'low': 0.5
        }[priority] || 1.0;

        if (daysToDue < 0) return 100 * priorityMultiplier; // Overdue
        if (daysToDue === 0) return 90 * priorityMultiplier; // Due today
        if (daysToDue === 1) return 70 * priorityMultiplier; // Due tomorrow
        if (daysToDue <= 3) return 50 * priorityMultiplier;
        if (daysToDue <= 7) return 30 * priorityMultiplier;
        return 10 * priorityMultiplier;
    }

    // ===== STUDY BLOCK GENERATION =====
    
    /**
     * Generate study blocks for available time
     * @param {number} availableMinutes - Total available study time
     * @param {Array} priorities - Sorted priority items
     * @returns {Array} Study blocks with breaks
     */
    function generateStudyBlocks(availableMinutes, priorities) {
        const blocks = [];
        let remainingMinutes = availableMinutes;
        let usedSubjects = new Set();
        let lastSubject = null;

        for (const item of priorities) {
            if (remainingMinutes < 20) break; // Minimum session time
            if (blocks.length >= CONFIG.maxSessionsPerDay) break;

            // Determine session type based on exam proximity
            const sessionType = determineSessionType(item);
            const sessionDuration = CONFIG.sessionDurations[sessionType];

            // Skip if not enough time
            if (sessionDuration > remainingMinutes) continue;

            // Smart distribution: avoid consecutive same subjects
            if (item.subjectId === lastSubject && priorities.length > 1) {
                // Try to find different subject
                continue;
            }

            // Create study block
            const block = {
                id: generateBlockId(),
                subjectId: item.subjectId,
                subjectName: item.subjectName,
                type: sessionType,
                duration: sessionDuration,
                task: item.task || item.topic || `${sessionType} session`,
                priorityScore: item.priorityScore,
                examDate: item.examDate,
                color: item.color || '#6366f1',
                timestamp: Date.now()
            };

            blocks.push(block);
            remainingMinutes -= sessionDuration;
            lastSubject = item.subjectId;
            usedSubjects.add(item.subjectId);

            // Add break after block (except last block)
            if (remainingMinutes > 10 && blocks.length < CONFIG.maxSessionsPerDay) {
                const breakDuration = selectBreakDuration(sessionDuration);
                blocks.push({
                    id: generateBlockId(),
                    type: 'break',
                    duration: breakDuration
                });
                remainingMinutes -= breakDuration;
            }
        }

        return blocks;
    }

    function determineSessionType(item) {
        if (!item.examDate) return 'deepWork';

        const daysToExam = getDaysUntilDate(item.examDate);

        if (daysToExam < 0) return 'deepWork'; // Past exam
        if (daysToExam <= CONFIG.examThresholds.intensive) {
            return 'mockTest'; // Intensive revision
        } else if (daysToExam <= CONFIG.examThresholds.mixed) {
            return 'revision'; // Mixed practice
        } else if (daysToExam <= CONFIG.examThresholds.coverage) {
            return 'practice'; // Coverage phase
        }
        return 'deepWork'; // Normal study
    }

    function selectBreakDuration(sessionDuration) {
        if (sessionDuration >= 90) return CONFIG.breaks.long;
        if (sessionDuration >= 60) return CONFIG.breaks.medium;
        return CONFIG.breaks.short;
    }

    // ===== SCHEDULE GENERATION =====
    
    /**
     * Generate complete daily schedule
     * @param {string} date - Target date (YYYY-MM-DD)
     * @param {Object} options - Override options
     * @returns {Object} Daily schedule
     */
    async function generateDailySchedule(date = getTodayDate(), options = {}) {
        try {
            // Check cache first
            const cached = getCachedSchedule(date);
            if (cached && !options.forceRefresh) {
                console.log('📋 Using cached schedule for', date);
                return cached;
            }

            console.log('🔄 Generating new schedule for', date);

            // Gather all inputs
            const exams = getExams();
            const tasks = getTasks();
            const subjects = getSubjects();
            const userPreferences = getUserPreferences();
            const performanceData = getPerformanceData();

            // Create priority items from all sources
            const priorityItems = [];

            // Add exam-based items
            for (const exam of exams) {
                const subject = subjects.find(s => s.id === exam.subjectId);
                const daysToExam = getDaysUntilDate(exam.date);
                
                if (daysToExam < 0 || daysToExam > 30) continue; // Skip past/distant exams

                priorityItems.push({
                    id: exam.id,
                    type: 'exam',
                    subjectId: exam.subjectId,
                    subjectName: subject?.name || 'Unknown',
                    topic: exam.name,
                    examDate: exam.date,
                    difficulty: exam.difficulty || 'medium',
                    color: subject?.color || '#6366f1',
                    priorityScore: 0 // Will be calculated
                });
            }

            // Add task-based items
            for (const task of tasks) {
                if (task.completed) continue;

                const subject = subjects.find(s => s.id === task.subjectId);
                
                priorityItems.push({
                    id: task.id,
                    type: 'task',
                    subjectId: task.subjectId,
                    subjectName: subject?.name || 'General',
                    task: task.text,
                    dueDate: task.dueDate,
                    priority: task.priority || 'medium',
                    color: subject?.color || '#6366f1',
                    priorityScore: 0
                });
            }

            // Add weak subject items
            for (const subject of subjects) {
                const weeklyFocus = getSubjectFocusTime(subject.id, 7);
                if (weeklyFocus < CONFIG.weakSubjectThreshold) {
                    priorityItems.push({
                        id: `weak_${subject.id}`,
                        type: 'weak-subject',
                        subjectId: subject.id,
                        subjectName: subject.name,
                        topic: 'Review session',
                        color: subject.color,
                        priorityScore: 0
                    });
                }
            }

            // Calculate priority scores
            for (const item of priorityItems) {
                item.priorityScore = calculatePriorityScore(item, {
                    date,
                    performance: performanceData
                });
            }

            // Sort by priority score (descending)
            priorityItems.sort((a, b) => b.priorityScore - a.priorityScore);

            // Generate study blocks
            const availableMinutes = (options.studyHours || userPreferences.studyHours || CONFIG.defaultStudyHours) * 60;
            const blocks = generateStudyBlocks(availableMinutes, priorityItems);

            // Add spaced repetition sessions
            const revisionBlocks = generateRevisionBlocks(date, subjects);
            blocks.push(...revisionBlocks);

            // Create schedule object
            const schedule = {
                date,
                generatedAt: new Date().toISOString(),
                totalMinutes: blocks.reduce((sum, b) => sum + (b.duration || 0), 0),
                sessionCount: blocks.filter(b => b.type !== 'break').length,
                blocks,
                metadata: {
                    priorityItems: priorityItems.length,
                    availableMinutes,
                    algorithm: 'weighted-priority-v1'
                }
            };

            // Cache schedule
            cacheSchedule(date, schedule);

            // Save to Firestore
            if (currentUserId && typeof firebase !== 'undefined') {
                saveScheduleToFirestore(schedule);
            }

            // Update current schedule
            currentSchedule = schedule;
            lastCalculation = Date.now();

            // Dispatch event
            document.dispatchEvent(new CustomEvent('scheduleGenerated', { detail: schedule }));

            return schedule;

        } catch (error) {
            console.error('❌ Schedule generation error:', error);
            return createEmptySchedule(date);
        }
    }

    /**
     * Generate weekly schedule
     */
    async function generateWeeklySchedule(startDate = getTodayDate()) {
        const weekSchedule = [];
        
        for (let i = 0; i < 7; i++) {
            const date = addDays(startDate, i);
            const dailySchedule = await generateDailySchedule(date);
            weekSchedule.push(dailySchedule);
        }

        return {
            startDate,
            endDate: addDays(startDate, 6),
            days: weekSchedule,
            totalMinutes: weekSchedule.reduce((sum, day) => sum + day.totalMinutes, 0),
            totalSessions: weekSchedule.reduce((sum, day) => sum + day.sessionCount, 0)
        };
    }

    // ===== SPACED REPETITION =====
    
    function generateRevisionBlocks(date, subjects) {
        const revisionBlocks = [];
        const completedSessions = getCompletedFocusSessions();

        for (const session of completedSessions) {
            const sessionDate = new Date(session.completedAt).toISOString().split('T')[0];
            
            for (const interval of CONFIG.revisionIntervals) {
                const revisionDate = addDays(sessionDate, interval);
                
                if (revisionDate === date) {
                    const subject = subjects.find(s => s.id === session.subjectId);
                    if (!subject) continue;

                    revisionBlocks.push({
                        id: `revision_${session.id}_${interval}d`,
                        type: 'revision',
                        subjectId: subject.id,
                        subjectName: subject.name,
                        duration: CONFIG.sessionDurations.flashReview,
                        task: `${interval}-day revision`,
                        color: subject.color,
                        isRevision: true
                    });
                }
            }
        }

        return revisionBlocks;
    }

    // ===== CACHING LAYER =====
    
    function getCachedSchedule(date) {
        const cached = scheduleCache.get(date);
        if (!cached) return null;

        // Check if cache expired
        const age = Date.now() - cached.timestamp;
        if (age > CONFIG.cacheExpiry) {
            scheduleCache.delete(date);
            return null;
        }

        return cached.schedule;
    }

    function cacheSchedule(date, schedule) {
        scheduleCache.set(date, {
            schedule,
            timestamp: Date.now()
        });

        // Save to localStorage
        try {
            localStorage.setItem(`schedule_${date}`, JSON.stringify({
                schedule,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Failed to cache schedule to localStorage:', e);
        }
    }

    function loadCachedSchedule() {
        try {
            const today = getTodayDate();
            const cached = localStorage.getItem(`schedule_${today}`);
            if (cached) {
                const { schedule, timestamp } = JSON.parse(cached);
                const age = Date.now() - timestamp;
                
                if (age < CONFIG.cacheExpiry) {
                    scheduleCache.set(today, { schedule, timestamp });
                    currentSchedule = schedule;
                    console.log('✅ Loaded cached schedule from localStorage');
                }
            }
        } catch (e) {
            console.warn('Failed to load cached schedule:', e);
        }
    }

    // ===== DEBOUNCED RECALCULATION =====
    
    function scheduleRecalculation(delay = 3000) {
        if (recalculationTimeout) {
            clearTimeout(recalculationTimeout);
        }

        recalculationTimeout = setTimeout(async () => {
            console.log('🔄 Recalculating schedule...');
            await generateDailySchedule(getTodayDate(), { forceRefresh: true });
        }, delay);
    }

    // ===== FIREBASE SYNC =====
    
    async function saveScheduleToFirestore(schedule) {
        if (!currentUserId || typeof firebase === 'undefined') return;

        try {
            await firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection('schedules')
                .doc(schedule.date)
                .set({
                    ...schedule,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            
            console.log('✅ Schedule saved to Firestore:', schedule.date);
        } catch (error) {
            console.error('❌ Failed to save schedule:', error);
        }
    }

    // ===== DATA ACCESSORS =====
    
    function getExams() {
        try {
            return JSON.parse(localStorage.getItem('exams') || '[]');
        } catch {
            return [];
        }
    }

    function getTasks() {
        try {
            return JSON.parse(localStorage.getItem('tasks') || '[]');
        } catch {
            return [];
        }
    }

    function getSubjects() {
        try {
            return JSON.parse(localStorage.getItem('subjects') || '[]');
        } catch {
            return [];
        }
    }

    function getCompletedFocusSessions() {
        try {
            return JSON.parse(localStorage.getItem('focusSessions') || '[]');
        } catch {
            return [];
        }
    }

    function getUserPreferences() {
        try {
            const prefs = JSON.parse(localStorage.getItem('studyPreferences') || '{}');
            return {
                studyHours: prefs.studyHours || CONFIG.defaultStudyHours,
                preferredTimes: prefs.preferredTimes || [],
                breakPreference: prefs.breakPreference || 'medium'
            };
        } catch {
            return {
                studyHours: CONFIG.defaultStudyHours,
                preferredTimes: [],
                breakPreference: 'medium'
            };
        }
    }

    function getPerformanceData() {
        const tasks = getTasks();
        const completedTasks = tasks.filter(t => t.completed).length;
        const totalTasks = tasks.length || 1;

        return {
            completionRate: completedTasks / totalTasks,
            totalFocusMinutes: calculateTotalFocusTime(),
            averageSessionDuration: calculateAverageSessionDuration()
        };
    }

    function getSubjectFocusTime(subjectId, days = 7) {
        const sessions = getCompletedFocusSessions();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        let totalMinutes = 0;
        for (const session of sessions) {
            if (session.subjectId === subjectId) {
                const sessionDate = new Date(session.completedAt);
                if (sessionDate >= cutoffDate) {
                    totalMinutes += Math.floor(session.duration / 60);
                }
            }
        }

        return totalMinutes;
    }

    function calculateTotalFocusTime() {
        const sessions = getCompletedFocusSessions();
        return sessions.reduce((sum, s) => sum + (s.duration / 60), 0);
    }

    function calculateAverageSessionDuration() {
        const sessions = getCompletedFocusSessions();
        if (sessions.length === 0) return 0;
        return calculateTotalFocusTime() / sessions.length;
    }

    // ===== UTILITY FUNCTIONS =====
    
    function getTodayDate() {
        return new Date().toISOString().split('T')[0];
    }

    function addDays(dateStr, days) {
        const date = new Date(dateStr);
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
    }

    function getDaysUntilDate(dateStr) {
        const target = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        target.setHours(0, 0, 0, 0);
        const diffMs = target - today;
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    function isOverdue(dateStr) {
        return getDaysUntilDate(dateStr) < 0;
    }

    function generateBlockId() {
        return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    function createEmptySchedule(date) {
        return {
            date,
            generatedAt: new Date().toISOString(),
            totalMinutes: 0,
            sessionCount: 0,
            blocks: [],
            metadata: {
                error: 'Failed to generate schedule',
                priorityItems: 0
            }
        };
    }

    // ===== PUBLIC API =====
    
    return {
        init,
        generateDailySchedule,
        generateWeeklySchedule,
        getCurrentSchedule: () => currentSchedule,
        scheduleRecalculation,
        calculatePriorityScore,
        getConfig: () => CONFIG,
        clearCache: () => {
            scheduleCache.clear();
            console.log('🗑️ Schedule cache cleared');
        }
    };
})();

// NOTE: No auto-initialization - controlled by StartupManager Phase 3 (lazy loading)
// Study Scheduler loads only when user opens the Academics tab for optimal startup performance

// Export globally
window.StudyScheduler = StudyScheduler;
