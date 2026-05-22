/**
 * PREMIUM INTERACTIONS ENGINE
 * Handles micro-interactions, celebrations, and delightful animations
 */

const PremiumInteractions = (function() {
    'use strict';

    // ============================================================
    // TASK COMPLETION ANIMATIONS
    // ============================================================
    
    function animateTaskCompletion(taskElement, xpEarned = 10) {
        if (!taskElement) return;

        // Add completing animation
        taskElement.classList.add('task-completing');
        
        // Find and animate checkbox
        const checkbox = taskElement.querySelector('.checkbox-icon');
        if (checkbox) {
            checkbox.classList.add('completing');
        }

        // Trigger haptic feedback
        if (window.HapticFeedback) {
            HapticFeedback.taskComplete();
        }

        // Show XP counter animation
        setTimeout(() => {
            showXPCounter(taskElement, xpEarned);
        }, 150);

        // Fade out after animation
        setTimeout(() => {
            taskElement.classList.remove('task-completing');
            if (checkbox) checkbox.classList.remove('completing');
        }, 250);
    }

    // ============================================================
    // HABIT COMPLETION ANIMATIONS
    // ============================================================
    
    function animateHabitCompletion(habitElement, streakCount) {
        if (!habitElement) return;

        // Add habit completing animation
        habitElement.classList.add('habit-completing');

        // Find and animate streak icon
        const streakIcon = habitElement.querySelector('.streak-icon');
        if (streakIcon) {
            streakIcon.classList.add('pulse');
            setTimeout(() => streakIcon.classList.remove('pulse'), 500);
        }

        // Trigger haptic feedback
        if (window.HapticFeedback) {
            HapticFeedback.habitComplete();
        }

        // Show streak celebration for milestones
        if (streakCount % 7 === 0 && streakCount > 0) {
            setTimeout(() => {
                showStreakMilestone(streakCount);
            }, 300);
        }

        // Remove animation class
        setTimeout(() => {
            habitElement.classList.remove('habit-completing');
        }, 300);
    }

    // ============================================================
    // FOCUS SESSION COMPLETION
    // ============================================================
    
    function animateFocusCompletion(sessionMinutes, xpEarned) {
        // Trigger haptic feedback
        if (window.HapticFeedback) {
            HapticFeedback.focusComplete();
        }

        // Show celebration overlay
        const overlay = document.createElement('div');
        overlay.className = 'focus-celebration-overlay';
        overlay.innerHTML = `
            <div class="celebration-modal">
                <div class="celebration-modal__icon">🎯</div>
                <div class="celebration-modal__title">Focus Complete!</div>
                <div class="celebration-modal__subtitle">${sessionMinutes} minutes of deep work</div>
                <div class="celebration-modal__reward">+${xpEarned} XP</div>
                <button class="celebration-modal__button" onclick="PremiumInteractions.closeCelebration()">
                    Continue
                </button>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Show confetti
        createConfetti();
        
        // Auto-close after 4 seconds
        setTimeout(() => {
            closeCelebration();
        }, 4000);
    }

    // ============================================================
    // GAMIFICATION CELEBRATIONS
    // ============================================================
    
    function showBadgeUnlock(badgeName, badgeIcon, badgeDescription) {
        // Trigger haptic feedback
        if (window.HapticFeedback) {
            HapticFeedback.badgeUnlock();
        }

        const overlay = document.createElement('div');
        overlay.className = 'focus-celebration-overlay';
        overlay.innerHTML = `
            <div class="celebration-modal">
                <div class="celebration-modal__icon badge-unlock-flash">${badgeIcon}</div>
                <div class="celebration-modal__title">Badge Unlocked!</div>
                <div class="celebration-modal__subtitle">${badgeName}</div>
                <p style="color: var(--text-secondary); margin-top: 8px;">${badgeDescription}</p>
                <button class="celebration-modal__button" onclick="PremiumInteractions.closeCelebration()">
                    Awesome!
                </button>
            </div>
        `;
        
        document.body.appendChild(overlay);
        createConfetti();
        
        setTimeout(() => closeCelebration(), 5000);
    }

    function showLevelUp(newLevel, xpRequired) {
        // Trigger haptic feedback
        if (window.HapticFeedback) {
            HapticFeedback.levelUp();
        }

        const overlay = document.createElement('div');
        overlay.className = 'focus-celebration-overlay';
        overlay.innerHTML = `
            <div class="celebration-modal">
                <div class="celebration-modal__icon">⭐</div>
                <div class="celebration-modal__title">Level Up!</div>
                <div class="celebration-modal__subtitle">You reached Level ${newLevel}</div>
                <div class="celebration-modal__reward">Next level: ${xpRequired} XP</div>
                <button class="celebration-modal__button" onclick="PremiumInteractions.closeCelebration()">
                    Keep Going!
                </button>
            </div>
        `;
        
        document.body.appendChild(overlay);
        createConfetti();
        
        setTimeout(() => closeCelebration(), 5000);
    }

    function showStreakMilestone(streakCount) {
        const overlay = document.createElement('div');
        overlay.className = 'focus-celebration-overlay';
        overlay.innerHTML = `
            <div class="celebration-modal">
                <div class="celebration-modal__icon">🔥</div>
                <div class="celebration-modal__title">${streakCount}-Day Streak!</div>
                <div class="celebration-modal__subtitle">You're on fire!</div>
                <button class="celebration-modal__button" onclick="PremiumInteractions.closeCelebration()">
                    Continue
                </button>
            </div>
        `;
        
        document.body.appendChild(overlay);
        createConfetti();
        
        setTimeout(() => closeCelebration(), 3000);
    }

    // ============================================================
    // XP COUNTER ANIMATION
    // ============================================================
    
    function showXPCounter(targetElement, xpAmount) {
        const counter = document.createElement('div');
        counter.className = 'xp-counter-animate';
        counter.style.cssText = `
            position: fixed;
            font-size: 18px;
            font-weight: 700;
            color: var(--accent-color);
            z-index: 9999;
            pointer-events: none;
            animation: floatUpAndFade 1s ease-out forwards;
        `;
        counter.textContent = `+${xpAmount} XP`;

        // Position near the target element
        const rect = targetElement.getBoundingClientRect();
        counter.style.left = `${rect.left + rect.width / 2}px`;
        counter.style.top = `${rect.top}px`;
        counter.style.transform = 'translateX(-50%)';

        document.body.appendChild(counter);

        // Add float animation
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes floatUpAndFade {
                0% {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                }
                100% {
                    opacity: 0;
                    transform: translateX(-50%) translateY(-60px);
                }
            }
        `;
        if (!document.querySelector('style[data-xp-animation]')) {
            style.setAttribute('data-xp-animation', 'true');
            document.head.appendChild(style);
        }

        // Remove after animation
        setTimeout(() => counter.remove(), 1000);
    }

    // ============================================================
    // CONFETTI GENERATOR
    // ============================================================
    
    function createConfetti() {
        const colors = [
            '#4F46E5', // Primary accent
            '#10B981', // Success green
            '#F59E0B', // Warning amber
            '#EF4444', // Error red
            '#8B5CF6', // Purple
            '#EC4899'  // Pink
        ];

        const confettiCount = 50;
        
        for (let i = 0; i < confettiCount; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.className = 'confetti';
                confetti.style.left = Math.random() * window.innerWidth + 'px';
                confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.animationDelay = Math.random() * 0.5 + 's';
                confetti.style.animationDuration = Math.random() * 1 + 1.5 + 's';
                
                document.body.appendChild(confetti);
                
                setTimeout(() => confetti.remove(), 3000);
            }, i * 30);
        }
    }

    // ============================================================
    // CELEBRATION MODAL CONTROLS
    // ============================================================
    
    function closeCelebration() {
        const overlay = document.querySelector('.focus-celebration-overlay');
        if (overlay) {
            overlay.style.animation = 'overlayFadeIn 200ms ease-out reverse';
            setTimeout(() => overlay.remove(), 200);
        }
    }

    // ============================================================
    // CARD INTERACTIONS
    // ============================================================
    
    function addCardInteractions() {
        // Add hover effects to cards
        const cards = document.querySelectorAll('.card, .stat-card, .dashboard-card');
        cards.forEach(card => {
            if (!card.classList.contains('premium-card')) {
                card.classList.add('premium-card');
            }
        });

        // Add press effect to buttons
        const buttons = document.querySelectorAll('button, .btn');
        buttons.forEach(button => {
            if (!button.classList.contains('btn-press')) {
                button.classList.add('btn-press');
            }
        });
    }

    // ============================================================
    // PROGRESS ANIMATIONS
    // ============================================================
    
    function animateProgressBar(progressElement, targetPercent, duration = 600) {
        if (!progressElement) return;

        const fill = progressElement.querySelector('.progress-bar-fill');
        if (!fill) return;

        fill.style.transition = `width ${duration}ms cubic-bezier(0.4, 0.0, 0.2, 1)`;
        fill.style.width = targetPercent + '%';
    }

    function animateNumber(element, start, end, duration = 800) {
        if (!element) return;

        const range = end - start;
        const increment = range / (duration / 16);
        let current = start;

        const timer = setInterval(() => {
            current += increment;
            if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
                current = end;
                clearInterval(timer);
            }
            element.textContent = Math.round(current);
        }, 16);
    }

    // ============================================================
    // SCREEN TRANSITIONS
    // ============================================================
    
    function transitionToScreen(screenElement) {
        if (!screenElement) return;

        // Hide all screens
        const allScreens = document.querySelectorAll('.screen');
        allScreens.forEach(screen => {
            screen.classList.remove('active');
            screen.style.display = 'none';
        });

        // Show target screen with animation
        screenElement.style.display = 'block';
        screenElement.classList.add('active', 'screen-slide-in');
        
        setTimeout(() => {
            screenElement.classList.remove('screen-slide-in');
        }, 300);
    }

    // ============================================================
    // EMPTY STATE ENHANCEMENTS
    // ============================================================
    
    function enhanceEmptyStates() {
        // Add action buttons to empty states
        const tasksEmpty = document.querySelector('.tasks-empty-state, #tasksEmptyState');
        if (tasksEmpty && !tasksEmpty.querySelector('.empty-state__action-btn')) {
            const button = createEmptyStateButton('Add Your First Task', '➕', () => {
                document.getElementById('addTaskBtn')?.click();
            });
            tasksEmpty.appendChild(button);
            tasksEmpty.classList.add('empty-state-enhanced');
        }

        const habitsEmpty = document.querySelector('.habits-empty-state, #habitsEmptyState');
        if (habitsEmpty && !habitsEmpty.querySelector('.empty-state__action-btn')) {
            const button = createEmptyStateButton('Create a Habit', '🎯', () => {
                document.getElementById('addHabitBtn')?.click();
            });
            habitsEmpty.appendChild(button);
            habitsEmpty.classList.add('empty-state-enhanced');
        }

        const notesEmpty = document.querySelector('.notes-empty-state, #notesEmptyState');
        if (notesEmpty && !notesEmpty.querySelector('.empty-state__action-btn')) {
            const button = createEmptyStateButton('Write Your First Note', '📝', () => {
                document.getElementById('addNoteBtn')?.click();
            });
            notesEmpty.appendChild(button);
            notesEmpty.classList.add('empty-state-enhanced');
        }
    }

    function createEmptyStateButton(text, icon, onClick) {
        const button = document.createElement('button');
        button.className = 'empty-state__action-btn btn-press';
        button.innerHTML = `<span>${icon}</span><span>${text}</span>`;
        button.onclick = onClick;
        return button;
    }

    // ============================================================
    // SYNC STATUS ANIMATIONS
    // ============================================================
    
    function showSyncStatus(status) {
        const indicator = document.querySelector('.sync-indicator');
        if (!indicator) return;

        indicator.classList.remove('sync-indicator--syncing', 'sync-indicator--synced', 'sync-indicator--error');
        
        if (status === 'syncing') {
            indicator.classList.add('sync-indicator--syncing');
        } else if (status === 'synced') {
            indicator.classList.add('sync-indicator--synced');
        } else if (status === 'error') {
            indicator.classList.add('sync-indicator--error');
        }
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================
    
    function init() {
        console.log('🎨 Premium Interactions initialized');
        
        // Add card interactions
        addCardInteractions();
        
        // Enhance empty states
        enhanceEmptyStates();

        // Re-apply on dynamic content load
        document.addEventListener('contentLoaded', () => {
            addCardInteractions();
            enhanceEmptyStates();
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ============================================================
    // PUBLIC API
    // ============================================================
    
    return {
        // Task animations
        animateTaskCompletion,
        
        // Habit animations
        animateHabitCompletion,
        
        // Focus animations
        animateFocusCompletion,
        
        // Gamification celebrations
        showBadgeUnlock,
        showLevelUp,
        showStreakMilestone,
        
        // Utility animations
        showXPCounter,
        animateProgressBar,
        animateNumber,
        transitionToScreen,
        closeCelebration,
        showSyncStatus,
        
        // Setup
        addCardInteractions,
        enhanceEmptyStates,
        init
    };
})();

// Make it globally available
window.PremiumInteractions = PremiumInteractions;
