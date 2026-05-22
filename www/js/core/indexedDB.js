// ===== PRODIFY OFFLINE-FIRST DATABASE LAYER =====
// IndexedDB implementation using Dexie.js
// Provides scalable offline data storage with cloud sync capabilities

// ===== DATABASE SCHEMA DEFINITION =====

const db = new Dexie('ProdifyDB');

// Define database schema with versioning
db.version(1).stores({
    // Tasks table with comprehensive indexing
    tasks: '++id, title, subject, priority, dueDate, completed, createdAt, updatedAt',
    
    // Habits tracking
    habits: '++id, name, frequency, streak, lastCompleted, createdAt, updatedAt',
    
    // Academic subjects
    subjects: '++id, name, color, order, createdAt, updatedAt',
    
    // Notes and study materials
    notes: '++id, title, subject, tags, createdAt, updatedAt',
    
    // Focus sessions tracking
    focusSessions: '++id, subject, duration, completed, startTime, endTime, createdAt',
    
    // Study sessions
    studySessions: '++id, subject, duration, topic, date, createdAt, updatedAt',
    
    // Notifications
    notifications: '++id, type, scheduledTime, delivered, createdAt',
    
    // Analytics data
    analytics: '++id, date, metric, value, createdAt',
    
    // Sync queue for offline operations
    syncQueue: '++id, table, operation, timestamp, synced, retries'
});

// ===== CRUD OPERATIONS LAYER =====

// --------------- TASKS ---------------

/**
 * Create a new task
 * @param {Object} taskData - Task properties
 * @returns {Promise<number>} Task ID
 */
async function createTask(taskData) {
    try {
        const timestamp = new Date().toISOString();
        const task = {
            title: taskData.title,
            description: taskData.description || '',
            subject: taskData.subject || null,
            priority: taskData.priority || 'medium',
            dueDate: taskData.dueDate || null,
            dueTime: taskData.dueTime || null,
            completed: false,
            completedDate: null,
            subtasks: taskData.subtasks || [],
            recurrence: taskData.recurrence || null,
            customRecurrenceDays: taskData.customRecurrenceDays || null,
            tags: taskData.tags || [],
            createdAt: timestamp,
            updatedAt: timestamp
        };

        // Add to IndexedDB
        const id = await db.tasks.add(task);
        
        // Add to sync queue
        await addToSyncQueue('tasks', 'create', { ...task, id });
        
        console.log('✅ Task created:', id);
        return id;
    } catch (error) {
        console.error('❌ Error creating task:', error);
        throw error;
    }
}

/**
 * Update an existing task
 * @param {number} id - Task ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<number>} Number of updated records
 */
async function updateTask(id, updates) {
    try {
        updates.updatedAt = new Date().toISOString();
        
        // Update in IndexedDB
        const count = await db.tasks.update(id, updates);
        
        if (count > 0) {
            // Add to sync queue
            await addToSyncQueue('tasks', 'update', { id, ...updates });
            console.log('✅ Task updated:', id);
        }
        
        return count;
    } catch (error) {
        console.error('❌ Error updating task:', error);
        throw error;
    }
}

/**
 * Delete a task
 * @param {number} id - Task ID
 * @returns {Promise<void>}
 */
async function deleteTask(id) {
    try {
        await db.tasks.delete(id);
        
        // Add to sync queue
        await addToSyncQueue('tasks', 'delete', { id });
        
        console.log('✅ Task deleted:', id);
    } catch (error) {
        console.error('❌ Error deleting task:', error);
        throw error;
    }
}

/**
 * Get all tasks with optional filtering
 * @param {Object} filter - Filter criteria
 * @returns {Promise<Array>} Array of tasks
 */
async function getTasks(filter = {}) {
    try {
        let query = db.tasks.toCollection();
        
        // Apply filters
        if (filter.completed !== undefined) {
            query = query.filter(task => task.completed === filter.completed);
        }
        
        if (filter.subject) {
            query = query.filter(task => task.subject === filter.subject);
        }
        
        if (filter.priority) {
            query = query.filter(task => task.priority === filter.priority);
        }
        
        const tasks = await query.toArray();
        return tasks;
    } catch (error) {
        console.error('❌ Error getting tasks:', error);
        throw error;
    }
}

/**
 * Get tasks by date range
 * @param {string} startDate - Start date (ISO string)
 * @param {string} endDate - End date (ISO string)
 * @returns {Promise<Array>} Array of tasks
 */
async function getTasksByDate(startDate, endDate) {
    try {
        const tasks = await db.tasks
            .where('dueDate')
            .between(startDate, endDate, true, true)
            .toArray();
        
        return tasks;
    } catch (error) {
        console.error('❌ Error getting tasks by date:', error);
        throw error;
    }
}

/**
 * Get a single task by ID
 * @param {number} id - Task ID
 * @returns {Promise<Object|undefined>} Task object
 */
async function getTaskById(id) {
    try {
        return await db.tasks.get(id);
    } catch (error) {
        console.error('❌ Error getting task:', error);
        throw error;
    }
}

// --------------- HABITS ---------------

