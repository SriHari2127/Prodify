// ===== CALENDAR MODULE (calendar.js) =====
// Full-featured calendar with month/week/day views, drag-drop, analytics overlay
// Mobile-optimized with swipe navigation

const Calendar = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    const CONFIG = {
        colors: {
            exam: '#ef4444',
            task: '#3b82f6',
            focus: '#8b5cf6',
            habit: '#22c55e',
            recommended: '#f59e0b', // Orange for AI-recommended sessions
            googleEvent: '#34a853' // Google green for imported events
        },
        views: ['month', 'week', 'day'],
        heatmapMaxHours: 8, // Maximum hours for heatmap color intensity
        swipeThreshold: 50, // Minimum swipe distance in pixels
        virtualRenderBuffer: 7, // Days to render outside viewport
        enableVirtualRendering: true, // Enable performance optimization for large datasets
        googleCalendar: {
            clientId: '769404048438-r0ahkn7ern1cuud13eoombef182nbb3g.apps.googleusercontent.com',
            apiKey: null, // Optional API key for public calendar access
            scopes: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events',
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest']
        }
    };

    // ===== STATE MANAGEMENT =====
    let state = {
        currentView: 'month',
        currentDate: new Date(),
        selectedDate: null,
        events: {
            tasks: [],
            exams: [],
            focusSessions: [],
            habits: [],
            recommended: [], // AI-recommended study sessions
            googleEvents: [] // Imported from Google Calendar
        },
        heatmapData: {},
        draggedEvent: null,
        touchStart: null,
        isInitialized: false,
        googleAuth: {
            isSignedIn: false,
            isLoaded: false,
            isLoading: false,
            client: null
        }
    };

    // ===== DOM ELEMENTS =====
    let elements = {};

    // ===== INITIALIZATION =====
    function init() {
        if (state.isInitialized) return;
        
        cacheElements();
        setupEventListeners();
        loadAllEvents();
        renderCalendar();
        
        // Don't auto-initialize Google Calendar - load on-demand when user clicks button
        // This prevents stuck loading states and improves initial page load
        
        // Refresh recommended sessions when StudyScheduler updates
        document.addEventListener('scheduleGenerated', () => {
            state.events.recommended = loadRecommendedSessions();
            renderCalendar();
        });
        
        state.isInitialized = true;
        console.log('📅 Calendar initialized with Smart Planner & Google Calendar');
    }

    function cacheElements() {
        elements = {
            calendar: document.getElementById('calendar'),
            calendarHeader: document.getElementById('calendarHeader'),
            calendarGrid: document.getElementById('calendarGrid'),
            viewToggle: document.getElementById('calendarViewToggle'),
            prevBtn: document.getElementById('calendarPrevBtn'),
            nextBtn: document.getElementById('calendarNextBtn'),
            todayBtn: document.getElementById('calendarTodayBtn'),
            currentMonth: document.getElementById('calendarCurrentMonth'),
            eventModal: document.getElementById('calendarEventModal'),
            eventModalContent: document.getElementById('calendarEventModalContent'),
            heatmapToggle: document.getElementById('calendarHeatmapToggle')
        };
    }

    function setupEventListeners() {
        // View toggle buttons
        const viewBtns = document.querySelectorAll('.calendar-view-btn');
        viewBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.getAttribute('data-view');
                switchView(view);
            });
        });

        // Navigation buttons
        if (elements.prevBtn) {
            elements.prevBtn.addEventListener('click', navigatePrev);
        }
        if (elements.nextBtn) {
            elements.nextBtn.addEventListener('click', navigateNext);
        }
        if (elements.todayBtn) {
            elements.todayBtn.addEventListener('click', goToToday);
        }

        // Heatmap toggle
        if (elements.heatmapToggle) {
            elements.heatmapToggle.addEventListener('change', (e) => {
                const isEnabled = e.target.checked;
                const totalDays = Object.keys(state.heatmapData).length;
                
                console.log(`📊 Heatmap ${isEnabled ? 'enabled' : 'disabled'}`);
                
                if (isEnabled && totalDays === 0) {
                    console.warn('⚠️ No focus session data available for heatmap');
                    console.log('💡 Tip: Complete some focus sessions to see heatmap data');
                } else if (isEnabled) {
                    console.log(`✅ Showing heatmap for ${totalDays} days`);
                }
                
                renderCalendar();
            });
        }

        // Google Calendar button
        const googleCalendarBtn = document.getElementById('googleCalendarBtn');
        if (googleCalendarBtn) {
            // Don't show loading initially - only on demand
            // Button starts as "Connect Google" (normal state)
            
            googleCalendarBtn.addEventListener('click', async () => {
                if (state.googleAuth.isLoading) {
                    alert('⏳ Google Calendar is still loading. Please wait...');
                    return;
                }
                
                if (state.googleAuth.isSignedIn) {
                    // Show options: sign out or export
                    if (confirm('🔌 Google Calendar is connected. Sign out?')) {
                        signOutGoogle();
                    }
                } else {
                    // Initialize and sign in
                    await signInGoogle();
                }
            });
        }

        // Mobile swipe navigation
        if (elements.calendarGrid) {
            elements.calendarGrid.addEventListener('touchstart', handleTouchStart, { passive: true });
            elements.calendarGrid.addEventListener('touchmove', handleTouchMove, { passive: true });
            elements.calendarGrid.addEventListener('touchend', handleTouchEnd, { passive: true });
        }

        // Modal close
        if (elements.eventModal) {
            elements.eventModal.addEventListener('click', (e) => {
                if (e.target === elements.eventModal) {
                    closeEventModal();
                }
            });
        }

        // Listen for data changes
        document.addEventListener('taskUpdated', () => {
            loadAllEvents();
            renderCalendar();
        });
        document.addEventListener('habitUpdated', () => {
            loadAllEvents();
            renderCalendar();
        });
        document.addEventListener('focusSessionComplete', () => {
            loadAllEvents();
            renderCalendar();
        });
    }

    // ===== DATA LOADING =====
    function loadAllEvents() {
        if (CONFIG.enableVirtualRendering) {
            // Use optimized loading with range filtering
            optimizedLoadEvents();
        } else {
            // Load all events without filtering (legacy mode)
            state.events.tasks = loadTasks();
            state.events.exams = loadExams();
            state.events.focusSessions = loadFocusSessions();
            state.events.habits = loadHabits();
            state.events.recommended = loadRecommendedSessions();
            // googleEvents stay as-is (loaded from API)
        }
        calculateHeatmapData();
    }

    function loadTasks() {
        try {
            const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
            return tasks.filter(t => !t.completed && t.dueDate);
        } catch {
            return [];
        }
    }

    function loadExams() {
        try {
            return JSON.parse(localStorage.getItem('exams') || '[]');
        } catch {
            return [];
        }
    }

    function loadFocusSessions() {
        try {
            return JSON.parse(localStorage.getItem('focusSessions') || '[]');
        } catch {
            return [];
        }
    }

    function loadHabits() {
        try {
            return JSON.parse(localStorage.getItem('habits') || '[]');
        } catch {
            return [];
        }
    }

    function loadRecommendedSessions() {
        try {
            // Load today's recommended schedule from StudyScheduler
            if (typeof StudyScheduler === 'undefined') return [];
            
            const schedule = StudyScheduler.getCurrentSchedule();
            if (!schedule || !schedule.blocks) return [];
            
            // Convert study blocks to calendar events
            const recommendations = schedule.blocks
                .filter(block => block.type !== 'break')
                .map(block => ({
                    id: block.id,
                    type: 'recommended',
                    subjectId: block.subjectId,
                    subjectName: block.subjectName,
                    title: block.task || `${block.type} session`,
                    duration: block.duration,
                    priorityScore: block.priorityScore,
                    examDate: block.examDate,
                    color: block.color,
                    sessionType: block.type,
                    date: schedule.date || getTodayDate()
                }));
            
            return recommendations;
        } catch (error) {
            console.warn('Failed to load recommended sessions:', error);
            return [];
        }
    }

    // ===== GOOGLE CALENDAR INTEGRATION =====
    
    function initGoogleCalendar() {
        // Check if already loading or loaded
        if (state.googleAuth.isLoaded || state.googleAuth.isLoading) {
            console.log('Google Calendar already initializing or initialized');
            return Promise.resolve();
        }
        
        state.googleAuth.isLoading = true;
        updateGoogleButtonText();
        
        // Set timeout to prevent stuck loading state (30 seconds)
        const loadingTimeout = setTimeout(() => {
            if (state.googleAuth.isLoading && !state.googleAuth.isLoaded) {
                console.error('⏱️ Google Calendar initialization timeout');
                state.googleAuth.isLoading = false;
                updateGoogleButtonText();
                alert('⏱️ Google Calendar loading timeout. Please check your internet connection and try again.');
            }
        }, 30000);
        
        return new Promise((resolve, reject) => {
            // Load Google API script
            if (typeof gapi !== 'undefined' && gapi.client) {
                // Already loaded
                clearTimeout(loadingTimeout);
                handleGoogleApiLoaded().then(resolve).catch(reject);
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = () => {
                console.log('📦 Google API script loaded');
                clearTimeout(loadingTimeout);
                handleGoogleApiLoaded().then(resolve).catch(reject);
            };
            script.onerror = () => {
                console.error('❌ Failed to load Google API script from CDN');
                console.error('This could be due to:');
                console.error('1. No internet connection');
                console.error('2. Firewall blocking apis.google.com');
                console.error('3. Content blocker/ad blocker');
                clearTimeout(loadingTimeout);
                state.googleAuth.isLoading = false;
                updateGoogleButtonText();
                const error = new Error('Failed to load Google API script');
                reject(error);
                // Don't show alert here - let the caller handle it
            };
            document.head.appendChild(script);
        });
    }
    
    function handleGoogleApiLoaded() {
        return new Promise((resolve, reject) => {
            if (typeof gapi === 'undefined') {
                console.error('gapi not available');
                state.googleAuth.isLoading = false;
                updateGoogleButtonText();
                reject(new Error('gapi not available'));
                return;
            }
            
            gapi.load('client:auth2', () => {
                initGoogleClient().then(resolve).catch(reject);
            });
        });
    }
    
    async function initGoogleClient() {
        try {
            console.log('🔄 Initializing Google API client...');
            console.log('Client ID:', CONFIG.googleCalendar.clientId);
            console.log('Scopes:', CONFIG.googleCalendar.scopes);
            
            await gapi.client.init({
                clientId: CONFIG.googleCalendar.clientId,
                scope: CONFIG.googleCalendar.scopes,
                discoveryDocs: CONFIG.googleCalendar.discoveryDocs
            });
            
            state.googleAuth.isLoaded = true;
            state.googleAuth.isLoading = false;
            state.googleAuth.client = gapi.auth2.getAuthInstance();
            
            // Listen for sign-in state changes
            state.googleAuth.client.isSignedIn.listen(updateGoogleSignInStatus);
            
            // Handle initial sign-in state
            updateGoogleSignInStatus(state.googleAuth.client.isSignedIn.get());
            
            // Update button text
            updateGoogleButtonText();
            
            console.log('✅ Google Calendar API initialized successfully');
            return true; // Success
        } catch (error) {
            console.error('❌ Error initializing Google Calendar:', error);
            console.error('Error details:', {
                message: error.message,
                details: error.details,
                result: error.result,
                status: error.status
            });
            
            state.googleAuth.isLoading = false;
            updateGoogleButtonText();
            
            // Provide more specific error message
            let errorMsg = 'Failed to initialize Google Calendar.\n\n';
            
            if (error.details) {
                errorMsg += 'Error: ' + error.details + '\n\n';
            } else if (error.message) {
                errorMsg += 'Error: ' + error.message + '\n\n';
            }
            
            errorMsg += 'Common causes:\n';
            errorMsg += '1. Google Calendar API not enabled in Google Cloud Console\n';
            errorMsg += '2. OAuth client ID not configured correctly\n';
            errorMsg += '3. Current website not in authorized JavaScript origins\n';
            errorMsg += '4. OAuth consent screen not set up\n\n';
            errorMsg += 'Check browser console for details.';
            
            // Don't show alert during initialization, only log
            console.error(errorMsg);
            
            throw error; // Re-throw so promise chain catches it
        }
    }
    
    function updateGoogleSignInStatus(isSignedIn) {
        state.googleAuth.isSignedIn = isSignedIn;
        
        if (isSignedIn) {
            loadGoogleCalendarEvents();
        } else {
            state.events.googleEvents = [];
        }
        
        // Update button text
        updateGoogleButtonText();
        
        // Update UI if calendar is visible
        if (document.querySelector('.calendar-tab.active')) {
            renderCalendar();
        }
    }
    
    function updateGoogleButtonText() {
        const btn = document.getElementById('googleCalendarBtn');
        if (!btn) return;
        
        if (state.googleAuth.isLoading) {
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
            btn.disabled = true;
        } else if (state.googleAuth.isSignedIn) {
            btn.innerHTML = '<i class="fa-brands fa-google"></i> Connected ✓';
            btn.disabled = false;
            btn.style.background = 'var(--accent-color)';
            btn.style.color = 'white';
        } else if (state.googleAuth.isLoaded) {
            btn.innerHTML = '<i class="fa-brands fa-google"></i> Connect Google';
            btn.disabled = false;
            btn.style.background = '';
            btn.style.color = '';
        } else {
            btn.innerHTML = '<i class="fa-brands fa-google"></i> Connect Google';
            btn.disabled = false;
        }
    }
    
    async function signInGoogle() {
        // Check if still loading
        if (state.googleAuth.isLoading) {
            alert('⏳ Google Calendar is still loading. Please wait a moment and try again.');
            return;
        }
        
        // Check if not initialized - initialize on demand
        if (!state.googleAuth.isLoaded || !state.googleAuth.client) {
            console.log('🔄 Initializing Google Calendar for first use...');
            
            try {
                // Initialize and wait for completion
                await initGoogleCalendar();
                
                // Now try to sign in
                if (state.googleAuth.isLoaded && state.googleAuth.client) {
                    await state.googleAuth.client.signIn();
                    updateGoogleButtonText();
                } else {
                    alert('❌ Failed to initialize Google Calendar.\n\nPlease check:\n1. Google Calendar API is enabled\n2. OAuth credentials are configured\n3. Check browser console for details');
                }
            } catch (error) {
                console.error('Error initializing/signing in:', error);
                
                let errorMsg = '❌ Failed to connect to Google Calendar.\n\n';
                
                // Check for specific error types
                if (error.error === 'idpiframe_initialization_failed') {
                    errorMsg += 'Google API initialization failed.\n\n';
                    errorMsg += 'Possible causes:\n';
                    errorMsg += '1. Invalid OAuth Client ID\n';
                    errorMsg += '2. Current domain not authorized\n';
                    errorMsg += '3. Third-party cookies blocked\n\n';
                    errorMsg += 'Try: Enable third-party cookies or check OAuth settings.';
                } else if (error.message && error.message.includes('origin')) {
                    errorMsg += 'Origin not authorized.\n\n';
                    errorMsg += 'Add your current URL to authorized JavaScript origins in Google Cloud Console.';
                } else {
                    errorMsg += 'Error: ' + (error.details || error.message || 'Unknown error') + '\n\n';
                    errorMsg += 'Check browser console for more details.';
                }
                
                alert(errorMsg);
            }
            return;
        }
        
        try {
            await state.googleAuth.client.signIn();
            updateGoogleButtonText();
        } catch (error) {
            console.error('Error signing in to Google:', error);
            if (error.error === 'popup_closed_by_user') {
                // User closed the popup, no need to show error
                return;
            }
            alert('❌ Failed to sign in: ' + (error.error || error.message || 'Unknown error'));
        }
    }
    
    async function signOutGoogle() {
        if (!state.googleAuth.client) return;
        
        try {
            await state.googleAuth.client.signOut();
            state.events.googleEvents = [];
            renderCalendar();
        } catch (error) {
            console.error('Error signing out:', error);
        }
    }
    
    async function loadGoogleCalendarEvents() {
        if (!state.googleAuth.isSignedIn) return;
        
        try {
            const now = new Date();
            const timeMin = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
            const timeMax = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();
            
            const response = await gapi.client.calendar.events.list({
                calendarId: 'primary',
                timeMin: timeMin,
                timeMax: timeMax,
                showDeleted: false,
                singleEvents: true,
                maxResults: 250,
                orderBy: 'startTime'
            });
            
            const events = response.result.items || [];
            
            state.events.googleEvents = events.map(event => ({
                id: event.id,
                type: 'google',
                title: event.summary || '(No title)',
                description: event.description,
                date: event.start.date || event.start.dateTime?.split('T')[0],
                time: event.start.dateTime ? new Date(event.start.dateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null,
                endDate: event.end.date || event.end.dateTime?.split('T')[0],
                location: event.location,
                link: event.htmlLink,
                color: CONFIG.colors.googleEvent
            }));
            
            renderCalendar();
            console.log(`✅ Loaded ${state.events.googleEvents.length} Google Calendar events`);
        } catch (error) {
            console.error('❌ Error loading Google Calendar events:', error);
        }
    }
    
    async function exportToGoogleCalendar(event) {
        if (!state.googleAuth.isSignedIn) {
            alert('Please sign in to Google Calendar first');
            return;
        }
        
        try {
            let eventData = {
                summary: event.text || event.name || event.title,
                start: {},
                end: {}
            };
            
            if (event.dueTime) {
                // Use specific time
                const dateTime = `${event.dueDate}T${event.dueTime}:00`;
                eventData.start.dateTime = dateTime;
                eventData.end.dateTime = new Date(new Date(dateTime).getTime() + 60 * 60 * 1000).toISOString();
            } else {
                // All-day event
                eventData.start.date = event.date || event.dueDate;
                eventData.end.date = event.date || event.dueDate;
            }
            
            if (event.type === 'exam') {
                eventData.description = `Exam: ${event.name}`;
                eventData.colorId = '11'; // Red
            } else if (event.type === 'task') {
                eventData.description = event.text;
                eventData.colorId = '9'; // Blue
            }
            
            const response = await gapi.client.calendar.events.insert({
                calendarId: 'primary',
                resource: eventData
            });
            
            alert('✅ Event exported to Google Calendar!');
            loadGoogleCalendarEvents();
        } catch (error) {
            console.error('Error exporting to Google Calendar:', error);
            alert('❌ Failed to export event');
        }
    }

    function calculateHeatmapData() {
        state.heatmapData = {};
        
        // Calculate focus time per day
        state.events.focusSessions.forEach(session => {
            if (!session.completedAt) return;
            const date = session.completedAt.split('T')[0];
            const hours = (session.duration || 0) / 3600;
            
            if (!state.heatmapData[date]) {
                state.heatmapData[date] = { hours: 0, sessions: 0 };
            }
            state.heatmapData[date].hours += hours;
            state.heatmapData[date].sessions += 1;
        });
        
        // Log for debugging
        const totalDays = Object.keys(state.heatmapData).length;
        if (totalDays > 0) {
            console.log(`📊 Heatmap data calculated: ${totalDays} days with focus sessions`);
        } else {
            console.log('⚠️ No focus session data for heatmap');
        }
    }

    // ===== VIEW MANAGEMENT =====
    function switchView(view) {
        if (!CONFIG.views.includes(view)) return;
        
        state.currentView = view;
        
        // Update active button
        document.querySelectorAll('.calendar-view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-view') === view);
        });
        
        renderCalendar();
    }

    function renderCalendar() {
        if (!elements.calendarGrid) return;
        
        updateHeaderTitle();
        
        switch (state.currentView) {
            case 'month':
                renderMonthView();
                break;
            case 'week':
                renderWeekView();
                break;
            case 'day':
                renderDayView();
                break;
        }
    }

    // ===== MONTH VIEW =====
    function renderMonthView() {
        const year = state.currentDate.getFullYear();
        const month = state.currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDay = firstDay.getDay();
        const daysInMonth = lastDay.getDate();
        
        const showHeatmap = elements.heatmapToggle && elements.heatmapToggle.checked;
        
        let html = '<div class="calendar-month-grid">';
        
        // Day headers
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        html += '<div class="calendar-day-headers">';
        dayNames.forEach(day => {
            html += `<div class="calendar-day-header">${day}</div>`;
        });
        html += '</div>';
        
        // Days grid
        html += '<div class="calendar-days-grid">';
        
        // Empty cells before first day
        for (let i = 0; i < startDay; i++) {
            html += '<div class="calendar-day-cell empty"></div>';
        }
        
        // Days of month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateStr = formatDateISO(date);
            const isToday = isDateToday(date);
            const isSelected = state.selectedDate && formatDateISO(state.selectedDate) === dateStr;
            
            const dayEvents = getEventsForDate(dateStr);
            const heatmapIntensity = showHeatmap ? getHeatmapIntensity(dateStr) : 0;
            
            let cellClass = 'calendar-day-cell';
            if (isToday) cellClass += ' today';
            if (isSelected) cellClass += ' selected';
            
            // Add heatmap class for visual effect
            if (showHeatmap && heatmapIntensity > 0) {
                if (heatmapIntensity >= 0.8) cellClass += ' heatmap-very-high';
                else if (heatmapIntensity >= 0.6) cellClass += ' heatmap-high';
                else if (heatmapIntensity >= 0.4) cellClass += ' heatmap-medium';
                else if (heatmapIntensity >= 0.2) cellClass += ' heatmap-low';
                else cellClass += ' heatmap-minimal';
            }
            
            html += `<div class="${cellClass}" data-date="${dateStr}">`;
            html += `<div class="calendar-day-number">${day}</div>`;
            html += renderDayEvents(dayEvents, dateStr);
            html += '</div>';
        }
        
        html += '</div></div>';
        
        elements.calendarGrid.innerHTML = html;
        attachDayCellListeners();
    }

    function renderDayEvents(events, dateStr) {
        let html = '<div class="calendar-day-events">';
        
        // Count events by type
        const taskCount = events.tasks.length;
        const examCount = events.exams.length;
        const focusTime = events.focusSessions.reduce((sum, s) => sum + (s.duration / 60), 0);
        const habitCount = events.habits.length;
        const recommendedCount = events.recommended.length;
        const googleCount = events.googleEvents.length;
        
        // Render indicators
        if (recommendedCount > 0) {
            html += `<div class="event-indicator recommended" title="${recommendedCount} AI recommendation(s)">
                <i class="fa-solid fa-lightbulb"></i> ${recommendedCount}
            </div>`;
        }
        
        if (examCount > 0) {
            html += `<div class="event-indicator exam" title="${examCount} exam(s)">
                <i class="fa-solid fa-graduation-cap"></i> ${examCount}
            </div>`;
        }
        
        if (taskCount > 0) {
            html += `<div class="event-indicator task" title="${taskCount} task(s)">
                <i class="fa-solid fa-check"></i> ${taskCount}
            </div>`;
        }
        
        if (focusTime > 0) {
            html += `<div class="event-indicator focus" title="${Math.round(focusTime)} min focus">
                <i class="fa-solid fa-clock"></i> ${Math.round(focusTime)}m
            </div>`;
        }
        
        if (habitCount > 0) {
            html += `<div class="event-indicator habit" title="${habitCount} habit(s)">
                <i class="fa-solid fa-repeat"></i> ${habitCount}
            </div>`;
        }
        
        if (googleCount > 0) {
            html += `<div class="event-indicator google" title="${googleCount} Google event(s)">
                <i class="fa-brands fa-google"></i> ${googleCount}
            </div>`;
        }
        
        html += '</div>';
        return html;
    }

    // ===== WEEK VIEW =====
    function renderWeekView() {
        const weekStart = getWeekStart(state.currentDate);
        const showHeatmap = elements.heatmapToggle && elements.heatmapToggle.checked;
        
        let html = '<div class="calendar-week-grid">';
        
        // Day headers with dates
        html += '<div class="calendar-week-headers">';
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(date.getDate() + i);
            const dateStr = formatDateISO(date);
            const isToday = isDateToday(date);
            
            html += `<div class="calendar-week-header ${isToday ? 'today' : ''}">
                <div class="week-header-day">${dayNames[i]}</div>
                <div class="week-header-date">${date.getDate()}</div>
            </div>`;
        }
        html += '</div>';
        
        // Day columns
        html += '<div class="calendar-week-columns">';
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(date.getDate() + i);
            const dateStr = formatDateISO(date);
            const events = getEventsForDate(dateStr);
            const isToday = isDateToday(date);
            const heatmapIntensity = showHeatmap ? getHeatmapIntensity(dateStr) : 0;
            
            let colClass = 'calendar-week-column';
            if (isToday) colClass += ' today';
            
            // Add heatmap class
            if (showHeatmap && heatmapIntensity > 0) {
                if (heatmapIntensity >= 0.8) colClass += ' heatmap-very-high';
                else if (heatmapIntensity >= 0.6) colClass += ' heatmap-high';
                else if (heatmapIntensity >= 0.4) colClass += ' heatmap-medium';
                else if (heatmapIntensity >= 0.2) colClass += ' heatmap-low';
                else colClass += ' heatmap-minimal';
            }
            
            html += `<div class="${colClass}" data-date="${dateStr}">`;
            html += renderWeekDayEvents(events, dateStr);
            html += '</div>';
        }
        
        html += '</div></div>';
        
        elements.calendarGrid.innerHTML = html;
        attachWeekCellListeners();
    }

    function renderWeekDayEvents(events, dateStr) {
        let html = '';
        
        // Render AI recommendations first (priority)
        events.recommended.forEach(rec => {
            html += `<div class="week-event recommended" data-type="recommended" data-id="${rec.id}" data-date="${dateStr}" title="AI Recommended: ${rec.priorityScore ? 'Priority ' + Math.round(rec.priorityScore) : ''}">
                <i class="fa-solid fa-lightbulb"></i>
                <span class="event-text">${rec.title}</span>
                <span class="event-subject" style="color: ${rec.color}">${rec.subjectName} • ${rec.duration}m</span>
            </div>`;
        });
        
        // Render exams
        events.exams.forEach(exam => {
            html += `<div class="week-event exam" draggable="true" data-type="exam" data-id="${exam.id}" data-date="${dateStr}">
                <i class="fa-solid fa-graduation-cap"></i>
                <span class="event-text">${exam.name}</span>
            </div>`;
        });
        
        // Render tasks
        events.tasks.forEach(task => {
            const subject = getSubjectById(task.subjectId);
            const priority = task.priority || 'medium';
            html += `<div class="week-event task priority-${priority}" draggable="true" data-type="task" data-id="${task.id}" data-date="${dateStr}">
                <i class="fa-solid fa-check"></i>
                <span class="event-text">${task.text}</span>
                ${subject ? `<span class="event-subject" style="color: ${subject.color}">${subject.name}</span>` : ''}
            </div>`;
        });
        
        // Render focus sessions
        events.focusSessions.forEach(session => {
            const subject = getSubjectById(session.subjectId);
            html += `<div class="week-event focus" data-type="focus" data-id="${session.timestamp}">
                <i class="fa-solid fa-clock"></i>
                <span class="event-text">${Math.round(session.duration / 60)}m focus</span>
                ${subject ? `<span class="event-subject" style="color: ${subject.color}">${subject.name}</span>` : ''}
            </div>`;
        });
        
        // Render Google Calendar events
        events.googleEvents.forEach(gEvent => {
            html += `<div class="week-event google" data-type="google" data-id="${gEvent.id}" data-date="${dateStr}">
                <i class="fa-brands fa-google"></i>
                <span class="event-text">${gEvent.title}</span>
                ${gEvent.time ? `<span class="event-subject">${gEvent.time}</span>` : ''}
            </div>`;
        });
        
        return html;
    }

    // ===== DAY VIEW =====
    function renderDayView() {
        const date = state.selectedDate || state.currentDate;
        const dateStr = formatDateISO(date);
        const events = getEventsForDate(dateStr);
        const showHeatmap = elements.heatmapToggle && elements.heatmapToggle.checked;
        const heatmapData = state.heatmapData[dateStr];
        
        let html = '<div class="calendar-day-view">';
        
        // Day header
        html += `<div class="day-view-header">
            <h3>${formatDateLong(date)}</h3>
            ${showHeatmap && heatmapData ? `
                <div class="day-view-stats">
                    <div class="stat-item">
                        <i class="fa-solid fa-clock"></i>
                        ${heatmapData.hours.toFixed(1)}h focus
                    </div>
                    <div class="stat-item">
                        <i class="fa-solid fa-fire"></i>
                        ${heatmapData.sessions} sessions
                    </div>
                </div>
            ` : ''}
        </div>`;
        
        // Timeline view (24-hour grid)
        html += '<div class="day-view-timeline">';
        
        // AI Recommended Sessions section (top priority)
        if (events.recommended.length > 0) {
            html += '<div class="day-section">';
            html += '<div class="day-section-header recommended"><i class="fa-solid fa-lightbulb"></i> AI Recommended Sessions</div>';
            events.recommended.forEach(rec => {
                html += `<div class="day-event recommended" data-type="recommended" data-id="${rec.id}">
                    <div class="event-title">${rec.title}</div>
                    <div class="event-meta">
                        ${rec.subjectName} • ${rec.duration}m • Priority: ${Math.round(rec.priorityScore || 0)}
                    </div>
                </div>`;
            });
            html += '</div>';
        }
        
        // Exams section
        if (events.exams.length > 0) {
            html += '<div class="day-section">';
            html += '<div class="day-section-header exam"><i class="fa-solid fa-graduation-cap"></i> Exams</div>';
            events.exams.forEach(exam => {
                html += `<div class="day-event exam" data-type="exam" data-id="${exam.id}">
                    <div class="event-title">${exam.name}</div>
                    <div class="event-meta">Subject: ${getSubjectById(exam.subjectId)?.name || 'Unknown'}</div>
                </div>`;
            });
            html += '</div>';
        }
        
        // Tasks section
        if (events.tasks.length > 0) {
            html += '<div class="day-section">';
            html += '<div class="day-section-header task"><i class="fa-solid fa-check"></i> Tasks</div>';
            events.tasks.forEach(task => {
                const subject = getSubjectById(task.subjectId);
                const priority = task.priority || 'medium';
                html += `<div class="day-event task priority-${priority}" draggable="true" data-type="task" data-id="${task.id}" data-date="${dateStr}">
                    <div class="event-title">${task.text}</div>
                    <div class="event-meta">
                        ${task.dueTime ? `Due: ${task.dueTime}` : 'No time set'}
                        ${subject ? ` • ${subject.name}` : ''}
                    </div>
                    <div class="event-priority">${priority}</div>
                </div>`;
            });
            html += '</div>';
        }
        
        // Focus sessions section
        if (events.focusSessions.length > 0) {
            html += '<div class="day-section">';
            html += '<div class="day-section-header focus"><i class="fa-solid fa-clock"></i> Focus Sessions</div>';
            events.focusSessions.forEach(session => {
                const subject = getSubjectById(session.subjectId);
                const time = session.completedAt ? new Date(session.completedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—';
                html += `<div class="day-event focus" data-type="focus" data-id="${session.timestamp}">
                    <div class="event-title">Focus Session</div>
                    <div class="event-meta">
                        ${time} • ${Math.round(session.duration / 60)} minutes
                        ${subject ? ` • ${subject.name}` : ''}
                    </div>
                </div>`;
            });
            html += '</div>';
        }
        
        // Habits section
        if (events.habits.length > 0) {
            html += '<div class="day-section">';
            html += '<div class="day-section-header habit"><i class="fa-solid fa-repeat"></i> Habit Reminders</div>';
            events.habits.forEach(habit => {
                const isDone = isHabitDoneForDate(habit, dateStr);
                html += `<div class="day-event habit ${isDone ? 'completed' : ''}" data-type="habit" data-id="${habit.id}">
                    <div class="event-title">${habit.name}</div>
                    <div class="event-meta">${isDone ? 'Completed ✓' : 'Pending'}</div>
                </div>`;
            });
            html += '</div>';
        }
        
        // Google Calendar Events section
        if (events.googleEvents.length > 0) {
            html += '<div class="day-section">';
            html += '<div class="day-section-header google"><i class="fa-brands fa-google"></i> Google Calendar</div>';
            events.googleEvents.forEach(gEvent => {
                html += `<div class="day-event google" data-type="google" data-id="${gEvent.id}">
                    <div class="event-title">${gEvent.title}</div>
                    <div class="event-meta">
                        ${gEvent.time || 'All day'}
                        ${gEvent.location ? ` • ${gEvent.location}` : ''}
                    </div>
                </div>`;
            });
            html += '</div>';
        }
        
        // Empty state
        if (events.tasks.length === 0 && events.exams.length === 0 && events.focusSessions.length === 0 && events.habits.length === 0 && events.recommended.length === 0 && events.googleEvents.length === 0) {
            html += `<div class="day-view-empty">
                <i class="fa-solid fa-calendar-day"></i>
                <p>No events scheduled for this day</p>
                <button class="calendar-btn" onclick="switchTab('tasks')">Add Task</button>
            </div>`;
        }
        
        html += '</div></div>';
        
        elements.calendarGrid.innerHTML = html;
        attachDayEventListeners();
    }

    // ===== DRAG & DROP =====
    function attachWeekCellListeners() {
        const columns = document.querySelectorAll('.calendar-week-column');
        columns.forEach(col => {
            col.addEventListener('dragover', handleDragOver);
            col.addEventListener('drop', handleDrop);
        });
        
        const events = document.querySelectorAll('.week-event[draggable="true"]');
        events.forEach(event => {
            event.addEventListener('dragstart', handleDragStart);
            event.addEventListener('dragend', handleDragEnd);
            event.addEventListener('click', handleEventClick);
        });
    }

    function handleDragStart(e) {
        state.draggedEvent = {
            type: e.target.getAttribute('data-type'),
            id: e.target.getAttribute('data-id'),
            originalDate: e.target.getAttribute('data-date')
        };
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    function handleDragEnd(e) {
        e.target.classList.remove('dragging');
        state.draggedEvent = null;
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('drag-over');
    }

    function handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        
        if (!state.draggedEvent) return;
        
        const newDate = e.currentTarget.getAttribute('data-date');
        const { type, id, originalDate } = state.draggedEvent;
        
        if (newDate === originalDate) return;
        
        // Update event date
        updateEventDate(type, id, newDate);
        
        // Show feedback
        if (typeof Notify !== 'undefined') {
            Notify.success(`Event moved to ${formatDateShort(new Date(newDate))}`);
        }
        
        // Refresh calendar
        loadAllEvents();
        renderCalendar();
    }

    function updateEventDate(type, id, newDate) {
        if (type === 'task') {
            updateTaskDate(id, newDate);
        } else if (type === 'exam') {
            updateExamDate(id, newDate);
        }
    }

    function updateTaskDate(taskId, newDate) {
        try {
            const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                task.dueDate = newDate;
                localStorage.setItem('tasks', JSON.stringify(tasks));
                
                // Update in Firestore
                if (typeof updateTaskInFirestore === 'function' && currentUserId) {
                    updateTaskInFirestore(taskId, { dueDate: newDate });
                }
                
                // Trigger update event
                document.dispatchEvent(new Event('taskUpdated'));
            }
        } catch (error) {
            console.error('Failed to update task date:', error);
        }
    }

    function updateExamDate(examId, newDate) {
        try {
            const exams = JSON.parse(localStorage.getItem('exams') || '[]');
            const exam = exams.find(e => e.id === examId);
            if (exam) {
                exam.date = newDate;
                localStorage.setItem('exams', JSON.stringify(exams));
                
                // Update in Firestore
                if (typeof updateExamInFirestore === 'function' && currentUserId) {
                    updateExamInFirestore(examId, { date: newDate });
                }
            }
        } catch (error) {
            console.error('Failed to update exam date:', error);
        }
    }

    // ===== EVENT MODAL =====
    function handleEventClick(e) {
        e.stopPropagation();
        const type = e.currentTarget.getAttribute('data-type');
        const id = e.currentTarget.getAttribute('data-id');
        showEventModal(type, id);
    }

    function attachDayEventListeners() {
        const events = document.querySelectorAll('.day-event');
        events.forEach(event => {
            event.addEventListener('click', handleEventClick);
            if (event.getAttribute('draggable')) {
                event.addEventListener('dragstart', handleDragStart);
                event.addEventListener('dragend', handleDragEnd);
            }
        });
    }

    function attachDayCellListeners() {
        const cells = document.querySelectorAll('.calendar-day-cell:not(.empty)');
        cells.forEach(cell => {
            cell.addEventListener('click', (e) => {
                const dateStr = cell.getAttribute('data-date');
                state.selectedDate = new Date(dateStr);
                switchView('day');
            });
        });
    }

    function showEventModal(type, id) {
        if (!elements.eventModal || !elements.eventModalContent) return;
        
        let event = null;
        let html = '';
        
        switch (type) {
            case 'task':
                event = state.events.tasks.find(t => t.id === id);
                if (event) html = renderTaskModal(event);
                break;
            case 'exam':
                event = state.events.exams.find(e => e.id === id);
                if (event) html = renderExamModal(event);
                break;
            case 'focus':
                event = state.events.focusSessions.find(s => s.timestamp.toString() === id);
                if (event) html = renderFocusModal(event);
                break;
            case 'habit':
                event = state.events.habits.find(h => h.id === id);
                if (event) html = renderHabitModal(event);
                break;
        }
        
        if (html) {
            elements.eventModalContent.innerHTML = html;
            elements.eventModal.classList.add('active');
        }
    }

    function renderTaskModal(task) {
        const subject = getSubjectById(task.subjectId);
        const priority = task.priority || 'medium';
        
        return `
            <div class="event-modal-header task">
                <i class="fa-solid fa-check"></i>
                <h3>Task Details</h3>
                <button class="modal-close-btn" onclick="Calendar.closeEventModal()">✕</button>
            </div>
            <div class="event-modal-body">
                <div class="event-modal-title">${task.text}</div>
                <div class="event-modal-meta">
                    <div class="meta-item">
                        <i class="fa-solid fa-calendar"></i>
                        ${task.dueDate ? formatDateLong(new Date(task.dueDate)) : 'No due date'}
                    </div>
                    ${task.dueTime ? `
                        <div class="meta-item">
                            <i class="fa-solid fa-clock"></i>
                            ${task.dueTime}
                        </div>
                    ` : ''}
                    <div class="meta-item">
                        <i class="fa-solid fa-flag"></i>
                        Priority: ${priority}
                    </div>
                    ${subject ? `
                        <div class="meta-item">
                            <i class="fa-solid fa-book"></i>
                            ${subject.name}
                        </div>
                    ` : ''}
                </div>
                ${task.subtasks && task.subtasks.length > 0 ? `
                    <div class="event-modal-section">
                        <h4>Subtasks (${task.subtasks.filter(st => st.completed).length}/${task.subtasks.length})</h4>
                        <div class="subtask-list">
                            ${task.subtasks.map(st => `
                                <div class="subtask-item ${st.completed ? 'completed' : ''}">
                                    <i class="fa-solid ${st.completed ? 'fa-check-circle' : 'fa-circle'}"></i>
                                    ${st.text}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
            <div class="event-modal-footer">
                <button class="calendar-btn secondary" onclick="Calendar.closeEventModal()">Close</button>
                <button class="calendar-btn primary" onclick="switchTab('tasks'); Calendar.closeEventModal();">Edit Task</button>
            </div>
        `;
    }

    function renderExamModal(exam) {
        const subject = getSubjectById(exam.subjectId);
        const daysUntil = getDaysUntilDate(exam.date);
        
        return `
            <div class="event-modal-header exam">
                <i class="fa-solid fa-graduation-cap"></i>
                <h3>Exam Details</h3>
                <button class="modal-close-btn" onclick="Calendar.closeEventModal()">✕</button>
            </div>
            <div class="event-modal-body">
                <div class="event-modal-title">${exam.name}</div>
                <div class="event-modal-meta">
                    <div class="meta-item">
                        <i class="fa-solid fa-calendar"></i>
                        ${formatDateLong(new Date(exam.date))}
                    </div>
                    ${exam.time ? `
                        <div class="meta-item">
                            <i class="fa-solid fa-clock"></i>
                            ${exam.time}
                        </div>
                    ` : ''}
                    <div class="meta-item ${daysUntil <= 7 ? 'urgent' : ''}">
                        <i class="fa-solid fa-hourglass-half"></i>
                        ${daysUntil > 0 ? `${daysUntil} days until exam` : daysUntil === 0 ? 'Exam today!' : 'Exam passed'}
                    </div>
                    ${subject ? `
                        <div class="meta-item">
                            <i class="fa-solid fa-book"></i>
                            ${subject.name}
                        </div>
                    ` : ''}
                </div>
            </div>
            <div class="event-modal-footer">
                <button class="calendar-btn secondary" onclick="Calendar.closeEventModal()">Close</button>
                <button class="calendar-btn primary" onclick="switchTab('academics'); Calendar.closeEventModal();">View in Academics</button>
            </div>
        `;
    }

    function renderFocusModal(session) {
        const subject = getSubjectById(session.subjectId);
        const date = session.completedAt ? new Date(session.completedAt) : new Date();
        
        return `
            <div class="event-modal-header focus">
                <i class="fa-solid fa-clock"></i>
                <h3>Focus Session</h3>
                <button class="modal-close-btn" onclick="Calendar.closeEventModal()">✕</button>
            </div>
            <div class="event-modal-body">
                <div class="event-modal-title">Completed Focus Session</div>
                <div class="event-modal-meta">
                    <div class="meta-item">
                        <i class="fa-solid fa-calendar"></i>
                        ${formatDateLong(date)}
                    </div>
                    <div class="meta-item">
                        <i class="fa-solid fa-clock"></i>
                        ${Math.round(session.duration / 60)} minutes
                    </div>
                    ${subject ? `
                        <div class="meta-item">
                            <i class="fa-solid fa-book"></i>
                            ${subject.name}
                        </div>
                    ` : ''}
                </div>
            </div>
            <div class="event-modal-footer">
                <button class="calendar-btn secondary" onclick="Calendar.closeEventModal()">Close</button>
            </div>
        `;
    }

    function renderHabitModal(habit) {
        return `
            <div class="event-modal-header habit">
                <i class="fa-solid fa-repeat"></i>
                <h3>Habit Reminder</h3>
                <button class="modal-close-btn" onclick="Calendar.closeEventModal()">✕</button>
            </div>
            <div class="event-modal-body">
                <div class="event-modal-title">${habit.name}</div>
                <div class="event-modal-meta">
                    <div class="meta-item">
                        <i class="fa-solid fa-fire"></i>
                        Current streak: ${habit.streak || 0} days
                    </div>
                    <div class="meta-item">
                        <i class="fa-solid fa-target"></i>
                        Goal: ${habit.goal || 'Daily'}
                    </div>
                </div>
            </div>
            <div class="event-modal-footer">
                <button class="calendar-btn secondary" onclick="Calendar.closeEventModal()">Close</button>
                <button class="calendar-btn primary" onclick="switchTab('habits'); Calendar.closeEventModal();">View Habits</button>
            </div>
        `;
    }

    function closeEventModal() {
        if (elements.eventModal) {
            elements.eventModal.classList.remove('active');
        }
    }

    // ===== MOBILE TOUCH NAVIGATION =====
    function handleTouchStart(e) {
        if (!e.touches || e.touches.length === 0) return;
        
        state.touchStart = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        };
    }

    function handleTouchMove(e) {
        if (!state.touchStart) return;
    }

    function handleTouchEnd(e) {
        if (!state.touchStart) return;
        if (!e.changedTouches || e.changedTouches.length === 0) return;
        
        const touchEnd = {
            x: e.changedTouches[0].clientX,
            y: e.changedTouches[0].clientY
        };
        
        const deltaX = touchEnd.x - state.touchStart.x;
        const deltaY = Math.abs(touchEnd.y - state.touchStart.y);
        
        // Only trigger if horizontal swipe is dominant
        if (Math.abs(deltaX) > CONFIG.swipeThreshold && Math.abs(deltaX) > deltaY) {
            if (deltaX > 0) {
                // Swipe right - go to previous
                navigatePrev();
            } else {
                // Swipe left - go to next
                navigateNext();
            }
        }
        
        state.touchStart = null;
    }

    // ===== NAVIGATION =====
    function navigatePrev() {
        switch (state.currentView) {
            case 'month':
                state.currentDate.setMonth(state.currentDate.getMonth() - 1);
                break;
            case 'week':
                state.currentDate.setDate(state.currentDate.getDate() - 7);
                break;
            case 'day':
                state.currentDate.setDate(state.currentDate.getDate() - 1);
                break;
        }
        renderCalendar();
    }

    function navigateNext() {
        switch (state.currentView) {
            case 'month':
                state.currentDate.setMonth(state.currentDate.getMonth() + 1);
                break;
            case 'week':
                state.currentDate.setDate(state.currentDate.getDate() + 7);
                break;
            case 'day':
                state.currentDate.setDate(state.currentDate.getDate() + 1);
                break;
        }
        renderCalendar();
    }

    function goToToday() {
        state.currentDate = new Date();
        state.selectedDate = null;
        renderCalendar();
    }

    function updateHeaderTitle() {
        if (!elements.currentMonth) return;
        
        const year = state.currentDate.getFullYear();
        const month = state.currentDate.getMonth();
        
        switch (state.currentView) {
            case 'month':
                elements.currentMonth.textContent = formatMonthYear(new Date(year, month, 1));
                break;
            case 'week':
                const weekStart = getWeekStart(state.currentDate);
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);
                elements.currentMonth.textContent = `${formatDateShort(weekStart)} - ${formatDateShort(weekEnd)}`;
                break;
            case 'day':
                const displayDate = state.selectedDate || state.currentDate;
                elements.currentMonth.textContent = formatDateLong(displayDate);
                break;
        }
    }

    // ===== UTILITY FUNCTIONS =====
    function getEventsForDate(dateStr) {
        return {
            tasks: state.events.tasks.filter(t => t.dueDate === dateStr),
            exams: state.events.exams.filter(e => e.date === dateStr),
            focusSessions: state.events.focusSessions.filter(s => {
                if (!s.completedAt) return false;
                return s.completedAt.split('T')[0] === dateStr;
            }),
            habits: state.events.habits, // All habits shown for all days
            recommended: state.events.recommended.filter(r => r.date === dateStr),
            googleEvents: state.events.googleEvents.filter(g => g.date === dateStr)
        };
    }

    function getHeatmapIntensity(dateStr) {
        const data = state.heatmapData[dateStr];
        if (!data) return 0;
        return Math.min(data.hours / CONFIG.heatmapMaxHours, 1);
    }

    function getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day;
        return new Date(d.setDate(diff));
    }

    function isDateToday(date) {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    }

    function isHabitDoneForDate(habit, dateStr) {
        if (!habit.completedDates) return false;
        return habit.completedDates.includes(dateStr);
    }

    function getDaysUntilDate(dateStr) {
        const target = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        target.setHours(0, 0, 0, 0);
        return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    }

    function getSubjectById(subjectId) {
        if (!subjectId) return null;
        try {
            const subjects = JSON.parse(localStorage.getItem('subjects') || '[]');
            return subjects.find(s => s.id === subjectId) || null;
        } catch {
            return null;
        }
    }

    // Date formatting
    function formatDateISO(date) {
        return date.toISOString().split('T')[0];
    }

    function formatDateShort(date) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function formatDateLong(date) {
        return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    function formatMonthYear(date) {
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    }

    // ===== VIRTUAL RENDERING OPTIMIZATION =====
    
    /**
     * Get visible date range based on current view
     * Only loads events within this range for performance
     */
    function getVisibleDateRange() {
        const buffer = CONFIG.virtualRenderBuffer;
        let startDate, endDate;
        
        if (state.currentView === 'month') {
            // Month view: show entire month + buffer
            const monthStart = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth(), 1);
            const monthEnd = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() + 1, 0);
            
            startDate = new Date(monthStart);
            startDate.setDate(startDate.getDate() - buffer);
            
            endDate = new Date(monthEnd);
            endDate.setDate(endDate.getDate() + buffer);
        } else if (state.currentView === 'week') {
            // Week view: show current week + buffer
            const weekStart = getWeekStart(state.currentDate);
            
            startDate = new Date(weekStart);
            startDate.setDate(startDate.getDate() - buffer);
            
            endDate = new Date(weekStart);
            endDate.setDate(endDate.getDate() + 7 + buffer);
        } else {
            // Day view: show single day + buffer
            startDate = new Date(state.currentDate);
            startDate.setDate(startDate.getDate() - buffer);
            
            endDate = new Date(state.currentDate);
            endDate.setDate(endDate.getDate() + 1 + buffer);
        }
        
        return {
            start: formatDateISO(startDate),
            end: formatDateISO(endDate)
        };
    }
    
    /**
     * Filter events to only visible range for performance
     * Called automatically during rendering
     */
    function filterEventsInRange(events, range) {
        const { start, end } = range;
        
        return {
            tasks: events.tasks.filter(t => t.dueDate >= start && t.dueDate <= end),
            exams: events.exams.filter(e => e.date >= start && e.date <= end),
            focusSessions: events.focusSessions.filter(s => {
                if (!s.completedAt) return false;
                const date = s.completedAt.split('T')[0];
                return date >= start && date <= end;
            }),
            habits: events.habits, // Always show all habits
            recommended: events.recommended.filter(r => r.date >= start && r.date <= end),
            googleEvents: events.googleEvents.filter(g => g.date >= start && g.date <= end)
        };
    }
    
    /**
     * Optimized event loading with lazy loading support
     * Can be extended for infinite scroll in future
     */
    function optimizedLoadEvents() {
        const range = getVisibleDateRange();
        const allEvents = {
            tasks: loadTasks(),
            exams: loadExams(),
            focusSessions: loadFocusSessions(),
            habits: loadHabits(),
            recommended: loadRecommendedSessions(),
            googleEvents: state.events.googleEvents // Already loaded from API
        };
        
        // Apply range filtering for performance
        state.events = filterEventsInRange(allEvents, range);
        
        // Log optimization stats in debug mode
        if (window.calendarDebug) {
            console.log('📊 Virtual Rendering Stats:', {
                range,
                taskCount: state.events.tasks.length,
                examCount: state.events.exams.length,
                recommendedCount: state.events.recommended.length,
                googleEventCount: state.events.googleEvents.length
            });
        }
    }

    // ===== PUBLIC API =====
    return {
        init,
        switchView,
        refresh: () => {
            loadAllEvents();
            renderCalendar();
        },
        goToDate: (date) => {
            state.currentDate = new Date(date);
            state.selectedDate = null;
            loadAllEvents(); // Reload for new date range
            renderCalendar();
        },
        closeEventModal,
        getState: () => ({ ...state }),
        // Google Calendar controls
        signInGoogle,
        signOutGoogle,
        exportToGoogleCalendar,
        // Performance controls
        setVirtualRendering: (enabled) => {
            CONFIG.enableVirtualRendering = enabled;
            loadAllEvents();
            renderCalendar();
        },
        getConfig: () => ({ ...CONFIG })
    };
})();

// NOTE: No auto-initialization - controlled by StartupManager Phase 3 (lazy loading)
// Calendar loads only when user opens the Calendar tab for optimal startup performance
