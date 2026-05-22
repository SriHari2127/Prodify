// ===== SMART STUDY PLANNER MODULE =====
// Generates personalized study suggestions based on multiple data sources

const SmartStudyPlanner = (function() {
    'use strict';

    let isInitialized = false;
    let suggestions = [];
    let lastRefreshDate = null;

    // Priority weights for sorting
    const PRIORITY_WEIGHTS = {
        URGENT_EXAM: 1000,
        HIGH_EXAM: 800,
        OVERDUE_TASK: 900,
        URGENT_TASK: 700,
        WEAK_SUBJECT: 600,
        INCOMPLETE_HABIT: 500,
        DUE_TASK: 400,
        MISSED_TASK: 350
    };

    function init() {
        if (isInitialized) return;
        console.log("🎯 Initializing Smart Study Planner...");
        isInitialized = true;
    }

    // Main function to generate suggestions
    function generateSuggestions() {
        suggestions = [];
        const today = new Date();
        const dateKey = today.toISOString().split('T')[0];

        // Check if we need to refresh (once per day)
        if (lastRefreshDate === dateKey && suggestions.length > 0) {
            return suggestions;
        }

        lastRefreshDate = dateKey;

        // 1. Check for upcoming exams
        addExamSuggestions();

        // 2. Check tasks with deadlines
        addTaskDeadlineSuggestions();

        // 3. Detect weak subjects (low study time)
        addWeakSubjectSuggestions();

        // 4. Check incomplete habits
        addHabitSuggestions();

        // 5. Check missed tasks from yesterday
        addMissedTaskSuggestions();

        // Sort by priority weight (descending)
        suggestions.sort((a, b) => b.priority - a.priority);

        // Limit to 3-5 suggestions
        suggestions = suggestions.slice(0, 5);

        // Ensure variety (at least 2 different types if possible)
        suggestions = ensureVariety(suggestions);

        return suggestions;
    }

    // === EXAM LOGIC ===
    function addExamSuggestions() {
        try {
            const exams = JSON.parse(localStorage.getItem('exams')) || [];
            const today = new Date();

            exams.forEach(exam => {
                if (!exam.date) return;
                
                const examDate = new Date(exam.date);
                const daysUntil = Math.floor((examDate - today) / (1000 * 60 * 60 * 24));

                if (daysUntil < 0) return; // Skip past exams
                
                let priority = PRIORITY_WEIGHTS.HIGH_EXAM;
                let urgencyLabel = 'Important';
                let icon = 'fa-book';
                
                if (daysUntil <= 2) {
                    priority = PRIORITY_WEIGHTS.URGENT_EXAM;
                    urgencyLabel = 'URGENT';
                    icon = 'fa-triangle-exclamation';
                } else if (daysUntil <= 5) {
                    priority = PRIORITY_WEIGHTS.URGENT_EXAM - 100;
                    urgencyLabel = 'High Priority';
                    icon = 'fa-fire';
                } else if (daysUntil <= 10) {
                    urgencyLabel = 'Important';
                }

                suggestions.push({
                    id: `exam-${exam.id || exam.name}`,
                    type: 'exam',
                    title: `${exam.name} Revision`,
                    description: `Exam in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`,
                    icon: icon,
                    priority: priority,
                    urgency: urgencyLabel,
                    action: () => switchTab('academics'),
                    data: exam
                });
            });
        } catch (e) {
            console.error('Error processing exam suggestions:', e);
        }
    }

    // === TASK DEADLINE LOGIC ===
    function addTaskDeadlineSuggestions() {
        try {
            const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            tasks.forEach(task => {
                if (task.completed || !task.dueDate) return;

                const dueDate = new Date(task.dueDate);
                dueDate.setHours(0, 0, 0, 0);
                const daysUntil = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));

                let priority = 0;
                let urgencyLabel = '';
                let icon = 'fa-clipboard-list';
                let description = '';

                if (daysUntil < 0) {
                    // Overdue
                    priority = PRIORITY_WEIGHTS.OVERDUE_TASK;
                    urgencyLabel = 'OVERDUE';
                    icon = 'fa-triangle-exclamation';
                    description = `${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? 's' : ''} overdue`;
                } else if (daysUntil === 0) {
                    // Due today
                    priority = PRIORITY_WEIGHTS.URGENT_TASK;
                    urgencyLabel = 'Due Today';
                    icon = 'fa-clock';
                    description = 'Due today';
                } else if (daysUntil === 1) {
                    // Due tomorrow
                    priority = PRIORITY_WEIGHTS.URGENT_TASK - 50;
                    urgencyLabel = 'Urgent';
                    icon = 'fa-calendar-day';
                    description = 'Due tomorrow';
                } else if (daysUntil <= 3) {
                    // Due within 3 days
                    priority = PRIORITY_WEIGHTS.DUE_TASK;
                    urgencyLabel = 'Important';
                    icon = 'fa-list-check';
                    description = `Due in ${daysUntil} days`;
                } else {
                    return; // Don't suggest tasks due in more than 3 days
                }

                suggestions.push({
                    id: `task-${task.id}`,
                    type: 'task',
                    title: task.text.length > 40 ? task.text.substring(0, 40) + '...' : task.text,
                    description: description,
                    icon: icon,
                    priority: priority,
                    urgency: urgencyLabel,
                    action: () => switchTab('tasks'),
                    data: task
                });
            });
        } catch (e) {
            console.error('Error processing task deadline suggestions:', e);
        }
    }

    // === WEAK SUBJECT DETECTION ===
    function addWeakSubjectSuggestions() {
        try {
            const focusSessions = JSON.parse(localStorage.getItem('focusSessions')) || [];
            const subjects = JSON.parse(localStorage.getItem('subjects')) || [];
            
            if (subjects.length === 0) return;

            const today = new Date();
            const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

            // Calculate study time per subject (last 7 days)
            const subjectStudyTime = {};
            subjects.forEach(subj => {
                subjectStudyTime[subj.id] = 0;
            });

            focusSessions.forEach(session => {
                if (!session.subjectId || !session.date) return;
                const sessionDate = new Date(session.date);
                if (sessionDate >= sevenDaysAgo) {
                    if (subjectStudyTime[session.subjectId] !== undefined) {
                        subjectStudyTime[session.subjectId] += session.duration || 0;
                    }
                }
            });

            // Find subjects with lowest study time
            const sortedSubjects = subjects
                .map(subj => ({
                    ...subj,
                    studyTime: subjectStudyTime[subj.id] || 0
                }))
                .sort((a, b) => a.studyTime - b.studyTime);

            // Suggest the weakest subject (if it has less than 2 hours in past week)
            const weakestSubject = sortedSubjects[0];
            if (weakestSubject && weakestSubject.studyTime < 120) {
                const hours = Math.round(weakestSubject.studyTime / 60 * 10) / 10;
                suggestions.push({
                    id: `weak-subject-${weakestSubject.id}`,
                    type: 'weak_subject',
                    title: `${weakestSubject.name} Review`,
                    description: `Only ${hours}h this week`,
                    icon: 'fa-book-open',
                    priority: PRIORITY_WEIGHTS.WEAK_SUBJECT,
                    urgency: 'Recommended',
                    action: () => switchTab('academics'),
                    data: weakestSubject
                });
            }
        } catch (e) {
            console.error('Error processing weak subject suggestions:', e);
        }
    }

    // === HABIT REMINDER LOGIC ===
    function addHabitSuggestions() {
        try {
            const habits = JSON.parse(localStorage.getItem('habits')) || [];
            const today = new Date().toISOString().split('T')[0];

            habits.forEach(habit => {
                if (!habit.lastCompleted || habit.lastCompleted !== today) {
                    // Check if habit is scheduled for today
                    const isDueToday = isHabitScheduledToday(habit);
                    
                    if (isDueToday) {
                        suggestions.push({
                            id: `habit-${habit.id}`,
                            type: 'habit',
                            title: `Complete "${habit.name}"`,
                            description: `Maintain your ${habit.streak || 0}-day streak`,
                            icon: 'fa-fire',
                            priority: PRIORITY_WEIGHTS.INCOMPLETE_HABIT,
                            urgency: 'Daily Goal',
                            action: () => switchTab('habits'),
                            data: habit
                        });
                    }
                }
            });
        } catch (e) {
            console.error('Error processing habit suggestions:', e);
        }
    }

    // === MISSED TASKS FROM YESTERDAY ===
    function addMissedTaskSuggestions() {
        try {
            const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
            const today = new Date();
            const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
            const yesterdayKey = yesterday.toISOString().split('T')[0];

            tasks.forEach(task => {
                if (task.completed || !task.dueDate) return;
                
                const taskDueDate = task.dueDate.split('T')[0]; // Get date part only
                
                if (taskDueDate === yesterdayKey) {
                    suggestions.push({
                        id: `missed-${task.id}`,
                        type: 'missed_task',
                        title: task.text.length > 40 ? task.text.substring(0, 40) + '...' : task.text,
                        description: 'Missed yesterday',
                        icon: 'fa-clock-rotate-left',
                        priority: PRIORITY_WEIGHTS.MISSED_TASK,
                        urgency: 'Carry Over',
                        action: () => switchTab('tasks'),
                        data: task
                    });
                }
            });
        } catch (e) {
            console.error('Error processing missed task suggestions:', e);
        }
    }

    // === ENSURE VARIETY IN SUGGESTIONS ===
    function ensureVariety(suggestions) {
        if (suggestions.length <= 3) return suggestions;

        const typeCount = {};
        const balanced = [];
        
        // First pass: add one of each type
        const types = ['exam', 'task', 'weak_subject', 'habit', 'missed_task'];
        types.forEach(type => {
            const item = suggestions.find(s => s.type === type && !balanced.includes(s));
            if (item) {
                balanced.push(item);
                typeCount[type] = 1;
            }
        });

        // Second pass: fill remaining slots with highest priority
        suggestions.forEach(item => {
            if (balanced.length >= 5) return;
            if (!balanced.includes(item)) {
                balanced.push(item);
            }
        });

        return balanced.slice(0, 5);
    }

    // === HELPER: Check if habit is scheduled for today ===
    function isHabitScheduledToday(habit) {
        const today = new Date().getDay(); // 0 = Sunday, 6 = Saturday
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const todayName = dayNames[today];

        if (!habit.frequency || habit.frequency === 'daily') {
            return true;
        }

        if (habit.frequency === 'weekly') {
            return true; // Assume any 3 days is flexible
        }

        if (habit.frequency === 'specific_days' && habit.selectedDays) {
            return habit.selectedDays.includes(todayName);
        }

        return true; // Default to true if uncertain
    }

    // === RENDER FUNCTION ===
    function render(containerId = 'dashboardStudyPlanner') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const suggestions = generateSuggestions();

        if (suggestions.length === 0) {
            container.innerHTML = `
                <div class="smart-planner">
                    <div class="smart-planner__header">
                        <h3 class="smart-planner__title"><i class="fa-solid fa-sparkles"></i> Today's Study Plan</h3>
                    </div>
                    <div class="empty-state" style="display: flex; padding: 40px 20px;">
                        <div class="empty-state__icon"><i class="fa-solid fa-check-circle"></i></div>
                        <p class="empty-state__title">All Clear!</p>
                        <p class="empty-state__subtitle">You're all caught up. Great work!</p>
                    </div>
                </div>
            `;
            return;
        }

        const suggestionsHtml = suggestions.map(suggestion => {
            const urgencyClass = suggestion.urgency === 'URGENT' || suggestion.urgency === 'OVERDUE' 
                ? 'smart-planner__card--urgent' 
                : suggestion.urgency === 'High Priority'
                ? 'smart-planner__card--high'
                : '';

            return `
                <div class="smart-planner__card ${urgencyClass}" onclick="(${suggestion.action.toString()})()">
                    <div class="smart-planner__card-icon">
                        <i class="fa-solid ${suggestion.icon}"></i>
                    </div>
                    <div class="smart-planner__card-content">
                        <h4 class="smart-planner__card-title">${suggestion.title}</h4>
                        <p class="smart-planner__card-desc">${suggestion.description}</p>
                    </div>
                    <div class="smart-planner__card-badge">
                        ${suggestion.urgency}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="smart-planner">
                <div class="smart-planner__header">
                    <h3 class="smart-planner__title"><i class="fa-solid fa-sparkles"></i> Today's Study Plan</h3>
                    <button class="smart-planner__refresh" onclick="SmartStudyPlanner.refresh()" title="Refresh suggestions">
                        <i class="fa-solid fa-rotate"></i>
                    </button>
                </div>
                <div class="smart-planner__grid">
                    ${suggestionsHtml}
                </div>
            </div>
        `;
    }

    // === REFRESH FUNCTION ===
    function refresh() {
        lastRefreshDate = null; // Force regeneration
        render();
        
        // Optional: Show a quick notification
        if (typeof Notify !== 'undefined') {
            Notify.success('Study plan refreshed!');
        }
    }

    // === PUBLIC API ===
    return {
        init: init,
        render: render,
        refresh: refresh,
        generateSuggestions: generateSuggestions
    };
})();
