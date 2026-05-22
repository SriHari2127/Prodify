// ===== SKELETON LOADER UTILITIES =====
// Helper functions for managing skeleton loading states

const SkeletonLoader = (function() {
    'use strict';

    /**
     * Remove skeleton placeholders from a container
     * @param {string|HTMLElement} container - Container element or selector
     * @param {boolean} fadeOut - Whether to fade out before removing
     */
    function remove(container, fadeOut = true) {
        const element = typeof container === 'string' 
            ? document.querySelector(container) 
            : container;
        
        if (!element) return;

        const skeletons = element.querySelectorAll('.skeleton, .skeleton-card, .skeleton-task, .skeleton-dashboard__greeting, .skeleton-analytics');
        
        if (fadeOut) {
            skeletons.forEach(skeleton => {
                skeleton.style.opacity = '0';
                skeleton.style.transition = 'opacity 0.3s ease';
            });
            
            setTimeout(() => {
                skeletons.forEach(skeleton => skeleton.remove());
            }, 300);
        } else {
            skeletons.forEach(skeleton => skeleton.remove());
        }
    }

    /**
     * Show skeleton placeholders in a container
     * @param {string|HTMLElement} container - Container element or selector
     */
    function show(container) {
        const element = typeof container === 'string' 
            ? document.querySelector(container) 
            : container;
        
        if (!element) return;

        const skeletons = element.querySelectorAll('.skeleton, .skeleton-card, .skeleton-task, .skeleton-dashboard__greeting, .skeleton-analytics');
        skeletons.forEach(skeleton => {
            skeleton.style.display = '';
            skeleton.style.opacity = '1';
        });
    }

    /**
     * Replace skeleton with actual content
     * @param {string|HTMLElement} container - Container element or selector
     * @param {string} content - HTML content to insert
     * @param {boolean} animate - Whether to animate the content in
     */
    function replace(container, content, animate = true) {
        const element = typeof container === 'string' 
            ? document.querySelector(container) 
            : container;
        
        if (!element) return;

        // Remove skeletons first
        remove(element, true);

        // Insert content after skeleton fade
        setTimeout(() => {
            if (typeof content === 'string') {
                element.innerHTML = content;
            }
            
            // Add fade-in animation
            if (animate) {
                element.classList.add('content-loaded');
            }
        }, 350);
    }

    /**
     * Create a loading state with spinner
     * @param {string} text - Loading text
     * @returns {string} HTML for loading state
     */
    function createLoadingState(text = 'Loading...') {
        return `
            <div class="loading-state">
                <div class="loading-state__spinner"></div>
                <div class="loading-state__text">${text}</div>
            </div>
        `;
    }

    /**
     * Generate skeleton HTML for a task
     * @returns {string} Skeleton HTML
     */
    function createTaskSkeleton() {
        return `
            <li class="skeleton-task">
                <div class="skeleton skeleton-task__checkbox"></div>
                <div class="skeleton-task__content">
                    <div class="skeleton skeleton-text"></div>
                    <div class="skeleton skeleton-text" style="width: 60%; height: 12px;"></div>
                </div>
            </li>
        `;
    }

    /**
     * Generate skeleton HTML for a card
     * @returns {string} Skeleton HTML
     */
    function createCardSkeleton() {
        return `
            <div class="skeleton-card">
                <div class="skeleton skeleton-text--title"></div>
                <div class="skeleton skeleton-text" style="margin-top: 12px;"></div>
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-text" style="width: 70%;"></div>
            </div>
        `;
    }

    /**
     * Generate skeleton HTML for analytics
     * @returns {string} Skeleton HTML
     */
    function createAnalyticsSkeleton() {
        return `
            <div class="skeleton-analytics">
                <div class="skeleton skeleton-text--title"></div>
                <div class="skeleton skeleton-analytics__chart"></div>
                <div class="skeleton-analytics__stats">
                    <div class="skeleton-analytics__stat">
                        <div class="skeleton skeleton-text"></div>
                        <div class="skeleton skeleton-text" style="height: 32px; margin-top: 8px;"></div>
                    </div>
                    <div class="skeleton-analytics__stat">
                        <div class="skeleton skeleton-text"></div>
                        <div class="skeleton skeleton-text" style="height: 32px; margin-top: 8px;"></div>
                    </div>
                    <div class="skeleton-analytics__stat">
                        <div class="skeleton skeleton-text"></div>
                        <div class="skeleton skeleton-text" style="height: 32px; margin-top: 8px;"></div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Initialize skeleton loaders for specific sections
     */
    function init() {
        console.log('✨ Skeleton Loader initialized');
        
        // Auto-remove skeletons after a timeout (fallback)
        setTimeout(() => {
            const allSkeletons = document.querySelectorAll('.skeleton, .skeleton-card, .skeleton-task');
            if (allSkeletons.length > 0) {
                console.log('⚠️ Auto-removing remaining skeletons after timeout');
                allSkeletons.forEach(skeleton => {
                    skeleton.style.opacity = '0';
                    skeleton.style.transition = 'opacity 0.3s ease';
                });
                setTimeout(() => {
                    allSkeletons.forEach(skeleton => skeleton.remove());
                }, 300);
            }
        }, 10000); // 10 second fallback
    }

    // Public API
    return {
        remove,
        show,
        replace,
        createLoadingState,
        createTaskSkeleton,
        createCardSkeleton,
        createAnalyticsSkeleton,
        init
    };
})();

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SkeletonLoader.init());
} else {
    SkeletonLoader.init();
}
