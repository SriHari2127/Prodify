// ===== ACADEMIC MODULE (academic.js) =====
// Handles: Subjects, Study Planner, Exam Countdown, Focus Timer, Academic Analytics

// ─── Helpers ────────────────────────────────────────────────────────────────

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function getLS(key) { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } }
function setLS(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
function formatTime12(t) { if (!t) return ''; const [h,m] = t.split(':'); let hr = parseInt(h,10); const ap = hr >= 12 ? 'PM' : 'AM'; hr = hr % 12 || 12; return `${hr}:${m} ${ap}`; }

const SUBJECT_COLORS = [
    'var(--accent-color)', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
    '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#06b6d4'
];

// ─── 1. SUBJECT MANAGEMENT ─────────────────────────────────────────────────

let activeSubjectFilter = null; // null = show all tasks

function getSubjects() { return getLS('subjects'); }

function addSubject(name, color) {
    const subj = { id: uid(), name: name.trim(), color: color || SUBJECT_COLORS[getSubjects().length % SUBJECT_COLORS.length] };
    const list = getSubjects();
    list.push(subj);
    setLS('subjects', list);
    if (typeof saveSubjectToFirestore === 'function') saveSubjectToFirestore(subj);
    renderSubjectChips();
    return subj;
}

function removeSubject(id) {
    setLS('subjects', getSubjects().filter(s => s.id !== id));
    if (typeof deleteSubjectFromFirestore === 'function') deleteSubjectFromFirestore(id);
    if (activeSubjectFilter === id) { activeSubjectFilter = null; filterTasksBySubject(); }
    renderSubjectChips();
    populateSubjectSelects();
}

function getSubjectById(id) { return getSubjects().find(s => s.id === id) || null; }

function renderSubjectChips() {
    const strip = document.getElementById('subjectChipStrip');
    if (!strip) return;
    const subjects = getSubjects();
    strip.innerHTML = '';

    // "All" chip
    const allChip = document.createElement('button');
    allChip.className = 'subject-chip' + (activeSubjectFilter === null ? ' active' : '');
    allChip.textContent = 'All';
    allChip.style.setProperty('--chip-color', 'var(--accent-color)');
    allChip.addEventListener('click', () => { activeSubjectFilter = null; filterTasksBySubject(); renderSubjectChips(); });
    strip.appendChild(allChip);

    subjects.forEach(subj => {
        const chip = document.createElement('button');
        chip.className = 'subject-chip' + (activeSubjectFilter === subj.id ? ' active' : '');
        chip.style.setProperty('--chip-color', subj.color);

        const nameSpan = document.createElement('span');
        nameSpan.textContent = subj.name;
        chip.appendChild(nameSpan);

        // Delete button
        const delBtn = document.createElement('span');
        delBtn.innerHTML = '&times;';
        delBtn.style.marginLeft = '6px';
        delBtn.style.fontSize = '16px';
        delBtn.style.lineHeight = '1';
        delBtn.style.opacity = '0.6';
        delBtn.style.padding = '0 2px';
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof showDeleteModal === 'function') {
                showDeleteModal(() => {
                    removeSubject(subj.id);
                }, 'Subject');
            } else {
                if (confirm(`Delete subject "${subj.name}"?`)) removeSubject(subj.id);
            }
        });
        chip.appendChild(delBtn);

        chip.addEventListener('click', () => {
            activeSubjectFilter = activeSubjectFilter === subj.id ? null : subj.id;
            filterTasksBySubject();
            renderSubjectChips();
        });

        strip.appendChild(chip);
    });

    // "+" button
    const addBtn = document.createElement('button');
    addBtn.className = 'subject-chip subject-chip-add';
    addBtn.textContent = '+';
    addBtn.title = 'Add subject';
    addBtn.addEventListener('click', toggleAddSubjectBox);
    strip.appendChild(addBtn);

    populateSubjectSelects();
}

function filterTasksBySubject() {
    const tasks = document.querySelectorAll('#taskList li');
    tasks.forEach(li => {
        if (!activeSubjectFilter) { li.style.display = ''; return; }
        const sid = li.getAttribute('data-subject-id');
        li.style.display = sid === activeSubjectFilter ? '' : 'none';
    });
}

