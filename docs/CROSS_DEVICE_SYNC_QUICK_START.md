# Cross-Device Sync System - Quick Start Guide

## 🚀 Quick Integration (5 Minutes)

### Step 1: Copy Files

Copy the `sync` folder to your project:

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

### Step 2: Add Scripts to index.html

Add these lines before `</body>` (after firebase-config.js and indexedDB.js):

```html
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

Add to your `firestore.rules`:

```javascript
match /users/{userId} {
  match /devices/{deviceId} {
    allow read, write: if request.auth != null && request.auth.uid == userId;
  }
  match /activeSessions/{sessionId} {
    allow read, write: if request.auth != null && request.auth.uid == userId;
  }
  match /deviceAnalytics/{analyticsId} {
    allow read, write: if request.auth != null && request.auth.uid == userId;
  }
  match /syncMetadata/{deviceId} {
    allow read, write: if request.auth != null && request.auth.uid == userId;
  }
  match /conflictLogs/{logId} {
    allow read, write: if request.auth != null && request.auth.uid == userId;
  }
}
```

Deploy rules:
```bash
firebase deploy --only firestore:rules
```

### Step 4: Verify Auto-Initialization

System auto-initializes when user logs in. Ensure you dispatch the event:

```javascript
firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    currentUserId = user.uid;
    document.dispatchEvent(new Event('userAuthenticated'));
  }
});
```

### Step 5: Test

Open browser console and run:

```javascript
// Check if initialized
console.log('Device:', DeviceManager.getCurrentDevice());
console.log('Sync State:', SyncStateManager.getSyncState());

// Test sync
await SyncStateManager.triggerSync();
```

## ✅ Integration Checklist

- [ ] Files copied to `www/js/sync/`
- [ ] Script tags added to index.html (correct order)
- [ ] Firestore rules updated and deployed
- [ ] `userAuthenticated` event dispatched in auth code
- [ ] Tested in browser console (device registered)
- [ ] Tested on second device (realtime sync working)

## 📱 UI Elements (Optional)

### Device Status Bar

Add to your header/navbar:

```html
<div class="sync-status-bar">
  <span id="deviceIcon">📱</span>
  <span id="deviceName">Loading...</span>
  <span id="syncIndicator" class="sync-dot"></span>
</div>

