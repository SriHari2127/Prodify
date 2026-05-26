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

... (full API content preserved in original file)