function populateSubjectSelects() {
    document.querySelectorAll('.subject-select').forEach(sel => {
        const cur = sel.value;
        sel.innerHTML = '<option value="">No Subject</option>';
        getSubjects().forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name;
            opt.style.color = s.color;
            sel.appendChild(opt);
        });
        sel.value = cur;
    });
}

function toggleAddSubjectBox() {
    const box = document.getElementById('addSubjectBox');
    const input = document.getElementById('newSubjectInput');
    if (!box) return;

    if (box.style.display === 'none' || box.style.display === '') {
        box.style.display = 'block';
        setTimeout(() => box.classList.remove('collapsed'), 10);
        if (input) input.focus();
    } else {
        box.classList.add('collapsed');
        setTimeout(() => box.style.display = 'none', 300);
    }
}

// Ensure the button inside index.html works
document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('saveSubjectBtn');
    const input = document.getElementById('newSubjectInput');

    if (saveBtn && input) {
        saveBtn.addEventListener('click', () => {
            let name = input.value;
            if (!name || !name.trim()) {
                toggleAddSubjectBox();
                return;
            }
            name = name.trim();
            name = name.charAt(0).toUpperCase() + name.slice(1);
            addSubject(name);
            input.value = '';
            toggleAddSubjectBox();
        });

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveBtn.click();
            }
        });
    }

    const cancelSubjectBtn = document.getElementById('cancelSubjectFormBtn');
    if (cancelSubjectBtn) {
        cancelSubjectBtn.addEventListener('click', () => {
            if (input) input.value = '';
            toggleAddSubjectBox();
        });
    }
});

// ─── 2. STUDY PLANNER (WEEKLY VIEW) ────────────────────────────────────────

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getStudyBlocks() { return getLS('studyBlocks'); }

function addStudyBlock(day, subjectId, duration, startTime) {
    const block = { id: uid(), day, subjectId: subjectId || null, duration: Number(duration) || 30, startTime: startTime || null };
    const list = getStudyBlocks();
    list.push(block);
    setLS('studyBlocks', list);
    if (typeof saveStudyBlockToFirestore === 'function') saveStudyBlockToFirestore(block);
    if (typeof AppReminders !== 'undefined') AppReminders.scheduleStudyReminder(block);
    renderStudyPlanner();
}

function removeStudyBlock(id) {
    setLS('studyBlocks', getStudyBlocks().filter(b => b.id !== id));
    if (typeof deleteStudyBlockFromFirestore === 'function') deleteStudyBlockFromFirestore(id);
    if (typeof AppReminders !== 'undefined') AppReminders.cancelStudyReminder(id);
    renderStudyPlanner();
}

function renderStudyPlanner() {
    const container = document.getElementById('studyPlannerGrid');
    if (!container) return;
    container.innerHTML = '';
    const blocks = getStudyBlocks();
    const today = new Date().toLocaleDateString('en-US', { weekday: 'short' });

    DAYS.forEach(day => {
        const card = document.createElement('div');
        card.className = 'planner-day-card' + (day === today ? ' today' : '');

        const dayBlocks = blocks.filter(b => b.day === day);
        const totalMin = dayBlocks.reduce((s, b) => s + (b.duration || 0), 0);

        card.innerHTML = `
            <div class="acad-day__header">
                <span class="acad-day__name">${day}</span>
                <span class="acad-day__hours">${totalMin >= 60 ? Math.floor(totalMin / 60) + 'h ' + (totalMin % 60 ? (totalMin % 60) + 'm' : '') : totalMin + 'm'}</span>
            </div>
            <div class="acad-day__blocks"></div>
            <button class="acad-day__add" data-day="${day}" title="Add study block"><i class="fa-solid fa-plus"></i></button>
        `;

        const blocksContainer = card.querySelector('.acad-day__blocks');
        dayBlocks.forEach(b => {
            const subj = getSubjectById(b.subjectId);
            const el = document.createElement('div');
            el.className = 'acad-block';
            el.style.borderLeft = `3px solid ${subj ? subj.color : '#6b7280'}`;
            const timeStr = b.startTime ? `<span class="acad-block__time">${formatTime12(b.startTime)}</span> · ` : '';
            el.innerHTML = `
                <span class="acad-block__name">${subj ? subj.name : 'General'}</span>
                <span class="acad-block__dur">${timeStr}${b.duration}m</span>
                <button class="acad-block__del" data-block-id="${b.id}" title="Remove"><i class="fa-solid fa-xmark"></i></button>
            `;
            blocksContainer.appendChild(el);
        });

        container.appendChild(card);
    });

    // Event delegation — remove old listener first to prevent accumulation
    if (container._plannerClickHandler) {
        container.removeEventListener('click', container._plannerClickHandler);
    }
    container._plannerClickHandler = function (e) {
        const addBtn = e.target.closest('.acad-day__add');
        if (addBtn) { openStudyBlockModal(addBtn.dataset.day); return; }
        const delBtn = e.target.closest('.acad-block__del');
        if (delBtn) removeStudyBlock(delBtn.dataset.blockId);
    };
    container.addEventListener('click', container._plannerClickHandler);
}

