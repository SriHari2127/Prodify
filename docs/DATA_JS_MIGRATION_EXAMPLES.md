# DATA.JS INTEGRATION EXAMPLES

## Quick Reference: How to Update data.js to Use IndexedDB

This guide shows you how to update your existing `data.js` functions to use IndexedDB instead of localStorage/Firestore.

---

## Pattern 1: Creating/Saving Data

### ❌ OLD WAY (localStorage + Firestore)
```javascript
function saveTask(taskText, taskId, isCompleted, dueDate = null) {
    let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
    const taskData = {
        id: taskId,
        text: taskText,
        completed: isCompleted,
        dueDate: dueDate,
        createdAt: new Date().toISOString()
    };
    tasks.push(taskData);
    localStorage.setItem("tasks", JSON.stringify(tasks));
    
    // Also save to Firestore
    if (currentUserId) {
        firebase.firestore().collection("users")
            .doc(currentUserId)
            .collection("tasks")
            .doc(taskId)
            .set(taskData);
    }
}
```

### ✅ NEW WAY (IndexedDB with Auto-Sync)
```javascript
async function saveTask(taskText, taskId, isCompleted, dueDate = null) {
    const taskData = {
        id: taskId,
        text: taskText,
        completed: isCompleted,
        dueDate: dueDate,
        userId: currentUserId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    try {
        // Save to IndexedDB (works offline!)
        await window.db.createTask(taskData);
        console.log('✅ Task saved to IndexedDB');
        
        // Sync happens automatically via syncManager!
        // No need to manually call Firestore
        
    } catch (error) {
        console.error('❌ Failed to save task:', error);
        throw error;
    }
}
```

---

## Pattern 2: Updating Data

### ❌ OLD WAY
```javascript
function toggleTaskCompletion(taskId) {
    let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
    let task = tasks.find(t => t.id === taskId);
    
    if (task) {
        task.completed = !task.completed;
        task.completedDate = task.completed ? new Date().toISOString() : null;
        localStorage.setItem("tasks", JSON.stringify(tasks));
        
        // Update Firestore
        if (currentUserId) {
            firebase.firestore().collection("users")
                .doc(currentUserId)
                .collection("tasks")
                .doc(taskId)
                .update({
                    completed: task.completed,
                    completedDate: task.completedDate
                });
        }
    }
}
```

### ✅ NEW WAY
```javascript
async function toggleTaskCompletion(taskId) {
    try {
        // Get current task
        const task = await window.db.getTask(taskId);
        
        if (task) {
            // Toggle completion
            const updates = {
                completed: !task.completed,
                completedDate: !task.completed ? new Date().toISOString() : null,
                updatedAt: new Date().toISOString()
            };
            
            // Update in IndexedDB
            await window.db.updateTask(taskId, updates);
            console.log('✅ Task updated');
            
            // Auto-sync handles Firestore!
        }
    } catch (error) {
        console.error('❌ Failed to update task:', error);
    }
}
```

---

## Pattern 3: Deleting Data

### ❌ OLD WAY
```javascript
function deleteTask(taskId) {
    let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
    tasks = tasks.filter(t => t.id !== taskId);
    localStorage.setItem("tasks", JSON.stringify(tasks));
    
    // Delete from Firestore
    if (currentUserId) {
        firebase.firestore().collection("users")
            .doc(currentUserId)
            .collection("tasks")
            .doc(taskId)
            .delete();
    }
}
```

### ✅ NEW WAY
```javascript
async function deleteTask(taskId) {
    try {
        await window.db.deleteTask(taskId);
        console.log('✅ Task deleted');
        
        // Auto-sync handles Firestore deletion!
        
    } catch (error) {
        console.error('❌ Failed to delete task:', error);
    }
}
```

---

## Pattern 4: Loading Data

### ❌ OLD WAY
```javascript
function loadTasks() {
    const tasks = JSON.parse(localStorage.getItem("tasks")) || [];
    
    // Clear UI
    const taskList = document.getElementById("taskList");
    if (taskList) taskList.innerHTML = '';
    
    // Render each task
    tasks.forEach(task => {
        createTaskElement(task.text, task.id, task.completed, task.dueDate);
    });
    
    updateCounter();
}
```

