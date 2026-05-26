# 🤖 AI Study Coach System - Complete Documentation

## Overview

The AI Study Coach is an intelligent, behavior-driven study assistance system that analyzes user productivity patterns and provides personalized recommendations, predictions, and motivational feedback.

## System Architecture

```
ai-coach/
├── aiCoachEngine.js           # Core orchestrator
├── behaviorAnalyzer.js        # Historical data analysis
├── weakSubjectDetector.js     # Subject weakness identification
├── studyRecommendationEngine.js  # Recommendation generator
├── productivityPredictor.js   # Statistical forecasting
├── examPreparationAdvisor.js  # Exam strategy generator
├── studyPatternAnalyzer.js    # Pattern detection
├── motivationGenerator.js     # Motivational messaging
├── coachUIRenderer.js         # UI rendering
└── testDataGenerator.js       # Test data generation
```

## Core Features

### 1. **Behavior Analysis Engine**
- Analyzes 30 days of historical data
- Calculates key metrics:
	- Weekly study hours
	- Task completion rate
	- Habit consistency
	- Focus success rate
	- Subject distribution
	- Daily productivity trends
	- Week-over-week comparisons

### 2. **Weak Subject Detection**
- Identifies subjects needing attention
- Uses weakness score algorithm:
	```
	weaknessScore = (expectedTime - actualTime) / expectedTime
	```
- Priority levels: Critical, High, Medium, Low
- Considers exam proximity for urgency

### 3. **Study Recommendation Engine**
- Generates actionable recommendations based on:
	- Weak subjects
	- Upcoming exams
	- Task backlog
	- Habit streaks
	- Focus patterns
	- Study balance
	- Consistency
- Prioritizes by urgency (critical → high → medium → low)

### 4. **Productivity Predictor**
- Predicts expected study hours for next week
- Forecasts focus session success probability
- Estimates task completion likelihood
- Identifies most productive days
- Uses moving averages and trend analysis
- Provides confidence levels (high/medium/low)

### 5. **Exam Preparation Advisor**
- Generates time-based strategies:
	- **Exam Day**: Quick review only
	- **1 Day Before**: Intensive final prep
	- **2-3 Days**: Practice tests
	- **4-7 Days**: Active revision
	- **8-14 Days**: Structured preparation
	- **15-21 Days**: Early foundation building
- Assesses readiness based on recent study time
- Provides specific activities and tips

### 6. **Study Pattern Analyzer**
- Detects patterns in:
	- **Time of Day**: Most productive hours
	- **Session Duration**: Optimal session length
	- **Weekly Consistency**: Study regularity
	- **Subject Performance**: Best/worst subjects
	- **Study Streaks**: Current and longest streaks

### 7. **Motivation Generator**
- Creates personalized motivational messages
- Categories:
	- Achievements (study hours, tasks, focus)
	- Improvements (week-over-week growth)
	- Encouragement (general motivation)
	- Milestones (significant goals reached)
	- Consistency (habit streaks)

### 8. **AI Coach UI Renderer**
- Beautiful, responsive dashboard
- Interactive cards for each insight type
- Real-time updates
- Auto-refresh every 5 minutes
- Priority-based color coding

## Integration Guide

### Step 1: Add Script References

Add these scripts to your `index.html` **before** the closing `</body>` tag:

```html
<!-- AI Coach System -->
<script src="js/ai-coach/behaviorAnalyzer.js"></script>
<script src="js/ai-coach/weakSubjectDetector.js"></script>
<script src="js/ai-coach/productivityPredictor.js"></script>
<script src="js/ai-coach/examPreparationAdvisor.js"></script>
<script src="js/ai-coach/studyPatternAnalyzer.js"></script>
<script src="js/ai-coach/motivationGenerator.js"></script>
<script src="js/ai-coach/studyRecommendationEngine.js"></script>
<script src="js/ai-coach/aiCoachEngine.js"></script>
<script src="js/ai-coach/coachUIRenderer.js"></script>

<!-- Optional: Test Data Generator (remove in production) -->
<script src="js/ai-coach/testDataGenerator.js"></script>
```

### Step 2: Add CSS Styles

Add the AI Coach stylesheet to your `<head>`:

```html
<link rel="stylesheet" href="css/ai-coach.css">
```

### Step 3: Create Dashboard Container

Add a container element where the AI Coach dashboard will render:

```html
<div id="aiCoachDashboard"></div>
```

You can place this in a dedicated tab, page, or modal in your app.

### Step 4: Trigger Events

The AI Coach automatically recalculates insights when these events are dispatched:

```javascript
// After completing a focus session
document.dispatchEvent(new Event('focusSessionCompleted'));

// After completing a task
document.dispatchEvent(new Event('taskCompleted'));

// After updating a habit
document.dispatchEvent(new Event('habitUpdated'));

// After adding an exam
document.dispatchEvent(new Event('examAdded'));
```

Add these events to your existing functions:

```javascript
// Example: After focus session completes
function completeFocusSession() {
		// Your existing code...
    
		// Dispatch event for AI Coach
		document.dispatchEvent(new Event('focusSessionCompleted'));
}
```

### Step 5: Manual Rendering (Optional)

You can manually trigger dashboard rendering:

```javascript
// Render the dashboard
CoachUIRenderer.renderDashboard();

// Force refresh AI Coach data
AICoachEngine.recalculateInsights('manual_refresh');
```

## API Reference

### AICoachEngine

```javascript
// Initialize the engine (auto-initializes on page load)
AICoachEngine.init();

// Get current coach data (uses cache if valid)
const data = AICoachEngine.getCoachData();

// Force recalculation
```
