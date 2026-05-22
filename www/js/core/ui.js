// ===== UI MODULE (ui.js) =====
// Handles DOM interactions, Event Listeners, and Formatting

// Safe JSON parsing helper
function safeJSONParse(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        if (!item) return defaultValue;
        return JSON.parse(item);
    } catch (error) {
        console.error(`Error parsing ${key} from localStorage:`, error);
        return defaultValue;
    }
}

let habitChartInstance = null;
let profileChartInstance = null;
let activeProfileStat = 'tasks';
let hasJustCelebrated = false; // Prevent confetti spam on every sync
let draggedTaskElement = null; // Track dragged element by direct reference
let cachedProfileName = null; // Cache username to avoid repeated Firestore reads
let cachedProfileUserId = null; // Track which user the cache belongs to

// Reset all collapsible sections inside profile modal to closed state
function resetProfileSections() {
    // Close Account & Preferences sections
    ['accountSectionContent', 'appPrefsSectionContent'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = 'none';
            const header = el.previousElementSibling;
            if (header) {
                const chevron = header.querySelector('.chevron-icon');
                if (chevron) chevron.style.transform = 'rotate(0deg)';
            }
        }
    });
    // Close Avatar & Accent sub-sections
    ['avatarSectionContent', 'accentSectionContent'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = 'none';
            const parentRow = el.previousElementSibling;
            if (parentRow) {
                const ch = parentRow.querySelector('.chevron-icon');
                if (ch) { ch.style.transform = 'rotate(0deg)'; ch.style.opacity = '0.5'; }
            }
        }
    });
    // Close & reset password form
    const pwContainer = document.getElementById('changePasswordContainer');
    if (pwContainer) {
        pwContainer.classList.add('collapsed');
        const pwChevron = document.querySelector('#togglePasswordSectionBtn .chevron-icon');
        if (pwChevron) { pwChevron.style.transform = 'rotate(0deg)'; pwChevron.style.opacity = '0.5'; }
        ['currentPasswordInput', 'newPasswordInput', 'confirmPasswordInput'].forEach(id => {
            const input = document.getElementById(id);
            if (input) { input.value = ''; input.type = 'password'; }
        });
        const pe = document.getElementById('passwordChangeError');
        const ps = document.getElementById('passwordChangeSuccess');
        if (pe) pe.style.display = 'none';
        if (ps) ps.style.display = 'none';
    }
    // Close name edit mode
    const profileNameText = document.getElementById('profileNameText');
    const profileNameInput = document.getElementById('profileNameInput');
    const editProfileNameBtn = document.getElementById('editProfileNameBtn');
    const profileNameActions = document.getElementById('profileNameActions');
    if (profileNameText) profileNameText.style.display = 'block';
    if (editProfileNameBtn) editProfileNameBtn.style.display = 'flex';
    if (profileNameInput) profileNameInput.style.display = 'none';
    if (profileNameActions) profileNameActions.style.display = 'none';
}

// 🎨 Theme Management
function applyTheme(theme) {
    const isDark = theme !== "light";
    document.body.classList.toggle("light", !isDark);

    // Update both toggles (header + settings)
    const themeToggle = document.getElementById("themeToggle");
    const profileThemeToggle = document.getElementById("profileThemeToggle");

    if (themeToggle) themeToggle.checked = isDark;
    if (profileThemeToggle) profileThemeToggle.checked = isDark;

    localStorage.setItem("theme", theme);

    // Notify all components so charts/JS-rendered parts update instantly
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
}