/**
 * Create a new habit
 * @param {Object} habitData - Habit properties
 * @returns {Promise<number>} Habit ID
 */
async function createHabit(habitData) {
    try {
        const timestamp = new Date().toISOString();
        const habit = {
            name: habitData.name,
            description: habitData.description || '',
            frequency: habitData.frequency || 'daily',
            targetDays: habitData.targetDays || [],
            streak: 0,
            bestStreak: 0,
            lastCompleted: null,
            completionHistory: [],
            color: habitData.color || '#4A90E2',
            icon: habitData.icon || '⭐',
            createdAt: timestamp,
            updatedAt: timestamp
        };

        const id = await db.habits.add(habit);
        await addToSyncQueue('habits', 'create', { ...habit, id });
        
        console.log('✅ Habit created:', id);
        return id;
    } catch (error) {
        console.error('❌ Error creating habit:', error);
        throw error;
    }
}

/**
 * Update a habit
 * @param {number} id - Habit ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<number>} Number of updated records
 */
async function updateHabit(id, updates) {
    try {
        updates.updatedAt = new Date().toISOString();
        
        const count = await db.habits.update(id, updates);
        
        if (count > 0) {
            await addToSyncQueue('habits', 'update', { id, ...updates });
            console.log('✅ Habit updated:', id);
        }
        
        return count;
    } catch (error) {
        console.error('❌ Error updating habit:', error);
        throw error;
    }
}

/**
 * Delete a habit
 * @param {number} id - Habit ID
 * @returns {Promise<void>}
 */
async function deleteHabit(id) {
    try {
        await db.habits.delete(id);
        await addToSyncQueue('habits', 'delete', { id });
        console.log('✅ Habit deleted:', id);
    } catch (error) {
        console.error('❌ Error deleting habit:', error);
        throw error;
    }
}

/**
 * Get all habits
 * @returns {Promise<Array>} Array of habits
 */
async function getHabits() {
    try {
        return await db.habits.toArray();
    } catch (error) {
        console.error('❌ Error getting habits:', error);
        throw error;
    }
}

// --------------- SUBJECTS ---------------

/**
 * Create a new subject
 * @param {Object} subjectData - Subject properties
 * @returns {Promise<number>} Subject ID
 */
async function createSubject(subjectData) {
    try {
        const timestamp = new Date().toISOString();
        const subject = {
            name: subjectData.name,
            color: subjectData.color || '#4A90E2',
            icon: subjectData.icon || '📚',
            order: subjectData.order || 0,
            createdAt: timestamp,
            updatedAt: timestamp
        };

        const id = await db.subjects.add(subject);
        await addToSyncQueue('subjects', 'create', { ...subject, id });
        
        console.log('✅ Subject created:', id);
        return id;
    } catch (error) {
        console.error('❌ Error creating subject:', error);
        throw error;
    }
}

/**
 * Update a subject
 * @param {number} id - Subject ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<number>} Number of updated records
 */
async function updateSubject(id, updates) {
    try {
        updates.updatedAt = new Date().toISOString();
        
        const count = await db.subjects.update(id, updates);
        
        if (count > 0) {
            await addToSyncQueue('subjects', 'update', { id, ...updates });
            console.log('✅ Subject updated:', id);
        }
        
        return count;
    } catch (error) {
        console.error('❌ Error updating subject:', error);
        throw error;
    }
}

/**
 * Delete a subject
 * @param {number} id - Subject ID
 * @returns {Promise<void>}
 */
async function deleteSubject(id) {
    try {
        await db.subjects.delete(id);
        await addToSyncQueue('subjects', 'delete', { id });
        console.log('✅ Subject deleted:', id);
    } catch (error) {
        console.error('❌ Error deleting subject:', error);
        throw error;
    }
}

/**
 * Get all subjects ordered
 * @returns {Promise<Array>} Array of subjects
 */
async function getSubjects() {
    try {
        return await db.subjects.orderBy('order').toArray();
    } catch (error) {
        console.error('❌ Error getting subjects:', error);
        throw error;
    }
}

// --------------- NOTES ---------------

/**
 * Create a new note
 * @param {Object} noteData - Note properties
 * @returns {Promise<number>} Note ID
 */
async function createNote(noteData) {
    try {
        const timestamp = new Date().toISOString();
        const note = {
            title: noteData.title,
            content: noteData.content || '',
            subject: noteData.subject || null,
            tags: noteData.tags || [],
            attachments: noteData.attachments || [],
            createdAt: timestamp,
            updatedAt: timestamp
        };

        const id = await db.notes.add(note);
        await addToSyncQueue('notes', 'create', { ...note, id });
        
        console.log('✅ Note created:', id);
        return id;
    } catch (error) {
        console.error('❌ Error creating note:', error);
        throw error;
    }
}

/**
 * Update a note
 * @param {number} id - Note ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<number>} Number of updated records
 */
async function updateNote(id, updates) {
    try {
        updates.updatedAt = new Date().toISOString();
        
        const count = await db.notes.update(id, updates);
        
        if (count > 0) {
            await addToSyncQueue('notes', 'update', { id, ...updates });
            console.log('✅ Note updated:', id);
        }
        
        return count;
    } catch (error) {
        console.error('❌ Error updating note:', error);
        throw error;
    }
}

