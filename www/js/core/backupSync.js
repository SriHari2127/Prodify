// ===== BACKUP & SYNC MODULE =====
// Comprehensive cloud backup and synchronization system

const BackupSync = (function() {
    'use strict';

    let syncStatus = 'synced'; // 'synced', 'syncing', 'failed', 'offline'
    let lastBackupTime = null;
    let autoSyncInterval = null;
    let isOnline = navigator.onLine;

    // ===== INITIALIZATION =====
    
    function init() {
        loadLastBackupTime();
        setupOnlineDetection();
        startAutoSync();
        updateStatusUI();
    }

    // ===== ONLINE/OFFLINE DETECTION =====
    
    function setupOnlineDetection() {
        window.addEventListener('online', () => {
            isOnline = true;
            syncStatus = 'synced';
            updateStatusUI();
            // Auto-sync when connection restored
            setTimeout(() => syncAllData(), 1000);
        });

        window.addEventListener('offline', () => {
            isOnline = false;
            syncStatus = 'offline';
            updateStatusUI();
        });
    }

    // ===== AUTO SYNC =====
    
    function startAutoSync() {
        // Sync every 3 minutes
        autoSyncInterval = setInterval(() => {
            if (isOnline && currentUserId) {
                syncAllData();
            }
        }, 3 * 60 * 1000);
    }

    function stopAutoSync() {
        if (autoSyncInterval) {
            clearInterval(autoSyncInterval);
            autoSyncInterval = null;
        }
    }

    // ===== FULL BACKUP =====
    
    async function createFullBackup(showNotification = true) {
        if (!currentUserId || typeof firebase === 'undefined') {
            if (showNotification && typeof Notify !== 'undefined') {
                Notify.error('Cannot backup: Not logged in');
            }
            return false;
        }

        if (!isOnline) {
            if (showNotification && typeof Notify !== 'undefined') {
                Notify.warning('Cannot backup: No internet connection');
            }
            syncStatus = 'offline';
            updateStatusUI();
            return false;
        }

        syncStatus = 'syncing';
        updateStatusUI();

        try {
            const timestamp = new Date().toISOString();
            const backupData = {
                timestamp,
                version: '1.0',
                data: {}
            };

            // Collect all localStorage data
            backupData.data.tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
            backupData.data.habits = JSON.parse(localStorage.getItem('habits') || '[]');
            backupData.data.subjects = JSON.parse(localStorage.getItem('subjects') || '[]');
            backupData.data.exams = JSON.parse(localStorage.getItem('exams') || '[]');
            backupData.data.studyBlocks = JSON.parse(localStorage.getItem('studyBlocks') || '[]');
            backupData.data.focusSessions = JSON.parse(localStorage.getItem('focusSessions') || '[]');
            backupData.data.notes = JSON.parse(localStorage.getItem('notes') || '[]');
            
            // User progress data
            backupData.data.xp = localStorage.getItem('xp') || '0';
            backupData.data.level = localStorage.getItem('level') || '1';
            backupData.data.unlockedBadges = JSON.parse(localStorage.getItem('unlockedBadges') || '[]');
            
            // User settings
            backupData.data.theme = localStorage.getItem('theme') || 'light';
            backupData.data.accentColor = localStorage.getItem('accentColor') || '#6366f1';
            backupData.data.currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            backupData.data.notificationsEnabled = localStorage.getItem('notificationsEnabled') || 'true';
            
            // Focus Lock Mode data
            backupData.data.focusStreak = JSON.parse(localStorage.getItem('focusStreak') || '{"streak":0}');

            // Save to Firestore in 'backups' collection with timestamp-based ID
            const backupId = `backup_${Date.now()}`;
            await firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection('backups')
                .doc(backupId)
                .set(backupData);

            // Update metadata with latest backup info
            await firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection('metadata')
                .doc('backupInfo')
                .set({
                    lastBackupTime: timestamp,
                    lastBackupId: backupId,
                    backupCount: firebase.firestore.FieldValue.increment(1)
                }, { merge: true });

            // Clean up old backups (keep only last 3)
            await cleanupOldBackups();

            // Update local state
            lastBackupTime = timestamp;
            saveLastBackupTime();
            syncStatus = 'synced';
            updateStatusUI();

            if (showNotification && typeof Notify !== 'undefined') {
                Notify.success('Backup completed successfully!');
            }

            console.log('✅ Full backup completed:', backupId);
            return true;

        } catch (error) {
            console.error('❌ Backup error:', error);
            syncStatus = 'failed';
            updateStatusUI();
            
            if (showNotification && typeof Notify !== 'undefined') {
                Notify.error('Backup failed. Please try again.');
            }
            return false;
        }
    }

    // ===== RESTORE FROM BACKUP =====
    
    async function restoreFromBackup(backupId = null) {
        if (!currentUserId || typeof firebase === 'undefined') {
            if (typeof Notify !== 'undefined') {
                Notify.error('Cannot restore: Not logged in');
            }
            return false;
        }

        if (!isOnline) {
            if (typeof Notify !== 'undefined') {
                Notify.warning('Cannot restore: No internet connection');
            }
            return false;
        }

        syncStatus = 'syncing';
        updateStatusUI();

        try {
            let backupDoc;

            if (backupId) {
                // Restore specific backup
                backupDoc = await firebase.firestore()
                    .collection('users')
                    .doc(currentUserId)
                    .collection('backups')
                    .doc(backupId)
                    .get();
            } else {
                // Get latest backup
                const backups = await firebase.firestore()
                    .collection('users')
                    .doc(currentUserId)
                    .collection('backups')
                    .orderBy('timestamp', 'desc')
                    .limit(1)
                    .get();

                if (backups.empty) {
                    if (typeof Notify !== 'undefined') {
                        Notify.info('No backup found to restore');
                    }
                    syncStatus = 'synced';
                    updateStatusUI();
                    return false;
                }

                backupDoc = backups.docs[0];
            }

            if (!backupDoc.exists) {
                if (typeof Notify !== 'undefined') {
                    Notify.error('Backup not found');
                }
                syncStatus = 'failed';
                updateStatusUI();
                return false;
            }

            const backupData = backupDoc.data();
            const data = backupData.data;

            // Restore all data to localStorage
            if (data.tasks) localStorage.setItem('tasks', JSON.stringify(data.tasks));
            if (data.habits) localStorage.setItem('habits', JSON.stringify(data.habits));
            if (data.subjects) localStorage.setItem('subjects', JSON.stringify(data.subjects));
            if (data.exams) localStorage.setItem('exams', JSON.stringify(data.exams));
            if (data.studyBlocks) localStorage.setItem('studyBlocks', JSON.stringify(data.studyBlocks));
            if (data.focusSessions) localStorage.setItem('focusSessions', JSON.stringify(data.focusSessions));
            if (data.notes) localStorage.setItem('notes', JSON.stringify(data.notes));
            
            // Restore user progress
            if (data.xp) localStorage.setItem('xp', data.xp);
            if (data.level) localStorage.setItem('level', data.level);
            if (data.unlockedBadges) localStorage.setItem('unlockedBadges', JSON.stringify(data.unlockedBadges));
            
            // Restore settings
            if (data.theme) localStorage.setItem('theme', data.theme);
            if (data.accentColor) localStorage.setItem('accentColor', data.accentColor);
            if (data.currentUser) localStorage.setItem('currentUser', JSON.stringify(data.currentUser));
            if (data.notificationsEnabled) localStorage.setItem('notificationsEnabled', data.notificationsEnabled);
            if (data.focusStreak) localStorage.setItem('focusStreak', JSON.stringify(data.focusStreak));

            syncStatus = 'synced';
            updateStatusUI();

            if (typeof Notify !== 'undefined') {
                Notify.success('Data restored successfully! Reloading app...');
            }

            // Reload the app to apply restored data
            setTimeout(() => {
                window.location.reload();
            }, 1500);

            console.log('✅ Data restored from backup:', backupDoc.id);
            return true;

        } catch (error) {
            console.error('❌ Restore error:', error);
            syncStatus = 'failed';
            updateStatusUI();
            
            if (typeof Notify !== 'undefined') {
                Notify.error('Restore failed. Please try again.');
            }
            return false;
        }
    }

    // ===== AUTO SYNC (INCREMENTAL) =====
    
    async function syncAllData() {
        if (!currentUserId || typeof firebase === 'undefined' || !isOnline) {
            return;
        }

        syncStatus = 'syncing';
        updateStatusUI();

        try {
            // Sync each data type to Firestore using conflict resolution
            await syncDataType('tasks');
            await syncDataType('habits');
            await syncDataType('subjects');
            await syncDataType('exams');
            await syncDataType('studyBlocks');
            await syncDataType('focusSessions');
            await syncDataType('notes');

            syncStatus = 'synced';
            updateStatusUI();
            console.log('✅ Auto-sync completed');

        } catch (error) {
            console.error('❌ Sync error:', error);
            syncStatus = 'failed';
            updateStatusUI();
        }
    }

    // ===== SMART CONFLICT RESOLUTION =====
    
    async function syncDataType(dataType) {
        if (!currentUserId || typeof firebase === 'undefined') return;

        try {
            const localData = JSON.parse(localStorage.getItem(dataType) || '[]');
            if (!Array.isArray(localData) || localData.length === 0) return;

            const collection = firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection(dataType);

            // Get cloud data
            const snapshot = await collection.get();
            const cloudData = {};
            snapshot.forEach(doc => {
                cloudData[doc.id] = doc.data();
            });

            // Merge with conflict resolution
            const mergedData = [];
            const processedIds = new Set();

            // Process local data
            for (const localItem of localData) {
                processedIds.add(localItem.id);
                const cloudItem = cloudData[localItem.id];

                if (!cloudItem) {
                    // Item only exists locally - upload it
                    await collection.doc(localItem.id).set(localItem);
                    mergedData.push(localItem);
                } else {
                    // Item exists in both - use latest based on timestamp
                    const localTime = new Date(localItem.updatedAt || localItem.createdAt || localItem.completedAt || 0);
                    const cloudTime = new Date(cloudItem.updatedAt || cloudItem.createdAt || cloudItem.completedAt || 0);

                    if (localTime >= cloudTime) {
                        // Local is newer - upload it
                        await collection.doc(localItem.id).set(localItem);
                        mergedData.push(localItem);
                    } else {
                        // Cloud is newer - use cloud version
                        mergedData.push(cloudItem);
                    }
                }
            }

            // Process cloud items that don't exist locally
            for (const [id, cloudItem] of Object.entries(cloudData)) {
                if (!processedIds.has(id)) {
                    mergedData.push(cloudItem);
                }
            }

            // Update localStorage with merged data
            localStorage.setItem(dataType, JSON.stringify(mergedData));

        } catch (error) {
            console.error(`❌ Error syncing ${dataType}:`, error);
        }
    }

    // ===== BACKUP HISTORY =====
    
    async function getBackupHistory() {
        if (!currentUserId || typeof firebase === 'undefined') {
            return [];
        }

        try {
            const snapshot = await firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection('backups')
                .orderBy('timestamp', 'desc')
                .limit(3)
                .get();

            const backups = [];
            snapshot.forEach(doc => {
                backups.push({
                    id: doc.id,
                    timestamp: doc.data().timestamp,
                    version: doc.data().version
                });
            });

            return backups;

        } catch (error) {
            console.error('❌ Error getting backup history:', error);
            return [];
        }
    }

    async function cleanupOldBackups() {
        if (!currentUserId || typeof firebase === 'undefined') return;

        try {
            const snapshot = await firebase.firestore()
                .collection('users')
                .doc(currentUserId)
                .collection('backups')
                .orderBy('timestamp', 'desc')
                .get();

            // Delete backups after the 3rd one
            const toDelete = [];
            snapshot.docs.forEach((doc, index) => {
                if (index >= 3) {
                    toDelete.push(doc.ref.delete());
                }
            });

            if (toDelete.length > 0) {
                await Promise.all(toDelete);
                console.log(`✅ Cleaned up ${toDelete.length} old backup(s)`);
            }

        } catch (error) {
            console.error('❌ Error cleaning up backups:', error);
        }
    }

    // ===== FIRST LOGIN BEHAVIOR =====
    
    async function checkFirstLogin() {
        if (!currentUserId || typeof firebase === 'undefined') return;

        try {
            // Check if user has any cloud backup
            const backups = await getBackupHistory();
            
            // Check if local data exists
            const hasLocalData = 
                (JSON.parse(localStorage.getItem('tasks') || '[]').length > 0) ||
                (JSON.parse(localStorage.getItem('habits') || '[]').length > 0) ||
                (JSON.parse(localStorage.getItem('notes') || '[]').length > 0);

            if (backups.length > 0 && !hasLocalData) {
                // User has cloud backup but no local data - show restore prompt
                showRestorePrompt(backups[0]);
            } else if (!hasLocalData && backups.length === 0) {
                // New user - do nothing
                console.log('New user detected');
            } else if (hasLocalData && backups.length === 0) {
                // User has local data but no backup - create first backup
                setTimeout(() => createFullBackup(false), 2000);
            }

        } catch (error) {
            console.error('❌ Error checking first login:', error);
        }
    }

    function showRestorePrompt(latestBackup) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-box" style="max-width: 420px;">
                <div style="text-align: center;">
                    <div style="width: 80px; height: 80px; margin: 0 auto 20px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 36px;">
                        <i class="fa-solid fa-cloud-arrow-down"></i>
                    </div>
                    <h3 style="margin-bottom: 12px;">Cloud Backup Found</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 8px;">We found your cloud backup from:</p>
                    <p style="font-weight: 600; color: var(--accent-color); margin-bottom: 20px;">${formatBackupTime(latestBackup.timestamp)}</p>
                    <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 24px;">Do you want to restore your data?</p>
                    <div class="modal-actions" style="gap: 12px;">
                        <button class="auth-btn secondary-btn" onclick="BackupSync.dismissRestorePrompt()">Start Fresh</button>
                        <button class="auth-btn" onclick="BackupSync.restoreAndDismiss()">Restore Data</button>
                    </div>
                </div>
            </div>
        `;
        modal.id = 'restorePromptModal';
        document.body.appendChild(modal);
    }

    function dismissRestorePrompt() {
        const modal = document.getElementById('restorePromptModal');
        if (modal) modal.remove();
    }

    async function restoreAndDismiss() {
        dismissRestorePrompt();
        await restoreFromBackup();
    }

    // ===== UI HELPERS =====
    
    function updateStatusUI() {
        // Update in-Settings status indicator
        const statusEl = document.getElementById('syncStatusIndicator');
        const statusTextEl = document.getElementById('syncStatusText');
        
        if (statusEl) {
            statusEl.className = 'sync-status-icon';
            
            if (syncStatus === 'synced') {
                statusEl.innerHTML = '<i class="fa-solid fa-check"></i>';
                statusEl.classList.add('synced');
                if (statusTextEl) statusTextEl.textContent = 'Synced';
                
            } else if (syncStatus === 'syncing') {
                statusEl.innerHTML = '<i class="fa-solid fa-rotate"></i>';
                statusEl.classList.add('syncing');
                if (statusTextEl) statusTextEl.textContent = 'Syncing...';
                
            } else if (syncStatus === 'failed') {
                statusEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
                statusEl.classList.add('failed');
                if (statusTextEl) statusTextEl.textContent = 'Sync Failed';
                
            } else if (syncStatus === 'offline') {
                statusEl.innerHTML = '<i class="fa-solid fa-wifi-slash"></i>';
                statusEl.classList.add('offline');
                if (statusTextEl) statusTextEl.textContent = 'Offline';
            }
        }

        // Update last backup time
        const lastBackupEl = document.getElementById('lastBackupTime');
        if (lastBackupEl) {
            if (lastBackupTime) {
                lastBackupEl.textContent = formatBackupTime(lastBackupTime);
            } else {
                lastBackupEl.textContent = 'Never';
            }
        }
    }

    function formatBackupTime(timestamp) {
        if (!timestamp) return 'Never';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    }

    function loadLastBackupTime() {
        try {
            lastBackupTime = localStorage.getItem('lastBackupTime');
        } catch (e) {
            lastBackupTime = null;
        }
    }

    function saveLastBackupTime() {
        try {
            if (lastBackupTime) {
                localStorage.setItem('lastBackupTime', lastBackupTime);
            }
        } catch (e) {
            console.error('Error saving last backup time:', e);
        }
    }

    // ===== MANUAL SYNC TRIGGER =====
    
    function triggerSync(showNotification = false) {
        if (!isOnline) {
            if (showNotification && typeof Notify !== 'undefined') {
                Notify.warning('Cannot sync: No internet connection');
            }
            return;
        }

        syncAllData();
        
        if (showNotification && typeof Notify !== 'undefined') {
            setTimeout(() => {
                if (syncStatus === 'synced') {
                    Notify.success('Sync completed successfully!');
                }
            }, 2000);
        }
    }

    // ===== PUBLIC API =====
    
    return {
        init,
        createFullBackup,
        restoreFromBackup,
        syncAllData,
        triggerSync,
        getBackupHistory,
        checkFirstLogin,
        dismissRestorePrompt,
        restoreAndDismiss,
        updateStatusUI,
        getSyncStatus: () => syncStatus,
        getLastBackupTime: () => lastBackupTime
    };
})();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    BackupSync.init();
});

// Export globally
window.BackupSync = BackupSync;
