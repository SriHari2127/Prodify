# IndexedDB Offline-First Data Layer - Integration Guide

## Overview

This guide explains how to integrate the new IndexedDB-based data layer into your Prodify application, replacing localStorage with a scalable, offline-first database system.

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Application Layer                   │
│         (UI Components & Business Logic)         │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│            CRUD Operations API                   │
│  createTask(), updateTask(), getTasks(), etc.    │
└────────────────┬────────────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌──────────────┐  ┌──────────────┐
│  IndexedDB   │  │  Sync Queue  │
│  (ProdifyDB) │  │              │
└──────────────┘  └──────┬───────┘
                         │
                         ▼
                  ┌──────────────┐
                  │   Firebase   │
                  │  Firestore   │
                  └──────────────┘
```

## Installation

### Step 1: Install Dexie.js

Already added to `package.json`:

```json
{
  "dependencies": {
    "dexie": "^4.0.1"
  }
}
```

Install dependencies:

```bash
npm install
```

### Step 2: Include Dexie.js in HTML

Add to your `index.html` **before** the IndexedDB script:

```html
<!-- Load Dexie.js from CDN -->
<script src="https://unpkg.com/dexie@4.0.1/dist/dexie.min.js"></script>

<!-- Load IndexedDB Layer -->
<script src="js/core/indexedDB.js"></script>
```

### Step 3: Load Order

Ensure scripts are loaded in this order in `index.html`:

```html
<!-- 1. Firebase SDKs -->
<script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-firestore-compat.js"></script>

<!-- 2. Firebase Config -->
<script src="js/core/firebase-config.js"></script>

<!-- 3. Dexie.js -->
<script src="https://unpkg.com/dexie@4.0.1/dist/dexie.min.js"></script>

<!-- 4. IndexedDB Layer -->
<script src="js/core/indexedDB.js"></script>

<!-- 5. Other app modules -->
<script src="js/core/data.js"></script>
<script src="js/tasks/taskUtils.js"></script>
<!-- ... other scripts ... -->
```

## Database Schema

### ProdifyDB Tables

| Table | Key Fields | Indexes |
|-------|-----------|---------|
| `tasks` | id, title, subject, priority, dueDate, completed | dueDate, subject, priority, completed |
| `habits` | id, name, frequency, streak, lastCompleted | frequency, lastCompleted |
| `subjects` | id, name, color, order | order |
| `notes` | id, title, subject, tags | subject |
| `focusSessions` | id, subject, duration, startTime, endTime | subject, startTime |
| `studySessions` | id, subject, duration, date | subject, date |
| `notifications` | id, type, scheduledTime, delivered | scheduledTime, delivered |
| `analytics` | id, date, metric, value | date, metric |
| `syncQueue` | id, table, operation, timestamp, synced | synced, timestamp |

## API Reference

### Tasks

#### Create Task

```javascript
const taskId = await createTask({
    title: "Complete homework",
    description: "Math assignment chapter 5",
    subject: 1,  // Subject ID
    priority: "high",  // "low", "medium", "high"
    dueDate: "2026-03-10",
    dueTime: "14:00",
    subtasks: [],
    tags: ["homework", "math"]
});
```

#### Update Task

```javascript
await updateTask(taskId, {
    completed: true,
    completedDate: new Date().toISOString()
});
```

#### Delete Task

```javascript
await deleteTask(taskId);
```

#### Get All Tasks

```javascript
// All tasks
const allTasks = await getTasks();

// Filter by completion status
const incompleteTasks = await getTasks({ completed: false });

// Filter by subject
const mathTasks = await getTasks({ subject: 1 });

// Filter by priority
const highPriorityTasks = await getTasks({ priority: "high" });
```

#### Get Tasks by Date

```javascript
const tasks = await getTasksByDate(
    "2026-03-01",  // Start date
    "2026-03-31"   // End date
);
```

#### Get Single Task

```javascript
const task = await getTaskById(taskId);
```

#### Paginated Tasks

```javascript
const result = await getTasksPaginated(0, 20, { completed: false });
// Returns: { data: [...], page: 0, pageSize: 20, total: 45, totalPages: 3 }
```

### Habits

#### Create Habit

```javascript
const habitId = await createHabit({
    name: "Morning Exercise",
    description: "30 minutes workout",
    frequency: "daily",  // "daily", "weekly", "custom"
    targetDays: [1, 3, 5],  // For custom frequency
    color: "#FF6B6B",
    icon: "🏃"
});
```

#### Update Habit

```javascript
await updateHabit(habitId, {
    streak: 5,
    lastCompleted: new Date().toISOString()
});
```

#### Delete Habit

```javascript
await deleteHabit(habitId);
```

#### Get All Habits

```javascript
const habits = await getHabits();
```

### Subjects

#### Create Subject

```javascript
const subjectId = await createSubject({
    name: "Mathematics",
    color: "#FF6B6B",
    icon: "📐",
    order: 0
});
```

#### Update Subject

```javascript
await updateSubject(subjectId, {
    name: "Advanced Mathematics",
    order: 1
});
```

#### Delete Subject

```javascript
await deleteSubject(subjectId);
```

#### Get All Subjects

```javascript
const subjects = await getSubjects();  // Returns ordered by 'order' field
```

### Notes

#### Create Note

```javascript
const noteId = await createNote({
    title: "Physics Formulas",
    content: "F = ma\nE = mc²",
    subject: 2,
    tags: ["formulas", "reference"],
    attachments: []
});
```

#### Update Note

```javascript
await updateNote(noteId, {
    content: "Updated content..."
});
```

#### Delete Note

```javascript
await deleteNote(noteId);
```

#### Get Notes

```javascript
// All notes
const allNotes = await getNotes();