document.addEventListener("DOMContentLoaded", function () {
    const themeToggle = document.getElementById("themeToggle");
    const taskInput = document.getElementById("taskInput");
    const addBtn = document.getElementById("addBtn");
    const habitInput = document.getElementById("habitInput");
    const addHabitBtn = document.getElementById("addHabitBtn");

    // Declared early so cancelHabitFormBtn handler and frequency change handler can both use them
    const frequencySelect = document.getElementById("habitFrequency");
    const specificDaysContainer = document.getElementById("specificDaysContainer");

    // 🔥 Load saved theme
    const savedTheme = localStorage.getItem("theme") || "light";
    applyTheme(savedTheme);

    // 🔥 Theme toggle - Header button (Sun/Moon)
    const themeToggleBtn = document.getElementById("themeToggleBtn");
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener("click", () => {
            const isDark = document.body.classList.contains("light");
            applyTheme(isDark ? "dark" : "light");
        });
    }

    // 🔥 Theme toggle - Settings pill button (click row or pill to toggle)
    const profileThemeToggleBtn = document.getElementById("profileThemeToggleBtn");
    if (profileThemeToggleBtn) {
        const toggleTheme = () => {
            const isDark = document.body.classList.contains("light");
            applyTheme(isDark ? "dark" : "light");
        };
        profileThemeToggleBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleTheme(); });
        // Allow clicking the entire row to toggle
        const themeRow = profileThemeToggleBtn.closest('.settings-row');
        if (themeRow) themeRow.addEventListener("click", toggleTheme);
    }

    // 🔔 Notification toggle - Settings pill button (click row or pill to toggle)
    const notifToggleBtn = document.getElementById("notifToggleBtn");
    if (notifToggleBtn) {
        // Set initial state
        const notifEnabled = typeof AppReminders !== 'undefined' ? AppReminders.isEnabled() : true;
        notifToggleBtn.classList.toggle('notif-on', notifEnabled);

        const toggleNotif = () => {
            const isCurrentlyOn = notifToggleBtn.classList.contains('notif-on');
            const newState = !isCurrentlyOn;
            notifToggleBtn.classList.toggle('notif-on', newState);
            if (typeof AppReminders !== 'undefined') {
                AppReminders.toggleEnabled(newState);
            }
        };
        notifToggleBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleNotif(); });
        // Allow clicking the entire row to toggle
        const notifRow = notifToggleBtn.closest('.settings-row');
        if (notifRow) notifRow.addEventListener("click", toggleNotif);
    }

    const profileLogoutBtn = document.getElementById("logoutBtn");
    if (profileLogoutBtn) {
        profileLogoutBtn.addEventListener("click", () => {
            if (typeof firebase !== 'undefined' && firebase.auth) {
                firebase.auth().signOut().then(() => {
                    localStorage.removeItem("currentUser");
                    window.location.reload();
                });
            } else {
                localStorage.removeItem("currentUser");
                window.location.reload();
            }
        });
    }

    // 🔥 Profile Collapsible Sections
    const toggleHeaders = document.querySelectorAll(".toggle-section-header");
    toggleHeaders.forEach(header => {
        header.addEventListener("click", () => {
            const content = header.nextElementSibling;
            if (content && content.classList.contains("toggle-section-content")) {
                const isHidden = content.style.display === "none" || content.style.display === "";
                content.style.display = isHidden ? "block" : "none";

                // Toggle the chevron icon
                const chevron = header.querySelector(".chevron-icon");
                if (chevron) {
                    chevron.style.transform = isHidden ? "rotate(180deg)" : "rotate(0deg)";
                }

                // When collapsing Account section, auto-close password form
                if (!isHidden && content.id === 'accountSectionContent') {
                    const pwContainer = document.getElementById('changePasswordContainer');
                    if (pwContainer && !pwContainer.classList.contains('collapsed')) {
                        pwContainer.classList.add('collapsed');
                        const pwChevron = document.querySelector('#togglePasswordSectionBtn .chevron-icon');
                        if (pwChevron) {
                            pwChevron.style.transform = 'rotate(0deg)';
                            pwChevron.style.opacity = '0.5';
                        }
                        // Clear password fields
                        const ci = document.getElementById('currentPasswordInput');
                        const ni = document.getElementById('newPasswordInput');
                        const cfi = document.getElementById('confirmPasswordInput');
                        if (ci) { ci.value = ''; ci.type = 'password'; }
                        if (ni) { ni.value = ''; ni.type = 'password'; }
                        if (cfi) cfi.value = '';
                        const pe = document.getElementById('passwordChangeError');
                        const ps = document.getElementById('passwordChangeSuccess');
                        if (pe) pe.style.display = 'none';
                        if (ps) ps.style.display = 'none';
                    }
                }

                // When collapsing App Preferences, close Avatar & Accent sub-sections
                if (!isHidden && content.id === 'appPrefsSectionContent') {
                    const avatarContent = document.getElementById('avatarSectionContent');
                    const accentContent = document.getElementById('accentSectionContent');
                    [avatarContent, accentContent].forEach(sub => {
                        if (sub && sub.style.display !== 'none') {
                            sub.style.display = 'none';
                            const parentRow = sub.previousElementSibling;
                            if (parentRow) {
                                const ch = parentRow.querySelector('.chevron-icon');
                                if (ch) {
                                    ch.style.transform = 'rotate(0deg)';
                                    ch.style.opacity = '0.5';
                                }
                            }
                        }
                    });
                }
            }
        });
    });

    // 🔥 Sync Data Button with BackupSync integration
    const forceSyncBtn = document.getElementById("forceSyncBtn");
    if (forceSyncBtn) {
        forceSyncBtn.addEventListener("click", () => {
            if (!currentUserId) {
                if (typeof Notify !== 'undefined') Notify.warning('Please log in to sync your data to the cloud.');
                return;
            }

            if (typeof BackupSync !== 'undefined') {
                BackupSync.triggerSync(true);
            } else {
                // Fallback to old method
                forceSyncBtn.disabled = true;
                if (typeof uploadLocalDataToFirestore === 'function') {
                    uploadLocalDataToFirestore().then(() => {
                        if (typeof loadTasksFromFirestore !== 'undefined') loadTasksFromFirestore();
                        if (typeof loadHabitsFromFirestore !== 'undefined') loadHabitsFromFirestore();
                        forceSyncBtn.disabled = false;
                        if (typeof Notify !== 'undefined') Notify.success('Your data has been synced to the cloud.');
                    }).catch(err => {
                        console.error('Sync failed:', err);
                        forceSyncBtn.disabled = false;
                        if (typeof Notify !== 'undefined') Notify.error('Sync failed. Please try again.');
                    });
                } else {
                    forceSyncBtn.disabled = false;
                }
            }
        });
    }

    // Backup Now Button
    const backupNowBtn = document.getElementById("backupNowBtn");
    if (backupNowBtn) {
        backupNowBtn.addEventListener("click", () => {
            if (!currentUserId) {
                if (typeof Notify !== 'undefined') Notify.warning('Please log in to backup your data.');
                return;
            }

            if (typeof BackupSync !== 'undefined') {
                backupNowBtn.disabled = true;
                backupNowBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Backing up...</span>';
                
                BackupSync.createFullBackup(true).then(() => {
                    backupNowBtn.disabled = false;
                    backupNowBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> <span>Backup Now</span>';
                    BackupSync.updateStatusUI();
                }).catch(() => {
                    backupNowBtn.disabled = false;
                    backupNowBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> <span>Backup Now</span>';
                });
            }
        });
    }

    // Restore Data Button
    const restoreDataBtn = document.getElementById("restoreDataBtn");
    if (restoreDataBtn) {
        restoreDataBtn.addEventListener("click", () => {
            if (!currentUserId) {
                if (typeof Notify !== 'undefined') Notify.warning('Please log in to restore your data.');
                return;
            }

            // Show confirmation modal
            showRestoreConfirmationModal();
        });
    }

    // Toggle Backup Section
    const toggleBackupSectionBtn = document.getElementById("toggleBackupSectionBtn");
    const backupSectionContent = document.getElementById("backupSectionContent");
    if (toggleBackupSectionBtn && backupSectionContent) {
        toggleBackupSectionBtn.addEventListener("click", () => {
            const isExpanded = backupSectionContent.style.display !== 'none';
            backupSectionContent.style.display = isExpanded ? 'none' : 'block';
            
            const chevron = toggleBackupSectionBtn.querySelector('.chevron-icon');
            if (chevron) {
                chevron.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(90deg)';
            }

            // Update status UI when opened
            if (!isExpanded && typeof BackupSync !== 'undefined') {
                BackupSync.updateStatusUI();
            }
        });
    }

    // 🔥 Profile/Settings functionality
    const profileBtn = document.getElementById("profileBtn");
    const closeProfileBtn = document.getElementById("closeProfileBtn");

    if (profileBtn) {
        profileBtn.addEventListener("click", () => {
            // Save current tab before switching to settings
            if (activeTabName !== 'settings') {
                previousTabBeforeSettings = activeTabName;
            }
            // Switch to settings tab
            switchTab('settings');
            
            // Update sync status in settings tab
            if (window.syncStatusUI && window.syncManager) {
                const currentStatus = window.syncManager.getStatus ? window.syncManager.getStatus() : 'SYNCED';
                window.syncStatusUI.updateStatus(currentStatus);
            }
            
            // Refresh stats and UI
            if (typeof updateStats === 'function') updateStats();
            if (typeof renderProfileChart === 'function') renderProfileChart();
            if (typeof generateSmartInsights === 'function') generateSmartInsights();
            if (typeof XPSystem !== 'undefined') XPSystem.updateXPDisplay();
            if (typeof BadgeSystem !== 'undefined') BadgeSystem.renderBadgeGrid();
            if (typeof AvatarSystem !== 'undefined') AvatarSystem.renderAvatarPicker();
            
            // Refresh notification toggle state
            const nb = document.getElementById('notifToggleBtn');
            if (nb && typeof AppReminders !== 'undefined') {
                nb.classList.toggle('notif-on', AppReminders.isEnabled());
            }
        });
    }

    if (closeProfileBtn) {
        closeProfileBtn.addEventListener("click", () => {
            // Return to previous tab
            switchTab(previousTabBeforeSettings);
            // Reset collapsible sections to closed state
            resetProfileSections();
        });
    }

    // Close AI Coach tab back button
    const closeCoachBtn = document.getElementById("closeCoachBtn");
    if (closeCoachBtn) {
        closeCoachBtn.addEventListener("click", () => {
            // Return to previous tab (usually today/home)
            switchTab(previousTabBeforeSettings || 'today');
        });
    }

    // 🔥 Profile Stats Chart Toggle
    const statsTabs = document.querySelectorAll('.stats-tab-btn');
    statsTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            statsTabs.forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            activeProfileStat = btn.getAttribute('data-stat-type');
            if (typeof renderProfileChart === 'function') renderProfileChart();
        });
    });

    // 🔥 Profile Name Editing
    const editProfileNameBtn = document.getElementById("editProfileNameBtn");
    const saveProfileNameBtn = document.getElementById("saveProfileNameBtn");
    const cancelProfileNameBtn = document.getElementById("cancelProfileNameBtn");
    const profileNameText = document.getElementById("profileNameText");
    const profileNameInput = document.getElementById("profileNameInput");
    const profileNameActions = document.getElementById("profileNameActions");

    if (editProfileNameBtn && saveProfileNameBtn && cancelProfileNameBtn) {
        editProfileNameBtn.addEventListener("click", () => {
            profileNameText.style.display = "none";
            editProfileNameBtn.style.display = "none";
            profileNameInput.style.display = "block";
            profileNameActions.style.display = "flex";
            profileNameInput.value = profileNameText.textContent === "User Profile" || profileNameText.textContent === "Guest Account" ? "" : profileNameText.textContent;
            profileNameInput.focus();
        });

        const closeEditMode = () => {
            profileNameText.style.display = "block";
            editProfileNameBtn.style.display = "flex";
            profileNameInput.style.display = "none";
            profileNameActions.style.display = "none";
        };

        cancelProfileNameBtn.addEventListener("click", closeEditMode);

        saveProfileNameBtn.addEventListener("click", () => {
            let newName = profileNameInput.value.trim();
            if (!newName) {
                if (typeof Notify !== 'undefined') Notify.warning('Username cannot be empty'); else alert("Username cannot be empty");
                return;
            }

            // Capitalize the first letter of each word
            newName = newName.replace(/\b\w/g, char => char.toUpperCase());

            profileNameText.textContent = newName;
            closeEditMode();

            // Store in regular localStorage fallback
            let currentUser = safeJSONParse("currentUser", {});
            currentUser.displayName = newName;
            localStorage.setItem("currentUser", JSON.stringify(currentUser));

            // Update cache immediately so stats don't re-fetch old name
            cachedProfileName = newName;
            if (typeof firebase !== 'undefined' && firebase.auth().currentUser) {
                cachedProfileUserId = firebase.auth().currentUser.uid;
            }

            // Sync to Firestore immediately
            if (typeof firebase !== 'undefined' && currentUserId) {
                firebase.firestore().collection("users").doc(currentUserId).set({
                    profile: { username: newName }
                }, { merge: true }).then(() => {
                    console.log("Username updated in Firestore.");

                }).catch(err => {
                    console.error("Error updating username:", err);
                });
            }
        });
    }

    // 🔥 Add task with button or Enter key
    const taskOptions = document.getElementById("taskOptions");

    if (taskInput) {
        taskInput.addEventListener("focus", () => {
            clearInputError('task-error');
            if (taskOptions) taskOptions.classList.remove("collapsed");
        });
        taskInput.addEventListener("input", () => clearInputError('task-error'));
        taskInput.addEventListener("keypress", function (e) {
            if (e.key === "Enter") handleAddTask();
        });
    }

    if (addBtn) addBtn.addEventListener("click", handleAddTask);

    // 🔥 Cancel Task Form
    const cancelTaskFormBtn = document.getElementById("cancelTaskFormBtn");
    if (cancelTaskFormBtn) {
        cancelTaskFormBtn.addEventListener("click", () => {
            // Clear all task inputs
            if (taskInput) taskInput.value = "";
            const dueDateInput = document.getElementById("dueDate");
            const dueTimeInput = document.getElementById("dueTime");
            const prioritySelect = document.getElementById("taskPriority");
            if (dueDateInput) dueDateInput.value = "";
            if (dueTimeInput) dueTimeInput.value = "";
            if (prioritySelect) prioritySelect.value = "none";

            // Collapse the options panel
            if (taskOptions) taskOptions.classList.add("collapsed");

            // Blur the task input so it doesn't immediately re-expand
            if (taskInput) taskInput.blur();
        });
    }

    // 🔥 Add habit with button or Enter key
    const habitOptions = document.getElementById("habitOptions");

    if (habitInput) {
        habitInput.addEventListener("focus", () => {
            clearInputError('habit-error');
            if (habitOptions) habitOptions.classList.remove("collapsed");
        });
        habitInput.addEventListener("input", () => clearInputError('habit-error'));
        habitInput.addEventListener("keypress", function (e) {
            if (e.key === "Enter") handleAddHabit();
        });
    }

    if (addHabitBtn) addHabitBtn.addEventListener("click", handleAddHabit);

    // 🔥 Cancel Habit Form
    const cancelHabitFormBtn = document.getElementById("cancelHabitFormBtn");
    if (cancelHabitFormBtn) {
        cancelHabitFormBtn.addEventListener("click", () => {
            if (habitInput) habitInput.value = "";
            if (frequencySelect) frequencySelect.value = "daily";

            // Reset Reminders to single row
            const remindersContainer = document.getElementById("habitRemindersContainer");
            if (remindersContainer) {
                const rows = remindersContainer.querySelectorAll('.reminder-row');
                rows.forEach((row, idx) => {
                    if (idx === rows.length - 1) {
                        const input = row.querySelector('.habit-reminder-input');
                        if (input) input.value = "";
                        const addBtn = row.querySelector('#addReminderBtn');
                        if (addBtn) addBtn.disabled = false;
                    } else {
                        row.remove();
                    }
                });
            }

            // Reset specific days
            document.querySelectorAll('#specificDaysContainer input[type="checkbox"]').forEach(cb => cb.checked = false);
            const daysContainer = document.getElementById("specificDaysContainer");
            if (daysContainer) daysContainer.style.display = "none";

            if (habitOptions) habitOptions.classList.add("collapsed");
        });
    }

    if (frequencySelect && specificDaysContainer) {
        frequencySelect.addEventListener("change", function () {
            if (this.value === "specific_days") {
                specificDaysContainer.style.display = "flex";
            } else {
                specificDaysContainer.style.display = "none";
            }
        });
    }

    // 🔥 Auto-capitalize first letter for specific inputs (Task, Habit, Subject, Exam, Study Planner)
    function autoCapitalizeFirstLetter(inputElement) {
        if (!inputElement) return;
        inputElement.addEventListener('input', function () {
            const val = this.value;
            if (val.length === 1) {
                this.value = val.charAt(0).toUpperCase();
            } else if (val.length > 1 && val.charAt(0) !== val.charAt(0).toUpperCase()) {
                this.value = val.charAt(0).toUpperCase() + val.slice(1);
            }
        });
    }

    // Apply auto-capitalize to relevant inputs (exclude email/password)
    autoCapitalizeFirstLetter(document.getElementById('taskInput'));
    autoCapitalizeFirstLetter(document.getElementById('habitInput'));
    autoCapitalizeFirstLetter(document.getElementById('examNameInput'));

    // 🔥 Filter buttons
    const allFilter = document.getElementById("allFilter");
    const activeFilter = document.getElementById("activeFilter");
    const completedFilter = document.getElementById("completedFilter");

    [allFilter, activeFilter, completedFilter].forEach(btn => {
        if (!btn) return;
        btn.addEventListener("click", () => {
            document.querySelectorAll('.task-filters__btn').forEach(b => b.classList.remove('active', 'active-filter'));
            btn.classList.add('active', 'active-filter');
            const filterMap = { allFilter: 'all', activeFilter: 'active', completedFilter: 'completed' };
            filterTasks(filterMap[btn.id]);
        });
    });

    // 🔥 Tab switching
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabsIndicator = document.getElementById("tabsIndicator");

    const updateTabsIndicator = () => {
        if (!tabsIndicator) return;
        const activeBtn = document.querySelector(".tab-btn.active:not(.hidden-tab)");
        if (!activeBtn) {
            tabsIndicator.classList.remove("visible");
            return;
        }
        const navRect = activeBtn.parentElement.getBoundingClientRect();
        const btnRect = activeBtn.getBoundingClientRect();
        const left = btnRect.left - navRect.left;

        tabsIndicator.style.width = `${btnRect.width}px`;
        tabsIndicator.style.transform = `translateX(${left}px)`;
        tabsIndicator.classList.add("visible");
    };

    // Expose globally for TabManager
    window.updateTabsIndicator = updateTabsIndicator;

    tabButtons.forEach(btn => {
        btn.addEventListener("click", function () {
            const tabName = this.getAttribute("data-tab");
            switchTab(tabName);
            updateTabsIndicator();
        });
    });

    // Position indicator on initial load
    updateTabsIndicator();

    // 🔥 AI Habit Suggestions
    const aiHabitBtn = document.getElementById("aiHabitBtn");
    const aiSuggestionsContainer = document.getElementById("aiSuggestionsContainer");

    const smartHabitsList = [
        "Drink 2L of Water", "Meditate for 10 Min", "Read 10 Pages",
        "30 Min Exercise", "Write in Journal", "No Screens After 10PM",
        "Eat a Healthy Breakfast", "Stretch for 5 Min", "Learn a New Skill (15 Min)",
        "Review Daily Goals", "Review Flashcards", "Take a 15 Min Walk",
        "Write 3 Things I'm Grateful For", "Organize Desk", "Read Industry News",
        "Limit Social Media to 30 Min", "Go to Bed by 11 PM", "Wake Up at 7 AM",
        "Stretch Before Bed", "Pack Lunch the Night Before", "Call a Friend or Family Member",
        "Learn 3 New Vocabulary Words", "Practice a Second Language", "Listen to an Audiobook/Podcast",
        "Do 20 Pushups", "Do 50 Jumping Jacks", "10 Min Yoga",
        "Plan Out Tomorrow's Outfits", "Reply to 3 Important Emails", "Deep Work for 45 Mins",
        "Drink Green Tea", "Take Vitamins", "Track Daily Expenses",
        "Read 1 Chapter of a Book", "Review Class Notes", "Drink a Glass of Water on Waking Up",
        "Compliment 1 Person", "Do 10 Min of Deep Breathing", "Clean Room for 15 Min",
        "Write 1 Paragraph of a Creative Project", "No Sugar for 24 Hours", "Floss Teeth"
    ];

    if (aiHabitBtn && aiSuggestionsContainer) {
        aiHabitBtn.addEventListener("click", function () {
            // Prevent multiple clicks while generating
            if (aiHabitBtn.disabled) return;

            aiHabitBtn.disabled = true;
            aiHabitBtn.innerHTML = '<span class="clean-spinner"></span> Generating...';
            aiSuggestionsContainer.style.display = "flex";
            aiSuggestionsContainer.innerHTML = '<div class="ai-generating-text">Generating smart suggestions...</div>';

            // Simulate AI delay
            setTimeout(() => {
                // Restore Button
                aiHabitBtn.disabled = false;
                aiHabitBtn.innerHTML = '<span class="ai-icon"><i class="fa-solid fa-wand-magic-sparkles"></i></span> AI';

                // Generate 5 random unique suggestions
                const shuffled = [...smartHabitsList].sort(() => 0.5 - Math.random());
                const selectedSuggestions = shuffled.slice(0, 5);

                aiSuggestionsContainer.innerHTML = '';

                selectedSuggestions.forEach(habitText => {
                    const chip = document.createElement("div");
                    chip.className = "ai-suggestion-chip fade-in";
                    chip.textContent = "+ " + habitText;

                    chip.addEventListener("click", () => {
                        const hInput = document.getElementById("habitInput");
                        if (hInput) {
                            hInput.value = habitText;
                            // Focus the input to naturally expand the Custom Options form
                            hInput.focus();

                            // Highlight input to show it was populated
                            hInput.style.borderColor = "#a855f7";
                            hInput.style.boxShadow = "0 0 10px rgba(168, 85, 247, 0.3)";
                            setTimeout(() => {
                                hInput.style.borderColor = "";
                                hInput.style.boxShadow = "";
                            }, 800);
                        }
                    });

                    aiSuggestionsContainer.appendChild(chip);
                });

                // Add Cancel Button Wrapper
                const cancelWrapper = document.createElement("div");
                cancelWrapper.style.width = "100%";
                cancelWrapper.style.display = "flex";
                cancelWrapper.style.justifyContent = "flex-end";
                cancelWrapper.style.marginTop = "5px";

                const cancelBtn = document.createElement("button");
                cancelBtn.className = "cancel-ai-btn fade-in";
                cancelBtn.textContent = "Cancel";
                cancelBtn.addEventListener("click", () => {
                    aiSuggestionsContainer.innerHTML = '';
                    aiSuggestionsContainer.style.display = "none";
                });

                cancelWrapper.appendChild(cancelBtn);
                aiSuggestionsContainer.appendChild(cancelWrapper);

            }, 1200); // 1.2s delay for "AI generation" feel
        });
    }

    // Start checking for Habit Reminders
    setupReminders();

    // Habit reminder dynamic inputs
    const addReminderBtn = document.getElementById("addReminderBtn");
    const habitRemindersContainer = document.getElementById("habitRemindersContainer");

    if (addReminderBtn && habitRemindersContainer) {
        addReminderBtn.addEventListener("click", function () {
            const currentInputs = habitRemindersContainer.querySelectorAll('.habit-reminder-input');
            if (currentInputs.length >= 5) {
                return; // Silently return if limit handled by disabled state
            }

            const newRow = document.createElement("div");
            newRow.className = "reminder-row new-row"; // Add new-row class for animation if desired

            const newInput = document.createElement("input");
            newInput.type = "time";
            newInput.className = "habit-reminder-input priority-select";
            newInput.title = "Set Reminder Time";

            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.className = "small-btn delete-reminder-btn";
            deleteBtn.title = "Remove reminder";
            deleteBtn.textContent = "-";

            deleteBtn.addEventListener("click", function () {
                newRow.remove();
                // Check recount and re-enable the "+" button if dropped below 5
                const remainingInputs = habitRemindersContainer.querySelectorAll('.habit-reminder-input');
                if (remainingInputs.length < 5) {
                    addReminderBtn.disabled = false;
                }
            });

            newRow.appendChild(newInput);
            newRow.appendChild(deleteBtn);

            // Insert before the row containing the add button
            const addRow = addReminderBtn.closest('.reminder-row');
            habitRemindersContainer.insertBefore(newRow, addRow);

            // Check count immediately after appending: disable if 5 reached
            const newInputs = habitRemindersContainer.querySelectorAll('.habit-reminder-input');
            if (newInputs.length >= 5) {
                addReminderBtn.disabled = true;
            }
        });
    }

});


