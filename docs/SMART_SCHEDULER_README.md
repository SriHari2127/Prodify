# 🎓 Smart Study Scheduling Engine

## Overview

A production-grade intelligent study scheduling system that automatically generates optimized daily and weekly study schedules using advanced priority algorithms, exam proximity logic, spaced repetition, and performance analytics.

---

## 🚀 Features

### Core Algorithm Features

#### 1. **Weighted Priority Scoring**
- **Exam Proximity (50% weight)**: Exponential urgency curve
  - <2 days: Intensive mode (100 points)
  - 2-5 days: Mixed practice (80 points)
  - 5-10 days: Coverage phase (60 points)
  - 10-20 days: Regular study (40 points)
  - >20 days: Base priority (20 points)

- **Subject Weakness (30% weight)**: Detects underperforming subjects
  - <30 min/week: Very weak (100 points)
  - 30-60 min/week: Weak (70 points)
  - 60-120 min/week: Below average (40 points)
  - >120 min/week: Sufficient (10 points)

- **Task Urgency (20% weight)**: Due date and priority consideration
  - Overdue: 100 points × priority multiplier
  - Due today: 90 points × priority multiplier
  - Due tomorrow: 70 points × priority multiplier
  - Due in 2-3 days: 50 points × priority multiplier
  - Due in 4-7 days: 30 points × priority multiplier

- **Overdue Penalty**: +200 points for overdue tasks

#### 2. **Smart Session Types**
Based on exam proximity, the engine selects appropriate study methods:

| Days to Exam | Session Type | Duration | Focus |
|-------------|-------------|----------|-------|
| <2 days | Mock Test | 30 min | Intensive revision & testing |
| 2-5 days | Revision | 45 min | Review & consolidation |
| 5-10 days | Practice | 60 min | Problem-solving & exercises |
| >10 days | Deep Work | 90 min | Comprehensive study |
| Anytime | Flash Review | 20 min | Quick recall sessions |

#### 3. **Spaced Repetition System**
Automatic revision scheduling based on cognitive science:
- **Day 1**: Initial review
- **Day 3**: First reinforcement
- **Day 7**: Long-term memory consolidation

#### 4. **Intelligent Study Block Distribution**
- Avoids consecutive sessions of the same subject
- Inserts strategic breaks based on session duration
- Respects daily session limits (max 6 sessions/day)
- Adapts to available study time

#### 5. **Dynamic Break Management**
Break duration adapts to session intensity:
- 90-min sessions → 20-min break
- 60-min sessions → 15-min break
- <60-min sessions → 10-min break

#### 6. **Performance-Based Optimization**
Tracks and adapts to:
- Task completion rates
- Subject focus time history
- Session duration preferences
- Study pattern effectiveness

---

## 📁 File Structure

```
www/
├── js/
│   └── scheduler/
│       ├── studyScheduler.js    # Core scheduling engine (650+ lines)
│       └── scheduleUI.js        # UI rendering module (490+ lines)
├── index.html                    # Added schedule containers
└── style.css                     # Schedule UI styling (450+ lines)
```

---

## 🎨 UI Components

### 1. **Next Session Widget**
- Displays the next recommended study session
- Shows subject, task, duration, and session type
- One-click "Start Session" button (auto-fills focus timer)
- Animated pulse badge for visual appeal

### 2. **Daily Schedule Timeline**
- Chronological list of all study blocks
- Color-coded by subject
- Priority badges (urgent/high-priority visual indicators)
- Exam countdown badges
- Session type labels
- Individual "Start" buttons for each block
- Break blocks with visual distinction

### 3. **Weekly Schedule Modal**
- Calendar-grid view of 7-day schedule
- Summary statistics (total hours, sessions, days)
- Daily breakdown with subject chips
- Highlights today's schedule
- Responsive card layout

### 4. **Empty State UI**
- Friendly prompt when no schedule exists
- "Generate Schedule" button
- Icon-based visual design

---

## ⚙️ Technical Architecture

### Algorithm Flow

