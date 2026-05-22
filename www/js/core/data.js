// ===== DATA MODULE (data.js) =====
// Handles all LocalStorage and Firestore logic

// --- Firestore Sync Enhancements ---
let taskSnapshotUnsubscribe = null;
let habitSnapshotUnsubscribe = null;
let subjectSnapshotUnsubscribe = null;
let studyBlockSnapshotUnsubscribe = null;
let examSnapshotUnsubscribe = null;
let focusSessionSnapshotUnsubscribe = null;

// Guard flags to prevent multiple subscriptions
let isHabitListenerActive = false;
let isTaskListenerActive = false;

function loadTasksFromFirestore() {
    if (!currentUserId || typeof firebase === 'undefined') {
        loadTasks(); // Fallback to local storage
        return;
    }

    if (taskSnapshotUnsubscribe) {
        taskSnapshotUnsubscribe();
    }

    // Note on Scope restriction: This query explicitly routes to .doc(currentUserId)
    // which structurally limits querying to the current user's data only.
    taskSnapshotUnsubscribe = firebase.firestore().collection("users").doc(currentUserId).collection("tasks")
        .onSnapshot(snapshot => {
            // FIX: Clear the UI list before populating from Firestore to prevent duplicates
            const taskList = document.getElementById("taskList");
            if (taskList) taskList.innerHTML = '';

            let syncedTasks = [];

            snapshot.forEach(doc => {
                const task = doc.data();
                // Add to array with all enhanced fields
                syncedTasks.push({
                    id: doc.id,
                    text: task.text,
                    completed: task.completed,
                    completedDate: task.completedDate,
                    dueDate: task.dueDate,
                    dueTime: task.dueTime || null,
                    priority: task.priority || null,
                    subjectId: task.subjectId || null,
                    subtasks: task.subtasks || [],
                    recurrence: task.recurrence || null,
                    customRecurrenceDays: task.customRecurrenceDays || null,
                    createdAt: task.createdAt || null
                });

                // Add to UI with all fields
                if (typeof createTaskElement !== 'undefined') {
                    createTaskElement(
                        task.text,
                        doc.id,
                        task.completed || false,
                        task.dueDate || null,
                        task.dueTime || null,
                        task.priority || null,
                        task.subjectId || null,
                        task.subtasks || [],
                        task.recurrence || null
                    );
                }
            });

            // Overwrite local storage with the exact state from Firestore
            localStorage.setItem("tasks", JSON.stringify(syncedTasks));

            if (typeof sortTasks !== 'undefined') sortTasks();
            if (typeof updateCounter !== 'undefined') updateCounter();
            if (typeof updateStats !== 'undefined') updateStats();
            console.log("✅ Tasks synced from Firestore");
        }, error => {
            console.error("❌ Error loading tasks:", error);
            loadTasks(); // Fallback if network fails
        });
}