// Tab order — used to determine slide direction
const TAB_ORDER = ['today', 'tasks', 'habits', 'academics', 'mind', 'physical', 'analytics', 'settings'];
let activeTabName = 'today';    // tracks the currently visible tab
let previousTabBeforeSettings = 'today'; // tracks where to return from settings
let tabIsAnimating = false;     // guard against double-tap during animation

// Tab Switching
function switchTab(tabName) {
    if (tabName === activeTabName) return; // already here
    if (tabIsAnimating) return;           // mid-animation guard

    window.__tabMountState = window.__tabMountState || new Set();
    const tabMountState = window.__tabMountState;

    const appContainer = document.getElementById("appContainer");
    // Update nav button state immediately (feels responsive)
    document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
    const targetBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (targetBtn) targetBtn.classList.add("active");
    appContainer.classList.remove("calendar-view");

    const newTab = document.getElementById(tabName + "-tab");
    if (!newTab) return;

    const currentActiveTab = document.querySelector('.tab-content.active');
    const isLazyTab = ['analytics', 'ai-coach', 'calendar', 'academics'].includes(tabName);

    // Set animation guard
    tabIsAnimating = true;
    setTimeout(() => { tabIsAnimating = false; }, 350);

    function activateTabInstantly() {
        if (currentActiveTab && currentActiveTab !== newTab) {
            currentActiveTab.classList.remove('active');
            currentActiveTab.classList.remove('screen-slide-in');
            if (currentActiveTab.classList.contains('fade-section')) {
                currentActiveTab.classList.remove('is-visible');
            }
        }

        newTab.classList.add('active');
        newTab.style.visibility = 'visible';
        newTab.classList.remove('screen-slide-in');
        if (newTab.classList.contains('fade-section')) {
            newTab.classList.add('is-visible');
        }
    }

    activeTabName = tabName;
    newTab.scrollTop = 0;

    // Show/hide header based on tab
    const header = document.querySelector('.header');
    if (header) {
        if (tabName === 'settings') {
            header.classList.add('hide-for-settings');
        } else {
            header.classList.remove('hide-for-settings');
        }
    }

    // Show FAB only on home (today) tab and only if appContainer is visible
    const fabContainer = document.getElementById('fabContainer');
    if (fabContainer) {
        const appVisible = appContainer && appContainer.style.display !== 'none';
        fabContainer.style.display = (tabName === 'today' && appVisible) ? '' : 'none';
    }

    if (typeof updateTasksEmptyState === 'function') updateTasksEmptyState();
    if (typeof updateHabitsEmptyState === 'function') updateHabitsEmptyState();

    // ============================================================
    // LAZY LOADING: Initialize heavy systems only when needed
    // ============================================================

    if (tabName === 'today' && typeof TodayDashboard !== 'undefined' && !tabMountState.has('today')) {
        TodayDashboard.init();
        if (typeof TodayDashboard.refresh === 'function') TodayDashboard.refresh();
        tabMountState.add('today');
    }

    // Lazy load Analytics when switching to analytics tab
    if (tabName === 'analytics') {
        if (typeof StartupManager !== 'undefined' && typeof StartupManager.loadAnalytics === 'function') {
            StartupManager.loadAnalytics().then(() => {
                // Analytics is already initialized once; reuse the existing DOM
                // on later tab switches.
                if (!tabMountState.has('analytics') && typeof SmartAnalytics !== 'undefined' && typeof SmartAnalytics.refresh === 'function') {
                    SmartAnalytics.refresh();
                }
                tabMountState.add('analytics');
                activateTabInstantly();
            });
        } else if (typeof SmartAnalytics !== 'undefined') {
            if (!tabMountState.has('analytics')) {
                SmartAnalytics.init();
                SmartAnalytics.refresh();
                tabMountState.add('analytics');
            }
            activateTabInstantly();
        }
    }

    // Lazy load AI Coach when switching to ai-coach tab
    if (tabName === 'ai-coach') {
        if (typeof StartupManager !== 'undefined' && typeof StartupManager.loadAICoach === 'function') {
            StartupManager.loadAICoach().then(() => {
                // Reuse the existing dashboard DOM if it is already mounted.
                // Only render once when the container is empty.
                const coachContainer = document.getElementById('aiCoachDashboard');
                const shouldRender = coachContainer && !coachContainer.children.length;
                if (shouldRender && typeof CoachUIRenderer !== 'undefined' && typeof CoachUIRenderer.renderDashboard === 'function') {
                    CoachUIRenderer.renderDashboard();
                }
                tabMountState.add('ai-coach');
                activateTabInstantly();
            });
        } else if (typeof CoachUIRenderer !== 'undefined') {
            // Fallback if StartupManager not available
            const coachContainer = document.getElementById('aiCoachDashboard');
            if (coachContainer && !coachContainer.children.length) {
                CoachUIRenderer.renderDashboard();
            }
            tabMountState.add('ai-coach');
            activateTabInstantly();
        }
    }

    // Lazy load Calendar when switching to calendar tab
    if (tabName === 'calendar') {
        if (typeof StartupManager !== 'undefined' && typeof StartupManager.loadCalendar === 'function') {
            StartupManager.loadCalendar().then(() => {
                tabMountState.add('calendar');
                activateTabInstantly();
            });
        } else {
            tabMountState.add('calendar');
            activateTabInstantly();
        }
    }

    // Lazy load Scheduler when switching to academics tab
    if (tabName === 'academics') {
        if (typeof StartupManager !== 'undefined' && typeof StartupManager.loadScheduler === 'function') {
            StartupManager.loadScheduler().then(() => {
                // Scheduler is already initialized by loadScheduler, just render UI
                if (!tabMountState.has('academics') && typeof renderStudyPlanner === 'function') {
                    renderStudyPlanner();
                    renderExams();
                    renderFocusStats();
                    populateSubjectSelects();
                }
                tabMountState.add('academics');
                activateTabInstantly();
            });
        } else if (typeof renderStudyPlanner === 'function') {
            // Fallback if StartupManager not available
            if (!tabMountState.has('academics')) {
                renderStudyPlanner();
                renderExams();
                renderFocusStats();
                populateSubjectSelects();
                tabMountState.add('academics');
            }
            activateTabInstantly();
        }
    }

    // Non-lazy tabs show immediately with transition
    if (!isLazyTab) {
        activateTabInstantly();
    }

    if (tabName === 'physical' && typeof PhysicalTab !== 'undefined') {
        PhysicalTab.init();
    }
}

// Helper function for consistent tab animation
function showTabWithAnimation(tab) {
    requestAnimationFrame(() => {
        tab.style.visibility = 'visible';
        if (tab.classList.contains("fade-section")) {
            tab.classList.add("is-visible");
        }
        tab.classList.add('screen-slide-in');
        setTimeout(() => tab.classList.remove('screen-slide-in'), 350);
    });
}

// ===== Inline Validation Helpers =====
function showInputError(inputEl, errorId, message) {
    const err = document.getElementById(errorId);
    if (err) {
        err.textContent = message;
        err.style.display = 'block';
    }
    inputEl.classList.add('input-error');
}
function clearInputError(errorId) {
    const err = document.getElementById(errorId);
    if (err) err.style.display = 'none';
    if (errorId === 'task-error') {
        const el = document.getElementById('taskInput');
        if (el) el.classList.remove('input-error');
    }
    if (errorId === 'habit-error') {
        const el = document.getElementById('habitInput');
        if (el) el.classList.remove('input-error');
    }
}

// ===== RESTORE CONFIRMATION MODAL =====

function showRestoreConfirmationModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay restore-confirm-modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-box" style="max-width: 450px;">
            <div style="text-align: center;">
                <div style="width: 80px; height: 80px; margin: 0 auto 20px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 36px;">
                    <i class="fa-solid fa-cloud-arrow-down"></i>
                </div>
                <h3 style="margin-bottom: 16px;">Restore Cloud Backup?</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">This will download your latest cloud backup and replace all current data.</p>
                
                <div class="restore-warning">
                    <p><i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px;"></i> This will replace your current data with the cloud backup.</p>
                </div>
                
                <div class="modal-actions" style="gap: 12px; margin-top: 24px;">
                    <button class="auth-btn secondary-btn" onclick="document.querySelector('.restore-confirm-modal').remove()">Cancel</button>
                    <button class="auth-btn" onclick="confirmRestore()">Restore Data</button>
                </div>
            </div>
        </div>
    `;
    modal.id = 'restoreConfirmModal';
    document.body.appendChild(modal);
}

function confirmRestore() {
    const modal = document.getElementById('restoreConfirmModal');
    if (modal) modal.remove();
    
    if (typeof BackupSync !== 'undefined') {
        BackupSync.restoreFromBackup();
    }
}

// Make confirmRestore globally accessible for onclick handler
window.confirmRestore = confirmRestore;

// Add new habit wrapper
function handleAddHabit() {
    const input = document.getElementById("habitInput");
    const frequencySelect = document.getElementById("habitFrequency");

    let habitName = input.value.trim();
    if (!habitName) {
        showInputError(input, 'habit-error', 'Please enter a habit');
        return;
    }
    clearInputError('habit-error');

    habitName = habitName.replace(/\b\w/g, char => char.toUpperCase());

    const frequency = frequencySelect ? frequencySelect.value : "daily";
    let targetDays = [];

    if (frequency === "specific_days") {
        const checkboxes = document.querySelectorAll('#specificDaysContainer input[type="checkbox"]:checked');
        checkboxes.forEach(cb => targetDays.push(cb.value));

        if (targetDays.length === 0) {
            if (typeof Notify !== 'undefined') Notify.warning('Please select at least one day for your habit.'); else alert("Please select at least one day for your habit.");
            return;
        }
    }

    // Collect all valid reminder times from the inputs
    const reminderTimeInputs = document.querySelectorAll("#habitRemindersContainer .habit-reminder-input");
    const reminderTimes = [];

    reminderTimeInputs.forEach(input => {
        if (input.value) {
            reminderTimes.push(input.value);
        }
    });

    if (reminderTimes.length > 0) {
        // Request notification permission if a reminder is set safely for Mobile/Capacitor
        if (typeof window !== 'undefined' && "Notification" in window) {
            try {
                if (Notification.permission !== "granted" && Notification.permission !== "denied") {
                    Notification.requestPermission().catch(e => console.warn("Notifications auto-denied by WebView", e));
                }
            } catch (err) {
                console.warn("Notification API blocked or unsupported in this environment:", err);
            }
        }
    }

    const newHabit = {
        id: Date.now().toString(),
        name: habitName,
        streak: 0,
        history: [],
        frequency: frequency,
        targetDays: targetDays,
        reminderTime: reminderTimes,
        createdDate: new Date().toISOString().split('T')[0]
    };

    createHabitElement(newHabit);
    saveHabit(newHabit); // Call to data.js
    if (typeof Notify !== 'undefined') Notify.success('"' + habitName + '" added to your habits!', { title: 'Habit Created' });

    // Reschedule habit notifications to include the new habit
    if (typeof AppReminders !== 'undefined') AppReminders.scheduleAllHabits();

    // Reset Form
    input.value = "";
    if (frequencySelect) frequencySelect.value = "daily";

    // Reset reminders UI back to 1 input
    const container = document.getElementById("habitRemindersContainer");
    if (container) {
        const rows = container.querySelectorAll('.reminder-row');
        // Keep the first one, clear its value. Remove others.
        rows.forEach((row, idx) => {
            if (idx === rows.length - 1) {
                // This is the last row containing the '+' button and the initial input
                const input = row.querySelector('.habit-reminder-input');
                if (input) input.value = "";

                // Ensure the add button is re-enabled for the next habit
                const addBtn = row.querySelector('#addReminderBtn');
                if (addBtn) addBtn.disabled = false;
            } else {
                row.remove();
            }
        });
    }

    document.querySelectorAll('#specificDaysContainer input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.getElementById("specificDaysContainer").style.display = "none";

    // Collapse options after insert matching Task Logic
    const habitOptions = document.getElementById("habitOptions");
    if (habitOptions) habitOptions.classList.add("collapsed");
}

// Add new task wrapper (Enhanced with subtasks and recurrence)
function handleAddTask() {
    const input = document.getElementById("taskInput");
    const dueDateInput = document.getElementById("dueDate");
    const dueTimeInput = document.getElementById("dueTime");
    const prioritySelect = document.getElementById("taskPriority");
    const subjectSelect = document.getElementById("taskSubjectSelect");
    const recurrenceSelect = document.getElementById("taskRecurrence");
    const subtaskInput = document.getElementById("initialSubtasks");

    let taskText = input.value.trim();
    if (!taskText) {
        showInputError(input, 'task-error', 'Please enter a task');
        return;
    }
    clearInputError('task-error');

    taskText = taskText.replace(/\b\w/g, char => char.toUpperCase());
    const taskId = Date.now().toString();
    const dueDate = dueDateInput ? dueDateInput.value : null;
    const dueTime = dueTimeInput && dueTimeInput.value ? dueTimeInput.value : null;
    const priority = prioritySelect && prioritySelect.value !== "none" && prioritySelect.value !== "" ? prioritySelect.value : null;
    const subjectId = subjectSelect && subjectSelect.value ? subjectSelect.value : null;
    const recurrence = recurrenceSelect && recurrenceSelect.value && recurrenceSelect.value !== "none" ? recurrenceSelect.value : null;

    // Parse initial subtasks (comma-separated)
    let subtasks = [];
    if (subtaskInput && subtaskInput.value.trim()) {
        const subtaskTexts = subtaskInput.value.split(',').map(s => s.trim()).filter(s => s);
        subtasks = subtaskTexts.map(text => ({
            id: typeof generateSubtaskId === 'function' ? generateSubtaskId() : Date.now().toString() + Math.random().toString(36).slice(2, 5),
            text: text.charAt(0).toUpperCase() + text.slice(1),
            completed: false
        }));
    }

    createTaskElement(taskText, taskId, false, dueDate, dueTime, priority, subjectId, subtasks, recurrence);
    saveTask(taskText, taskId, false, dueDate, dueTime, priority, subjectId, subtasks, recurrence);
    if (typeof Notify !== 'undefined') Notify.success('"' + taskText + '" added to your tasks!', { title: 'Task Added' });

    // Schedule local notifications for the new task
    if (typeof AppReminders !== 'undefined' && dueDate) {
        AppReminders.scheduleTaskReminder({ id: taskId, text: taskText, dueDate, dueTime, completed: false });
    }

    // Reset form
    input.value = "";
    if (dueDateInput) dueDateInput.value = "";
    if (dueTimeInput) dueTimeInput.value = "";
    if (prioritySelect) prioritySelect.value = "";
    if (subjectSelect) subjectSelect.value = "";
    if (recurrenceSelect) recurrenceSelect.value = "none";
    if (subtaskInput) subtaskInput.value = "";

    const taskOptions = document.getElementById("taskOptions");
    if (taskOptions) taskOptions.classList.add("collapsed");

    updateCounter();
    sortTasks();
    if (typeof updateTasksEmptyState === 'function') updateTasksEmptyState();
}

// Create task element DOM (Enhanced with subtasks, recurrence, countdown)
function createTaskElement(taskText, taskId, isCompleted, dueDate = null, dueTime = null, priority = null, subjectId = null, subtasks = [], recurrence = null) {
    const li = document.createElement("li");
    li.setAttribute("data-id", taskId);
    li.setAttribute("data-due-date", dueDate || "");
    li.setAttribute("data-due-time", dueTime || "");
    li.setAttribute("data-priority", priority || "");
    li.setAttribute("data-subject-id", subjectId || "");
    li.setAttribute("data-recurrence", recurrence || "");
    li.draggable = true;

    if (isCompleted) li.classList.add("completed");

    // Calculate countdown status
    let countdownInfo = { text: '', status: 'none' };
    if (dueDate && !isCompleted && typeof calculateCountdown === 'function') {
        countdownInfo = calculateCountdown(dueDate, dueTime);
        if (countdownInfo.status === 'overdue') li.classList.add("overdue");
        else if (countdownInfo.status === 'today') li.classList.add("due-today");
        else if (countdownInfo.status === 'upcoming') li.classList.add("due-soon");
    } else if (dueDate && !isCompleted) {
        // Fallback if taskUtils not loaded
        const today = new Date().toISOString().split('T')[0];
        if (dueDate < today) li.classList.add("overdue");
        else if (dueDate === today) li.classList.add("due-today");
    }

    // Main task content wrapper
    const taskContent = document.createElement("div");
    taskContent.className = "task-content";

    // Left content (checkbox area + text)
    const leftContent = document.createElement("div");
    leftContent.className = "task-left";

    // Task text
    const span = document.createElement("span");
    span.className = "task-text";
    span.textContent = taskText;

    span.addEventListener("click", () => {
        if (!li.classList.contains("completed")) {
            li.classList.add("bouncing");
            setTimeout(() => li.classList.remove("bouncing"), 600);
        }
        li.classList.toggle("completed");
        li.classList.remove("overdue", "due-today", "due-soon");
        updateTaskCompletion(taskId);
        updateCounter();

        // Handle recurring task
        if (li.classList.contains("completed") && recurrence && typeof handleRecurringTaskCompletion === 'function') {
            handleRecurringTaskCompletion(taskId);
        }

        // --- Premium XP & Badge hooks ---
        if (li.classList.contains("completed")) {
            if (typeof XPSystem !== 'undefined') XPSystem.onTaskComplete(taskId);
            if (typeof BadgeSystem !== 'undefined') BadgeSystem.checkTaskBadges();
            // Premium completion animation
            if (typeof PremiumInteractions !== 'undefined') {
                PremiumInteractions.animateTaskCompletion(li, 10);
            }
        }

        setTimeout(() => reorderCompletedToBottom('#taskList', 'li'), 50);
    });

    // Apply priority color class
    if (priority) {
        li.classList.add(`priority-${priority}`);
    }

    leftContent.appendChild(span);

    // Metadata row (date, countdown, badges)
    const metaRow = document.createElement("div");
    metaRow.className = "task-meta";

    // Subject badge
    if (subjectId && typeof getSubjectById === 'function') {
        const subject = getSubjectById(subjectId);
        if (subject) {
            const subjectBadge = document.createElement("span");
            subjectBadge.className = "task-subject-badge";
            subjectBadge.textContent = subject.name;
            subjectBadge.style.backgroundColor = subject.color + '20';
            subjectBadge.style.color = subject.color;
            metaRow.appendChild(subjectBadge);
        }
    }

    // Priority badge
    if (priority && typeof getPriorityInfo === 'function') {
        const prioInfo = getPriorityInfo(priority);
        if (prioInfo.label) {
            const prioBadge = document.createElement("span");
            prioBadge.className = "task-priority-badge";
            prioBadge.textContent = prioInfo.label;
            prioBadge.style.backgroundColor = prioInfo.color + '20';
            prioBadge.style.color = prioInfo.color;
            metaRow.appendChild(prioBadge);
        }
    }

    // Date/Time + Countdown Display
    if (dueDate) {
        const dateDisplay = document.createElement("span");
        dateDisplay.className = "task-due-date";

        let dateText = "";
        const dateObj = new Date(dueDate + "T00:00:00");
        dateText = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });

        if (dueTime) {
            const [hours, minutes] = dueTime.split(':');
            let h = parseInt(hours, 10);
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            dateText += ` • ${h}:${minutes} ${ampm}`;
        }

        dateDisplay.textContent = dateText;
        metaRow.appendChild(dateDisplay);

        // Countdown badge
        if (countdownInfo.text && !isCompleted) {
            const countdownBadge = document.createElement("span");
            countdownBadge.className = `task-countdown ${countdownInfo.status}`;
            countdownBadge.textContent = countdownInfo.text;
            metaRow.appendChild(countdownBadge);
        }
    }

    // Recurrence badge
    if (recurrence && typeof getRecurrenceLabel === 'function') {
        const recLabel = getRecurrenceLabel(recurrence);
        if (recLabel) {
            const recBadge = document.createElement("span");
            recBadge.className = "task-recurrence-badge";
            recBadge.textContent = recLabel;
            metaRow.appendChild(recBadge);
        }
    }

    taskContent.appendChild(leftContent);
    if (metaRow.children.length > 0) {
        taskContent.appendChild(metaRow);
    }

    // Subtasks section
    let subtasksContainer = null;
    if (subtasks && subtasks.length > 0) {
        subtasksContainer = createSubtasksSection(taskId, subtasks, li);
    }



    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "X";
    deleteBtn.className = "delete-btn";
    deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        showDeleteModal(() => {
            li.classList.add("deleting");
            setTimeout(() => {
                li.remove();
                removeTask(taskId);
                updateCounter();
            }, 300);
        });
    });

    // Expand/collapse subtasks button (if has subtasks)
    let expandBtn = null;
    if (subtasks && subtasks.length > 0) {
        expandBtn = document.createElement("button");
        expandBtn.className = "subtask-expand-btn";
        expandBtn.innerHTML = `<span class="subtask-count">${subtasks.filter(s => s.completed).length}/${subtasks.length}</span> ▾`;
        expandBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            li.classList.toggle("subtasks-expanded");
            expandBtn.innerHTML = li.classList.contains("subtasks-expanded")
                ? `<span class="subtask-count">${subtasks.filter(s => s.completed).length}/${subtasks.length}</span> ▴`
                : `<span class="subtask-count">${subtasks.filter(s => s.completed).length}/${subtasks.length}</span> ▾`;
        });
    }

    // Drag events
    li.addEventListener("dragstart", (e) => {
        e.dataTransfer.effectAllowed = "move";
        draggedTaskElement = li;
        li.style.opacity = "0.5";
    });

    li.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        li.style.borderTop = "3px solid #A56955";
    });

    li.addEventListener("dragleave", () => li.style.borderTop = "none");

    li.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        li.style.borderTop = "none";

        if (draggedTaskElement && draggedTaskElement !== li) {
            li.parentNode.insertBefore(draggedTaskElement, li);
            saveTaskOrder();
        }
    });

    li.addEventListener("dragend", () => {
        if (draggedTaskElement) draggedTaskElement.style.opacity = "1";
        draggedTaskElement = null;
        document.querySelectorAll("#taskList li").forEach(item => {
            item.style.opacity = "1";
            item.style.borderTop = "none";
        });
    });

    const buttonContainer = document.createElement("div");
    buttonContainer.className = "task-buttons";
    if (expandBtn) buttonContainer.appendChild(expandBtn);
    buttonContainer.appendChild(deleteBtn);

    li.appendChild(taskContent);
    li.appendChild(buttonContainer);

    // Add subtasks container at the end (expandable)
    if (subtasksContainer) {
        li.appendChild(subtasksContainer);
    }

    const taskList = document.getElementById("taskList");
    if (taskList) taskList.appendChild(li);
    if (typeof updateTasksEmptyState === 'function') updateTasksEmptyState();
}

// Create subtasks section for a task
function createSubtasksSection(taskId, subtasks, parentLi) {
    const container = document.createElement("div");
    container.className = "subtasks-container";

    // Progress bar
    const progress = typeof calculateSubtaskProgress === 'function'
        ? calculateSubtaskProgress(subtasks)
        : 0;

    const progressBar = document.createElement("div");
    progressBar.className = "subtask-progress";
    progressBar.innerHTML = `
        <div class="subtask-progress-bar">
            <div class="subtask-progress-fill" style="width: ${progress}%"></div>
        </div>
        <span class="subtask-progress-text">${progress}%</span>
    `;
    container.appendChild(progressBar);

    // Subtask list
    const subtaskList = document.createElement("ul");
    subtaskList.className = "subtask-list";

    subtasks.forEach(subtask => {
        const stLi = document.createElement("li");
        stLi.className = "subtask-item" + (subtask.completed ? " completed" : "");
        stLi.setAttribute("data-subtask-id", subtask.id);

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "subtask-checkbox";
        checkbox.checked = subtask.completed;
        checkbox.addEventListener("change", () => {
            subtask.completed = checkbox.checked;
            stLi.classList.toggle("completed", subtask.completed);
            updateSubtaskInTask(taskId, subtasks, parentLi);
        });

        const label = document.createElement("span");
        label.className = "subtask-text";
        label.textContent = subtask.text;

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "subtask-delete";
        deleteBtn.textContent = "×";
        deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const idx = subtasks.findIndex(s => s.id === subtask.id);
            if (idx > -1) {
                subtasks.splice(idx, 1);
                stLi.remove();
                updateSubtaskInTask(taskId, subtasks, parentLi);
            }
        });

        stLi.appendChild(checkbox);
        stLi.appendChild(label);
        stLi.appendChild(deleteBtn);
        subtaskList.appendChild(stLi);
    });

    container.appendChild(subtaskList);

    // Add subtask input
    const addSubtaskRow = document.createElement("div");
    addSubtaskRow.className = "add-subtask-row";
    addSubtaskRow.innerHTML = `
        <input type="text" class="add-subtask-input" placeholder="Add subtask...">
        <button class="add-subtask-btn">+</button>
    `;

    const input = addSubtaskRow.querySelector(".add-subtask-input");
    const addBtn = addSubtaskRow.querySelector(".add-subtask-btn");

    const addNewSubtask = () => {
        const text = input.value.trim();
        if (!text) return;

        const newSubtask = {
            id: typeof generateSubtaskId === 'function' ? generateSubtaskId() : Date.now().toString(),
            text: text,
            completed: false
        };
        subtasks.push(newSubtask);

        // Add to UI
        const stLi = document.createElement("li");
        stLi.className = "subtask-item";
        stLi.setAttribute("data-subtask-id", newSubtask.id);

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "subtask-checkbox";
        checkbox.addEventListener("change", () => {
            newSubtask.completed = checkbox.checked;
            stLi.classList.toggle("completed", newSubtask.completed);
            updateSubtaskInTask(taskId, subtasks, parentLi);
        });

        const label = document.createElement("span");
        label.className = "subtask-text";
        label.textContent = newSubtask.text;

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "subtask-delete";
        deleteBtn.textContent = "×";
        deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const idx = subtasks.findIndex(s => s.id === newSubtask.id);
            if (idx > -1) {
                subtasks.splice(idx, 1);
                stLi.remove();
                updateSubtaskInTask(taskId, subtasks, parentLi);
            }
        });

        stLi.appendChild(checkbox);
        stLi.appendChild(label);
        stLi.appendChild(deleteBtn);
        subtaskList.appendChild(stLi);

        input.value = "";
        updateSubtaskInTask(taskId, subtasks, parentLi);
    };

    addBtn.addEventListener("click", addNewSubtask);
    input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") addNewSubtask();
    });

    container.appendChild(addSubtaskRow);

    return container;
}

// Update subtask progress and save
function updateSubtaskInTask(taskId, subtasks, parentLi) {
    // Update progress bar
    const progress = typeof calculateSubtaskProgress === 'function'
        ? calculateSubtaskProgress(subtasks)
        : 0;

    const progressFill = parentLi.querySelector(".subtask-progress-fill");
    const progressText = parentLi.querySelector(".subtask-progress-text");
    if (progressFill) progressFill.style.width = `${progress}%`;
    if (progressText) progressText.textContent = `${progress}%`;

    // Update expand button count
    const expandBtn = parentLi.querySelector(".subtask-expand-btn");
    if (expandBtn) {
        const completed = subtasks.filter(s => s.completed).length;
        const icon = parentLi.classList.contains("subtasks-expanded") ? "▴" : "▾";
        expandBtn.innerHTML = `<span class="subtask-count">${completed}/${subtasks.length}</span> ${icon}`;
    }

    // Save to storage
    if (typeof updateTaskSubtasks === 'function') {
        updateTaskSubtasks(taskId, subtasks);
    }

    // Auto-complete main task if all subtasks done
    if (subtasks.length > 0 && typeof allSubtasksCompleted === 'function' && allSubtasksCompleted(subtasks)) {
        if (!parentLi.classList.contains("completed")) {
            // Optionally auto-complete - for now just show visual indicator
            parentLi.classList.add("all-subtasks-done");
        }
    } else {
        parentLi.classList.remove("all-subtasks-done");
    }
}

function enableEditMode(li, span, taskId, dueDate = null, dueTime = null, priority = null) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "edit-input";
    input.value = span.textContent;

    span.replaceWith(input);
    input.focus();
    input.select();

    input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") saveEdit(li, input, span, taskId, dueDate, dueTime, priority);
    });
    input.addEventListener("blur", () => saveEdit(li, input, span, taskId, dueDate, dueTime, priority));
}

function saveEdit(li, input, span, taskId, dueDate = null, dueTime = null, priority = null) {
    let newText = input.value.trim();
    if (!newText) {
        input.replaceWith(span);
        return;
    }
    newText = newText.replace(/\b\w/g, char => char.toUpperCase());
    span.textContent = newText;
    input.replaceWith(span);
    updateTaskText(taskId, newText); // Call to data.js
}

// Helper: moves completed items to the bottom of a list without a full reload
function reorderCompletedToBottom(listSelector, itemSelector) {
    const list = document.querySelector(listSelector);
    if (!list) return;
    const items = Array.from(list.querySelectorAll(itemSelector));
    // Sort: active first, completed last
    const active = items.filter(el => !el.classList.contains('completed'));
    const done = items.filter(el => el.classList.contains('completed'));
    [...active, ...done].forEach(el => list.appendChild(el));
}

function sortTasks() {
    const taskList = document.getElementById("taskList");
    if (!taskList) return;

    const tasks = Array.from(taskList.querySelectorAll("li"));
    tasks.sort((a, b) => {
        const dueDateA = a.getAttribute("data-due-date") || "9999-12-31";
        const dueDateB = b.getAttribute("data-due-date") || "9999-12-31";
        const isCompletedA = a.classList.contains("completed");
        const isCompletedB = b.classList.contains("completed");

        if (isCompletedA && !isCompletedB) return 1;
        if (!isCompletedA && isCompletedB) return -1;
        return dueDateA.localeCompare(dueDateB);
    });

    tasks.forEach(task => taskList.appendChild(task));
}

// Stats & Counters
function updateCounter() {
    const total = document.querySelectorAll("#taskList li").length;
    const done = document.querySelectorAll("#taskList li.completed").length;
    const remaining = total - done;

    const counter = document.getElementById("taskCounter");
    if (counter) counter.textContent = `${remaining} Task${remaining !== 1 ? "s" : ""} Remaining`;

    const progBar = document.getElementById("progressBar");
    if (progBar) {
        const progress = total === 0 ? 0 : (done / total) * 100;
        progBar.style.width = progress + "%";

        const progText = document.getElementById("progressText");
        if (progText) progText.textContent = Math.round(progress) + "%";
    }

    // Only celebrate once per completion event, not on every sync/reload
    if (total > 0 && done === total && !hasJustCelebrated) {
        hasJustCelebrated = true;
        celebrate();
    } else if (done < total) {
        hasJustCelebrated = false; // Reset once a task is pending again
    }

    if (typeof updateTasksEmptyState === 'function') updateTasksEmptyState();
}

function celebrate() {
    // Minimal confetti celebration
    if (typeof confetti !== "undefined") {
        confetti({ particleCount: 30, spread: 40, origin: { y: 0.6 }, ticks: 100 });
    }
}

function filterTasks(filter) {
    document.querySelectorAll("#taskList li").forEach(task => {
        if (filter === "all") task.style.display = "flex";
        else if (filter === "active") task.style.display = task.classList.contains("completed") ? "none" : "flex";
        else if (filter === "completed") task.style.display = task.classList.contains("completed") ? "flex" : "none";
    });

    if (typeof updateTasksEmptyState === 'function') updateTasksEmptyState();
}

// Habit DOM

// Helper: Convert 24-hour time to 12-hour format (e.g., "14:30" → "2:30 PM")
function formatTimeTo12Hour(time24) {
    if (!time24 || typeof time24 !== 'string') return time24;
    const [hourStr, minStr] = time24.split(':');
    let hour = parseInt(hourStr, 10);
    const min = minStr || '00';
    if (isNaN(hour)) return time24;
    const period = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12; // Convert 0 to 12, 13 to 1, etc.
    return `${hour}:${min} ${period}`;
}

function createHabitElement(habit) {
    // Check if habit element already exists to prevent duplicates
    const habitList = document.getElementById("habitList");
    if (habitList) {
        const existingHabit = habitList.querySelector(`[data-id="${habit.id}"]`);
        if (existingHabit) {
            // Update existing habit instead of creating duplicate
            updateHabitElement(existingHabit, habit);
            return;
        }
    }
    
    const li = document.createElement("li");
    li.className = "habit-item";
    li.setAttribute("data-id", habit.id);

    const infoDiv = document.createElement("div");
    infoDiv.className = "habit-info";

    const nameSpan = document.createElement("span");
    nameSpan.className = "habit-name";
    nameSpan.textContent = habit.name;

    const detailsSpan = document.createElement("span");
    detailsSpan.className = "habit-streak";
    detailsSpan.setAttribute("data-streak", habit.streak);

    const fireIcon = document.createElement('i');
    fireIcon.className = 'fa-solid fa-fire';
    fireIcon.style.color = '#ff9800';
    detailsSpan.appendChild(fireIcon);
    detailsSpan.appendChild(document.createTextNode(` ${habit.streak} day${habit.streak !== 1 ? "s" : ""}`));
    if (habit.reminderTime) {
        let reminderText = '';
        if (Array.isArray(habit.reminderTime) && habit.reminderTime.length > 0) {
            const formattedTimes = habit.reminderTime.map(t => formatTimeTo12Hour(t));
            reminderText = formattedTimes.join(', ');
        } else if (typeof habit.reminderTime === 'string') {
            reminderText = formatTimeTo12Hour(habit.reminderTime);
        }
        if (reminderText) {
            detailsSpan.appendChild(document.createTextNode(' | '));
            const bellIcon = document.createElement('i');
            bellIcon.className = 'fa-solid fa-bell';
            bellIcon.style.color = 'var(--accent-color)';
            bellIcon.style.fontSize = '0.85em';
            detailsSpan.appendChild(bellIcon);
            detailsSpan.appendChild(document.createTextNode(` ${reminderText}`));
        }
    }

    // 7-day Grid
    const gridDiv = document.createElement("div");
    gridDiv.className = "habit-grid";

    const todayObj = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(todayObj);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];

        const box = document.createElement("div");
        box.className = "grid-box";
        box.dataset.date = dateStr;

        // Get the first letter of the day (e.g., 'S', 'M', 'T')
        const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        const dayLetter = dayNames[d.getDay()];

        if (habit.history && habit.history.includes(dateStr)) {
            box.classList.add("done");
        } else {
            // Only show the letter if it's not done to keep it clean, or show it always based on preference
            box.textContent = dayLetter;
        }

        // Show actual date on hover
        box.title = dateStr;
        gridDiv.appendChild(box);
    }

    infoDiv.appendChild(nameSpan);
    infoDiv.appendChild(detailsSpan);
    infoDiv.appendChild(gridDiv);

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "habit-actions";

    const checkBtn = document.createElement("button");
    checkBtn.className = "habit-complete-btn";
    const today = new Date().toISOString().split('T')[0];

    if (habit.history && habit.history.includes(today)) {
        checkBtn.classList.add("done");
        li.classList.add("completed");
        checkBtn.textContent = "✓";
    } else {
        checkBtn.textContent = "✓";
    }

    checkBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        checkBtn.style.animation = "none";
        setTimeout(() => {
            checkBtn.style.animation = "buttonPress 0.2s ease";
            setTimeout(() => checkBtn.style.animation = "", 200);
        }, 10);
        completeHabitUI(habit, li, checkBtn);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "habit-delete-btn";
    deleteBtn.textContent = "X";
    deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        showDeleteModal(() => {
            li.classList.add("deleting");
            setTimeout(() => {
                li.remove();
                deleteHabit(habit.id); // Call to data.js
            }, 300);
        });
    });

    actionsDiv.appendChild(checkBtn);
    actionsDiv.appendChild(deleteBtn);

    li.appendChild(infoDiv);
    li.appendChild(actionsDiv);

    // Reuse habitList already declared at the start of this function
    if (habitList) habitList.appendChild(li);
    if (typeof updateHabitsEmptyState === 'function') updateHabitsEmptyState();
}

function updateHabitElement(existingElement, habit) {
    // Update the existing habit element with new data
    const nameSpan = existingElement.querySelector('.habit-name');
    if (nameSpan) nameSpan.textContent = habit.name;
    
    const streakSpan = existingElement.querySelector('.habit-streak');
    if (streakSpan) {
        streakSpan.setAttribute('data-streak', habit.streak);
        streakSpan.innerHTML = '';
        
        const fireIcon = document.createElement('i');
        fireIcon.className = 'fa-solid fa-fire';
        fireIcon.style.color = '#ff9800';
        streakSpan.appendChild(fireIcon);
        streakSpan.appendChild(document.createTextNode(` ${habit.streak} day${habit.streak !== 1 ? "s" : ""}`));
        
        if (habit.reminderTime) {
            let reminderText = '';
            if (Array.isArray(habit.reminderTime) && habit.reminderTime.length > 0) {
                const formattedTimes = habit.reminderTime.map(t => formatTimeTo12Hour(t));
                reminderText = formattedTimes.join(', ');
            } else if (typeof habit.reminderTime === 'string') {
                reminderText = formatTimeTo12Hour(habit.reminderTime);
            }
            if (reminderText) {
                streakSpan.appendChild(document.createTextNode(' | '));
                const bellIcon = document.createElement('i');
                bellIcon.className = 'fa-solid fa-bell';
                bellIcon.style.color = 'var(--accent-color)';
                bellIcon.style.fontSize = '0.85em';
                streakSpan.appendChild(bellIcon);
                streakSpan.appendChild(document.createTextNode(` ${reminderText}`));
            }
        }
    }
    
    // Update the 7-day grid
    const gridDiv = existingElement.querySelector('.habit-grid');
    if (gridDiv) {
        gridDiv.innerHTML = '';
        const todayObj = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(todayObj);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const box = document.createElement('div');
            box.className = 'habit-box';
            if (habit.history && habit.history.includes(dateStr)) {
                box.classList.add('done');
            }
            gridDiv.appendChild(box);
        }
    }
    
    // Update complete button state
    const checkBtn = existingElement.querySelector('.habit-complete-btn');
    const today = new Date().toISOString().split('T')[0];
    if (checkBtn) {
        if (habit.history && habit.history.includes(today)) {
            checkBtn.classList.add("done");
            existingElement.classList.add("completed");
        } else {
            checkBtn.classList.remove("done");
            existingElement.classList.remove("completed");
        }
    }
}

function completeHabitUI(habitObj, liElement, checkBtn) {
    const today = new Date().toISOString().split('T')[0];
    let habits = safeJSONParse("habits", []);
    let habit = habits.find(h => h.id === habitObj.id);

    if (habit) {
        if (!habit.history) habit.history = [];

        const todayIndex = habit.history.indexOf(today);
        let isDoneNow = false;
        if (todayIndex > -1) {
            // Already done today, allow unchecking
            habit.history.splice(todayIndex, 1);
            checkBtn.classList.remove("done");
            liElement.classList.remove("completed");
        } else {
            habit.history.push(today);
            habit.history.sort(); // Keep dates chronologically ordered
            checkBtn.classList.add("done");
            liElement.classList.add("completed");
            isDoneNow = true;
        }

        habit.streak = calculateStreak(habit);

        localStorage.setItem("habits", JSON.stringify(habits));

        if (typeof updateHabitInFirestore !== 'undefined' && currentUserId) {
            updateHabitInFirestore(habit.id, { streak: habit.streak, history: habit.history });
        }

        const streakSpan = liElement.querySelector(".habit-streak");
        streakSpan.setAttribute("data-streak", habit.streak);
        streakSpan.innerHTML = `<i class="fa-solid fa-fire" style="color:#ff9800"></i> ${habit.streak} day${habit.streak !== 1 ? "s" : ""}`;

        // Instantly update the 7-day visual grid for today
        const todayGridBox = liElement.querySelector(`.grid-box[data-date="${today}"]`);
        if (todayGridBox) {
            if (isDoneNow) {
                todayGridBox.classList.add("done");
            } else {
                todayGridBox.classList.remove("done");
            }
        }
        // --- Premium XP & Badge hooks ---
        if (isDoneNow) {
            if (typeof XPSystem !== 'undefined') XPSystem.onHabitComplete();
            if (typeof BadgeSystem !== 'undefined') {
                BadgeSystem.checkHabitBadges();
            }
            // Premium completion animation
            if (typeof PremiumInteractions !== 'undefined') {
                PremiumInteractions.animateHabitCompletion(liElement, habit.streak);
            }
        }

        // Move completed habits to bottom
        setTimeout(() => reorderCompletedToBottom('#habitList', '.habit-item'), 50);
    }
}

function calculateStreak(habit) {
    if (!habit.history || habit.history.length === 0) return 0;

    // Sort descending
    const history = [...new Set(habit.history)].sort((a, b) => new Date(b) - new Date(a));

    const todayStr = new Date().toISOString().split('T')[0];
    let yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Simple daily frequency calculation
    let latest = history[0];
    if (latest !== todayStr && latest !== yesterdayStr) {
        return 0; // Streak broken
    }

    let streak = 0;
    let currentDate = new Date(); // Start strictly from today for calculation bounds

    // Quick backward day-by-day check for consecutive completions
    for (let i = 0; i < 365; i++) {
        const dateStr = new Date(currentDate.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        if (history.includes(dateStr)) {
            streak++;
        } else if (i === 0) {
            // It's today, and they didn't do it today. That's fine, it doesn't break the streak yet.
            continue;
        } else {
            // Streak broken
            break;
        }
    }
    return streak;
}

function checkHabitStreaks() {
    let habits = JSON.parse(localStorage.getItem("habits")) || [];
    let updated = false;

    habits.forEach(habit => {
        const newStreak = calculateStreak(habit);
        if (habit.streak !== newStreak) {
            habit.streak = newStreak;
            updated = true;
            // Update UI if it's currently rendered
            const li = document.querySelector(`li.habit-item[data-id="${habit.id}"]`);
            if (li) {
                const streakSpan = li.querySelector('.habit-streak');
                if (streakSpan) {
                    streakSpan.setAttribute("data-streak", habit.streak);
                    streakSpan.innerHTML = `<i class="fa-solid fa-fire" style="color:#ff9800"></i> ${habit.streak} day${habit.streak !== 1 ? "s" : ""}`;
                }
            }
        }
    });

    if (updated) {
        localStorage.setItem("habits", JSON.stringify(habits));
        // Note: we don't automatically push a broken streak to Firestore here unless it's their device
        // We'll rely on the user interacting with the app to trigger saves to avoid excessive DB writes.
    }
}

// Statistics UI
function updateStats() {
    let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
    const today = new Date().toISOString().split('T')[0];
    const todayCompleted = tasks.filter(task => task.completed && task.completedDate === today).length;

    const todayCount = document.getElementById("todayCount");
    if (todayCount) todayCount.textContent = todayCompleted;

    const todayDate = new Date();
    const weekAgo = new Date(todayDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekCompleted = tasks.filter(task => {
        if (!task.completedDate) return false;
        return new Date(task.completedDate) >= weekAgo && task.completed;
    }).length;

    const weekCount = document.getElementById("weekCount");
    if (weekCount) weekCount.textContent = weekCompleted;

    const completedDates = tasks
        .filter(task => task.completed && task.completedDate)
        .map(task => new Date(task.completedDate))
        .sort((a, b) => b - a);

    const streakCount = document.getElementById("streakCount");
    if (streakCount) {
        if (completedDates.length === 0) {
            streakCount.textContent = 0;
        } else {
            const uniqueDates = [...new Set(completedDates.map(d => d.toISOString().split('T')[0]))];
            let streak = 0;
            let currentDate = new Date();

            for (let i = 0; i < 365; i++) {
                const dateStr = new Date(currentDate.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                if (uniqueDates.includes(dateStr)) streak++;
                else if (i === 0) continue; // today hasn't started yet — don't break streak
                else break;
            }
            streakCount.textContent = streak;
        }
    }

    // Refresh calendar events to keep timelines synced
    if (typeof refreshCalendarEvents !== 'undefined') refreshCalendarEvents();

    updateProfileStats(tasks);
}

function updateProfileStats(tasks) {
    // Basic User info
    const profileEmail = document.getElementById("profileEmail");
    const profileNameText = document.getElementById("profileNameText");

    const changePasswordGroup = document.getElementById("changePasswordGroup");

    if (typeof firebase !== 'undefined' && firebase.auth().currentUser) {
        const user = firebase.auth().currentUser;
        if (profileEmail) profileEmail.textContent = user.email || "No email provided";

        // Show change password for real users, hide for anonymous
        if (changePasswordGroup) {
            changePasswordGroup.style.display = user.isAnonymous ? "none" : "flex";
        }

        // Load custom username — use cache if available for the same user ID
        if (profileNameText) {
            let fallbackName = "User";
            if (user.email) {
                const prefix = user.email.split('@')[0];
                fallbackName = prefix.charAt(0).toUpperCase() + prefix.slice(1);
            }

            // If we have a cached name for this exact user, use it immediately
            if (cachedProfileName && cachedProfileUserId === user.uid) {
                profileNameText.textContent = cachedProfileName;
            } else {
                // First time — fetch from Firestore and store in cache
                // Check if online before fetching from Firestore
                if (!navigator.onLine) {
                    console.log('ℹ️ Offline: Using cached profile name');
                    profileNameText.textContent = user.displayName || fallbackName;
                    return;
                }
                
                firebase.firestore().collection("users").doc(user.uid).get()
                    .then(doc => {
                        let resolvedName = user.displayName || fallbackName;
                        if (doc.exists && doc.data().profile && doc.data().profile.username) {
                            resolvedName = doc.data().profile.username;
                        }
                        // Store cache
                        cachedProfileName = resolvedName;
                        cachedProfileUserId = user.uid;
                        profileNameText.textContent = resolvedName;
                    })
                    .catch(err => {
                        // Only log error if not an offline error
                        if (err.code !== 'unavailable' && !err.message.includes('offline')) {
                            console.error("Error fetching username:", err);
                        } else {
                            console.log('ℹ️ Offline: Using fallback profile name');
                        }
                        profileNameText.textContent = user.displayName || fallbackName;
                    });
            }
        }
    } else {
        if (profileEmail) profileEmail.textContent = "Guest User (Local Storage)";
        if (profileNameText) {
            let currentUser = JSON.parse(localStorage.getItem("currentUser")) || {};
            profileNameText.textContent = currentUser.displayName || "Guest Account";
        }
        if (changePasswordGroup) {
            changePasswordGroup.style.display = "none";
        }
        // Clear cache on guest/logout
        cachedProfileName = null;
        cachedProfileUserId = null;
    }

    // Task counts
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.completed).length;
    let completionRate = 0;
    if (totalTasks > 0) {
        completionRate = Math.round((completedTasks / totalTasks) * 100);
    }

    const tTasksEl = document.getElementById("profileTotalTasks");
    const cTasksEl = document.getElementById("profileCompletedTasks");
    const rTasksEl = document.getElementById("profileCompletionRate");

    if (tTasksEl) tTasksEl.textContent = totalTasks;
    if (cTasksEl) cTasksEl.textContent = completedTasks;
    if (rTasksEl) rTasksEl.textContent = completionRate + "%";
}

// Global modal state variables
let pendingDeleteAction = null;

function showDeleteModal(onConfirmCallback, itemName) {
    const modal = document.getElementById("deleteModal");
    const confirmBtn = document.getElementById("confirmDeleteBtn");
    const cancelBtn = document.getElementById("cancelDeleteBtn");
    const titleElem = modal.querySelector("h3");
    const textElem = modal.querySelector("p");

    if (!modal) return;

    // Update text if provided
    if (itemName) {
        titleElem.textContent = `Delete ${itemName}?`;
        textElem.textContent = `Are you sure you want to delete this ${itemName.toLowerCase()}?`;
    } else {
        titleElem.textContent = "Delete Item?";
        textElem.textContent = "Are you sure you want to delete this?";
    }

    // Save the action to perform
    pendingDeleteAction = onConfirmCallback;

    // Show modal (fade in blur and box)
    modal.style.display = "flex";
    setTimeout(() => modal.classList.add("show"), 10);

    // Setup temporary listeners that clean themselves up
    const handleConfirm = () => {
        if (pendingDeleteAction) pendingDeleteAction();
        closeModal();
    };

    const handleCancel = () => {
        closeModal();
    };

    const closeModal = () => {
        modal.classList.remove("show");
        setTimeout(() => modal.style.display = "none", 300);

        // Remove these exact listener instances to prevent memory leaks/duplicate fires
        confirmBtn.removeEventListener("click", handleConfirm);
        cancelBtn.removeEventListener("click", handleCancel);
        pendingDeleteAction = null;
    };

    confirmBtn.addEventListener("click", handleConfirm);
    cancelBtn.addEventListener("click", handleCancel);
}

// ===== PROFILE CHART MODULE =====
function renderProfileChart() {
    const ctx = document.getElementById('profileChart');
    if (!ctx) return;

    const labels = [];
    const data = [];
    let isPercentage = activeProfileStat === 'habits';

    const today = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));

        if (activeProfileStat === 'habits') {
            let habits = JSON.parse(localStorage.getItem("habits")) || [];
            let count = 0;
            let totalActiveHabits = 0;
            habits.forEach(habit => {
                let isActiveToday = true;
                if (habit.frequency === 'specific_days' && habit.targetDays) {
                    const dWeekday = d.toLocaleDateString('en-US', { weekday: 'short' });
                    if (!habit.targetDays.includes(dWeekday)) isActiveToday = false;
                }
                if (isActiveToday) {
                    totalActiveHabits++;
                    if (habit.history && habit.history.includes(dateStr)) count++;
                }
            });
            data.push(totalActiveHabits > 0 ? Math.round((count / totalActiveHabits) * 100) : 0);
        } else {
            // Tasks completed on this day
            let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
            let completedCount = tasks.filter(t => t.completed && t.completedDate && t.completedDate.startsWith(dateStr)).length;
            data.push(completedCount);
        }
    }

    if (profileChartInstance) {
        profileChartInstance.destroy();
    }

    if (typeof Chart !== 'undefined') {
        const isDarkMode = localStorage.getItem('theme') === 'dark';
        const textColor = isDarkMode ? '#f8fafc' : '#1e293b';
        const gridColor = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#3b82f6';
        Chart.defaults.font.family = "'Jost', sans-serif";

        profileChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: isPercentage ? 'Completion %' : 'Tasks Completed',
                    data: data,
                    backgroundColor: isPercentage ? '#10B981' : accentColor,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                // Enable hover tooltips — 'index' mode fires on column hover (most reliable for bars)
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'],
                animation: {
                    duration: 500,
                    easing: 'easeOutCubic'
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: isPercentage ? 100 : undefined,
                        suggestedMax: isPercentage ? 100 : Math.max(...data) + 2,
                        ticks: {
                            precision: 0,
                            color: textColor,
                            callback: function (value) { return isPercentage ? value + "%" : value }
                        },
                        grid: { color: gridColor }
                    },
                    x: {
                        ticks: { color: textColor },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: textColor,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        enabled: true,
                        callbacks: {
                            title: function (items) {
                                return items[0]?.label || '';
                            },
                            label: function (context) {
                                const val = context.parsed.y;
                                return isPercentage
                                    ? 'Completion: ' + val + '%'
                                    : val + (val === 1 ? ' task completed' : ' tasks completed');
                            }
                        }
                    }
                }
            }
        });
    }
}

// ===== Native Browser Habit Reminders =====
let notifiedHabits = {}; // Track ID-Date combinations to prevent duplicate notifications

function setupReminders() {
    // Check every minute
    setInterval(checkHabitReminders, 60000);
    // Also check immediately on load
    checkHabitReminders();
}

function checkHabitReminders() {
    if (!("Notification" in window)) return;

    // We only send notifications if permission is granted
    if (Notification.permission !== "granted") return;

    const habitsStr = localStorage.getItem("habits");
    if (!habitsStr) return;

    const habits = JSON.parse(habitsStr);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentHours = now.getHours().toString().padStart(2, '0');
    const currentMinutes = now.getMinutes().toString().padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;

    // Get current day abbreviation (e.g. "Mon")
    const dayNamesObj = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const currentDayStr = dayNamesObj[now.getDay()];

    habits.forEach(habit => {
        // Does this habit have any reminder times?
        if (!habit.reminderTime || !Array.isArray(habit.reminderTime) || habit.reminderTime.length === 0) return;

        // Has it already been marked done today?
        if (habit.history && habit.history.includes(todayStr)) return;

        // Is it scheduled for today? (Frequency check)
        if (habit.frequency === "specific_days") {
            if (!habit.targetDays || !habit.targetDays.includes(currentDayStr)) return;
        }

        // Check each reminder time against the current time
        habit.reminderTime.forEach(timeString => {
            if (timeString !== currentTimeStr) return;

            // Have we already notified for this exact habit + time combination today?
            const notificationId = `${habit.id}_${todayStr}_${timeString}`;
            if (notifiedHabits[notificationId]) return;

            // Fire native notification
            const notification = new Notification("Prodify Habit Reminder", {
                body: `It's time to: ${habit.name}`,
                icon: 'favicon.ico' // Or any path to a logo you wish
            });

            notification.onclick = function () {
                window.focus(); // Bring the PWA/Browser to foreground
                this.close();
            };

            // Mark as notified in memory for this session
            notifiedHabits[notificationId] = true;
        });
    });
}

