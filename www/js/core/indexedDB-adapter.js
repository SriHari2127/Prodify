// ===== MIGRATION HELPER =====
// This file helps transition from localStorage to IndexedDB
// Include this after indexedDB.js during migration period

// ===== BACKWARD COMPATIBILITY LAYER =====

/**
 * Provides localStorage-like API that uses IndexedDB under the hood
 * Allows gradual migration without breaking existing code
 */
const StorageCompat = {
    /**
     * Get item (async version of localStorage.getItem)
     * @param {string} key - Storage key
     * @returns {Promise<string|null>}
     */
    async getItem(key) {
        try {
            switch (key) {
                case 'tasks':
                    const tasks = await getTasks();
                    return JSON.stringify(tasks);
                
                case 'habits':
                    const habits = await getHabits();
                    return JSON.stringify(habits);
                
                case 'subjects':
                    const subjects = await getSubjects();
                    return JSON.stringify(subjects);
                
                default:
                    // Fall back to localStorage for unknown keys
                    return localStorage.getItem(key);
            }
        } catch (error) {
            console.error(`Error getting item ${key}:`, error);
            return null;
        }
    },

    /**
     * Set item (async version of localStorage.setItem)
     * @param {string} key - Storage key
     * @param {string} value - JSON string value
     * @returns {Promise<void>}
     */
    async setItem(key, value) {
        try {
            const data = JSON.parse(value);
            
            switch (key) {
                case 'tasks':
                    await bulkInsertTasks(data);
                    break;
                
                case 'habits':
                    for (const habit of data) {
                        if (habit.id) {
                            await updateHabit(habit.id, habit);
                        } else {
                            await createHabit(habit);
                        }
                    }
                    break;
                
                case 'subjects':
                    for (const subject of data) {
                        if (subject.id) {
                            await updateSubject(subject.id, subject);
                        } else {
                            await createSubject(subject);
                        }
                    }
                    break;
                
                default:
                    // Fall back to localStorage for unknown keys
                    localStorage.setItem(key, value);
            }
        } catch (error) {
            console.error(`Error setting item ${key}:`, error);
        }
    },

    /**
     * Remove item
     * @param {string} key - Storage key
     * @returns {Promise<void>}
     */
    async removeItem(key) {
        try {
            switch (key) {
                case 'tasks':
                    const tasks = await getTasks();
                    for (const task of tasks) {
                        await deleteTask(task.id);
                    }
                    break;
                
                case 'habits':
                    const habits = await getHabits();
                    for (const habit of habits) {
                        await deleteHabit(habit.id);
                    }
                    break;
                
                default:
                    localStorage.removeItem(key);
            }
        } catch (error) {
            console.error(`Error removing item ${key}:`, error);
        }
    }
};

// ===== ADAPTER FUNCTIONS =====
// These functions adapt existing localStorage-based code to use IndexedDB

/**
 * Load tasks (replaces loadTasks() in data.js)
 */
async function loadTasksFromIndexedDB() {
    try {
        const tasks = await getTasks();
        
        // Clear existing UI
        const taskList = document.getElementById("taskList");
        if (taskList) taskList.innerHTML = '';
        
        // Render each task
        for (const task of tasks) {
            if (typeof createTaskElement !== 'undefined') {
                createTaskElement(
                    task.title,
                    task.id,
                    task.completed,
                    task.dueDate,
                    task.dueTime,
                    task.priority,
                    task.subject,
                    task.subtasks,
                    task.recurrence
                );
            }
        }
        
        if (typeof sortTasks !== 'undefined') sortTasks();
        if (typeof updateCounter !== 'undefined') updateCounter();
        if (typeof updateStats !== 'undefined') updateStats();
        
        console.log('✅ Tasks loaded from IndexedDB');
    } catch (error) {
        console.error('❌ Error loading tasks from IndexedDB:', error);
    }
}

/**
 * Load habits (replaces loadHabits() in data.js)
 */