```
1. Data Gathering
   ├── Load exams from localStorage
   ├── Load tasks from localStorage
   ├── Load subjects from localStorage
   ├── Load focus session history
   └── Load user preferences

2. Priority Item Creation
   ├── Create exam-based items
   ├── Create task-based items
   └── Create weak-subject items

3. Priority Scoring
   ├── Calculate exam proximity score
   ├── Calculate subject weakness score
   ├── Calculate task urgency score
   ├── Apply overdue penalty
   └── Compute weighted total (0-1000)

4. Sorting & Selection
   ├── Sort items by priority (descending)
   └── Select top priorities for available time

5. Block Generation
   ├── Determine session types
   ├── Allocate durations
   ├── Distribute smartly (avoid repetition)
   └── Insert strategic breaks

6. Spaced Repetition
   ├── Identify completed sessions
   ├── Calculate revision dates (1, 3, 7 days)
   └── Add flash review blocks

7. Caching & Persistence
   ├── Cache in-memory (Map)
   ├── Save to localStorage
   ├── Sync to Firestore
   └── Set 15-minute expiry

8. Event Dispatch
   └── Emit 'scheduleGenerated' event
```

### Caching Strategy

**Three-tier caching system for optimal performance:**

1. **In-Memory Cache (Map)**
   - Instant retrieval
   - 15-minute expiry
   - Cleared on logout

2. **localStorage**
   - Persists across browser sessions
   - Fallback if in-memory cleared
   - JSON serialization

3. **Firestore**
   - Cloud backup
   - Multi-device sync
   - Server timestamp tracking

### Debouncing System

Prevents excessive recalculations:
- **3-second delay** before recalculation
- Triggers reset on each new data change
- Ensures smooth UX without performance hit

---

## 🔄 Event-Driven Recalculation

The scheduler automatically regenerates when:

| Event | Trigger | Reason |
|-------|---------|--------|
| `examAdded` | New exam created | Update priorities |
| `examDeleted` | Exam removed | Rebalance schedule |
| `examUpdated` | Exam date/details changed | Adjust proximity scores |
| `taskAdded` | New task created | Add to priority queue |
| `taskCompleted` | Task marked done | Remove from schedule |
| `taskDeleted` | Task removed | Rebalance schedule |
| `focusSessionComplete` | Study session finished | Update performance data |
| `subjectAdded` | New subject added | Include in planning |
| `subjectUpdated` | Subject modified | Refresh calculations |
| Auth state change | User login/logout | Load/clear user schedule |

---

## 📊 Data Structures

### Schedule Object
```javascript
{
  date: "2025-01-15",
  generatedAt: "2025-01-15T10:30:00.000Z",
  totalMinutes: 300,
  sessionCount: 5,
  blocks: [
    {
      id: "block_1737801000123",
      subjectId: "math_001",
      subjectName: "Calculus",
      type: "deepWork",
      duration: 90,
      task: "Integration techniques",
      priorityScore: 850,
      examDate: "2025-01-20",
      color: "#6366f1",
      timestamp: 1737801000123
    },
    {
      id: "block_1737801000124",
      type: "break",
      duration: 20
    }
    // ... more blocks
  ],
  metadata: {
    priorityItems: 12,
    availableMinutes: 360,
    algorithm: "weighted-priority-v1"
  }
}
```

### Study Block Types
```javascript
{
  deepWork: 90,      // Comprehensive study
  practice: 60,      // Problem-solving
  revision: 45,      // Review & consolidation
  mockTest: 30,      // Timed testing
  flashReview: 20    // Quick recall
}
```

---

## 🎯 Configuration

### Customizable Parameters (CONFIG object)

```javascript
{
  weights: {
    examProximity: 0.5,    // 50% weight
    subjectWeakness: 0.3,  // 30% weight
    taskUrgency: 0.2       // 20% weight
  },
  
  sessionDurations: {
    deepWork: 90,
    practice: 60,
    revision: 45,
    mockTest: 30,
    flashReview: 20
  },
  
  breaks: {
    short: 10,
    medium: 15,
    long: 20
  },
  
  examThresholds: {
    intensive: 2,    // <2 days: mock tests
    mixed: 5,        // 2-5 days: revision
    coverage: 10     // 5-10 days: practice
  },
  
  revisionIntervals: [1, 3, 7],  // Days
  weakSubjectThreshold: 30,       // Minutes/week
  cacheExpiry: 900000,            // 15 minutes
  maxSessionsPerDay: 6,
  defaultStudyHours: 6
}
```

---

## 💻 API Reference

### Public Methods

#### `StudyScheduler.init()`
Initialize the scheduler engine and load cached schedules.
```javascript
await StudyScheduler.init();
```

#### `StudyScheduler.generateDailySchedule(date, options)`
Generate optimized schedule for a specific date.
```javascript
const schedule = await StudyScheduler.generateDailySchedule('2025-01-15', {
  forceRefresh: true,
  studyHours: 8
});
```