// By subject
const physicsNotes = await getNotes({ subject: 2 });

// By tag
const formulaNotes = await getNotes({ tag: "formulas" });
```

### Focus Sessions

#### Store Focus Session

```javascript
const sessionId = await storeFocusSession({
    subject: 1,
    duration: 1500000,  // 25 minutes in milliseconds
    completed: true,
    interrupted: false,
    startTime: "2026-03-07T10:00:00Z",
    endTime: "2026-03-07T10:25:00Z",
    blockedApps: ["instagram", "twitter"],
    distractions: 2
});
```

#### Get Focus Sessions

```javascript
const sessions = await getFocusSessions(
    "2026-03-01T00:00:00Z",
    "2026-03-07T23:59:59Z"
);
```

### Study Sessions

#### Create Study Session

```javascript
const sessionId = await createStudySession({
    subject: 1,
    duration: 3600000,  // 1 hour in milliseconds
    topic: "Linear Algebra",
    notes: "Covered matrices and determinants",
    date: "2026-03-07",
    completed: true
});
```

#### Get Study Sessions by Date

```javascript
const sessions = await getStudySessionsByDate("2026-03-07");
```

### Notifications

#### Create Notification

```javascript
const notificationId = await createNotification({
    type: "task_reminder",
    title: "Task Due Soon",
    message: "Complete homework is due in 1 hour",
    scheduledTime: "2026-03-07T13:00:00Z",
    data: { taskId: 123 }
});
```

#### Mark as Delivered

```javascript
await markNotificationDelivered(notificationId);
```

#### Get Pending Notifications

```javascript
const pending = await getPendingNotifications();
```

### Analytics

#### Store Analytics

```javascript
await storeAnalytics("focus_time", 1500000, "2026-03-07");
await storeAnalytics("tasks_completed", 5, "2026-03-07");
await storeAnalytics("productivity_score", 87.5, "2026-03-07");
```

#### Get Analytics

```javascript
const focusData = await getAnalytics(
    "focus_time",
    "2026-03-01",
    "2026-03-07"
);
```

## Sync Queue System

### How It Works

1. **Write to IndexedDB First**  
   All CRUD operations write to IndexedDB immediately, ensuring offline functionality.

2. **Add to Sync Queue**  
   Each operation is automatically added to the sync queue with metadata.

3. **Background Sync**  
   An auto-sync process runs every 30 seconds to push pending operations to Firestore.

4. **Conflict Resolution**  
   Uses `updatedAt` timestamps to determine which version is newer.

### Manual Sync Control

#### Process Sync Queue

```javascript
// Sync up to 20 operations
const result = await processSyncQueue(20);
console.log(result);  // { success: 18, failed: 2 }
```

#### Get Pending Operations

```javascript
const pending = await getPendingSyncOperations(20);
console.log(pending);  // Array of sync queue entries
```

#### Retry Failed Syncs

```javascript
const result = await retryFailedSyncs();
console.log(result);  // { retried: 5, success: 4 }
```

#### Auto-Sync Control

```javascript
// Start auto-sync (default: 30 seconds)
startAutoSync(30000);

// Stop auto-sync
stopAutoSync();

// Custom interval (every minute)
startAutoSync(60000);
```

### Sync Queue Entry Structure

```javascript
{
    id: 123,
    table: "tasks",
    operation: "create",  // or "update", "delete"
    payload: { /* data */ },
    timestamp: "2026-03-07T10:00:00Z",
    synced: false,
    retries: 0,
    priority: 1,  // 1 = high, 0 = low
    error: null
}
```

## Conflict Resolution

The system uses **timestamp-based conflict resolution**:

### Strategy

1. **Local Newer** → Overwrite cloud data
2. **Cloud Newer** → Accept cloud data
3. **Same Timestamp** → Merge both, prefer non-null values

### Example

```javascript
// Automatic conflict resolution
const localData = { title: "Task A", updatedAt: "2026-03-07T10:00:00Z" };
const cloudData = { title: "Task B", updatedAt: "2026-03-07T09:00:00Z" };

