# Focus Blocker System - Complete Guide

## Overview

The Focus Blocker system is a comprehensive distraction prevention feature that helps users stay focused during study/work sessions by:

1. **Website Blocking (PWA)** - Blocks access to distracting websites with real-time URL monitoring
2. **Android App Blocking** - Prevents switching to distracting apps via AccessibilityService
3. **Emergency Bypass** - Allows 1-minute emergency access with score penalty
4. **Analytics** - Tracks distraction attempts, focus scores, and session statistics
5. **Customizable Blocklists** - User-configurable website and app blacklists

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────────┐
│                          USER INTERFACE                          │
│  (index.html, focus-warning.html, focusLockMode.js)             │
└─────────────────────────────────────┬───────────────────────────┘
									  │
					┌─────────────────┴─────────────────┐
					│   focusBlocker.js (Core Module)   │
					│  - Website blocking               │
					│  - Session management             │
					│  - Analytics engine               │
					│  - Bypass system                  │
					└─────────────┬──────────┬──────────┘
								  │          │
		 ┌────────────────────────┘          └───────────────────────┐
		 │                                                            │
┌────────▼──────────────┐                              ┌─────────────▼─────────────┐
│  PWA BROWSER ENGINE   │                              │   CAPACITOR BRIDGE         │
│  - URL interception   │                              │  FocusBlockerPlugin.java   │
│  - beforeunload       │                              │  - enableBlocking()        │
│  - Link click block   │                              │  - disableBlocking()       │
│  - window.open block  │                              │  - Event broadcasting      │
└───────────────────────┘                              └─────────────┬──────────────┘
																	 │
											  ┌──────────────────────▼─────────────────┐
											  │  ANDROID ACCESSIBILITY SERVICE          │
											  │  FocusBlockerAccessibilityService.java  │
											  │  - App launch monitoring                │
											  │  - Foreground control                   │
											  │  - SharedPreferences persistence        │
											  └─────────────────────────────────────────┘
```

## Installation & Setup

### 1. Build the Android App

```bash
# Navigate to project root
cd c:\Projects\prodify

# Sync Capacitor
npx cap sync android

# Build the Android app
cd android
./gradlew assembleDebug

# or for release:
./gradlew assembleRelease
```

### 2. Enable Accessibility Service

After installing the app on an Android device:

1. Go to **Settings** → **Accessibility**
2. Find **Prodify Focus Blocker**
3. Toggle ON
4. Accept the permission dialog

**Important:** The accessibility service MUST be manually enabled by the user. This cannot be done programmatically for security reasons.

### 3. Usage Stats Permission (Optional)

For enhanced analytics and app usage tracking:

1. Go to **Settings** → **Apps** → **Special app access** → **Usage access**
2. Find **Prodify**
3. Toggle ON

## JavaScript API

### Initialization

```javascript
// focusBlocker.js automatically initializes on page load
// Listen for initialization complete
if (window.FocusBlocker) {
	console.log('Focus Blocker ready');
}
```

### Start a Focus Session

```javascript
// Listen for focus mode activation event from focusLockMode.js
window.addEventListener('focusModeActivated', (event) => {
	const { duration, task } = event.detail;
    
	// Focus blocker automatically starts blocking
	console.log(`Session started: ${duration}s for task "${task}"`);
});
```

... (full API content remains in original file)