### ✅ NEW WAY
```javascript
async function loadTasks() {
    try {
        // Get tasks from IndexedDB
        const tasks = await window.db.getTasks();
        
        // Clear UI
        const taskList = document.getElementById("taskList");
        if (taskList) taskList.innerHTML = '';
        
        // Render each task
        tasks.forEach(task => {
            createTaskElement(task.text, task.id, task.completed, task.dueDate);
        });
        
        updateCounter();
        
    } catch (error) {
        console.error('❌ Failed to load tasks:', error);
    }
}
```

---

## Pattern 5: Bulk Operations

### ✅ NEW WAY (Efficient Batch)
```javascript
async function importTasks(tasksArray) {
    try {
        console.log(`Importing ${tasksArray.length} tasks...`);
        
        // Save all tasks (batched automatically)
        for (const taskData of tasksArray) {
            await window.db.createTask({
                ...taskData,
                userId: currentUserId,
                createdAt: new Date().toISOString()
            });
        }
        
        console.log(`✅ ${tasksArray.length} tasks imported`);
        
        // Trigger sync once (processes all in batches of 20)
        if (window.syncManager) {
            await window.syncManager.triggerSync({ reason: 'MANUAL' });
        }
        
    } catch (error) {
        console.error('❌ Import failed:', error);
    }
}
```

---

## Pattern 6: Habits

### ✅ NEW WAY
```javascript
// Create habit
async function saveHabit(habitText, habitId) {
    const habitData = {
        id: habitId,
        text: habitText,
        streak: 0,
        completedDates: [],
        userId: currentUserId,
        createdAt: new Date().toISOString()
    };
    
    await window.db.createHabit(habitData);
}

// Toggle habit completion
async function toggleHabitCompletion(habitId, date) {
    const habit = await window.db.getHabit(habitId);
    
    if (habit) {
        const completedDates = habit.completedDates || [];
        const dateIndex = completedDates.indexOf(date);
        
        if (dateIndex === -1) {
            completedDates.push(date);
        } else {
            completedDates.splice(dateIndex, 1);
        }
        
        await window.db.updateHabit(habitId, {
            completedDates: completedDates,
            streak: calculateStreak(completedDates),
            updatedAt: new Date().toISOString()
        });
    }
}

// Load habits
async function loadHabits() {
    const habits = await window.db.getHabits();
    
    const habitList = document.getElementById("habitList");
    if (habitList) habitList.innerHTML = '';
    
    habits.forEach(habit => {
        createHabitElement(habit.text, habit.id, habit.completedDates);
    });
}
```

---

## Pattern 7: Focus Sessions

### ✅ NEW WAY
```javascript
async function saveFocusSession(sessionData) {
    try {
        const focusSession = {
            id: Date.now().toString(),
            subjectId: sessionData.subjectId,
            duration: sessionData.duration,
            completed: sessionData.completed,
            xpEarned: sessionData.xpEarned,
            userId: currentUserId,
            completedAt: new Date().toISOString()
        };
        
        // Save to IndexedDB
        await window.db.createFocusSession(focusSession);
        
        // Dispatch custom event for background sync
        window.dispatchEvent(new CustomEvent('focusSessionComplete', {
            detail: focusSession
        }));
        
        console.log('✅ Focus session saved');
        
    } catch (error) {
        console.error('❌ Failed to save focus session:', error);
    }
}
```

---

## Pattern 8: Subjects (Academic)

### ✅ NEW WAY
```javascript
// Create subject
async function saveSubject(subjectData) {
    await window.db.createSubject({
        id: subjectData.id || Date.now().toString(),
        name: subjectData.name,
        color: subjectData.color,
        totalStudyTime: 0,
        userId: currentUserId,
        createdAt: new Date().toISOString()
    });
}

// Update subject
async function updateSubject(subjectId, updates) {
    await window.db.updateSubject(subjectId, {
        ...updates,
        updatedAt: new Date().toISOString()
    });
}

// Delete subject
async function deleteSubject(subjectId) {
    await window.db.deleteSubject(subjectId);
}

// Load subjects
async function loadSubjects() {
    const subjects = await window.db.getSubjects();
    // Render subjects in UI
    return subjects;
}
```

---

## Pattern 9: Notes

