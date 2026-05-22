# IndexedDB Quick Reference

## 🚀 Quick Start

### 1. Include Scripts (in order)
```html
<script src="https://unpkg.com/dexie@4.0.1/dist/dexie.min.js"></script>
<script src="js/core/indexedDB.js"></script>
<script src="js/core/indexedDB-adapter.js"></script>
```

### 2. Initialize
```javascript
await initializeIndexedDB();
```

### 3. Use API
```javascript
// Create task
const id = await createTask({ title: "My Task", dueDate: "2026-03-10" });

// Get tasks
const tasks = await getTasks();

// Update task
await updateTask(id, { completed: true });

// Delete task
await deleteTask(id);
```

---

## 📋 Common Operations

### Tasks

```javascript
// Create
await createTask({
    title: "Complete homework",
    description: "Math chapter 5",
    subject: 1,
    priority: "high",
    dueDate: "2026-03-10",
    dueTime: "14:00"
});

// Get incomplete tasks
const todo = await getTasks({ completed: false });

// Get by date range
const upcoming = await getTasksByDate("2026-03-01", "2026-03-31");

// Update
await updateTask(taskId, { completed: true });

// Delete
await deleteTask(taskId);

// Paginated
const page = await getTasksPaginated(0, 20, { completed: false });
```

### Habits

```javascript
// Create
await createHabit({
    name: "Morning Exercise",
    frequency: "daily",
    color: "#FF6B6B",
    icon: "🏃"
});

// Get all
const habits = await getHabits();

// Update streak
await updateHabit(habitId, { streak: 5 });

// Delete
await deleteHabit(habitId);
```

### Subjects

```javascript
// Create
await createSubject({
    name: "Mathematics",
    color: "#FF6B6B",
    icon: "📐"
});

// Get all (ordered)
const subjects = await getSubjects();

// Update
await updateSubject(subjectId, { name: "Advanced Math" });

// Delete
await deleteSubject(subjectId);
```

### Notes

```javascript
// Create
await createNote({
    title: "Physics Formulas",
    content: "F = ma",
    subject: 2,
    tags: ["formulas"]
});

// Get by subject
const notes = await getNotes({ subject: 2 });

// Get by tag
const formulas = await getNotes({ tag: "formulas" });

// Update
await updateNote(noteId, { content: "Updated content" });

// Delete
await deleteNote(noteId);
```

### Focus Sessions

```javascript
// Store session
await storeFocusSession({
    subject: 1,
    duration: 1500000,  // 25 min in ms
    completed: true,
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    distractions: 2
});

// Get sessions
const sessions = await getFocusSessions(
    "2026-03-01T00:00:00Z",
    "2026-03-07T23:59:59Z"
);
```

### Notifications

```javascript
// Create
await createNotification({
    type: "task_reminder",
    title: "Task Due Soon",
    message: "Complete homework due in 1 hour",
    scheduledTime: "2026-03-07T13:00:00Z"
});

// Mark delivered
await markNotificationDelivered(notificationId);

// Get pending
const pending = await getPendingNotifications();
```

### Analytics

```javascript
// Store metric
await storeAnalytics("focus_time", 1500000, "2026-03-07");
await storeAnalytics("tasks_completed", 5);

// Get metrics
const data = await getAnalytics("focus_time", "2026-03-01", "2026-03-07");
```

---

## 🔄 Sync Operations

```javascript
// Manual sync
const result = await processSyncQueue(20);
// Returns: { success: 18, failed: 2 }

// Get pending operations
const pending = await getPendingSyncOperations();

// Retry failed syncs
await retryFailedSyncs();

// Auto-sync control
startAutoSync(30000);  // Every 30 seconds
stopAutoSync();
```

---

## 🛠️ Debug Tools

```javascript
// Database stats
const stats = await getDatabaseStats();
console.log(stats);
/*
{
    tasks: 45,
    habits: 5,
    subjects: 8,
    syncQueue: 5,
    pendingSync: 2
}
*/

// Export database
const backup = await exportDatabase();
const json = JSON.stringify(backup);
// Save to file...

// Import database
await importDatabase(jsonData);

// Clear all data (⚠️ destructive)
await clearDatabase();

// Generate test data
await generateMockData(10);
```

---

## 🔧 Migration

```javascript
// Check if needed
if (needsMigration()) {
    console.log("Migration required");
}

// Run migration
const results = await migrateFromLocalStorage();
console.log(results);
/*
{
    tasks: 25,
    habits: 5,
    subjects: 8,
    focusSessions: 45
}
*/
```

---

## 🎯 Adapter Functions

For gradual migration from localStorage:

```javascript
// Load data
await loadTasksFromIndexedDB();
await loadHabitsFromIndexedDB();
await loadSubjectsFromIndexedDB();

// Save task (auto-detects create vs update)
await saveTaskToIndexedDB({
    id: 123,  // Optional - omit for new task
    title: "My Task",
    dueDate: "2026-03-10"
});

// Toggle completion
await toggleTaskCompletion(taskId);

// Complete habit
await completeHabitToday(habitId);

// Update sync status UI
await updateSyncStatus();
```

