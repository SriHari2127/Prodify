// ===== SYNC STATUS UI API =====
// Provides real-time sync status display in the UI

/**
 * Sync Status UI Manager
 */
class SyncStatusUI {
    constructor() {
        this.currentStatus = 'IDLE';
        this.syncProgress = {
            total: 0,
            completed: 0,
            failed: 0
        };
        this.lastSyncTime = null;
        this.listeners = [];
        this.indicatorElement = null;
        this.detailsElement = null;
        this.retryCount = 0;
        this.maxRetries = 10;
        
        // Status configurations
        this.statusConfig = {
            IDLE: {
                icon: '⚪',
                text: 'Synced',
                color: '#6c757d',
                bgColor: '#e9ecef'
            },
            SYNCING: {
                icon: '🔄',
                text: 'Syncing...',
                color: '#0d6efd',
                bgColor: '#cfe2ff',
                animation: 'spin 1s linear infinite'
            },
            SYNCED: {
                icon: '✅',
                text: 'Synced',
                color: '#198754',
                bgColor: '#d1e7dd'
            },
            FAILED: {
                icon: '❌',
                text: 'Sync Failed',
                color: '#dc3545',
                bgColor: '#f8d7da'
            },
            OFFLINE: {
                icon: '📡',
                text: 'Offline',
                color: '#fd7e14',
                bgColor: '#ffe5d0'
            },
            PAUSED: {
                icon: '⏸️',
                text: 'Paused',
                color: '#ffc107',
                bgColor: '#fff3cd'
            }
        };
        
        // Subscribe to sync manager status changes
        this.subscribeToSyncManager();
    }

