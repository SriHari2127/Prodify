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

... (full quick reference content retained)

