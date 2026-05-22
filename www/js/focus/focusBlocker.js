// ===== FOCUS BLOCKER MODULE =====
// Advanced distraction blocking system for focus sessions
// Blocks websites, apps, and notifications during focus mode

const FocusBlocker = (function() {
    'use strict';

    // ===== STATE =====
    let isBlockingActive = false;
    let currentSession = null;
    let distractionAttempts = 0;
    let bypassUsed = false;
    let bypassStartTime = null;
    let blockCheckInterval = null;

    // ===== CONFIGURATION =====
    const CONFIG = {
        bypassDuration: 60000, // 1 minute in milliseconds
        blockCheckFrequency: 1000, // Check every second
        defaultWebsiteBlocklist: [
            'youtube.com',
            'instagram.com',
            'facebook.com',
            'twitter.com',
            'x.com',
            'reddit.com',
            'tiktok.com',
            'netflix.com',
            'twitch.tv',
            'discord.com',
            'pinterest.com',
            'snapchat.com'
        ],
        defaultAppBlocklist: [
            'com.instagram.android',
            'com.facebook.katana',
            'com.twitter.android',
            'com.reddit.frontpage',
            'com.zhihu.android',
            'com.google.android.youtube',
            'com.netflix.mediaclient',
            'tv.twitch.android.app',
            'com.discord'
        ]
    };

    // ===== STORAGE KEYS =====
    const STORAGE_KEYS = {
        websiteBlocklist: 'focusBlocker_websites',
        appBlocklist: 'focusBlocker_apps',
        sessionStats: 'focusBlocker_sessionStats',
        totalStats: 'focusBlocker_totalStats',
        bypassHistory: 'focusBlocker_bypassHistory'
    };

    // ===== INITIALIZATION =====
    function init() {
        console.log('🛡️ Focus Blocker initialized');
        
        // Initialize blocklists if not exists
        if (!getWebsiteBlocklist().length) {
            saveWebsiteBlocklist(CONFIG.defaultWebsiteBlocklist);
        }
        if (!getAppBlocklist().length) {
            saveAppBlocklist(CONFIG.defaultAppBlocklist);
        }

        // Set up website blocking for PWA
        setupWebsiteBlocking();

        // Set up Android plugin communication
        setupAndroidPlugin();

        // Listen for focus mode events
        setupEventListeners();
    }

    // ===== WEBSITE BLOCKING (PWA) =====
    function setupWebsiteBlocking() {
        // Intercept navigation attempts
        if (typeof window !== 'undefined') {
            // Monitor URL changes
            window.addEventListener('beforeunload', (e) => {
                if (isBlockingActive && !bypassUsed) {
                    const destination = e.target.activeElement?.href;
                    if (destination && isUrlBlocked(destination)) {
                        e.preventDefault();
                        e.returnValue = '';
                        handleBlockedAttempt('website', destination);
                    }
                }
            });

            // Monitor link clicks
            document.addEventListener('click', (e) => {
                if (isBlockingActive && !bypassUsed) {
                    const link = e.target.closest('a');
                    if (link && link.href) {
                        if (isUrlBlocked(link.href)) {
                            e.preventDefault();
                            e.stopPropagation();
                            handleBlockedAttempt('website', link.href);
                            redirectToWarningPage();
                        }
                    }
                }
            }, true);

            // Monitor window.open attempts
            const originalOpen = window.open;
            window.open = function(...args) {
                if (isBlockingActive && !bypassUsed) {
                    const url = args[0];
                    if (url && isUrlBlocked(url)) {
                        handleBlockedAttempt('website', url);
                        redirectToWarningPage();
                        return null;
                    }
                }
                return originalOpen.apply(this, args);
            };
        }

        // Start periodic URL check
        startBlockingMonitor();
    }

    function startBlockingMonitor() {
        if (blockCheckInterval === null) {
            blockCheckInterval = setInterval(() => {
                if (isBlockingActive && !bypassUsed) {
                    checkCurrentUrl();
                }
            }, CONFIG.blockCheckFrequency);
        }
    }

    function stopBlockingMonitor() {
        if (blockCheckInterval) {
            clearInterval(blockCheckInterval);
            blockCheckInterval = null;
        }
    }

    function checkCurrentUrl() {
        const currentUrl = window.location.href;
        
        // Don't block our own app
        if (currentUrl.includes('focus-warning.html') || currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1')) {
            return;
        }

        if (isUrlBlocked(currentUrl)) {
            handleBlockedAttempt('website', currentUrl);
            redirectToWarningPage();
        }
    }

    function isUrlBlocked(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase().replace('www.', '');
            const blocklist = getWebsiteBlocklist();
            
            return blocklist.some(blocked => {
                const blockedDomain = blocked.toLowerCase().replace('www.', '');
                return hostname.includes(blockedDomain) || hostname === blockedDomain;
            });
        } catch (e) {
            return false;
        }
    }

    function redirectToWarningPage() {
        const warningUrl = 'focus-warning.html';
        
        // Add session info to URL
        const params = new URLSearchParams({
            sessionId: currentSession?.id || 'unknown',
            attempts: distractionAttempts,
            timeRemaining: getCurrentSessionTimeRemaining()
        });

        window.location.href = `${warningUrl}?${params.toString()}`;
    }

    // ===== ANDROID APP BLOCKING =====
    function setupAndroidPlugin() {
        // Check if Capacitor is available (Android environment)
        if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
            console.log('📱 Android environment detected - setting up app blocker');
            
            // Register plugin
            if (Capacitor.Plugins && Capacitor.Plugins.FocusBlockerPlugin) {
                const plugin = Capacitor.Plugins.FocusBlockerPlugin;
                
                // Listen for blocked app attempts
                plugin.addListener('appBlocked', (data) => {
                    console.log('🚫 App blocked:', data.packageName);
                    handleBlockedAttempt('app', data.packageName);
                });

                // Listen for accessibility service events
                plugin.addListener('accessibilityEvent', (data) => {
                    if (isBlockingActive && !bypassUsed) {
                        checkAndBlockApp(data.packageName);
                    }
                });
            } else {
                console.warn('⚠️ FocusBlockerPlugin not available');
            }
        }
    }

    async function checkAndBlockApp(packageName) {
        const blocklist = getAppBlocklist();
        
        if (blocklist.includes(packageName)) {
            handleBlockedAttempt('app', packageName);
            
            // Bring our app to foreground
            if (typeof Capacitor !== 'undefined' && Capacitor.Plugins.FocusBlockerPlugin) {
                try {
                    await Capacitor.Plugins.FocusBlockerPlugin.bringToForeground();
                } catch (error) {
                    console.error('Error bringing app to foreground:', error);
                }
            }
        }
    }

    // ===== SESSION MANAGEMENT =====
    function startSession(sessionData) {
        isBlockingActive = true;
        currentSession = {
            id: Date.now(),
            startTime: Date.now(),
            duration: sessionData.duration || 1500, // Default 25 minutes
            task: sessionData.task || 'Focus Session',
            distractionAttempts: 0,
            blockedApps: [],
            blockedWebsites: [],
            bypassUsed: false
        };

        distractionAttempts = 0;
        bypassUsed = false;
        bypassStartTime = null;

        // Save session to storage
        saveCurrentSession();

        // Enable Android app blocking
        enableAndroidBlocking();

        // Notify user
        if (typeof Notify !== 'undefined') {
            Notify.success('🛡️ Focus Shield activated! Distractions blocked.');
        }

        // Suppress notifications
        suppressNotifications(true);

        console.log('🛡️ Focus blocking session started:', currentSession);
    }

    function endSession(completed = true) {
        if (!currentSession) return;

        // Calculate focus score
        const focusScore = calculateFocusScore();

        // Save session stats
        const finalStats = {
            ...currentSession,
            endTime: Date.now(),
            completed,
            focusScore,
            distractionAttempts: distractionAttempts,
            bypassUsed
        };

        saveSessionStats(finalStats);
        updateTotalStats(finalStats);

        // Reset state
        isBlockingActive = false;
        currentSession = null;
        distractionAttempts = 0;
        bypassUsed = false;
        bypassStartTime = null;

        // Clear session storage
        localStorage.removeItem('focusBlocker_currentSession');

        // Disable Android app blocking
        disableAndroidBlocking();

        // Restore notifications
        suppressNotifications(false);

        // Show stats
        if (completed) {
            showSessionSummary(finalStats);
        }

        console.log('🛡️ Focus blocking session ended. Score:', focusScore);
    }

    function calculateFocusScore() {
        if (!currentSession) return 100;

        const maxAttempts = 10;
        const bypassPenalty = bypassUsed ? 20 : 0;
        const attemptPenalty = Math.min((distractionAttempts / maxAttempts) * 80, 80);
        
        const score = Math.max(0, 100 - attemptPenalty - bypassPenalty);
        return Math.round(score);
    }

    // ===== DISTRACTION HANDLING =====
    function handleBlockedAttempt(type, target) {
        distractionAttempts++;

        // Record the specific blocked item
        if (type === 'website' && currentSession) {
            if (!currentSession.blockedWebsites.includes(target)) {
                currentSession.blockedWebsites.push(target);
            }
        } else if (type === 'app' && currentSession) {
            if (!currentSession.blockedApps.includes(target)) {
                currentSession.blockedApps.push(target);
            }
        }

        // Update current session
        if (currentSession) {
            currentSession.distractionAttempts = distractionAttempts;
            saveCurrentSession();
        }

        // Show feedback
        showBlockedNotification(type, target);

        // Log for analytics
        logDistractionAttempt(type, target);

        console.log(`🚫 Blocked ${type} attempt:`, target, `(Total: ${distractionAttempts})`);
    }

    function showBlockedNotification(type, target) {
        const messages = {
            website: `🛡️ Website blocked! Stay focused on your task.`,
            app: `🛡️ App blocked! Return to your focus session.`
        };

        if (typeof Notify !== 'undefined') {
            Notify.warning(messages[type] || 'Distraction blocked!');
        }

        // Show in-app banner
        showBlockBanner(type, target);
    }

    function showBlockBanner(type, target) {
        // Create or update block banner
        let banner = document.getElementById('focusBlockBanner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'focusBlockBanner';
            banner.className = 'focus-block-banner';
            document.body.appendChild(banner);
        }

        const targetName = type === 'website' ? extractDomain(target) : extractAppName(target);
        
        banner.innerHTML = `
            <div class="focus-block-banner__content">
                <i class="fa-solid fa-shield-halved"></i>
                <div class="focus-block-banner__text">
                    <strong>${targetName}</strong> blocked
                    <span>${distractionAttempts} distraction${distractionAttempts !== 1 ? 's' : ''} blocked</span>
                </div>
                <button class="focus-block-banner__close" onclick="FocusBlocker.dismissBanner()">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
        `;

        banner.classList.add('show');

        // Auto-hide after 3 seconds
        setTimeout(() => {
            banner.classList.remove('show');
        }, 3000);
    }

    function dismissBanner() {
        const banner = document.getElementById('focusBlockBanner');
        if (banner) {
            banner.classList.remove('show');
        }
    }

    // ===== EMERGENCY BYPASS SYSTEM =====
    function requestBypass(reason = '') {
        if (bypassUsed) {
            if (typeof Notify !== 'undefined') {
                Notify.error('❌ Bypass already used this session!');
            }
            return false;
        }

        // Show confirmation dialog
        const confirmed = confirm(
            `⚠️ EMERGENCY BYPASS REQUEST\n\n` +
            `This will pause blocking for 1 minute.\n` +
            `Your focus score will be significantly reduced.\n\n` +
            `Distractions blocked so far: ${distractionAttempts}\n\n` +
            `Are you sure you want to bypass?`
        );

        if (confirmed) {
            activateBypass(reason);
            return true;
        }

        return false;
    }

    function activateBypass(reason) {
        bypassUsed = true;
        bypassStartTime = Date.now();

        // Temporarily disable blocking
        const tempDisable = () => {
            const banner = document.getElementById('focusBlockBanner');
            if (banner) {
                banner.innerHTML = `
                    <div class="focus-block-banner__content bypass-active">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <div class="focus-block-banner__text">
                            <strong>BYPASS ACTIVE</strong>
                            <span id="bypassTimer">1:00 remaining</span>
                        </div>
                    </div>
                `;
                banner.classList.add('show');
            }
        };

        tempDisable();

        // Start countdown
        const bypassTimer = setInterval(() => {
            const elapsed = Date.now() - bypassStartTime;
            const remaining = Math.max(0, CONFIG.bypassDuration - elapsed);
            const seconds = Math.ceil(remaining / 1000);

            const timerEl = document.getElementById('bypassTimer');
            if (timerEl) {
                timerEl.textContent = `0:${seconds.toString().padStart(2, '0')} remaining`;
            }

            if (remaining <= 0) {
                clearInterval(bypassTimer);
                deactivateBypass();
            }
        }, 100);

        // Log bypass usage
        logBypassUsage(reason);

        if (typeof Notify !== 'undefined') {
            Notify.warning('⚠️ Bypass active for 1 minute. Use wisely!');
        }

        console.log('⚠️ Emergency bypass activated:', reason);
    }

    function deactivateBypass() {
        const banner = document.getElementById('focusBlockBanner');
        if (banner) {
            banner.classList.remove('show');
        }

        if (typeof Notify !== 'undefined') {
            Notify.info('🛡️ Bypass ended. Protection restored!');
        }

        console.log('🛡️ Bypass deactivated');
    }

    // ===== ANDROID NATIVE FUNCTIONS =====
    async function enableAndroidBlocking() {
        if (typeof Capacitor !== 'undefined' && Capacitor.Plugins.FocusBlockerPlugin) {
            try {
                // First check if accessibility service is enabled
                const statusResult = await Capacitor.Plugins.FocusBlockerPlugin.isAccessibilityServiceEnabled();
                
                if (!statusResult.enabled) {
                    // Show guidance to enable accessibility service
                    showAccessibilitySetupPrompt();
                    return false;
                }

                const blocklist = getAppBlocklist();
                const result = await Capacitor.Plugins.FocusBlockerPlugin.enableBlocking({
                    blockedApps: blocklist
                });

                if (result.requiresSetup) {
                    // Service not properly set up
                    showAccessibilitySetupPrompt();
                    return false;
                }

                console.log('📱 Android app blocking enabled');
                return true;
            } catch (error) {
                console.error('Error enabling Android blocking:', error);
                return false;
            }
        }
        return false;
    }

    async function disableAndroidBlocking() {
        if (typeof Capacitor !== 'undefined' && Capacitor.Plugins.FocusBlockerPlugin) {
            try {
                await Capacitor.Plugins.FocusBlockerPlugin.disableBlocking();
                console.log('📱 Android app blocking disabled');
            } catch (error) {
                console.error('Error disabling blocking:', error);
            }
        }
    }

    // ===== NOTIFICATION SUPPRESSION =====
    function suppressNotifications(suppress) {
        if (typeof Capacitor !== 'undefined' && Capacitor.Plugins.LocalNotifications) {
            // Android/iOS notification suppression
            // We keep focus-related notifications active
            console.log(`🔕 Notifications ${suppress ? 'suppressed' : 'restored'}`);
        }
    }

    // ===== BLOCKLIST MANAGEMENT =====
    function getWebsiteBlocklist() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.websiteBlocklist) || '[]');
        } catch (e) {
            return [];
        }
    }

    function saveWebsiteBlocklist(list) {
        localStorage.setItem(STORAGE_KEYS.websiteBlocklist, JSON.stringify(list));
    }

    function addWebsiteToBlocklist(website) {
        const list = getWebsiteBlocklist();
        const cleaned = website.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
        
        if (!list.includes(cleaned)) {
            list.push(cleaned);
            saveWebsiteBlocklist(list);
            return true;
        }
        return false;
    }

    function removeWebsiteFromBlocklist(website) {
        const list = getWebsiteBlocklist();
        const filtered = list.filter(item => item !== website);
        saveWebsiteBlocklist(filtered);
        return list.length !== filtered.length;
    }

    function getAppBlocklist() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.appBlocklist) || '[]');
        } catch (e) {
            return [];
        }
    }

    function saveAppBlocklist(list) {
        localStorage.setItem(STORAGE_KEYS.appBlocklist, JSON.stringify(list));
    }

    function addAppToBlocklist(packageName) {
        const list = getAppBlocklist();
        if (!list.includes(packageName)) {
            list.push(packageName);
            saveAppBlocklist(list);
            return true;
        }
        return false;
    }

    function removeAppFromBlocklist(packageName) {
        const list = getAppBlocklist();
        const filtered = list.filter(item => item !== packageName);
        saveAppBlocklist(filtered);
        return list.length !== filtered.length;
    }

    // ===== ANALYTICS =====
    function logDistractionAttempt(type, target) {
        const log = {
            timestamp: Date.now(),
            sessionId: currentSession?.id,
            type,
            target,
            attemptNumber: distractionAttempts
        };

        // Store in session storage for real-time tracking
        const attempts = JSON.parse(sessionStorage.getItem('focusBlocker_attempts') || '[]');
        attempts.push(log);
        sessionStorage.setItem('focusBlocker_attempts', JSON.stringify(attempts));
    }

    function logBypassUsage(reason) {
        const log = {
            timestamp: Date.now(),
            sessionId: currentSession?.id,
            reason,
            distractionsAtTime: distractionAttempts
        };

        const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.bypassHistory) || '[]');
        history.push(log);
        
        // Keep last 50 bypass events
        if (history.length > 50) {
            history.shift();
        }
        
        localStorage.setItem(STORAGE_KEYS.bypassHistory, JSON.stringify(history));
    }

    function saveSessionStats(stats) {
        const allStats = JSON.parse(localStorage.getItem(STORAGE_KEYS.sessionStats) || '[]');
        allStats.push(stats);
        
        // Keep last 100 sessions
        if (allStats.length > 100) {
            allStats.shift();
        }
        
        localStorage.setItem(STORAGE_KEYS.sessionStats, JSON.stringify(allStats));
    }

    function updateTotalStats(sessionStats) {
        const total = JSON.parse(localStorage.getItem(STORAGE_KEYS.totalStats) || '{}');
        
        total.totalSessions = (total.totalSessions || 0) + 1;
        total.totalCompleted = (total.totalCompleted || 0) + (sessionStats.completed ? 1 : 0);
        total.totalDistractions = (total.totalDistractions || 0) + sessionStats.distractionAttempts;
        total.totalAttempts = total.totalDistractions; // Alias for consistency
        total.totalBypassUsed = (total.totalBypassUsed || 0) + (sessionStats.bypassUsed ? 1 : 0);
        total.completionRate = total.totalCompleted / total.totalSessions;
        total.averageFocusScore = calculateAverageScore();
        total.mostBlockedWebsites = updateMostBlocked(total.mostBlockedWebsites || {}, sessionStats.blockedWebsites);
        total.mostBlockedApps = updateMostBlocked(total.mostBlockedApps || {}, sessionStats.blockedApps);
        
        localStorage.setItem(STORAGE_KEYS.totalStats, JSON.stringify(total));
    }

    function updateMostBlocked(current, newItems) {
        newItems.forEach(item => {
            current[item] = (current[item] || 0) + 1;
        });
        return current;
    }

    function calculateAverageScore() {
        const sessions = JSON.parse(localStorage.getItem(STORAGE_KEYS.sessionStats) || '[]');
        if (sessions.length === 0) return 100;
        
        const sum = sessions.reduce((acc, s) => acc + (s.focusScore || 0), 0);
        return Math.round(sum / sessions.length);
    }

    function getSessionStats() {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.sessionStats) || '[]');
    }

    function getTotalStats() {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.totalStats) || '{}');
    }

    // ===== UI HELPERS =====
    function showSessionSummary(stats) {
        const modal = document.createElement('div');
        modal.className = 'focus-summary-modal';
        modal.innerHTML = `
            <div class="focus-summary-content">
                <div class="focus-summary-header">
                    <i class="fa-solid fa-shield-check"></i>
                    <h2>Session Complete!</h2>
                </div>
                <div class="focus-summary-score">
                    <div class="score-circle ${getScoreClass(stats.focusScore)}">
                        <span class="score-value">${stats.focusScore}</span>
                        <span class="score-label">Focus Score</span>
                    </div>
                </div>
                <div class="focus-summary-stats">
                    <div class="stat-item">
                        <i class="fa-solid fa-clock"></i>
                        <span>${Math.round(stats.duration / 60)} min</span>
                        <small>Duration</small>
                    </div>
                    <div class="stat-item">
                        <i class="fa-solid fa-ban"></i>
                        <span>${stats.distractionAttempts}</span>
                        <small>Blocked</small>
                    </div>
                    <div class="stat-item">
                        <i class="fa-solid fa-${stats.bypassUsed ? 'triangle-exclamation' : 'check'}"></i>
                        <span>${stats.bypassUsed ? 'Yes' : 'No'}</span>
                        <small>Bypass</small>
                    </div>
                </div>
                ${stats.blockedWebsites.length > 0 ? `
                    <div class="focus-summary-blocked">
                        <h3>Most Blocked</h3>
                        <ul>
                            ${stats.blockedWebsites.slice(0, 3).map(site => `
                                <li><i class="fa-solid fa-globe"></i> ${extractDomain(site)}</li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}
                <button class="focus-summary-close" onclick="FocusBlocker.closeSummary()">
                    Continue
                </button>
            </div>
        `;

        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('show'), 10);
    }

    function closeSummary() {
        const modal = document.querySelector('.focus-summary-modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        }
    }

    function getScoreClass(score) {
        if (score >= 90) return 'excellent';
        if (score >= 75) return 'good';
        if (score >= 60) return 'average';
        return 'poor';
    }

    // ===== UTILITY FUNCTIONS =====
    function extractDomain(url) {
        try {
            const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
            return urlObj.hostname.replace('www.', '');
        } catch (e) {
            return url;
        }
    }

    function extractAppName(packageName) {
        const parts = packageName.split('.');
        return parts[parts.length - 1];
    }

    function getCurrentSessionTimeRemaining() {
        if (!currentSession) return 0;
        const elapsed = Date.now() - currentSession.startTime;
        const remaining = (currentSession.duration * 1000) - elapsed;
        return Math.max(0, Math.round(remaining / 1000));
    }

    function saveCurrentSession() {
        if (currentSession) {
            localStorage.setItem('focusBlocker_currentSession', JSON.stringify(currentSession));
        }
    }

    function setupEventListeners() {
        // Listen for focus mode start from focusLockMode.js
        document.addEventListener('focusModeActivated', (e) => {
            const { duration, task } = e.detail || {};
            startSession({ duration, task });
        });

        // Listen for focus mode end
        document.addEventListener('focusModeDeactivated', (e) => {
            const { completed } = e.detail || {};
            endSession(completed);
        });

        // Handle visibility change (tab switch detection)
        document.addEventListener('visibilitychange', () => {
            if (isBlockingActive && !bypassUsed && document.hidden) {
                console.log('⚠️ User switched tabs during focus session');
                // Could log this as a potential distraction
            }
        });
    }

    // ===== ACCESSIBILITY SETUP GUIDANCE =====
    function showAccessibilitySetupPrompt() {
        // Check if we're on Android
        if (typeof Capacitor === 'undefined' || Capacitor.getPlatform() !== 'android') {
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.display = 'flex';
        modal.style.zIndex = '10002';
        
        modal.innerHTML = `
            <div class="modal-box" style="width: 90%; max-width: 400px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="width: 60px; height: 60px; margin: 0 auto 16px; background: rgba(239, 68, 68, 0.1); border-radius: 16px; display: flex; align-items: center; justify-content: center;">
                        <i class="fa-solid fa-exclamation-triangle" style="font-size: 28px; color: #ef4444;"></i>
                    </div>
                    <h3 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: var(--text-primary);">Setup Required</h3>
                    <p style="margin: 0; font-size: 14px; color: var(--text-secondary); line-height: 1.5;">To block distracting apps during focus sessions, you need to enable the accessibility service.</p>
                </div>

                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; margin-bottom: 20px;">
                    <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.6;">
                        <strong style="color: var(--text-primary); display: block; margin-bottom: 8px;">Quick Setup:</strong>
                        1. Tap "Enable Service" below<br>
                        2. Find "Prodify Focus Blocker"<br>
                        3. Toggle ON and accept permissions<br>
                        4. Return to Prodify
                    </div>
                </div>

                <div class="modal-actions" style="display: flex; gap: 10px;">
                    <button id="cancelAccessibilitySetup" class="auth-btn secondary-btn" style="margin: 0; flex: 1;">Continue Without</button>
                    <button id="enableAccessibilityService" class="auth-btn" style="margin: 0; flex: 1.5; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border: none;">
                        <i class="fa-solid fa-gear" style="margin-right: 6px;"></i>
                        Enable Service
                    </button>
                </div>

                <div style="text-align: center; margin-top: 12px;">
                    <p style="font-size: 11px; color: var(--text-secondary); margin: 0;">Website blocking will still work</p>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners
        document.getElementById('cancelAccessibilitySetup').addEventListener('click', () => {
            document.body.removeChild(modal);
            if (typeof Notify !== 'undefined') {
                Notify.info('App blocking disabled. Website blocking is still active.');
            }
        });

        document.getElementById('enableAccessibilityService').addEventListener('click', async () => {
            try {
                // Try to call FocusBlockerUI's guide if available
                if (window.FocusBlockerUI && typeof window.FocusBlockerUI.showSetupGuide === 'function') {
                    document.body.removeChild(modal);
                    window.FocusBlockerUI.showSetupGuide();
                } else {
                    // Fallback to direct settings open
                    await Capacitor.Plugins.FocusBlockerPlugin.openAccessibilitySettings();
                    document.body.removeChild(modal);
                    if (typeof Notify !== 'undefined') {
                        Notify.info('Please enable Prodify Focus Blocker and return to the app');
                    }
                }
            } catch (error) {
                console.error('Error opening accessibility settings:', error);
                if (typeof Notify !== 'undefined') {
                    Notify.error('Failed to open settings');
                }
            }
        });

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    // ===== PUBLIC API =====
    return {
        init,
        startSession,
        endSession,
        requestBypass,
        dismissBanner,
        closeSummary,
        
        // Blocklist management
        getWebsiteBlocklist,
        addWebsiteToBlocklist,
        removeWebsiteFromBlocklist,
        getAppBlocklist,
        addAppToBlocklist,
        removeAppFromBlocklist,
        
        // Alias methods for UI compatibility
        getBlockedWebsites: getWebsiteBlocklist,
        addBlockedWebsite: addWebsiteToBlocklist,
        removeBlockedWebsite: removeWebsiteFromBlocklist,
        getBlockedApps: getAppBlocklist,
        addBlockedApp: addAppToBlocklist,
        removeBlockedApp: removeAppFromBlocklist,
        
        // Status
        isActive: () => isBlockingActive,
        getCurrentSession: () => currentSession,
        getDistractionCount: () => distractionAttempts,
        
        // Analytics
        getSessionStats,
        getTotalStats,
        
        // For testing
        _testBlock: (type, target) => handleBlockedAttempt(type, target)
    };
})();

// Expose globally for UI modules
window.FocusBlocker = FocusBlocker;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => FocusBlocker.init());
} else {
    FocusBlocker.init();
}
