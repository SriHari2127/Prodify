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