const resolved = resolveConflict(localData, cloudData);
// Result: localData (newer timestamp)
```

## Data Migration

### From localStorage to IndexedDB

#### Check if Migration Needed

```javascript
if (needsMigration()) {
    console.log("Migration required!");
}
```

#### Run Migration

```javascript
const results = await migrateFromLocalStorage();
console.log(results);
/*
{
    tasks: 25,
    habits: 5,
    subjects: 8,
    notes: 12,
    focusSessions: 45,
    studySessions: 10,
    notifications: 3,
    skipped: []
}
*/
```

#### Migration Process

1. Reads data from localStorage
2. Transforms schema to IndexedDB format
3. Bulk inserts into IndexedDB
4. Creates backup in `localStorage_backup`
5. Sets `migration_completed` flag

### Migration Safety

- Original localStorage data is backed up before clearing
- Access backup via: `localStorage.getItem('localStorage_backup')`
- Rollback if needed by importing from backup

## Debug Utilities

### Export Database

```javascript
const exportData = await exportDatabase();

// Save to file
const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'prodify-backup.json';
a.click();
```

### Import Database

```javascript
// From file input
const fileInput = document.getElementById('importFile');
const file = fileInput.files[0];
const text = await file.text();
const data = JSON.parse(text);

await importDatabase(data);
```

### Clear Database

```javascript
// ⚠️ WARNING: This deletes ALL data!
await clearDatabase();
```

### Generate Mock Data

```javascript
// Create 10 mock records per table for testing
await generateMockData(10);
```

### Database Statistics

```javascript
const stats = await getDatabaseStats();
console.log(stats);
/*
{
    tasks: 45,
    habits: 5,
    subjects: 8,
    notes: 20,
    focusSessions: 120,
    studySessions: 35,
    notifications: 10,
    analytics: 200,
    syncQueue: 5,
    pendingSync: 2
}
*/
```

## Performance Optimization

### Bulk Operations

Instead of inserting one at a time:

```javascript
// ❌ Slow
for (const task of tasks) {
    await createTask(task);
}

// ✅ Fast
await bulkInsertTasks(tasks);
```

### Pagination

For large datasets:

```javascript
// Load 20 items at a time
const page1 = await getTasksPaginated(0, 20);
const page2 = await getTasksPaginated(1, 20);
```

### Indexing

Already optimized! Indexes are automatically used for:
- `dueDate` queries
- `subject` filtering
- `priority` filtering
- `completed` status

## Error Recovery

### Handle Database Corruption

```javascript
try {
    // Your database operation
    await createTask({ title: "Test" });
} catch (error) {
    if (error.name === 'DatabaseClosedError') {
        await handleDatabaseCorruption();
    }
}
```

### Transaction Rollback

```javascript
const previousState = await getTaskById(taskId);

try {
    await updateTask(taskId, newData);
    // If something goes wrong...
    throw new Error("Business logic error");
} catch (error) {
    // Rollback to previous state
    await rollbackTransaction('tasks', taskId, previousState);
}
```

## Integration Examples

### Replace Existing Task Functions

#### Before (localStorage)

```javascript
function addTask(text, dueDate) {
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const task = {
        id: Date.now(),
        text: text,
        dueDate: dueDate,
        completed: false
    };
    tasks.push(task);
    localStorage.setItem('tasks', JSON.stringify(tasks));
}
```

#### After (IndexedDB)

```javascript
async function addTask(text, dueDate) {
    const taskId = await createTask({
        title: text,
        dueDate: dueDate
    });
    return taskId;
}
```

### Replace Existing Habit Functions

#### Before (localStorage)

```javascript
function saveHabit(name) {
    const habits = JSON.parse(localStorage.getItem('habits') || '[]');
    habits.push({ id: Date.now(), name: name, streak: 0 });
    localStorage.setItem('habits', JSON.stringify(habits));
}
```

#### After (IndexedDB)

```javascript
async function saveHabit(name) {
    const habitId = await createHabit({ name: name });
    return habitId;
}
```

### Update UI on Data Change

```javascript
// Listen for online/offline status
window.addEventListener('online', async () => {
    console.log('Back online - syncing...');
    await processSyncQueue();
    
    // Refresh UI
    await refreshDashboard();
});

// Refresh dashboard
async function refreshDashboard() {
    const tasks = await getTasks({ completed: false });
    const habits = await getHabits();
    
    // Update UI
    renderTasks(tasks);
    renderHabits(habits);
}
```

## Testing Offline Functionality

### Simulate Offline Mode

```javascript
// In Chrome DevTools:
// 1. Open DevTools (F12)
// 2. Go to Network tab
// 3. Select "Offline" from throttling dropdown

