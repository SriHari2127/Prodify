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