async function loadHabitsFromIndexedDB() {
    try {
        const habits = await getHabits();
        
        // Clear existing UI
        const habitList = document.getElementById("habitList");
        if (habitList) habitList.innerHTML = '';
        
        // Render each habit
        for (const habit of habits) {
            if (typeof renderHabitCard !== 'undefined') {
                renderHabitCard(habit);
            }
        }
        
        console.log('✅ Habits loaded from IndexedDB');
    } catch (error) {
        console.error('❌ Error loading habits from IndexedDB:', error);
    }
}

/**
 * Load subjects (replaces loadSubjects() in data.js)
 */
async function loadSubjectsFromIndexedDB() {
    try {
        const subjects = await getSubjects();
        
        // Update subject dropdowns
        const subjectSelects = document.querySelectorAll('.subject-select');
        subjectSelects.forEach(select => {
            select.innerHTML = '<option value="">No Subject</option>';
            subjects.forEach(subject => {
                const option = document.createElement('option');
                option.value = subject.id;
                option.textContent = subject.name;
                select.appendChild(option);
            });
        });
        
        console.log('✅ Subjects loaded from IndexedDB');
    } catch (error) {
        console.error('❌ Error loading subjects from IndexedDB:', error);
    }
}

/**
 * Save task to IndexedDB and sync (replaces saveTask in data.js)
 */
async function saveTaskToIndexedDB(taskData) {
    try {
        let taskId;
        
        if (taskData.id) {
            // Update existing task
            await updateTask(taskData.id, {
                title: taskData.title || taskData.text,
                description: taskData.description,
                subject: taskData.subject || taskData.subjectId,
                priority: taskData.priority,
                dueDate: taskData.dueDate,
                dueTime: taskData.dueTime,
                completed: taskData.completed,
                completedDate: taskData.completedDate,
                subtasks: taskData.subtasks,
                recurrence: taskData.recurrence
            });
            taskId = taskData.id;
        } else {
            // Create new task
            taskId = await createTask({
                title: taskData.title || taskData.text,
                description: taskData.description || '',
                subject: taskData.subject || taskData.subjectId,
                priority: taskData.priority || 'medium',
                dueDate: taskData.dueDate || null,
                dueTime: taskData.dueTime || null,
                subtasks: taskData.subtasks || [],
                recurrence: taskData.recurrence || null
            });
        }
        
        return taskId;
    } catch (error) {
        console.error('❌ Error saving task to IndexedDB:', error);
        throw error;
    }
}

/**
 * Delete task from IndexedDB and sync (replaces deleteTask in data.js)
 */
async function deleteTaskFromIndexedDB(taskId) {
    try {
        await deleteTask(taskId);
        console.log('✅ Task deleted from IndexedDB:', taskId);
    } catch (error) {
        console.error('❌ Error deleting task from IndexedDB:', error);
        throw error;
    }
}

/**
 * Toggle task completion
 */
async function toggleTaskCompletion(taskId) {
    try {
        const task = await getTaskById(taskId);
        if (!task) {
            console.error('Task not found:', taskId);
            return;
        }
        
        const completed = !task.completed;
        await updateTask(taskId, {
            completed: completed,
            completedDate: completed ? new Date().toISOString() : null
        });
        
        console.log(`✅ Task ${taskId} marked as ${completed ? 'completed' : 'incomplete'}`);
        
        // Update UI
        await loadTasksFromIndexedDB();
    } catch (error) {
        console.error('❌ Error toggling task:', error);
    }
}

/**
 * Save habit to IndexedDB
 */
