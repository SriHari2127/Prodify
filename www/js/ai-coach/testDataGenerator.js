// ===== AI COACH TEST DATA GENERATOR =====
// Generates realistic test data for AI Coach system development and testing
// Creates synthetic focus sessions, tasks, habits, and exams

const AICoachTestDataGenerator = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    const CONFIG = {
        DAYS_OF_HISTORY: 30,
        
        SUBJECTS: [
            { id: 'subj_math', name: 'Mathematics', color: '#3b82f6' },
            { id: 'subj_physics', name: 'Physics', color: '#8b5cf6' },
            { id: 'subj_chemistry', name: 'Chemistry', color: '#10b981' },
            { id: 'subj_biology', name: 'Biology', color: '#f59e0b' },
            { id: 'subj_english', name: 'English', color: '#ef4444' }
        ],
        
        TASK_TEMPLATES: [
            'Complete homework assignment',
            'Review lecture notes',
            'Practice problems',
            'Read textbook chapter',
            'Write essay',
            'Prepare presentation',
            'Study for quiz',
            'Complete lab report'
        ],
        
        HABIT_TEMPLATES: [
            { name: 'Morning Review', frequency: 'daily' },
            { name: 'Exercise', frequency: 'daily' },
            { name: 'Journal Writing', frequency: 'daily' },
            { name: 'Reading', frequency: 'daily' }
        ]
    };

    // ===== HELPER FUNCTIONS =====
    
    function randomChoice(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    function randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function randomBool(probability = 0.5) {
        return Math.random() < probability;
    }

    function getDateDaysAgo(days) {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date;
    }

    function uid() {
        return 'test_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // ===== DATA GENERATORS =====
    
    /**
     * Generate test subjects
     * @returns {Array} Subjects array
     */
    function generateSubjects() {
        console.log('📚 Generating test subjects...');
        const subjects = CONFIG.SUBJECTS.map(subj => ({
            ...subj,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }));
        
        localStorage.setItem('subjects', JSON.stringify(subjects));
        console.log(`✅ Generated ${subjects.length} subjects`);
        return subjects;
    }

    /**
     * Generate test focus sessions
     * @param {number} days - Number of days of history
     * @returns {Array} Focus sessions array
     */
    function generateFocusSessions(days = CONFIG.DAYS_OF_HISTORY) {
        console.log('🎯 Generating test focus sessions...');
        
        let subjects;
        try {
            subjects = JSON.parse(localStorage.getItem('subjects')) || CONFIG.SUBJECTS;
        } catch (error) {
            console.error('Error parsing subjects, using default:', error);
            subjects = CONFIG.SUBJECTS;
        }
        
        const sessions = [];
        
        // Generate 2-5 sessions per day on average
        for (let i = 0; i < days; i++) {
            const date = getDateDaysAgo(i);
            const sessionsToday = randomInt(0, 6); // Some days may have 0 sessions
            
            for (let j = 0; j < sessionsToday; j++) {
                const subject = randomChoice(subjects);
                const hour = randomInt(7, 22); // Sessions between 7 AM and 10 PM
                const minute = randomInt(0, 59);
                
                const sessionStart = new Date(date);
                sessionStart.setHours(hour, minute, 0, 0);
                
                // Session duration: 15-90 minutes
                const durationSeconds = randomInt(15, 90) * 60;
                const sessionEnd = new Date(sessionStart.getTime() + (durationSeconds * 1000));
                
                // 80% success rate
                const completed = randomBool(0.8);
                
                sessions.push({
                    id: uid(),
                    subject: subject.id,
                    duration: durationSeconds,
                    completed,
                    startTime: sessionStart.toISOString(),
                    endTime: sessionEnd.toISOString(),
                    completedAt: completed ? sessionEnd.toISOString() : null,
                    createdAt: sessionStart.toISOString()
                });
            }
        }
        
        // Sort by date (oldest first)
        sessions.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        localStorage.setItem('focusSessions', JSON.stringify(sessions));
        console.log(`✅ Generated ${sessions.length} focus sessions over ${days} days`);
        return sessions;
    }

    /**
     * Generate test tasks
     * @param {number} days - Number of days of history
     * @returns {Array} Tasks array
     */
    function generateTasks(days = CONFIG.DAYS_OF_HISTORY) {
        console.log('✅ Generating test tasks...');
        
        const subjects = JSON.parse(localStorage.getItem('subjects')) || CONFIG.SUBJECTS;
        const tasks = [];
        
        // Generate 3-8 tasks per day
        for (let i = 0; i < days; i++) {
            const date = getDateDaysAgo(i);
            const tasksToday = randomInt(3, 8);
            
            for (let j = 0; j < tasksToday; j++) {
                const subject = randomChoice(subjects);
                const template = randomChoice(CONFIG.TASK_TEMPLATES);
                const title = `${template} - ${subject.name}`;
                
                const createdDate = new Date(date);
                createdDate.setHours(randomInt(8, 20), randomInt(0, 59), 0, 0);
                
                // Due date: 0-7 days from creation
                const dueDate = new Date(createdDate);
                dueDate.setDate(dueDate.getDate() + randomInt(0, 7));
                
                // 60% completion rate
                const completed = randomBool(0.6);
                const completedDate = completed 
                    ? new Date(createdDate.getTime() + randomInt(1, 5) * 24 * 60 * 60 * 1000) 
                    : null;
                
                tasks.push({
                    id: uid(),
                    title,
                    description: '',
                    subject: subject.id,
                    priority: randomChoice(['low', 'medium', 'high']),
                    dueDate: dueDate.toISOString().split('T')[0],
                    dueTime: null,
                    completed,
                    completedDate: completedDate ? completedDate.toISOString() : null,
                    subtasks: [],
                    recurrence: null,
                    customRecurrenceDays: null,
                    tags: [],
                    createdAt: createdDate.toISOString(),
                    updatedAt: createdDate.toISOString()
                });
            }
        }
        
        localStorage.setItem('tasks', JSON.stringify(tasks));
        console.log(`✅ Generated ${tasks.length} tasks`);
        return tasks;
    }

    /**
     * Generate test habits
     * @returns {Array} Habits array
     */
    function generateHabits() {
        console.log('🎯 Generating test habits...');
        
        const habits = CONFIG.HABIT_TEMPLATES.map(template => {
            // Random streak between 0-14 days
            const streak = randomInt(0, 14);
            const lastCompleted = streak > 0 
                ? getDateDaysAgo(1).toISOString() 
                : null;
            
            return {
                id: uid(),
                name: template.name,
                frequency: template.frequency,
                streak,
                lastCompleted,
                createdAt: getDateDaysAgo(30).toISOString(),
                updatedAt: new Date().toISOString()
            };
        });
        
        localStorage.setItem('habits', JSON.stringify(habits));
        console.log(`✅ Generated ${habits.length} habits`);
        return habits;
    }

    /**
     * Generate test exams
     * @returns {Array} Exams array
     */
    function generateExams() {
        console.log('📅 Generating test exams...');
        
        const subjects = JSON.parse(localStorage.getItem('subjects')) || CONFIG.SUBJECTS;
        const exams = [];
        
        // Create exams at different intervals
        const examIntervals = [
            { days: 1, name: 'Midterm' },
            { days: 3, name: 'Quiz' },
            { days: 7, name: 'Chapter Test' },
            { days: 10, name: 'Unit Exam' },
            { days: 15, name: 'Final Exam' }
        ];
        
        examIntervals.forEach(interval => {
            const subject = randomChoice(subjects);
            const examDate = new Date();
            examDate.setDate(examDate.getDate() + interval.days);
            
            exams.push({
                id: uid(),
                name: `${subject.name} ${interval.name}`,
                subjectId: subject.id,
                date: examDate.toISOString().split('T')[0]
            });
        });
        
        localStorage.setItem('exams', JSON.stringify(exams));
        console.log(`✅ Generated ${exams.length} exams`);
        return exams;
    }

    /**
     * Generate test study blocks (study planner)
     * @returns {Array} Study blocks array
     */
    function generateStudyBlocks() {
        console.log('📆 Generating test study blocks...');
        
        const subjects = JSON.parse(localStorage.getItem('subjects')) || CONFIG.SUBJECTS;
        const studyBlocks = [];
        
        // Create a few study blocks per subject
        subjects.forEach(subject => {
            const blocksForSubject = randomInt(2, 4);
            
            for (let i = 0; i < blocksForSubject; i++) {
                studyBlocks.push({
                    id: uid(),
                    subjectId: subject.id,
                    duration: randomInt(30, 120), // 30-120 minutes
                    day: randomChoice(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
                    time: `${randomInt(8, 20)}:00`
                });
            }
        });
        
        localStorage.setItem('studyBlocks', JSON.stringify(studyBlocks));
        console.log(`✅ Generated ${studyBlocks.length} study blocks`);
        return studyBlocks;
    }

    /**
     * Generate complete test dataset
     * @param {Object} options - Generation options
     * @returns {Object} Generated data summary
     */
    function generateAll(options = {}) {
        const {
            days = CONFIG.DAYS_OF_HISTORY,
            includeSubjects = true,
            includeFocusSessions = true,
            includeTasks = true,
            includeHabits = true,
            includeExams = true,
            includeStudyBlocks = true
        } = options;

        console.log('🚀 Generating complete AI Coach test dataset...');
        console.log(`📊 Parameters: ${days} days of history`);
        
        const results = {};
        
        try {
            if (includeSubjects) {
                results.subjects = generateSubjects();
            }
            
            if (includeFocusSessions) {
                results.focusSessions = generateFocusSessions(days);
            }
            
            if (includeTasks) {
                results.tasks = generateTasks(days);
            }
            
            if (includeHabits) {
                results.habits = generateHabits();
            }
            
            if (includeExams) {
                results.exams = generateExams();
            }
            
            if (includeStudyBlocks) {
                results.studyBlocks = generateStudyBlocks();
            }
            
            console.log('✅ Test dataset generation complete!');
            console.log('📊 Summary:');
            Object.keys(results).forEach(key => {
                console.log(`   ${key}: ${results[key].length} items`);
            });
            
            // Trigger AI Coach recalculation
            if (typeof AICoachEngine !== 'undefined') {
                console.log('🤖 Triggering AI Coach analysis...');
                AICoachEngine.recalculateInsights('test_data_generated');
            }
            
            return results;
            
        } catch (error) {
            console.error('❌ Error generating test data:', error);
            return null;
        }
    }

    /**
     * Clear all test data
     */
    function clearAll() {
        console.log('🗑️ Clearing all test data...');
        
        const keys = [
            'subjects',
            'focusSessions',
            'tasks',
            'habits',
            'exams',
            'studyBlocks'
        ];
        
        keys.forEach(key => {
            localStorage.removeItem(key);
        });
        
        // Also clear AI Coach cache
        localStorage.removeItem('ai_coach_cache');
        
        console.log('✅ Test data cleared');
    }

    /**
     * Generate specific scenario datasets
     */
    const scenarios = {
        // Excellent student scenario
        excellentStudent: function() {
            console.log('🌟 Generating Excellent Student scenario...');
            
            generateSubjects();
            const subjects = JSON.parse(localStorage.getItem('subjects'));
            
            // Lots of consistent focus sessions
            const sessions = [];
            for (let i = 0; i < 30; i++) {
                const date = getDateDaysAgo(i);
                const sessionsToday = randomInt(4, 6);
                
                for (let j = 0; j < sessionsToday; j++) {
                    const subject = randomChoice(subjects);
                    const hour = i < 7 ? randomInt(17, 21) : randomInt(9, 21); // Recent days evening focused
                    const minute = randomInt(0, 59);
                    
                    const sessionStart = new Date(date);
                    sessionStart.setHours(hour, minute, 0, 0);
                    const durationSeconds = randomInt(40, 60) * 60; // 40-60 min sessions
                    const sessionEnd = new Date(sessionStart.getTime() + (durationSeconds * 1000));
                    
                    sessions.push({
                        id: uid(),
                        subject: subject.id,
                        duration: durationSeconds,
                        completed: randomBool(0.95), // 95% success rate
                        startTime: sessionStart.toISOString(),
                        endTime: sessionEnd.toISOString(),
                        completedAt: sessionEnd.toISOString(),
                        createdAt: sessionStart.toISOString()
                    });
                }
            }
            localStorage.setItem('focusSessions', JSON.stringify(sessions));
            
            // High task completion
            const tasks = [];
            for (let i = 0; i < 30; i++) {
                const date = getDateDaysAgo(i);
                for (let j = 0; j < randomInt(5, 8); j++) {
                    const subject = randomChoice(subjects);
                    tasks.push({
                        id: uid(),
                        title: `${randomChoice(CONFIG.TASK_TEMPLATES)} - ${subject.name}`,
                        completed: randomBool(0.85), // 85% completion
                        completedDate: randomBool(0.85) ? getDateDaysAgo(i - randomInt(0, 2)).toISOString() : null,
                        createdAt: date.toISOString()
                    });
                }
            }
            localStorage.setItem('tasks', JSON.stringify(tasks));
            
            // Strong habits
            const habits = CONFIG.HABIT_TEMPLATES.map(template => ({
                id: uid(),
                name: template.name,
                streak: randomInt(10, 20),
                lastCompleted: getDateDaysAgo(1).toISOString()
            }));
            localStorage.setItem('habits', JSON.stringify(habits));
            
            generateExams();
            generateStudyBlocks();
            
            console.log('✅ Excellent Student scenario ready');
        },
        
        // Struggling student scenario
        strugglingStudent: function() {
            console.log('⚠️ Generating Struggling Student scenario...');
            
            generateSubjects();
            const subjects = JSON.parse(localStorage.getItem('subjects'));
            
            // Sparse, inconsistent focus sessions
            const sessions = [];
            for (let i = 0; i < 30; i++) {
                const date = getDateDaysAgo(i);
                const sessionsToday = randomBool(0.4) ? randomInt(0, 2) : 0; // Many days with no sessions
                
                for (let j = 0; j < sessionsToday; j++) {
                    const subject = randomChoice(subjects);
                    const sessionStart = new Date(date);
                    sessionStart.setHours(randomInt(10, 22), randomInt(0, 59), 0, 0);
                    const durationSeconds = randomInt(10, 30) * 60; // Short sessions
                    
                    sessions.push({
                        id: uid(),
                        subject: subject.id,
                        duration: durationSeconds,
                        completed: randomBool(0.5), // 50% success rate
                        completedAt: sessionStart.toISOString(),
                        createdAt: sessionStart.toISOString()
                    });
                }
            }
            localStorage.setItem('focusSessions', JSON.stringify(sessions));
            
            // Low task completion
            const tasks = [];
            for (let i = 0; i < 30; i++) {
                const date = getDateDaysAgo(i);
                for (let j = 0; j < randomInt(2, 5); j++) {
                    tasks.push({
                        id: uid(),
                        title: randomChoice(CONFIG.TASK_TEMPLATES),
                        completed: randomBool(0.3), // 30% completion
                        completedDate: null,
                        createdAt: date.toISOString()
                    });
                }
            }
            localStorage.setItem('tasks', JSON.stringify(tasks));
            
            // Broken habits
            const habits = CONFIG.HABIT_TEMPLATES.map(template => ({
                id: uid(),
                name: template.name,
                streak: randomInt(0, 3),
                lastCompleted: null
            }));
            localStorage.setItem('habits', JSON.stringify(habits));
            
            generateExams();
            localStorage.setItem('studyBlocks', JSON.stringify([]));
            
            console.log('✅ Struggling Student scenario ready');
        }
    };

    // ===== PUBLIC API =====
    return {
        generateAll,
        generateSubjects,
        generateFocusSessions,
        generateTasks,
        generateHabits,
        generateExams,
        generateStudyBlocks,
        clearAll,
        scenarios
    };
})();

// Make globally accessible for console testing
window.TestDataGenerator = AICoachTestDataGenerator;

console.log('🧪 AI Coach Test Data Generator loaded');
console.log('Usage: TestDataGenerator.generateAll() or TestDataGenerator.scenarios.excellentStudent()');
