// ===== TODAY DASHBOARD MODULE (todayDashboard.js) =====
// Aggregates data from all modules to provide a daily overview

const TodayDashboard = (function() {
    'use strict';

    let isInitialized = false;

    // DOM Elements
    const elements = {};

    function init() {
        if (isInitialized) return;

        console.log("☀️ Initializing Today Dashboard...");
        
        // Cache DOM elements
        elements.container = document.getElementById('today-tab');
        elements.greeting = document.getElementById('dashboardGreeting');
        elements.prodScore = document.getElementById('dashboardProdScore');
        elements.tasksList = document.getElementById('dashboardTasksList');
        elements.habitSummary = document.getElementById('dashboardHabitSummary');
        elements.studyProgress = document.getElementById('dashboardStudyProgress');
        elements.xpSummary = document.getElementById('dashboardXpSummary');

        if (!elements.container) {
            console.error("Today Dashboard container not found!");
            return;
        }

        renderAll();
        isInitialized = true;
    }

    function renderAll() {
        renderGreeting();
        renderSchedule(); // Smart Study Scheduler
        renderSmartStudyPlanner();
        renderProductivityScore();
        renderTopTasks();
        renderHabitSummary();
        renderStudyProgress();
        renderXpSummary();
        
        // Remove skeleton loaders after all content is rendered
        if (typeof SkeletonLoader !== 'undefined') {
            setTimeout(() => {
                SkeletonLoader.remove('#dashboardGreeting');
                SkeletonLoader.remove('#nextSessionWidget');
                SkeletonLoader.remove('#dashboardTasksList');
            }, 800);
        }
    }

    // --- 1. Greeting & Quote ---
    function renderGreeting() {
        if (!elements.greeting) return;
        
        const hour = new Date().getHours();
        let timeGreeting = "Good morning";
        let greetIcon = "fa-sun";
        let greetEmoji = "☀️";
        
        if (hour >= 12 && hour < 17) {
            timeGreeting = "Good afternoon";
            greetIcon = "fa-cloud-sun";
            greetEmoji = "⛅";
        } else if (hour >= 17 && hour < 21) {
            timeGreeting = "Good evening";
            greetIcon = "fa-cloud-moon";
            greetEmoji = "🌆";
        } else if (hour >= 21 || hour < 5) {
            timeGreeting = "Good night";
            greetIcon = "fa-moon";
            greetEmoji = "🌙";
        }

        let userName = "Achiever";
        if (typeof cachedProfileName !== 'undefined' && cachedProfileName) {
            userName = cachedProfileName;
        } else if (typeof firebase !== 'undefined' && firebase.auth().currentUser) {
            if (firebase.auth().currentUser.displayName) {
                userName = firebase.auth().currentUser.displayName.split(' ')[0];
            }
        } else {
            try {
                const localUser = JSON.parse(localStorage.getItem("currentUser"));
                if (localUser && localUser.displayName) userName = localUser.displayName;
            } catch (e) {}
        }
        if (userName === "Achiever") {
            const profileNameInput = document.getElementById('profileNameInput');
            if (profileNameInput && profileNameInput.value) userName = profileNameInput.value;
        }

        elements.greeting.innerHTML = `
            <div class="home-greet">
                <div class="home-greet__top">
                    <div class="home-greet__icon"><i class="fa-solid ${greetIcon}"></i></div>
                    <div>
                        <h1 class="home-greet__title">${timeGreeting}, <span>${userName}</span></h1>
                        <p class="home-greet__quote">${getRandomQuote()}</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    function getRandomQuote() {
        const quotes = [
            "Focus on being productive instead of busy.",
            "The best way to predict the future is to create it.",
            "Small steps every day lead to big results.",
            "Don't watch the clock; do what it does. Keep going.",
            "Your future is created by what you do today.",
            "Success is the sum of small efforts, repeated daily."
        ];
        return quotes[Math.floor(Math.random() * quotes.length)];
    }

    // --- 2. Smart Study Schedule ---
    async function renderSchedule() {
        try {
            if (typeof StudyScheduler !== 'undefined') {
                await StudyScheduler.init();
            }
            if (typeof ScheduleUI !== 'undefined') {
                await ScheduleUI.renderTodaySchedule();
                ScheduleUI.renderNextSession();
            }
        } catch (e) {
            console.error('Error rendering schedule:', e);
        }
    }

    // --- 3. Smart Study Planner ---
    function renderSmartStudyPlanner() {
        try {
            if (typeof SmartStudyPlanner !== 'undefined') {
                SmartStudyPlanner.init();
                SmartStudyPlanner.render('dashboardStudyPlanner');
            }
        } catch (e) {
            console.error('Error rendering Smart Study Planner:', e);
        }
    }

    // --- 4. Overall Productivity Score ---
    function renderProductivityScore() {
        if (!elements.prodScore) return;

        // Calculate a simple composite score (0-100)
        // 50% Tasks, 30% Habits, 20% Study Focus
        
        let score = 0;
        
        // Tasks Score
        const tasks = getTasksForToday();
        const completedTasks = tasks.filter(t => t.completed).length;
        const totalTasks = tasks.length;
        const taskScore = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        // Habits Score
        const habits = getHabits();
        const doneHabits = habits.filter(h => isHabitDoneToday(h)).length;
        const totalHabits = habits.length;
        const habitScore = totalHabits > 0 ? (doneHabits / totalHabits) * 100 : 0;

        // Study Score (capped at 60 minutes = 100%)
        const studyScore = Math.min(getStudyMinutes() / 60, 1) * 100;

        // Weighted Average
        const finalScore = Math.round(
            (taskScore * 0.5) + 
            (habitScore * 0.3) + 
            (studyScore * 0.2)
        );

        let label = "Needs Focus";
        let color = "var(--danger-color)";
        if (finalScore >= 90) { label = "Elite"; color = "var(--success-color)"; }
        else if (finalScore >= 70) { label = "Strong"; color = "var(--accent-color)"; }
        else if (finalScore >= 50) { label = "Improving"; color = "var(--warning-color)"; }

        elements.prodScore.innerHTML = `
            <div class="home-score" onclick="switchTab('analytics')">
                <div class="home-score__left">
                    <span class="home-score__label">Daily Score</span>
                    <h2 class="home-score__value" style="color:${color}">${finalScore}%</h2>
                    <span class="home-score__badge" style="background:${color}15; color:${color}; border:1px solid ${color}30">${label}</span>
                </div>
                <div class="home-score__ring">
                    <svg viewBox="0 0 36 36">
                        <path class="home-score__ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path class="home-score__ring-fill" stroke="${color}" stroke-dasharray="${finalScore}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                </div>
            </div>
        `;
    }

    // --- 5. Top 3 Tasks ---
    function renderTopTasks() {
        if (!elements.tasksList) return;

        const tasks = getTasksForToday();
        
        // Sort: Uncompleted first, then Vital Priority, then Due Time
        const sortedTasks = tasks.sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            // Priority sort (Vital-Quick > Vital-NotQuick > etc) - simplified check
            const pA = getPriorityWeight(a.priority);
            const pB = getPriorityWeight(b.priority);
            return pB - pA;
        }).slice(0, 3);

        let tasksHtml = '';
        if (sortedTasks.length === 0) {
            tasksHtml = `<div class="home-tasks__empty"><i class="fa-solid fa-circle-check"></i> All caught up!</div>`;
        } else {
            tasksHtml = sortedTasks.map(t => {
                const pColor = getPriorityColor(t.priority);
                return `
                <div class="home-tasks__item" onclick="switchTab('tasks')">
                    <div class="home-tasks__dot ${t.completed ? 'done' : ''}" style="border-color:${pColor}; ${t.completed ? `background:${pColor}` : ''}"></div>
                    <div class="home-tasks__info">
                        <span class="home-tasks__name ${t.completed ? 'home-tasks__name--done' : ''}">${t.text}</span>
                        ${t.priority ? `<span class="home-tasks__tag" style="background:${pColor}12; color:${pColor}; border:1px solid ${pColor}25">${formatPriority(t.priority)}</span>` : ''}
                    </div>
                </div>`;
            }).join('');
        }

        elements.tasksList.innerHTML = `
            <div class="home-card">
                <div class="home-card__head">
                    <h3 class="home-card__title"><i class="fa-solid fa-bolt"></i> Top Priorities</h3>
                    <span class="home-card__link" onclick="switchTab('tasks')">View All <i class="fa-solid fa-arrow-right"></i></span>
                </div>
                <div class="home-tasks__list">
                    ${tasksHtml}
                </div>
            </div>
        `;
    }

    // --- 6. Habit Summary ---
    function renderHabitSummary() {
        if (!elements.habitSummary) return;

        const habits = getHabits();
        const activeHabits = habits.length;
        const doneToday = habits.filter(h => isHabitDoneToday(h)).length;
        
        // Longest streak calculation
        let maxStreak = 0;
        habits.forEach(h => {
            if (h.streak > maxStreak) maxStreak = h.streak;
        });

        const progress = activeHabits > 0 ? (doneToday / activeHabits) * 100 : 0;

        elements.habitSummary.innerHTML = `
            <div class="home-card" onclick="switchTab('habits')">
                <div class="home-card__head">
                    <h3 class="home-card__title"><i class="fa-solid fa-fire" style="color:#ff9800"></i> Habits</h3>
                    <span class="home-card__chip">${doneToday}/${activeHabits}</span>
                </div>
                <div class="home-habit__bar">
                    <div class="home-habit__fill" style="width:${progress}%"></div>
                </div>
                <div class="home-habit__stat">Best streak: <strong>${maxStreak}</strong> days</div>
            </div>
        `;
    }

    // --- 7. Study Progress ---
    function renderStudyProgress() {
        if (!elements.studyProgress) return;

        const mins = getStudyMinutes();
        const hours = (mins / 60).toFixed(1);
        
        // Check local storage for active session? 
        // Assuming focusTimer might have state, but for now just showing logged time
        
        const isStudyEmpty = mins === 0;

        elements.studyProgress.innerHTML = `
            <div class="home-card" onclick="switchTab('academics')">
                <div class="home-card__head">
                    <h3 class="home-card__title"><i class="fa-solid fa-book-open" style="color:var(--accent-color)"></i> Study Focus</h3>
                </div>
                <div class="home-study">
                    <span class="home-study__value">${isStudyEmpty ? '—' : `${hours}h`}</span>
                    <span class="home-study__sub">${isStudyEmpty ? 'Start a session to track' : 'Focus time today'}</span>
                </div>
            </div>
        `;
    }

    // --- 10. XP Summary ---
    function renderXpSummary() {
        if (!elements.xpSummary) return;
        
        // Need to fetch from LevelSystem or storage
        // Assuming 'user_xp' storage key from existing levelSystem.js logic
        const xp = parseInt(localStorage.getItem('user_xp') || '0');
        const level = parseInt(localStorage.getItem('user_level') || '1');
        
        // XP for next level formula from levelSystem.js (approximated: level * 100)
        const xpNext = level * 100;
        const progress = Math.min((xp / xpNext) * 100, 100);

        elements.xpSummary.innerHTML = `
            <div class="home-xp">
                <div class="home-xp__head">
                    <span class="home-xp__level"><i class="fa-solid fa-trophy" style="color:#fbbf24; margin-right:4px"></i> Level ${level}</span>
                    <span class="home-xp__count">${xp} / ${xpNext} XP</span>
                </div>
                <div class="home-xp__bar">
                    <div class="home-xp__fill" style="width:${progress}%"></div>
                </div>
            </div>
        `;
    }


    // === Helpers ===

    function getTasksForToday() {
        try {
            const allTasks = JSON.parse(localStorage.getItem('tasks')) || [];
            if (!allTasks.length) return [];
            
            const today = new Date().toISOString().split('T')[0];
            
            return allTasks.filter(t => {
                // Return if task is for today, OR if it's overdue, OR if it's vital and uncompleted
                // Simplified: Tasks that are not completed or completed today
                if (t.completed) {
                    return t.completedDate && t.completedDate.startsWith(today);
                }
                // If not completed
                if (!t.dueDate) return true; // No date = do anytime (show today)
                return t.dueDate <= today;
            });
        } catch (e) {
            console.error(e);
            return [];
        }
    }

    function getHabits() {
        try {
            return JSON.parse(localStorage.getItem('habits')) || [];
        } catch (e) { return []; }
    }

    function isHabitDoneToday(habit) {
        if (!habit || !habit.history) return false;
        const today = new Date().toISOString().split('T')[0];
        return habit.history.includes(today);
    }

    function getStudyMinutes() {
         // This would ideally come from Academics module state
         // Fallback to checking studySessions in localStorage if they exist
         try {
             const sessions = JSON.parse(localStorage.getItem('study_sessions')) || [];
             const today = new Date().toISOString().split('T')[0];
             return sessions
                .filter(s => s.date === today)
                .reduce((sum, s) => sum + (s.duration || 0), 0);
         } catch (e) { return 0; }
    }

    function getPhysicalData() {
        try {
            const dateKey = new Date().toISOString().split('T')[0];
            return JSON.parse(localStorage.getItem('prodify_physical_' + dateKey));
        } catch (e) { return null; }
    }

    function getPriorityWeight(p) {
        if (!p) return 0;
        if (p.includes('vital-quick')) return 4;
        if (p.includes('vital-notquick')) return 3;
        if (p.includes('notvital-quick')) return 2;
        return 1;
    }

    function getPriorityColor(p) {
        if (p === 'vital-quick') return '#ef4444'; // red
        if (p === 'vital-notquick') return '#f59e0b'; // orange
        if (p === 'notvital-quick') return '#10b981'; // green
        return 'var(--text-secondary)';
    }

    function formatPriority(p) {
        if (p === 'vital-quick') return 'Do First';
        if (p === 'vital-notquick') return 'Schedule';
        if (p === 'notvital-quick') return 'Quick Win';
        return 'Task';
    }


    // Public API
    return {
        init: init,
        refresh: renderAll
    };
})();