/**
 * Delete a note
 * @param {number} id - Note ID
 * @returns {Promise<void>}
 */
async function deleteNote(id) {
    try {
        await db.notes.delete(id);
        await addToSyncQueue('notes', 'delete', { id });
        console.log('✅ Note deleted:', id);
    } catch (error) {
        console.error('❌ Error deleting note:', error);
        throw error;
    }
}

/**
 * Get all notes with optional filtering
 * @param {Object} filter - Filter criteria
 * @returns {Promise<Array>} Array of notes
 */
async function getNotes(filter = {}) {
    try {
        let query = db.notes.toCollection();
        
        if (filter.subject) {
            query = query.filter(note => note.subject === filter.subject);
        }
        
        if (filter.tag) {
            query = query.filter(note => note.tags.includes(filter.tag));
        }
        
        const notes = await query.reverse().toArray();
        return notes;
    } catch (error) {
        console.error('❌ Error getting notes:', error);
        throw error;
    }
}

// --------------- FOCUS SESSIONS ---------------

/**
 * Store a focus session
 * @param {Object} sessionData - Session properties
 * @returns {Promise<number>} Session ID
 */
async function storeFocusSession(sessionData) {
    try {
        const session = {
            subject: sessionData.subject || null,
            duration: sessionData.duration,
            completed: sessionData.completed || false,
            interrupted: sessionData.interrupted || false,
            startTime: sessionData.startTime,
            endTime: sessionData.endTime,
            blockedApps: sessionData.blockedApps || [],
            distractions: sessionData.distractions || 0,
            createdAt: new Date().toISOString()
        };

        const id = await db.focusSessions.add(session);
        await addToSyncQueue('focusSessions', 'create', { ...session, id });
        
        console.log('✅ Focus session stored:', id);
        return id;
    } catch (error) {
        console.error('❌ Error storing focus session:', error);
        throw error;
    }
}

/**
 * Get focus sessions by date range
 * @param {string} startDate - Start date (ISO string)
 * @param {string} endDate - End date (ISO string)
 * @returns {Promise<Array>} Array of sessions
 */
async function getFocusSessions(startDate, endDate) {
    try {
        const sessions = await db.focusSessions
            .where('startTime')
            .between(startDate, endDate, true, true)
            .toArray();
        
        return sessions;
    } catch (error) {
        console.error('❌ Error getting focus sessions:', error);
        throw error;
    }
}

// --------------- STUDY SESSIONS ---------------

/**
 * Create a study session
 * @param {Object} sessionData - Session properties
 * @returns {Promise<number>} Session ID
 */
async function createStudySession(sessionData) {
    try {
        const timestamp = new Date().toISOString();
        const session = {
            subject: sessionData.subject,
            duration: sessionData.duration,
            topic: sessionData.topic || '',
            notes: sessionData.notes || '',
            date: sessionData.date || timestamp,
            completed: sessionData.completed || false,
            createdAt: timestamp,
            updatedAt: timestamp
        };

        const id = await db.studySessions.add(session);
        await addToSyncQueue('studySessions', 'create', { ...session, id });
        
        console.log('✅ Study session created:', id);
        return id;
    } catch (error) {
        console.error('❌ Error creating study session:', error);
        throw error;
    }
}

/**
 * Get study sessions by date
 * @param {string} date - Date (ISO string)
 * @returns {Promise<Array>} Array of sessions
 */
async function getStudySessionsByDate(date) {
    try {
        const sessions = await db.studySessions
            .where('date')
            .equals(date)
            .toArray();
        
        return sessions;
    } catch (error) {
        console.error('❌ Error getting study sessions:', error);
        throw error;
    }
}

// --------------- NOTIFICATIONS ---------------

/**
 * Create a notification
 * @param {Object} notificationData - Notification properties
 * @returns {Promise<number>} Notification ID
 */
async function createNotification(notificationData) {
    try {
        const notification = {
            type: notificationData.type,
            title: notificationData.title,
            message: notificationData.message,
            scheduledTime: notificationData.scheduledTime,
            delivered: false,
            read: false,
            data: notificationData.data || {},
            createdAt: new Date().toISOString()
        };

        const id = await db.notifications.add(notification);
        await addToSyncQueue('notifications', 'create', { ...notification, id });
        
        console.log('✅ Notification created:', id);
        return id;
    } catch (error) {
        console.error('❌ Error creating notification:', error);
        throw error;
    }
}

/**
 * Mark notification as delivered
 * @param {number} id - Notification ID
 * @returns {Promise<number>} Number of updated records
 */
async function markNotificationDelivered(id) {
    try {
        const count = await db.notifications.update(id, { 
            delivered: true,
            deliveredAt: new Date().toISOString()
        });
        
        console.log('✅ Notification marked as delivered:', id);
        return count;
    } catch (error) {
        console.error('❌ Error marking notification:', error);
        throw error;
    }
}

/**
 * Get pending notifications
 * @returns {Promise<Array>} Array of notifications
 */
