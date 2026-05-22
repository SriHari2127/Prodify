// ===== LEVEL SYSTEM MODULE (js/levelSystem.js) =====
// Handles level progression, level-up detection, and celebration

const LevelSystem = (function () {
    'use strict';

    // Level thresholds: level → cumulative XP required
    // Formula: requiredXP = 100 × level²  (but we use a hand-tuned table for early levels)
    const LEVEL_THRESHOLDS = [
        { level: 1,  xp: 0 },
        { level: 2,  xp: 100 },
        { level: 3,  xp: 250 },
        { level: 4,  xp: 500 },
        { level: 5,  xp: 800 },
        { level: 6,  xp: 1200 },
        { level: 7,  xp: 1700 },
        { level: 8,  xp: 2300 },
        { level: 9,  xp: 3000 },
        { level: 10, xp: 3800 },
        { level: 11, xp: 4800 },
        { level: 12, xp: 6000 },
        { level: 13, xp: 7500 },
        { level: 14, xp: 9200 },
        { level: 15, xp: 11000 },
        { level: 16, xp: 13000 },
        { level: 17, xp: 15500 },
        { level: 18, xp: 18500 },
        { level: 19, xp: 22000 },
        { level: 20, xp: 26000 }
    ];

    // For levels beyond 20, use dynamic formula
    function getThresholdForLevel(lvl) {
        if (lvl <= 0) return 0;
        const entry = LEVEL_THRESHOLDS.find(t => t.level === lvl);
        if (entry) return entry.xp;
        // Dynamic: 100 × level²
        return 100 * lvl * lvl;
    }

    let currentLevel = 1;
    let justLevelledUp = false;

    // ─── Level Info Calculation ──────────────────────────────────────────

    function getLevelInfo(totalXP) {
        let level = 1;

        // Find the highest level the user qualifies for
        for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
            if (totalXP >= LEVEL_THRESHOLDS[i].xp) {
                level = LEVEL_THRESHOLDS[i].level;
                break;
            }
        }

        // Check dynamic levels beyond 20
        let dynamicLvl = 21;
        while (getThresholdForLevel(dynamicLvl) <= totalXP) {
            level = dynamicLvl;
            dynamicLvl++;
        }

        const currentThreshold = getThresholdForLevel(level);
        const nextThreshold = getThresholdForLevel(level + 1);
        const currentLevelXP = totalXP - currentThreshold;
        const xpForNextLevel = nextThreshold - currentThreshold;

        return {
            level,
            totalXP,
            currentLevelXP,
            xpForNextLevel,
            currentThreshold,
            nextThreshold,
            progressPercent: xpForNextLevel > 0 ? Math.min((currentLevelXP / xpForNextLevel) * 100, 100) : 100
        };
    }

    // ─── Level Up Check ─────────────────────────────────────────────────

    function checkLevelUp(totalXP) {
        const info = getLevelInfo(totalXP);

        if (info.level > currentLevel) {
            const oldLevel = currentLevel;
            currentLevel = info.level;
            showLevelUpCelebration(oldLevel, currentLevel);

            // Notify badge system
            if (typeof BadgeSystem !== 'undefined') {
                BadgeSystem.checkLevelBadges(currentLevel);
            }
        } else {
            currentLevel = info.level;
        }

        updateLevelDisplay(info);
    }

    // ─── Level Up Celebration ───────────────────────────────────────────

    function showLevelUpCelebration(oldLevel, newLevel) {
        // Use premium interactions if available
        if (typeof PremiumInteractions !== 'undefined') {
            const nextLevelXP = getRequiredXP(newLevel + 1);
            PremiumInteractions.showLevelUp(newLevel, nextLevelXP);
            return;
        }
        
        // Fallback to classic celebration
        // Create celebration overlay
        const overlay = document.createElement('div');
        overlay.className = 'level-up-celebration';
        overlay.innerHTML = `
            <div class="level-up-content">
                <div class="level-up-icon">🎉</div>
                <h2 class="level-up-title">Level Up!</h2>
                <div class="level-up-levels">
                    <span class="old-level">${oldLevel}</span>
                    <span class="level-arrow">→</span>
                    <span class="new-level">${newLevel}</span>
                </div>
                <p class="level-up-msg">Keep going, you're doing great!</p>
            </div>
        `;
        document.body.appendChild(overlay);

        // Trigger entrance animation
        requestAnimationFrame(() => overlay.classList.add('show'));

        // Minimal confetti if available
        if (typeof confetti === 'function') {
            confetti({
                particleCount: 30,
                spread: 50,
                origin: { y: 0.5 },
                ticks: 100
            });
        }

        // Auto-dismiss after 3 seconds
        setTimeout(() => {
            overlay.classList.add('hide');
            setTimeout(() => overlay.remove(), 500);
        }, 3000);

        // Click to dismiss
        overlay.addEventListener('click', () => {
            overlay.classList.add('hide');
            setTimeout(() => overlay.remove(), 500);
        });
    }

    // ─── UI Update ──────────────────────────────────────────────────────

    function updateLevelDisplay(info) {
        if (!info) info = getLevelInfo(typeof XPSystem !== 'undefined' ? XPSystem.getXP() : 0);

        const levelEl = document.getElementById('profileLevelValue');
        if (levelEl) levelEl.textContent = info.level;

        const levelLabelEl = document.getElementById('profileLevelLabel');
        if (levelLabelEl) levelLabelEl.textContent = `Level ${info.level}`;

        const progressFill = document.getElementById('levelProgressFill');
        if (progressFill) progressFill.style.width = `${info.progressPercent}%`;

        const progressText = document.getElementById('levelProgressText');
        if (progressText) {
            progressText.textContent = `${info.currentLevelXP} / ${info.xpForNextLevel} XP`;
        }

        // Update profile header level badge
        const headerLevel = document.getElementById('profileLevelBadge');
        if (headerLevel) headerLevel.textContent = `Lv. ${info.level}`;
    }

    // ─── Init ───────────────────────────────────────────────────────────

    function init() {
        const xp = typeof XPSystem !== 'undefined' ? XPSystem.getXP() : 0;
        const info = getLevelInfo(xp);
        currentLevel = info.level;
        updateLevelDisplay(info);
    }

    // ─── Public API ─────────────────────────────────────────────────────

    return {
        init,
        getLevelInfo,
        checkLevelUp,
        updateLevelDisplay,
        getThresholdForLevel
    };
})();