function openStudyBlockModal(day) {
    const modal = document.getElementById('studyBlockModal');
    if (!modal) return;
    modal.style.display = 'flex';
    modal.querySelector('#studyBlockDay').value = day;
    populateSubjectSelects();
    modal.querySelector('#studyBlockSubject').value = '';
    modal.querySelector('#studyBlockDuration').value = '30';
    const startTimeInput = modal.querySelector('#studyBlockStartTime');
    if (startTimeInput) startTimeInput.value = '';
    // Pre-select the day chip if available
    modal.querySelectorAll('.day-chip').forEach(c => {
        c.classList.toggle('selected', c.dataset.day === day);
    });
    modal.classList.add('show');
    document.body.classList.add('modal-open');
}

// ─── 3. EXAM COUNTDOWN ─────────────────────────────────────────────────────

function getExams() { return getLS('exams'); }

function addExam(name, subjectId, date) {
    const exam = { id: uid(), name: name.trim(), subjectId: subjectId || null, date };
    const list = getExams();
    list.push(exam);
    setLS('exams', list);
    if (typeof saveExamToFirestore === 'function') saveExamToFirestore(exam);
    if (typeof AppReminders !== 'undefined') AppReminders.scheduleExamReminder(exam);
    renderExams();
}

function removeExam(id) {
    setLS('exams', getExams().filter(e => e.id !== id));
    if (typeof deleteExamFromFirestore === 'function') deleteExamFromFirestore(id);
    if (typeof AppReminders !== 'undefined') AppReminders.cancelExamReminder(id);
    renderExams();
}

function renderExams() {
    const container = document.getElementById('examList');
    if (!container) return;
    const exams = getExams()
        .map(e => ({ ...e, _days: Math.ceil((new Date(e.date) - new Date()) / 86400000) }))
        .sort((a, b) => a._days - b._days);

    container.innerHTML = '';
    if (exams.length === 0) {
        container.innerHTML = '<div class="acad-empty"><i class="fa-solid fa-calendar-check"></i><span>No exams scheduled<br>Add your first exam to track countdown</span></div>';
        return;
    }

    exams.forEach(exam => {
        const subj = getSubjectById(exam.subjectId);
        const urgent = exam._days <= 7 && exam._days >= 0;
        const past = exam._days < 0;

        const card = document.createElement('div');
        card.className = 'acad-exam' + (urgent ? ' acad-exam--urgent' : '') + (past ? ' acad-exam--past' : '');
        card.innerHTML = `
            <div class="acad-exam__info">
                <div class="acad-exam__name">${exam.name}</div>
                <div class="acad-exam__meta">
                    ${subj ? `<span class="acad-exam__subj" style="background:${subj.color}14;color:${subj.color}">${subj.name}</span>` : `<span class="acad-exam__subj" style="opacity:0.4;font-style:italic">No subject</span>`}
                    <span class="acad-exam__date"><i class="fa-regular fa-calendar"></i> ${new Date(exam.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
            </div>
            <div class="acad-exam__badge ${urgent ? 'acad-exam__badge--urgent' : ''} ${past ? 'acad-exam__badge--past' : ''}">
                ${past ? '<i class="fa-solid fa-check"></i>' : exam._days === 0 ? 'Today!' : exam._days + 'd'}
            </div>
            <button class="acad-exam__del" data-exam-id="${exam.id}" title="Delete"><i class="fa-solid fa-xmark"></i></button>
        `;
        container.appendChild(card);
    });

    // Clean up previous listener to prevent stacking
    if (container._examClickHandler) {
        container.removeEventListener('click', container._examClickHandler);
    }
    container._examClickHandler = function (e) {
        const del = e.target.closest('.acad-exam__del');
        if (del) removeExam(del.dataset.examId);
    };
    container.addEventListener('click', container._examClickHandler);
}