async function saveHabitToIndexedDB(habitData) {
    try {
        let habitId;
        
        if (habitData.id) {
            // Update existing habit
            await updateHabit(habitData.id, {
                name: habitData.name,
                description: habitData.description,
                frequency: habitData.frequency,
                targetDays: habitData.targetDays,
                streak: habitData.streak,
                bestStreak: habitData.bestStreak,
                lastCompleted: habitData.lastCompleted,
                color: habitData.color,
                icon: habitData.icon
            });
            habitId = habitData.id;
        } else {
            // Create new habit
            habitId = await createHabit({
                name: habitData.name,
                description: habitData.description || '',
                frequency: habitData.frequency || 'daily',
                targetDays: habitData.targetDays || [],
                color: habitData.color || '#4A90E2',
                icon: habitData.icon || '⭐'
            });
        }
        
        return habitId;
    } catch (error) {
        console.error('❌ Error saving habit to IndexedDB:', error);
        throw error;
    }
}

/**
 * Complete habit for today
 */
async function completeHabitToday(habitId) {
    try {
        const habit = await db.habits.get(habitId);
        if (!habit) return;
        
        const today = new Date().toISOString().split('T')[0];
        const completionHistory = habit.completionHistory || [];
        
        // Check if already completed today
        if (completionHistory.includes(today)) {
            console.log('Habit already completed today');
            return;
        }
        
        // Add today to history
        completionHistory.push(today);
        
        // Calculate new streak
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        let newStreak = 1;
        if (completionHistory.includes(yesterdayStr)) {
            newStreak = (habit.streak || 0) + 1;
        }
        
        // Update habit
        await updateHabit(habitId, {
            streak: newStreak,
            bestStreak: Math.max(habit.bestStreak || 0, newStreak),
            lastCompleted: today,
            completionHistory: completionHistory
        });
        
        console.log(`✅ Habit completed! Streak: ${newStreak}`);
        
        // Update UI
        await loadHabitsFromIndexedDB();
    } catch (error) {
        console.error('❌ Error completing habit:', error);
    }
}

/**
 * Save subject to IndexedDB
 */
async function saveSubjectToIndexedDB(subjectData) {
    try {
        let subjectId;
        
        if (subjectData.id) {
            // Update existing subject
            await updateSubject(subjectData.id, {
                name: subjectData.name,
                color: subjectData.color,
                icon: subjectData.icon,
                order: subjectData.order
            });
            subjectId = subjectData.id;
        } else {
            // Create new subject
            subjectId = await createSubject({
                name: subjectData.name,
                color: subjectData.color || '#4A90E2',
                icon: subjectData.icon || '📚',
                order: subjectData.order || 0
            });
        }
        
        return subjectId;
    } catch (error) {
        console.error('❌ Error saving subject to IndexedDB:', error);
        throw error;
    }
}

// ===== INITIALIZATION =====

/**
 * Initialize IndexedDB and run migration if needed
 */
async function initializeIndexedDB() {
    try {
        console.log('🔄 Initializing IndexedDB...');
        
        // Check if migration is needed
        if (needsMigration()) {
            console.log('📦 Migration required - starting...');
            
            // Ask user for confirmation
            const confirmed = confirm(
                'Prodify needs to upgrade your data storage.\n\n' +
                'This will migrate your data from localStorage to a more efficient database.\n' +
                'Your data will be backed up automatically.\n\n' +
                'Click OK to proceed.'
            );
            
            if (confirmed) {
                const results = await migrateFromLocalStorage();
                console.log('✅ Migration completed:', results);
                
                alert(
                    `Migration successful!\n\n` +
                    `Migrated:\n` +
                    `• ${results.tasks} tasks\n` +
                    `• ${results.habits} habits\n` +
                    `• ${results.subjects} subjects\n` +
                    `• ${results.focusSessions} focus sessions`
                );
            } else {
                console.log('⚠️ Migration skipped by user');
            }
        } else {
            console.log('✅ No migration needed');
        }
        
        // Load initial data
        await loadTasksFromIndexedDB();
        await loadHabitsFromIndexedDB();
        await loadSubjectsFromIndexedDB();
        
        // Start auto-sync
        startAutoSync(30000);  // Sync every 30 seconds
        
        console.log('✅ IndexedDB initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing IndexedDB:', error);
        
        // Fall back to localStorage if IndexedDB fails
        alert('Could not initialize offline database. Using legacy storage.');
    }
}