function loadHabitsFromFirestore() {
    if (!currentUserId || typeof firebase === 'undefined') {
        loadHabits(); // Fallback to local storage
        return;
    }

    // Prevent multiple simultaneous subscriptions
    if (isHabitListenerActive) {
        console.log('⚠️ Habit listener already active, skipping duplicate subscription');
        return;
    }

    if (habitSnapshotUnsubscribe) {
        habitSnapshotUnsubscribe();
        habitSnapshotUnsubscribe = null;
    }

    isHabitListenerActive = true;

    // Note on Scope restriction: This query explicitly routes to .doc(currentUserId)
    // which structurally limits querying to the current user's data only.
    habitSnapshotUnsubscribe = firebase.firestore().collection("users").doc(currentUserId).collection("habits")
        .onSnapshot(snapshot => {
            // FIX: Clear the UI list before populating from Firestore to prevent duplicates
            const habitList = document.getElementById("habitList");
            if (habitList) habitList.innerHTML = '';

            let syncedHabits = [];

            snapshot.forEach(doc => {
                const data = doc.data();

                // Legacy Migration support
                let historyArray = data.history || [];
                if (data.lastCompletedDate && historyArray.length === 0) {
                    historyArray.push(data.lastCompletedDate);
                }

                // Backwards compatibility for single-string reminder times from previous version
                let convertedReminderTimes = [];
                if (Array.isArray(data.reminderTime)) {
                    convertedReminderTimes = data.reminderTime;
                } else if (data.reminderTime) {
                    convertedReminderTimes = [data.reminderTime];
                }

                const habit = {
                    id: doc.id,
                    name: data.name,
                    streak: data.streak || 0,
                    history: historyArray,
                    frequency: data.frequency || 'daily',
                    targetDays: data.targetDays || [],
                    reminderTime: convertedReminderTimes,
                    createdDate: data.createdDate
                };

                syncedHabits.push(habit);

                if (typeof createHabitElement !== 'undefined') {
                    createHabitElement(habit);
                }
            });

            // Overwrite local storage
            localStorage.setItem("habits", JSON.stringify(syncedHabits));

            // Reschedule local notifications to match latest data
            if (typeof HabitReminders !== 'undefined') HabitReminders.scheduleAllHabits();

            console.log("✅ Habits synced from Firestore");
        }, error => {
            console.error("❌ Error loading habits:", error);
            isHabitListenerActive = false;
            loadHabits(); // Fallback
        });
}

// Ensure Memory cleanup on logout
function unsubscribeAllListeners() {
    [taskSnapshotUnsubscribe, habitSnapshotUnsubscribe,
        subjectSnapshotUnsubscribe, studyBlockSnapshotUnsubscribe,
        examSnapshotUnsubscribe, focusSessionSnapshotUnsubscribe
    ].forEach(fn => { if (fn) fn(); });
    taskSnapshotUnsubscribe = null;
    habitSnapshotUnsubscribe = null;
    subjectSnapshotUnsubscribe = null;
    studyBlockSnapshotUnsubscribe = null;
    examSnapshotUnsubscribe = null;
    focusSessionSnapshotUnsubscribe = null;
    
    // Reset guard flags
    isHabitListenerActive = false;
    isTaskListenerActive = false;

    // Cleanup Mind Development listeners
    if (typeof cleanupMindDevelopmentListeners === 'function') {
        cleanupMindDevelopmentListeners();
    }
}