// ─── 4. FOCUS TIMER ─────────────────────────────────────────────────────────

let focusTimerState = {
    duration: 25 * 60,  // seconds
    remaining: 25 * 60,
    running: false,
    intervalId: null,
    subjectId: null,
    bypassExitWarning: false  // Flag to bypass Focus Lock warning
};

// Expose timer state for Focus Lock Mode integration
window.focusTimerState = focusTimerState;

function initFocusTimer() {
    const startBtn = document.getElementById('focusTimerStart');
    const pauseBtn = document.getElementById('focusTimerPause');
    const resetBtn = document.getElementById('focusTimerReset');
    const durInput = document.getElementById('focusTimerDuration');

    if (durInput) {
        durInput.value = 25;
        durInput.addEventListener('change', () => {
            if (focusTimerState.running) return;
            const mins = Math.max(1, Math.min(120, Number(durInput.value) || 25));
            durInput.value = mins;
            focusTimerState.duration = mins * 60;
            focusTimerState.remaining = mins * 60;
            updateTimerDisplay();
        });
    }

    if (startBtn) startBtn.addEventListener('click', () => {
        if (focusTimerState.running) return;
        focusTimerState.running = true;
        focusTimerState.intervalId = setInterval(tickTimer, 1000);
        startBtn.style.display = 'none';
        if (pauseBtn) pauseBtn.style.display = '';
        
        // Activate Focus Lock Mode
        if (typeof FocusLockMode !== 'undefined') {
            const subjectSelect = document.getElementById('focusTimerSubject');
            const subjectId = subjectSelect?.value || null;
            let taskName = null;
            
            // Try to get subject name
            if (subjectId) {
                const subjects = getLS('subjects');
                const subject = subjects.find(s => s.id === subjectId);
                if (subject) {
                    taskName = `Study ${subject.name}`;
                }
            }
            
            FocusLockMode.activateFocusMode(focusTimerState.remaining, taskName);
        }
    });

    if (pauseBtn) pauseBtn.addEventListener('click', () => {
        // Check if Focus Lock Mode is active and show warning (unless bypassed)
        if (typeof FocusLockMode !== 'undefined' && FocusLockMode.isActive() && !focusTimerState.bypassExitWarning) {
            FocusLockMode.showExitWarning();
            return; // Don't pause yet, let user confirm
        }
        
        focusTimerState.running = false;
        clearInterval(focusTimerState.intervalId);
        pauseBtn.style.display = 'none';
        if (startBtn) startBtn.style.display = '';
        focusTimerState.bypassExitWarning = false; // Reset bypass flag
    });

    if (resetBtn) resetBtn.addEventListener('click', resetTimer);

    updateTimerDisplay();
}

function tickTimer() {
    if (focusTimerState.remaining <= 0) {
        clearInterval(focusTimerState.intervalId);
        focusTimerState.running = false;
        completeSession();
        return;
    }
    focusTimerState.remaining--;
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const mins = Math.floor(focusTimerState.remaining / 60);
    const secs = focusTimerState.remaining % 60;
    const display = document.getElementById('focusTimerDisplay');
    if (display) display.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    // Update circular progress
    const circle = document.getElementById('focusTimerCircle');
    if (circle) {
        const pct = 1 - (focusTimerState.remaining / focusTimerState.duration);
        const circumference = 2 * Math.PI * 120; // r=120
        circle.style.strokeDashoffset = circumference * (1 - pct);
    }
}