async function getPendingNotifications() {
    try {
        const now = new Date().toISOString();
        const notifications = await db.notifications
            .where('delivered')
            .equals(0)
            .and(n => n.scheduledTime <= now)
            .toArray();
        
        return notifications;
    } catch (error) {
        console.error('❌ Error getting pending notifications:', error);
        throw error;
    }
}

// --------------- ANALYTICS ---------------

/**
 * Store analytics data
 * @param {string} metric - Metric name
 * @param {any} value - Metric value
 * @param {string} date - Date (ISO string)
 * @returns {Promise<number>} Analytics ID
 */
async function storeAnalytics(metric, value, date = null) {
    try {
        const analytics = {
            date: date || new Date().toISOString(),
            metric: metric,
            value: value,
            createdAt: new Date().toISOString()
        };

        const id = await db.analytics.add(analytics);
        
        // Analytics typically don't need immediate sync
        // Add to queue with lower priority
        await addToSyncQueue('analytics', 'create', { ...analytics, id }, false);
        
        return id;
    } catch (error) {
        console.error('❌ Error storing analytics:', error);
        throw error;
    }
}

/**
 * Get analytics by date range
 * @param {string} metric - Metric name
 * @param {string} startDate - Start date (ISO string)
 * @param {string} endDate - End date (ISO string)
 * @returns {Promise<Array>} Array of analytics
 */
async function getAnalytics(metric, startDate, endDate) {
    try {
        const analytics = await db.analytics
            .where('date')
            .between(startDate, endDate, true, true)
            .and(a => a.metric === metric)
            .toArray();
        
        return analytics;
    } catch (error) {
        console.error('❌ Error getting analytics:', error);
        throw error;
    }
}

// ===== SYNC QUEUE SYSTEM =====

/**
 * Add operation to sync queue
 * @param {string} table - Table name
 * @param {string} operation - Operation type (create/update/delete)
 * @param {Object} payload - Operation data
 * @param {boolean} highPriority - Priority flag
 * @returns {Promise<number>} Queue entry ID
 */
async function addToSyncQueue(table, operation, payload, highPriority = true) {
    try {
        const queueEntry = {
            table: table,
            operation: operation,
            payload: payload,
            timestamp: new Date().toISOString(),
            synced: false,
            retries: 0,
            priority: highPriority ? 1 : 0,
            error: null
        };

        const id = await db.syncQueue.add(queueEntry);
        console.log(`📤 Added to sync queue: ${table}.${operation}`);
        
        return id;
    } catch (error) {
        console.error('❌ Error adding to sync queue:', error);
        throw error;
    }
}

/**
 * Get pending sync operations
 * @param {number} limit - Maximum number of operations to retrieve
 * @returns {Promise<Array>} Array of pending operations
 */
async function getPendingSyncOperations(limit = 20) {
    try {
        const operations = await db.syncQueue
            .where('synced')
            .equals(0)
            .and(op => op.retries < 5) // Max 5 retries
            .sortBy('priority');
        
        // Return highest priority items first, up to limit
        return operations.reverse().slice(0, limit);
    } catch (error) {
        console.error('❌ Error getting pending sync operations:', error);
        throw error;
    }
}

/**
 * Mark sync operation as completed
 * @param {number} id - Queue entry ID
 * @returns {Promise<number>} Number of updated records
 */
async function markSyncCompleted(id) {
    try {
        const count = await db.syncQueue.update(id, {
            synced: true,
            syncedAt: new Date().toISOString()
        });
        
        return count;
    } catch (error) {
        console.error('❌ Error marking sync completed:', error);
        throw error;
    }
}

/**
 * Mark sync operation as failed and increment retry count
 * @param {number} id - Queue entry ID
 * @param {string} error - Error message
 * @returns {Promise<number>} Number of updated records
 */
async function markSyncFailed(id, error) {
    try {
        const operation = await db.syncQueue.get(id);
        const count = await db.syncQueue.update(id, {
            retries: (operation.retries || 0) + 1,
            error: error,
            lastAttempt: new Date().toISOString()
        });
        
        return count;
    } catch (error) {
        console.error('❌ Error marking sync failed:', error);
        throw error;
    }
}

/**
 * Process sync queue in batches
 * @param {number} batchSize - Number of operations to process
 * @returns {Promise<Object>} Sync results
 */
async function processSyncQueue(batchSize = 20) {
    // Check if Firebase is initialized and user is authenticated
    if (!currentUserId || typeof firebase === 'undefined') {
        console.log('⚠️ Sync skipped: No user authenticated or Firebase not available');
        return { success: 0, failed: 0, skipped: true };
    }

    try {
        const operations = await getPendingSyncOperations(batchSize);
        
        if (operations.length === 0) {
            console.log('✅ Sync queue is empty');
            return { success: 0, failed: 0 };
        }

        console.log(`🔄 Processing ${operations.length} sync operations...`);
        
        let successCount = 0;
        let failedCount = 0;

        for (const operation of operations) {
            try {
                await syncOperationToFirestore(operation);
                await markSyncCompleted(operation.id);
                successCount++;
            } catch (error) {
                console.error(`❌ Sync failed for operation ${operation.id}:`, error);
                await markSyncFailed(operation.id, error.message);
                failedCount++;
            }
        }

        console.log(`✅ Sync completed: ${successCount} success, ${failedCount} failed`);
        return { success: successCount, failed: failedCount };
    } catch (error) {
        console.error('❌ Error processing sync queue:', error);
        throw error;
    }
}

