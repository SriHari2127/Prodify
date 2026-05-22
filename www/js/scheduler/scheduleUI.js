// ===== STUDY SCHEDULE UI MODULE =====
// Renders study schedules with professional UI components

const ScheduleUI = (function() {
    'use strict';

    // ===== RENDERING FUNCTIONS =====
    
    /**
     * Render daily schedule on Today dashboard
     */
    async function renderTodaySchedule() {
        const container = document.getElementById('todayScheduleContainer');
        if (!container) {
            console.warn('Schedule container not found');
            return;
        }

        try {
            // Generate schedule for today
            const schedule = await StudyScheduler.generateDailySchedule();
            
            if (!schedule || schedule.blocks.length === 0) {
                renderEmptySchedule(container);
                return;
            }

            // Render schedule
            container.innerHTML = `
                <div class="schedule-card">
                    <div class="schedule-header">
                        <div class="schedule-header__left">
                            <h3 class="schedule-title">
                                <i class="fa-solid fa-calendar-check"></i>
                                Today's Study Plan
                            </h3>
                            <p class="schedule-subtitle">
                                ${schedule.sessionCount} sessions • ${Math.floor(schedule.totalMinutes / 60)}h ${schedule.totalMinutes % 60}m
                            </p>
                        </div>
                        <button class="schedule-refresh-btn" onclick="ScheduleUI.refreshSchedule()">
                            <i class="fa-solid fa-rotate"></i>
                        </button>
                    </div>
                    
                    <div class="schedule-timeline">
                        ${renderTimelineBlocks(schedule.blocks)}
                    </div>
                    
                    <div class="schedule-footer">
                        <button class="schedule-view-week-btn" onclick="ScheduleUI.showWeeklyView()">
                            <i class="fa-solid fa-calendar-week"></i>
                            View Weekly Plan
                        </button>
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('❌ Error rendering schedule:', error);
            container.innerHTML = '<p class="error-message">Failed to load schedule</p>';
        }
    }

    /**
     * Render next recommended session widget
     */
    function renderNextSession() {
        const container = document.getElementById('nextSessionWidget');
        if (!container) return;

        const schedule = StudyScheduler.getCurrentSchedule();
        if (!schedule || schedule.blocks.length === 0) {
            container.style.display = 'none';
            return;
        }

        // Find next study block (not break)
        const nextBlock = schedule.blocks.find(b => b.type !== 'break');
        if (!nextBlock) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        container.innerHTML = `
            <div class="next-session-card" style="border-left: 4px solid ${nextBlock.color}">
                <div class="next-session-badge">
                    <i class="fa-solid fa-circle-play"></i>
                    NEXT UP
                </div>
                <h4 class="next-session-subject">${nextBlock.subjectName || 'Study Session'}</h4>
                <p class="next-session-task">${nextBlock.task}</p>
                <div class="next-session-meta">
                    <span class="session-duration">
                        <i class="fa-solid fa-clock"></i>
                        ${nextBlock.duration} min
                    </span>
                    <span class="session-type">
                        ${getSessionTypeLabel(nextBlock.type)}
                    </span>
                </div>
                <button class="start-session-btn" onclick="ScheduleUI.startSession('${nextBlock.id}')">
                    <i class="fa-solid fa-play"></i>
                    Start Session
                </button>
            </div>
        `;
    }

    /**
     * Render timeline blocks
     */
    function renderTimelineBlocks(blocks) {
        return blocks.map((block, index) => {
            if (block.type === 'break') {
                return renderBreakBlock(block);
            }
            return renderStudyBlock(block, index);
        }).join('');
    }

    function renderStudyBlock(block, index) {
        const typeIcon = getSessionTypeIcon(block.type);
        const typeLabel = getSessionTypeLabel(block.type);
        const urgencyClass = getUrgencyClass(block.priorityScore);

        return `
            <div class="timeline-block ${urgencyClass}" style="border-left-color: ${block.color}" data-block-id="${block.id}">
                <div class="timeline-marker" style="background: ${block.color}">
                    ${index + 1}
                </div>
                <div class="timeline-content">
                    <div class="timeline-header">
                        <h4 class="timeline-subject">${block.subjectName || 'Study'}</h4>
                        <span class="timeline-duration">${block.duration} min</span>
                    </div>
                    <p class="timeline-task">
                        <i class="${typeIcon}"></i>
                        ${block.task}
                    </p>
                    ${block.examDate ? `
                        <div class="timeline-exam-badge">
                            <i class="fa-solid fa-graduation-cap"></i>
                            Exam in ${getDaysUntil(block.examDate)} days
                        </div>
                    ` : ''}
                    <div class="timeline-meta">
                        <span class="session-type-badge">${typeLabel}</span>
                        ${block.priorityScore ? `
                            <span class="priority-badge">Priority: ${Math.round(block.priorityScore)}</span>
                        ` : ''}
                    </div>
                    <button class="timeline-start-btn" onclick="ScheduleUI.startSession('${block.id}')">
                        <i class="fa-solid fa-play"></i>
                        Start
                    </button>
                </div>
            </div>
        `;
    }

    function renderBreakBlock(block) {
        return `
            <div class="timeline-block timeline-break">
                <div class="timeline-marker break-marker">
                    <i class="fa-solid fa-mug-hot"></i>
                </div>
                <div class="timeline-content">
                    <h4 class="timeline-subject">Break Time</h4>
                    <p class="timeline-task">Take a ${block.duration}-minute break</p>
                </div>
            </div>
        `;
    }

    function renderEmptySchedule(container) {
        container.innerHTML = `
            <div class="schedule-empty">
                <div class="schedule-empty__icon">
                    <i class="fa-solid fa-calendar-xmark"></i>
                </div>
                <h3>No Schedule Yet</h3>
                <p>Add exams, tasks, or subjects to generate your study plan</p>
                <button class="auth-btn" onclick="ScheduleUI.generateSchedule()">
                    <i class="fa-solid fa-wand-magic-sparkles"></i>
                    Generate Schedule
                </button>
            </div>
        `;
    }

    /**
     * Render weekly schedule view
     */
    async function showWeeklyView() {
        try {
            const weeklySchedule = await StudyScheduler.generateWeeklySchedule();
            
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.id = 'weeklyScheduleModal';
            modal.innerHTML = `
                <div class="modal-box weekly-schedule-modal">
                    <div class="modal-header">
                        <h3>
                            <i class="fa-solid fa-calendar-week"></i>
                            Weekly Study Plan
                        </h3>
                        <button class="modal-close-btn" onclick="ScheduleUI.closeWeeklyView()">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    
                    <div class="weekly-summary">
                        <div class="weekly-stat">
                            <span class="weekly-stat-value">${Math.round(weeklySchedule.totalMinutes / 60)}</span>
                            <span class="weekly-stat-label">Hours</span>
                        </div>
                        <div class="weekly-stat">
                            <span class="weekly-stat-value">${weeklySchedule.totalSessions}</span>
                            <span class="weekly-stat-label">Sessions</span>
                        </div>
                        <div class="weekly-stat">
                            <span class="weekly-stat-value">${weeklySchedule.days.length}</span>
                            <span class="weekly-stat-label">Days</span>
                        </div>
                    </div>
                    
                    <div class="weekly-days-grid">
                        ${weeklySchedule.days.map(day => renderDayCard(day)).join('')}
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            setTimeout(() => modal.style.display = 'flex', 10);

        } catch (error) {
            console.error('❌ Error showing weekly view:', error);
            if (typeof Notify !== 'undefined') {
                Notify.error('Failed to load weekly schedule');
            }
        }
    }

    function renderDayCard(daySchedule) {
        const date = new Date(daySchedule.date);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dayNum = date.getDate();
        const isToday = daySchedule.date === new Date().toISOString().split('T')[0];

        return `
            <div class="weekly-day-card ${isToday ? 'today' : ''}">
                <div class="day-card-header">
                    <span class="day-name">${dayName}</span>
                    <span class="day-num">${dayNum}</span>
                </div>
                <div class="day-card-stats">
                    <span>${daySchedule.sessionCount} sessions</span>
                    <span>${Math.round(daySchedule.totalMinutes / 60)}h ${daySchedule.totalMinutes % 60}m</span>
                </div>
                <div class="day-card-subjects">
                    ${renderDaySubjects(daySchedule.blocks)}
                </div>
            </div>
        `;
    }

    function renderDaySubjects(blocks) {
        const subjects = blocks
            .filter(b => b.type !== 'break' && b.subjectName)
            .slice(0, 3);
        
        if (subjects.length === 0) {
            return '<span class="no-sessions">No sessions</span>';
        }

        return subjects.map(s => `
            <span class="subject-chip" style="background: ${s.color}20; color: ${s.color}">
                ${s.subjectName}
            </span>
        `).join('');
    }

    function closeWeeklyView() {
        const modal = document.getElementById('weeklyScheduleModal');
        if (modal) modal.remove();
    }

    // ===== INTERACTION HANDLERS =====
    
    async function startSession(blockId) {
        const schedule = StudyScheduler.getCurrentSchedule();
        if (!schedule) return;

        const block = schedule.blocks.find(b => b.id === blockId);
        if (!block) return;

        // Switch to academics tab and start focus timer
        if (typeof switchTab === 'function') {
            switchTab('academics');
        }

        // Set focus timer duration
        setTimeout(() => {
            const durationInput = document.getElementById('focusTimerDuration');
            const subjectSelect = document.getElementById('focusTimerSubject');
            const startBtn = document.getElementById('focusTimerStart');

            if (durationInput) {
                durationInput.value = block.duration;
                // Trigger change event to update timer
                durationInput.dispatchEvent(new Event('change'));
            }

            if (subjectSelect && block.subjectId) {
                subjectSelect.value = block.subjectId;
            }

            // Auto-start timer
            if (startBtn && startBtn.style.display !== 'none') {
                startBtn.click();
            }

            if (typeof Notify !== 'undefined') {
                Notify.info(`Starting ${block.duration}-minute session for ${block.subjectName}`);
            }
        }, 500);
    }

    async function refreshSchedule() {
        const btn = document.querySelector('.schedule-refresh-btn');
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i>';
            btn.disabled = true;
        }

        try {
            await StudyScheduler.generateDailySchedule(undefined, { forceRefresh: true });
            await renderTodaySchedule();
            renderNextSession();

            if (typeof Notify !== 'undefined') {
                Notify.success('Schedule refreshed!');
            }
        } catch (error) {
            console.error('Failed to refresh schedule:', error);
            if (typeof Notify !== 'undefined') {
                Notify.error('Failed to refresh schedule');
            }
        } finally {
            if (btn) {
                btn.innerHTML = '<i class="fa-solid fa-rotate"></i>';
                btn.disabled = false;
            }
        }
    }

    async function generateSchedule() {
        await refreshSchedule();
    }

    // ===== UTILITY FUNCTIONS =====
    
    function getSessionTypeIcon(type) {
        const icons = {
            deepWork: 'fa-solid fa-book-open',
            practice: 'fa-solid fa-pen',
            revision: 'fa-solid fa-rotate',
            mockTest: 'fa-solid fa-clipboard-check',
            flashReview: 'fa-solid fa-bolt'
        };
        return icons[type] || 'fa-solid fa-book';
    }

    function getSessionTypeLabel(type) {
        const labels = {
            deepWork: 'Deep Study',
            practice: 'Practice',
            revision: 'Revision',
            mockTest: 'Mock Test',
            flashReview: 'Quick Review'
        };
        return labels[type] || 'Study';
    }

    function getUrgencyClass(priorityScore) {
        if (!priorityScore) return '';
        if (priorityScore >= 700) return 'urgent';
        if (priorityScore >= 400) return 'high-priority';
        return '';
    }

    function getDaysUntil(dateStr) {
        const target = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        target.setHours(0, 0, 0, 0);
        const diffMs = target - today;
        return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }

    // ===== INITIALIZATION =====
    
    function init() {
        // Listen for schedule generation
        document.addEventListener('scheduleGenerated', () => {
            renderNextSession();
        });

        // Listen for tab switches
        document.addEventListener('tabSwitched', (e) => {
            if (e.detail === 'today') {
                renderTodaySchedule();
                renderNextSession();
            }
        });
    }

    // ===== PUBLIC API =====
    
    return {
        init,
        renderTodaySchedule,
        renderNextSession,
        showWeeklyView,
        closeWeeklyView,
        startSession,
        refreshSchedule,
        generateSchedule
    };
})();

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
    ScheduleUI.init();
});

// Export globally
window.ScheduleUI = ScheduleUI;