// ===== Empty State Helpers =====
function updateTasksEmptyState() {
    const list = document.getElementById("taskList");
    const empty = document.getElementById("tasksEmptyState");
    const tasksTabBtn = document.querySelector('.tab-btn[data-tab="tasks"]');
    if (!list || !empty || !tasksTabBtn) return;

    const isActive = tasksTabBtn.classList.contains("active");
    const hasItems = list.querySelectorAll("li").length > 0;
    empty.style.display = !hasItems && isActive ? "flex" : "none";
}

function updateHabitsEmptyState() {
    const list = document.getElementById("habitList");
    const empty = document.getElementById("habitsEmptyState");
    const habitsTabBtn = document.querySelector('.tab-btn[data-tab="habits"]');
    if (!list || !empty || !habitsTabBtn) return;

    const isActive = habitsTabBtn.classList.contains("active");
    const hasItems = list.querySelectorAll(".habit-item").length > 0;
    empty.style.display = !hasItems && isActive ? "flex" : "none";
}

// ===== Change Password Settings Panel =====

document.addEventListener('DOMContentLoaded', () => {

    // 1. Toggle panel visibility
    const toggleBtn = document.getElementById('togglePasswordSectionBtn');
    const container = document.getElementById('changePasswordContainer');

    if (toggleBtn && container) {
        toggleBtn.addEventListener('click', () => {
            const isCollapsed = container.classList.toggle('collapsed');

            // Rotate the chevron
            const chevron = toggleBtn.querySelector('.chevron-icon');
            if (chevron) {
                chevron.style.transform = isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)';
                chevron.style.opacity = isCollapsed ? '0.5' : '1';
            }
        });
    }

    // 2. Setup the "Eye" toggle buttons for the current and new passwords
    const toggleCurrentBtn = document.querySelector('.toggle-current-btn');
    const currentInput = document.getElementById('currentPasswordInput');

    if (toggleCurrentBtn && currentInput) {
        toggleCurrentBtn.addEventListener('click', () => {
            const type = currentInput.getAttribute('type') === 'password' ? 'text' : 'password';
            currentInput.setAttribute('type', type);
            // Toggle eye icon styling if desired
            toggleCurrentBtn.style.opacity = type === 'text' ? '1' : '0.5';
        });
    }

    const toggleNewBtn = document.querySelector('.toggle-new-btn');
    const newInput = document.getElementById('newPasswordInput');

    if (toggleNewBtn && newInput) {
        toggleNewBtn.addEventListener('click', () => {
            const type = newInput.getAttribute('type') === 'password' ? 'text' : 'password';
            newInput.setAttribute('type', type);
            toggleNewBtn.style.opacity = type === 'text' ? '1' : '0.5';
        });
    }

    // 3. Logic: Cancel & Clear
    const cancelBtn = document.getElementById('cancelPasswordBtn');
    const saveBtn = document.getElementById('savePasswordBtn');
    const confirmInput = document.getElementById('confirmPasswordInput');
    const errorMsg = document.getElementById('passwordChangeError');
    const successMsg = document.getElementById('passwordChangeSuccess');

    function resetPasswordPanel() {
        if (currentInput) currentInput.value = '';
        if (newInput) newInput.value = '';
        if (confirmInput) confirmInput.value = '';
        if (errorMsg) errorMsg.style.display = 'none';
        if (successMsg) successMsg.style.display = 'none';

        // Reset eye icons
        if (currentInput) currentInput.setAttribute('type', 'password');
        if (toggleCurrentBtn) toggleCurrentBtn.style.opacity = '0.5';
        if (newInput) newInput.setAttribute('type', 'password');
        if (toggleNewBtn) toggleNewBtn.style.opacity = '0.5';
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            resetPasswordPanel();
            if (container) container.classList.add('collapsed');
        });
    }

    // 4. Logic: Save & Validate
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            // Reset messages
            errorMsg.style.display = 'none';
            successMsg.style.display = 'none';

            const current = currentInput.value;
            const newPass = newInput.value;
            const confirmPass = confirmInput.value;

            // Client-side validation
            if (!current || !newPass || !confirmPass) {
                errorMsg.textContent = "Please fill in all password fields.";
                errorMsg.style.display = 'block';
                return;
            }

            if (newPass.length < 6) {
                errorMsg.textContent = "New password must be at least 6 characters.";
                errorMsg.style.display = 'block';
                return;
            }

            if (newPass !== confirmPass) {
                errorMsg.textContent = "New passwords do not match.";
                errorMsg.style.display = 'block';
                return;
            }

            // Ensure our auth helper exists
            if (typeof updateUserPassword !== 'function') {
                errorMsg.textContent = "Security feature unavailable. Please refresh.";
                errorMsg.style.display = 'block';
                return;
            }

            // Lock UI and show spinner
            saveBtn.classList.add('loading');
            saveBtn.disabled = true;

            try {
                // Call auth.js helper
                await updateUserPassword(current, newPass);

                // Show success
                successMsg.textContent = "Password updated successfully!";
                successMsg.style.display = 'block';

                // Wait briefly, then close and reset
                setTimeout(() => {
                    resetPasswordPanel();
                    if (container) container.classList.add('collapsed');
                }, 2000);

            } catch (error) {
                // The error message here is uniquely translated by auth.js for UI presentation
                errorMsg.textContent = error.message;
                errorMsg.style.display = 'block';
            } finally {
                // Release UI lock
                saveBtn.classList.remove('loading');
                saveBtn.disabled = false;
            }
        });
    }
});

