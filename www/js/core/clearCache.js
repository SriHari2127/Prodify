// Debug helper: clear app caches, service workers, and AI Coach localStorage cache
(async function(){
    async function clearAppCaches() {
        console.log('🧹 Clearing app caches...');
        try {
            // Remove AI Coach cache key
            if (localStorage.getItem('ai_coach_cache')) {
                localStorage.removeItem('ai_coach_cache');
                console.log('✅ Removed localStorage: ai_coach_cache');
            } else {
                console.log('ℹ️ ai_coach_cache not found in localStorage');
            }

            // Optionally clear other known keys
            const otherKeys = ['prodify_home_tabs', 'ai_cache', 'ai_coach_cache_v2'];
            otherKeys.forEach(k => { if (localStorage.getItem(k)) { localStorage.removeItem(k); console.log('✅ Removed localStorage:', k); } });

            // Clear Cache Storage (Service Worker caches)
            if (window.caches && typeof window.caches.keys === 'function') {
                const keys = await caches.keys();
                for (const key of keys) {
                    await caches.delete(key);
                    console.log('✅ Deleted Cache:', key);
                }
            } else {
                console.log('ℹ️ Cache API not available');
            }

            // Unregister service workers
            if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (const reg of regs) {
                    await reg.unregister();
                    console.log('✅ Unregistered ServiceWorker:', reg.scope);
                }
            } else {
                console.log('ℹ️ ServiceWorker API not available');
            }

            console.log('🧹 App caches cleared. Reloading page...');
            // Small delay so logs flush for DevTools
            setTimeout(() => location.reload(true), 300);
        } catch (e) {
            console.error('❌ Error clearing caches:', e);
        }
    }

    // Expose helper on window for manual use
    window.clearAppCaches = clearAppCaches;

    // Auto-run when ?clearCache=1 is present in URL
    try {
        const params = new URLSearchParams(location.search);
        if (params.get('clearCache') === '1') {
            clearAppCaches();
        }
    } catch (e) {
        // ignore
    }
})();