---

## 🔍 Console Debugging

All functions available via `window.IndexedDBDebug`:

```javascript
// Quick stats
IndexedDBDebug.getDatabaseStats()

// View tasks
IndexedDBDebug.getTasks()

// Export everything
IndexedDBDebug.exportDatabase()

// Generate test data
IndexedDBDebug.generateMockData(20)

// Process sync
IndexedDBDebug.processSyncQueue()

// Retry failed
IndexedDBDebug.retryFailedSyncs()
```

---

## 📊 Database Schema

### Tasks
```
id (auto-increment)
title (string)
description (string)
subject (number, indexed)
priority (string, indexed)
dueDate (string, indexed)
dueTime (string)
completed (boolean, indexed)
completedDate (string)
subtasks (array)
recurrence (string)
tags (array)
createdAt (string, indexed)
updatedAt (string, indexed)
```

### Habits
```
id (auto-increment)
name (string, indexed)
description (string)
frequency (string, indexed)
targetDays (array)
streak (number)
bestStreak (number)
lastCompleted (string, indexed)
completionHistory (array)
color (string)
icon (string)
createdAt (string, indexed)
updatedAt (string, indexed)
```

### Sync Queue
```
id (auto-increment)
table (string, indexed)
operation (string, indexed)
payload (object)
timestamp (string, indexed)
synced (boolean, indexed)
retries (number)
priority (number)
error (string)
```

---

## ⚡ Performance Tips

### Use Bulk Operations
```javascript
// ❌ Slow
for (const task of tasks) {
    await createTask(task);
}

// ✅ Fast
await bulkInsertTasks(tasks);
```

### Use Pagination
```javascript
// Large dataset
const page1 = await getTasksPaginated(0, 20);
const page2 = await getTasksPaginated(1, 20);
```

### Filter Efficiently
```javascript
// Uses indexes
await getTasks({ completed: false });
await getTasks({ subject: 1 });
await getTasksByDate("2026-03-01", "2026-03-31");
```

---

## 🚨 Error Handling

```javascript
try {
    await createTask({ title: "My Task" });
} catch (error) {
    if (error.name === 'DatabaseClosedError') {
        await handleDatabaseCorruption();
    } else {
        console.error("Task creation failed:", error);
        showUserError("Could not save task");
    }
}
```

---

## 📱 Offline Detection

```javascript
// Check online status
if (navigator.onLine) {
    await processSyncQueue();
} else {
    console.log("Offline - will sync later");
}

// Listen for events
window.addEventListener('online', async () => {
    console.log('Back online!');
    await processSyncQueue();
});

window.addEventListener('offline', () => {
    console.log('Offline mode');
});
```

---

## 🔐 Conflict Resolution

Automatic timestamp-based resolution:

```javascript
// Local data (newer)
{ title: "Task A", updatedAt: "2026-03-07T10:00:00Z" }

// Cloud data (older)
{ title: "Task B", updatedAt: "2026-03-07T09:00:00Z" }

// Result: Local data wins (newer timestamp)
```

---

## 📦 Data Export/Import

### Export to JSON
```javascript
const backup = await exportDatabase();
const json = JSON.stringify(backup, null, 2);

// Download file
const blob = new Blob([json], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `prodify-backup-${Date.now()}.json`;
a.click();
```

### Import from JSON
```javascript
const fileInput = document.getElementById('importFile');
const file = fileInput.files[0];
const text = await file.text();
const data = JSON.parse(text);

await importDatabase(data);
alert('Import successful!');
```

---

## 🎨 UI Integration

### Show Sync Status
```html
<div id="syncStatus"></div>
```

```javascript
// Updates every 5 seconds automatically
// Shows: ✅ All synced | ⏳ Syncing... | 📴 Offline
```

### Loading Indicator
```javascript
async function loadData() {
    showLoader();
    try {
        await loadTasksFromIndexedDB();
        await loadHabitsFromIndexedDB();
    } finally {
        hideLoader();
    }
}
```

---

## 🐛 Common Issues

### Database won't open
```javascript
// Clear and recreate
await db.delete();
await db.open();
```

### Sync queue too large
```javascript
// Process larger batches
await processSyncQueue(100);

// Clear failed operations
await db.syncQueue.where('retries').above(5).delete();
```

### Duplicate data
```javascript
// Clear and re-sync from cloud
await clearDatabase();
// Then pull from Firestore...
```

---

## 📞 Support

**Check console:** All operations log status messages

**Get stats:** `IndexedDBDebug.getDatabaseStats()`

**Export data:** `IndexedDBDebug.exportDatabase()`

**View queue:** `IndexedDBDebug.getPendingSyncOperations()`

---

## 🔗 Related Files

- `indexedDB.js` - Core database layer
- `indexedDB-adapter.js` - Migration helpers
- `INDEXEDDB_INTEGRATION_GUIDE.md` - Full documentation

---

**Version:** 1.0.0  
**Last Updated:** March 2026  
**Database:** ProdifyDB v1