// ===== 🧠 Smart Insights Generator =====
function generateSmartInsights() {
    const container = document.getElementById('smartInsightsList');
    if (!container) return;

    const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    const habits = JSON.parse(localStorage.getItem('habits')) || [];

    // --- Insight 1: Task Progress ---
    const completedCount = tasks.filter(t => t.completed).length;
    const totalCount = tasks.length || 1;
    const completionRate = Math.round((completedCount / totalCount) * 100);
    
    let taskInsight;
    if (completedCount === 0) {
        taskInsight = { icon: '📝', text: 'Start completing tasks to track your progress!', accent: 'accent-blue' };
    } else if (completionRate >= 70) {
        taskInsight = { icon: '🔥', text: `Great work! ${completedCount} of ${totalCount} tasks completed (${completionRate}%)`, accent: 'accent-green' };
    } else {
        taskInsight = { icon: '💪', text: `Keep going! ${completedCount} of ${totalCount} tasks completed`, accent: 'accent-purple' };
    }

    // --- Insight 2: Habit Streak ---
    let maxStreak = 0;
    let maxStreakName = '';
    habits.forEach(h => {
        if ((h.streak || 0) > maxStreak) {
            maxStreak = h.streak;
            maxStreakName = h.name || 'a habit';
        }
    });
    
    let streakInsight;
    if (maxStreak >= 7) {
        streakInsight = { icon: '🏆', text: `Amazing! ${maxStreak}-day streak with "${maxStreakName}"`, accent: 'accent-orange' };
    } else if (maxStreak >= 3) {
        streakInsight = { icon: '⚡', text: `${maxStreak}-day streak with "${maxStreakName}". Keep it up!`, accent: 'accent-purple' };
    } else if (habits.length > 0) {
        streakInsight = { icon: '🌱', text: 'Build consistency by logging habits daily', accent: 'accent-blue' };
    } else {
        streakInsight = { icon: '🌱', text: 'Add habits to start building streaks', accent: 'accent-blue' };
    }

    // --- Render ---
    const insights = [taskInsight, streakInsight];
    container.innerHTML = insights.map(ins => `
        <div class="insight-card ${ins.accent}">
            <span class="insight-icon">${ins.icon}</span>
            <span class="insight-text">${ins.text}</span>
        </div>
    `).join('');
}

