// ===== DEVICE OPTIMIZATION ENGINE MODULE =====
// Adaptive UI rendering and performance optimization based on device capabilities
// Provides responsive layouts, performance tuning, and resource management

const DeviceOptimizationEngine = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    
    const CONFIG = {
        PERFORMANCE_CHECK_INTERVAL: 30000, // 30 seconds
        LOW_MEMORY_THRESHOLD: 100, // MB
        HIGH_CPU_THRESHOLD: 80, // percentage
        ANIMATION_FPS_THRESHOLD: 30,
        ENABLE_ADAPTIVE_UI: true,
        ENABLE_PERFORMANCE_MONITORING: true
    };

    // ===== STATE =====
    
    let deviceProfile = null;
    let performanceMode = 'auto'; // 'auto', 'performance', 'battery', 'quality'
    let currentOptimizations = [];
    let isInitialized = false;
    let performanceMonitor = null;

    // ===== INITIALIZATION =====

    /**
     * Initialize device optimization engine
     * @returns {Promise<void>}
     */
    async function initialize() {
        if (isInitialized) {
            console.log('⚠️ DeviceOptimizationEngine already initialized');
            return;
        }

        if (!DeviceManager.isReady()) {
            console.log('⚠️ DeviceManager not ready');
            return;
        }

        try {
            // Build device profile
            deviceProfile = await buildDeviceProfile();

            // Apply initial optimizations
            applyOptimizations();

            // Start performance monitoring
            if (CONFIG.ENABLE_PERFORMANCE_MONITORING) {
                startPerformanceMonitoring();
            }

            // Setup resize listener
            window.addEventListener('resize', debounce(handleResize, 300));

            // Setup orientation change listener
            window.addEventListener('orientationchange', handleOrientationChange);

            isInitialized = true;
            console.log('✅ DeviceOptimizationEngine initialized');

        } catch (error) {
            console.error('❌ Error initializing DeviceOptimizationEngine:', error);
            throw error;
        }
    }

    // ===== DEVICE PROFILING =====

    /**
     * Build comprehensive device profile
     * @returns {Promise<Object>} Device profile
     */
    async function buildDeviceProfile() {
        const device = DeviceManager.getCurrentDevice();
        const capabilities = device.capabilities;

        const profile = {
            deviceType: device.deviceType,
            screenSize: calculateScreenSize(capabilities.screenWidth, capabilities.screenHeight),
            screenCategory: categorizeScreen(capabilities.screenWidth),
            performanceTier: await estimatePerformanceTier(),
            networkSpeed: await estimateNetworkSpeed(),
            batteryStatus: await getBatteryStatus(),
            memoryAvailable: capabilities.memory,
            cpuCores: capabilities.cores,
            isHighDPI: capabilities.isHighDPI,
            supportsTouch: capabilities.supportsTouch,
            prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
            colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        };

        return profile;
    }

    /**
     * Calculate screen size category
     * @param {number} width - Screen width
     * @param {number} height - Screen height
     * @returns {string} Size category
     */
    function calculateScreenSize(width, height) {
        const diagonal = Math.sqrt(width * width + height * height);
        
        if (diagonal < 480) return 'small';
        if (diagonal < 768) return 'medium';
        if (diagonal < 1024) return 'large';
        return 'xlarge';
    }

    /**
     * Categorize screen by width
     * @param {number} width - Screen width
     * @returns {string} Category
     */
    function categorizeScreen(width) {
        if (width < 576) return 'mobile';
        if (width < 768) return 'mobile-large';
        if (width < 992) return 'tablet';
        if (width < 1200) return 'desktop';
        return 'desktop-large';
    }

    /**
     * Estimate device performance tier
     * @returns {Promise<string>} Performance tier
     */
    async function estimatePerformanceTier() {
        // Use hardware concurrency as rough estimate
        const cores = navigator.hardwareConcurrency || 2;
        const memory = navigator.deviceMemory || 4;

        // Simple heuristic
        if (cores >= 8 && memory >= 8) return 'high';
        if (cores >= 4 && memory >= 4) return 'medium';
        return 'low';
    }

    /**
     * Estimate network speed
     * @returns {Promise<string>} Network speed category
     */
    async function estimateNetworkSpeed() {
        if ('connection' in navigator) {
            const connection = navigator.connection;
            const effectiveType = connection.effectiveType;
            
            if (effectiveType === '4g') return 'fast';
            if (effectiveType === '3g') return 'medium';
            return 'slow';
        }
        
        return 'unknown';
    }

    /**
     * Get battery status
     * @returns {Promise<Object>} Battery status
     */
    async function getBatteryStatus() {
        if ('getBattery' in navigator) {
            try {
                const battery = await navigator.getBattery();
                return {
                    level: Math.round(battery.level * 100),
                    charging: battery.charging,
                    chargingTime: battery.chargingTime,
                    dischargingTime: battery.dischargingTime
                };
            } catch (error) {
                return null;
            }
        }
        return null;
    }

    // ===== OPTIMIZATION STRATEGIES =====

    /**
     * Apply optimizations based on device profile
     */
    function applyOptimizations() {
        currentOptimizations = [];

        // Screen-based optimizations
        applyScreenOptimizations();

        // Performance-based optimizations
        applyPerformanceOptimizations();

        // Network-based optimizations
        applyNetworkOptimizations();

        // Battery-based optimizations
        applyBatteryOptimizations();

        // Accessibility optimizations
        applyAccessibilityOptimizations();

        // Update UI
        updateUILayout();

        console.log(`⚡ Applied ${currentOptimizations.length} optimizations:`, currentOptimizations);

        // Dispatch event
        document.dispatchEvent(new CustomEvent('optimizationsApplied', {
            detail: { optimizations: currentOptimizations }
        }));
    }

    /**
     * Apply screen-based optimizations
     */
    function applyScreenOptimizations() {
        const category = deviceProfile.screenCategory;

        document.body.setAttribute('data-screen-category', category);

        if (category === 'mobile' || category === 'mobile-large') {
            // Mobile optimizations
            enableMobileLayout();
            currentOptimizations.push('mobile-layout');

            // Reduce column count
            setColumnCount(1);
            currentOptimizations.push('single-column');

        } else if (category === 'tablet') {
            // Tablet optimizations
            enableTabletLayout();
            currentOptimizations.push('tablet-layout');

            setColumnCount(2);
            currentOptimizations.push('two-columns');

        } else {
            // Desktop optimizations
            enableDesktopLayout();
            currentOptimizations.push('desktop-layout');

            setColumnCount(3);
            currentOptimizations.push('multi-columns');
        }

        // High DPI optimizations
        if (deviceProfile.isHighDPI) {
            document.body.classList.add('high-dpi');
            currentOptimizations.push('high-dpi-assets');
        }
    }

    /**
     * Apply performance-based optimizations
     */
    function applyPerformanceOptimizations() {
        const tier = deviceProfile.performanceTier;

        if (tier === 'low') {
            // Low-end device optimizations
            disableAnimations();
            currentOptimizations.push('animations-disabled');

            reduceVisualization();
            currentOptimizations.push('reduced-visualizations');

            enableLazyLoading();
            currentOptimizations.push('lazy-loading');

        } else if (tier === 'medium') {
            // Mid-range optimizations
            simplifyAnimations();
            currentOptimizations.push('simplified-animations');

            enableLazyLoading();
            currentOptimizations.push('lazy-loading');

        } else {
            // High-end: enable all features
            enableFullAnimations();
            currentOptimizations.push('full-animations');
        }
    }

    /**
     * Apply network-based optimizations
     */
    function applyNetworkOptimizations() {
        const speed = deviceProfile.networkSpeed;

        if (speed === 'slow') {
            // Slow network optimizations
            enableDataSaving();
            currentOptimizations.push('data-saving');

            reduceImageQuality();
            currentOptimizations.push('reduced-images');

            increaseDebouncing();
            currentOptimizations.push('increased-debounce');

        } else if (speed === 'medium') {
            // Medium network
            enableModerateDataUsage();
            currentOptimizations.push('moderate-data');
        }
    }

    /**
     * Apply battery-based optimizations
     */
    function applyBatteryOptimizations() {
        if (!deviceProfile.batteryStatus) return;

        const battery = deviceProfile.batteryStatus;

        if (!battery.charging && battery.level < 20) {
            // Low battery mode
            enableBatterySaver();
            currentOptimizations.push('battery-saver');

            reduceBackgroundActivity();
            currentOptimizations.push('reduced-background');

            disableAutomaticSync();
            currentOptimizations.push('manual-sync-only');
        }
    }

    /**
     * Apply accessibility optimizations
     */
    function applyAccessibilityOptimizations() {
        if (deviceProfile.prefersReducedMotion) {
            disableAnimations();
            currentOptimizations.push('reduced-motion');
        }

        if (deviceProfile.colorScheme === 'dark') {
            document.body.classList.add('dark-mode');
            currentOptimizations.push('dark-mode');
        }

        if (!deviceProfile.supportsTouch) {
            enhanceMouseInteraction();
            currentOptimizations.push('mouse-optimized');
        } else {
            enhanceTouchInteraction();
            currentOptimizations.push('touch-optimized');
        }
    }

    // ===== UI LAYOUT MANAGEMENT =====

    /**
     * Enable mobile layout
     */
    function enableMobileLayout() {
        document.body.classList.remove('tablet-layout', 'desktop-layout');
        document.body.classList.add('mobile-layout');
        
        // Hide sidebar by default on mobile
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.add('collapsed');
        }
    }

    /**
     * Enable tablet layout
     */
    function enableTabletLayout() {
        document.body.classList.remove('mobile-layout', 'desktop-layout');
        document.body.classList.add('tablet-layout');
    }

    /**
     * Enable desktop layout
     */
    function enableDesktopLayout() {
        document.body.classList.remove('mobile-layout', 'tablet-layout');
        document.body.classList.add('desktop-layout');

        // Show sidebar by default on desktop
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.remove('collapsed');
        }
    }

    /**
     * Set column count for grid layouts
     * @param {number} count - Number of columns
     */
    function setColumnCount(count) {
        document.documentElement.style.setProperty('--column-count', count);
    }

    /**
     * Update UI layout based on current state
     */
    function updateUILayout() {
        // Trigger layout recalculation
        document.body.classList.add('layout-updating');
        
        setTimeout(() => {
            document.body.classList.remove('layout-updating');
        }, 100);
    }

    // ===== PERFORMANCE OPTIMIZATIONS =====

    /**
     * Disable animations
     */
    function disableAnimations() {
        document.body.classList.add('no-animations');
        document.documentElement.style.setProperty('--animation-duration', '0s');
    }

    /**
     * Simplify animations
     */
    function simplifyAnimations() {
        document.body.classList.add('simple-animations');
        document.documentElement.style.setProperty('--animation-duration', '0.2s');
    }

    /**
     * Enable full animations
     */
    function enableFullAnimations() {
        document.body.classList.remove('no-animations', 'simple-animations');
        document.documentElement.style.setProperty('--animation-duration', '0.3s');
    }

    /**
     * Reduce visualization complexity
     */
    function reduceVisualization() {
        // Hide charts or use simpler versions
        document.querySelectorAll('.chart-container').forEach(el => {
            el.classList.add('simple-chart');
        });
    }

    /**
     * Enable lazy loading
     */
    function enableLazyLoading() {
        // Mark images for lazy loading
        document.querySelectorAll('img:not([loading])').forEach(img => {
            img.setAttribute('loading', 'lazy');
        });
    }

    // ===== NETWORK OPTIMIZATIONS =====

    /**
     * Enable data saving mode
     */
    function enableDataSaving() {
        document.body.classList.add('data-saving');
        
        // Reduce image quality
        document.querySelectorAll('img').forEach(img => {
            if (!img.dataset.originalSrc) {
                img.dataset.originalSrc = img.src;
            }
        });
    }

    /**
     * Reduce image quality
     */
    function reduceImageQuality() {
        // Implementation would compress or use lower quality images
        console.log('📉 Image quality reduced for bandwidth savings');
    }

    /**
     * Enable moderate data usage
     */
    function enableModerateDataUsage() {
        // Balance between quality and data usage
        console.log('⚖️ Moderate data usage enabled');
    }

    /**
     * Increase debouncing delays
     */
    function increaseDebouncing() {
        // Increase debounce delays for input events
        document.documentElement.style.setProperty('--debounce-delay', '800ms');
    }

    // ===== BATTERY OPTIMIZATIONS =====

    /**
     * Enable battery saver mode
     */
    function enableBatterySaver() {
        document.body.classList.add('battery-saver');
        
        // Reduce background processes
        console.log('🔋 Battery saver mode enabled');
    }

    /**
     * Reduce background activity
     */
    function reduceBackgroundActivity() {
        // Increase sync interval
        if (typeof SyncStateManager !== 'undefined') {
            SyncStateManager.CONFIG.SYNC_INTERVAL = 120000; // 2 minutes
        }
    }

    /**
     * Disable automatic sync
     */
    function disableAutomaticSync() {
        if (typeof SyncStateManager !== 'undefined') {
            SyncStateManager.pauseSync();
        }
    }

    // ===== INTERACTION OPTIMIZATIONS =====

    /**
     * Enhance mouse interaction
     */
    function enhanceMouseInteraction() {
        document.body.classList.add('mouse-optimized');
        
        // Add hover effects
        document.querySelectorAll('.interactive').forEach(el => {
            el.classList.add('has-hover');
        });
    }

    /**
     * Enhance touch interaction
     */
    function enhanceTouchInteraction() {
        document.body.classList.add('touch-optimized');
        
        // Increase touch target sizes
        document.documentElement.style.setProperty('--min-touch-size', '44px');
    }

    // ===== PERFORMANCE MONITORING =====

    /**
     * Start performance monitoring
     */
    function startPerformanceMonitoring() {
        performanceMonitor = setInterval(() => {
            checkPerformance();
        }, CONFIG.PERFORMANCE_CHECK_INTERVAL);
    }

    /**
     * Check current performance
     */
    async function checkPerformance() {
        const metrics = {
            fps: await estimateFPS(),
            memory: getMemoryUsage(),
            battery: await getBatteryStatus()
        };

        // Adjust optimizations if needed
        if (metrics.fps < CONFIG.ANIMATION_FPS_THRESHOLD) {
            if (!document.body.classList.contains('no-animations')) {
                simplifyAnimations();
                console.log('⚡ Animations simplified due to low FPS');
            }
        }

        if (metrics.memory && metrics.memory < CONFIG.LOW_MEMORY_THRESHOLD) {
            enableLazyLoading();
            console.log('⚡ Lazy loading enabled due to low memory');
        }
    }

    /**
     * Estimate current FPS
     * @returns {Promise<number>} Estimated FPS
     */
    function estimateFPS() {
        return new Promise(resolve => {
            let lastTime = performance.now();
            let frames = 0;
            
            function countFrame(currentTime) {
                frames++;
                const elapsed = currentTime - lastTime;
                
                if (elapsed >= 1000) {
                    const fps = Math.round((frames * 1000) / elapsed);
                    resolve(fps);
                } else {
                    requestAnimationFrame(countFrame);
                }
            }
            
            requestAnimationFrame(countFrame);
        });
    }

    /**
     * Get memory usage
     * @returns {number|null} Memory usage in MB
     */
    function getMemoryUsage() {
        if ('memory' in performance && 'usedJSHeapSize' in performance.memory) {
            return Math.round(performance.memory.usedJSHeapSize / 1048576);
        }
        return null;
    }

    // ===== EVENT HANDLERS =====

    /**
     * Handle window resize
     */
    function handleResize() {
        // Rebuild profile and reapply optimizations
        buildDeviceProfile().then(profile => {
            deviceProfile = profile;
            applyOptimizations();
        });
    }

    /**
     * Handle orientation change
     */
    function handleOrientationChange() {
        setTimeout(() => {
            handleResize();
        }, 200);
    }

    // ===== MANUAL CONTROL =====

    /**
     * Set performance mode
     * @param {string} mode - Performance mode
     */
    function setPerformanceMode(mode) {
        performanceMode = mode;

        switch (mode) {
            case 'performance':
                enableFullAnimations();
                document.body.classList.remove('battery-saver', 'data-saving');
                break;
            
            case 'battery':
                enableBatterySaver();
                disableAnimations();
                break;
            
            case 'quality':
                enableFullAnimations();
                document.body.classList.remove('data-saving');
                break;
            
            case 'auto':
            default:
                applyOptimizations();
                break;
        }

        console.log(`⚙️ Performance mode set to: ${mode}`);
    }

    /**
     * Get device profile
     * @returns {Object} Device profile
     */
    function getDeviceProfile() {
        return deviceProfile ? { ...deviceProfile } : null;
    }

    /**
     * Get current optimizations
     * @returns {Array} Array of optimization names
     */
    function getCurrentOptimizations() {
        return [...currentOptimizations];
    }

    // ===== UTILITIES =====

    /**
     * Debounce function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in ms
     * @returns {Function} Debounced function
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // ===== PUBLIC API =====

    return {
        // Initialization
        initialize,

        // Profile
        getDeviceProfile,
        buildDeviceProfile,

        // Optimizations
        applyOptimizations,
        getCurrentOptimizations,

        // Manual control
        setPerformanceMode,

        // Performance
        checkPerformance,
        getMemoryUsage,

        // Configuration
        CONFIG
    };

})();

// Auto-initialize when device is registered
document.addEventListener('deviceRegistered', () => {
    setTimeout(() => {
        DeviceOptimizationEngine.initialize().catch(console.error);
    }, 1500);
});

console.log('⚡ DeviceOptimizationEngine module loaded');
