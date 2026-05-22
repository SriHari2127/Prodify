/**
 * STARTUP MANAGER
 * Orchestrates three-phase app initialization for optimal performance
 * 
 * Phase 1: Core UI (<500ms) - Essential modules for first render
 * Phase 2: Background Services (1.5-2s delay) - Sync and background tasks
 * Phase 3: On-Demand (Lazy) - Heavy systems loaded when needed
 */

const StartupManager = (function() {
    'use strict';

    // Initialization state tracking
    const state = {
        phase1Complete: false,
        phase2Complete: false,
        lazyModulesLoaded: new Set(),
        serviceWorkerRegistered: false,
        syncManagerStarted: false
    };

    // Performance markers
    const perf = {
        startTime: performance.now(),
        phase1Time: 0,
        phase2Time: 0
    };

    // ============================================================
    // PHASE 1: CORE UI (IMMEDIATE - Target <500ms)
    // ============================================================
    
    async function initPhase1() {
        console.log('🚀 Phase 1: Core UI initialization started');
        const phase1Start = performance.now();

        try {
            // 1. Initialize IndexedDB (essential for offline-first)
            if (typeof initIndexedDB === 'function') {
                await initIndexedDB();
                console.log('✅ IndexedDB initialized');
            }

            // 2. Load essential data from IndexedDB (fast, no network)
            await loadCoreData();

            // 3. Initialize skeleton loaders
            if (typeof SkeletonLoader !== 'undefined') {
                console.log('✅ Skeleton loaders ready');
            }

            // 4. Initialize UI renderer
            if (typeof initializeUI === 'function') {
                initializeUI();
                console.log('✅ UI initialized');
            }

            state.phase1Complete = true;
            perf.phase1Time = performance.now() - phase1Start;
            console.log(`✅ Phase 1 complete in ${perf.phase1Time.toFixed(2)}ms`);

            // Trigger Phase 2 after a short delay
            setTimeout(() => initPhase2(), 1500);

        } catch (error) {
            console.error('❌ Phase 1 initialization error:', error);
            // Continue anyway - app should be usable even if some features fail
            state.phase1Complete = true;
            setTimeout(() => initPhase2(), 2000);
        }
    }

    /**
     * Load essential data from IndexedDB (no network calls)
     */
    async function loadCoreData() {
        // Load from IndexedDB only (fast, synchronous-like)
        if (typeof loadTasksFromIndexedDB === 'function') {
            await loadTasksFromIndexedDB();
            console.log('✅ Tasks loaded from IndexedDB');
        }

        if (typeof loadHabitsFromIndexedDB === 'function') {
            await loadHabitsFromIndexedDB();
            console.log('✅ Habits loaded from IndexedDB');
        }

        // Update UI counters
        if (typeof updateCounter === 'function') updateCounter();
        if (typeof updateStats === 'function') updateStats();
    }

    // ============================================================
    // PHASE 2: BACKGROUND SERVICES (DELAYED 1.5-2s)
    // ============================================================
    
    async function initPhase2() {
        if (state.phase2Complete) {
            console.log('⚠️ Phase 2 already completed, skipping');
            return;
        }

        console.log('🔄 Phase 2: Background services initialization started');
        const phase2Start = performance.now();

        try {
            // 1. Initialize Sync Manager (with guard to prevent duplicates)
            if (!state.syncManagerStarted) {
                await initSyncManager();
            }

            // 2. Initialize Network Monitor
            if (typeof networkMonitor !== 'undefined' && typeof networkMonitor.init === 'function') {
                networkMonitor.init();
                console.log('✅ Network Monitor initialized');
            }

            // 3. Initialize Background Task Runner
            if (typeof backgroundTaskRunner !== 'undefined' && typeof backgroundTaskRunner.initialize === 'function') {
                await backgroundTaskRunner.initialize();
                console.log('✅ Background Task Runner initialized');
            }

            // 4. Initialize Device Manager
            if (typeof DeviceManager !== 'undefined' && typeof DeviceManager.init === 'function') {
                DeviceManager.init();
                console.log('✅ Device Manager initialized');
            }

            // 5. Register Service Worker (delayed, non-blocking)
            setTimeout(() => registerServiceWorker(), 3000);

            // 6. Initialize Firestore sync (lazy initialization)
            initFirestoreSync();

            state.phase2Complete = true;
            perf.phase2Time = performance.now() - phase2Start;
            console.log(`✅ Phase 2 complete in ${perf.phase2Time.toFixed(2)}ms`);

            // Log total startup time
            const totalTime = performance.now() - perf.startTime;
            console.log(`🎉 App startup complete in ${totalTime.toFixed(2)}ms`);

        } catch (error) {
            console.error('❌ Phase 2 initialization error:', error);
            state.phase2Complete = true;
        }
    }

    /**
     * Initialize Sync Manager with duplicate prevention
     */
    async function initSyncManager() {
        if (state.syncManagerStarted) {
            console.log('⚠️ Sync Manager already started, skipping');
            return;
        }

        if (typeof syncManager !== 'undefined') {
            // Check if syncManager is already running
            if (typeof syncManager.isRunning === 'function' && syncManager.isRunning()) {
                console.log('⚠️ Sync Manager already running');
                state.syncManagerStarted = true;
                return;
            }

            // Initialize Sync Manager
            if (typeof syncManager.initialize === 'function') {
                await syncManager.initialize();
                console.log('✅ Sync Manager initialized');
                state.syncManagerStarted = true;

                // Start auto-sync if not already running
                if (typeof syncManager.startAutoSync === 'function' && !syncManager.isRunning()) {
                    syncManager.startAutoSync();
                    console.log('✅ Auto-sync started');
                }
            }
        } else {
            console.log('⚠️ syncManager not available');
        }
    }

    /**
     * Initialize Firestore with lazy loading
     */
    function initFirestoreSync() {
        // Only initialize Firestore when user is authenticated and online
        if (typeof firebase === 'undefined' || !firebase.auth().currentUser) {
            console.log('ℹ️ Skipping Firestore init (not authenticated)');
            return;
        }

        // Check network status
        if (typeof NetworkMonitor !== 'undefined' && !NetworkMonitor.isOnline()) {
            console.log('ℹ️ Skipping Firestore init (offline)');
            return;
        }

        // Lazy initialize Firestore sync
        setTimeout(() => {
            if (typeof FirestoreSyncAdapter !== 'undefined' && typeof FirestoreSyncAdapter.init === 'function') {
                FirestoreSyncAdapter.init();
                console.log('✅ Firestore sync initialized (lazy)');
            }
        }, 2000);
    }

    /**
     * Register Service Worker with delay to avoid blocking
     */
    function registerServiceWorker() {
        if (state.serviceWorkerRegistered) {
            console.log('⚠️ Service Worker already registered');
            return;
        }

        // Use ServiceWorkerManager if available (more sophisticated)
        if (typeof serviceWorkerManager !== 'undefined' && typeof serviceWorkerManager.register === 'function') {
            serviceWorkerManager.register()
                .then(() => {
                    console.log('✅ Service Worker registered via ServiceWorkerManager');
                    state.serviceWorkerRegistered = true;
                })
                .catch(error => {
                    console.log('ℹ️ Service Worker registration failed:', error);
                });
        } else if ('serviceWorker' in navigator) {
            // Fallback to basic registration
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => {
                    console.log('✅ Service Worker registered:', registration.scope);
                    state.serviceWorkerRegistered = true;
                })
                .catch(error => {
                    console.log('ℹ️ Service Worker registration failed:', error);
                });
        }
    }

    // ============================================================
    // PHASE 3: ON-DEMAND LAZY LOADING
    // ============================================================
    
    /**
     * Lazy load AI Coach system when needed
     */
    async function loadAICoach() {
        if (state.lazyModulesLoaded.has('aiCoach')) {
            console.log('ℹ️ AI Coach already loaded');
            return;
        }

        console.log('🤖 Loading AI Coach system...');
        
        try {
            // Initialize AI Coach Engine
            if (typeof AICoachEngine !== 'undefined' && typeof AICoachEngine.init === 'function') {
                await AICoachEngine.init();
                console.log('✅ AI Coach Engine initialized');
            }

            // Initialize Coach UI Renderer
            if (typeof CoachUIRenderer !== 'undefined' && typeof CoachUIRenderer.init === 'function') {
                CoachUIRenderer.init();
                console.log('✅ Coach UI Renderer initialized');
            }

            state.lazyModulesLoaded.add('aiCoach');
            console.log('✅ AI Coach system loaded successfully');

        } catch (error) {
            console.error('❌ AI Coach loading error:', error);
        }
    }

    /**
     * Lazy load Analytics system when needed
     */
    async function loadAnalytics() {
        if (state.lazyModulesLoaded.has('analytics')) {
            console.log('ℹ️ Analytics already loaded');
            return;
        }

        console.log('📊 Loading Analytics system...');
        
        try {
            // Initialize Smart Analytics
            if (typeof SmartAnalytics !== 'undefined' && typeof SmartAnalytics.init === 'function') {
                await SmartAnalytics.init();
                console.log('✅ Smart Analytics initialized');
            }

            // Initialize Focus Blocker Analytics
            if (typeof FocusBlockerAnalytics !== 'undefined' && typeof FocusBlockerAnalytics.init === 'function') {
                FocusBlockerAnalytics.init();
                console.log('✅ Focus Blocker Analytics initialized');
            }

            state.lazyModulesLoaded.add('analytics');
            console.log('✅ Analytics system loaded successfully');

        } catch (error) {
            console.error('❌ Analytics loading error:', error);
        }
    }

    /**
     * Lazy load Calendar system when needed
     */
    async function loadCalendar() {
        if (state.lazyModulesLoaded.has('calendar')) {
            console.log('ℹ️ Calendar already loaded');
            return;
        }

        console.log('📅 Loading Calendar system...');
        
        try {
            // Initialize Calendar
            if (typeof Calendar !== 'undefined' && typeof Calendar.init === 'function') {
                Calendar.init();
                console.log('✅ Calendar initialized');
            }
            
            state.lazyModulesLoaded.add('calendar');
            console.log('✅ Calendar system loaded successfully');

        } catch (error) {
            console.error('❌ Calendar loading error:', error);
        }
    }

    /**
     * Lazy load Study Scheduler when needed
     */
    async function loadScheduler() {
        if (state.lazyModulesLoaded.has('scheduler')) {
            console.log('ℹ️ Scheduler already loaded');
            return;
        }

        console.log('📚 Loading Study Scheduler...');
        
        try {
            // Initialize Study Scheduler
            if (typeof StudyScheduler !== 'undefined' && typeof StudyScheduler.init === 'function') {
                StudyScheduler.init();
                console.log('✅ Study Scheduler initialized');
            }
            
            state.lazyModulesLoaded.add('scheduler');
            console.log('✅ Study Scheduler loaded successfully');

        } catch (error) {
            console.error('❌ Scheduler loading error:', error);
        }
    }

    /**
     * Lazy load Device Optimization Engine when needed
     */
    async function loadDeviceOptimization() {
        if (state.lazyModulesLoaded.has('deviceOptimization')) {
            console.log('ℹ️ Device Optimization already loaded');
            return;
        }

        console.log('⚙️ Loading Device Optimization Engine...');
        
        try {
            // Initialize Device Optimization Engine
            if (typeof DeviceOptimizationEngine !== 'undefined' && typeof DeviceOptimizationEngine.initialize === 'function') {
                await DeviceOptimizationEngine.initialize();
                console.log('✅ Device Optimization Engine initialized');
            }
            
            state.lazyModulesLoaded.add('deviceOptimization');
            console.log('✅ Device Optimization loaded successfully');

        } catch (error) {
            console.error('❌ Device Optimization loading error:', error);
        }
    }

    // ============================================================
    // PUBLIC API
    // ============================================================
    
    return {
        // Start the app initialization
        start: function() {
            console.log('🚀 StartupManager: Beginning app initialization');
            initPhase1();
        },

        // Lazy loaders for on-demand systems
        loadAICoach,
        loadAnalytics,
        loadCalendar,
        loadScheduler,
        loadDeviceOptimization,

        // Check initialization state
        isPhase1Complete: () => state.phase1Complete,
        isPhase2Complete: () => state.phase2Complete,
        isModuleLoaded: (moduleName) => state.lazyModulesLoaded.has(moduleName),

        // Performance metrics
        getPerformanceMetrics: () => ({
            totalTime: performance.now() - perf.startTime,
            phase1Time: perf.phase1Time,
            phase2Time: perf.phase2Time,
            lazyModulesLoaded: Array.from(state.lazyModulesLoaded)
        })
    };
})();

// Auto-start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => StartupManager.start());
} else {
    StartupManager.start();
}

// Make it globally available
window.StartupManager = StartupManager;