// ===== 🎯 Focus Mode =====
(function initFocusMode() {
    let focusModeActive = false;

    // Priority rank: lower index = higher importance
    const PRIORITY_ORDER = ['high', 'vital-quick', 'medium', 'vital-notquick', 'low', 'notvital-quick'];

    // Unique ID for the injected empty state so we can remove it cleanly
    const FOCUS_EMPTY_ID = 'focusModeEmptyState';

    function getPriorityRank(li) {
        const p = li.getAttribute('data-priority') || '';
        const idx = PRIORITY_ORDER.indexOf(p);
        return idx === -1 ? 99 : idx;
    }

    function showFocusEmpty() {
        // Only inject once
        if (document.getElementById(FOCUS_EMPTY_ID)) return;
        const taskList = document.getElementById('taskList');
        if (!taskList) return;

        const el = document.createElement('div');
        el.id = FOCUS_EMPTY_ID;
        el.className = 'focus-empty';
        el.innerHTML = `
            <div class="focus-empty-icon">🎯</div>
            <p class="focus-empty-title">You're all clear!</p>
            <p class="focus-empty-sub">No pending tasks due today.<br>Enjoy the free time — you've earned it.</p>
        `;
        taskList.parentNode.insertBefore(el, taskList.nextSibling);
    }

    function removeFocusEmpty() {
        const el = document.getElementById(FOCUS_EMPTY_ID);
        if (el) el.remove();
    }

    function applyFocusMode() {
        const today = new Date().toISOString().split('T')[0];
        const allTasks = Array.from(document.querySelectorAll('#taskList li'));

        // Eligible = incomplete AND (due today OR has a priority)
        const eligible = allTasks.filter(li => {
            if (li.classList.contains('completed')) return false;
            const dueDate = li.getAttribute('data-due-date') || '';
            const priority = li.getAttribute('data-priority') || '';
            return dueDate === today || priority !== '';
        });

        // Sort by priority rank (vital-quick first), then by due date
        eligible.sort((a, b) => {
            const rankDiff = getPriorityRank(a) - getPriorityRank(b);
            if (rankDiff !== 0) return rankDiff;
            const da = a.getAttribute('data-due-date') || '9999-12-31';
            const db = b.getAttribute('data-due-date') || '9999-12-31';
            return da.localeCompare(db);
        });

        const top3Ids = new Set(eligible.slice(0, 3).map(li => li.getAttribute('data-id')));

        allTasks.forEach(li => {
            if (top3Ids.has(li.getAttribute('data-id'))) {
                li.style.display = 'flex';
                li.classList.add('focus-highlight');
            } else {
                li.style.display = 'none';
                li.classList.remove('focus-highlight');
            }
        });

        // Show a friendly empty state if nothing qualifies
        if (top3Ids.size === 0) {
            showFocusEmpty();
        } else {
            removeFocusEmpty();
        }
    }

    function deactivateFocusMode() {
        removeFocusEmpty();

        // Restore all tasks
        document.querySelectorAll('#taskList li').forEach(li => {
            li.style.display = 'flex';
            li.classList.remove('focus-highlight');
        });

        // Re-apply the currently active filter button if any
        const activeFilterBtn = document.querySelector('.task-filters__btn.active-filter');
        if (activeFilterBtn) {
            activeFilterBtn.click();
        }
    }

    // Re-run filtering on task completion so Focus Mode stays accurate
    // (hooked in via span click in createTaskElement → updateCounter is called → we re-filter)
    const _originalUpdateCounter = window.updateCounter;
    if (typeof updateCounter === 'function') {
        const _orig = updateCounter;
        window.updateCounter = function () {
            _orig.apply(this, arguments);
            if (focusModeActive) {
                // Small delay so DOM class changes settle first
                requestAnimationFrame(applyFocusMode);
            }
        };
    }

    // ── Wire up the toggle button ──
    function bindButton() {
        const btn = document.getElementById('focusModeBtn');
        const hint = document.getElementById('focusModeHint');
        if (!btn) return;

        btn.addEventListener('click', () => {
            focusModeActive = !focusModeActive;
            btn.setAttribute('aria-pressed', String(focusModeActive));
            btn.classList.toggle('active', focusModeActive);
            document.body.classList.toggle('focus-active', focusModeActive);

            if (hint) {
                hint.style.display = focusModeActive ? 'block' : 'none';
            }

            if (focusModeActive) {
                applyFocusMode();
            } else {
                deactivateFocusMode();
            }
        });
    }

    // Bind immediately if DOM is ready, otherwise wait
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindButton);
    } else {
        bindButton();
    }
})();

