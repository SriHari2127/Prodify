# Smart Scheduler - Overview & Integration

## What it does

The Smart Scheduler is an algorithmic planner that schedules study and task blocks by combining:

- User calendar availability
- Study priorities (due dates, subject importance)
- Habit patterns and daily energy curves
- Focus history and session analytics

It outputs suggested study blocks, a prioritized task list for the day, and optimized reminders.

## Core Concepts

- **Block**: A time interval assigned to a task or study session
- **Priority Score**: Computed per task using due date proximity, subject weight, and predicted productivity
- **Energy Curve**: Typical user focus windows during the day inferred from analytics
- **Slot Filling**: Greedy + heuristic backtracking to fit tasks into available slots

## Integration Points

- `smartStudyPlanner.js` - Main planner module
- `todayDashboard.js` - Shows suggested blocks and allows manual acceptance
- `calendar.js` - Reads calendar free/busy slots
- `data.js` / IndexedDB - Source of tasks and habits
- `notificationEngine` - Schedules reminders for planned blocks

## Example Usage

```javascript
// Request plan for next 3 days
const plan = await SmartPlanner.generatePlan({ days: 3, maxDailyHours: 4 });

// Apply today's suggested blocks
await SmartPlanner.applyPlanForDate(new Date());

// Get suggested tasks for the morning energy window
const morningTasks = SmartPlanner.getSuggestions({ window: 'morning' });
```

---

## Tuning Parameters

- `maxDailyHours` — maximum study hours to schedule per day
- `minBlockMinutes` — minimum block size
- `priorityWeight` — weight factor adjusting the influence of due dates
- `energyDecay` — how quickly predicted energy diminishes across the day

---
