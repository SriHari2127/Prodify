# Smart Notification System - Complete Integration Guide

## 📋 Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Module Reference](#module-reference)
4. [Integration Steps](#integration-steps)
5. [API Reference](#api-reference)
6. [Usage Examples](#usage-examples)
7. [Configuration](#configuration)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The **Smart Notification System** is a production-grade, multi-platform notification solution designed specifically for student productivity apps. It features intelligent scheduling, behavior-based optimization, and cross-platform delivery (Android native + Web).

### Key Features
- ✅ **Smart Queue Management** - Priority-based persistent queue with IndexedDB
- ✅ **Intelligent Scheduling** - Time optimization based on user behavior
- ✅ **Rate Limiting** - Anti-spam with daily limits and minimum gaps
- ✅ **Quiet Hours** - Configurable do-not-disturb periods
- ✅ **Behavior Analysis** - Machine learning from user interaction patterns
- ✅ **Multi-Platform Delivery** - Capacitor LocalNotifications + Web Notifications API
- ✅ **Push Notifications** - Firebase Cloud Messaging integration
- ✅ **Analytics Tracking** - Comprehensive metrics and performance scoring
- ✅ **UI Components** - Built-in notification center and settings

### System Limits
- **Daily Notification Limit**: 5 notifications (configurable)
- **Minimum Gap**: 60 minutes between notifications (configurable)
- **Quiet Hours**: 10 PM - 7 AM (configurable)
- **Queue Size**: Maximum 100 notifications
- **Retention**: 30-day automatic cleanup

---

## Architecture

### Module Dependency Graph
```
notificationEngine (Orchestrator)
    ├── notificationQueue (Persistence)
    ├── notificationRules (Business Logic)
    ├── notificationScheduler (Timing)
    │   ├── localNotificationManager (Local Delivery)
    │   └── pushNotificationManager (Push Delivery)
    ├── behaviorAnalyzer (ML Optimization)
    ├── notificationAnalytics (Metrics)
    └── notificationUI (User Interface)
```

### Data Flow
```
Event Trigger
    ↓
Notification Rules (Validation)
    ↓
Notification Queue (Persistence)
    ↓
Scheduler (Timing Optimization)
    ↓
Behavior Analyzer (Best Time Calculation)
    ↓
Delivery Manager (Local/Push)
    ↓
Analytics Tracker
    ↓
User Device
```

---

## Module Reference

### 1. **notificationQueue.js** - Queue Management
**Purpose**: Persistent notification queue with priority scoring

**Key Methods**:
- `enqueue(notification)` - Add notification to queue
- `dequeue(limit)` - Get ready notifications
- `updateStatus(id, status)` - Update notification status
- `cancel(id)` - Cancel a notification
- `getStats()` - Get queue statistics

**Storage**: IndexedDB table `notificationQueue`

---

### 2. **notificationRules.js** - Business Rules
**Purpose**: Enforce notification rules and generate notifications

**Key Methods**:
- `shouldSendNotification(notification)` - Validate against rules
- `generateTaskReminder(task)` - Create task reminder
- `generateExamAlert(exam)` - Create exam alert
- `generateHabitReminder(habit)` - Create habit reminder
- `generateStudySuggestion(subject, reason)` - Create study suggestion
- `generateFocusSessionReminder(session)` - Create focus reminder
- `generateAchievement(achievement)` - Create achievement notification
- `generateProductivityNudge(nudgeType)` - Create productivity nudge
- `saveUserPreferences(prefs)` - Save user settings
- `loadUserPreferences()` - Load user settings

**Storage**: localStorage `notificationPreferences`

---

### 3. **notificationScheduler.js** - Scheduling
**Purpose**: Coordinate timing and delivery

**Key Methods**:
- `scheduleNotification(notification)` - Schedule a notification
- `scheduleTaskReminder(task)` - Schedule task reminder
- `scheduleExamAlert(exam)` - Schedule exam alert
- `scheduleHabitReminder(habit)` - Schedule habit reminder
- `scheduleDailyHabitReminders()` - Batch schedule habits
- `sendAchievement(achievement)` - Send immediate achievement
- `checkAndScheduleNotifications()` - Periodic check (runs every 60s)
- `getStatus()` - Get scheduler status

---

### 4. **localNotificationManager.js** - Local Delivery
**Purpose**: Platform-specific local notification delivery

**Key Methods**:
- `sendNotification(notification)` - Send local notification
- `requestPermissions()` - Request notification permissions
- `cancelNotification(id)` - Cancel a notification
- `clearAll()` - Clear all notifications
- `getStatus()` - Get permission status

**Platform Support**: 
- Android: Capacitor LocalNotifications plugin
- Web: Web Notifications API

---

### 5. **pushNotificationManager.js** - Push Delivery
**Purpose**: Firebase Cloud Messaging integration

**Key Methods**:
- `initialize()` - Setup FCM
- `getToken()` - Get FCM token
- `sendNotification(notification)` - Prepare push notification
- `isEnabled()` - Check if push enabled
- `unregister()` - Remove FCM token

**Firebase Integration**: Stores device tokens in Firestore `users/{userId}/devices`

---

### 6. **behaviorAnalyzer.js** - Behavior Learning
**Purpose**: Learn user patterns to optimize delivery

**Key Methods**:
- `trackInteraction(interaction)` - Track notification interaction
- `trackStudySession(session)` - Track study session
- `getOptimalTime(type)` - Get best time to send
- `shouldSendType(type)` - Check if type performs well
- `getInsights()` - Get behavior insights

**Storage**: localStorage `behaviorAnalyzerData`

---

### 7. **notificationEngine.js** - Orchestrator
**Purpose**: Main coordinator providing high-level API

**Key Methods**:
- `scheduleNotification(notification)` - Schedule any notification
- `scheduleTaskReminder(task)` - Schedule task reminder
- `scheduleExamAlert(exam)` - Schedule exam alert
- `scheduleHabitReminder(habit)` - Schedule habit reminder
- `sendAchievement(achievement)` - Send achievement
- `cancelNotification(id)` - Cancel notification
- `getPendingNotifications()` - Get all pending
- `getStatistics()` - Get full statistics
- `updatePreferences(prefs)` - Update user preferences

---

### 8. **notificationAnalytics.js** - Analytics
**Purpose**: Track metrics and performance

**Key Methods**:
- `trackSent(notification)` - Track sent
- `trackDelivered(notification)` - Track delivered
- `trackOpened(notification)` - Track opened
- `trackClicked(notification)` - Track clicked
- `trackDismissed(notification)` - Track dismissed
- `getStats()` - Get overall statistics
- `getStatsByType()` - Get type-specific stats
- `getSummary()` - Get full analytics summary

**Metrics Tracked**:
- Delivery rate
- Open rate
- Click-through rate
- Dismissal rate
- Failure rate
- Average time to open

---

### 9. **notificationUI.js** - User Interface
**Purpose**: UI components for notification management

**Key Methods**:
- `toggleNotificationCenter()` - Show/hide notification center
- `dismissNotification(id)` - Dismiss a notification
- `markAllAsRead()` - Mark all as read
- `showSettings()` - Show settings dialog
- `showPreview(notification)` - Show preview (for testing)

**UI Components**:
- Notification bell button with badge
- Notification center slide-out panel
- Settings modal
- Preview toasts

---

## Integration Steps

### Step 1: Add Script Tags to HTML

Add the following scripts to `index.html` **in this exact order** (after your existing background sync scripts):

```html
<!-- Notification System -->
<script src="js/notifications/notificationQueue.js"></script>
<script src="js/notifications/notificationRules.js"></script>
<script src="js/notifications/notificationScheduler.js"></script>
<script src="js/notifications/localNotificationManager.js"></script>
<script src="js/notifications/pushNotificationManager.js"></script>
<script src="js/notifications/behaviorAnalyzer.js"></script>
<script src="js/notifications/notificationAnalytics.js"></script>
<script src="js/notifications/notificationEngine.js"></script>
<script src="js/notifications/notificationUI.js"></script>
```

### Step 2: Install Capacitor Plugins

```bash
# Install required plugins
npm install @capacitor/local-notifications
npm install @capacitor/push-notifications

# Sync with native projects
npx cap sync
```

### Step 3: Configure Android Permissions

Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
```

### Step 4: Setup Firebase Cloud Messaging

1. Enable FCM in Firebase Console
2. Download `google-services.json` to `android/app/`
3. Add FCM VAPID key to `pushNotificationManager.js` (line 91):
   ```javascript
   vapidKey: 'YOUR_VAPID_KEY_HERE'
   ```

### Step 5: Create Backend Endpoint (Optional)

For server-side push notifications, create an endpoint:

```javascript
// POST /api/notifications/send
// Body: { userId, notification }

// Use Firebase Admin SDK
admin.messaging().send({
  token: userToken,
  notification: {
    title: notification.title,
    body: notification.body
  },
  data: notification.data
});
```

### Step 6: Initialize in Your App

The system auto-initializes on `DOMContentLoaded`. To verify:

```javascript
document.addEventListener('DOMContentLoaded', () => {
  // Wait for engine to be ready
  if (window.notificationEngine) {
    window.notificationEngine.on('ready', () => {
      console.log('✅ Notification system ready');
      
      // Check status
      const status = window.notificationEngine.getStatus();
      console.log('Status:', status);
    });
  }
});
```

---

## API Reference

### Notification Object Structure

```javascript
{
  id: "notif_1234567890_abcd",      // Unique ID (auto-generated)
  type: "task_reminder",              // Notification type
  title: "Task Due Soon",             // Title
  message: "Complete Math Homework",  // Body message
  priority: "high",                   // high | medium | low
  scheduledTime: "2024-01-15T14:00:00Z", // ISO timestamp
  actions: [                          // Action buttons (optional)
    { id: "complete", title: "Complete Task" },
    { id: "view", title: "View Details" }
  ],
  metadata: {                         // Type-specific data
    taskId: "task_123",
    dueDate: "2024-01-15T18:00:00Z"
  },
  status: "pending",                  // pending | scheduled | sent | failed | cancelled
  priorityScore: 85                   // Calculated score (0-100)
}
```

### Notification Types

| Type | Description | Use Case |
|------|-------------|----------|
| `task_reminder` | Task due date alerts | Remind about upcoming tasks |
| `exam_alert` | Exam countdown notifications | Alert about upcoming exams |
| `habit_reminder` | Daily habit completion reminders | Prompt to complete daily habits |
| `study_suggestion` | AI-suggested study sessions | Suggest studying based on patterns |
| `focus_session` | Focus session start reminders | Remind to start planned focus time |
| `achievement` | Badge/XP unlock notifications | Celebrate achievements |
| `productivity_nudge` | Motivational messages | Encourage productivity |

---

## Usage Examples

### Example 1: Schedule Task Reminder

```javascript
// When user creates a task
async function createTask(taskData) {
  // Save task to database
  const task = await saveTask(taskData);
  
  // Schedule notification
  if (task.dueDate) {
    await window.scheduleTaskReminder(task);
  }
  
  return task;
}
```

### Example 2: Schedule Exam Alert

```javascript
// When user adds an exam
async function addExam(examData) {
  // Save exam
  const exam = await saveExam(examData);
  
  // Schedule notification
  await window.scheduleExamAlert({
    id: exam.id,
    subject: exam.subject,
    date: exam.date,
    title: exam.title
  });
  
  return exam;
}
```

### Example 3: Schedule Daily Habit Reminders

```javascript
// Run once per day (e.g., at midnight)
async function setupDailyReminders() {
  await window.notificationEngine.scheduleDailyHabitReminders();
}

// Or schedule individual habit
async function addHabit(habit) {
  await window.scheduleHabitReminder({
    id: habit.id,
    name: habit.name,
    reminderTime: habit.reminderTime, // "09:00"
    streak: habit.streak
  });
}
```

### Example 4: Send Achievement Notification

```javascript
// When user unlocks an achievement
async function unlockAchievement(achievementId) {
  const achievement = getAchievementById(achievementId);
  
  // Send immediately
  await window.sendAchievement({
    id: achievement.id,
    title: achievement.title,
    description: achievement.description,
    icon: achievement.icon,
    xpEarned: achievement.xpReward
  });
}
```

### Example 5: Track User Behavior

```javascript
// When user completes a study session
async function completeStudySession(session) {
  // Track the session
  await window.notificationEngine.trackStudySession({
    startTime: session.startTime,
    endTime: session.endTime,
    duration: session.duration,
    subject: session.subject
  });
}
```

### Example 6: Get Optimal Notification Time

```javascript
// Get best time to send a notification
const optimalTime = window.notificationEngine.getOptimalTime('study_suggestion');

console.log('Best time:', optimalTime);
// Output:
// {
//   time: Date(2024-01-15T14:00:00Z),
//   hour: 14,
//   score: 85,
//   confidence: 'high'
// }
```

### Example 7: View Analytics

```javascript
// Get comprehensive statistics
const stats = await window.notificationEngine.getStatistics();

console.log('Queue Stats:', stats.queue);
console.log('Behavior Insights:', stats.behavior);
console.log('Analytics:', stats.analytics);

// Example output:
// {
//   queue: {
//     total: 45,
//     pending: 12,
//     scheduled: 8,
//     sent: 20,
//     failed: 3,
//     cancelled: 2
//   },
//   behavior: {
//     totalInteractions: 156,
//     confidenceLevel: 'high',
//     bestTimes: [{hour: 14, score: 95}, ...]
//   },
//   analytics: {
//     sent: 340,
//     openRate: 67.5,
//     clickRate: 42.1,
//     ...
//   }
// }
```

### Example 8: Update User Preferences

```javascript
// Update notification preferences
async function updateNotificationSettings(settings) {
  await window.notificationEngine.updatePreferences({
    dailyLimit: settings.maxPerDay,
    quietHours: {
      start: settings.quietStart, // "22:00"
      end: settings.quietEnd       // "07:00"
    },
    minGapMinutes: settings.minGap
  });
}
```

---

## Configuration

### Default Settings

```javascript
// Default preferences (can be changed via API)
{
  dailyLimit: 5,                    // Max notifications per day
  minGapMinutes: 60,                // Minimum gap between notifications
  quietHours: {
    start: "22:00",                 // Quiet hours start
    end: "07:00"                    // Quiet hours end
  },
  enabledTypes: [                   // Enabled notification types
    "task_reminder",
    "exam_alert",
    "habit_reminder",
    "study_suggestion",
    "focus_session",
    "achievement",
    "productivity_nudge"
  ]
}
```

### Priority Scoring Weights

```javascript
// Priority calculation weights (in notificationRules.js)
{
  task_priority: 30,      // Task priority weight
  exam_proximity: 20,     // Exam proximity weight
  habit_streak: 15,       // Habit streak weight
  inactivity: 10,         // User inactivity weight
  time_of_day: 10,        // Optimal time of day weight
  urgency: 15            // General urgency weight
}
```

### Queue Configuration

```javascript
// Queue limits (in notificationQueue.js)
{
  maxQueueSize: 100,      // Maximum notifications in queue
  retentionDays: 30,      // Days before auto-cleanup
  maxRetries: 3           // Maximum retry attempts
}
```

---

## Testing

### Test 1: Send Test Notification

```javascript
// Send a test notification immediately
async function testNotification() {
  const testNotif = {
    type: 'productivity_nudge',
    title: 'Test Notification',
    message: 'This is a test!',
    priority: 'high'
  };
  
  // Send immediately
  await window.localNotificationManager.sendNotification(testNotif);
}
```

### Test 2: Check System Status

```javascript
// Verify all modules are loaded
function checkSystemStatus() {
  const status = window.notificationEngine.getStatus();
  
  console.log('System Initialized:', status.initialized);
  console.log('Modules Loaded:', status.modules);
  console.log('Push Enabled:', status.pushEnabled);
  console.log('Local Enabled:', status.localEnabled);
}
```

### Test 3: Simulate User Interaction

```javascript
// Track a fake interaction
async function simulateInteraction() {
  await window.notificationEngine.trackInteraction({
    notificationId: 'test_123',
    type: 'task_reminder',
    action: 'opened'
  });
  
  // Check if behavior updated
  const insights = window.behaviorAnalyzer.getInsights();
  console.log('Insights:', insights);
}
```

### Test 4: Test Notification UI

```javascript
// Show notification preview
function testUI() {
  window.notificationUI.showPreview({
    type: 'achievement',
    title: '🏆 Achievement Unlocked!',
    message: 'You completed 7 tasks today!',
    priority: 'high'
  });
}
```

---

## Troubleshooting

### Issue 1: Notifications Not Showing

**Symptoms**: Notifications scheduled but not appearing

**Solutions**:
1. Check permissions:
   ```javascript
   const status = window.localNotificationManager.getStatus();
   console.log('Permission granted:', status.permissionGranted);
   ```

2. Verify Capacitor available:
   ```javascript
   console.log('Capacitor available:', typeof window.Capacitor !== 'undefined');
   ```

3. Check quiet hours:
   ```javascript
   const prefs = await window.notificationEngine.getPreferences();
   console.log('Quiet hours:', prefs.quietHours);
   ```

---

### Issue 2: Push Notifications Not Working

**Symptoms**: Local notifications work, but push doesn't

**Solutions**:
1. Verify FCM token:
   ```javascript
   const token = window.pushNotificationManager.getToken();
   console.log('FCM Token:', token);
   ```

2. Check Firestore token storage:
   - Go to Firestore Console
   - Navigate to `users/{userId}/devices`
   - Verify token is saved

3. Verify Firebase config:
   - Check `google-services.json` is in `android/app/`
   - Verify VAPID key is set in `pushNotificationManager.js`

---

### Issue 3: Modules Not Loading

**Symptoms**: `window.notificationEngine` is undefined

**Solutions**:
1. Check script order in HTML:
   - Queue → Rules → Scheduler → Local → Push → Behavior → Analytics → Engine → UI

2. Check console for errors:
   ```javascript
   // Look for these messages:
   // ✅ NotificationQueue module loaded
   // ✅ NotificationRules module loaded
   // ... etc
   ```

3. Wait for initialization:
   ```javascript
   // Don't use immediately, wait for ready event
   window.notificationEngine.on('ready', () => {
     // Now safe to use
   });
   ```

---

### Issue 4: High Dismissal Rate

**Symptoms**: Users dismissing many notifications

**Solutions**:
1. Check behavior insights:
   ```javascript
   const insights = window.behaviorAnalyzer.getInsights();
   console.log('Top performing types:', insights.topTypes);
   console.log('Recommendations:', insights.recommendations);
   ```

2. Reduce daily limit:
   ```javascript
   await window.notificationEngine.updatePreferences({
     dailyLimit: 3  // Reduce from 5 to 3
   });
   ```

3. Optimize timing:
   - System automatically learns best times
   - Check `behaviorData.bestTimes` to see optimal hours

---

### Issue 5: IndexedDB Errors

**Symptoms**: Queue not persisting

**Solutions**:
1. Check IndexedDB availability:
   ```javascript
   console.log('IndexedDB available:', typeof window.indexedDB !== 'undefined');
   ```

2. Verify database initialized:
   ```javascript
   console.log('DB initialized:', typeof window.db !== 'undefined');
   ```

3. Clear and reinitialize:
   ```javascript
   // Delete database and reload
   indexedDB.deleteDatabase('ProdifyDB');
   location.reload();
   ```

---

## Advanced Features

### Custom Notification Types

Add your own notification type:

```javascript
// 1. Add generator in notificationRules.js
generateCustomType(data) {
  return {
    id: this.generateId(),
    type: 'custom_type',
    title: data.title,
    message: data.message,
    priority: data.priority || 'medium',
    scheduledTime: data.scheduledTime,
    metadata: data.metadata
  };
}

// 2. Add handler in localNotificationManager.js
handleCustomType(notification) {
  // Custom logic
  this.openApp('/custom-route');
}

// 3. Use it
await window.notificationEngine.scheduleNotification({
  type: 'custom_type',
  title: 'Custom Notification',
  message: 'Hello!',
  priority: 'high'
});
```

### Webhook Integration

Forward analytics to external service:

```javascript
// In notificationAnalytics.js, add to syncToFirestore()
async syncToWebhook() {
  const summary = this.getSummary();
  
  await fetch('https://your-webhook.com/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(summary)
  });
}
```

---

## Performance Optimization

### Best Practices

1. **Batch Operations**: Schedule multiple notifications at once
   ```javascript
   // Schedule all habit reminders in one call
   await window.notificationEngine.scheduleDailyHabitReminders();
   ```

2. **Limit Queue Size**: Keep queue under 50 items for optimal performance

3. **Cleanup Regularly**: Old notifications auto-cleanup after 30 days

4. **Monitor Analytics**: Track performance score
   ```javascript
   const score = window.notificationAnalytics.getPerformanceScore();
   // Aim for score > 70
   ```

5. **Use Behavior Insights**: Let system optimize timing automatically

---

## Security Considerations

1. **Validate Input**: Always validate notification data before scheduling

2. **Sanitize Messages**: Prevent XSS in notification content
   ```javascript
   const sanitized = message.replace(/<[^>]*>/g, '');
   ```

3. **Rate Limit API**: Prevent abuse of notification scheduling

4. **Secure FCM Tokens**: Store tokens securely in Firestore with proper rules
   ```javascript
   // Firestore rules
   match /users/{userId}/devices/{deviceId} {
     allow read, write: if request.auth.uid == userId;
   }
   ```

---

## Support & Resources

### Documentation Files
- `NOTIFICATION_SYSTEM_GUIDE.md` - This file
- `FOCUS_BLOCKER_GUIDE.md` - Focus blocker integration
- `BACKGROUND_SYNC_GUIDE.md` - Background sync system

### Module Files
- `www/js/notifications/` - All notification modules

### Firebase Setup
- [Firebase Console](https://console.firebase.google.com)
- [FCM Documentation](https://firebase.google.com/docs/cloud-messaging)

### Capacitor Plugins
- [@capacitor/local-notifications](https://capacitorjs.com/docs/apis/local-notifications)
- [@capacitor/push-notifications](https://capacitorjs.com/docs/apis/push-notifications)

---

## Change Log

### Version 1.0.0 (2024-01-15)
- ✅ Initial release
- ✅ 9 core modules implemented
- ✅ Full documentation
- ✅ Android + Web support
- ✅ Firebase integration
- ✅ Behavior analysis
- ✅ UI components

---

## License

This notification system is part of the Prodify student productivity application.

---

**Created by**: Senior Android + PWA Architect  
**Date**: January 2024  
**Version**: 1.0.0
