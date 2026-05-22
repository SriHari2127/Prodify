// ===== XP SYSTEM MODULE (js/xpSystem.js) =====
// Handles XP earning, tracking, Firestore sync, and popup animations

const XPSystem = (function () {
    'use strict';

    // XP reward values
    const XP_REWARDS = {
        TASK_COMPLETE: 10,
        SUBTASKS_ALL_COMPLETE: 5,
        HABIT_COMPLETE: 5,
        FOCUS_SESSION: 15,
        DAILY_REFLECTION: 5
    };

    // Local state
    let totalXP = 0;
    let isLoaded = false;

    // ─── Firestore Integration ────────────────────────────────────────────

    async function loadXPFromFirestore() {
        if (!currentUserId || typeof firebase === 'undefined') {
            // Fallback to localStorage
            totalXP = parseInt(localStorage.getItem('prodify_totalXP') || '0', 10);
            isLoaded = true;
            return totalXP;
        }

        // Check if online before attempting Firestore fetch
        if (!navigator.onLine) {
            console.log('ℹ️ XP System: Offline, using localStorage');
            totalXP = parseInt(localStorage.getItem('prodify_totalXP') || '0', 10);
            isLoaded = true;
            return;
        }
        
        try {
            const doc = await firebase.firestore()
                .collection('users').doc(currentUserId)
                .get();

            if (doc.exists && doc.data().totalXP !== undefined) {
                totalXP = doc.data().totalXP || 0;
            } else {
                totalXP = parseInt(localStorage.getItem('prodify_totalXP') || '0', 10);
                // Initialize in Firestore
                await saveXPToFirestore();
            }
        } catch (error) {
            // Only log as error if not offline-related
            if (error.code === 'unavailable' || error.message.includes('offline')) {
                console.log('ℹ️ XP System: Network unavailable, using localStorage');
            } else if (error.code === 'permission-denied') {
                console.error("XP System: Permission denied. Check Firestore rules.");
            } else {
                console.error("XP System: Unexpected error:", error);
            }
            
            // Fallback to localStorage
            totalXP = parseInt(localStorage.getItem('prodify_totalXP') || '0', 10);
        }

        isLoaded = true;
        return totalXP;
    }

    async function saveXPToFirestore() {
        localStorage.setItem('prodify_totalXP', totalXP);

        if (!currentUserId || typeof firebase === 'undefined') return;

        try {
            const levelInfo = typeof LevelSystem !== 'undefined'
                ? LevelSystem.getLevelInfo(totalXP)
                : { level: 1, currentLevelXP: totalXP };

            await firebase.firestore()
                .collection('users').doc(currentUserId)
                .set({
                    totalXP: totalXP,
                    level: levelInfo.level,
                    currentLevelXP: levelInfo.currentLevelXP,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
        } catch (err) {
            console.warn('XP: Firestore save failed', err);
        }
    }

    // ─── XP Award ─────────────────────────────────────────────────────────

    function awardXP(amount, reason) {
        if (amount <= 0) return;

        totalXP += amount;
        saveXPToFirestore();

        // Show popup animation
        showXPPopup(amount, reason);

        // Notify level system
        if (typeof LevelSystem !== 'undefined') {
            LevelSystem.checkLevelUp(totalXP);
        }

        // Notify badge system
        if (typeof BadgeSystem !== 'undefined') {
            BadgeSystem.checkXPBadges(totalXP);
        }

        // Update any UI showing XP
        updateXPDisplay();

        console.log(`✨ +${amount} XP (${reason}) → Total: ${totalXP}`);
    }

    // ─── Specific Award Functions (called from integration hooks) ─────────

    function onTaskComplete(taskId) {
        awardXP(XP_REWARDS.TASK_COMPLETE, 'Task completed');

        // Check if all subtasks are complete
        const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
        const task = tasks.find(t => t.id === taskId);
        if (task && task.subtasks && task.subtasks.length > 0) {
            const allDone = task.subtasks.every(st => st.completed);
            if (allDone) {
                awardXP(XP_REWARDS.SUBTASKS_ALL_COMPLETE, 'All subtasks done');
            }
        }
    }

    function onHabitComplete() {
        awardXP(XP_REWARDS.HABIT_COMPLETE, 'Habit completed');
    }

    function onFocusSessionComplete() {
        awardXP(XP_REWARDS.FOCUS_SESSION, 'Focus session');
    }

    function onReflectionSaved() {
        // Only award XP once per day for reflection
        const today = new Date().toISOString().split('T')[0];
        const lastReflectionXP = localStorage.getItem('prodify_lastReflectionXP');
        if (lastReflectionXP === today) return;

        localStorage.setItem('prodify_lastReflectionXP', today);
        awardXP(XP_REWARDS.DAILY_REFLECTION, 'Daily reflection');
    }

    // ─── XP Popup Animation ──────────────────────────────────────────────

    function showXPPopup(amount, reason) {
        // Use premium notification system if available
        if (typeof Notify !== 'undefined') {
            Notify.xp(amount, reason);
            return;
        }

        // Fallback to original popup
        const popup = document.createElement('div');
        popup.className = 'xp-popup';
        popup.innerHTML = `<span class="xp-popup-amount">+${amount} XP</span>`;
        document.body.appendChild(popup);

        requestAnimationFrame(() => {
            popup.classList.add('xp-popup-show');
        });

        setTimeout(() => {
            popup.classList.add('xp-popup-hide');
            setTimeout(() => popup.remove(), 400);
        }, 1800);
    }

    // ─── UI Update ───────────────────────────────────────────────────────

    function updateXPDisplay() {
        const xpEl = document.getElementById('profileXPValue');
        if (xpEl) xpEl.textContent = totalXP.toLocaleString();

        const xpBarEl = document.getElementById('xpProgressFill');
        if (xpBarEl && typeof LevelSystem !== 'undefined') {
            const info = LevelSystem.getLevelInfo(totalXP);
            const pct = info.xpForNextLevel > 0
                ? (info.currentLevelXP / info.xpForNextLevel) * 100
                : 100;
            xpBarEl.style.width = `${Math.min(pct, 100)}%`;
        }
    }

    // ─── Public API ──────────────────────────────────────────────────────

    return {
        init: loadXPFromFirestore,
        getXP: () => totalXP,
        getRewards: () => ({ ...XP_REWARDS }),
        awardXP,
        onTaskComplete,
        onHabitComplete,
        onFocusSessionComplete,
        onReflectionSaved,
        updateXPDisplay
    };
})();
