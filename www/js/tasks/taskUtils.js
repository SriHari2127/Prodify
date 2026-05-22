// ===== TASK UTILITIES MODULE (taskUtils.js) =====
// Utility functions for Smart Task Management

/**
 * Calculate countdown text from a due date
 * @param {string} dueDate - ISO date string (YYYY-MM-DD)
 * @param {string} dueTime - Time string (HH:MM) optional
 * @returns {object} { text: string, status: 'overdue'|'today'|'upcoming'|'future', daysLeft: number }
 */
function calculateCountdown(dueDate, dueTime = null) {
    if (!dueDate) return { text: '', status: 'none', daysLeft: null };

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    // Parse due date
    let dueDateTime;
    if (dueTime) {
        dueDateTime = new Date(`${dueDate}T${dueTime}:00`);
    } else {
        dueDateTime = new Date(`${dueDate}T23:59:59`);
    }

    const diffMs = dueDateTime - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));

    if (diffMs < 0) {
        // Overdue
        const overdueDays = Math.abs(diffDays);
        if (overdueDays === 0) {
            return { text: 'Overdue', status: 'overdue', daysLeft: 0 };
        } else if (overdueDays === 1) {
            return { text: '1 day overdue', status: 'overdue', daysLeft: -1 };
        } else {
            return { text: `${overdueDays} days overdue`, status: 'overdue', daysLeft: -overdueDays };
        }
    } else if (dueDate === todayStr) {
        // Due today
        if (diffHours <= 0) {
            return { text: 'Due now!', status: 'today', daysLeft: 0 };
        } else if (diffHours === 1) {
            return { text: '1 hour left', status: 'today', daysLeft: 0 };
        } else if (diffHours < 24) {
            return { text: `${diffHours} hours left`, status: 'today', daysLeft: 0 };
        }
        return { text: 'Due today', status: 'today', daysLeft: 0 };
    } else if (diffDays === 1) {
        return { text: 'Due tomorrow', status: 'upcoming', daysLeft: 1 };
    } else if (diffDays <= 7) {
        return { text: `${diffDays} days left`, status: 'upcoming', daysLeft: diffDays };
    } else if (diffDays <= 30) {
        const weeks = Math.floor(diffDays / 7);
        return { text: weeks === 1 ? '1 week left' : `${weeks} weeks left`, status: 'future', daysLeft: diffDays };
    } else {
        const months = Math.floor(diffDays / 30);
        return { text: months === 1 ? '1 month left' : `${months} months left`, status: 'future', daysLeft: diffDays };
    }
}

/**
 * Map priority value to display info
 * @param {string} priority - Priority value
 * @returns {object} { label: string, color: string, level: number }
 */
function getPriorityInfo(priority) {
    const priorityMap = {
        'high': { label: 'High', color: '#ef4444', level: 3 },
        'medium': { label: 'Medium', color: '#f59e0b', level: 2 },
        'low': { label: 'Low', color: '#22c55e', level: 1 },
        // Legacy mapping for existing priorities
        'vital-quick': { label: 'Urgent', color: '#ef4444', level: 3 },
        'vital-notquick': { label: 'Important', color: '#f59e0b', level: 2 },
        'notvital-quick': { label: 'Quick', color: 'var(--accent-color)', level: 1 }
    };
    return priorityMap[priority] || { label: '', color: '#6b7280', level: 0 };
}

/**
 * Calculate subtask completion percentage
 * @param {Array} subtasks - Array of subtask objects
 * @returns {number} Completion percentage (0-100)
 */
function calculateSubtaskProgress(subtasks) {
    if (!subtasks || subtasks.length === 0) return 0;
    const completed = subtasks.filter(st => st.completed).length;
    return Math.round((completed / subtasks.length) * 100);
}

/**
 * Check if all subtasks are completed
 * @param {Array} subtasks - Array of subtask objects
 * @returns {boolean}
 */
function allSubtasksCompleted(subtasks) {
    if (!subtasks || subtasks.length === 0) return true;
    return subtasks.every(st => st.completed);
}

/**
 * Generate unique ID for subtasks
 * @returns {string}
 */