**Parameters:**
- `date` (string, optional): Target date in YYYY-MM-DD format (defaults to today)
- `options` (object, optional):
  - `forceRefresh` (boolean): Bypass cache
  - `studyHours` (number): Override default study hours

**Returns:** Schedule object

#### `StudyScheduler.generateWeeklySchedule(startDate)`
Generate schedules for 7 consecutive days.
```javascript
const weekSchedule = await StudyScheduler.generateWeeklySchedule('2025-01-15');
```

**Returns:**
```javascript
{
  startDate: "2025-01-15",
  endDate: "2025-01-21",
  days: [/* 7 schedule objects */],
  totalMinutes: 2100,
  totalSessions: 35
}
```

#### `StudyScheduler.getCurrentSchedule()`
Get the currently cached schedule without regeneration.
```javascript
const currentSchedule = StudyScheduler.getCurrentSchedule();
```

#### `StudyScheduler.scheduleRecalculation(delay)`
Trigger debounced recalculation.
```javascript
StudyScheduler.scheduleRecalculation(5000); // 5-second delay
```

### UI Methods

#### `ScheduleUI.init()`
Initialize UI event listeners.
```javascript
ScheduleUI.init();
```

#### `ScheduleUI.renderTodaySchedule()`
Render full daily schedule on dashboard.
```javascript
await ScheduleUI.renderTodaySchedule();
```

#### `ScheduleUI.renderNextSession()`
Render "Next Up" widget.
```javascript
ScheduleUI.renderNextSession();
```

#### `ScheduleUI.showWeeklyView()`
Open weekly schedule modal.
```javascript
await ScheduleUI.showWeeklyView();
```

#### `ScheduleUI.startSession(blockId)`
Pre-fill focus timer and start session.
```javascript
ScheduleUI.startSession('block_1737801000123');
```

#### `ScheduleUI.refreshSchedule()`
Force schedule regeneration with visual feedback.
```javascript
await ScheduleUI.refreshSchedule();
```

---

## 🔌 Integration Points

### 1. **Focus Timer Integration**
When "Start Session" is clicked:
1. Switch to Academics tab
2. Pre-fill timer duration from block
3. Pre-select subject from block
4. Auto-start timer (optional)

### 2. **Task Manager Integration**
- Reads pending tasks for priority calculation
- Filters completed tasks
- Respects due dates and priorities

### 3. **Exams Integration**
- Reads upcoming exams
- Calculates proximity scores
- Determines session types

### 4. **Subject Management Integration**
- Loads subject colors and names
- Tracks focus time per subject
- Identifies weak subjects

### 5. **Performance Analytics Integration**
- Tracks focus session history
- Calculates completion rates
- Adapts to study patterns

---

## 📱 Responsive Design

**Mobile Optimizations:**
- Stacked timeline layout
- Touch-friendly button sizes
- Simplified weekly view (1 column)
- Collapsible sections
- Reduced padding on small screens

**Breakpoint:** 768px

---

## 🎨 Visual Design

### Color System
- Subject colors dynamically applied to blocks
- Urgency indicators:
  - Red border: Urgent (priority ≥700)
  - Orange border: High priority (priority ≥400)
- Accent color for CTAs and highlights

### Typography
- Font family: Jost (Google Fonts)
- Title: 18px, semi-bold
- Body: 14px, regular
- Badges: 11-13px, bold

### Animations
- Fade-in on render
- Pulse animation on "Next Up" badge
- Hover lift effects on cards
- Smooth button transitions

---

## 🔒 Privacy & Security

- **Local-First**: All calculations happen client-side
- **Optional Cloud Sync**: Firestore backup is opt-in
- **No External APIs**: Fully self-contained
- **User Data Control**: Delete schedules anytime

---

## 🐛 Error Handling

### Graceful Degradation
- Empty state UI when no data available
- Fallback to default values on parse errors
- Console warnings for non-critical failures
- User-friendly error messages

### Logging
- Console logs for major operations
- Emoji-prefixed for easy scanning:
  - 📅 Initialization
  - 🔄 Generation
  - ✅ Success
  - ❌ Errors
  - 📋 Cache hits

---

## 📈 Performance Metrics

### Optimization Techniques
1. **Caching**: 15-minute in-memory cache
2. **Debouncing**: 3-second recalculation delay
3. **Lazy Loading**: Only generate when needed
4. **Event Throttling**: Batch related updates

### Expected Performance
- Schedule generation: <100ms
- UI rendering: <50ms
- Cache retrieval: <5ms
- Weekly schedule: <500ms

