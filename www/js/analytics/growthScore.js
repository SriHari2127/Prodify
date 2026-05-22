// ===== GROWTH SCORE MODULE (js/growthScore.js) =====

const GrowthScoreManager = (function() {
    'use strict';

    let lastCalculatedScore = null;

    async function getMoodScore() {
        let moodScore = 0;
        try {
            if (typeof MoodManager !== 'undefined' && MoodManager.loadTodayMood) {
                const todayMood = await MoodManager.loadTodayMood();
                if (todayMood && todayMood.moodLevel) {
                    // 5 = 100, 4 = 80, 3 = 60, 2 = 40, 1 = 20
                    moodScore = todayMood.moodLevel * 20;
                }
            }

            if (typeof ReflectionManager !== 'undefined' && ReflectionManager.loadTodayReflection) {
                const todayReflection = await ReflectionManager.loadTodayReflection();
                if (todayReflection && (todayReflection.learned || todayReflection.wentWell || todayReflection.improve)) {
                    moodScore += 5; // Reflection bonus
                    if (moodScore > 100) moodScore = 100;
                }
            }
        } catch (e) {
            console.warn("Could not calculate mood score", e);
        }
        return moodScore;
    }

    function getProductivityScore() {
        try {
            if (typeof ProductivityScore !== 'undefined') {
                const data = ProductivityScore.calculate();
                return data ? (data.score || 0) : 0;
            }
        } catch (e) {
            console.warn("Could not calculate productivity score", e);
        }
        return 0;
    }

    function getPhysicalScore() {
        try {
            if (typeof PhysicalTab !== 'undefined' && PhysicalTab.getDailyScore) {
                return PhysicalTab.getDailyScore() || 0;
            }
        } catch (e) {
            console.warn("Could not calculate physical score", e);
        }
        return 0;
    }

    function getGrowthLabel(score) {
        if (score >= 90) return { text: 'Elite Growth', icon: 'fa-crown', color: '#f59e0b' };
        if (score >= 75) return { text: 'Strong Growth', icon: 'fa-rocket', color: '#8b5cf6' };
        if (score >= 60) return { text: 'Improving', icon: 'fa-arrow-trend-up', color: 'var(--accent-color)' };
        if (score >= 40) return { text: 'Inconsistent', icon: 'fa-bolt', color: '#f97316' };
        return { text: 'Needs Attention', icon: 'fa-seedling', color: '#ef4444' };
    }

    async function calculateOverallGrowthScore() {
        const prodScore = getProductivityScore();
        const physScore = getPhysicalScore();
        const moodScore = await getMoodScore();

        const overall = (prodScore * 0.40) + (physScore * 0.35) + (moodScore * 0.25);
        return {
            overall: Math.round(overall) || 0,
            prodScore,
            physScore,
            moodScore
        };
    }

    function animateValue(obj, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start) + '%';
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                obj.innerHTML = end + '%';
            }
        };
        window.requestAnimationFrame(step);
    }

    async function renderGrowthCard() {
        const container = document.getElementById('growth-score-container');
        if (!container) return;

        try {
            const scores = await calculateOverallGrowthScore();
            lastCalculatedScore = scores;
            const label = getGrowthLabel(scores.overall);

            const circumference = 2 * Math.PI * 42;
            const offset = circumference - (circumference * scores.overall / 100);
            const ringColor = label.color;

            const categories = [
                { key: 'Productivity', val: scores.prodScore, icon: 'fa-chart-line', color: 'var(--accent-color)' },
                { key: 'Physical',     val: scores.physScore,  icon: 'fa-heart-pulse', color: '#10b981' },
                { key: 'Mood',         val: scores.moodScore,  icon: 'fa-face-smile', color: '#f59e0b' }
            ];

            const breakdownHtml = categories.map(c => `
                <div class="ana-growth__cat">
                    <div class="ana-growth__cat-head">
                        <i class="fa-solid ${c.icon}" style="color:${c.color}"></i>
                        <span>${c.key}</span>
                        <strong>${c.val}%</strong>
                    </div>
                    <div class="ana-growth__cat-bar">
                        <div class="ana-growth__cat-fill" style="width:${c.val}%;background:${c.color}"></div>
                    </div>
                </div>
            `).join('');

            container.innerHTML = `
                <section class="ana-card ana-growth">
                    <div class="ana-growth__top">
                        <div class="ana-growth__ring">
                            <svg viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--surface-border)" stroke-width="7"/>
                                <circle cx="50" cy="50" r="42" fill="none" stroke="${ringColor}" stroke-width="7"
                                    stroke-linecap="round"
                                    stroke-dasharray="${circumference}"
                                    stroke-dashoffset="${circumference}"
                                    transform="rotate(-90 50 50)"
                                    id="growthRingFill"
                                    style="transition: stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)"/>
                            </svg>
                            <div class="ana-growth__val" id="animatedGrowthValue">0%</div>
                        </div>
                        <div class="ana-growth__info">
                            <span class="ana-growth__heading">Overall Growth</span>
                            <div class="ana-growth__badge" style="color:${label.color};background:${label.color}15;">
                                <i class="fa-solid ${label.icon}"></i> ${label.text}
                            </div>
                        </div>
                    </div>
                    <div class="ana-growth__cats">${breakdownHtml}</div>
                </section>
            `;

            // Animate ring + number
            const valEl = document.getElementById('animatedGrowthValue');
            const ringEl = document.getElementById('growthRingFill');

            setTimeout(() => {
                if (valEl) animateValue(valEl, 0, scores.overall, 1200);
                if (ringEl) ringEl.style.strokeDashoffset = offset;
            }, 80);
            
            // Remove skeleton loader after growth card is rendered
            if (typeof SkeletonLoader !== 'undefined') {
                setTimeout(() => SkeletonLoader.remove('#growth-score-container'), 800);
            }

        } catch (error) {
            console.error("Error rendering growth card", error);
            container.innerHTML = `<section class="ana-card"><p style="text-align:center;color:var(--text-secondary);padding:20px;">Unable to calculate growth score</p></section>`;
        }
    }

    function init() {
        // Render immediately in case auth takes a while or we rely on local storage
        renderGrowthCard();
        
        if (typeof firebase !== 'undefined' && firebase.auth) {
            firebase.auth().onAuthStateChanged(user => {
                if (user) {
                    window.currentUserId = user.uid; // ensure it's set
                    renderGrowthCard();
                } else {
                    // Try to render with local guest context
                    setTimeout(renderGrowthCard, 100);
                }
            });
        }
        
        // Listen for tab changes so we update when going back to analytics tab
        document.addEventListener('tabChanged', (e) => {
            if (e.detail && e.detail.tabId === 'analytics-tab') {
                renderGrowthCard();
            }
        });
    }

    return {
        init,
        renderGrowthCard,
        calculateOverallGrowthScore
    };
})();

// Auto initialize
document.addEventListener('DOMContentLoaded', () => {
    // Delay initialization slightly to let other modules set up
    setTimeout(() => {
        if (typeof GrowthScoreManager !== 'undefined') {
            GrowthScoreManager.init();
        }
    }, 500);
});