/* ===== Toggle Avatar & Accent Settings ===== */
document.addEventListener('DOMContentLoaded', () => {
    // Helper function to setup toggles
    function setupToggle(btnId, contentId) {
        const btn = document.getElementById(btnId);
        const content = document.getElementById(contentId);

        if (!btn || !content) return;

        // Use existing FA chevron icon if present
        const arrow = btn.querySelector('.chevron-icon');

        btn.addEventListener('click', () => {
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';

            // Rotate arrow if present
            if (arrow) {
                arrow.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
                arrow.style.opacity = isHidden ? '1' : '0.5';
            }
        });
    }

    setupToggle('toggleAvatarSectionBtn', 'avatarSectionContent');
    setupToggle('toggleAccentSectionBtn', 'accentSectionContent');
});

/* ===== PREMIUM: Splash Screen, FAB, Ripple Effects, Card Reveals ===== */
(function () {
    'use strict';

    // --- Splash Screen ---
    function initSplashScreen() {
        const splash = document.getElementById('splashScreen');
        if (!splash) return;

        // Show body immediately (splash covers it)
        document.body.style.display = '';

        // Splash will be dismissed by auth.js when Firebase auth is ready
        // No automatic timeout here - let auth control the splash lifecycle
    }

    // --- FAB Quick Actions ---
    function initFAB() {
        const fabContainer = document.getElementById('fabContainer');
        const fabMainBtn = document.getElementById('fabMainBtn');
        const fabBackdrop = document.getElementById('fabBackdrop');
        const fabMenu = document.getElementById('fabMenu');

        if (!fabContainer || !fabMainBtn) return;

        // Show FAB only when app is visible AND on the today tab
        const appContainer = document.getElementById('appContainer');
        if (appContainer) {
            const observer = new MutationObserver(() => {
                const appVisible = appContainer.style.display !== 'none';
                fabContainer.style.display = (appVisible && activeTabName === 'today') ? '' : 'none';
            });
            observer.observe(appContainer, { attributes: true, attributeFilter: ['style'] });
        }

        function toggleFAB() {
            const isOpen = fabContainer.classList.toggle('fab-open');
            if (fabBackdrop) fabBackdrop.classList.toggle('fab-backdrop-show', isOpen);
        }

        function closeFAB() {
            fabContainer.classList.remove('fab-open');
            if (fabBackdrop) fabBackdrop.classList.remove('fab-backdrop-show');
        }

        fabMainBtn.addEventListener('click', toggleFAB);
        if (fabBackdrop) fabBackdrop.addEventListener('click', closeFAB);

        // Menu item actions
        if (fabMenu) {
            fabMenu.addEventListener('click', (e) => {
                const item = e.target.closest('.fab-menu-item');
                if (!item) return;

                const action = item.dataset.action;
                closeFAB();

                switch (action) {
                    case 'ai-coach':
                        switchTab('ai-coach');
                        setTimeout(() => {
                            // Render AI Coach dashboard
                            if (typeof CoachUIRenderer !== 'undefined' && CoachUIRenderer.renderDashboard) {
                                CoachUIRenderer.renderDashboard();
                            }
                        }, 300);
                        break;
                    case 'add-task':
                        switchTab('tasks');
                        setTimeout(() => {
                            const input = document.getElementById('taskInput');
                            if (input) input.focus();
                        }, 300);
                        break;
                    case 'add-habit':
                        switchTab('habits');
                        setTimeout(() => {
                            const input = document.getElementById('habitInput');
                            if (input) input.focus();
                        }, 300);
                        break;
                    case 'add-note':
                        switchTab('notes');
                        setTimeout(() => {
                            if (typeof NotesManager !== 'undefined' && NotesManager.showNoteForm) {
                                NotesManager.showNoteForm();
                            }
                        }, 300);
                        break;
                    case 'focus':
                        switchTab('academics');
                        setTimeout(() => {
                            const timerEl = document.getElementById('focusTimerDisplay');
                            if (timerEl) timerEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 300);
                        break;
                    case 'mood':
                        switchTab('mind');
                        break;
                }
            });
        }
    }

    // --- Ripple Effect on Buttons ---
    function initRippleEffects() {
        // Add ripple class to relevant buttons
        const buttons = document.querySelectorAll('#addBtn, #addHabitBtn, .auth-btn--primary, .acad-btn--start, .fab-main, .fab-menu-btn');
        buttons.forEach(btn => {
            btn.classList.add('ripple-effect', 'elastic-press');
        });

        document.addEventListener('click', function (e) {
            const btn = e.target.closest('.ripple-effect');
            if (!btn) return;

            const rect = btn.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;

            const ripple = document.createElement('span');
            ripple.className = 'ripple';
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';

            btn.appendChild(ripple);
            ripple.addEventListener('animationend', () => ripple.remove());
        });
    }

    // --- Card Reveal on Scroll (Intersection Observer) ---
    function initCardReveals() {
        // Add reveal class to cards
        const cards = document.querySelectorAll('.acad-card, .task-stats, .home-card, .home-score, .premium-card, .phys-card');
        cards.forEach(card => card.classList.add('card-reveal'));

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-revealed');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        // Observe static cards
        document.querySelectorAll('.card-reveal').forEach(card => observer.observe(card));

        // Re-observe when new cards are dynamically added
        const tabsTrack = document.getElementById('tabsTrack');
        if (tabsTrack) {
            new MutationObserver(() => {
                document.querySelectorAll('.card-reveal:not(.is-revealed)').forEach(card => observer.observe(card));
            }).observe(tabsTrack, { childList: true, subtree: true });
        }
    }

    // --- Initialize All Premium Features ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initSplashScreen();
            initFAB();
            initRippleEffects();
            initCardReveals();
        });
    } else {
        initSplashScreen();
        initFAB();
        initRippleEffects();
        initCardReveals();
    }
})();

