// ===== FOCUS LOCK MODE MODULE =====
// Provides distraction-free environment during focus sessions

const FocusLockMode = (function() {
    'use strict';

    let isLocked = false;
    let sessionStartTime = null;
    let focusStreak = 0;
    let currentSessionDuration = 0;
    let currentTask = null;
    let earlyExitAttempts = 0;

    // Load streak from localStorage
    function loadStreak() {
        try {
            const saved = localStorage.getItem('focusStreak');
            if (saved) {
                const data = JSON.parse(saved);
                const lastSession = new Date(data.lastSession);
                const now = new Date();
                const hoursDiff = (now - lastSession) / (1000 * 60 * 60);
                
                // Reset streak if more than 48 hours since last session
                if (hoursDiff > 48) {
                    focusStreak = 0;
                } else {
                    focusStreak = data.streak || 0;
                }
            }
        } catch (e) {
            focusStreak = 0;
        }
    }

    // Save streak to localStorage
    function saveStreak() {
        try {
            localStorage.setItem('focusStreak', JSON.stringify({
                streak: focusStreak,
                lastSession: new Date().toISOString()
            }));
        } catch (e) {
            console.error('Error saving focus streak:', e);
        }
    }

    // Initialize
    function init() {
        loadStreak();
        createFocusModeUI();
        setupEventListeners();
        
        // Check if returning to an active session
        const savedState = getSavedSessionState();
        if (savedState && savedState.isActive) {
            // Resume session
            const elapsed = Math.floor((Date.now() - savedState.startTime) / 1000);
            const remaining = savedState.duration - elapsed;
            if (remaining > 0) {
                activateFocusMode(remaining, savedState.task);
            } else {
                clearSavedSessionState();
            }
        }
    }

    // Create Focus Mode UI elements
    function createFocusModeUI() {
        // Distraction Blocker Modal
        const blocker = document.createElement('div');
        blocker.id = 'focusBlockerModal';
        blocker.className = 'modal-overlay';
        blocker.style.display = 'none';
        blocker.innerHTML = `
            <div class="modal-box focus-blocker-box">
                <div class="focus-blocker__icon">
                    <i class="fa-solid fa-lock"></i>
                </div>
                <h3>Focus Mode is Active</h3>
                <p>Finish your session to unlock the app.</p>
                <div class="focus-blocker__timer" id="blockerTimerDisplay">15:30 remaining</div>
                <button class="auth-btn" onclick="FocusLockMode.closeBlocker()">Continue Focusing</button>
            </div>
        `;
        document.body.appendChild(blocker);

        // Early Exit Warning Modal
        const exitWarning = document.createElement('div');
        exitWarning.id = 'focusExitWarningModal';
        exitWarning.className = 'modal-overlay';
        exitWarning.style.display = 'none';
        exitWarning.innerHTML = `
            <div class="modal-box focus-exit-box">
                <div class="focus-exit__icon">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>
                <h3>Quit Focus Mode?</h3>
                <p>You still have <span id="exitRemainingTime">0</span> minutes remaining.</p>
                <p class="focus-exit__warning">⚠️ Leaving will break your focus streak!</p>
                <div class="modal-actions">
                    <button class="auth-btn" onclick="FocusLockMode.cancelExit()">Continue Focus</button>
                    <button class="auth-btn secondary-btn" onclick="FocusLockMode.confirmExit()">Quit Anyway</button>
                </div>
            </div>
        `;
        document.body.appendChild(exitWarning);

        // Session Complete Summary Modal
        const summary = document.createElement('div');
        summary.id = 'focusSessionSummary';
        summary.className = 'modal-overlay';
        summary.style.display = 'none';
        summary.innerHTML = `
            <div class="modal-box focus-summary-box">
                <div class="focus-summary__header">
                    <div class="focus-summary__icon">🎉</div>
                    <h3>Focus Session Complete!</h3>
                </div>
                <div class="focus-summary__stats">
                    <div class="focus-summary__stat">
                        <div class="focus-summary__stat-icon"><i class="fa-solid fa-clock"></i></div>
                        <div class="focus-summary__stat-value" id="summaryDuration">25 min</div>
                        <div class="focus-summary__stat-label">Duration</div>
                    </div>
                    <div class="focus-summary__stat">
                        <div class="focus-summary__stat-icon"><i class="fa-solid fa-fire"></i></div>
                        <div class="focus-summary__stat-value" id="summaryStreak">5</div>
                        <div class="focus-summary__stat-label">Streak</div>
                    </div>
                    <div class="focus-summary__stat">
                        <div class="focus-summary__stat-icon"><i class="fa-solid fa-star"></i></div>
                        <div class="focus-summary__stat-value" id="summaryXP">+15 XP</div>
                        <div class="focus-summary__stat-label">Earned</div>
                    </div>
                </div>
                <div class="focus-summary__task" id="summaryTask"></div>
                <div class="focus-summary__break">
                    <p>💡 Great work! Take a short break.</p>
                </div>
                <div class="focus-summary__next" id="summaryNextTask"></div>
                <div class="modal-actions">
                    <button class="auth-btn secondary-btn" onclick="FocusLockMode.returnToDashboard()">Return to Dashboard</button>
                    <button class="auth-btn" onclick="FocusLockMode.startAnotherSession()">Another Session</button>
                </div>
            </div>
        `;
        document.body.appendChild(summary);
    }

    // Setup event listeners
    function setupEventListeners() {
        // Intercept locked tabs
        document.addEventListener('click', handleTabClick, true);
    }

    // Handle tab clicks to block locked sections
    function handleTabClick(e) {
        if (!isLocked) return;

        const tabBtn = e.target.closest('.tab-btn, .sidebar-tab-item');
        if (!tabBtn) return;

        const tabId = tabBtn.getAttribute('data-tab');
        
        // Allow access to: Focus Timer (academics) and Today's Study Plan (today)
        const allowedTabs = ['today', 'academics'];
        
        if (tabId && !allowedTabs.includes(tabId)) {
            e.preventDefault();
            e.stopPropagation();
            showBlocker();
        }
    }

    // Activate Focus Lock Mode
    function activateFocusMode(durationSeconds, task = null) {
        isLocked = true;
        sessionStartTime = Date.now();
        currentSessionDuration = durationSeconds;
        currentTask = task;
        earlyExitAttempts = 0;

        // Save session state
        saveSessionState();

        // Apply visual effects
        document.body.classList.add('focus-mode-active');

        // Lock UI elements
        lockUIElements();

        // Start progress timer
        startProgressTimer();

        // Dispatch event for focus blocker
        window.dispatchEvent(new CustomEvent('focusModeActivated', {
            detail: {
                duration: durationSeconds,
                task: task,
                startTime: sessionStartTime
            }
        }));

        // Notify user
        if (typeof Notify !== 'undefined') {
            Notify.info('🔒 Focus Mode activated. Stay focused!');
        }
    }

    // Deactivate Focus Lock Mode
    function deactivateFocusMode(completed = false) {
        isLocked = false;
        const endTime = Date.now();
        const sessionDuration = sessionStartTime ? (endTime - sessionStartTime) / 1000 : 0;
        sessionStartTime = null;
        currentTask = null;

        // Clear saved state
        clearSavedSessionState();

        // Remove visual effects
        document.body.classList.remove('focus-mode-active');

        // Unlock UI elements
        unlockUIElements();

        // Stop progress timer
        stopProgressTimer();

        // Dispatch event for focus blocker
        window.dispatchEvent(new CustomEvent('focusModeDeactivated', {
            detail: {
                completed: completed,
                duration: sessionDuration,
                endTime: endTime
            }
        }));

        if (completed) {
            // Increment streak
            focusStreak++;
            saveStreak();

            // Show summary
            showSessionSummary();
        } else {
            // Break streak
            if (focusStreak > 0 && typeof Notify !== 'undefined') {
                Notify.warning(`Focus streak broken! Was at ${focusStreak} sessions.`);
            }
            focusStreak = 0;
            saveStreak();
        }
    }

    // Lock UI elements
    function lockUIElements() {
        // Disable certain buttons and inputs
        const lockedSelectors = [
            '#addBtn',
            '#addHabitBtn',
            '.task-filters__btn',
            '.habit-header',
            '#profileBtn'
        ];

        lockedSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                el.classList.add('focus-locked');
                el.style.pointerEvents = 'none';
                el.style.opacity = '0.5';
            });
        });

        // Add lock icons to locked tabs
        const lockedTabs = ['tasks', 'habits', 'settings', 'analytics', 'mind', 'physical'];
        lockedTabs.forEach(tabId => {
            const tabItems = document.querySelectorAll(`[data-tab="${tabId}"]`);
            tabItems.forEach(item => {
                if (!item.querySelector('.tab-lock-icon')) {
                    const lockIcon = document.createElement('i');
                    lockIcon.className = 'fa-solid fa-lock tab-lock-icon';
                    lockIcon.style.marginLeft = '6px';
                    lockIcon.style.fontSize = '11px';
                    lockIcon.style.opacity = '0.7';
                    item.appendChild(lockIcon);
                }
                item.classList.add('focus-locked');
            });
        });
    }

    // Unlock UI elements
    function unlockUIElements() {
        // Re-enable elements
        const locked = document.querySelectorAll('.focus-locked');
        locked.forEach(el => {
            el.classList.remove('focus-locked');
            el.style.pointerEvents = '';
            el.style.opacity = '';
        });

        // Remove lock icons
        const lockIcons = document.querySelectorAll('.tab-lock-icon');
        lockIcons.forEach(icon => icon.remove());
    }

    // Progress timer
    let progressInterval = null;

    function startProgressTimer() {
        updateProgressDisplay();
        progressInterval = setInterval(updateProgressDisplay, 1000);
    }

    function stopProgressTimer() {
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
    }

    function updateProgressDisplay() {
        if (!isLocked || !sessionStartTime) return;

        const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
        const remaining = Math.max(0, currentSessionDuration - elapsed);

        // Update session timer state
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;

        // Check if session complete
        if (remaining <= 0) {
            stopProgressTimer();
            completeSession();
        }
    }

    // Show blocker modal
    function showBlocker() {
        const modal = document.getElementById('focusBlockerModal');
        if (!modal) return;

        // Update remaining time
        const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
        const remaining = Math.max(0, currentSessionDuration - elapsed);
        const mins = Math.ceil(remaining / 60);
        
        const display = document.getElementById('blockerTimerDisplay');
        if (display) {
            display.textContent = `${mins} minute${mins !== 1 ? 's' : ''} remaining`;
        }

        modal.style.display = 'flex';
    }

    function closeBlocker() {
        const modal = document.getElementById('focusBlockerModal');
        if (modal) modal.style.display = 'none';
    }

    // Show exit warning
    function showExitWarning() {
        earlyExitAttempts++;

        const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
        const remaining = Math.max(0, currentSessionDuration - elapsed);
        const mins = Math.ceil(remaining / 60);

        const remainingEl = document.getElementById('exitRemainingTime');
        if (remainingEl) {
            remainingEl.textContent = mins;
        }

        const modal = document.getElementById('focusExitWarningModal');
        if (modal) modal.style.display = 'flex';
    }

    function cancelExit() {
        const modal = document.getElementById('focusExitWarningModal');
        if (modal) modal.style.display = 'none';
    }

    function confirmExit() {
        const modal = document.getElementById('focusExitWarningModal');
        if (modal) modal.style.display = 'none';

        deactivateFocusMode(false); // Not completed
        
        // Actually pause the timer by setting bypass flag and clicking pause
        if (window.focusTimerState) {
            window.focusTimerState.bypassExitWarning = true;
        }
        
        // Click the pause button 
        const pauseBtn = document.getElementById('focusTimerPause');
        if (pauseBtn && pauseBtn.style.display !== 'none') {
            pauseBtn.click();
        }
    }

    // Complete session
    function completeSession() {
        const duration = currentSessionDuration;
        const durationMins = Math.round(duration / 60);

        // Calculate XP reward
        let xpReward = 0;
        if (durationMins >= 90) xpReward = 40;
        else if (durationMins >= 50) xpReward = 20;
        else if (durationMins >= 25) xpReward = 15;
        else xpReward = Math.floor(durationMins / 2);

        // Award XP
        if (typeof XPSystem !== 'undefined') {
            XPSystem.awardXP(xpReward, 'Focus session completed');
        }

        // Deactivate and show summary
        deactivateFocusMode(true);
    }

    // Show session summary
    function showSessionSummary() {
        const durationMins = Math.round(currentSessionDuration / 60);
        let xpReward = 0;
        if (durationMins >= 90) xpReward = 40;
        else if (durationMins >= 50) xpReward = 20;
        else if (durationMins >= 25) xpReward = 15;
        else xpReward = Math.floor(durationMins / 2);

        // Update summary content
        document.getElementById('summaryDuration').textContent = `${durationMins} min`;
        document.getElementById('summaryStreak').textContent = focusStreak;
        document.getElementById('summaryXP').textContent = `+${xpReward} XP`;

        // Show task
        const taskEl = document.getElementById('summaryTask');
        if (taskEl) {
            if (currentTask) {
                taskEl.innerHTML = `<p><strong>Task:</strong> ${currentTask}</p>`;
                taskEl.style.display = 'block';
            } else {
                taskEl.style.display = 'none';
            }
        }

        // Get next suggestion from Smart Study Planner
        const nextTaskEl = document.getElementById('summaryNextTask');
        if (nextTaskEl && typeof SmartStudyPlanner !== 'undefined') {
            const suggestions = SmartStudyPlanner.generateSuggestions();
            if (suggestions && suggestions.length > 0) {
                const next = suggestions[0];
                nextTaskEl.innerHTML = `
                    <div class="focus-next-task">
                        <h4>Next Suggestion:</h4>
                        <div class="focus-next-task__card">
                            <i class="fa-solid ${next.icon}"></i>
                            <span>${next.title}</span>
                        </div>
                    </div>
                `;
                nextTaskEl.style.display = 'block';
            } else {
                nextTaskEl.style.display = 'none';
            }
        }

        // Show modal
        const modal = document.getElementById('focusSessionSummary');
        if (modal) modal.style.display = 'flex';
    }

    // Return to dashboard
    function returnToDashboard() {
        const modal = document.getElementById('focusSessionSummary');
        if (modal) modal.style.display = 'none';

        if (typeof switchTab === 'function') {
            switchTab('today');
        }

        // Refresh dashboard
        if (typeof TodayDashboard !== 'undefined' && TodayDashboard.renderAll) {
            TodayDashboard.renderAll();
        }
    }

    // Start another session
    function startAnotherSession() {
        const modal = document.getElementById('focusSessionSummary');
        if (modal) modal.style.display = 'none';

        if (typeof switchTab === 'function') {
            switchTab('academics');
        }

        // Scroll to timer
        setTimeout(() => {
            const timer = document.getElementById('focusTimerDisplay');
            if (timer) {
                timer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 300);
    }

    // Session state persistence
    function saveSessionState() {
        try {
            localStorage.setItem('focusSessionState', JSON.stringify({
                isActive: isLocked,
                startTime: sessionStartTime,
                duration: currentSessionDuration,
                task: currentTask
            }));
        } catch (e) {
            console.error('Error saving session state:', e);
        }
    }

    function getSavedSessionState() {
        try {
            const saved = localStorage.getItem('focusSessionState');
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            return null;
        }
    }

    function clearSavedSessionState() {
        try {
            localStorage.removeItem('focusSessionState');
        } catch (e) {}
    }

    // Manual activate (for testing or manual mode)
    function manualActivate(minutes = 25) {
        activateFocusMode(minutes * 60);
    }

    // Public API
    return {
        init,
        activateFocusMode,
        deactivateFocusMode,
        isActive: () => isLocked,
        getStreak: () => focusStreak,
        showBlocker,
        closeBlocker,
        showExitWarning,
        cancelExit,
        confirmExit,
        returnToDashboard,
        startAnotherSession,
        manualActivate
    };
})();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    FocusLockMode.init();
});

// Export globally
window.FocusLockMode = FocusLockMode;
