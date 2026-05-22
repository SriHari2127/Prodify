# Background Synchronization System - Integration Guide

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Module Reference](#module-reference)
4. [Installation & Setup](#installation--setup)
5. [Integration Steps](#integration-steps)
6. [API Documentation](#api-documentation)
7. [Usage Examples](#usage-examples)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)
10. [Performance Optimization](#performance-optimization)

---

## Overview

The **Background Synchronization System** ensures that all offline changes made in your PWA are automatically synchronized to Firebase Firestore when the device reconnects to the internet. This system provides:

### ✨ Key Features

- **Automatic Background Sync** - Syncs data when app is minimized or in background
- **Network-Aware** - Monitors connection status and quality
- **Retry Logic** - Exponential backoff retry mechanism (5s, 30s, 5min, 30min)
- **Conflict Resolution** - Timestamp-based conflict resolution with merge strategies
- **Batch Processing** - Processes up to 20 operations per batch for efficiency
- **Service Worker Integration** - Native PWA background sync API support
- **Capacitor Support** - Android native background tasks
- **Real-time UI Updates** - Live sync status indicators
- **Offline-First** - All operations work offline and sync when online

### 🎯 Use Cases

- Task creation/updates while offline
- Focus session tracking without internet
- Study schedule modifications in low connectivity
- Analytics data collection in background
- Notes and habit tracking offline

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     USER INTERFACE                          │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐       │
│  │ Sync Status │  │   Tasks     │  │   Habits     │       │
│  │   Indicator │  │   Screen    │  │    Screen    │       │
│  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘       │
│         │                │                 │                │
└─────────┼────────────────┼─────────────────┼────────────────┘
          │                │                 │
          ▼                ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                  IndexedDB Layer (ProdifyDB)                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Tables: tasks, habits, notes, syncQueue, etc.       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKGROUND SYNC SYSTEM                         │
│                                                             │
│  ┌──────────────────┐    ┌──────────────────┐            │
│  │ Network Monitor  │───▶│  Sync Manager    │            │
│  │ - Online/Offline │    │  - Orchestrator  │            │
│  │ - Quality Check  │    │  - Auto-sync     │            │
│  └──────────────────┘    └────────┬─────────┘            │
│                                    │                       │
│  ┌──────────────────┐    ┌────────▼─────────┐            │
│  │ Background Task  │    │ Sync Queue       │            │
│  │ Runner           │───▶│ Processor        │            │
│  │ - Capacitor      │    │ - Batch process  │            │
│  │ - Service Worker │    │ - Retry logic    │            │
│  └──────────────────┘    └────────┬─────────┘            │
│                                    │                       │
│  ┌──────────────────┐    ┌────────▼─────────┐            │
│  │ Service Worker   │    │ Firestore Sync   │            │
│  │ Registration     │    │ Adapter          │            │
│  │ - Background API │    │ - CRUD ops       │            │
│  └──────────────────┘    │ - Conflict res   │            │
│                           └────────┬─────────┘            │
└──────────────────────────────────┼──────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │   Firebase Firestore     │
                    │   (Cloud Database)       │
                    └──────────────────────────┘
```

### Module Flow

1. **User Action** → Data saved to IndexedDB + added to sync queue
2. **Network Monitor** → Detects connectivity changes
3. **Sync Manager** → Orchestrates sync triggers (reconnect, launch, auto, manual)
4. **Sync Queue Processor** → Processes operations in batches of 20
5. **Firestore Sync Adapter** → Executes Firebase operations with retry
6. **Background Task Runner** → Handles app state changes (Capacitor/Web)
7. **Service Worker** → Native background sync API (PWA)
8. **Sync Status UI** → Displays real-time sync status to user

---

## Module Reference

### 1. Network Monitor (`networkMonitor.js`)

**Purpose:** Monitors network connectivity and quality

**Key Features:**
- Online/offline event detection
- Connection quality testing
- Reconnection callbacks
- 30-second connectivity polling

**API:**
```javascript
networkMonitor.isOnline()          // Check if online
networkMonitor.isGoodForSync()     // Check if connection is good
networkMonitor.onReconnect(callback)  // Listen for reconnection
networkMonitor.startMonitoring()   // Start monitoring
```

---

### 2. Firestore Sync Adapter (`firestoreSyncAdapter.js`)

**Purpose:** Handles Firebase Firestore CRUD operations

**Key Features:**
- Create, update, delete operations
- Bulk operations (max 500 docs)
- Conflict resolution (timestamp-based)
- Exponential backoff retry
- Sync logging (circular buffer, 100 entries)

**API:**
```javascript
firestoreSyncAdapter.createDocument(collection, data)
firestoreSyncAdapter.updateDocument(collection, id, data)
firestoreSyncAdapter.deleteDocument(collection, id)
firestoreSyncAdapter.bulkCreateDocuments(collection, docs)
firestoreSyncAdapter.syncWithRetry(operation)
firestoreSyncAdapter.getSyncLog()
```

---

### 3. Sync Queue Processor (`syncQueueProcessor.js`)

**Purpose:** Processes sync queue in batches

**Key Features:**
- Batch processing (20 operations)
- Priority queue management
- Retry scheduling (exponential backoff)
- Failed operation cleanup
- Statistics tracking

**API:**
```javascript
syncQueueProcessor.processQueue()           // Process all pending
syncQueueProcessor.getStats()               // Get queue stats
syncQueueProcessor.retryFailedOperations()  // Retry failed ops
syncQueueProcessor.clearSyncedOperations()  // Cleanup synced ops
```

---

### 4. Sync Manager (`syncManager.js`)

**Purpose:** Central orchestrator for all sync activities

**Key Features:**
- Auto-sync (30-second interval)
- Multiple triggers (RECONNECT, LAUNCH, AUTO, MANUAL, FOCUS_COMPLETE)
- Status management (IDLE, SYNCING, SYNCED, FAILED, OFFLINE)
- Observer pattern for status changes
- Table-specific sync

**API:**
```javascript
syncManager.triggerSync({ reason: 'MANUAL' })
syncManager.syncAfterFocusSession(sessionData)
syncManager.syncTable('tasks')
syncManager.onStatusChange(callback)
syncManager.getStatus()
```

**Sync Triggers:**
- `RECONNECT` - Network reconnection detected
- `LAUNCH` - App launched/opened
- `AUTO` - Automatic 30-second interval
- `MANUAL` - User triggered
- `FOCUS_COMPLETE` - Focus session completed
- `FORCE_FULL` - Force full sync

---

### 5. Background Task Runner (`backgroundTaskRunner.js`)

**Purpose:** Handle background sync when app is minimized

**Key Features:**
- Capacitor BackgroundTask integration (Android)
- App state monitoring (background/foreground)
- Web fallbacks (visibility API)
- Focus session completion handler
- Device resume handler

**API:**
```javascript
backgroundTaskRunner.initialize()
backgroundTaskRunner.registerBackgroundTask()
backgroundTaskRunner.scheduleBackgroundSync()
backgroundTaskRunner.syncOnResume()
```

**Capacitor Detection:**
- Checks if running in Capacitor wrapper
- Falls back to web APIs if not available
- 15-minute periodic tasks on Android

---

### 6. Service Worker (`service-worker.js`)

**Purpose:** Native PWA background sync API

**Key Features:**
- Cache management (cache-first, network-first)
- Background Sync API
- Periodic Sync API (Chrome 80+)
- Push notifications (future)
- Offline request handling

**Events:**
- `install` - Service worker installation
- `activate` - Service worker activation
- `fetch` - Network requests interception
- `sync` - Background sync event
- `periodicsync` - Periodic background sync

---

### 7. Service Worker Registration (`serviceWorkerRegistration.js`)

**Purpose:** Manage service worker lifecycle

**Key Features:**
- Auto-registration on page load
- Update detection
- Background sync registration
- Periodic sync registration
- Message passing to/from service worker

**API:**
```javascript
serviceWorkerManager.register()
serviceWorkerManager.registerBackgroundSync()
serviceWorkerManager.registerPeriodicSync(interval)
serviceWorkerManager.getInfo()
serviceWorkerManager.clearCache()
```

---

### 8. Sync Status UI (`syncStatusUI.js`)

**Purpose:** Display sync status in UI

**Key Features:**
- Real-time status indicator
- Detailed sync progress
- Visual feedback (icons, colors, animations)
- Manual retry button
- Queue statistics display

**API:**
```javascript
showSyncIndicator('header')         // Show indicator in header
showSyncDetails()                   // Toggle details panel
getSyncStatus()                     // Get current status

syncStatusUI.updateStatus('SYNCING')
syncStatusUI.updateProgress({ total: 10, completed: 5 })
syncStatusUI.onStatusChange(callback)
```

---

## Installation & Setup

### Step 1: Add Script Tags to `index.html`

Add these script tags **in the correct order** (after IndexedDB scripts):

```html
<!-- IndexedDB layer (must load first) -->
<script src="https://unpkg.com/dexie@4.0.1/dist/dexie.min.js"></script>
<script src="js/core/indexedDB.js"></script>
<script src="js/core/indexedDB-adapter.js"></script>

<!-- Background Sync System -->
<script src="js/sync/networkMonitor.js"></script>
<script src="js/sync/firestoreSyncAdapter.js"></script>
<script src="js/sync/syncQueueProcessor.js"></script>
<script src="js/sync/syncManager.js"></script>
<script src="js/sync/backgroundTaskRunner.js"></script>
<script src="js/sync/serviceWorkerRegistration.js"></script>
<script src="js/sync/syncStatusUI.js"></script>
```

### Step 2: Register Service Worker

The service worker is **automatically registered** by `serviceWorkerRegistration.js`. No manual action needed!

However, ensure your `service-worker.js` is at the root of your `www/` folder:
```
www/
├── service-worker.js  ✅ Must be here
├── index.html
└── js/
```

### Step 3: Configure Capacitor (Android)

If using Capacitor, ensure BackgroundTask plugin is installed:

```bash
npm install @capacitor/background-task
npx cap sync
```

Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
```

### Step 4: Verify Installation

Open browser console and check:

```javascript
console.log('Network Monitor:', window.networkMonitor);
console.log('Sync Manager:', window.syncManager);
console.log('Service Worker:', window.serviceWorkerManager);
console.log('Sync UI:', window.syncStatusUI);
```

All should log objects (not `undefined`).

---

## Integration Steps

### Phase 1: Add Sync Indicator to UI

Add a sync status indicator to your header/navbar:

```javascript
// In your app initialization code
document.addEventListener('DOMContentLoaded', () => {
    // Show sync indicator in header
    const indicator = showSyncIndicator('header');
    
    // Or specify a specific container
    // const indicator = showSyncIndicator('#sync-container');
});
```

**HTML Example:**
```html
<header>
    <h1>Prodify</h1>
    <div id="sync-container"></div>
</header>

<script>
    // Show indicator
    showSyncIndicator('#sync-container');
</script>
```

---

### Phase 2: Update Data Operations

Replace direct Firebase calls with IndexedDB operations:

#### ❌ Old Way (Direct Firebase)
```javascript
// Old: Direct write to Firestore
await db.collection('tasks').add({
    title: 'New Task',
    completed: false,
    userId: currentUserId
});
```

#### ✅ New Way (IndexedDB + Auto Sync)
```javascript
// New: Write to IndexedDB, auto-sync to Firestore
await window.db.createTask({
    title: 'New Task',
    completed: false,
    userId: currentUserId
});

// Sync happens automatically!
```

#### Example: Task Management

```javascript
// Create task
async function addTask(taskData) {
    try {
        const task = await window.db.createTask(taskData);
        console.log('✅ Task created:', task);
        
        // Sync will happen automatically
        return task;
    } catch (error) {
        console.error('❌ Failed to create task:', error);
        throw error;
    }
}

// Update task
async function updateTask(taskId, updates) {
    try {
        await window.db.updateTask(taskId, updates);
        console.log('✅ Task updated');
    } catch (error) {
        console.error('❌ Failed to update task:', error);
    }
}

// Delete task
async function deleteTask(taskId) {
    try {
        await window.db.deleteTask(taskId);
        console.log('✅ Task deleted');
    } catch (error) {
        console.error('❌ Failed to delete task:', error);
    }
}
```

---

### Phase 3: Listen for Sync Events

React to sync status changes in your UI:

```javascript
// Listen for sync status changes
window.syncManager.onStatusChange((status) => {
    console.log('Sync status:', status);
    
    switch (status) {
        case 'SYNCING':
            // Show loading spinner
            showLoadingSpinner();
            break;
            
        case 'SYNCED':
            // Hide spinner, show success
            hideLoadingSpinner();
            showSuccessMessage('All changes synced!');
            break;
            
        case 'FAILED':
            // Show error
            showErrorMessage('Sync failed. Will retry...');
            break;
            
        case 'OFFLINE':
            // Show offline banner
            showOfflineBanner();
            break;
    }
});

// Listen for background sync completion
window.addEventListener('backgroundSyncComplete', (event) => {
    const { success, failed } = event.detail;
    console.log(`Background sync: ${success} success, ${failed} failed`);
    
    // Refresh UI if needed
    if (success > 0) {
        refreshTaskList();
    }
});
```

---

### Phase 4: Handle Focus Sessions

Trigger sync after focus sessions complete:

```javascript
// In your focus timer completion code
async function onFocusSessionComplete(sessionData) {
    try {
        // Save focus session to IndexedDB
        await window.db.createFocusSession(sessionData);
        
        // Trigger immediate sync
        await window.syncManager.syncAfterFocusSession(sessionData);
        
        console.log('✅ Focus session saved and synced');
    } catch (error) {
        console.error('❌ Failed to save focus session:', error);
    }
}
```

---

### Phase 5: Manual Sync Trigger

Add a manual sync button for users:

```html
<button onclick="triggerManualSync()">
    🔄 Sync Now
</button>

<script>
async function triggerManualSync() {
    try {
        await window.syncManager.triggerSync({ reason: 'MANUAL' });
        alert('Sync started!');
    } catch (error) {
        alert('Sync failed: ' + error.message);
    }
}
</script>
```

---

## API Documentation

### Global Objects

After scripts load, these objects are available globally:

```javascript
window.networkMonitor       // Network monitoring
window.firestoreSyncAdapter // Firestore operations
window.syncQueueProcessor   // Queue processing
window.syncManager          // Sync orchestration
window.backgroundTaskRunner // Background tasks
window.serviceWorkerManager // Service worker management
window.syncStatusUI         // UI components

// Convenience functions
window.showSyncIndicator(selector)
window.showSyncDetails()
window.getSyncStatus()
window.triggerBackgroundSync()
```

---

### Sync Manager API

#### `triggerSync(options)`

Manually trigger synchronization.

**Parameters:**
- `options.reason` (string) - Sync trigger reason
  - `'MANUAL'` - User-triggered
  - `'AUTO'` - Automatic interval
  - `'RECONNECT'` - Network reconnection
  - `'LAUNCH'` - App launch
  - `'FOCUS_COMPLETE'` - Focus session complete
  - `'FORCE_FULL'` - Force full sync

**Returns:** `Promise<Object>` - Sync result

**Example:**
```javascript
await window.syncManager.triggerSync({ reason: 'MANUAL' });
```

---

#### `syncAfterFocusSession(sessionData)`

Sync immediately after focus session completion.

**Parameters:**
- `sessionData` (Object) - Focus session data

**Example:**
```javascript
await window.syncManager.syncAfterFocusSession({
    duration: 1500,
    subject: 'Math',
    completed: true
});
```

---

#### `syncTable(tableName)`

Sync a specific table only.

**Parameters:**
- `tableName` (string) - Table name (tasks, habits, notes, etc.)

**Example:**
```javascript
await window.syncManager.syncTable('tasks');
```

---

#### `onStatusChange(callback)`

Listen for sync status changes.

**Parameters:**
- `callback` (Function) - Callback receiving status string

**Example:**
```javascript
window.syncManager.onStatusChange((status) => {
    console.log('New status:', status);
});
```

---

#### `getStatus()`

Get current sync status.

**Returns:** `Object`
```javascript
{
    status: 'SYNCED',  // Current status
    lastSync: Date,    // Last sync timestamp
    isSyncing: false   // Is currently syncing
}
```

---

### Network Monitor API

#### `isOnline()`

Check if device is online.

**Returns:** `boolean`

```javascript
if (networkMonitor.isOnline()) {
    console.log('Online!');
}
```

---

#### `isGoodForSync()`

Check if connection quality is good enough for sync.

**Returns:** `boolean`

```javascript
if (networkMonitor.isGoodForSync()) {
    await syncManager.triggerSync({ reason: 'MANUAL' });
}
```

---

#### `onReconnect(callback)`

Called when device reconnects to internet.

**Parameters:**
- `callback` (Function) - Callback function

```javascript
networkMonitor.onReconnect(() => {
    console.log('🌐 Reconnected!');
    // Sync will trigger automatically
});
```

---

### Sync Status UI API

#### `showSyncIndicator(container)`

Render sync status indicator.

**Parameters:**
- `container` (string|HTMLElement) - Container selector or element

**Returns:** `HTMLElement`

```javascript
// In header
showSyncIndicator('header');

// In specific div
showSyncIndicator('#my-sync-container');

// Using element reference
const container = document.getElementById('sync-area');
showSyncIndicator(container);
```

---

#### `showSyncDetails()`

Toggle detailed sync status panel.

```javascript
// Show/hide details
showSyncDetails();
```

---

#### `getSyncStatus()`

Get current sync status object.

**Returns:** `Object`
```javascript
{
    status: 'SYNCED',
    progress: {
        total: 10,
        completed: 10,
        failed: 0
    },
    lastSync: Date
}
```

---

## Usage Examples

### Example 1: Task Creation with Offline Support

```javascript
async function createTask(taskData) {
    try {
        // Save to IndexedDB (works offline)
        const task = await window.db.createTask({
            title: taskData.title,
            description: taskData.description,
            dueDate: taskData.dueDate,
            completed: false,
            userId: currentUserId,
            createdAt: new Date().toISOString()
        });
        
        console.log('✅ Task created locally:', task.id);
        
        // Check if online
        if (networkMonitor.isOnline()) {
            // Trigger immediate sync
            await syncManager.triggerSync({ reason: 'MANUAL' });
        } else {
            // Show offline message
            showNotification('Task saved offline. Will sync when online.');
        }
        
        return task;
        
    } catch (error) {
        console.error('❌ Failed to create task:', error);
        showNotification('Failed to create task: ' + error.message);
        throw error;
    }
}
```

---

### Example 2: React to Network Changes

```javascript
// Initialize network monitoring
function setupNetworkHandlers() {
    // Online event
    networkMonitor.onReconnect(() => {
        console.log('🌐 Back online!');
        showNotification('Back online! Syncing...', 'success');
        
        // Sync will happen automatically, but you can trigger manual
        syncManager.triggerSync({ reason: 'RECONNECT' });
    });
    
    // Offline event
    networkMonitor.onDisconnect(() => {
        console.log('📡 Offline');
        showNotification('You are offline. Changes will sync later.', 'warning');
    });
}
```

---

### Example 3: Focus Session with Auto-Sync

```javascript
async function completeFocusSession(sessionData) {
    try {
        // Save session to IndexedDB
        const session = await window.db.createFocusSession({
            subjectId: sessionData.subjectId,
            duration: sessionData.duration,
            completed: sessionData.completed,
            xpEarned: sessionData.xpEarned,
            userId: currentUserId,
            completedAt: new Date().toISOString()
        });
        
        console.log('✅ Focus session saved:', session.id);
        
        // Dispatch custom event (backgroundTaskRunner listens for this)
        window.dispatchEvent(new CustomEvent('focusSessionComplete', {
            detail: session
        }));
        
        // This triggers immediate sync via syncManager.syncAfterFocusSession()
        
        return session;
        
    } catch (error) {
        console.error('❌ Failed to save focus session:', error);
        throw error;
    }
}
```

---

### Example 4: Display Sync Status in Settings

```javascript
function renderSyncSettings() {
    const container = document.getElementById('sync-settings');
    
    // Get current status
    const status = getSyncStatus();
    const info = serviceWorkerManager.getInfo();
    
    container.innerHTML = `
        <div class="sync-settings-panel">
            <h3>Sync Status</h3>
            
            <div class="status-row">
                <span>Connection:</span>
                <span>${networkMonitor.isOnline() ? '🟢 Online' : '🔴 Offline'}</span>
            </div>
            
            <div class="status-row">
                <span>Sync Status:</span>
                <span>${status.status}</span>
            </div>
            
            <div class="status-row">
                <span>Last Sync:</span>
                <span>${status.lastSync ? formatTime(status.lastSync) : 'Never'}</span>
            </div>
            
            <div class="status-row">
                <span>Pending Operations:</span>
                <span>${status.progress.total - status.progress.completed}</span>
            </div>
            
            <div class="status-row">
                <span>Service Worker:</span>
                <span>${info.registered ? '✅ Active' : '❌ Not Active'}</span>
            </div>
            
            <div class="status-row">
                <span>Background Sync:</span>
                <span>${info.syncSupported ? '✅ Supported' : '❌ Not Supported'}</span>
            </div>
            
            <button onclick="triggerManualSync()">🔄 Sync Now</button>
            <button onclick="showSyncDetails()">📊 View Details</button>
        </div>
    `;
}

async function triggerManualSync() {
    try {
        await syncManager.triggerSync({ reason: 'MANUAL' });
        alert('Sync completed!');
        renderSyncSettings(); // Refresh display
    } catch (error) {
        alert('Sync failed: ' + error.message);
    }
}
```

---

### Example 5: Bulk Operations

```javascript
async function importTasks(tasksArray) {
    try {
        console.log(`Importing ${tasksArray.length} tasks...`);
        
        // Save all tasks to IndexedDB
        const promises = tasksArray.map(taskData => 
            window.db.createTask(taskData)
        );
        
        const tasks = await Promise.all(promises);
        console.log(`✅ ${tasks.length} tasks imported`);
        
        // Trigger sync (will batch automatically)
        await syncManager.triggerSync({ reason: 'MANUAL' });
        
        return tasks;
        
    } catch (error) {
        console.error('❌ Import failed:', error);
        throw error;
    }
}
```

---

## Best Practices

### 1. ✅ Always Use IndexedDB First

**DO:**
```javascript
// ✅ Save to IndexedDB, let sync handle Firestore
await window.db.createTask(taskData);
```

**DON'T:**
```javascript
// ❌ Direct Firestore write (bypasses offline support)
await firebase.firestore().collection('tasks').add(taskData);
```

---

### 2. ✅ Trust the Auto-Sync

The system automatically syncs every 30 seconds and on:
- Network reconnection
- App foreground
- Focus session completion
- Page visibility change

**You don't need to manually trigger sync unless:**
- User explicitly requests it
- You need immediate sync (e.g., critical data)

---

### 3. ✅ Handle Offline Gracefully

```javascript
async function saveData(data) {
    try {
        await window.db.createTask(data);
        
        if (networkMonitor.isOnline()) {
            showNotification('Saved and synced!');
        } else {
            showNotification('Saved locally. Will sync when online.');
        }
        
    } catch (error) {
        showNotification('Failed to save: ' + error.message);
    }
}
```

---

### 4. ✅ Use Sync Status for UX

```javascript
syncManager.onStatusChange((status) => {
    switch (status) {
        case 'SYNCING':
            // Show loading indicator
            document.getElementById('sync-loader').style.display = 'block';
            break;
            
        case 'SYNCED':
            // Hide loader, show checkmark briefly
            document.getElementById('sync-loader').style.display = 'none';
            showTemporaryCheckmark();
            break;
            
        case 'OFFLINE':
            // Show offline banner
            document.getElementById('offline-banner').style.display = 'block';
            break;
    }
});
```

---

### 5. ✅ Test Offline Scenarios

Use Chrome DevTools to simulate offline:

1. Open DevTools (F12)
2. Go to Network tab
3. Select "Offline" from throttling dropdown
4. Test your app functionality

```javascript
// Test offline behavior
console.log('Online:', networkMonitor.isOnline());

// Create task while offline
await window.db.createTask({ title: 'Test Offline Task' });

// Check sync queue
const stats = await window.db.getSyncQueueStats();
console.log('Pending syncs:', stats.pending);

// Go back online in DevTools
// Watch auto-sync in console
```

---

### 6. ✅ Monitor Sync Queue

Keep an eye on pending operations:

```javascript
// Get sync queue statistics
async function checkSyncHealth() {
    const stats = await window.db.getSyncQueueStats();
    
    console.log('Sync Queue Health:');
    console.log('- Pending:', stats.pending);
    console.log('- Synced:', stats.synced);
    console.log('- Failed:', stats.failed);
    
    // Alert if too many failed operations
    if (stats.failed > 10) {
        console.warn('⚠️ High number of failed syncs!');
        await syncManager.triggerSync({ reason: 'FORCE_FULL' });
    }
}

// Run health check periodically
setInterval(checkSyncHealth, 60000); // Every minute
```

---

### 7. ✅ Clean Up Old Synced Operations

```javascript
// Clean up synced operations older than 7 days
async function cleanupOldSyncs() {
    try {
        const deleted = await syncQueueProcessor.clearSyncedOperations(7);
        console.log(`🗑️ Cleaned up ${deleted} old sync operations`);
    } catch (error) {
        console.error('❌ Cleanup failed:', error);
    }
}

// Run cleanup weekly
setInterval(cleanupOldSyncs, 7 * 24 * 60 * 60 * 1000);
```

---

### 8. ✅ Use Sync Triggers Appropriately

```javascript
// Good use cases for manual sync
await syncManager.triggerSync({ reason: 'MANUAL' });        // User clicked sync button
await syncManager.triggerSync({ reason: 'LAUNCH' });        // App just launched
await syncManager.triggerSync({ reason: 'FOCUS_COMPLETE' }); // Focus session ended
await syncManager.triggerSync({ reason: 'FORCE_FULL' });    // Admin force sync

// Auto-sync handles most cases automatically!
```

---

## Troubleshooting

### Issue: Sync Not Happening

**Symptoms:**
- Data saved locally but not syncing to Firestore
- Sync status shows "IDLE" but there are pending operations

**Solutions:**

1. **Check Network Connectivity**
   ```javascript
   console.log('Online:', networkMonitor.isOnline());
   console.log('Good for sync:', networkMonitor.isGoodForSync());
   ```

2. **Check Sync Queue**
   ```javascript
   const stats = await window.db.getSyncQueueStats();
   console.log('Pending:', stats.pending);
   console.log('Failed:', stats.failed);
   ```

3. **Check Firebase Authentication**
   ```javascript
   console.log('Current User:', firebase.auth().currentUser);
   ```

4. **Manually Trigger Sync**
   ```javascript
   await syncManager.triggerSync({ reason: 'MANUAL' });
   ```

5. **Check Console for Errors**
   - Open DevTools Console
   - Look for errors starting with ❌

---

### Issue: Service Worker Not Registering

**Symptoms:**
- `serviceWorkerManager.getInfo()` shows `registered: false`
- Background sync not working

**Solutions:**

1. **Check HTTPS**
   - Service Workers require HTTPS (or localhost)
   - Check if your app is served over HTTPS

2. **Check File Path**
   ```javascript
   // Service worker must be at root of scope
   // ✅ Correct: www/service-worker.js
   // ❌ Wrong: www/js/service-worker.js
   ```

3. **Check Browser Support**
   ```javascript
   console.log('Service Worker supported:', 'serviceWorker' in navigator);
   ```

4. **Manually Register**
   ```javascript
   await serviceWorkerManager.register();
   ```

5. **Clear Cache and Hard Reload**
   - Chrome: Ctrl+Shift+R
   - Firefox: Ctrl+F5

---

### Issue: Data Not Appearing After Sync

**Symptoms:**
- Sync completes successfully
- Data in IndexedDB but not in Firestore (or vice versa)

**Solutions:**

1. **Check Firestore Rules**
   ```javascript
   // Ensure your Firestore rules allow writes
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

2. **Check User ID**
   ```javascript
   console.log('Current User ID:', currentUserId);
   // Ensure currentUserId is defined
   ```

3. **Check Collection Names**
   ```javascript
   // Verify collection names match
   console.log('Collections:', [
       'tasks', 'habits', 'subjects', 'notes',
       'focusSessions', 'studySessions', 'notifications', 'analytics'
   ]);
   ```

4. **View Sync Log**
   ```javascript
   const log = firestoreSyncAdapter.getSyncLog();
   console.table(log);
   ```

---

### Issue: High Number of Failed Syncs

**Symptoms:**
- Many operations in "failed" state
- Sync keeps retrying

**Solutions:**

1. **Check Network Quality**
   ```javascript
   if (!networkMonitor.isGoodForSync()) {
       console.log('⚠️ Network quality too low for sync');
   }
   ```

2. **Retry Failed Operations**
   ```javascript
   await syncQueueProcessor.retryFailedOperations();
   ```

3. **Clear Permanently Failed**
   ```javascript
   // Clear operations that exceeded max retries
   await syncQueueProcessor.clearPermanentlyFailed();
   ```

4. **Force Full Sync**
   ```javascript
   await syncManager.triggerSync({ reason: 'FORCE_FULL' });
   ```

---

### Issue: Capacitor Background Tasks Not Working

**Symptoms:**
- Background sync not happening on Android
- App closes and sync stops

**Solutions:**

1. **Check Capacitor Installation**
   ```bash
   npm list @capacitor/background-task
   ```

2. **Check AndroidManifest.xml**
   ```xml
   <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
   <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
   ```

3. **Check Capacitor Detection**
   ```javascript
   console.log('Capacitor available:', window.Capacitor);
   console.log('Platform:', window.Capacitor?.getPlatform());
   ```

4. **Rebuild Android App**
   ```bash
   npx cap sync
   npx cap build android
   ```

---

### Issue: Sync Status UI Not Showing

**Symptoms:**
- Sync indicator not visible
- `showSyncIndicator()` doesn't render

**Solutions:**

1. **Check Container Exists**
   ```javascript
   const container = document.querySelector('header');
   console.log('Container found:', !!container);
   ```

2. **Check Script Load Order**
   ```html
   <!-- Ensure syncStatusUI.js loads after syncManager.js -->
   <script src="js/sync/syncManager.js"></script>
   <script src="js/sync/syncStatusUI.js"></script>
   ```

3. **Manually Render**
   ```javascript
   window.syncStatusUI.renderSyncIndicator('header');
   ```

4. **Check CSS**
   ```javascript
   // Styles are injected automatically
   console.log('Styles injected:', !!document.getElementById('sync-status-styles'));
   ```

---

## Performance Optimization

### 1. Batch Operations

Instead of syncing after each operation:
```javascript
// ❌ Inefficient: Triggers 100 syncs
for (let i = 0; i < 100; i++) {
    await window.db.createTask(tasks[i]);
    await syncManager.triggerSync({ reason: 'MANUAL' });
}

// ✅ Efficient: Creates all, then syncs once
for (let i = 0; i < 100; i++) {
    await window.db.createTask(tasks[i]);
}
await syncManager.triggerSync({ reason: 'MANUAL' });
// System batches 20 operations per sync automatically
```

---

### 2. Adjust Auto-Sync Interval

Default is 30 seconds. Adjust if needed:

```javascript
// In syncManager.js, line ~250
this.autoSyncInterval = 60000; // 60 seconds instead of 30
```

---

### 3. Prioritize Critical Data

Operations have priority in sync queue:

```javascript
// High priority operations sync first
await window.db.addToSyncQueue({
    collection: 'focusSessions',
    operation: 'CREATE',
    payload: sessionData,
    priority: 1 // High priority
});
```

---

### 4. Lazy Load Sync UI

Only render sync UI when needed:

```javascript
// Lazy load sync indicator
let syncIndicatorLoaded = false;

function showSyncIndicatorLazy() {
    if (!syncIndicatorLoaded) {
        showSyncIndicator('header');
        syncIndicatorLoaded = true;
    }
}

// Load on user interaction
document.addEventListener('click', showSyncIndicatorLazy, { once: true });
```

---

### 5. Reduce Sync Logging

In production, reduce logging verbosity:

```javascript
// In firestoreSyncAdapter.js
this.maxLogEntries = 50; // Reduce from 100
```

---

### 6. Monitor Network Efficiency

```javascript
// Track sync efficiency
let syncStartTime;

syncManager.onStatusChange((status) => {
    if (status === 'SYNCING') {
        syncStartTime = Date.now();
    } else if (status === 'SYNCED') {
        const duration = Date.now() - syncStartTime;
        console.log(`⏱️ Sync completed in ${duration}ms`);
        
        // Log to analytics
        logSyncDuration(duration);
    }
});
```

---

## Summary

### What You've Learned

✅ **Architecture** - 8 modules working together for offline-first sync  
✅ **Installation** - Script tags, service worker, Capacitor setup  
✅ **Integration** - Replace Firebase calls with IndexedDB operations  
✅ **API Usage** - Trigger syncs, monitor status, display UI  
✅ **Best Practices** - Offline handling, testing, cleanup  
✅ **Troubleshooting** - Common issues and solutions  
✅ **Optimization** - Performance tips and batching  

### Key Takeaways

1. **Offline-First**: All data goes to IndexedDB first
2. **Auto-Sync**: System handles sync automatically (every 30s)
3. **Network-Aware**: Only syncs when connection is good
4. **Retry Logic**: Exponential backoff (5s → 30s → 5m → 30m)
5. **Background Support**: Works even when app is minimized
6. **UI Feedback**: Real-time sync status indicators
7. **Conflict Resolution**: Timestamp-based merging
8. **Batch Processing**: 20 operations per batch

### Next Steps

1. ✅ **Add sync indicator** to your app's header
2. ✅ **Replace localStorage** calls with IndexedDB
3. ✅ **Test offline** scenarios with DevTools
4. ✅ **Monitor sync queue** periodically
5. ✅ **Add manual sync button** in settings
6. ✅ **Listen for sync events** and update UI accordingly

---

## Additional Resources

- **IndexedDB Integration Guide**: `INDEXEDDB_INTEGRATION_GUIDE.md`
- **IndexedDB Quick Reference**: `INDEXEDDB_QUICK_REFERENCE.md`
- **IndexedDB Roadmap**: `INDEXEDDB_ROADMAP.md`
- **Service Worker API**: [MDN Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- **Background Sync API**: [MDN Background Sync](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)
- **Capacitor Background Task**: [Capacitor Docs](https://capacitorjs.com/docs/apis/background-task)

---

## Support

Having issues? Check:

1. **Console errors** - Look for ❌ symbols
2. **Network tab** - Check if requests are failing
3. **Application tab** - View IndexedDB and Service Worker status
4. **Sync queue stats** - `await db.getSyncQueueStats()`

---

**🎉 Congratulations! Your background synchronization system is now ready to use.**

**All offline changes will automatically sync to Firebase Firestore when the device comes online.**

