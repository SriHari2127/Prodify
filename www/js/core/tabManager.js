// ===== TAB MANAGER MODULE (tabManager.js) =====
// Handles sidebar navigation, tab selection for home screen, and persistence

const TabManager = (function() {
    'use strict';

    // All available tabs in the app with their icons and display names
    const ALL_TABS = [
        {
            id: 'today',
            name: 'Home',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tab-icon"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`
        },
        {
            id: 'tasks',
            name: 'Tasks',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tab-icon"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`
        },
        {
            id: 'habits',
            name: 'Habits',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tab-icon"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
        },
        {
            id: 'notes',
            name: 'Notes',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tab-icon"><path d="M4 19.5V4.75A1.75 1.75 0 0 1 5.75 3h10.5A1.75 1.75 0 0 1 18 4.75v14.75"/><path d="M6 8h8"/><path d="M6 12h6"/><path d="M6 16h4"/></svg>`
        },
        {
            id: 'academics',
            name: 'Academics',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tab-icon"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`
        },
        {
            id: 'calendar',
            name: 'Calendar',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tab-icon"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`
        },
        // Optional tabs (include as needed)
        {
            id: 'ai-coach',
            name: 'AI Coach',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tab-icon"><path d="M12 2v4"/><path d="M8 6v2a4 4 0 0 0 8 0V6"/><rect x="6" y="10" width="12" height="10" rx="2"/></svg>`
        }
    ];

    // Default tabs to show on home (4 max)
    const DEFAULT_HOME_TABS = ['today', 'tasks', 'habits', 'notes', 'academics', 'calendar', 'ai-coach'];
    const MAX_HOME_TABS = 7;
    const STORAGE_KEY = 'prodify_home_tabs';

    // State
    let homeTabs = [];
    let isSidebarOpen = false;

    // DOM Elements (cached after init)
    let elements = {};

    // === Initialization ===
    function init() {
        cacheElements();
        loadHomeTabs();
        bindEvents();
        renderSidebarTabs();
        updateNavTabs();
    }

    function cacheElements() {
        elements = {
            sidebar: document.getElementById('tabsSidebar'),
            overlay: document.getElementById('sidebarOverlay'),
            tabsMenuBtn: document.getElementById('tabsMenuBtn'),
            closeSidebarBtn: document.getElementById('closeSidebarBtn'),
            sidebarTabList: document.getElementById('sidebarTabList'),
            tabsNav: document.querySelector('.tabs-nav')
        };
    }

    function bindEvents() {
        // Open sidebar
        if (elements.tabsMenuBtn) {
            elements.tabsMenuBtn.addEventListener('click', openSidebar);
        }

        // Close sidebar
        if (elements.closeSidebarBtn) {
            elements.closeSidebarBtn.addEventListener('click', closeSidebar);
        }

        // Click overlay to close
        if (elements.overlay) {
            elements.overlay.addEventListener('click', closeSidebar);
        }

        // Close with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (isSidebarOpen) {
                    closeSidebar();
                }
            }
        });
    }

    // === localStorage Persistence ===
    function loadHomeTabs() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Validate stored tabs exist in ALL_TABS
                const validTabs = parsed.filter(id => ALL_TABS.some(t => t.id === id));
                if (validTabs.length > 0 && validTabs.length <= MAX_HOME_TABS) {
                    homeTabs = validTabs;
                    return;
                }
            }
        } catch (e) {
            console.warn('Error loading home tabs from localStorage:', e);
        }
        // Fallback to defaults
        homeTabs = [...DEFAULT_HOME_TABS];
    }

    function saveHomeTabs() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(homeTabs));
        } catch (e) {
            console.warn('Error saving home tabs to localStorage:', e);
        }
    }

    // === Sidebar Open/Close ===
    function openSidebar() {
        if (!elements.sidebar || !elements.overlay) return;

        elements.sidebar.classList.add('sidebar-open');
        elements.sidebar.classList.remove('sidebar-closed');
        elements.sidebar.classList.add('open'); // Keeping for fallback compatibility
        elements.overlay.classList.add('active');
        document.body.classList.add('sidebar-open');
        document.documentElement.classList.add('sidebar-open');
        isSidebarOpen = true;

        // Update active state in sidebar
        renderSidebarTabs();
    }

    function closeSidebar() {
        if (!elements.sidebar || !elements.overlay) return;

        elements.sidebar.classList.remove('sidebar-open');
        elements.sidebar.classList.add('sidebar-closed');
        elements.sidebar.classList.remove('open');
        elements.overlay.classList.remove('active');
        document.body.classList.remove('sidebar-open');
        document.documentElement.classList.remove('sidebar-open');
        isSidebarOpen = false;
    }

    // === Render Sidebar Tab List ===
    function renderSidebarTabs() {
        if (!elements.sidebarTabList) return;

        // Get current active tab
        const activeTab = typeof activeTabName !== 'undefined' ? activeTabName : 'tasks';

        let html = ALL_TABS.map((tab, index) => {
            const isActive = tab.id === activeTab;
            
            let tabHTML = `
                <li class="sidebar-tab-item ${isActive ? 'active' : ''}" data-tab="${tab.id}">
                    <span class="tab-icon">${tab.icon}</span>
                    <span class="tab-name">${tab.name}</span>
                </li>
            `;
            
            // Add separator after Home tab (first tab)
            if (index === 0) {
                tabHTML += '<li class="sidebar-tab-separator"></li>';
            }
            
            return tabHTML;
        }).join('');

        elements.sidebarTabList.innerHTML = html;

        // Add click handlers
        elements.sidebarTabList.querySelectorAll('.sidebar-tab-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.getAttribute('data-action');
                if (action === 'profile') {
                    closeSidebar();
                    const profileBtn = document.getElementById('profileBtn');
                    if (profileBtn) profileBtn.click();
                } else {
                    const tabId = item.getAttribute('data-tab');
                    selectTabFromSidebar(tabId);
                }
            });
        });
    }

    function selectTabFromSidebar(tabId) {
        // Switch to the tab
        if (typeof switchTab === 'function') {
            switchTab(tabId);
        }

        // Update nav indicator if exists
        const updateTabsIndicator = window.updateTabsIndicator;
        if (typeof updateTabsIndicator === 'function') {
            setTimeout(updateTabsIndicator, 50);
        }

        // Close the sidebar
        closeSidebar();
    }

    // === Update Navigation Bar ===
    function updateNavTabs() {
        if (!elements.tabsNav) return;

        const allNavBtns = elements.tabsNav.querySelectorAll('.tab-btn');

        allNavBtns.forEach(btn => {
            const tabId = btn.getAttribute('data-tab');
            if (homeTabs.includes(tabId)) {
                btn.classList.remove('hidden-tab');
            } else {
                btn.classList.add('hidden-tab');
            }
        });
    }

    // Handle window resize
    function handleResize() {
        // resize logic removed
    }

    // === Public API ===
    return {
        init,
        openSidebar,
        closeSidebar,
        getHomeTabs: () => [...homeTabs],
        getAllTabs: () => [...ALL_TABS],
        isTabOnHome: (tabId) => homeTabs.includes(tabId),
        refresh: () => {
            updateNavTabs();
            renderSidebarTabs();
        }
    };

})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Small delay to ensure other modules are initialized
    setTimeout(() => {
        TabManager.init();
    }, 100);
});

// Handle resize events
window.addEventListener('resize', function() {
    if (typeof TabManager !== 'undefined' && TabManager.refresh) {
        TabManager.refresh();
    }
});