/**
 * Show sync status in UI
 */
async function updateSyncStatus() {
    try {
        const stats = await getDatabaseStats();
        const statusElement = document.getElementById('syncStatus');
        
        if (!statusElement) return;
        
        if (!navigator.onLine) {
            statusElement.innerHTML = '📴 Offline';
            statusElement.className = 'sync-status offline';
        } else if (stats.pendingSync > 0) {
            statusElement.innerHTML = `⏳ Syncing ${stats.pendingSync} items...`;
            statusElement.className = 'sync-status syncing';
        } else {
            statusElement.innerHTML = '✅ All synced';
            statusElement.className = 'sync-status synced';
        }
    } catch (error) {
        console.error('Error updating sync status:', error);
    }
}

// Update sync status every 5 seconds
setInterval(updateSyncStatus, 5000);

// Update on network status change
window.addEventListener('online', updateSyncStatus);
window.addEventListener('offline', updateSyncStatus);

// ===== EVENT HANDLERS =====

/**
 * Handle online event - process sync queue
 */
window.addEventListener('online', async () => {
    console.log('🌐 Connection restored');
    
    // Show notification
    if (typeof showNotification !== 'undefined') {
        showNotification('Back online! Syncing your data...', 'info');
    }
    
    // Process sync queue
    try {
        const result = await processSyncQueue();
        
        if (result.success > 0) {
            if (typeof showNotification !== 'undefined') {
                showNotification(
                    `Synced ${result.success} items successfully!`,
                    'success'
                );
            }
        }
    } catch (error) {
        console.error('Error syncing after reconnection:', error);
    }
});

/**
 * Handle offline event
 */
window.addEventListener('offline', () => {
    console.log('📴 Connection lost - working offline');
    
    if (typeof showNotification !== 'undefined') {
        showNotification('Working offline. Changes will sync when reconnected.', 'warning');
    }
});

/**
 * Handle page unload - sync pending operations
 */
window.addEventListener('beforeunload', async (event) => {
    const stats = await getDatabaseStats();
    
    if (stats.pendingSync > 0) {
        // Try to sync before unload
        processSyncQueue().catch(console.error);
        
        // Warn user about pending sync
        const message = `You have ${stats.pendingSync} items that haven't synced yet.`;
        event.returnValue = message;
        return message;
    }
});

// ===== DEVELOPER CONSOLE HELPERS =====

// Make functions available in console for debugging
window.IndexedDBDebug = {
    // Data operations
    getTasks,
    createTask,
    updateTask,
    deleteTask,
    getHabits,
    createHabit,
    updateHabit,
    deleteHabit,
    
    // Sync operations
    processSyncQueue,
    getPendingSyncOperations,
    retryFailedSyncs,
    
    // Debug utilities
    exportDatabase,
    importDatabase,
    clearDatabase,
    generateMockData,
    getDatabaseStats,
    
    // Migration
    migrateFromLocalStorage,
    needsMigration,
    
    // Helpers
    loadTasksFromIndexedDB,
    loadHabitsFromIndexedDB,
    loadSubjectsFromIndexedDB
};

console.log(`
🔧 IndexedDB Debug Tools Available
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Access via: window.IndexedDBDebug

Example commands:
  IndexedDBDebug.getDatabaseStats()
  IndexedDBDebug.exportDatabase()
  IndexedDBDebug.generateMockData(10)
  IndexedDBDebug.processSyncQueue()
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeIndexedDB,
        loadTasksFromIndexedDB,
        loadHabitsFromIndexedDB,
        loadSubjectsFromIndexedDB,
        saveTaskToIndexedDB,
        deleteTaskFromIndexedDB,
        toggleTaskCompletion,
        saveHabitToIndexedDB,
        completeHabitToday,
        saveSubjectToIndexedDB,
        updateSyncStatus
    };
}
