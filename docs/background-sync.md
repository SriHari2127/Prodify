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