    /**
     * Subscribe to sync manager events
     */
    subscribeToSyncManager() {
        if (window.syncManager) {
            window.syncManager.onStatusChange((status) => {
                this.updateStatus(status);
            });
            
            // Get initial status from sync manager
            if (window.syncManager.getStatus) {
                const initialStatus = window.syncManager.getStatus();
                this.updateStatus(initialStatus);
            } else {
                // Default to SYNCED if status is not available
                this.updateStatus('SYNCED');
            }
            
            console.log('✅ SyncStatusUI subscribed to SyncManager');
            this.retryCount = 0; // Reset counter on success
        } else if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            
            if (this.retryCount === 1) {
                console.warn('⚠️ SyncManager not available yet, will retry...');
            }
            
            // Retry after 1 second, max 10 times
            setTimeout(() => this.subscribeToSyncManager(), 1000);
        } else {
            console.warn('⚠️ SyncManager not available after ' + this.maxRetries + ' retries. Giving up.');
        }
    }

    /**
     * Initialize and render the sync indicator
     * @param {string|HTMLElement} container - Container selector or element
     * @returns {HTMLElement} Created indicator element
     */
    renderSyncIndicator(container) {
        const containerEl = typeof container === 'string' 
            ? document.querySelector(container) 
            : container;
            
        if (!containerEl) {
            console.error('❌ Container not found:', container);
            return null;
        }

        // Create indicator element
        this.indicatorElement = document.createElement('div');
        this.indicatorElement.className = 'sync-status-indicator';
        this.indicatorElement.innerHTML = this.buildIndicatorHTML();
        
        // Initially hide if status is IDLE or SYNCED
        if (this.currentStatus === 'IDLE' || this.currentStatus === 'SYNCED') {
            this.indicatorElement.style.display = 'none';
        }
        
        // Add styles
        this.injectStyles();
        
        // Append to container
        containerEl.appendChild(this.indicatorElement);
        
        // Click handler removed - details window not needed for users
        
        console.log('✅ Sync indicator rendered');
        return this.indicatorElement;
    }

    /**
     * Build indicator HTML
     * @returns {string} HTML string
     */
    buildIndicatorHTML() {
        const config = this.statusConfig[this.currentStatus];
        
        return `
            <div class="sync-indicator-badge" style="
                background-color: ${config.bgColor};
                color: ${config.color};
                padding: 6px 12px;
                border-radius: 20px;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.3s ease;
            ">
                <span class="sync-icon" style="${config.animation ? `animation: ${config.animation}; display: inline-block;` : ''}">
                    ${config.icon}
                </span>
                <span class="sync-text">${config.text}</span>
            </div>
        `;
    }

    /**
     * Render detailed sync status
     * @param {string|HTMLElement} container - Container selector or element
     * @returns {HTMLElement} Created details element
     */
    renderSyncDetails(container) {
        const containerEl = typeof container === 'string' 
            ? document.querySelector(container) 
            : container;
            
        if (!containerEl) {
            console.error('❌ Container not found:', container);
            return null;
        }

        // Create details element
        this.detailsElement = document.createElement('div');
        this.detailsElement.className = 'sync-status-details';
        this.detailsElement.innerHTML = this.buildDetailsHTML();
        
        // Append to container
        containerEl.appendChild(this.detailsElement);
        
        console.log('✅ Sync details rendered');
        return this.detailsElement;
    }

    /**
     * Build details HTML
     * @returns {string} HTML string
     */
    buildDetailsHTML() {
        const config = this.statusConfig[this.currentStatus];
        const lastSyncText = this.lastSyncTime 
            ? this.formatTimeAgo(this.lastSyncTime)
            : 'Never';
        
        return `
            <div class="sync-details-card" style="
                background: white;
                border: 1px solid #dee2e6;
                border-radius: 8px;
                padding: 16px;
                max-width: 400px;
            ">
                <!-- Status Header -->
                <div class="sync-details-header" style="
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 16px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid #e9ecef;
                ">
                    <span style="font-size: 24px;">${config.icon}</span>
                    <div>
                        <div style="font-weight: 600; color: ${config.color};">
                            ${config.text}
                        </div>
                        <div style="font-size: 12px; color: #6c757d;">
                            Last synced: ${lastSyncText}
                        </div>
                    </div>
                </div>
                
                <!-- Progress (shown during sync) -->
                ${this.currentStatus === 'SYNCING' ? `
                    <div class="sync-progress" style="margin-bottom: 16px;">
                        <div style="
                            display: flex;
                            justify-content: space-between;
                            margin-bottom: 6px;
                            font-size: 13px;
                            color: #6c757d;
                        ">
                            <span>Progress</span>
                            <span>${this.syncProgress.completed}/${this.syncProgress.total}</span>
                        </div>
                        <div style="
                            width: 100%;
                            height: 8px;
                            background: #e9ecef;
                            border-radius: 4px;
                            overflow: hidden;
                        ">
                            <div style="
                                width: ${this.getProgressPercentage()}%;
                                height: 100%;
                                background: ${config.color};
                                transition: width 0.3s ease;
                            "></div>
                        </div>
                    </div>
                ` : ''}
                
                <!-- Stats -->
                <div class="sync-stats" style="
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 12px;
                    margin-bottom: 16px;
                ">
                    <div class="sync-stat" style="
                        text-align: center;
                        padding: 8px;
                        background: #f8f9fa;
                        border-radius: 6px;
                    ">
                        <div style="font-size: 20px; font-weight: 600; color: #495057;">
                            ${this.syncProgress.total}
                        </div>
                        <div style="font-size: 11px; color: #6c757d;">
                            Total
                        </div>
                    </div>
                    <div class="sync-stat" style="
                        text-align: center;
                        padding: 8px;
                        background: #d1e7dd;
                        border-radius: 6px;
                    ">
                        <div style="font-size: 20px; font-weight: 600; color: #198754;">
                            ${this.syncProgress.completed}
                        </div>
                        <div style="font-size: 11px; color: #146c43;">
                            Synced
                        </div>
                    </div>
                    <div class="sync-stat" style="
                        text-align: center;
                        padding: 8px;
                        background: #f8d7da;
                        border-radius: 6px;
                    ">
                        <div style="font-size: 20px; font-weight: 600; color: #dc3545;">
                            ${this.syncProgress.failed}
                        </div>
                        <div style="font-size: 11px; color: #b02a37;">
                            Failed
                        </div>
                    </div>
                </div>
                
                <!-- Actions -->
                <div class="sync-actions" style="
                    display: flex;
                    gap: 8px;
                ">
                    <button class="sync-btn-retry" style="
                        flex: 1;
                        padding: 8px 16px;
                        background: #0d6efd;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                    " ${this.currentStatus === 'SYNCING' ? 'disabled' : ''}>
                        🔄 Retry Sync
                    </button>
                    <button class="sync-btn-view-queue" style="
                        flex: 1;
                        padding: 8px 16px;
                        background: #6c757d;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                    ">
                        📋 View Queue
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Update sync status
     * @param {string} status - New status
     */
    updateStatus(status) {
        this.currentStatus = status;
        
        if (status === 'SYNCED') {
            this.lastSyncTime = new Date();
        }
        
        // Re-render indicator
        if (this.indicatorElement) {
            this.indicatorElement.innerHTML = this.buildIndicatorHTML();
            
            // Show indicator for active states
            if (status === 'SYNCING' || status === 'FAILED' || status === 'OFFLINE' || status === 'PENDING') {
                this.indicatorElement.style.display = 'inline-flex';
            }
            // Auto-hide for SYNCED/IDLE states after 2 seconds
            else if (status === 'SYNCED' || status === 'IDLE') {
                // Show briefly then hide
                this.indicatorElement.style.display = 'inline-flex';
                setTimeout(() => {
                    if (this.indicatorElement && (this.currentStatus === 'SYNCED' || this.currentStatus === 'IDLE')) {
                        this.indicatorElement.style.display = 'none';
                    }
                }, 2000);
            }
        }
        
        // Update settings tab sync status indicator
        this.updateSettingsTabIndicator(status);
        
        // Details window feature removed - no longer needed
        
        // Notify listeners
        this.notifyListeners(status);
    }

    /**
     * Update settings tab sync status indicator
     * @param {string} status - Current sync status
     */
    updateSettingsTabIndicator(status) {
        const settingsIndicator = document.getElementById('settingsSyncStatusIndicator');
        const settingsStatusText = document.getElementById('settingsSyncStatusText');
        const backupIndicator = document.getElementById('backupSyncStatusIndicator');
        
        // Treat IDLE as SYNCED
        const displayStatus = status === 'IDLE' ? 'SYNCED' : status;
        const config = this.statusConfig[displayStatus] || this.statusConfig['SYNCED'];
        
        // Update main settings indicator
        if (settingsIndicator && settingsStatusText) {
            settingsIndicator.className = 'sync-status-icon';
            settingsIndicator.innerHTML = config.icon;
            
            // Add status-specific class
            switch(displayStatus) {
                case 'SYNCED':
                    settingsIndicator.classList.add('synced');
                    settingsStatusText.textContent = 'All data synced';
                    break;
                case 'SYNCING':
                    settingsIndicator.classList.add('syncing');
                    settingsStatusText.textContent = 'Syncing data...';
                    break;
                case 'ERROR':
                case 'FAILED':
                    settingsIndicator.classList.add('error');
                    settingsStatusText.textContent = 'Sync failed';
                    break;
                case 'OFFLINE':
                    settingsIndicator.classList.add('offline');
                    settingsStatusText.textContent = 'Working offline';
                    break;
                case 'PENDING':
                case 'PAUSED':
                    settingsIndicator.classList.add('pending');
                    settingsStatusText.textContent = 'Pending sync';
                    break;
                default:
                    settingsIndicator.classList.add('synced');
                    settingsStatusText.textContent = 'All data synced';
            }
            
            // Add last sync time if available
            if ((displayStatus === 'SYNCED' || status === 'IDLE') && this.lastSyncTime) {
                const timeAgo = this.getTimeAgo(this.lastSyncTime);
                settingsStatusText.textContent = `Last synced ${timeAgo}`;
            }
        }
        
        // Update backup section indicator
        if (backupIndicator) {
            backupIndicator.className = 'sync-status-icon';
            backupIndicator.innerHTML = config.icon;
            
            switch(displayStatus) {
                case 'SYNCED':
                    backupIndicator.classList.add('synced');
                    break;
                case 'SYNCING':
                    backupIndicator.classList.add('syncing');
                    break;
                case 'ERROR':
                case 'FAILED':
                    backupIndicator.classList.add('error');
                    break;
                case 'OFFLINE':
                    backupIndicator.classList.add('offline');
                    break;
                case 'PENDING':
                case 'PAUSED':
                    backupIndicator.classList.add('pending');
                    break;
                default:
                    backupIndicator.classList.add('synced');
            }
        }
    }

    /**
     * Update sync progress
     * @param {Object} progress - Progress data
     */
    updateProgress(progress) {
        this.syncProgress = {
            ...this.syncProgress,
            ...progress
        };
        
        // Re-render details if visible
        if (this.detailsElement) {
            this.detailsElement.innerHTML = this.buildDetailsHTML();
            this.attachDetailsEventHandlers();
        }
    }

    /**
     * Get progress percentage
     * @returns {number} Percentage (0-100)
     */
    getProgressPercentage() {
        if (this.syncProgress.total === 0) return 0;
        return Math.round((this.syncProgress.completed / this.syncProgress.total) * 100);
    }

    /**
     * Toggle details panel - DISABLED (feature removed)
     */
    toggleDetails() {
        // Feature removed - users don't need technical sync details
        return;
    }

    /**
     * Handle click outside details panel - DISABLED
     */
    handleOutsideClick = (event) => {
        // Feature removed
        return;
    }

    /**
     * Attach event handlers to details buttons - DISABLED
     */
    attachDetailsEventHandlers() {
        // Feature removed
        return;
    }

    /**
     * Handle retry button click - DISABLED
     */
    async handleRetryClick() {
        // Feature removed
        return;
    }

    /**
     * Handle view queue button click - DISABLED
     */
    async handleViewQueueClick() {
        // Feature removed
        return;
    }

    /**
     * Notify all listeners
     * @param {string} status - New status
     */
    notifyListeners(status) {
        this.listeners.forEach(callback => {
            try {
                callback(status);
            } catch (error) {
                console.error('❌ Error in status listener:', error);
            }
        });
    }

    /**
     * Inject CSS styles
     */
    injectStyles() {
        if (document.getElementById('sync-status-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'sync-status-styles';
        style.textContent = `
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            
            .sync-status-indicator:hover .sync-indicator-badge {
                transform: scale(1.05);
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            
            .sync-btn-retry:hover:not(:disabled),
            .sync-btn-view-queue:hover {
                opacity: 0.9;
                transform: translateY(-1px);
            }
            
            .sync-btn-retry:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
        `;
        
        document.head.appendChild(style);
    }

    /**
     * Destroy and cleanup
     */
    destroy() {
        if (this.indicatorElement) {
            this.indicatorElement.remove();
            this.indicatorElement = null;
        }
        
        if (this.detailsElement) {
            this.detailsElement.remove();
            this.detailsElement = null;
        }
        
        document.removeEventListener('click', this.handleOutsideClick);
        this.listeners = [];
    }
}

// ===== EXPORT SINGLETON =====
const syncStatusUI = new SyncStatusUI();
window.syncStatusUI = syncStatusUI;

// ===== CONVENIENCE FUNCTIONS =====

/**
 * Render sync indicator in navbar or header
 * @param {string} selector - Container selector (default: 'header')
 * @returns {HTMLElement}
 */
function showSyncIndicator(selector = 'header') {
    return syncStatusUI.renderSyncIndicator(selector);
}

/**
 * Show sync details modal - DISABLED (feature removed)
 * @returns {void}
 */
function showSyncDetails() {
    // Feature removed - users don't need technical sync details
    return;
}

/**
 * Get current sync status
 * @returns {Object}
 */
function getSyncStatus() {
    return {
        status: syncStatusUI.currentStatus,
        progress: syncStatusUI.syncProgress,
        lastSync: syncStatusUI.lastSyncTime
    };
}

// Export utilities
window.showSyncIndicator = showSyncIndicator;
window.showSyncDetails = showSyncDetails;
window.getSyncStatus = getSyncStatus;

// Initialize settings tab sync status on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSettingsSync);
} else {
    initializeSettingsSync();
}

function initializeSettingsSync() {
    // Set initial status for settings tab indicators
    setTimeout(() => {
        if (window.syncStatusUI) {
            // Get current status from sync manager if available
            let currentStatus = 'SYNCED';
            
            if (window.syncManager && window.syncManager.getStatus) {
                currentStatus = window.syncManager.getStatus();
            }
            
            // Trigger initial update
            syncStatusUI.updateStatus(currentStatus);
            console.log('✅ Settings tab sync status initialized with status:', currentStatus);
        }
    }, 1000); // Increased delay to ensure sync manager is ready
}

console.log('✅ Sync Status UI module loaded');
