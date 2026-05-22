// ===== FOCUS BLOCKER UI MODULE =====
// Manages the Focus Blocker settings interface

const FocusBlockerUI = (function() {
    'use strict';

    let isAndroid = false;

    // Initialize
    function init() {
        console.log('🛡️ FocusBlockerUI initializing...');
        
        // Check if running on Android
        isAndroid = typeof Capacitor !== 'undefined' && Capacitor.getPlatform() === 'android';
        console.log('Platform:', isAndroid ? 'Android' : 'Other');

        setupEventListeners();
        loadBlocklists();
        updateStats();
        
        if (isAndroid) {
            checkAccessibilityServiceStatus();
            // Check if this is first time and service not enabled
            const hasSeenSetup = localStorage.getItem('focusBlocker_setupComplete');
            if (!hasSeenSetup) {
                // Check after a short delay to let UI settle
                setTimeout(() => {
                    checkAndShowSetupGuide();
                }, 1000);
            }
        } else {
            updateServiceStatus(false, 'Android Only', 'App blocking requires Android device');
        }
        
        console.log('🛡️ FocusBlockerUI initialized');
    }

    // Setup event listeners
    function setupEventListeners() {
        // Section toggle
        const header = document.getElementById('focusBlockerSectionHeader');
        if (header) {
            header.addEventListener('click', toggleSection);
            console.log('✓ Focus Blocker header listener added');
        } else {
            console.warn('✗ Focus Blocker header not found');
        }

        // Accessibility service button
        const enableBtn = document.getElementById('enableAccessibilityBtn');
        if (enableBtn) {
            enableBtn.addEventListener('click', showSetupGuide);
        }

        // Website blocklist
        const websiteToggle = document.getElementById('toggleWebsiteBlocklistBtn');
        if (websiteToggle) {
            websiteToggle.addEventListener('click', () => toggleSubsection('websiteBlocklistContent', websiteToggle));
        }

        const addWebsiteBtn = document.getElementById('addWebsiteBtn');
        if (addWebsiteBtn) {
            addWebsiteBtn.addEventListener('click', addWebsite);
        }

        const addWebsiteInput = document.getElementById('addWebsiteInput');
        if (addWebsiteInput) {
            addWebsiteInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addWebsite();
            });
        }

        // App blocklist
        const appToggle = document.getElementById('toggleAppBlocklistBtn');
        if (appToggle) {
            appToggle.addEventListener('click', () => toggleSubsection('appBlocklistContent', appToggle));
        }

        const addAppBtn = document.getElementById('addAppBtn');
        if (addAppBtn) {
            addAppBtn.addEventListener('click', addApp);
        }

        const addAppInput = document.getElementById('addAppInput');
        if (addAppInput) {
            addAppInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addApp();
            });
        }

        const browseAppsBtn = document.getElementById('browseInstalledAppsBtn');
        if (browseAppsBtn) {
            browseAppsBtn.addEventListener('click', browseInstalledApps);
        }

        // Listen for blocklist updates from FocusBlocker
        window.addEventListener('focusBlockerStatsUpdate', () => {
            updateStats();
        });
    }

    // Toggle main section
    function toggleSection() {
        console.log('Toggle section clicked');
        
        const content = document.getElementById('focusBlockerSectionContent');
        const header = document.getElementById('focusBlockerSectionHeader');
        
        if (!content || !header) {
            console.error('Focus Blocker section elements not found');
            return;
        }
        
        const chevron = header.querySelector('.chevron-icon');
        
        // Use class-based toggle for reliability
        const isOpen = header.classList.contains('open');
        
        console.log('Is Open:', isOpen);
        
        if (isOpen) {
            // Close it
            header.classList.remove('open');
            content.style.display = 'none';
            if (chevron) chevron.style.transform = 'rotate(0deg)';
            console.log('✓ Hiding Focus Blocker section');
        } else {
            // Open it
            header.classList.add('open');
            content.style.display = 'block';
            if (chevron) chevron.style.transform = 'rotate(180deg)';
            console.log('✓ Showing Focus Blocker section');
            
            // Refresh data when opened
            loadBlocklists();
            updateStats();
            if (isAndroid) {
                checkAccessibilityServiceStatus();
            }
        }
    }

    // Toggle subsection
    function toggleSubsection(contentId, toggleBtn) {
        const content = document.getElementById(contentId);
        
        if (!content || !toggleBtn) {
            console.error('Subsection elements not found:', contentId);
            return;
        }
        
        const chevron = toggleBtn.querySelector('.chevron-icon');
        
        // Check if content is hidden
        const isHidden = content.style.display === 'none' || 
                        window.getComputedStyle(content).display === 'none';
        
        if (isHidden) {
            content.style.display = 'block';
            if (chevron) chevron.style.transform = 'rotate(90deg)';
        } else {
            content.style.display = 'none';
            if (chevron) chevron.style.transform = 'rotate(0deg)';
        }
    }

    // Check accessibility service status
    async function checkAccessibilityServiceStatus() {
        if (!isAndroid || !window.FocusBlocker) {
            return;
        }

        try {
            const { FocusBlockerPlugin } = Capacitor.Plugins;
            const result = await FocusBlockerPlugin.isAccessibilityServiceEnabled();
            
            updateServiceStatus(
                result.enabled,
                result.enabled ? 'Active' : 'Not Enabled',
                result.message
            );

            // Mark setup as complete if service is enabled
            if (result.enabled) {
                localStorage.setItem('focusBlocker_setupComplete', 'true');
            }

            return result.enabled;
        } catch (error) {
            console.error('Error checking service status:', error);
            updateServiceStatus(false, 'Error', 'Failed to check service status');
            return false;
        }
    }

    // Update service status UI
    function updateServiceStatus(enabled, statusText, description) {
        const indicator = document.getElementById('focusBlockerStatusIndicator');
        const statusTextEl = document.getElementById('focusBlockerStatusText');
        const statusDescEl = document.getElementById('focusBlockerStatusDesc');
        const enableBtn = document.getElementById('enableAccessibilityBtn');

        if (indicator) {
            indicator.className = 'sync-status-icon';
            indicator.innerHTML = enabled 
                ? '<i class="fa-solid fa-check"></i>' 
                : '<i class="fa-solid fa-xmark"></i>';
            indicator.style.background = enabled ? '#22c55e' : '#94a3b8';
        }

        if (statusTextEl) {
            statusTextEl.textContent = statusText;
        }

        if (statusDescEl) {
            statusDescEl.textContent = description;
        }

        if (enableBtn) {
            enableBtn.style.display = (isAndroid && !enabled) ? 'flex' : 'none';
        }
    }

    // Check and show setup guide if needed
    async function checkAndShowSetupGuide() {
        const enabled = await checkAccessibilityServiceStatus();
        if (!enabled) {
            showSetupGuide();
        }
    }

    // Show accessibility setup guide
    function showSetupGuide() {
        if (!isAndroid) {
            if (typeof Notify !== 'undefined') {
                Notify.error('Android device required for app blocking');
            }
            return;
        }

        const modal = document.createElement('div');
        modal.id = 'accessibilitySetupModal';
        modal.className = 'modal-overlay';
        modal.style.display = 'flex';
        modal.style.zIndex = '10001';
        
        modal.innerHTML = `
            <div class="modal-box" style="width: 90%; max-width: 450px; max-height: 90vh; overflow-y: auto;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="width: 80px; height: 80px; margin: 0 auto 16px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 20px; display: flex; align-items: center; justify-content: center;">
                        <i class="fa-solid fa-shield-halved" style="font-size: 36px; color: white;"></i>
                    </div>
                    <h3 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 700; color: var(--text-primary);">Enable Focus Blocker</h3>
                    <p style="margin: 0; font-size: 14px; color: var(--text-secondary);">Block distracting apps during focus sessions</p>
                </div>

                <div style="background: rgba(99, 102, 241, 0.1); border-left: 4px solid var(--accent-color); padding: 14px; border-radius: 8px; margin-bottom: 20px;">
                    <div style="display: flex; align-items: start; gap: 10px;">
                        <i class="fa-solid fa-lightbulb" style="color: var(--accent-color); font-size: 18px; margin-top: 2px;"></i>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px; font-size: 13px;">Why is this needed?</div>
                            <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.5;">The accessibility service allows Prodify to detect when you open blocked apps and automatically bring you back to focus.</div>
                        </div>
                    </div>
                </div>

                <div style="margin-bottom: 24px;">
                    <div style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px;">Setup Steps</div>
                    
                    <div class="setup-step" style="display: flex; gap: 14px; margin-bottom: 16px;">
                        <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--accent-color); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0;">1</div>
                        <div style="flex: 1; padding-top: 4px;">
                            <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px; font-size: 14px;">Open Settings</div>
                            <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">Tap the button below to go to Accessibility settings</div>
                        </div>
                    </div>

                    <div class="setup-step" style="display: flex; gap: 14px; margin-bottom: 16px;">
                        <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--accent-color); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0;">2</div>
                        <div style="flex: 1; padding-top: 4px;">
                            <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px; font-size: 14px;">Find Prodify</div>
                            <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">Look for "Prodify Focus Blocker" in the list</div>
                        </div>
                    </div>

                    <div class="setup-step" style="display: flex; gap: 14px; margin-bottom: 16px;">
                        <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--accent-color); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0;">3</div>
                        <div style="flex: 1; padding-top: 4px;">
                            <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px; font-size: 14px;">Enable Service</div>
                            <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">Toggle the switch ON and confirm the permission dialog</div>
                        </div>
                    </div>

                    <div class="setup-step" style="display: flex; gap: 14px;">
                        <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--accent-color); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0;">4</div>
                        <div style="flex: 1; padding-top: 4px;">
                            <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px; font-size: 14px;">Return to Prodify</div>
                            <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">Come back to the app - we'll verify the setup automatically</div>
                        </div>
                    </div>
                </div>

                <div style="background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
                    <div style="display: flex; align-items: start; gap: 10px;">
                        <i class="fa-solid fa-shield-halved" style="color: #ef4444; font-size: 16px; margin-top: 2px;"></i>
                        <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.5;"><strong style="color: var(--text-primary);">Privacy Note:</strong> This permission only monitors app launches during active focus sessions. No data is collected or shared.</div>
                    </div>
                </div>

                <div class="modal-actions" style="display: flex; gap: 10px; margin-top: 24px;">
                    <button id="skipSetupBtn" class="auth-btn secondary-btn" style="margin: 0; flex: 1;">Skip for Now</button>
                    <button id="openSettingsBtn" class="auth-btn" style="margin: 0; flex: 2; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border: none;">
                        <i class="fa-solid fa-gear" style="margin-right: 6px;"></i>
                        Open Settings
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners
        document.getElementById('skipSetupBtn').addEventListener('click', () => {
            document.body.removeChild(modal);
            if (typeof Notify !== 'undefined') {
                Notify.info('You can enable it later from Settings → Focus Blocker');
            }
        });

        document.getElementById('openSettingsBtn').addEventListener('click', async () => {
            try {
                const { FocusBlockerPlugin } = Capacitor.Plugins;
                await FocusBlockerPlugin.openAccessibilitySettings();
                
                // Update button to show waiting state
                const btn = document.getElementById('openSettingsBtn');
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 6px;"></i>Waiting for setup...';
                btn.disabled = true;
                btn.style.opacity = '0.7';

                // Start checking for service status
                startServiceStatusPolling(modal);
            } catch (error) {
                console.error('Error opening settings:', error);
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

    // Poll for service status to detect when enabled
    function startServiceStatusPolling(modal) {
        let pollCount = 0;
        const maxPolls = 60; // Poll for up to 60 seconds

        const pollInterval = setInterval(async () => {
            pollCount++;

            const enabled = await checkAccessibilityServiceStatus();
            
            if (enabled) {
                clearInterval(pollInterval);
                showSetupSuccess(modal);
            } else if (pollCount >= maxPolls) {
                clearInterval(pollInterval);
                // Reset button
                const btn = document.getElementById('openSettingsBtn');
                if (btn) {
                    btn.innerHTML = '<i class="fa-solid fa-gear" style="margin-right: 6px;"></i>Open Settings';
                    btn.disabled = false;
                    btn.style.opacity = '1';
                }
            }
        }, 1000);
    }

    // Show success message
    function showSetupSuccess(modal) {
        const modalBox = modal.querySelector('.modal-box');
        modalBox.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div style="width: 80px; height: 80px; margin: 0 auto 20px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; animation: scaleIn 0.5s ease;">
                    <i class="fa-solid fa-check" style="font-size: 40px; color: white;"></i>
                </div>
                <h3 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 700; color: var(--text-primary);">Setup Complete!</h3>
                <p style="margin: 0 0 24px 0; font-size: 14px; color: var(--text-secondary); line-height: 1.6;">Focus Blocker is now active and ready to help you stay focused during study sessions.</p>
                
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: left;">
                    <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 12px; font-size: 13px;">✨ What's Next?</div>
                    <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.6;">
                        • Add websites and apps to your blocklist in Settings<br>
                        • Start a focus session to activate blocking<br>
                        • View your focus stats in the Analytics tab
                    </div>
                </div>

                <button id="completeSetupBtn" class="auth-btn" style="margin: 0; width: 100%; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); border: none;">
                    <i class="fa-solid fa-rocket" style="margin-right: 6px;"></i>
                    Get Started
                </button>
            </div>
        `;

        document.getElementById('completeSetupBtn').addEventListener('click', () => {
            document.body.removeChild(modal);
            localStorage.setItem('focusBlocker_setupComplete', 'true');
            if (typeof Notify !== 'undefined') {
                Notify.success('🎉 Focus Blocker is ready to use!');
            }
        });

        // Add animation keyframe
        if (!document.querySelector('#scaleInAnimation')) {
            const style = document.createElement('style');
            style.id = 'scaleInAnimation';
            style.textContent = `
                @keyframes scaleIn {
                    from { transform: scale(0); }
                    to { transform: scale(1); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Load blocklists
    // Load blocklists
    function loadBlocklists() {
        if (!window.FocusBlocker) {
            console.warn('FocusBlocker not available yet');
            return;
        }

        try {
            const websites = FocusBlocker.getBlockedWebsites();
            const apps = FocusBlocker.getBlockedApps();

            renderWebsiteList(websites);
            renderAppList(apps);

            // Update counts
            const websiteCount = document.getElementById('websiteBlocklistCount');
            const appCount = document.getElementById('appBlocklistCount');
            
            if (websiteCount) {
                websiteCount.textContent = websites.length;
            }
            if (appCount) {
                appCount.textContent = apps.length;
            }
        } catch (error) {
            console.error('Error loading blocklists:', error);
        }
    }

    // Render website list
    function renderWebsiteList(websites) {
        const container = document.getElementById('websiteBlocklist');
        if (!container) return;

        if (websites.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary); font-size: 13px;">No blocked websites yet</div>';
            return;
        }

        container.innerHTML = websites.map(website => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <i class="fa-solid fa-globe" style="color: var(--text-secondary); font-size: 14px;"></i>
                    <span style="font-size: 14px; color: var(--text-primary);">${escapeHtml(website)}</span>
                </div>
                <button class="remove-website-btn" data-website="${escapeHtml(website)}" style="background: transparent; border: none; color: #ef4444; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: background 0.2s;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `).join('');

        // Add remove listeners
        container.querySelectorAll('.remove-website-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const website = btn.dataset.website;
                removeWebsite(website);
            });
        });
    }

    // Render app list
    function renderAppList(apps) {
        const container = document.getElementById('appBlocklist');
        if (!container) return;

        if (apps.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary); font-size: 13px;">No blocked apps yet</div>';
            return;
        }

        container.innerHTML = apps.map(app => {
            const appName = getAppDisplayName(app);
            return `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px;">
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <span style="font-size: 14px; color: var(--text-primary); font-weight: 500;">${escapeHtml(appName)}</span>
                        <span style="font-size: 11px; color: var(--text-secondary); font-family: monospace;">${escapeHtml(app)}</span>
                    </div>
                    <button class="remove-app-btn" data-package="${escapeHtml(app)}" style="background: transparent; border: none; color: #ef4444; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: background 0.2s;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;
        }).join('');

        // Add remove listeners
        container.querySelectorAll('.remove-app-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const packageName = btn.dataset.package;
                removeApp(packageName);
            });
        });
    }

    // Get app display name from package
    function getAppDisplayName(packageName) {
        const knownApps = {
            'com.instagram.android': 'Instagram',
            'com.facebook.katana': 'Facebook',
            'com.twitter.android': 'Twitter',
            'com.reddit.frontpage': 'Reddit',
            'com.google.android.youtube': 'YouTube',
            'com.netflix.mediaclient': 'Netflix',
            'tv.twitch.android.app': 'Twitch',
            'com.discord': 'Discord',
            'com.pinterest': 'Pinterest',
            'com.snapchat.android': 'Snapchat',
            'com.tiktok.android': 'TikTok'
        };

        return knownApps[packageName] || packageName.split('.').pop();
    }

    // Add website
    function addWebsite() {
        const input = document.getElementById('addWebsiteInput');
        const website = input.value.trim().toLowerCase();

        if (!website) {
            return;
        }

        // Validate domain format (basic)
        if (!isValidDomain(website)) {
            if (typeof Notify !== 'undefined') {
                Notify.error('Invalid domain format. Use: domain.com');
            }
            return;
        }

        if (!window.FocusBlocker) {
            if (typeof Notify !== 'undefined') {
                Notify.error('Focus Blocker not available');
            }
            return;
        }

        try {
            FocusBlocker.addBlockedWebsite(website);
            input.value = '';
            loadBlocklists();
            
            if (typeof Notify !== 'undefined') {
                Notify.success(`Added ${website} to blocklist`);
            }
        } catch (error) {
            console.error('Error adding website:', error);
            if (typeof Notify !== 'undefined') {
                Notify.error('Failed to add website');
            }
        }
    }

    // Remove website
    function removeWebsite(website) {
        if (!window.FocusBlocker) return;

        try {
            FocusBlocker.removeBlockedWebsite(website);
            loadBlocklists();
            
            if (typeof Notify !== 'undefined') {
                Notify.info(`Removed ${website} from blocklist`);
            }
        } catch (error) {
            console.error('Error removing website:', error);
        }
    }

    // Add app
    function addApp() {
        const input = document.getElementById('addAppInput');
        const packageName = input.value.trim();

        if (!packageName) {
            return;
        }

        // Validate package name format (basic)
        if (!isValidPackageName(packageName)) {
            if (typeof Notify !== 'undefined') {
                Notify.error('Invalid package name format. Use: com.example.app');
            }
            return;
        }

        if (!window.FocusBlocker) {
            if (typeof Notify !== 'undefined') {
                Notify.error('Focus Blocker not available');
            }
            return;
        }

        try {
            FocusBlocker.addBlockedApp(packageName);
            input.value = '';
            loadBlocklists();
            
            if (typeof Notify !== 'undefined') {
                Notify.success(`Added ${getAppDisplayName(packageName)} to blocklist`);
            }
        } catch (error) {
            console.error('Error adding app:', error);
            if (typeof Notify !== 'undefined') {
                Notify.error('Failed to add app');
            }
        }
    }

    // Remove app
    function removeApp(packageName) {
        if (!window.FocusBlocker) return;

        try {
            FocusBlocker.removeBlockedApp(packageName);
            loadBlocklists();
            
            if (typeof Notify !== 'undefined') {
                Notify.info(`Removed ${getAppDisplayName(packageName)} from blocklist`);
            }
        } catch (error) {
            console.error('Error removing app:', error);
        }
    }

    // Browse installed apps
    async function browseInstalledApps() {
        if (!isAndroid || !window.FocusBlocker) {
            if (typeof Notify !== 'undefined') {
                Notify.error('Android device required');
            }
            return;
        }

        try {
            const { FocusBlockerPlugin } = Capacitor.Plugins;
            const result = await FocusBlockerPlugin.getInstalledApps({ includeSystemApps: false });

            if (result.apps && result.apps.length > 0) {
                showAppPickerModal(result.apps);
            } else {
                if (typeof Notify !== 'undefined') {
                    Notify.info('No apps found');
                }
            }
        } catch (error) {
            console.error('Error getting installed apps:', error);
            if (typeof Notify !== 'undefined') {
                Notify.error('Failed to load installed apps');
            }
        }
    }

    // Show app picker modal
    function showAppPickerModal(apps) {
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.display = 'flex';
        modal.style.zIndex = '10000';
        
        const blockedApps = FocusBlocker.getBlockedApps();
        
        modal.innerHTML = `
            <div class="modal-box" style="width: 90%; max-width: 500px; max-height: 80vh; display: flex; flex-direction: column;">
                <h3 style="margin-bottom: 16px;">Select Apps to Block</h3>
                
                <input type="text" id="appSearchInput" placeholder="Search apps..." style="width: 100%; padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 14px; background: var(--card-bg); color: var(--text-primary); margin-bottom: 12px;">
                
                <div style="flex: 1; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px; padding: 8px;">
                    ${apps.sort((a, b) => a.appName.localeCompare(b.appName)).map(app => {
                        const isBlocked = blockedApps.includes(app.packageName);
                        return `
                            <div class="app-picker-item" data-package="${escapeHtml(app.packageName)}" data-name="${escapeHtml(app.appName.toLowerCase())}" style="display: flex; align-items: center; justify-content: space-between; padding: 10px; border-radius: 6px; margin-bottom: 4px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='var(--card-bg)'" onmouseout="this.style.background='transparent'">
                                <div>
                                    <div style="font-size: 14px; font-weight: 500; color: var(--text-primary);">${escapeHtml(app.appName)}</div>
                                    <div style="font-size: 11px; color: var(--text-secondary); font-family: monospace; margin-top: 2px;">${escapeHtml(app.packageName)}</div>
                                </div>
                                <div class="settings-checkbox ${isBlocked ? 'checked' : ''}" style="flex-shrink: 0;">
                                    <i class="fa-solid fa-check checkbox-tick"></i>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                
                <div class="modal-actions" style="margin-top: 16px;">
                    <button class="auth-btn secondary-btn" id="closeAppPickerBtn" style="margin: 0;">Close</button>
                    <button class="auth-btn" id="saveAppPickerBtn" style="margin: 0;">Save Changes</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Search functionality
        const searchInput = modal.querySelector('#appSearchInput');
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            modal.querySelectorAll('.app-picker-item').forEach(item => {
                const name = item.dataset.name;
                const package_ = item.dataset.package.toLowerCase();
                item.style.display = (name.includes(query) || package_.includes(query)) ? 'flex' : 'none';
            });
        });

        // Toggle checkboxes
        modal.querySelectorAll('.app-picker-item').forEach(item => {
            item.addEventListener('click', () => {
                const checkbox = item.querySelector('.settings-checkbox');
                checkbox.classList.toggle('checked');
            });
        });

        // Close button
        modal.querySelector('#closeAppPickerBtn').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        // Save button
        modal.querySelector('#saveAppPickerBtn').addEventListener('click', () => {
            const selectedItems = modal.querySelectorAll('.app-picker-item .settings-checkbox.checked');
            const selectedPackages = Array.from(selectedItems).map(checkbox => {
                return checkbox.closest('.app-picker-item').dataset.package;
            });

            // Update blocklist
            const currentBlocked = FocusBlocker.getBlockedApps();
            
            // Remove unchecked apps
            currentBlocked.forEach(pkg => {
                if (!selectedPackages.includes(pkg)) {
                    FocusBlocker.removeBlockedApp(pkg);
                }
            });

            // Add newly checked apps
            selectedPackages.forEach(pkg => {
                if (!currentBlocked.includes(pkg)) {
                    FocusBlocker.addBlockedApp(pkg);
                }
            });

            loadBlocklists();
            document.body.removeChild(modal);

            if (typeof Notify !== 'undefined') {
                Notify.success('App blocklist updated');
            }
        });

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    // Update stats
    // Update stats
    function updateStats() {
        if (!window.FocusBlocker) {
            console.warn('FocusBlocker not available yet');
            return;
        }

        try {
            const totalStats = FocusBlocker.getTotalStats();
            
            const totalBlocked = document.getElementById('focusBlockerTotalBlocked');
            const avgScore = document.getElementById('focusBlockerAvgScore');

            if (totalBlocked) {
                totalBlocked.textContent = totalStats.totalAttempts || 0;
            }

            if (avgScore) {
                const score = Math.round(totalStats.averageFocusScore || 100);
                avgScore.textContent = score;
                avgScore.style.color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
            }
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }

    // Validate domain format
    function isValidDomain(domain) {
        // Basic domain validation
        const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
        return domainRegex.test(domain);
    }

    // Validate package name format
    function isValidPackageName(packageName) {
        // Basic Android package name validation
        const packageRegex = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i;
        return packageRegex.test(packageName);
    }

    // Escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Public API
    return {
        init,
        checkAccessibilityServiceStatus,
        loadBlocklists,
        updateStats,
        showSetupGuide
    };
})();

// Make it globally accessible for focusBlocker
window.FocusBlockerUI = FocusBlockerUI;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        FocusBlockerUI.init();
    });
} else {
    FocusBlockerUI.init();
}