/**
 * Sync a single operation to Firestore
 * @param {Object} operation - Sync queue operation
 * @returns {Promise<void>}
 */
async function syncOperationToFirestore(operation) {
    const { table, operation: op, payload } = operation;
    
    // Get Firestore reference
    const collectionRef = firebase.firestore()
        .collection('users')
        .doc(currentUserId)
        .collection(table);

    switch (op) {
        case 'create':
        case 'update':
            // Remove internal IDs if they're auto-generated
            const data = { ...payload };
            const docId = data.id ? data.id.toString() : collectionRef.doc().id;
            delete data.id;
            
            await collectionRef.doc(docId).set(data, { merge: true });
            break;
            
        case 'delete':
            await collectionRef.doc(payload.id.toString()).delete();
            break;
            
        default:
            throw new Error(`Unknown operation: ${op}`);
    }
}

// ===== CONFLICT RESOLUTION =====

/**
 * Resolve conflicts between local and cloud data
 * @param {Object} localData - Local data
 * @param {Object} cloudData - Cloud data
 * @returns {Object} Resolved data
 */
function resolveConflict(localData, cloudData) {
    // Use updatedAt timestamp for conflict resolution
    const localTime = new Date(localData.updatedAt || localData.createdAt).getTime();
    const cloudTime = new Date(cloudData.updatedAt || cloudData.createdAt).getTime();
    
    if (localTime > cloudTime) {
        console.log('🔀 Conflict resolved: Local data is newer');
        return { ...localData, _source: 'local' };
    } else if (cloudTime > localTime) {
        console.log('🔀 Conflict resolved: Cloud data is newer');
        return { ...cloudData, _source: 'cloud' };
    } else {
        // Same timestamp - merge data, preferring non-null values
        console.log('🔀 Conflict resolved: Merging data');
        return mergeData(localData, cloudData);
    }
}

/**
 * Merge two data objects, preferring non-null values
 * @param {Object} local - Local data
 * @param {Object} cloud - Cloud data
 * @returns {Object} Merged data
 */
function mergeData(local, cloud) {
    const merged = { ...cloud };
    
    for (const key in local) {
        if (local[key] !== null && local[key] !== undefined) {
            // For arrays, merge uniquely
            if (Array.isArray(local[key]) && Array.isArray(cloud[key])) {
                merged[key] = [...new Set([...cloud[key], ...local[key]])];
            } else {
                merged[key] = local[key];
            }
        }
    }
    
    merged._source = 'merged';
    return merged;
}

// ===== DATA MIGRATION FROM LOCALSTORAGE =====

/**
 * Migrate all data from localStorage to IndexedDB
 * @returns {Promise<Object>} Migration results
 */