function completeSession() {
    // Play completion sound
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 800;
        gain.gain.value = 0.3;
        osc.start(); osc.stop(ctx.currentTime + 0.3);
        setTimeout(() => { const o2 = ctx.createOscillator(); const g2 = ctx.createGain(); o2.connect(g2); g2.connect(ctx.destination); o2.frequency.value = 1000; g2.gain.value = 0.3; o2.start(); o2.stop(ctx.currentTime + 0.4); }, 350);
    } catch (e) { /* audio not available */ }

    // Save session
    const session = {
        id: uid(),
        subjectId: focusTimerState.subjectId || document.getElementById('focusTimerSubject')?.value || null,
        duration: focusTimerState.duration,
        completedAt: new Date().toISOString()
    };
    const sessions = getLS('focusSessions');
    sessions.push(session);
    setLS('focusSessions', sessions);
    if (typeof saveFocusSessionToFirestore === 'function') saveFocusSessionToFirestore(session);

    // --- Premium XP & Badge hooks ---
    if (typeof XPSystem !== 'undefined') XPSystem.onFocusSessionComplete();
    if (typeof BadgeSystem !== 'undefined') BadgeSystem.checkFocusBadges();
    // Premium focus completion celebration
    if (typeof PremiumInteractions !== 'undefined') {
        const minutes = Math.round(session.duration / 60);
        PremiumInteractions.animateFocusCompletion(minutes, 15);
    }

    // Deactivate Focus Lock Mode - session completed successfully
    if (typeof FocusLockMode !== 'undefined' && FocusLockMode.isActive()) {
        FocusLockMode.deactivateFocusMode(true);
    }

    resetTimer();
    renderFocusStats();

    // Show completion message
    const display = document.getElementById('focusTimerDisplay');
    if (display) {
        display.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#22c55e"></i> Done!';
        setTimeout(() => updateTimerDisplay(), 2000);
    }

    // Premium notification
    const sessionMins = Math.round(focusTimerState.duration / 60);
    if (typeof Notify !== 'undefined') Notify.success(`${sessionMins} min focus session completed!`, { title: '🎯 Session Complete' });
}

function resetTimer() {
    clearInterval(focusTimerState.intervalId);
    focusTimerState.running = false;
    focusTimerState.remaining = focusTimerState.duration;
    updateTimerDisplay();
    const startBtn = document.getElementById('focusTimerStart');
    const pauseBtn = document.getElementById('focusTimerPause');
    if (startBtn) startBtn.style.display = '';
    if (pauseBtn) pauseBtn.style.display = 'none';
    
    // Deactivate Focus Lock Mode if active (early exit)
    if (typeof FocusLockMode !== 'undefined' && FocusLockMode.isActive()) {
        FocusLockMode.deactivateFocusMode(false);
    }
}

function renderFocusStats() {
    const sessions = getLS('focusSessions');
    const now = new Date();
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekSessions = sessions.filter(s => new Date(s.completedAt) >= weekStart);
    const totalSecs = weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);

    const el = document.getElementById('focusWeeklyStats');
    if (el) el.innerHTML = `<i class="fa-solid fa-chart-simple"></i> ${hours}h ${mins}m this week &bull; ${weekSessions.length} sessions`;

    const countEl = document.getElementById('focusTotalSessions');
    if (countEl) countEl.textContent = sessions.length;
}

// ─── 5. ACADEMIC ANALYTICS (Profile modal) ─────────────────────────────────