---

## 🧪 Testing Checklist

### Manual Testing
- [ ] Create exam → Verify new block appears
- [ ] Complete task → Verify schedule updates
- [ ] Add subject → Verify included in weak subjects
- [ ] Finish focus session → Verify spaced repetition
- [ ] Change study hours → Verify adjusted blocks
- [ ] Click "Start Session" → Verify timer pre-fill
- [ ] View weekly schedule → Verify 7-day grid
- [ ] Refresh schedule → Verify regeneration
- [ ] Logout/login → Verify cache clears/loads

### Edge Cases
- [ ] No exams/tasks → Empty state UI
- [ ] All tasks completed → Weak subjects only
- [ ] <20 min available → No blocks generated
- [ ] Past exams → Filtered out
- [ ] Overdue tasks → High priority placement

---

## 🚀 Future Enhancements

### Planned Features
1. **IndexedDB Caching**: Enhanced offline support
2. **Time-of-Day Optimization**: Morning/evening preferences
3. **Energy Level Mapping**: Match task difficulty to peak hours
4. **Pomodoro Integration**: Built-in break timer
5. **Study Streak Tracking**: Consistency rewards
6. **Subject Difficulty Weighting**: Harder subjects get more time
7. **Goal-Based Planning**: Reverse-schedule from target scores
8. **Adaptive Learning**: ML-based schedule optimization
9. **Notification System**: Reminders for upcoming sessions
10. **Export to Calendar**: iCal/Google Calendar sync

### Known Limitations
- Single-user focus (no collaborative scheduling)
- Manual study hour input (no auto-detection)
- Basic conflict resolution (timestamp-based)
- No timezone handling (uses local time)

---

## 📚 Usage Examples

### Example 1: Basic Daily Schedule
```javascript
// Generate schedule for today
const schedule = await StudyScheduler.generateDailySchedule();

// Display on dashboard
await ScheduleUI.renderTodaySchedule();
ScheduleUI.renderNextSession();
```

### Example 2: Custom Study Hours
```javascript
// 8-hour study day
const schedule = await StudyScheduler.generateDailySchedule('2025-01-15', {
  studyHours: 8
});
```

### Example 3: Weekly Planning
```javascript
// Plan entire week
const weekSchedule = await StudyScheduler.generateWeeklySchedule();

// Display in modal
await ScheduleUI.showWeeklyView();
```

### Example 4: Manual Recalculation
```javascript
// Force immediate refresh
await StudyScheduler.generateDailySchedule(undefined, { forceRefresh: true });
```

### Example 5: Listen for Schedule Changes
```javascript
document.addEventListener('scheduleGenerated', (e) => {
  const schedule = e.detail;
  console.log(`New schedule: ${schedule.sessionCount} sessions`);
  updateDashboardSummary(schedule);
});
```

---

## 🙌 Credits

**Algorithm Design**: Weighted priority scoring with exponential urgency curves  
**Spaced Repetition**: Based on Ebbinghaus forgetting curve research  
**UI/UX**: Material Design principles with custom Prodify theme  
**Performance**: Debouncing and caching best practices  

---

## 📝 Version History

### v1.0.0 (2025-01-15)
- ✅ Initial release
- ✅ Weighted priority algorithm
- ✅ Exam proximity logic
- ✅ Spaced repetition system
- ✅ Smart session type selection
- ✅ Break management
- ✅ Weekly schedule generation
- ✅ Responsive UI components
- ✅ Firestore sync
- ✅ Event-driven recalculation
- ✅ Cache layer with 15-min expiry
- ✅ Empty state handling
- ✅ Focus timer integration

---

## 🤝 Contributing

To modify the scheduler:

1. **Adjust Weights**: Edit `CONFIG.weights` in studyScheduler.js
2. **Change Session Durations**: Modify `CONFIG.sessionDurations`
3. **Alter Exam Thresholds**: Update `CONFIG.examThresholds`
4. **Add Session Types**: 
   - Add to `determineSessionType()`
   - Update `CONFIG.sessionDurations`
   - Add icon in `scheduleUI.js`
5. **Customize UI**: Edit styles in style.css under "SMART STUDY SCHEDULE STYLES"

---

## 📞 Support

For issues or questions:
- Review console logs (look for 📅 🔄 ✅ ❌ emojis)
- Check localStorage for cached data
- Verify Firestore connection
- Clear cache with `localStorage.removeItem('schedule_YYYY-MM-DD')`

---

**🎓 Study Smart, Not Hard!**