async function migrateFromLocalStorage() {
    console.log('🔄 Starting migration from localStorage to IndexedDB...');
    
    const results = {
        tasks: 0,
        habits: 0,
        subjects: 0,
        notes: 0,
        focusSessions: 0,
        studySessions: 0,
        notifications: 0,
        skipped: []
    };

    try {
        // Migrate Tasks
        const tasksData = localStorage.getItem('tasks');
        if (tasksData) {
            let tasks;
            try {
                tasks = JSON.parse(tasksData);
            } catch (parseError) {
                console.error('❌ Failed to parse tasks data:', parseError);
                results.skipped.push({ type: 'tasks', reason: 'Invalid JSON' });
                tasks = [];
            }
            
            for (const task of tasks) {
                try {
                    // Transform localStorage format to IndexedDB format
                    await db.tasks.add({
                        title: task.text || task.title,
                        description: task.description || '',
                        subject: task.subjectId || task.subject || null,
                        priority: task.priority || 'medium',
                        dueDate: task.dueDate || null,
                        dueTime: task.dueTime || null,
                        completed: task.completed || false,
                        completedDate: task.completedDate || null,
                        subtasks: task.subtasks || [],
                        recurrence: task.recurrence || null,
                        customRecurrenceDays: task.customRecurrenceDays || null,
                        tags: task.tags || [],
                        createdAt: task.createdAt || new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                    results.tasks++;
                } catch (error) {
                    console.error('Error migrating task:', error);
                }
            }
            console.log(`✅ Migrated ${results.tasks} tasks`);
        }

        // Migrate Habits
        const habitsData = localStorage.getItem('habits');
        if (habitsData) {
            let habits;
            try {
                habits = JSON.parse(habitsData);
            } catch (parseError) {
                console.error('❌ Failed to parse habits data:', parseError);
                results.skipped.push({ type: 'habits', reason: 'Invalid JSON' });
                habits = [];
            }
            
            for (const habit of habits) {
                try {
                    await db.habits.add({
                        name: habit.name || habit.title,
                        description: habit.description || '',
                        frequency: habit.frequency || 'daily',
                        targetDays: habit.targetDays || [],
                        streak: habit.streak || 0,
                        bestStreak: habit.bestStreak || 0,
                        lastCompleted: habit.lastCompleted || null,
                        completionHistory: habit.completionHistory || [],
                        color: habit.color || '#4A90E2',
                        icon: habit.icon || '⭐',
                        createdAt: habit.createdAt || new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                    results.habits++;
                } catch (error) {
                    console.error('Error migrating habit:', error);
                }
            }
            console.log(`✅ Migrated ${results.habits} habits`);
        }

        // Migrate Subjects
        const subjectsData = localStorage.getItem('subjects');
        if (subjectsData) {
            let subjects;
            try {
                subjects = JSON.parse(subjectsData);
            } catch (parseError) {
                console.error('❌ Failed to parse subjects data:', parseError);
                results.skipped.push({ type: 'subjects', reason: 'Invalid JSON' });
                subjects = [];
            }
            
            for (const subject of subjects) {
                try {
                    await db.subjects.add({
                        name: subject.name,
                        color: subject.color || '#4A90E2',
                        icon: subject.icon || '📚',
                        order: subject.order || 0,
                        createdAt: subject.createdAt || new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                    results.subjects++;
                } catch (error) {
                    console.error('Error migrating subject:', error);
                }
            }
            console.log(`✅ Migrated ${results.subjects} subjects`);
        }

        // Migrate Focus Sessions
        const focusSessionsData = localStorage.getItem('focusSessions');
        if (focusSessionsData) {
            let sessions;
            try {
                sessions = JSON.parse(focusSessionsData);
            } catch (parseError) {
                console.error('❌ Failed to parse focus sessions data:', parseError);
                results.skipped.push({ type: 'focusSessions', reason: 'Invalid JSON' });
                sessions = [];
            }
            
            for (const session of sessions) {
                try {
                    await db.focusSessions.add({
                        subject: session.subject || null,
                        duration: session.duration,
                        completed: session.completed || false,
                        interrupted: session.interrupted || false,
                        startTime: session.startTime,
                        endTime: session.endTime,
                        blockedApps: session.blockedApps || [],
                        distractions: session.distractions || 0,
                        createdAt: session.createdAt || new Date().toISOString()
                    });
                    results.focusSessions++;
                } catch (error) {
                    console.error('Error migrating focus session:', error);
                }
            }
            console.log(`✅ Migrated ${results.focusSessions} focus sessions`);
        }

        // Create backup of localStorage before clearing
        const backup = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            backup[key] = localStorage.getItem(key);
        }
        localStorage.setItem('localStorage_backup', JSON.stringify(backup));
        localStorage.setItem('migration_completed', new Date().toISOString());

        console.log('✅ Migration completed successfully!');
        console.log('📦 Results:', results);
        
        return results;
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

/**
 * Check if migration is needed
 * @returns {boolean} True if migration needed
 */
function needsMigration() {
    // Check if migration already completed
    if (localStorage.getItem('migration_completed')) {
        return false;
    }
    
    // Check if there's data in localStorage
    const hasLocalData = localStorage.getItem('tasks') || 
                        localStorage.getItem('habits') || 
                        localStorage.getItem('subjects');
    
    return !!hasLocalData;
}

// ===== DEBUG UTILITIES =====

/**
 * Export entire database as JSON
 * @returns {Promise<Object>} Database export
 */
async function exportDatabase() {
    try {
        const exportData = {
            version: 1,
            exportDate: new Date().toISOString(),
            data: {}
        };

        // Export all tables
        exportData.data.tasks = await db.tasks.toArray();
        exportData.data.habits = await db.habits.toArray();
        exportData.data.subjects = await db.subjects.toArray();
        exportData.data.notes = await db.notes.toArray();
        exportData.data.focusSessions = await db.focusSessions.toArray();
        exportData.data.studySessions = await db.studySessions.toArray();
        exportData.data.notifications = await db.notifications.toArray();
        exportData.data.analytics = await db.analytics.toArray();

        console.log('✅ Database exported successfully');
        return exportData;
    } catch (error) {
        console.error('❌ Error exporting database:', error);
        throw error;
    }
}

/**
 * Import database from JSON
 * @param {Object} importData - Database export data
 * @returns {Promise<void>}
 */
async function importDatabase(importData) {
    try {
        console.log('🔄 Importing database...');

        // Clear existing data
        await clearDatabase();

        // Import data
        if (importData.data.tasks) await db.tasks.bulkAdd(importData.data.tasks);
        if (importData.data.habits) await db.habits.bulkAdd(importData.data.habits);
        if (importData.data.subjects) await db.subjects.bulkAdd(importData.data.subjects);
        if (importData.data.notes) await db.notes.bulkAdd(importData.data.notes);
        if (importData.data.focusSessions) await db.focusSessions.bulkAdd(importData.data.focusSessions);
        if (importData.data.studySessions) await db.studySessions.bulkAdd(importData.data.studySessions);
        if (importData.data.notifications) await db.notifications.bulkAdd(importData.data.notifications);
        if (importData.data.analytics) await db.analytics.bulkAdd(importData.data.analytics);

        console.log('✅ Database imported successfully');
    } catch (error) {
        console.error('❌ Error importing database:', error);
        throw error;
    }
}

/**
 * Clear entire database
 * @returns {Promise<void>}
 */
async function clearDatabase() {
    try {
        await db.tasks.clear();
        await db.habits.clear();
        await db.subjects.clear();
        await db.notes.clear();
        await db.focusSessions.clear();
        await db.studySessions.clear();
        await db.notifications.clear();
        await db.analytics.clear();
        await db.syncQueue.clear();
        
        console.log('✅ Database cleared');
    } catch (error) {
        console.error('❌ Error clearing database:', error);
        throw error;
    }
}

/**
 * Generate mock data for testing
 * @param {number} count - Number of records per table
 * @returns {Promise<void>}
 */
async function generateMockData(count = 10) {
    try {
        console.log(`🔄 Generating ${count} mock records...`);

        // Mock subjects
        const mockSubjects = [
            { name: 'Mathematics', color: '#FF6B6B', icon: '📐' },
            { name: 'Physics', color: '#4ECDC4', icon: '⚛️' },
            { name: 'Chemistry', color: '#95E1D3', icon: '🧪' },
            { name: 'Biology', color: '#F38181', icon: '🧬' },
            { name: 'Computer Science', color: '#AA96DA', icon: '💻' }
        ];

        for (const subject of mockSubjects) {
            await createSubject(subject);
        }

        // Mock tasks
        const priorities = ['low', 'medium', 'high'];
        const statuses = [true, false];
        
        for (let i = 0; i < count; i++) {
            await createTask({
                title: `Mock Task ${i + 1}`,
                description: `This is a test task for development purposes`,
                subject: (i % 5) + 1,
                priority: priorities[i % 3],
                dueDate: new Date(Date.now() + (i * 86400000)).toISOString(),
                completed: statuses[i % 2]
            });
        }

        // Mock habits
        const habitNames = ['Exercise', 'Read', 'Meditate', 'Study', 'Code'];
        for (let i = 0; i < habitNames.length; i++) {
            await createHabit({
                name: habitNames[i],
                frequency: 'daily',
                color: mockSubjects[i].color,
                icon: ['🏃', '📚', '🧘', '📖', '💻'][i]
            });
        }

        // Mock focus sessions
        for (let i = 0; i < count; i++) {
            const startTime = new Date(Date.now() - (i * 7200000));
            const duration = 25 * 60 * 1000; // 25 minutes
            await storeFocusSession({
                subject: (i % 5) + 1,
                duration: duration,
                completed: true,
                startTime: startTime.toISOString(),
                endTime: new Date(startTime.getTime() + duration).toISOString(),
                distractions: Math.floor(Math.random() * 5)
            });
        }

        console.log('✅ Mock data generated successfully');
    } catch (error) {
        console.error('❌ Error generating mock data:', error);
        throw error;
    }
}

/**
 * Get database statistics
 * @returns {Promise<Object>} Database statistics
 */
async function getDatabaseStats() {
    try {
        const stats = {
            tasks: await db.tasks.count(),
            habits: await db.habits.count(),
            subjects: await db.subjects.count(),
            notes: await db.notes.count(),
            focusSessions: await db.focusSessions.count(),
            studySessions: await db.studySessions.count(),
            notifications: await db.notifications.count(),
            analytics: await db.analytics.count(),
            syncQueue: await db.syncQueue.count(),
            pendingSync: await db.syncQueue.where('synced').equals(0).count()
        };

        return stats;
    } catch (error) {
        console.error('❌ Error getting database stats:', error);
        throw error;
    }
}

// ===== PERFORMANCE OPTIMIZATION =====

/**
 * Bulk insert tasks
 * @param {Array} tasks - Array of task objects
 * @returns {Promise<number>} Last inserted ID
 */
async function bulkInsertTasks(tasks) {
    try {
        const timestamp = new Date().toISOString();
        const formattedTasks = tasks.map(task => ({
            ...task,
            createdAt: task.createdAt || timestamp,
            updatedAt: task.updatedAt || timestamp
        }));

        const lastKey = await db.tasks.bulkAdd(formattedTasks);
        
        // Add bulk operation to sync queue
        await addToSyncQueue('tasks', 'bulkCreate', formattedTasks);
        
        console.log(`✅ Bulk inserted ${tasks.length} tasks`);
        return lastKey;
    } catch (error) {
        console.error('❌ Error bulk inserting tasks:', error);
        throw error;
    }
}

/**
 * Get paginated tasks
 * @param {number} page - Page number (0-indexed)
 * @param {number} pageSize - Items per page
 * @param {Object} filter - Filter criteria
 * @returns {Promise<Object>} Paginated results
 */
async function getTasksPaginated(page = 0, pageSize = 20, filter = {}) {
    try {
        let query = db.tasks.toCollection();
        
        // Apply filters
        if (filter.completed !== undefined) {
            query = query.filter(task => task.completed === filter.completed);
        }
        
        if (filter.subject) {
            query = query.filter(task => task.subject === filter.subject);
        }

        const total = await query.count();
        const tasks = await query
            .offset(page * pageSize)
            .limit(pageSize)
            .toArray();

        return {
            data: tasks,
            page: page,
            pageSize: pageSize,
            total: total,
            totalPages: Math.ceil(total / pageSize)
        };
    } catch (error) {
        console.error('❌ Error getting paginated tasks:', error);
        throw error;
    }
}

// ===== ERROR RECOVERY =====

/**
 * Handle database corruption
 * @returns {Promise<void>}
 */
async function handleDatabaseCorruption() {
    try {
        console.log('🔧 Attempting to recover from database corruption...');
        
        // Try to export what we can
        let backup = null;
        try {
            backup = await exportDatabase();
            console.log('✅ Created backup of existing data');
        } catch (error) {
            console.warn('⚠️ Could not create backup');
        }

        // Delete corrupted database
        await db.delete();
        console.log('✅ Deleted corrupted database');

        // Recreate database
        await db.open();
        console.log('✅ Recreated database');

        // Restore from backup if available
        if (backup) {
            await importDatabase(backup);
            console.log('✅ Restored data from backup');
        }

        console.log('✅ Database recovery completed');
    } catch (error) {
        console.error('❌ Database recovery failed:', error);
        throw error;
    }
}

/**
 * Rollback transaction (utility for error recovery)
 * @param {string} table - Table name
 * @param {number} id - Record ID
 * @param {Object} previousState - Previous state to restore
 * @returns {Promise<void>}
 */
async function rollbackTransaction(table, id, previousState) {
    try {
        if (previousState === null) {
            // Record was created, delete it
            await db[table].delete(id);
        } else {
            // Record was updated, restore previous state
            await db[table].update(id, previousState);
        }
        console.log(`✅ Transaction rolled back for ${table}:${id}`);
    } catch (error) {
        console.error('❌ Rollback failed:', error);
        throw error;
    }
}

/**
 * Retry failed sync operations
 * @returns {Promise<Object>} Retry results
 */
async function retryFailedSyncs() {
    try {
        const failedOps = await db.syncQueue
            .where('synced')
            .equals(0)
            .and(op => op.retries > 0 && op.retries < 5)
            .toArray();

        if (failedOps.length === 0) {
            console.log('✅ No failed syncs to retry');
            return { retried: 0, success: 0 };
        }

        console.log(`🔄 Retrying ${failedOps.length} failed sync operations...`);
        
        let successCount = 0;
        for (const op of failedOps) {
            try {
                await syncOperationToFirestore(op);
                await markSyncCompleted(op.id);
                successCount++;
            } catch (error) {
                await markSyncFailed(op.id, error.message);
            }
        }

        console.log(`✅ Retry completed: ${successCount}/${failedOps.length} successful`);
        return { retried: failedOps.length, success: successCount };
    } catch (error) {
        console.error('❌ Error retrying failed syncs:', error);
        throw error;
    }
}

// ===== AUTO-INITIALIZATION =====

// Initialize database on load
db.open().catch(error => {
    console.error('❌ Failed to open database:', error);
    // Attempt recovery
    handleDatabaseCorruption().catch(recoveryError => {
        console.error('❌ Database recovery failed:', recoveryError);
    });
});

// Check for migration on first load
if (needsMigration()) {
    console.log('🔄 Migration needed - run migrateFromLocalStorage()');
}

// Auto-sync every 30 seconds if online
let autoSyncInterval = null;

function startAutoSync(intervalMs = 30000) {
    if (autoSyncInterval) {
        clearInterval(autoSyncInterval);
    }
    
    autoSyncInterval = setInterval(async () => {
        if (navigator.onLine && currentUserId) {
            try {
                await processSyncQueue();
            } catch (error) {
                console.error('❌ Auto-sync failed:', error);
            }
        }
    }, intervalMs);
    
    console.log(`✅ Auto-sync started (interval: ${intervalMs}ms)`);
}

function stopAutoSync() {
    if (autoSyncInterval) {
        clearInterval(autoSyncInterval);
        autoSyncInterval = null;
        console.log('✅ Auto-sync stopped');
    }
}

// Start auto-sync by default
startAutoSync();

// Sync when coming back online
window.addEventListener('online', () => {
    console.log('🌐 Connection restored - syncing...');
    processSyncQueue();
});

// Console helper
console.log(`
🗄️ ProdifyDB Initialized
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 Use these functions:
  - createTask(), updateTask(), deleteTask(), getTasks()
  - createHabit(), updateHabit(), deleteHabit(), getHabits()
  - createSubject(), updateSubject(), deleteSubject(), getSubjects()
  - storeFocusSession(), getFocusSessions()
  - createNote(), updateNote(), deleteNote(), getNotes()
  - processSyncQueue(), retryFailedSyncs()
  - exportDatabase(), clearDatabase(), generateMockData()
  - migrateFromLocalStorage(), getDatabaseStats()
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
