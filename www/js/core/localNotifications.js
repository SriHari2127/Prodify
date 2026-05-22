// ===== LOCAL NOTIFICATIONS MODULE (localNotifications.js) =====
// Comprehensive notification system for Tasks, Habits, Study Sessions & Exams
// Uses Capacitor Local Notifications plugin

const AppReminders = (function () {
    'use strict';

    // Map app day abbreviations to Capacitor Weekday enum (1=Sun..7=Sat)
    const DAY_MAP = { 'Sun': 1, 'Mon': 2, 'Tue': 3, 'Wed': 4, 'Thu': 5, 'Fri': 6, 'Sat': 7 };

    const SETTINGS_KEY = 'prodify_notificationsEnabled';

    // Channel IDs
    const CHANNELS = {
        HABITS:  'habit-reminders',
        TASKS:   'task-reminders',
        STUDY:   'study-reminders',
        EXAMS:   'exam-reminders'
    };

    let _initialized = false;
    let _permissionGranted = false;

    // ─── Check if native platform ──────────────────────────────────
    function isNative() {
        return typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
    }

    // ─── Check if notifications are enabled by user ────────────────
    function isEnabled() {
        const val = localStorage.getItem(SETTINGS_KEY);
        return val === null ? true : val === 'true'; // Default: enabled
    }

    function setEnabled(enabled) {
        localStorage.setItem(SETTINGS_KEY, String(enabled));
        // Sync to Firestore
        if (typeof currentUserId !== 'undefined' && currentUserId && typeof firebase !== 'undefined') {
            firebase.firestore().collection('users').doc(currentUserId)
                .set({ settings: { notificationsEnabled: enabled } }, { merge: true })
                .catch(e => console.warn('Notifications setting sync failed:', e));
        }
    }

    async function loadEnabledFromFirestore() {
        if (typeof currentUserId === 'undefined' || !currentUserId || typeof firebase === 'undefined') return;
        try {
            const doc = await firebase.firestore().collection('users').doc(currentUserId).get();
            if (doc.exists && doc.data().settings && typeof doc.data().settings.notificationsEnabled === 'boolean') {
                localStorage.setItem(SETTINGS_KEY, String(doc.data().settings.notificationsEnabled));
            }
        } catch (e) { /* silent */ }
    }

    // ─── Generate unique notification ID (positive int32) ──────────
    function hashId(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & 0x7FFFFFFF;
        }
        return hash || 1;
    }

    // ─── Initialize ────────────────────────────────────────────────
    async function init() {
        if (!isNative()) {
            console.log('🔔 Local Notifications: Not native, skipping.');
            return;
        }
        if (_initialized) return;

        try {
            const { LocalNotifications } = Capacitor.Plugins;
            if (!LocalNotifications) {
                console.warn('⚠️ LocalNotifications plugin not available');
                return;
            }

            // Request permission
            let permStatus = await LocalNotifications.checkPermissions();
            if (permStatus.display === 'prompt') {
                permStatus = await LocalNotifications.requestPermissions();
            }
            _permissionGranted = permStatus.display === 'granted';
            if (!_permissionGranted) {
                console.warn('⚠️ Local notification permission denied');
                return;
            }

            // Set up tap listener
            await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
                console.log('👆 Notification tapped:', action);
                const tab = action.notification?.extra?.tab;
                if (tab && typeof switchTab === 'function') {
                    setTimeout(() => switchTab(tab), 300);
                }
            });

            // Create notification channels for Android
            const channelDefs = [
                { id: CHANNELS.HABITS, name: 'Habit Reminders', description: 'Daily habit reminder notifications' },
                { id: CHANNELS.TASKS, name: 'Task Reminders', description: 'Task deadline reminder notifications' },
                { id: CHANNELS.STUDY, name: 'Study Reminders', description: 'Study session start notifications' },
                { id: CHANNELS.EXAMS, name: 'Exam Reminders', description: 'Exam countdown notifications' }
            ];
            for (const ch of channelDefs) {
                try {
                    await LocalNotifications.createChannel({
                        ...ch, importance: 4, sound: 'default', vibration: true
                    });
                } catch (e) { /* channel may already exist */ }
            }

            _initialized = true;
            console.log('✅ Local Notifications initialized');

            // Load user setting from Firestore
            await loadEnabledFromFirestore();

            // Schedule everything on init
            if (isEnabled()) {
                await scheduleAllHabits();
                await scheduleAllTaskReminders();
                await scheduleAllExamReminders();
                await scheduleAllStudyReminders();
            }

        } catch (error) {
            console.error('❌ Local Notifications init error:', error);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  HABIT REMINDERS (existing logic preserved & enhanced)
    // ═══════════════════════════════════════════════════════════════

    async function scheduleAllHabits() {
        if (!isNative() || !_permissionGranted || !isEnabled()) return;

        try {
            const { LocalNotifications } = Capacitor.Plugins;

            // Cancel existing habit notifications
            await cancelByPrefix('habit_');

            const habits = JSON.parse(localStorage.getItem('habits')) || [];
            const notifications = [];

            habits.forEach(habit => {
                if (!habit.reminderTime || !Array.isArray(habit.reminderTime) || habit.reminderTime.length === 0) return;

                habit.reminderTime.forEach(timeStr => {
                    const [hours, minutes] = timeStr.split(':').map(Number);
                    if (isNaN(hours) || isNaN(minutes)) return;

                    if (habit.frequency === 'specific_days' && habit.targetDays && habit.targetDays.length > 0) {
                        habit.targetDays.forEach(dayStr => {
                            const weekday = DAY_MAP[dayStr];
                            if (!weekday) return;

                            const id = hashId(`habit_${habit.id}_${timeStr}_${dayStr}`);
                            notifications.push({
                                id,
                                title: '🎯 Habit Reminder',
                                body: `Time to complete your ${habit.name} habit.`,
                                channelId: CHANNELS.HABITS,
                                schedule: {
                                    on: { hour: hours, minute: minutes, weekday },
                                    repeats: true,
                                    allowWhileIdle: true
                                },
                                extra: { habitId: habit.id, tab: 'habits', type: 'habit' }
                            });
                            trackId(`habit_${habit.id}`, id);
                        });
                    } else {
                        const id = hashId(`habit_${habit.id}_${timeStr}`);
                        notifications.push({
                            id,
                            title: '🎯 Habit Reminder',
                            body: `Time to complete your ${habit.name} habit.`,
                            channelId: CHANNELS.HABITS,
                            schedule: {
                                on: { hour: hours, minute: minutes },
                                repeats: true,
                                allowWhileIdle: true
                            },
                            extra: { habitId: habit.id, tab: 'habits', type: 'habit' }
                        });
                        trackId(`habit_${habit.id}`, id);
                    }
                });
            });

            if (notifications.length > 0) {
                await LocalNotifications.schedule({ notifications });
                console.log(`✅ Scheduled ${notifications.length} habit reminders`);
            }
        } catch (error) {
            console.error('❌ Error scheduling habit reminders:', error);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  TASK REMINDERS — multiple alerts before deadline
    // ═══════════════════════════════════════════════════════════════

    // Offsets in milliseconds: 2 days, 1 day, 12 hours, 1 hour
    const TASK_OFFSETS = [
        { ms: 2 * 24 * 60 * 60 * 1000, label: 'in 2 days' },
        { ms: 1 * 24 * 60 * 60 * 1000, label: 'in 1 day' },
        { ms: 12 * 60 * 60 * 1000,      label: 'in 12 hours' },
        { ms: 1 * 60 * 60 * 1000,       label: 'in 1 hour' }
    ];

    function scheduleTaskReminder(task) {
        if (!isNative() || !_permissionGranted || !isEnabled()) return;
        if (!task || !task.dueDate || task.completed) return;

        _scheduleTaskAsync(task);
    }

    async function _scheduleTaskAsync(task) {
        try {
            const { LocalNotifications } = Capacitor.Plugins;

            // Cancel previous reminders for this task
            await cancelByPrefix(`task_${task.id}`);

            // Build deadline Date
            const deadlineStr = task.dueTime
                ? `${task.dueDate}T${task.dueTime}:00`
                : `${task.dueDate}T23:59:00`;
            const deadline = new Date(deadlineStr);
            if (isNaN(deadline.getTime())) return;

            const now = Date.now();
            const notifications = [];

            TASK_OFFSETS.forEach((offset, idx) => {
                const triggerTime = deadline.getTime() - offset.ms;
                if (triggerTime <= now) return; // Skip past triggers

                const id = hashId(`task_${task.id}_offset_${idx}`);
                notifications.push({
                    id,
                    title: '📋 Task Reminder',
                    body: `Your task "${task.text}" is due ${offset.label}.`,
                    channelId: CHANNELS.TASKS,
                    schedule: {
                        at: new Date(triggerTime),
                        allowWhileIdle: true
                    },
                    extra: { taskId: task.id, tab: 'tasks', type: 'task' }
                });
                trackId(`task_${task.id}`, id);
            });

            if (notifications.length > 0) {
                await LocalNotifications.schedule({ notifications });
                console.log(`✅ Scheduled ${notifications.length} reminders for task "${task.text}"`);
            }
        } catch (error) {
            console.error('❌ Error scheduling task reminders:', error);
        }
    }

    function cancelTaskReminder(taskId) {
        if (!isNative()) return;
        cancelByPrefix(`task_${taskId}`);
    }

    async function scheduleAllTaskReminders() {
        if (!isNative() || !_permissionGranted || !isEnabled()) return;

        try {
            await cancelByPrefix('task_');

            const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
            for (const task of tasks) {
                if (task.dueDate && !task.completed) {
                    await _scheduleTaskAsync(task);
                }
            }
        } catch (error) {
            console.error('❌ Error scheduling all task reminders:', error);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  EXAM REMINDERS — multi-alert at 10, 5, 2, 1 days before
    // ═══════════════════════════════════════════════════════════════

    const EXAM_OFFSETS = [
        { days: 10, label: 'in 10 days' },
        { days: 5,  label: 'in 5 days' },
        { days: 2,  label: 'in 2 days' },
        { days: 1,  label: 'tomorrow' }
    ];

    function scheduleExamReminder(exam) {
        if (!isNative() || !_permissionGranted || !isEnabled()) return;
        if (!exam || !exam.date) return;

        _scheduleExamAsync(exam);
    }

    async function _scheduleExamAsync(exam) {
        try {
            const { LocalNotifications } = Capacitor.Plugins;

            await cancelByPrefix(`exam_${exam.id}`);

            const examDate = new Date(exam.date + 'T00:00:00');
            if (isNaN(examDate.getTime())) return;

            const now = Date.now();
            const subjectName = typeof getSubjectById === 'function' && exam.subjectId
                ? (getSubjectById(exam.subjectId)?.name || '') : '';
            const examLabel = subjectName ? `${subjectName} - ${exam.name}` : exam.name;

            const notifications = [];

            EXAM_OFFSETS.forEach((offset, idx) => {
                const triggerDate = new Date(examDate.getTime() - (offset.days * 24 * 60 * 60 * 1000));
                triggerDate.setHours(9, 0, 0, 0); // 9 AM notification

                if (triggerDate.getTime() <= now) return; // Skip past triggers

                const id = hashId(`exam_${exam.id}_offset_${idx}`);
                notifications.push({
                    id,
                    title: '📝 Exam Reminder',
                    body: `Your ${examLabel} exam is ${offset.label}. ${offset.days <= 2 ? 'Time to revise!' : 'Start preparing!'}`,
                    channelId: CHANNELS.EXAMS,
                    schedule: {
                        at: triggerDate,
                        allowWhileIdle: true
                    },
                    extra: { examId: exam.id, tab: 'academics', type: 'exam' }
                });
                trackId(`exam_${exam.id}`, id);
            });

            if (notifications.length > 0) {
                await LocalNotifications.schedule({ notifications });
                console.log(`✅ Scheduled ${notifications.length} reminders for exam "${exam.name}"`);
            }
        } catch (error) {
            console.error('❌ Error scheduling exam reminder:', error);
        }
    }

    function cancelExamReminder(examId) {
        if (!isNative()) return;
        cancelByPrefix(`exam_${examId}`);
    }

    async function scheduleAllExamReminders() {
        if (!isNative() || !_permissionGranted || !isEnabled()) return;

        try {
            await cancelByPrefix('exam_');

            const exams = (typeof getLS === 'function' ? getLS('exams') : JSON.parse(localStorage.getItem('exams')) || []);
            for (const exam of exams) {
                await _scheduleExamAsync(exam);
            }
        } catch (error) {
            console.error('❌ Error scheduling all exam reminders:', error);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  STUDY SESSION REMINDERS — 5 minutes before scheduled start
    // ═══════════════════════════════════════════════════════════════

    function scheduleStudyReminder(block) {
        if (!isNative() || !_permissionGranted || !isEnabled()) return;
        if (!block || !block.day) return;

        _scheduleStudyAsync(block);
    }

    async function _scheduleStudyAsync(block) {
        try {
            const { LocalNotifications } = Capacitor.Plugins;

            await cancelByPrefix(`study_${block.id}`);

            const weekday = DAY_MAP[block.day];
            if (!weekday) return;

            const subjectName = typeof getSubjectById === 'function' && block.subjectId
                ? (getSubjectById(block.subjectId)?.name || 'General') : 'General';

            // Use startTime if available, otherwise default to 9:00
            let hour = 9, minute = 0;
            if (block.startTime) {
                const [h, m] = block.startTime.split(':').map(Number);
                if (!isNaN(h) && !isNaN(m)) {
                    hour = h;
                    minute = m;
                }
            }

            // Subtract 5 minutes for the reminder
            minute -= 5;
            if (minute < 0) {
                minute += 60;
                hour -= 1;
                if (hour < 0) hour = 23;
            }

            const id = hashId(`study_${block.id}`);
            await LocalNotifications.schedule({
                notifications: [{
                    id,
                    title: '📚 Study Session in 5 min',
                    body: `Your ${subjectName} study session (${block.duration || 30}min) starts soon.`,
                    channelId: CHANNELS.STUDY,
                    schedule: {
                        on: { hour, minute, weekday },
                        repeats: true,
                        allowWhileIdle: true
                    },
                    extra: { studyBlockId: block.id, tab: 'academics', type: 'study' }
                }]
            });
            trackId(`study_${block.id}`, id);
            console.log(`✅ Scheduled study reminder for ${block.day} - ${subjectName} at ${hour}:${String(minute).padStart(2,'0')}`);
        } catch (error) {
            console.error('❌ Error scheduling study reminder:', error);
        }
    }

    function cancelStudyReminder(blockId) {
        if (!isNative()) return;
        cancelByPrefix(`study_${blockId}`);
    }

    async function scheduleAllStudyReminders() {
        if (!isNative() || !_permissionGranted || !isEnabled()) return;

        try {
            await cancelByPrefix('study_');

            const blocks = (typeof getLS === 'function' ? getLS('studyBlocks') : JSON.parse(localStorage.getItem('studyBlocks')) || []);
            for (const block of blocks) {
                await _scheduleStudyAsync(block);
            }
        } catch (error) {
            console.error('❌ Error scheduling all study reminders:', error);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  ID TRACKING — maps prefixed keys to notification IDs
    //  for reliable cancellation without wiping all pending
    // ═══════════════════════════════════════════════════════════════

    const ID_MAP_KEY = 'prodify_notifIdMap';

    function getIdMap() {
        try { return JSON.parse(localStorage.getItem(ID_MAP_KEY)) || {}; }
        catch { return {}; }
    }

    function saveIdMap(map) {
        localStorage.setItem(ID_MAP_KEY, JSON.stringify(map));
    }

    function trackId(prefix, id) {
        const map = getIdMap();
        if (!map[prefix]) map[prefix] = [];
        if (!map[prefix].includes(id)) map[prefix].push(id);
        saveIdMap(map);
    }

    async function cancelByPrefix(prefix) {
        if (!isNative()) return;
        try {
            const { LocalNotifications } = Capacitor.Plugins;
            const map = getIdMap();

            // Collect all IDs that match the prefix
            const idsToCancel = [];
            const keysToRemove = [];

            for (const key of Object.keys(map)) {
                if (key === prefix || key.startsWith(prefix)) {
                    idsToCancel.push(...map[key]);
                    keysToRemove.push(key);
                }
            }

            if (idsToCancel.length > 0) {
                await LocalNotifications.cancel({
                    notifications: idsToCancel.map(id => ({ id }))
                });
            }

            // Clean up map
            keysToRemove.forEach(k => delete map[k]);
            saveIdMap(map);
        } catch (e) {
            console.warn('Cancel notifications warning:', e);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  MASTER CANCEL / RESCHEDULE
    // ═══════════════════════════════════════════════════════════════

    async function cancelAll() {
        if (!isNative()) return;
        try {
            const { LocalNotifications } = Capacitor.Plugins;
            const pending = await LocalNotifications.getPending();
            if (pending.notifications.length > 0) {
                await LocalNotifications.cancel({ notifications: pending.notifications });
            }
            localStorage.removeItem(ID_MAP_KEY);
            console.log('🗑️ All notifications cancelled');
        } catch (e) {
            console.warn('Cancel all failed:', e);
        }
    }

    async function rescheduleAll() {
        if (!isNative() || !_permissionGranted) return;

        if (!isEnabled()) {
            await cancelAll();
            return;
        }
        await scheduleAllHabits();
        await scheduleAllTaskReminders();
        await scheduleAllExamReminders();
        await scheduleAllStudyReminders();
    }

    async function toggleEnabled(enabled) {
        setEnabled(enabled);
        if (enabled) {
            await rescheduleAll();
        } else {
            await cancelAll();
        }
    }

    // ─── Public API ────────────────────────────────────────────────
    return {
        init,
        isEnabled,
        toggleEnabled,

        // Habits
        scheduleAllHabits,

        // Tasks
        scheduleTaskReminder,
        cancelTaskReminder,
        scheduleAllTaskReminders,

        // Exams
        scheduleExamReminder,
        cancelExamReminder,
        scheduleAllExamReminders,

        // Study sessions
        scheduleStudyReminder,
        cancelStudyReminder,
        scheduleAllStudyReminders,

        // Master controls
        cancelAll,
        rescheduleAll
    };
})();

// Backward-compatible alias so existing code keeps working
const HabitReminders = {
    init: AppReminders.init,
    scheduleAllHabits: AppReminders.scheduleAllHabits
};