### ✅ NEW WAY
```javascript
// Create note
async function saveNote(noteText, noteTitle) {
    await window.db.createNote({
        id: Date.now().toString(),
        title: noteTitle,
        content: noteText,
        userId: currentUserId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });
}

// Update note
async function updateNote(noteId, title, content) {
    await window.db.updateNote(noteId, {
        title: title,
        content: content,
        updatedAt: new Date().toISOString()
    });
}

// Load notes
async function loadNotes() {
    const notes = await window.db.getNotes();
    return notes;
}
```

---

## Migration Strategy

### Step-by-Step Process

1. **Keep Old Functions** (for now)
   - Don't delete existing localStorage functions yet
   - Create new async versions alongside them

2. **Update One Module at a Time**
   - Start with Tasks
   - Then Habits
   - Then Academic/Subjects
   - Then Notes
   - Finally Analytics

3. **Test Offline Functionality**
   - Go offline in DevTools
   - Create/update/delete data
   - Go back online
   - Verify sync happens automatically

4. **Remove localStorage Code** (after testing)
   - Once IndexedDB is working, remove localStorage calls
   - Keep Firestore listeners for real-time updates (optional)

---

## Testing Checklist

### ✅ Test Each Function

```javascript
// Test in browser console

// 1. Create task
await window.db.createTask({
    id: 'test-1',
    text: 'Test Task',
    completed: false,
    userId: currentUserId,
    createdAt: new Date().toISOString()
});

// 2. Get tasks
const tasks = await window.db.getTasks();
console.log('Tasks:', tasks);

// 3. Update task
await window.db.updateTask('test-1', {
    completed: true,
    completedDate: new Date().toISOString()
});

// 4. Delete task
await window.db.deleteTask('test-1');

// 5. Check sync queue
const stats = await window.db.getSyncQueueStats();
console.log('Sync Queue:', stats);

// 6. Trigger manual sync
await window.syncManager.triggerSync({ reason: 'MANUAL' });
```

---

## Common Mistakes to Avoid

### ❌ DON'T DO THIS

```javascript
// ❌ Don't mix localStorage with IndexedDB
function saveTask(task) {
    localStorage.setItem('tasks', JSON.stringify(tasks)); // OLD
    await window.db.createTask(task); // NEW
    // This creates conflicts!
}

// ❌ Don't forget to make functions async
function loadTasks() {
    const tasks = await window.db.getTasks(); // ERROR: await in non-async
}

// ❌ Don't skip error handling
function saveTask(task) {
    await window.db.createTask(task); // Might fail silently
}
```

### ✅ DO THIS

```javascript
// ✅ Use only IndexedDB
async function saveTask(task) {
    try {
        await window.db.createTask(task);
        console.log('✅ Saved');
    } catch (error) {
        console.error('❌ Failed:', error);
    }
}

// ✅ Make functions async
async function loadTasks() {
    const tasks = await window.db.getTasks();
    return tasks;
}

// ✅ Always handle errors
async function updateTask(id, updates) {
    try {
        await window.db.updateTask(id, updates);
    } catch (error) {
        console.error('Failed to update:', error);
        // Show user-friendly message
        alert('Failed to update task. Please try again.');
    }
}
```

---

## Quick Migration Template

Use this template to convert any localStorage function:

```javascript
// TEMPLATE
async function FUNCTION_NAME(params) {
    try {
        // OLD: const data = JSON.parse(localStorage.getItem("KEY")) || [];
        // NEW: const data = await window.db.getKEYS();
        
        // OLD: localStorage.setItem("KEY", JSON.stringify(data));
        // NEW: await window.db.createKEY(data);
        //      OR await window.db.updateKEY(id, data);
        //      OR await window.db.deleteKEY(id);
        
        console.log('✅ Success');
        
    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
}
```

---

## Next Steps

1. **Start with saveTask()** - Update your task creation function
2. **Test offline** - Go offline and create a task
3. **Go online** - Watch it sync automatically
4. **Update other functions** - Follow the same pattern
5. **Remove localStorage** - Once everything works

---

## Need Help?

Check the console for errors:
- ❌ Red errors = something wrong
- ✅ Green checkmarks = working correctly
- 🔄 Blue sync messages = syncing in progress

View sync status:
```javascript
// Get current sync status
const status = window.getSyncStatus();
console.log(status);

// View sync queue
const stats = await window.db.getSyncQueueStats();
console.log(stats);
```

---

**Remember: IndexedDB operations are async, so always use `await` and wrap in `try/catch`!**
