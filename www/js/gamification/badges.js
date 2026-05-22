// ===== BADGE / ACHIEVEMENT SYSTEM (js/badges.js) =====
// Handles badge definitions, unlock logic, Firestore sync, and notification UI

const BadgeSystem = (function () {
    'use strict';

    // ─── Badge Definitions ──────────────────────────────────────────────

    const BADGE_DEFS = [
        // Task badges
        { id: 'tasks_10', name: '10 Tasks', icon: '📋', description: 'Complete 10 tasks', category: 'tasks' },
        { id: 'tasks_100', name: '100 Tasks', icon: '🏆', description: 'Complete 100 tasks', category: 'tasks' },

        // Streak badges
        { id: 'streak_7', name: '7-Day Streak', icon: '🔥', description: 'Complete a 7-day habit streak', category: 'streak' },
        { id: 'streak_30', name: '30-Day Streak', icon: '💪', description: 'Complete a 30-day habit streak', category: 'streak' },

        // Focus badges
        { id: 'focus_10h', name: '10 Hours Focus', icon: '⏱️', description: 'Complete 10 hours of focused work', category: 'focus' }
    ];

    // Local state
    let unlockedBadges = {}; // { badgeId: { unlocked: true, unlockedAt: timestamp } }
    let isLoaded = false;

    // ─── Firestore Sync ─────────────────────────────────────────────────

    async function loadBadgesFromFirestore() {
        // Load from localStorage first (instant)
        try {
            const local = JSON.parse(localStorage.getItem('prodify_badges') || '{}');
            unlockedBadges = local;
        } catch (e) { unlockedBadges = {}; }

        if (!currentUserId || typeof firebase === 'undefined') {
            isLoaded = true;
            return;
        }

        try {
            const snap = await firebase.firestore()
                .collection('users').doc(currentUserId)
                .collection('badges').get();

            snap.forEach(doc => {
                unlockedBadges[doc.id] = doc.data();
            });

            localStorage.setItem('prodify_badges', JSON.stringify(unlockedBadges));
        } catch (err) {
            console.warn('Badges: Firestore load failed', err);
        }

        isLoaded = true;
    }

    async function saveBadgeToFirestore(badgeId) {
        localStorage.setItem('prodify_badges', JSON.stringify(unlockedBadges));

        if (!currentUserId || typeof firebase === 'undefined') return;

        try {
            await firebase.firestore()
                .collection('users').doc(currentUserId)
                .collection('badges').doc(badgeId)
                .set(unlockedBadges[badgeId]);
        } catch (err) {
            console.warn('Badges: Firestore save failed for', badgeId, err);
        }
    }

    // ─── Unlock Logic ───────────────────────────────────────────────────

    function unlockBadge(badgeId) {
        if (unlockedBadges[badgeId]?.unlocked) return; // Already unlocked

        const def = BADGE_DEFS.find(b => b.id === badgeId);
        if (!def) return;

        unlockedBadges[badgeId] = {
            unlocked: true,
            unlockedAt: new Date().toISOString(),
            name: def.name,
            description: def.description
        };

        saveBadgeToFirestore(badgeId);
        showBadgeNotification(def);
        renderBadgeGrid();

        console.log(`🏅 Badge unlocked: ${def.name}`);
    }

    // ─── Check Functions (called by other systems) ─────────────────────

    function checkTaskBadges() {
        const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
        const completed = tasks.filter(t => t.completed).length;

        if (completed >= 10) unlockBadge('tasks_10');
        if (completed >= 100) unlockBadge('tasks_100');
    }

    function checkHabitBadges() {
        const habits = JSON.parse(localStorage.getItem('habits') || '[]');

        // Check streaks
        let maxStreak = 0;
        habits.forEach(h => {
            if (h.streak > maxStreak) maxStreak = h.streak;
        });

        if (maxStreak >= 7) unlockBadge('streak_7');
        if (maxStreak >= 30) unlockBadge('streak_30');
    }

    function checkFocusBadges() {
        const sessions = JSON.parse(localStorage.getItem('focusSessions') || '[]');
        
        // Calculate total focus hours
        let totalMinutes = 0;
        sessions.forEach(s => {
            totalMinutes += (s.duration || 0) / 60; // Convert seconds to minutes
        });
        const totalHours = totalMinutes / 60;

        if (totalHours >= 10) unlockBadge('focus_10h');
    }

    // Run all checks (useful on init / profile open)
    function runAllChecks() {
        checkTaskBadges();
        checkHabitBadges();
        checkFocusBadges();
    }

    // ─── Badge Notification ─────────────────────────────────────────────

    function showBadgeNotification(badgeDef) {
        // Use premium interactions if available
        if (typeof PremiumInteractions !== 'undefined') {
            PremiumInteractions.showBadgeUnlock(badgeDef.name, badgeDef.icon, badgeDef.description);
            return;
        }
        
        // Use premium notification system if available
        if (typeof Notify !== 'undefined') {
            Notify.achievement(badgeDef.name, badgeDef.description, badgeDef.icon);
            return;
        }

        // Fallback to original notification
        const notif = document.createElement('div');
        notif.className = 'badge-notification';
        notif.innerHTML = `
            <div class="badge-notif-icon">${badgeDef.icon}</div>
            <div class="badge-notif-text">
                <span class="badge-notif-title">Badge Unlocked!</span>
                <span class="badge-notif-name">${badgeDef.name}</span>
            </div>
        `;
        document.body.appendChild(notif);

        requestAnimationFrame(() => notif.classList.add('show'));

        setTimeout(() => {
            notif.classList.add('hide');
            setTimeout(() => notif.remove(), 400);
        }, 3000);
    }

    // ─── UI Rendering ───────────────────────────────────────────────────

    function renderBadgeGrid() {
        const container = document.getElementById('badgeGrid');
        if (!container) return;

        // Group badges by category in a specific order (Milestones first/low to high)
        const categories = {
            milestone: { label: 'Milestones', badges: [] },
            streak: { label: 'Streaks', badges: [] },
            tasks: { label: 'Tasks', badges: [] },
            focus: { label: 'Focus', badges: [] },
            xp: { label: 'XP', badges: [] },
            level: { label: 'Levels', badges: [] },
            productivity: { label: 'Productivity', badges: [] },
            reflection: { label: 'Reflection', badges: [] }
        };

        BADGE_DEFS.forEach(def => {
            if (categories[def.category]) {
                categories[def.category].badges.push(def);
            }
        });

        const html = Object.keys(categories).map(catKey => {
            const cat = categories[catKey];
            if (cat.badges.length === 0) return '';

            const gridHtml = cat.badges.map(def => {
                const isUnlocked = unlockedBadges[def.id]?.unlocked;
                return `
                    <div class="badge-card ${isUnlocked ? 'unlocked' : 'locked'}" title="${def.description}">
                        <div class="badge-icon">${isUnlocked ? def.icon : '🔒'}</div>
                        <div class="badge-name">${def.name}</div>
                    </div>
                `;
            }).join('');

            return `
                <div class="badge-category collapsed">
                    <div class="badge-category-header" onclick="this.parentElement.classList.toggle('collapsed')">
                        <h4>${cat.label}</h4>
                        <span class="chevron" style="transition: transform 0.2s; font-size: 10px;">▼</span>
                    </div>
                    <div class="badge-category-grid badge-grid" style="margin-top: 5px;">
                        ${gridHtml}
                    </div>
                </div>
            `;
        }).join('');

        // Remove the inline grid styling from the main container so our categories stack properly
        // Don't set display inline to allow CSS collapse to work
        container.style.flexDirection = 'column';
        container.style.gap = '2px';
        container.classList.remove('badge-grid');
        container.innerHTML = html;

        // Automatically expand the Milestones category 
        const firstCategory = container.querySelector('.badge-category');
        if (firstCategory) {
            firstCategory.classList.remove('collapsed');
        }

        // Update badge count
        const countEl = document.getElementById('badgeUnlockedCount');
        const unlocked = Object.values(unlockedBadges).filter(b => b.unlocked).length;
        if (countEl) countEl.textContent = `${unlocked}/${BADGE_DEFS.length}`;
    }

    // ─── Init ───────────────────────────────────────────────────────────

    async function init() {
        await loadBadgesFromFirestore();
        renderBadgeGrid();
    }

    // ─── Public API ─────────────────────────────────────────────────────

    return {
        init,
        checkTaskBadges,
        checkHabitBadges,
        checkFocusBadges,
        runAllChecks,
        renderBadgeGrid,
        getBadgeDefs: () => [...BADGE_DEFS],
        getUnlocked: () => ({ ...unlockedBadges })
    };
})();