function uploadLocalDataToFirestore() {
    if (!currentUserId || typeof firebase === 'undefined') return;

    console.log("⬆️ Starting data migration to Firestore...");
    const db = firebase.firestore();
    const batch = db.batch();

    // Migrate Tasks
    let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
    tasks.forEach(task => {
        const taskRef = db.collection("users").doc(currentUserId).collection("tasks").doc(task.id);
        batch.set(taskRef, {
            text: task.text,
            completed: task.completed,
            completedDate: task.completedDate || null,
            dueDate: task.dueDate || null,
            dueTime: task.dueTime || null,
            priority: task.priority || null,
            subjectId: task.subjectId || null,
            subtasks: task.subtasks || [],
            recurrence: task.recurrence || null,
            customRecurrenceDays: task.customRecurrenceDays || null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    });

    // Migrate Habits
    let habits = JSON.parse(localStorage.getItem("habits")) || [];
    habits.forEach(habit => {
        const habitRef = db.collection("users").doc(currentUserId).collection("habits").doc(habit.id);
        batch.set(habitRef, {
            name: habit.name,
            streak: habit.streak || 0,
            history: habit.history || [],
            frequency: habit.frequency || 'daily',
            targetDays: habit.targetDays || [],
            reminderTime: Array.isArray(habit.reminderTime) ? habit.reminderTime : [],
            createdDate: habit.createdDate || new Date().toISOString().split('T')[0],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    });

    return batch.commit().then(() => {
        console.log("✅ Local data successfully migrated to Firestore");
    }).catch(error => {
        console.error("❌ Error migrating local data:", error);
    });
}


// --- Local Storage Functions ---

// Save & load tasks (Enhanced with subtasks and recurrence)
// ✅ UPDATED: Now uses IndexedDB with automatic background sync
async function saveTask(taskText, taskId, isCompleted, dueDate = null, dueTime = null, priority = null, subjectId = null, subtasks = [], recurrence = null, customRecurrenceDays = null) {
    const taskData = {
        id: taskId,
        text: taskText,
        completed: isCompleted,
        completedDate: null,
        dueDate: dueDate,
        dueTime: dueTime,
        priority: priority,
        subjectId: subjectId,
        subtasks: subtasks || [],
        recurrence: recurrence || null,
        customRecurrenceDays: customRecurrenceDays || null,
        userId: currentUserId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    try {
        // ✅ NEW: Save to IndexedDB (works offline!)
        if (window.db && typeof window.db.createTask === 'function') {
            await window.db.createTask(taskData);
            console.log('✅ Task saved to IndexedDB');
            
            // Auto-sync will handle Firestore sync automatically
            if (typeof updateStats !== 'undefined') updateStats();
        } else {
            // Fallback to localStorage if IndexedDB not ready
            console.warn('⚠️ IndexedDB not ready, using localStorage fallback');
            let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
            tasks.push(taskData);
            localStorage.setItem("tasks", JSON.stringify(tasks));
            
            if (typeof saveTaskToFirestore !== 'undefined' && currentUserId) {
                saveTaskToFirestoreEnhanced(taskData);
            } else {
                if (typeof updateStats !== 'undefined') updateStats();
            }
        }
    } catch (error) {
        console.error('❌ Failed to save task:', error);
        // Fallback to localStorage on error
        let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
        tasks.push(taskData);
        localStorage.setItem("tasks", JSON.stringify(tasks));
    }
}

// Enhanced Firestore save for tasks with all fields
function saveTaskToFirestoreEnhanced(taskData) {
    if (!currentUserId || typeof firebase === 'undefined') return;

    const taskRef = firebase.firestore().collection("users").doc(currentUserId).collection("tasks").doc(taskData.id);
    taskRef.set({
        text: taskData.text,
        completed: taskData.completed || false,
        completedDate: taskData.completedDate || null,
        dueDate: taskData.dueDate || null,
        dueTime: taskData.dueTime || null,
        priority: taskData.priority || null,
        subjectId: taskData.subjectId || null,
        subtasks: taskData.subtasks || [],
        recurrence: taskData.recurrence || null,
        customRecurrenceDays: taskData.customRecurrenceDays || null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        console.log("✅ Task saved to Firestore");
    }).catch(err => {
        console.error("❌ Error saving task:", err);
    });
}

// Update subtasks in a task
function updateTaskSubtasks(taskId, subtasks) {
    let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
    let task = tasks.find(t => t.id === taskId);
    if (task) {
        task.subtasks = subtasks;
        localStorage.setItem("tasks", JSON.stringify(tasks));

        if (currentUserId && typeof firebase !== 'undefined') {
            updateTaskInFirestore(taskId, { subtasks: subtasks });
        }
    }
}

// Get task by ID
function getTaskById(taskId) {
    let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
    return tasks.find(t => t.id === taskId) || null;
}

// Handle recurring task completion
function handleRecurringTaskCompletion(taskId) {
    let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
    let task = tasks.find(t => t.id === taskId);

    if (task && task.recurrence && task.recurrence !== 'none' && typeof shouldGenerateRecurrence === 'function') {
        if (shouldGenerateRecurrence(task)) {
            const newTask = createRecurringTaskInstance(task);

            // Save the new recurring instance
            saveTask(
                newTask.text,
                newTask.id,
                false,
                newTask.dueDate,
                newTask.dueTime,
                newTask.priority,
                newTask.subjectId,
                newTask.subtasks,
                newTask.recurrence,
                newTask.customRecurrenceDays
            );

            // Create UI element for new task
            if (typeof createTaskElement === 'function') {
                createTaskElement(
                    newTask.text,
                    newTask.id,
                    false,
                    newTask.dueDate,
                    newTask.dueTime,
                    newTask.priority,
                    newTask.subjectId,
                    newTask.subtasks,
                    newTask.recurrence
                );
            }

            console.log("🔄 Recurring task instance created:", newTask.dueDate);
        }
    }
}

// ✅ UPDATED: Load tasks from IndexedDB
async function loadTasks() {
    const taskList = document.getElementById("taskList");
    
    try {
        // Try loading from IndexedDB first
        if (window.db && typeof window.db.getTasks === 'function') {
            const tasks = await window.db.getTasks();
            
            if (taskList) taskList.innerHTML = '';
            
            tasks.forEach(task => {
                if (typeof createTaskElement === 'function') {
                    createTaskElement(task.text, task.id, task.completed || false, task.dueDate || null, task.dueTime || null, task.priority || null, task.subjectId || null, task.subtasks || [], task.recurrence || null);
                }
            });
            
            if (typeof sortTasks === 'function') sortTasks();
            console.log('✅ Tasks loaded from IndexedDB');
        } else {
            // Fallback to localStorage
            if (taskList && taskList.children.length === 0) {
                let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
                tasks.forEach(task => {
                    if (typeof createTaskElement === 'function') {
                        createTaskElement(task.text, task.id, task.completed || false, task.dueDate || null, task.dueTime || null, task.priority || null, task.subjectId || null, task.subtasks || [], task.recurrence || null);
                    }
                });
                if (typeof sortTasks === 'function') sortTasks();
            }
        }
    } catch (error) {
        console.error('❌ Failed to load tasks from IndexedDB:', error);
        // Fallback to localStorage
        let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
        if (taskList) taskList.innerHTML = '';
        tasks.forEach(task => {
            if (typeof createTaskElement === 'function') {
                createTaskElement(task.text, task.id, task.completed || false, task.dueDate || null, task.dueTime || null, task.priority || null, task.subjectId || null, task.subtasks || [], task.recurrence || null);
            }
        });
    }
    
    // Update stats and UI
    if (typeof updateStats !== 'undefined') updateStats();
    if (typeof updateTasksEmptyState !== 'undefined') updateTasksEmptyState();
    
    // Remove skeleton loader after tasks are loaded
    if (typeof SkeletonLoader !== 'undefined') {
        setTimeout(() => SkeletonLoader.remove('#taskList'), 800);
    }
}

// ✅ UPDATED: Delete task using IndexedDB
async function removeTask(taskId) {
    try {
        // Cancel local notifications for this task
        if (typeof AppReminders !== 'undefined') AppReminders.cancelTaskReminder(taskId);
        
        // Delete from IndexedDB (auto-syncs to Firestore)
        if (window.db && typeof window.db.deleteTask === 'function') {
            await window.db.deleteTask(taskId);
            console.log('✅ Task deleted from IndexedDB');
        } else {
            // Fallback to localStorage
            let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
            tasks = tasks.filter(task => task.id !== taskId);
            localStorage.setItem("tasks", JSON.stringify(tasks));
            
            // Delete from Firestore manually if no IndexedDB
            if (typeof deleteTaskFromFirestore !== 'undefined' && currentUserId) {
                deleteTaskFromFirestore(taskId);
            }
        }
        
        // Update UI
        if (typeof updateStats !== 'undefined') updateStats();
        if (typeof updateTasksEmptyState !== 'undefined') updateTasksEmptyState();
        
    } catch (error) {
        console.error('❌ Failed to delete task:', error);
        // Fallback to localStorage on error
        let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
        tasks = tasks.filter(task => task.id !== taskId);
        localStorage.setItem("tasks", JSON.stringify(tasks));
    }
}

// ✅ UPDATED: Toggle task completion using IndexedDB
async function updateTaskCompletion(taskId) {
    try {
        // Get task from IndexedDB
        const task = window.db && typeof window.db.getTask === 'function' 
            ? await window.db.getTask(taskId)
            : null;
        
        if (task) {
            // Toggle completion
            const newCompleted = !task.completed;
            const updates = {
                completed: newCompleted,
                completedDate: newCompleted ? new Date().toISOString().split('T')[0] : null,
                updatedAt: new Date().toISOString()
            };
            
            // Handle notifications
            if (newCompleted) {
                if (typeof AppReminders !== 'undefined') AppReminders.cancelTaskReminder(taskId);
            } else {
                if (typeof AppReminders !== 'undefined') AppReminders.scheduleTaskReminder({ ...task, ...updates });
            }
            
            // Update in IndexedDB (auto-syncs to Firestore)
            await window.db.updateTask(taskId, updates);
            console.log('✅ Task completion updated');
            
            // Update UI
            if (typeof updateStats !== 'undefined') updateStats();
            if (typeof sortTasks === 'function') sortTasks();
            
        } else {
            // Fallback to localStorage
            let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
            let localTask = tasks.find(t => t.id === taskId);
            if (localTask) {
                localTask.completed = !localTask.completed;
                if (localTask.completed) {
                    localTask.completedDate = new Date().toISOString().split('T')[0];
                    if (typeof AppReminders !== 'undefined') AppReminders.cancelTaskReminder(taskId);
                } else {
                    localTask.completedDate = null;
                    if (typeof AppReminders !== 'undefined') AppReminders.scheduleTaskReminder(localTask);
                }
                localStorage.setItem("tasks", JSON.stringify(tasks));
                
                if (typeof updateTaskInFirestore !== 'undefined' && currentUserId) {
                    updateTaskInFirestore(taskId, {
                        completed: localTask.completed,
                        completedDate: localTask.completedDate
                    });
                }
                
                if (typeof updateStats !== 'undefined') updateStats();
                if (typeof sortTasks === 'function') sortTasks();
            }
        }
    } catch (error) {
        console.error('❌ Failed to update task completion:', error);
    }
}

function updateTaskText(taskId, newText) {
    let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
    let task = tasks.find(t => t.id === taskId);
    if (task) {
        task.text = newText;
        localStorage.setItem("tasks", JSON.stringify(tasks));

        // Update in Firestore as well
        if (typeof updateTaskInFirestore !== 'undefined' && currentUserId) {
            updateTaskInFirestore(taskId, { text: newText });
        }
    }
}

function saveTaskOrder() {
    const taskList = document.getElementById("taskList");
    if (!taskList) return;

    const orderedIds = Array.from(taskList.querySelectorAll("li")).map(li => li.getAttribute("data-id"));

    let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
    const reorderedTasks = orderedIds.map(id => tasks.find(t => t.id === id)).filter(t => t);

    localStorage.setItem("tasks", JSON.stringify(reorderedTasks));
}

// Habit Functions
function saveHabit(habitObj) {
    let habits = JSON.parse(localStorage.getItem("habits")) || [];

    // Ensure all required fields exist
    const newHabit = {
        id: habitObj.id,
        name: habitObj.name,
        streak: habitObj.streak || 0,
        history: habitObj.history || [],
        frequency: habitObj.frequency || 'daily',
        targetDays: habitObj.targetDays || [],
        reminderTime: Array.isArray(habitObj.reminderTime) ? habitObj.reminderTime : [],
        createdDate: habitObj.createdDate || new Date().toISOString().split('T')[0]
    };

    habits.push(newHabit);
    localStorage.setItem("habits", JSON.stringify(habits));

    // Save to Firestore as well
    if (typeof saveHabitToFirestore !== 'undefined' && currentUserId) {
        saveHabitToFirestore(newHabit);
    }
}

function loadHabits() {
    const habitList = document.getElementById("habitList");
    if (habitList && habitList.children.length === 0) {
        let habits = JSON.parse(localStorage.getItem("habits")) || [];

        let migrated = false;

        habits.forEach(habit => {
            // Legacy Migration
            if (!habit.history) {
                habit.history = [];
                if (habit.lastCompletedDate) {
                    habit.history.push(habit.lastCompletedDate);
                }
                habit.frequency = habit.frequency || 'daily';
                habit.targetDays = habit.targetDays || [];
                migrated = true;
            }

            if (habit.reminderTime === undefined || habit.reminderTime === null) {
                habit.reminderTime = [];
                migrated = true;
            } else if (!Array.isArray(habit.reminderTime)) {
                // If the user made a habit during the "single string" reminder version, bump it to an Array
                habit.reminderTime = [habit.reminderTime];
                migrated = true;
            }

            if (typeof createHabitElement === 'function') {
                createHabitElement(habit);
            }
        });

        if (migrated) {
            localStorage.setItem("habits", JSON.stringify(habits));
        }
    }

    if (typeof updateHabitsEmptyState !== 'undefined') updateHabitsEmptyState();
    
    // Remove skeleton loader after habits are loaded
    if (typeof SkeletonLoader !== 'undefined') {
        setTimeout(() => SkeletonLoader.remove('#habitList'), 800);
    }
}

function deleteHabit(habitId) {
    let habits = JSON.parse(localStorage.getItem("habits")) || [];
    habits = habits.filter(habit => habit.id !== habitId);
    localStorage.setItem("habits", JSON.stringify(habits));

    // Reschedule habit notifications (removes deleted habit's reminders)
    if (typeof AppReminders !== 'undefined') AppReminders.scheduleAllHabits();

    // Delete from Firestore as well
    if (typeof deleteHabitFromFirestore !== 'undefined' && currentUserId) {
        deleteHabitFromFirestore(habitId);
    }

    if (typeof updateHabitsEmptyState !== 'undefined') updateHabitsEmptyState();
}

// ===== Academic Data — Firestore Loaders =====

function loadSubjectsFromFirestore() {
    if (!currentUserId || typeof firebase === 'undefined') return;
    if (subjectSnapshotUnsubscribe) subjectSnapshotUnsubscribe();
    subjectSnapshotUnsubscribe = firebase.firestore().collection('users').doc(currentUserId)
        .collection('subjects').onSnapshot(snap => {
            const subjects = [];
            snap.forEach(doc => subjects.push({ id: doc.id, ...doc.data() }));
            localStorage.setItem('subjects', JSON.stringify(subjects));
            if (typeof renderSubjectChips === 'function') renderSubjectChips();
        }, err => { console.error('❌ subjects listener:', err); });
}

function loadStudyBlocksFromFirestore() {
    if (!currentUserId || typeof firebase === 'undefined') return;
    if (studyBlockSnapshotUnsubscribe) studyBlockSnapshotUnsubscribe();
    studyBlockSnapshotUnsubscribe = firebase.firestore().collection('users').doc(currentUserId)
        .collection('studyBlocks').onSnapshot(snap => {
            const blocks = [];
            snap.forEach(doc => blocks.push({ id: doc.id, ...doc.data() }));
            localStorage.setItem('studyBlocks', JSON.stringify(blocks));
            if (typeof renderStudyPlanner === 'function') renderStudyPlanner();
        }, err => { console.error('❌ studyBlocks listener:', err); });
}

function loadExamsFromFirestore() {
    if (!currentUserId || typeof firebase === 'undefined') return;
    if (examSnapshotUnsubscribe) examSnapshotUnsubscribe();
    examSnapshotUnsubscribe = firebase.firestore().collection('users').doc(currentUserId)
        .collection('exams').onSnapshot(snap => {
            const exams = [];
            snap.forEach(doc => exams.push({ id: doc.id, ...doc.data() }));
            localStorage.setItem('exams', JSON.stringify(exams));
            if (typeof renderExams === 'function') renderExams();
        }, err => { console.error('❌ exams listener:', err); });
}

function loadFocusSessionsFromFirestore() {
    if (!currentUserId || typeof firebase === 'undefined') return;
    if (focusSessionSnapshotUnsubscribe) focusSessionSnapshotUnsubscribe();
    focusSessionSnapshotUnsubscribe = firebase.firestore().collection('users').doc(currentUserId)
        .collection('focusSessions').onSnapshot(snap => {
            const sessions = [];
            snap.forEach(doc => sessions.push({ id: doc.id, ...doc.data() }));
            localStorage.setItem('focusSessions', JSON.stringify(sessions));
            if (typeof renderFocusStats === 'function') renderFocusStats();
        }, err => { console.error('❌ focusSessions listener:', err); });
}