<style>
  .sync-status-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: rgba(0,0,0,0.05);
    border-radius: 8px;
    font-size: 14px;
  }
  
  .sync-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #4CAF50;
    animation: pulse 2s infinite;
  }
  
  .sync-dot.syncing { background: #2196F3; }
  .sync-dot.error { background: #f44336; }
  .sync-dot.offline { background: #9E9E9E; }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>

<script>
  document.addEventListener('deviceRegistered', (e) => {
    const device = e.detail;
    document.getElementById('deviceIcon').textContent = 
      DeviceManager.getDeviceIcon(device.deviceType);
    document.getElementById('deviceName').textContent = device.deviceName;
  });

  document.addEventListener('syncStateChanged', (e) => {
    const state = e.detail;
    const dot = document.getElementById('syncIndicator');
    dot.className = 'sync-dot ' + state.status;
  });
</script>
```

### Active Devices List

Add to settings page:

```html
<div class="devices-section">
  <h2>Your Devices</h2>
  <div id="devicesList"></div>
  <button onclick="refreshDevices()">Refresh</button>
</div>

<style>
  .device-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border: 1px solid #ddd;
    border-radius: 8px;
    margin-bottom: 12px;
  }
  
  .device-icon { font-size: 32px; }
  
  .device-info {
    flex: 1;
  }
  
  .device-info h3 {
    margin: 0 0 4px 0;
    font-size: 16px;
  }
  
  .device-info p {
    margin: 0;
    font-size: 12px;
    color: #666;
  }
  
  .device-actions button {
    padding: 6px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: white;
    cursor: pointer;
  }
  
  .device-actions button:hover {
    background: #f5f5f5;
  }
  
  .current-device {
    border-color: #4CAF50;
    background: rgba(76, 175, 80, 0.05);
  }
</style>

<script>
  async function refreshDevices() {
    const devices = await DeviceManager.getAllDevices();
    const currentDevice = DeviceManager.getCurrentDevice();
    
    const html = devices.map(device => {
      const isCurrent = device.deviceId === currentDevice.deviceId;
      return `
        <div class="device-card ${isCurrent ? 'current-device' : ''}">
          <div class="device-icon">${DeviceManager.getDeviceIcon(device.deviceType)}</div>
          <div class="device-info">
            <h3>${device.deviceName} ${isCurrent ? '(This Device)' : ''}</h3>
            <p>Type: ${device.deviceType}</p>
            <p>Last Active: ${DeviceManager.formatLastActive(device.lastActive)}</p>
            <p>Screen: ${device.capabilities.screenResolution}</p>
          </div>
          <div class="device-actions">
            ${!isCurrent ? `<button onclick="removeDevice('${device.deviceId}')">Remove</button>` : ''}
          </div>
        </div>
      `;
    }).join('');
    
    document.getElementById('devicesList').innerHTML = html;
  }
  
  async function removeDevice(deviceId) {
    if (confirm('Remove this device? It will need to re-register on next use.')) {
      await DeviceManager.removeDevice(deviceId);
      refreshDevices();
    }
  }
  
  // Load on page load
  refreshDevices();
</script>
```

### Sync Statistics Dashboard

Add to analytics/stats page:

```html
<div class="sync-stats-section">
  <h2>Sync Statistics (Last 7 Days)</h2>
  <div id="syncStats" class="stats-grid"></div>
</div>

<style>
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }
  
  .stat-card {
    padding: 20px;
    border-radius: 8px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    text-align: center;
  }
  
  .stat-card h3 {
    margin: 0 0 8px 0;
    font-size: 14px;
    opacity: 0.9;
  }
  
  .stat-value {
    font-size: 32px;
    font-weight: bold;
    margin: 0;
  }
  
  .stat-label {
    font-size: 12px;
    opacity: 0.8;
    margin: 4px 0 0 0;
  }
</style>

<script>
  async function displaySyncStats() {
    const syncMetrics = await DeviceAnalytics.getSyncMetrics(7);
    const usageSummary = await DeviceAnalytics.getDeviceUsageSummary(7);
    
    const stats = [
      { label: 'Total Syncs', value: syncMetrics.totalSyncEvents, color: '#667eea' },
      { label: 'Success Rate', value: syncMetrics.successRate + '%', color: '#4CAF50' },
      { label: 'Conflicts Resolved', value: syncMetrics.conflictsResolved, color: '#ff9800' },
      { label: 'Total Actions', value: usageSummary.totalActions, color: '#2196F3' },
      { label: 'Devices Used', value: usageSummary.devicesUsed, color: '#9C27B0' },
      { label: 'Total Hours', value: Math.round(usageSummary.totalDuration / 3600), color: '#f44336' }
    ];
    
    const html = stats.map(stat => `
      <div class="stat-card" style="background: ${stat.color}">
        <h3>${stat.label}</h3>
        <p class="stat-value">${stat.value}</p>
      </div>
    `).join('');
    
    document.getElementById('syncStats').innerHTML = html;
  }
  
  // Load on page load
  displaySyncStats();
</script>
```

### Focus Session Indicator

Add to dashboard:

```html
<div class="focus-indicator-container">
  <div id="focusIndicator"></div>
</div>

<style>
  .focus-session-active {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 12px;
    animation: fadeIn 0.3s;
  }
  
  .focus-icon {
    font-size: 48px;
  }
  
  .focus-details h3 {
    margin: 0 0 8px 0;
    font-size: 18px;
  }
  
  .focus-details p {
    margin: 0 0 4px 0;
    font-size: 14px;
    opacity: 0.9;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>

<script>
  function updateFocusIndicator() {
    const focusSession = SessionStateSync.getActiveFocusSession();
    const container = document.getElementById('focusIndicator');
    
    if (focusSession) {
      const status = SessionStateSync.getSessionStatus(focusSession);
      const currentDevice = SessionStateSync.getCurrentSession();
      const isThisDevice = currentDevice?.sessionId === focusSession.sessionId;
      
      container.innerHTML = `
        <div class="focus-session-active">
          <div class="focus-icon">${status.icon}</div>
          <div class="focus-details">
            <h3>Focus Mode Active</h3>
            <p><strong>${isThisDevice ? 'This device' : focusSession.deviceName}</strong></p>
            <p>${status.message}</p>
            ${focusSession.data.subject ? `<p>📚 ${focusSession.data.subject}</p>` : ''}
            ${focusSession.data.remaining ? `<p>⏱️ ${Math.ceil(focusSession.data.remaining / 60)} minutes remaining</p>` : ''}
          </div>
        </div>
      `;
    } else {
      container.innerHTML = '';
    }
  }
  
  // Update every 5 seconds
  setInterval(updateFocusIndicator, 5000);
  updateFocusIndicator();
  
  // Listen for session updates
  document.addEventListener('sessionStarted', updateFocusIndicator);
  document.addEventListener('sessionEnded', updateFocusIndicator);
  document.addEventListener('otherSessionsUpdated', updateFocusIndicator);
</script>
```

## 🎯 Common Use Cases

### Use Case 1: Start Focus Session on Phone, View on Desktop

**Phone**:
```javascript
await SessionStateSync.startFocusSession({
  subject: 'Mathematics',
  duration: 25,
  mode: 'pomodoro'
});
```

**Desktop** (automatically receives update):
```javascript
// Listen for other sessions
document.addEventListener('otherSessionsUpdated', (e) => {
  const sessions = e.detail.sessions;
  const focusSession = sessions.find(s => s.type === 'focus');
  
  if (focusSession) {
    showNotification(`Focus session active on ${focusSession.deviceName}`);
  }
});
```

### Use Case 2: Complete Task on Tablet, Sync to Phone

**Tablet**:
```javascript
// Mark task as completed
task.completed = true;
task.completedDate = new Date().toISOString();
await updateTask(task.id, task);
```

**Phone** (automatically receives update within seconds via Firestore listener):
```javascript
// Listen for task updates
document.addEventListener('tasksUpdated', (e) => {
  const changes = e.detail;
  changes.modified.forEach(task => {
    if (task.completed) {
      playCompletionSound();
      showConfetti();
    }
  });
});
```

### Use Case 3: Check Active Devices

```javascript
async function showActiveDevices() {
  const devices = await DeviceManager.getActiveDevices();
  
  console.log('Active devices:');
  devices.forEach(device => {
    console.log(`- ${device.deviceName} (${device.deviceType})`);
    console.log(`  Last active: ${DeviceManager.formatLastActive(device.lastActive)}`);
  });
}
```

### Use Case 4: Manual Sync with Progress

```javascript
async function syncWithProgress() {
  const button = document.getElementById('syncButton');
  button.disabled = true;
  button.textContent = 'Syncing...';
  
  // Listen for progress
  document.addEventListener('syncProgress', (e) => {
    const progress = e.detail.progress;
    button.textContent = `Syncing... ${Math.round(progress)}%`;
  });
  
  try {
    const result = await SyncStateManager.triggerSync();
    button.textContent = `✅ Synced ${result.success} items`;
    
    setTimeout(() => {
      button.textContent = 'Sync Now';
      button.disabled = false;
    }, 2000);
  } catch (error) {
    button.textContent = '❌ Sync Failed';
    console.error(error);
  }
}
```

## 🔧 Configuration Examples

### Reduce Sync Frequency (Save Battery)

```javascript
// Increase sync interval to 2 minutes
SyncStateManager.CONFIG.SYNC_INTERVAL = 120000;
```

### Enable Aggressive Caching (Offline-First)

```javascript
// Increase batch size
SyncStateManager.CONFIG.BATCH_SIZE = 50;

// Enable compression
SyncStateManager.CONFIG.COMPRESSION_ENABLED = true;
```

### Change Conflict Strategy to Merge

```javascript
// Always merge instead of timestamp-based
ConflictResolver.CONFIG.DEFAULT_STRATEGY = 'merge';

// Enable note merging
ConflictResolver.CONFIG.MERGE_NOTES = true;
ConflictResolver.CONFIG.MERGE_ARRAYS = true;
```

### Force Low Performance Mode

```javascript
// Disable animations and reduce features
DeviceOptimizationEngine.setPerformanceMode('battery');
```

## 📊 Monitoring & Debugging

### Check System Health

```javascript
async function checkSystemHealth() {
  const health = {
    device: DeviceManager.isReady(),
    sync: SyncStateManager.getSyncState(),
    session: SessionStateSync.getCurrentSession(),
    pending: SyncStateManager.getSyncState().pendingOperations,
    conflicts: await ConflictResolver.getConflictStatistics(1)
  };
  
  console.table(health);
  return health;
}
```

### Enable Debug Logging

```javascript
// Monitor all events
['deviceRegistered', 'syncCompleted', 'syncStateChanged', 'conflictResolved',
 'sessionStarted', 'sessionEnded', 'tasksUpdated', 'habitsUpdated'].forEach(event => {
  document.addEventListener(event, (e) => {
    console.log(`[${event}]`, e.detail);
  });
});
```

### View Sync Queue

```javascript
async function viewSyncQueue() {
  const pending = await getPendingSyncOperations(100);
  
  console.log(`${pending.length} pending operations:`);
  console.table(pending.map(op => ({
    table: op.table,
    operation: op.operation,
    timestamp: new Date(op.timestamp).toLocaleString(),
    retries: op.retries
  })));
}
```

## 🎓 Advanced Examples

### Custom Device Name

```javascript
// Set custom device name
await DeviceManager.updateDeviceName('My Work Laptop');
```

### Conflict Resolution with Custom Logic

```javascript
async function smartMergeTask(localTask, remoteTask) {
  // Custom logic: If local has subtasks, always keep them
  const result = await ConflictResolver.resolveByMerge(localTask, remoteTask);
  
  if (localTask.subtasks && localTask.subtasks.length > 0) {
    result.resolved.subtasks = localTask.subtasks;
  }
  
  return result;
}
```

### Device-Specific UI Adjustment

```javascript
const profile = DeviceOptimizationEngine.getDeviceProfile();

if (profile.deviceType === 'android') {
  // Android-specific UI
  document.body.classList.add('android-ui');
  enableBottomNavigation();
} else if (profile.deviceType === 'desktop') {
  // Desktop-specific UI
  document.body.classList.add('desktop-ui');
  enableSidebar();
}
```

## 🚨 Error Handling

### Handle Sync Errors

```javascript
document.addEventListener('syncStateChanged', (e) => {
  const state = e.detail;
  
  if (state.status === 'error') {
    console.error('Sync error:', state.error);
    
    // Show user-friendly message
    showNotification('Sync failed. Will retry automatically.', 'error');
    
    // Optional: Manual retry button
    showRetryButton();
  }
});

function showRetryButton() {
  const button = document.createElement('button');
  button.textContent = 'Retry Sync';
  button.onclick = () => SyncStateManager.triggerSync();
  document.body.appendChild(button);
}
```

### Handle Offline State

```javascript
document.addEventListener('syncStateChanged', (e) => {
  if (e.detail.status === 'offline') {
    showOfflineBanner();
  } else {
    hideOfflineBanner();
  }
});

function showOfflineBanner() {
  const banner = document.getElementById('offlineBanner');
  banner.style.display = 'block';
  banner.textContent = '📡 Offline - Changes will sync when connection is restored';
}
```

## 📈 Performance Tips

1. **Reduce Real-time Listener Load**:
   ```javascript
   // Only listen to recent data
   RealtimeUpdateHandler.CONFIG.DEBOUNCE_DELAY = 1000; // 1 second
   ```

2. **Batch Multiple Operations**:
   ```javascript
   // Instead of individual updates
   for (const task of tasksToUpdate) {
     await SyncStateManager.addToQueue('tasks', 'update', task);
   }
   // Process once
   await SyncStateManager.processQueue();
   ```

3. **Cleanup Regularly**:
   ```javascript
   // Run monthly
   await DeviceManager.cleanupInactiveDevices();
   await DeviceAnalytics.cleanupOldAnalytics();
   await ConflictResolver.cleanupOldConflictLogs();
   ```

## 🎉 You're Ready!

Your cross-device sync system is now fully integrated. Test by:

1. Opening app on two devices with same account
2. Making changes on device 1
3. Watching device 2 update in real-time
4. Starting a focus session on device 1
5. Viewing the active session on device 2

## 📚 Next Steps

- Read full [documentation](CROSS_DEVICE_SYNC_DOCUMENTATION.md)
- Customize UI elements for your design
- Configure conflict resolution strategies
- Monitor analytics dashboard
- Test on different device types

---

**Need Help?** Check the [Troubleshooting section](CROSS_DEVICE_SYNC_DOCUMENTATION.md#troubleshooting) in the full documentation.
