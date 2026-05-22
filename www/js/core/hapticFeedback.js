// ===== HAPTIC FEEDBACK SYSTEM =====
// Provides subtle vibration feedback for key user actions on Android

const HapticFeedback = (function() {
    'use strict';

    // Haptic patterns (in milliseconds)
    const PATTERNS = {
        light: [10],           // Quick tap
        medium: [20],          // Standard feedback
        success: [10, 50, 10], // Success pattern
        celebration: [20, 30, 20, 30, 40], // Achievement unlock
        warning: [30, 100, 30], // Warning/error
        impact: [15]           // Button press
    };

    let isEnabled = true;
    let isCapacitorAvailable = false;
    let hapticPlugin = null;

    /**
     * Initialize haptic feedback system
     */
    function init() {
        // Check if Capacitor Haptics is available
        checkCapacitorAvailability();
        
        // Load user preference
        const saved = localStorage.getItem('hapticFeedbackEnabled');
        isEnabled = saved !== null ? saved === 'true' : true;
        
        console.log('✨ Haptic Feedback initialized:', isEnabled ? 'enabled' : 'disabled');
    }

    /**
     * Check for Capacitor Haptics plugin
     */
    function checkCapacitorAvailability() {
        try {
            if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.Haptics) {
                isCapacitorAvailable = true;
                hapticPlugin = Capacitor.Plugins.Haptics;
                console.log('✅ Capacitor Haptics available');
            } else if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) {
                // Try to access via window
                isCapacitorAvailable = false;
                console.log('ℹ️ Native platform detected but Haptics plugin not found');
            }
        } catch (error) {
            isCapacitorAvailable = false;
            console.log('ℹ️ Capacitor Haptics not available');
        }
    }

    /**
     * Trigger haptic feedback
     * @param {string} type - Pattern type ('light', 'medium', 'success', 'celebration', 'warning', 'impact')
     */
    async function trigger(type = 'light') {
        if (!isEnabled) return;

        try {
            if (isCapacitorAvailable && hapticPlugin) {
                // Use Capacitor Haptics API
                switch(type) {
                    case 'light':
                    case 'impact':
                        await hapticPlugin.impact({ style: 'light' });
                        break;
                    case 'medium':
                        await hapticPlugin.impact({ style: 'medium' });
                        break;
                    case 'success':
                        await hapticPlugin.notification({ type: 'success' });
                        break;
                    case 'warning':
                        await hapticPlugin.notification({ type: 'warning' });
                        break;
                    case 'celebration':
                        // Custom pattern for achievements
                        await hapticPlugin.impact({ style: 'medium' });
                        setTimeout(() => hapticPlugin.impact({ style: 'light' }), 100);
                        setTimeout(() => hapticPlugin.impact({ style: 'medium' }), 200);
                        break;
                    default:
                        await hapticPlugin.impact({ style: 'light' });
                }
            } else if (navigator.vibrate) {
                // Fallback to Navigator Vibration API
                const pattern = PATTERNS[type] || PATTERNS.light;
                navigator.vibrate(pattern);
            }
        } catch (error) {
            // Silently fail - haptics are non-critical
            console.log('Haptic feedback unavailable');
        }
    }

    /**
     * Quick haptic shortcuts for common actions
     */
    const haptics = {
        // Light tap for button presses
        tap: () => trigger('light'),
        
        // Task completion
        taskComplete: () => trigger('success'),
        
        // Habit completion with streak
        habitComplete: () => trigger('success'),
        
        // Focus session completed
        focusComplete: () => trigger('celebration'),
        
        // Badge unlocked
        badgeUnlock: () => trigger('celebration'),
        
        // Level up
        levelUp: () => trigger('celebration'),
        
        // Error or warning
        error: () => trigger('warning'),
        
        // Standard button press
        press: () => trigger('impact'),
        
        // Toggle switch
        toggle: () => trigger('light')
    };

    /**
     * Enable or disable haptic feedback
     * @param {boolean} enabled - Enable state
     */
    function setEnabled(enabled) {
        isEnabled = enabled;
        localStorage.setItem('hapticFeedbackEnabled', enabled.toString());
        console.log('Haptic feedback:', enabled ? 'enabled' : 'disabled');
    }

    /**
     * Check if haptic feedback is enabled
     * @returns {boolean}
     */
    function getEnabled() {
        return isEnabled;
    }

    /**
     * Check if haptics are supported
     * @returns {boolean}
     */
    function isSupported() {
        return isCapacitorAvailable || (typeof navigator !== 'undefined' && !!navigator.vibrate);
    }

    // Public API
    return {
        init,
        trigger,
        ...haptics,
        setEnabled,
        getEnabled,
        isSupported
    };
})();

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => HapticFeedback.init());
} else {
    HapticFeedback.init();
}

// Export globally
window.HapticFeedback = HapticFeedback;
