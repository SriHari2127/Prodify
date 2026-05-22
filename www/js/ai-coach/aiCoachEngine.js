// ===== AI STUDY COACH ENGINE =====
// Core orchestrator for AI-powered study coaching system
// Integrates behavior analysis, recommendations, predictions, and motivation

const AICoachEngine = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    const CONFIG = {
        // Analytics collection keys
        ANALYTICS_PREFIX: 'ai_coach_',
        CACHE_DURATION: 3600000, // 1 hour cache
        
        // Recalculation triggers
        TRIGGERS: {
            FOCUS_COMPLETED: 'focus_completed',
            TASK_COMPLETED: 'task_completed',
            HABIT_UPDATED: 'habit_updated',
            EXAM_ADDED: 'exam_added',
            MANUAL_REFRESH: 'manual_refresh'
        },
        
        // Insight freshness threshold
        MAX_INSIGHT_AGE: 86400000, // 24 hours
        
        // Performance optimization
        DEBOUNCE_DELAY: 2000, // 2 seconds debounce for auto-recalculation
        MAX_RETRIES: 3,
        RETRY_DELAY: 1000 // 1 second between retries
    };

    // ===== STATE =====
    let cache = {
        lastUpdate: null,
        insights: null,
        recommendations: null,
        predictions: null,
        patterns: null,
        motivation: null,
        weakSubjects: null
    };

    let isInitialized = false;
    let debounceTimer = null;
    let isCalculating = false;

    // ===== INITIALIZATION =====
    function init() {
        if (isInitialized) {
            console.log('⚠️ AI Coach already initialized');
            return;
        }

        console.log('🤖 AI Study Coach Engine initializing...');

        // Initialize sub-modules
        if (typeof BehaviorAnalyzer !== 'undefined') {
            BehaviorAnalyzer.init();
        }
        if (typeof StudyRecommendationEngine !== 'undefined') {
            StudyRecommendationEngine.init();
        }
        if (typeof ProductivityPredictor !== 'undefined') {
            ProductivityPredictor.init();
        }
        if (typeof WeakSubjectDetector !== 'undefined') {
            WeakSubjectDetector.init();
        }
        if (typeof ExamPreparationAdvisor !== 'undefined') {
            ExamPreparationAdvisor.init();
        }
        if (typeof StudyPatternAnalyzer !== 'undefined') {
            StudyPatternAnalyzer.init();
        }
        if (typeof MotivationGenerator !== 'undefined') {
            MotivationGenerator.init();
        }

        // Load cached data
        loadCache();

        // Set up event listeners for auto-recalculation
        setupEventListeners();

        isInitialized = true;
        console.log('✅ AI Study Coach Engine ready');
    }

    // ===== CACHE MANAGEMENT =====
    function loadCache() {
        const cached = localStorage.getItem('ai_coach_cache');
        if (cached) {
            try {
                cache = JSON.parse(cached);
                console.log('📦 AI Coach cache loaded');
            } catch (e) {
                console.error('❌ Error loading cache:', e);
                cache = resetCache();
            }
        }
    }

    function saveCache() {
        try {
            localStorage.setItem('ai_coach_cache', JSON.stringify(cache));
            console.log('💾 AI Coach cache saved');
        } catch (e) {
            console.error('❌ Error saving cache:', e);
        }
    }

    function resetCache() {
        return {
            lastUpdate: null,
            insights: null,
            recommendations: null,
            predictions: null,
            patterns: null,
            motivation: null,
            weakSubjects: null
        };
    }

    function isCacheValid() {
        if (!cache.lastUpdate) return false;
        const age = Date.now() - cache.lastUpdate;
        return age < CONFIG.CACHE_DURATION;
    }

    function invalidateCache() {
        console.log('🔄 Invalidating AI Coach cache');
        cache = resetCache();
        saveCache();
    }

    // ===== UTILITY FUNCTIONS =====
    
    /**
     * Debounce function to prevent excessive recalculations
     * @param {Function} func - Function to debounce
     * @param {number} delay - Delay in milliseconds
     * @returns {Function} Debounced function
     */
    function debounce(func, delay) {
        return function(...args) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => func.apply(this, args), delay);
        };
    }
    
    /**
     * Retry a function with exponential backoff
     * @param {Function} fn - Function to retry
     * @param {number} retries - Number of retries
     * @returns {Promise} Promise that resolves with result or rejects after retries
     */
    async function retryWithBackoff(fn, retries = CONFIG.MAX_RETRIES) {
        for (let i = 0; i < retries; i++) {
            try {
                return await fn();
            } catch (error) {
                if (i === retries - 1) throw error;
                const delay = CONFIG.RETRY_DELAY * Math.pow(2, i);
                console.log(`⚠️ Retry attempt ${i + 1}/${retries} after ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // ===== EVENT LISTENERS =====
    function setupEventListeners() {
        // Create debounced recalculation function
        const debouncedRecalculate = debounce((trigger) => {
            if (!isCalculating) {
                recalculateInsights(trigger);
            }
        }, CONFIG.DEBOUNCE_DELAY);

        // Listen for focus session completion
        document.addEventListener('focusSessionCompleted', () => {
            console.log('🎯 Focus session completed - scheduling AI Coach update');
            debouncedRecalculate(CONFIG.TRIGGERS.FOCUS_COMPLETED);
        });

        // Listen for task completion
        document.addEventListener('taskCompleted', () => {
            console.log('✅ Task completed - scheduling AI Coach update');
            debouncedRecalculate(CONFIG.TRIGGERS.TASK_COMPLETED);
        });

        // Listen for habit updates
        document.addEventListener('habitUpdated', () => {
            console.log('🎯 Habit updated - scheduling AI Coach update');
            debouncedRecalculate(CONFIG.TRIGGERS.HABIT_UPDATED);
        });

        // Listen for exam added
        document.addEventListener('examAdded', () => {
            console.log('📚 Exam added - scheduling AI Coach update');
            debouncedRecalculate(CONFIG.TRIGGERS.EXAM_ADDED);
        });
    }

    // ===== CORE ORCHESTRATION =====
    
    /**
     * Generate all AI insights and recommendations
     * @param {string} trigger - What triggered the recalculation
     * @returns {Promise<Object>} Complete AI coach data
     */
    async function recalculateInsights(trigger = CONFIG.TRIGGERS.MANUAL_REFRESH) {
        // Prevent concurrent calculations
        if (isCalculating) {
            console.log('⏳ AI Coach calculation already in progress, skipping...');
            return cache;
        }
        
        isCalculating = true;
        console.log(`🤖 Recalculating AI insights (trigger: ${trigger})`);
        
        const startTime = performance.now();

        try {
            // Dispatch loading event
            document.dispatchEvent(new CustomEvent('aiCoachCalculating', { 
                detail: { trigger } 
            }));

            // Step 1: Analyze behavior (with retry)
            const behaviorMetrics = await retryWithBackoff(() => 
                Promise.resolve(BehaviorAnalyzer.analyze())
            );
            
            // Step 2: Detect weak subjects (with retry)
            const weakSubjects = await retryWithBackoff(() => 
                Promise.resolve(WeakSubjectDetector.detectWeakSubjects())
            );
            
            // Step 3: Analyze study patterns (with retry)
            const patterns = await retryWithBackoff(() => 
                Promise.resolve(StudyPatternAnalyzer.analyzePatterns())
            );
            
            // Step 4: Generate predictions (with retry)
            const predictions = await retryWithBackoff(() => 
                Promise.resolve(ProductivityPredictor.predict())
            );
            
            // Step 5: Check exam preparation (with retry)
            const examAdvice = await retryWithBackoff(() => 
                Promise.resolve(ExamPreparationAdvisor.generateAdvice())
            );
            
            // Step 6: Generate recommendations (with retry)
            const recommendations = await retryWithBackoff(() => 
                Promise.resolve(StudyRecommendationEngine.generate({
                    behaviorMetrics,
                    weakSubjects,
                    patterns,
                    predictions,
                    examAdvice
                }))
            );
            
            // Step 7: Generate motivation (with retry)
            const motivation = await retryWithBackoff(() => 
                Promise.resolve(MotivationGenerator.generate({
                    behaviorMetrics,
                    patterns,
                    predictions
                }))
            );

            // Update cache
            cache = {
                lastUpdate: Date.now(),
                insights: behaviorMetrics,
                recommendations,
                predictions,
                patterns,
                motivation,
                weakSubjects,
                examAdvice
            };

            saveCache();

            // Store in analytics
            storeAnalytics(cache);

            const duration = (performance.now() - startTime).toFixed(2);
            console.log(`✅ AI insights calculated in ${duration}ms`);

            // Dispatch success event for UI updates
            document.dispatchEvent(new CustomEvent('aiCoachUpdated', { 
                detail: { ...cache, calculationTime: duration } 
            }));

            return cache;

        } catch (error) {
            console.error('❌ Error calculating AI insights:', error);
            
            // Dispatch error event
            document.dispatchEvent(new CustomEvent('aiCoachError', { 
                detail: { error: error.message, trigger } 
            }));
            
            // Return cached data if available
            return cache.lastUpdate ? cache : null;
            
        } finally {
            isCalculating = false;
        }
    }

    /**
     * Get current AI coach data (uses cache if valid)
     * @param {boolean} forceRefresh - Force recalculation
     * @returns {Object} AI coach data
     */
    function getCoachData(forceRefresh = false) {
        if (forceRefresh || !isCacheValid()) {
            return recalculateInsights();
        }
        return cache;
    }

    /**
     * Get specific insight type
     * @param {string} type - Type of insight (recommendations, predictions, etc.)
     * @returns {any} Specific insight data
     */
    function getInsight(type) {
        if (!isCacheValid()) {
            recalculateInsights();
        }
        return cache[type] || null;
    }

    // ===== ANALYTICS STORAGE =====
    function storeAnalytics(data) {
        if (typeof db === 'undefined') return;

        const timestamp = new Date().toISOString();
        const date = timestamp.split('T')[0];

        // Store key metrics in analytics database
        const analyticsEntries = [
            {
                date,
                metric: 'ai_weekly_study_hours',
                value: data.insights?.weeklyStudyHours || 0,
                createdAt: timestamp
            },
            {
                date,
                metric: 'ai_task_completion_rate',
                value: data.insights?.taskCompletionRate || 0,
                createdAt: timestamp
            },
            {
                date,
                metric: 'ai_habit_consistency',
                value: data.insights?.habitConsistency || 0,
                createdAt: timestamp
            },
            {
                date,
                metric: 'ai_focus_success_rate',
                value: data.insights?.focusSuccessRate || 0,
                createdAt: timestamp
            },
            {
                date,
                metric: 'ai_productivity_prediction',
                value: data.predictions?.expectedStudyHours || 0,
                createdAt: timestamp
            }
        ];

        // Store in IndexedDB
        analyticsEntries.forEach(async (entry) => {
            try {
                await db.analytics.add(entry);
            } catch (e) {
                console.error('Error storing AI analytics:', e);
            }
        });

        // Sync to Firestore if available
        if (typeof currentUserId !== 'undefined' && currentUserId && typeof firebase !== 'undefined') {
            syncToFirestore(data);
        }
    }

    // ===== FIRESTORE SYNC =====
    function syncToFirestore(data) {
        try {
            const docRef = firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection('aiCoachInsights')
                .doc(new Date().toISOString().split('T')[0]);

            docRef.set({
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                insights: data.insights,
                recommendations: data.recommendations,
                predictions: data.predictions,
                patterns: data.patterns,
                weakSubjects: data.weakSubjects,
                examAdvice: data.examAdvice
            }, { merge: true });

            console.log('☁️ AI Coach data synced to Firestore');
        } catch (e) {
            console.error('❌ Error syncing to Firestore:', e);
        }
    }

    // ===== PUBLIC API =====
    return {
        init,
        getCoachData,
        getInsight,
        recalculateInsights,
        invalidateCache,
        
        // Direct access to cache for debugging
        _getCache: () => cache,
        _isCacheValid: isCacheValid
    };
})();

// NOTE: No auto-initialization - controlled by StartupManager Phase 3 (lazy loading)
// AI Coach loads only when user opens the AI Coach tab for optimal startup performance