// Test operations
await createTask({ title: "Offline task" });
await updateHabit(1, { streak: 5 });

// Check sync queue
const pending = await getPendingSyncOperations();
console.log(`${pending.length} operations pending`);

// Go back online and sync
await processSyncQueue();
```

## Best Practices

### 1. Always Use Async/Await

```javascript
// ✅ Correct
async function loadTasks() {
    const tasks = await getTasks();
    renderTasks(tasks);
}

// ❌ Wrong
function loadTasks() {
    getTasks().then(tasks => renderTasks(tasks));  // Avoid mixing patterns
}
```

### 2. Handle Errors Gracefully

```javascript
async function saveTask(data) {
    try {
        const taskId = await createTask(data);
        showSuccess("Task created!");
        return taskId;
    } catch (error) {
        console.error("Failed to create task:", error);
        showError("Could not save task. Will retry when online.");
        return null;
    }
}
```

### 3. Show Sync Status to Users

```javascript
// Display sync indicator
async function updateSyncIndicator() {
    const stats = await getDatabaseStats();
    
    if (stats.pendingSync > 0) {
        document.getElementById('syncStatus').textContent = 
            `⏳ ${stats.pendingSync} items pending sync`;
    } else {
        document.getElementById('syncStatus').textContent = 
            '✅ All synced';
    }
}

// Update every 5 seconds
setInterval(updateSyncIndicator, 5000);
```

### 4. Validate Data Before Saving

```javascript
async function saveTask(data) {
    // Validate required fields
    if (!data.title || data.title.trim() === '') {
        throw new Error('Task title is required');
    }
    
    if (data.dueDate && new Date(data.dueDate) < new Date()) {
        throw new Error('Due date cannot be in the past');
    }
    
    // Save if valid
    return await createTask(data);
}
```

### 5. Clean Up Old Data Periodically

```javascript
async function cleanupOldData() {
    // Delete completed tasks older than 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const oldTasks = await db.tasks
        .where('completed').equals(true)
        .and(task => new Date(task.completedDate) < ninetyDaysAgo)
        .toArray();
    
    for (const task of oldTasks) {
        await deleteTask(task.id);
    }
    
    console.log(`Cleaned up ${oldTasks.length} old tasks`);
}

// Run weekly
setInterval(cleanupOldData, 7 * 24 * 60 * 60 * 1000);
```

## Troubleshooting

### Database Not Opening

**Problem:** `db.open()` fails

**Solution:**
```javascript
// Check if IndexedDB is supported
if (!window.indexedDB) {
    console.error('IndexedDB not supported in this browser');
    // Fall back to localStorage
}

// Clear corrupted database
await db.delete();
await db.open();
```

### Sync Queue Growing Too Large

**Problem:** Thousands of unsynced operations

**Solution:**
```javascript
// Process in larger batches
await processSyncQueue(100);

// Or clear failed operations after max retries
await db.syncQueue.where('retries').above(5).delete();
```

### Duplicate Data After Sync

**Problem:** Items appear twice after syncing

**Solution:**
```javascript
// Ensure unique IDs when syncing
// Use Firestore document ID as IndexedDB key
// Or implement de-duplication logic
```

### Performance Issues

**Problem:** Queries are slow

**Solution:**
```javascript
// Use pagination
const result = await getTasksPaginated(0, 20);

// Add more indexes if needed
db.version(2).stores({
    tasks: '++id, title, subject, priority, dueDate, completed, createdAt, updatedAt, [subject+dueDate]'
    // Compound index for common queries
});
```

## Browser Compatibility

| Browser | IndexedDB | Dexie.js | Status |
|---------|-----------|----------|--------|
| Chrome 24+ | ✅ | ✅ | Fully Supported |
| Firefox 16+ | ✅ | ✅ | Fully Supported |
| Safari 10+ | ✅ | ✅ | Fully Supported |
| Edge 12+ | ✅ | ✅ | Fully Supported |
| Opera 15+ | ✅ | ✅ | Fully Supported |
| iOS Safari 10+ | ✅ | ✅ | Fully Supported |
| Android Chrome | ✅ | ✅ | Fully Supported |

## Next Steps

1. **Run Migration**
   ```javascript
   await migrateFromLocalStorage();
   ```

2. **Replace localStorage Calls**  
   Update `data.js` to use IndexedDB functions

3. **Test Offline Mode**  
   Verify app works without internet

4. **Monitor Sync Queue**  
   Add UI indicator for pending operations

5. **Implement Periodic Cleanup**  
   Remove old completed items

## Support

For issues or questions:
- Check browser console for errors
- Run `getDatabaseStats()` to inspect state
- Export database for debugging: `exportDatabase()`
- Review sync queue: `getPendingSyncOperations()`

---

**Built with ❤️ for Prodify**