function generateSubtaskId() {
    return 'st_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * Calculate next occurrence for recurring task
 * @param {string} recurrence - 'daily' | 'weekly' | 'custom'
 * @param {number} customDays - Custom interval in days (for 'custom' type)
 * @param {string} baseDate - Base date to calculate from (YYYY-MM-DD)
 * @returns {string} Next due date (YYYY-MM-DD)
 */
function calculateNextRecurrence(recurrence, customDays = 7, baseDate = null) {
    const base = baseDate ? new Date(baseDate) : new Date();
    let nextDate = new Date(base);

    switch (recurrence) {
        case 'daily':
            nextDate.setDate(nextDate.getDate() + 1);
            break;
        case 'weekly':
            nextDate.setDate(nextDate.getDate() + 7);
            break;
        case 'biweekly':
            nextDate.setDate(nextDate.getDate() + 14);
            break;
        case 'monthly':
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
        case 'custom':
            nextDate.setDate(nextDate.getDate() + (customDays || 7));
            break;
        default:
            return null;
    }

    return nextDate.toISOString().split('T')[0];
}

/**
 * Get recurrence label for display
 * @param {string} recurrence - Recurrence type
 * @param {number} customDays - Custom interval
 * @returns {string}
 */
function getRecurrenceLabel(recurrence, customDays = 7) {
    const labels = {
        'daily': '<i class="fa-solid fa-rotate"></i> Daily',
        'weekly': '<i class="fa-solid fa-rotate"></i> Weekly',
        'biweekly': '<i class="fa-solid fa-rotate"></i> Bi-weekly',
        'monthly': '<i class="fa-solid fa-rotate"></i> Monthly',
        'custom': `<i class="fa-solid fa-rotate"></i> Every ${customDays} days`
    };
    return labels[recurrence] || '';
}

/**
 * Format date for display
 * @param {string} dateStr - ISO date string
 * @returns {string}
 */
function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format time to 12-hour format
 * @param {string} time24 - 24-hour time string (HH:MM)
 * @returns {string}
 */
function formatTime12Hour(time24) {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    let h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${minutes} ${ampm}`;
}

/**
 * Sort tasks by priority and due date
 * @param {Array} tasks - Array of task objects
 * @returns {Array} Sorted tasks
 */
function sortTasksByPriorityAndDue(tasks) {
    return tasks.sort((a, b) => {
        // Completed tasks go to bottom
        if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
        }

        // Sort by priority level (higher first)
        const aPriority = getPriorityInfo(a.priority).level;
        const bPriority = getPriorityInfo(b.priority).level;
        if (aPriority !== bPriority) {
            return bPriority - aPriority;
        }

        // Sort by due date (earlier first)
        if (a.dueDate && b.dueDate) {
            return new Date(a.dueDate) - new Date(b.dueDate);
        }
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;

        return 0;
    });
}

/**
 * Check if a task should generate a recurring instance
 * @param {object} task - Task object
 * @returns {boolean}
 */
function shouldGenerateRecurrence(task) {
    return task.completed && task.recurrence && task.recurrence !== 'none';
}

/**
 * Create a recurring task instance from a completed task
 * @param {object} originalTask - The completed recurring task
 * @returns {object} New task object for the next occurrence
 */
function createRecurringTaskInstance(originalTask) {
    const nextDueDate = calculateNextRecurrence(
        originalTask.recurrence,
        originalTask.customRecurrenceDays,
        originalTask.dueDate
    );

    return {
        id: Date.now().toString() + '_rec',
        text: originalTask.text,
        completed: false,
        completedDate: null,
        dueDate: nextDueDate,
        dueTime: originalTask.dueTime || null,
        priority: originalTask.priority || null,
        subjectId: originalTask.subjectId || null,
        subtasks: originalTask.subtasks ? originalTask.subtasks.map(st => ({
            ...st,
            id: generateSubtaskId(),
            completed: false
        })) : [],
        recurrence: originalTask.recurrence,
        customRecurrenceDays: originalTask.customRecurrenceDays || null,
        parentTaskId: originalTask.id,
        createdAt: new Date().toISOString()
    };
}

// Export for use in other modules (if using ES modules)
// For now, functions are globally available
