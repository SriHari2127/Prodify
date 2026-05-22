# Cross-Device Synchronization System Documentation

## 📖 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Module Reference](#module-reference)
4. [Integration Guide](#integration-guide)
5. [Configuration](#configuration)
6. [API Reference](#api-reference)
7. [Usage Examples](#usage-examples)
8. [Troubleshooting](#troubleshooting)
9. [Performance Optimization](#performance-optimization)

---

## System Overview

The Cross-Device Synchronization System enables seamless data synchronization and optimal user experience across Android phones, desktop browsers, and tablets. The system provides:

### Key Features

- **Device Identification**: Unique device IDs with persistent tracking
- **Real-time Sync**: Instant updates across all connected devices via Firestore listeners
- **Conflict Resolution**: Intelligent handling of simultaneous edits with multiple strategies
- **Session Synchronization**: Active session state sharing (focus sessions, study plans)
- **Offline Support**: Queue-based sync with automatic retry
- **Adaptive UI**: Device-specific optimizations and responsive layouts
- **Analytics**: Comprehensive tracking of device usage and sync performance
- **Performance Optimization**: Automatic adjustments based on device capabilities

### Supported Platforms

- ✅ Android (native app via Capacitor)
- ✅ Desktop browsers (Chrome, Firefox, Safari, Edge)
- ✅ Tablets (iOS and Android)

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
│  (Tasks, Habits, Focus Sessions, Study Plans, Analytics)    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              Cross-Device Sync System                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Device     │  │  Realtime    │  │   Session    │     │
│  │   Manager    │→ │   Update     │→ │   State      │     │
│  │              │  │   Handler    │  │   Sync       │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Sync State  │  │  Conflict    │  │   Device     │     │
│  │  Manager     │→ │  Resolver    │→ │  Analytics   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────────────────────────────────────────┐      │
│  │      Device Optimization Engine                  │      │
│  └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Storage Layer                             │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  IndexedDB   │  │  Firestore   │  │ LocalStorage │     │
│  │  (Offline)   │  │  (Cloud)     │  │  (Cache)     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Action** → Application creates/updates data
2. **Local Storage** → Data saved to IndexedDB immediately
3. **Sync Queue** → Operation added to queue with metadata
4. **Sync Manager** → Processes queue in batches
5. **Conflict Detection** → Checks for conflicts with remote data
6. **Conflict Resolution** → Applies resolution strategy
7. **Firestore Update** → Pushes resolved data to cloud
8. **Real-time Broadcast** → Other devices receive updates instantly
9. **UI Update** → All devices reflect latest state

---

## Module Reference

### 1. DeviceManager (deviceManager.js)

**Purpose**: Handles device identification, registration, and metadata management.

**Key Functions**:
- `initialize()` - Setup device ID and register with Firestore
- `getCurrentDevice()` - Get current device metadata
- `getAllDevices()` - Get all registered devices
- `getActiveDevices()` - Get devices active within timeout
- `updateDeviceName(name)` - Rename current device
- `removeDevice(deviceId)` - Remove device from system
- `cleanupInactiveDevices()` - Remove devices inactive for 30+ days

**Device Metadata Structure**:
```javascript
{
  deviceId: "dev_abc123_xyz789",
  deviceType: "android", // or "tablet", "desktop"
  deviceName: "Android Phone (Chrome)",
  capabilities: {
    screenWidth: 1080,
    screenHeight: 2340,
    screenResolution: "1080x2340",
    pixelRatio: 2.5,
    isHighDPI: true,
    supportsTouch: true,
    orientation: "portrait",
    cores: 8,
    memory: 4
  },
  firstSeen: "2026-03-07T10:30:00.000Z",
  lastActive: "2026-03-07T15:45:23.000Z",
  isActive: true
}
```

**Events**:
- `deviceRegistered` - Fired when device is registered

---

### 2. SyncStateManager (syncStateManager.js)

**Purpose**: Manages synchronization state, queue processing, and data transfer optimization.

**Key Functions**:
- `initialize()` - Setup sync manager
- `addToQueue(collection, operation, data)` - Add operation to sync queue
- `processQueue()` - Process pending sync operations
- `performSync(force)` - Trigger full sync
- `triggerSync()` - Manual sync trigger
- `pauseSync()` / `resumeSync()` - Control sync
- `getSyncState()` - Get current sync state
- `getSyncStatistics()` - Get sync statistics

**Sync State Structure**:
```javascript
{
  status: "idle", // "idle", "syncing", "error", "offline"
  lastSync: "2026-03-07T15:45:00.000Z",
  lastSuccessfulSync: "2026-03-07T15:45:00.000Z",
  pendingOperations: 5,
  failedOperations: 0,
  isSyncing: false,
  error: null,
  progress: 0
}
```

**Features**:
- Delta sync (only changed fields)
- Batch processing (20 operations per batch)
- Automatic retry with exponential backoff
- Queue prioritization
- Network-aware sync

**Events**:
- `syncCompleted` - Fired when sync completes
- `syncStateChanged` - Fired when sync state changes
- `syncProgress` - Fired during sync with progress updates

---

### 3. ConflictResolver (conflictResolver.js)

**Purpose**: Handles data conflicts during cross-device synchronization.

**Key Functions**:
- `resolveConflict(local, remote, options)` - Main resolution function
- `detectConflict(local, remote)` - Check if conflict exists
- `resolveByTimestamp(local, remote)` - Timestamp-based resolution (last write wins)
- `resolveByMerge(local, remote)` - Intelligent merge of both versions
- `resolveByDevicePriority(local, remote)` - Priority-based resolution
- `getConflictHistory(limit)` - Get conflict logs
- `getConflictStatistics(days)` - Get conflict metrics

**Resolution Strategies**:

1. **Timestamp (Default)**: Last write wins based on `updatedAt` timestamp
2. **Merge**: Intelligently merge both versions
   - Arrays: Merge unique items, combine subtasks
   - Strings (notes): Concatenate with conflict marker
   - Numbers (counters): Take maximum value
   - Booleans (completed): OR operation (true wins)
3. **Device Priority**: Desktop > Tablet > Android (configurable)
4. **Manual**: Flag for user review

**Merge Examples**:
```javascript
// Subtasks merge
Local:  ["Task A", "Task B"]
Remote: ["Task B", "Task C"]
Result: ["Task A", "Task B", "Task C"]

// Notes merge
Local:  "Local changes made on phone"
Remote: "Remote changes made on desktop"
Result: "Remote changes made on desktop\n\n--- Local changes ---\nLocal changes made on phone"

// Streak/XP merge
Local:  streak: 15, xp: 250
Remote: streak: 12, xp: 280
Result: streak: 15, xp: 280 (max values)
```

**Events**:
- `conflictResolved` - Fired when conflict is resolved

---

### 4. SessionStateSync (sessionStateSync.js)

**Purpose**: Synchronizes active user sessions across devices in real-time.

**Key Functions**:
- `initialize()` - Setup session sync
- `startSession(type, data)` - Start a new session
- `updateSession(updates)` - Update current session
- `endSession()` - End current session
- `pauseSession()` / `resumeSession()` - Pause/resume session
- `getCurrentSession()` - Get current active session
- `getOtherActiveSessions()` - Get sessions from other devices
- `startFocusSession(data)` - Start focus session (convenience)
- `updateFocusProgress(elapsed, remaining)` - Update focus session

**Session Types**:
- `focus` - Focus/Pomodoro sessions
- `study` - Study sessions
- `habit` - Habit tracking
- `exam_prep` - Exam preparation
- `idle` - No active session

**Session Structure**:
```javascript
{
  sessionId: "session_1234567890_abc123",
  type: "focus",
  deviceId: "dev_abc123_xyz789",
  deviceType: "android",
  deviceName: "Android Phone (Chrome)",
  startTime: "2026-03-07T16:00:00.000Z",
  lastUpdate: "2026-03-07T16:15:30.000Z",
  isActive: true,
  isPaused: false,
  data: {
    subject: "Mathematics",
    duration: 25,
    mode: "pomodoro",
    elapsed: 930,
    remaining: 570,
    progress: 62
  }
}
```

**Use Cases**:
1. Start focus session on phone → Desktop shows "Focus mode active on Android Phone"
2. Pause study session on tablet → Phone reflects paused state
3. Complete habit on desktop → All devices update habit progress

**Events**:
- `sessionStarted` - Fired when session starts
- `sessionUpdated` - Fired when session updates
- `sessionEnded` - Fired when session ends
- `otherSessionsUpdated` - Fired when other devices' sessions change

---

### 5. RealtimeUpdateHandler (realtimeUpdateHandler.js)

**Purpose**: Manages Firestore real-time listeners for instant cross-device updates.

**Key Functions**:
- `initialize()` - Setup all listeners
- `setupTasksListener()` - Listen for task changes
- `setupHabitsListener()` - Listen for habit changes
- `setupSubjectsListener()` - Listen for subject changes
- `setupNotesListener()` - Listen for note changes
- `setupFocusSessionsListener()` - Listen for focus session changes
- `stopAllListeners()` - Stop all listeners
- `restartAllListeners()` - Restart all listeners

**Monitored Collections**:
- `tasks`
- `habits`
- `subjects`
- `notes`
- `focusSessions`
- `studySessions`
- `exams`
- `studyBlocks`

**Features**:
- Debounced updates (500ms) to prevent rapid consecutive updates
- Metadata-only change detection (skip updates for local writes)
- Automatic reconnection on error
- Offline persistence support

**Change Detection**:
```javascript
snapshot.docChanges().forEach(change => {
  if (change.type === 'added') {
    // New document created
  } else if (change.type === 'modified') {
    // Existing document updated
  } else if (change.type === 'removed') {
    // Document deleted
  }
});
```

**Events**:
- `tasksUpdated` - Fired when tasks change
- `habitsUpdated` - Fired when habits change
- `subjectsUpdated` - Fired when subjects change
- `notesUpdated` - Fired when notes change
- `focusSessionsUpdated` - Fired when focus sessions change

---

### 6. DeviceAnalytics (deviceAnalytics.js)

**Purpose**: Tracks device usage patterns, sync performance, and cross-device metrics.

**Key Functions**:
- `initialize()` - Start analytics tracking
- `getCurrentMetrics()` - Get real-time metrics
- `getDeviceUsageSummary(days)` - Get usage summary for period
- `getSyncMetrics(days)` - Get sync performance metrics
- `getDeviceComparison(days)` - Compare device usage
- `getNetworkStatistics(days)` - Get network stats
- `getChartData(days)` - Get data formatted for charts
- `saveAnalytics()` - Save current metrics to Firestore

**Tracked Metrics**:
- Session duration
- Actions performed (task updates, habit completions, etc.)
- Sync events (count, success/failure rate)
- Data transferred (bytes)
- Conflicts resolved
- Offline periods
- Network switches
- Battery level (if available)
- Memory usage (if available)

**Analytics Structure**:
```javascript
{
  deviceId: "dev_abc123_xyz789",
  deviceType: "android",
  date: "2026-03-07",
  sessionStart: "2026-03-07T10:00:00.000Z",
  sessionDuration: 3600, // seconds
  actionsPerformed: 45,
  syncEvents: 12,
  syncErrors: 0,
  dataTransferred: 524288, // bytes
  conflictsResolved: 2,
  offlinePeriods: 1,
  networkSwitches: 3
}
```

**Usage Reports**:
```javascript
// Device usage summary (7 days)
{
  totalSessions: 42,
  totalDuration: 151200, // seconds (42 hours)
  totalActions: 1250,
  averageSessionDuration: 3600,
  devicesUsed: 3,
  deviceBreakdown: {
    android: { sessions: 25, duration: 90000, actions: 800 },
    desktop: { sessions: 15, duration: 54000, actions: 400 },
    tablet: { sessions: 2, duration: 7200, actions: 50 }
  }
}
```

---

### 7. DeviceOptimizationEngine (deviceOptimizationEngine.js)

**Purpose**: Adaptive UI rendering and performance optimization based on device capabilities.

**Key Functions**:
- `initialize()` - Build device profile and apply optimizations
- `getDeviceProfile()` - Get comprehensive device profile
- `applyOptimizations()` - Apply optimizations based on profile
- `getCurrentOptimizations()` - Get list of active optimizations
- `setPerformanceMode(mode)` - Set manual performance mode
- `checkPerformance()` - Check current performance metrics

**Device Profile**:
```javascript
{
  deviceType: "android",
  screenSize: "medium",
  screenCategory: "mobile",
  performanceTier: "medium", // "low", "medium", "high"
  networkSpeed: "fast", // "slow", "medium", "fast"
  batteryStatus: {
    level: 75,
    charging: false,
    dischargingTime: 14400
  },
  memoryAvailable: 4,
  cpuCores: 8,
  isHighDPI: true,
  supportsTouch: true,
  prefersReducedMotion: false,
  colorScheme: "dark"
}
```

**Optimization Categories**:

1. **Screen-based**:
   - Mobile: Single column, collapsed sidebar, simplified navigation
   - Tablet: Two columns, responsive grids
   - Desktop: Multi-column, expanded sidebar, hover effects

2. **Performance-based**:
   - Low-tier: Disable animations, reduce visualizations, lazy loading
   - Medium-tier: Simplified animations, lazy loading
   - High-tier: Full animations, all features enabled

3. **Network-based**:
   - Slow: Data saving mode, reduced image quality, increased debouncing
   - Medium: Moderate data usage
   - Fast: All features enabled

4. **Battery-based**:
   - Low battery (<20%, not charging): Battery saver mode, reduce background sync, disable auto-sync

5. **Accessibility**:
   - Reduced motion: Disable animations
   - Dark mode: Apply dark theme
   - Touch/Mouse: Optimize interaction targets

**Performance Modes**:
- `auto` (default): Automatic optimizations based on device profile
- `performance`: Maximum performance, all features enabled
- `battery`: Battery saving, reduced features
- `quality`: Best visual quality, optimize for large screens

**Events**:
- `optimizationsApplied` - Fired when optimizations are applied

---

## Integration Guide

### Step 1: Add Module Files

Copy all sync modules to your project:

```
www/js/sync/
├── deviceManager.js
├── syncStateManager.js
├── conflictResolver.js
├── sessionStateSync.js
├── realtimeUpdateHandler.js
├── deviceAnalytics.js
└── deviceOptimizationEngine.js
```

### Step 2: Update index.html

Add script tags **in this exact order** before `</body>`:

```html
<!-- Existing dependencies (must be loaded first) -->
<script src="js/core/firebase-config.js"></script>
<script src="js/core/indexedDB.js"></script>
<script src="js/core/data.js"></script>

<!-- Cross-Device Sync System -->
<script src="js/sync/deviceManager.js"></script>
<script src="js/sync/conflictResolver.js"></script>
<script src="js/sync/syncStateManager.js"></script>
<script src="js/sync/sessionStateSync.js"></script>
<script src="js/sync/realtimeUpdateHandler.js"></script>
<script src="js/sync/deviceAnalytics.js"></script>
<script src="js/sync/deviceOptimizationEngine.js"></script>
```

### Step 3: Update Firestore Rules

Add security rules for new collections:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Device management
      match /devices/{deviceId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      
      // Active sessions
      match /activeSessions/{sessionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      
      // Device analytics
      match /deviceAnalytics/{analyticsId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      
      // Sync metadata
      match /syncMetadata/{deviceId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      
      // Conflict logs
      match /conflictLogs/{logId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

### Step 4: Initialize System

The system auto-initializes when user authenticates. Ensure you dispatch the `userAuthenticated` event:

```javascript
// In your authentication code (e.g., auth.js)
firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    currentUserId = user.uid;
    
    // Dispatch event to initialize sync system
    document.dispatchEvent(new Event('userAuthenticated'));
    
    // Your existing code...
  }
});
```

### Step 5: Optional - Add UI Elements

Add device status indicators to your UI:

```html
<!-- Device sync status -->
<div id="deviceStatus" class="sync-status">
  <span class="device-icon">📱</span>
  <span class="device-name">Loading...</span>
  <span class="sync-indicator">🔄</span>
</div>

<!-- Other active devices -->
<div id="otherDevices" class="other-devices-list">
  <!-- Populated dynamically -->
</div>
```

Update UI with device information:

```javascript
// Listen for device registration
document.addEventListener('deviceRegistered', (e) => {
  const device = e.detail;
  document.getElementById('deviceStatus').innerHTML = `
    <span class="device-icon">${DeviceManager.getDeviceIcon(device.deviceType)}</span>
    <span class="device-name">${device.deviceName}</span>
    <span class="sync-indicator">✅</span>
  `;
});

// Listen for sync state changes
document.addEventListener('syncStateChanged', (e) => {
  const state = e.detail;
  const indicator = document.querySelector('.sync-indicator');
  
  if (state.status === 'syncing') {
    indicator.textContent = '🔄';
  } else if (state.status === 'error') {
    indicator.textContent = '❌';
  } else if (state.status === 'offline') {
    indicator.textContent = '📡';
  } else {
    indicator.textContent = '✅';
  }
});

// Listen for other active sessions
document.addEventListener('otherSessionsUpdated', (e) => {
  const sessions = e.detail.sessions;
  const container = document.getElementById('otherDevices');
  
  if (sessions.length === 0) {
    container.innerHTML = '<p>No other active devices</p>';
  } else {
    container.innerHTML = sessions.map(session => `
      <div class="other-device">
        <span class="icon">${DeviceManager.getDeviceIcon(session.deviceType)}</span>
        <span class="name">${session.deviceName}</span>
        <span class="activity">${session.type} session active</span>
        <span class="time">${DeviceManager.formatLastActive(session.lastUpdate)}</span>
      </div>
    `).join('');
  }
});
```

---

## Configuration

### Global Configuration

Each module has a `CONFIG` object that can be customized:

```javascript
// Adjust sync interval (default: 30 seconds)
SyncStateManager.CONFIG.SYNC_INTERVAL = 60000; // 1 minute

// Adjust device heartbeat interval (default: 5 minutes)
DeviceManager.CONFIG.HEARTBEAT_INTERVAL = 300000;

// Change conflict resolution strategy (default: 'timestamp')
ConflictResolver.CONFIG.DEFAULT_STRATEGY = 'merge';

// Disable animations for all devices
DeviceOptimizationEngine.CONFIG.ENABLE_ADAPTIVE_UI = false;
```

### Per-Module Configuration

**DeviceManager**:
```javascript
{
  DEVICE_ID_KEY: 'prodify_device_id',
  DEVICE_UPDATE_INTERVAL: 60000, // 1 minute
  HEARTBEAT_INTERVAL: 300000, // 5 minutes
  DEVICE_TIMEOUT: 900000 // 15 minutes
}
```

**SyncStateManager**:
```javascript
{
  SYNC_INTERVAL: 30000, // 30 seconds
  BATCH_SIZE: 20,
  MAX_RETRIES: 5,
  RETRY_DELAY: 5000,
  DELTA_SYNC_ENABLED: true,
  COMPRESSION_ENABLED: true
}
```

**ConflictResolver**:
```javascript
{
  DEFAULT_STRATEGY: 'timestamp', // or 'merge', 'device-priority'
  MERGE_ARRAYS: true,
  MERGE_NOTES: true,
  PRESERVE_HISTORY: true,
  MAX_CONFLICT_HISTORY: 100
}
```

**SessionStateSync**:
```javascript
{
  SESSION_COLLECTION: 'activeSessions',
  UPDATE_INTERVAL: 5000, // 5 seconds
  SESSION_TIMEOUT: 300000, // 5 minutes
  HEARTBEAT_INTERVAL: 10000 // 10 seconds
}
```

**RealtimeUpdateHandler**:
```javascript
{
  DEBOUNCE_DELAY: 500, // milliseconds
  MAX_RETRIES: 3,
  RETRY_DELAY: 5000,
  ENABLE_OFFLINE_PERSISTENCE: true
}
```

**DeviceAnalytics**:
```javascript
{
  TRACK_INTERVAL: 60000, // 1 minute
  SAVE_INTERVAL: 300000, // 5 minutes
  RETENTION_DAYS: 90,
  ENABLE_DETAILED_TRACKING: true
}
```

**DeviceOptimizationEngine**:
```javascript
{
  PERFORMANCE_CHECK_INTERVAL: 30000, // 30 seconds
  LOW_MEMORY_THRESHOLD: 100, // MB
  ANIMATION_FPS_THRESHOLD: 30,
  ENABLE_ADAPTIVE_UI: true,
  ENABLE_PERFORMANCE_MONITORING: true
}
```

---

## API Reference

See [Module Reference](#module-reference) section for detailed API documentation.

### Quick Reference

**Device Management**:
- `DeviceManager.getCurrentDevice()` → Current device info
- `DeviceManager.getAllDevices()` → All registered devices
- `DeviceManager.updateDeviceName(name)` → Rename device

**Sync Control**:
- `SyncStateManager.triggerSync()` → Manual sync
- `SyncStateManager.pauseSync()` / `.resumeSync()` → Control sync
- `SyncStateManager.getSyncState()` → Current state

**Conflict Resolution**:
- `ConflictResolver.resolveConflict(local, remote, options)` → Resolve conflict
- `ConflictResolver.getConflictHistory(50)` → Get recent conflicts

**Session Management**:
- `SessionStateSync.startFocusSession(data)` → Start focus session
- `SessionStateSync.getCurrentSession()` → Get active session
- `SessionStateSync.endSession()` → End session

**Analytics**:
- `DeviceAnalytics.getCurrentMetrics()` → Real-time metrics
- `DeviceAnalytics.getDeviceUsageSummary(7)` → 7-day summary
- `DeviceAnalytics.getChartData(30)` → 30-day chart data

**Optimization**:
- `DeviceOptimizationEngine.getDeviceProfile()` → Device profile
- `DeviceOptimizationEngine.setPerformanceMode('battery')` → Set mode
- `DeviceOptimizationEngine.getCurrentOptimizations()` → Active optimizations

---

## Usage Examples

### Example 1: Manual Sync Trigger

```javascript
// Add sync button to UI
document.getElementById('syncButton').addEventListener('click', async () => {
  const button = document.getElementById('syncButton');
  button.disabled = true;
  button.textContent = 'Syncing...';
  
  try {
    const result = await SyncStateManager.triggerSync();
    console.log('Sync completed:', result);
    alert(`Synced ${result.success} items successfully`);
  } catch (error) {
    console.error('Sync failed:', error);
    alert('Sync failed. Please try again.');
  } finally {
    button.disabled = false;
    button.textContent = 'Sync Now';
  }
});
```

### Example 2: Display Other Active Devices

```javascript
async function displayActiveDevices() {
  const devices = await DeviceManager.getActiveDevices();
  const currentDevice = DeviceManager.getCurrentDevice();
  
  const container = document.getElementById('devicesContainer');
  container.innerHTML = devices
    .filter(d => d.deviceId !== currentDevice.deviceId)
    .map(device => `
      <div class="device-card">
        <div class="device-icon">${DeviceManager.getDeviceIcon(device.deviceType)}</div>
        <div class="device-info">
          <h3>${device.deviceName}</h3>
          <p>Last active: ${DeviceManager.formatLastActive(device.lastActive)}</p>
          <p>Type: ${device.deviceType}</p>
        </div>
        <button onclick="removeDevice('${device.deviceId}')">Remove</button>
      </div>
    `).join('');
}

function removeDevice(deviceId) {
  if (confirm('Remove this device?')) {
    DeviceManager.removeDevice(deviceId).then(() => {
      alert('Device removed');
      displayActiveDevices();
    });
  }
}
```

### Example 3: Show Focus Session from Other Device

```javascript
function displayFocusSessionStatus() {
  const currentSession = SessionStateSync.getCurrentSession();
  const otherSessions = SessionStateSync.getOtherActiveSessions();
  
  const focusSession = currentSession?.type === 'focus' 
    ? currentSession 
    : otherSessions.find(s => s.type === 'focus');
  
  if (focusSession) {
    const status = SessionStateSync.getSessionStatus(focusSession);
    const isCurrentDevice = currentSession?.sessionId === focusSession.sessionId;
    
    document.getElementById('focusStatus').innerHTML = `
      <div class="focus-session-indicator">
        <span class="icon">${status.icon}</span>
        <div class="details">
          <h3>Focus Mode Active</h3>
          <p>${isCurrentDevice ? 'This device' : focusSession.deviceName}</p>
          <p>${status.message}</p>
          ${focusSession.data.subject ? `<p>Subject: ${focusSession.data.subject}</p>` : ''}
        </div>
      </div>
    `;
  } else {
    document.getElementById('focusStatus').innerHTML = '<p>No active focus sessions</p>';
  }
}

// Update every 5 seconds
setInterval(displayFocusSessionStatus, 5000);
```

### Example 4: Sync Statistics Dashboard

```javascript
async function displaySyncStatistics() {
  const syncMetrics = await DeviceAnalytics.getSyncMetrics(7);
  const usageSummary = await DeviceAnalytics.getDeviceUsageSummary(7);
  
  document.getElementById('statsContainer').innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <h3>Total Sync Events</h3>
        <p class="stat-value">${syncMetrics.totalSyncEvents}</p>
      </div>
      <div class="stat-card">
        <h3>Success Rate</h3>
        <p class="stat-value">${syncMetrics.successRate}%</p>
      </div>
      <div class="stat-card">
        <h3>Conflicts Resolved</h3>
        <p class="stat-value">${syncMetrics.conflictsResolved}</p>
      </div>
      <div class="stat-card">
        <h3>Total Actions</h3>
        <p class="stat-value">${usageSummary.totalActions}</p>
      </div>
      <div class="stat-card">
        <h3>Devices Used</h3>
        <p class="stat-value">${usageSummary.devicesUsed}</p>
      </div>
      <div class="stat-card">
        <h3>Total Duration</h3>
        <p class="stat-value">${Math.round(usageSummary.totalDuration / 3600)} hours</p>
      </div>
    </div>
  `;
}
```

### Example 5: Device Comparison Chart

```javascript
async function renderDeviceComparisonChart() {
  const comparison = await DeviceAnalytics.getDeviceComparison(30);
  
  if (!comparison) return;
  
  const ctx = document.getElementById('deviceChart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: comparison.devices.map(d => d.deviceType),
      datasets: [{
        label: 'Sessions',
        data: comparison.devices.map(d => d.sessions),
        backgroundColor: 'rgba(54, 162, 235, 0.5)'
      }, {
        label: 'Actions',
        data: comparison.devices.map(d => d.actions),
        backgroundColor: 'rgba(255, 99, 132, 0.5)'
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}
```

### Example 6: Custom Conflict Resolution

```javascript
// Register custom conflict handler
document.addEventListener('conflictResolved', (e) => {
  const resolution = e.detail;
  
  if (resolution.severity === 'high') {
    // Log high-severity conflicts
    console.warn('High-severity conflict resolved:', resolution);
    
    // Optional: Notify user
    if (typeof Notify !== 'undefined') {
      Notify.warning(`Conflict resolved: ${resolution.collection}`);
    }
  }
});

// Manually resolve with specific strategy
async function resolveTaskConflict(localTask, remoteTask) {
  const result = await ConflictResolver.resolveConflict(
    localTask,
    remoteTask,
    {
      strategy: 'merge', // Force merge strategy
      collection: 'tasks'
    }
  );
  
  // Apply resolved data
  await updateTask(result.resolved.id, result.resolved);
  
  return result;
}
```

---

## Troubleshooting

### Issue: Devices not syncing

**Symptoms**: Changes on one device don't appear on others

**Solutions**:
1. Check internet connection on both devices
2. Verify user is logged in: `console.log(currentUserId)`
3. Check sync state: `console.log(SyncStateManager.getSyncState())`
4. Check pending operations: `console.log(SyncStateManager.getSyncState().pendingOperations)`
5. Manually trigger sync: `SyncStateManager.triggerSync()`
6. Check Firestore rules (see Integration Guide)
7. Check browser console for errors

### Issue: Device not registered

**Symptoms**: `DeviceManager.getCurrentDevice()` returns null

**Solutions**:
1. Ensure user is authenticated before initializing
2. Check if `userAuthenticated` event is dispatched
3. Manually initialize: `await DeviceManager.initialize()`
4. Check localStorage: `localStorage.getItem('prodify_device_id')`
5. Clear device data and re-register: `localStorage.removeItem('prodify_device_id')`

### Issue: Conflicts not being resolved

**Symptoms**: Duplicate data or lost changes

**Solutions**:
1. Check conflict logs: `await ConflictResolver.getConflictHistory(20)`
2. Check conflict strategy: `ConflictResolver.CONFIG.DEFAULT_STRATEGY`
3. Change strategy: `ConflictResolver.CONFIG.DEFAULT_STRATEGY = 'merge'`
4. Check conflict statistics: `await ConflictResolver.getConflictStatistics(7)`
5. Review conflict resolution logic for specific data type

### Issue: Poor performance on low-end device

**Symptoms**: Slow UI, laggy animations

**Solutions**:
1. Check device profile: `console.log(DeviceOptimizationEngine.getDeviceProfile())`
2. Check active optimizations: `console.log(DeviceOptimizationEngine.getCurrentOptimizations())`
3. Force battery saver mode: `DeviceOptimizationEngine.setPerformanceMode('battery')`
4. Disable animations: `DeviceOptimizationEngine.CONFIG.ENABLE_ADAPTIVE_UI = true`
5. Check performance metrics: `await DeviceOptimizationEngine.checkPerformance()`

### Issue: Session not syncing across devices

**Symptoms**: Focus session on phone not visible on desktop

**Solutions**:
1. Check if SessionStateSync is initialized: `console.log(SessionStateSync.getCurrentSession())`
2. Verify session is active: `session.isActive === true`
3. Check other sessions: `console.log(SessionStateSync.getOtherActiveSessions())`
4. Check Firestore listener: Verify `activeSessions` collection exists
5. Manually start session: `await SessionStateSync.startFocusSession({duration: 25})`

### Issue: Analytics not being saved

**Symptoms**: No analytics data in Firestore

**Solutions**:
1. Check if DeviceAnalytics is initialized
2. Check current metrics: `console.log(DeviceAnalytics.getCurrentMetrics())`
3. Manually save: `await DeviceAnalytics.saveAnalytics()`
4. Verify Firestore rules for `deviceAnalytics` collection
5. Check save interval: `DeviceAnalytics.CONFIG.SAVE_INTERVAL`

### Debugging Commands

Run these in browser console:

```javascript
// Check all module status
console.log({
  deviceManager: DeviceManager.isReady(),
  syncState: SyncStateManager.getSyncState(),
  currentSession: SessionStateSync.getCurrentSession(),
  currentDevice: DeviceManager.getCurrentDevice(),
  pendingSync: SyncStateManager.getSyncState().pendingOperations
});

// Force full sync
await SyncStateManager.triggerSync();

// Check device capabilities
console.log(DeviceOptimizationEngine.getDeviceProfile());

// View recent conflicts
await ConflictResolver.getConflictHistory(10);

// Check analytics
await DeviceAnalytics.getCurrentMetrics();
```

---

## Performance Optimization

### Best Practices

1. **Enable Offline Persistence**:
   ```javascript
   RealtimeUpdateHandler.CONFIG.ENABLE_OFFLINE_PERSISTENCE = true;
   ```

2. **Optimize Sync Interval** (balance freshness vs. battery):
   ```javascript
   SyncStateManager.CONFIG.SYNC_INTERVAL = 60000; // 1 minute
   ```

3. **Use Delta Sync** (only sync changed fields):
   ```javascript
   SyncStateManager.CONFIG.DELTA_SYNC_ENABLED = true;
   ```

4. **Batch Operations** (group multiple changes):
   ```javascript
   SyncStateManager.CONFIG.BATCH_SIZE = 20;
   ```

5. **Enable Compression** (reduce bandwidth):
   ```javascript
   SyncStateManager.CONFIG.COMPRESSION_ENABLED = true;
   ```

6. **Cleanup Inactive Devices** (reduce Firestore reads):
   ```javascript
   // Run monthly
   await DeviceManager.cleanupInactiveDevices();
   ```

7. **Cleanup Old Analytics** (reduce storage):
   ```javascript
   // Run monthly
   await DeviceAnalytics.cleanupOldAnalytics();
   ```

8. **Monitor Performance**:
   ```javascript
   DeviceOptimizationEngine.CONFIG.ENABLE_PERFORMANCE_MONITORING = true;
   ```

### Memory Management

- Clear old sync queue entries periodically
- Use lazy loading for large datasets
- Limit conflict history: `ConflictResolver.CONFIG.MAX_CONFLICT_HISTORY = 100`
- Limit analytics retention: `DeviceAnalytics.CONFIG.RETENTION_DAYS = 90`

### Network Optimization

- Reduce image quality on slow networks
- Increase debounce delays: `RealtimeUpdateHandler.CONFIG.DEBOUNCE_DELAY = 800`
- Pause sync on very slow networks: `SyncStateManager.pauseSync()`

---

## Testing

### Test Data Generation

Use browser console to test the system:

```javascript
// Generate test devices
for (let i = 1; i <= 3; i++) {
  localStorage.removeItem('prodify_device_id');
  await DeviceManager.initialize();
}

// Simulate sync
await SyncStateManager.addToQueue('tasks', 'create', {
  id: Date.now(),
  title: 'Test Task',
  completed: false,
  createdAt: new Date().toISOString()
});
await SyncStateManager.triggerSync();

// Simulate session
await SessionStateSync.startFocusSession({
  subject: 'Test Subject',
  duration: 25
});

// Check analytics
const metrics = await DeviceAnalytics.getDeviceUsageSummary(7);
console.log(metrics);
```

### Load Testing

Test with multiple simultaneous operations:

```javascript
// Add 100 sync operations
for (let i = 0; i < 100; i++) {
  await SyncStateManager.addToQueue('tasks', 'update', {
    id: i,
    title: `Task ${i}`,
    updatedAt: new Date().toISOString()
  });
}

// Process queue
await SyncStateManager.processQueue();
```

---

## Support

For issues or questions:
1. Check [Troubleshooting](#troubleshooting) section
2. Review browser console for error messages
3. Check Firestore console for data persistence
4. Verify security rules are correctly configured

## License

Part of the Prodify productivity application ecosystem.

---

**System Status**: ✅ Production Ready

**Last Updated**: March 7, 2026

**Version**: 1.0.0