function renderAcademicAnalytics() {
    const container = document.getElementById('academicAnalytics');
    if (!container) return;

    const sessions = getLS('focusSessions');
    const subjects = getSubjects();
    const blocks = getStudyBlocks();
    const now = new Date();
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    // Total study hours this week (focus sessions)
    const weekSessions = sessions.filter(s => new Date(s.completedAt) >= weekStart);
    const totalSecs = weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const totalHours = (totalSecs / 3600).toFixed(1);

    // Most studied subject
    const subjTime = {};
    weekSessions.forEach(s => {
        if (s.subjectId) subjTime[s.subjectId] = (subjTime[s.subjectId] || 0) + (s.duration || 0);
    });
    let mostStudied = null, maxTime = 0;
    Object.entries(subjTime).forEach(([id, time]) => { if (time > maxTime) { maxTime = time; mostStudied = id; } });
    const mostSubj = mostStudied ? getSubjectById(mostStudied) : null;

    // Average session duration
    const avgDur = weekSessions.length ? Math.round(totalSecs / weekSessions.length / 60) : 0;

    // Consistency: how many of the last 7 days had at least 1 session
    const daysWithSessions = new Set();
    sessions.forEach(s => {
        const d = new Date(s.completedAt);
        if (d >= weekStart) daysWithSessions.add(d.toDateString());
    });
    const consistency = Math.round((daysWithSessions.size / 7) * 100);

    // Planned hours
    const plannedMins = blocks.reduce((s, b) => s + (b.duration || 0), 0);
    const plannedHours = (plannedMins / 60).toFixed(1);

    container.innerHTML = `
        <div class="acad-analytics__grid">
            <div class="acad-analytics__stat">
                <div class="acad-analytics__stat-icon" style="color:var(--accent-color);background:rgba(var(--accent-rgb),0.08)">
                    <i class="fa-solid fa-clock"></i>
                </div>
                <span class="acad-analytics__stat-val">${totalHours}h</span>
                <span class="acad-analytics__stat-label">Study This Week</span>
            </div>
            <div class="acad-analytics__stat">
                <div class="acad-analytics__stat-icon" style="color:${mostSubj ? mostSubj.color : 'var(--text-color)'};background:${mostSubj ? mostSubj.color + '14' : 'var(--input-bg)'}">
                    <i class="fa-solid fa-book-bookmark"></i>
                </div>
                <span class="acad-analytics__stat-val">${mostSubj ? mostSubj.name : '—'}</span>
                <span class="acad-analytics__stat-label">Most Focused</span>
            </div>
            <div class="acad-analytics__stat">
                <div class="acad-analytics__stat-icon" style="color:#8b5cf6;background:#8b5cf614">
                    <i class="fa-solid fa-stopwatch"></i>
                </div>
                <span class="acad-analytics__stat-val">${avgDur}m</span>
                <span class="acad-analytics__stat-label">Avg Session</span>
            </div>
            <div class="acad-analytics__stat">
                <div class="acad-analytics__stat-icon" style="color:#22c55e;background:#22c55e14">
                    <i class="fa-solid fa-bullseye"></i>
                </div>
                <span class="acad-analytics__stat-val">${consistency}%</span>
                <span class="acad-analytics__stat-label">Consistency</span>
            </div>
        </div>
        <div class="acad-analytics__insights">
            ${mostSubj ? `<div class="acad-analytics__insight"><i class="fa-solid fa-book-open" style="color:#8b5cf6"></i><p>${mostSubj.name} is your most focused subject this week.</p></div>` : ''}
            ${weekSessions.length >= 3 ? `<div class="acad-analytics__insight"><i class="fa-solid fa-fire" style="color:#f59e0b"></i><p>${weekSessions.length} focus sessions this week — keep it up!</p></div>` : ''}
            ${consistency >= 70 ? `<div class="acad-analytics__insight"><i class="fa-solid fa-star" style="color:#eab308"></i><p>${consistency}% consistency — you're building great study habits!</p></div>` : consistency > 0 ? `<div class="acad-analytics__insight"><i class="fa-solid fa-dumbbell" style="color:var(--accent-color)"></i><p>Try to study more consistently — aim for at least 5 days per week.</p></div>` : ''}
            ${Number(plannedHours) > 0 ? `<div class="acad-analytics__insight"><i class="fa-regular fa-calendar-days" style="color:#14b8a6"></i><p>${plannedHours}h planned across your weekly schedule.</p></div>` : ''}
        </div>
    `;
}

// ─── ACADEMICS PANEL TOGGLE ─────────────────────────────────────────────────

function openAcademicsPanel() {
    const panel = document.getElementById('academicsPanel');
    if (panel) {
        panel.style.display = 'flex';
        panel.classList.add('show');
        document.body.classList.add('modal-open');
        renderStudyPlanner();
        renderExams();
        renderFocusStats();
        populateSubjectSelects();
        updateTimerDisplay();
    }
}

function closeAcademicsPanel() {
    const panel = document.getElementById('academicsPanel');
    if (panel) {
        panel.classList.remove('show');
        document.body.classList.remove('modal-open');
        setTimeout(() => { panel.style.display = 'none'; }, 300);
    }
}

// ─── INITIALIZATION ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // Render subject chips on load
    renderSubjectChips();

    // Init focus timer
    initFocusTimer();

    // Study block modal
    const sbModal = document.getElementById('studyBlockModal');
    if (sbModal) {
        sbModal.querySelector('#saveStudyBlock')?.addEventListener('click', () => {
            const day = sbModal.querySelector('#studyBlockDay').value;
            const subj = sbModal.querySelector('#studyBlockSubject').value;
            const dur = sbModal.querySelector('#studyBlockDuration').value;
            const startTime = sbModal.querySelector('#studyBlockStartTime')?.value || null;
            if (!day) {
                if (typeof Notify !== 'undefined') Notify.warning('Please select a day.'); else alert('Please select a day.');
                return;
            }
            if (dur && Number(dur) > 0) {
                addStudyBlock(day, subj, dur, startTime);
                sbModal.classList.remove('show');
                document.body.classList.remove('modal-open');
                setTimeout(() => { sbModal.style.display = 'none'; }, 300);
            }
        });
        sbModal.querySelector('#cancelStudyBlock')?.addEventListener('click', () => {
            sbModal.classList.remove('show');
            document.body.classList.remove('modal-open');
            setTimeout(() => { sbModal.style.display = 'none'; }, 300);
        });
        sbModal.addEventListener('click', e => {
            if (e.target === sbModal) {
                sbModal.classList.remove('show');
                document.body.classList.remove('modal-open');
                setTimeout(() => { sbModal.style.display = 'none'; }, 300);
            }
        });

        // Day chip selection in modal
        const dayChips = sbModal.querySelectorAll('.day-chip');
        dayChips.forEach(chip => {
            chip.addEventListener('click', () => {
                dayChips.forEach(c => c.classList.remove('selected'));
                chip.classList.add('selected');
                sbModal.querySelector('#studyBlockDay').value = chip.dataset.day;
            });
        });
    }

    // Mobile "Add Study Plan" button handler
    const mobileAddStudyPlanBtn = document.getElementById('mobileAddStudyPlanBtn');
    if (mobileAddStudyPlanBtn) {
        mobileAddStudyPlanBtn.addEventListener('click', () => {
            const modal = document.getElementById('studyBlockModal');
            if (!modal) return;
            modal.style.display = 'flex';
            populateSubjectSelects();
            modal.querySelector('#studyBlockSubject').value = '';
            modal.querySelector('#studyBlockDuration').value = '30';
            // Reset day selection
            modal.querySelector('#studyBlockDay').value = '';
            modal.querySelectorAll('.day-chip').forEach(c => c.classList.remove('selected'));
            modal.classList.add('show');
            document.body.classList.add('modal-open');
        });
    }

    // Exam form
    const addExamBtn = document.getElementById('addExamBtn');
    if (addExamBtn) {
        addExamBtn.addEventListener('click', () => {
            const name = document.getElementById('examNameInput')?.value;
            const subj = document.getElementById('examSubjectSelect')?.value;
            const date = document.getElementById('examDateInput')?.value;
            if (!name?.trim() || !date) { if (typeof Notify !== 'undefined') Notify.warning('Please enter exam name and date.'); else alert('Please enter exam name and date.'); return; }
            addExam(name, subj, date);
            document.getElementById('examNameInput').value = '';
            document.getElementById('examDateInput').value = '';
        });
    }

    // Hook into profile modal to render analytics
    const profileBtn = document.getElementById('profileBtn');
    if (profileBtn) {
        profileBtn.addEventListener('click', () => setTimeout(renderAcademicAnalytics, 100));
    }
    const sidebarProfileBtn = document.getElementById('sidebarProfileBtn');
    if (sidebarProfileBtn) {
        sidebarProfileBtn.addEventListener('click', () => setTimeout(renderAcademicAnalytics, 100));
    }

    // Load Firestore data if user is logged in
    setTimeout(() => {
        if (typeof currentUserId !== 'undefined' && currentUserId) {
            if (typeof loadSubjectsFromFirestore === 'function') loadSubjectsFromFirestore();
            if (typeof loadStudyBlocksFromFirestore === 'function') loadStudyBlocksFromFirestore();
            if (typeof loadExamsFromFirestore === 'function') loadExamsFromFirestore();
            if (typeof loadFocusSessionsFromFirestore === 'function') loadFocusSessionsFromFirestore();
        }
    }, 1500);
});
