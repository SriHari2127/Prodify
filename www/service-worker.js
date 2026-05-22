// ===== SERVICE WORKER FOR BACKGROUND SYNC =====
// Handles background synchronization using Service Worker API

const CACHE_NAME = 'prodify-v2';
const SYNC_TAG = 'prodify-sync';

// Install service worker
self.addEventListener('install', (event) => {
    console.log('✅ Service Worker installing...');
    
    event.waitUntil(
        // Skip caching for now to avoid errors
        // Can be enabled later with correct paths
        Promise.resolve().then(() => {
            console.log('✅ Service Worker installed');
        })
    );
    
    // Activate immediately
    self.skipWaiting();
});

// Activate service worker
self.addEventListener('activate', (event) => {
    console.log('✅ Service Worker activated');
    
    event.waitUntil(
        // Clean up old caches
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    
    // Take control immediately
    return self.clients.claim();
});

// Handle fetch requests (network-first strategy for API calls)
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip cross-origin requests
    if (url.origin !== location.origin) {
        return;
    }

    // Handle API requests with network-first strategy
    if (request.url.includes('/api/') || request.url.includes('firestore')) {
        event.respondWith(networkFirst(request));
    }
    // Always fetch navigation/HTML requests from network first so app shell updates land immediately
    else if (request.mode === 'navigate' || request.destination === 'document' || url.pathname.endsWith('.html')) {
        event.respondWith(networkFirst(request));
    }
    // Handle static assets with cache-first strategy
    else {
        event.respondWith(cacheFirst(request));
    }
});

/**
 * Network-first strategy: Try network, fall back to cache
 * @param {Request} request - Fetch request
 * @returns {Promise<Response>} Response
 */
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // Network failed, try cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            console.log('📦 Serving from cache:', request.url);
            return cachedResponse;
        }
        
        // Return offline response
        return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
                'Content-Type': 'text/plain'
            })
        });
    }
}

/**
 * Cache-first strategy: Try cache, fall back to network
 * @param {Request} request - Fetch request
 * @returns {Promise<Response>} Response
 */
async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

// Background Sync API: Register sync event
self.addEventListener('sync', (event) => {
    console.log('🔄 Background sync event triggered:', event.tag);
    
    if (event.tag === SYNC_TAG) {
        event.waitUntil(performBackgroundSync());
    }
});

/**
 * Perform background synchronization
 * @returns {Promise<void>}
 */
async function performBackgroundSync() {
    try {
        console.log('🔄 Performing background sync...');
        
        // Open IndexedDB
        const db = await openIndexedDB();
        
        // Get pending operations
        const operations = await getPendingOperations(db);
        
        if (operations.length === 0) {
            console.log('✅ No pending sync operations');
            return;
        }
        
        console.log(`📦 Found ${operations.length} pending operations`);
        
        // Process operations
        let successCount = 0;
        let failedCount = 0;
        
        for (const operation of operations) {
            try {
                await syncToFirestore(operation);
                await markOperationSynced(db, operation.id);
                successCount++;
            } catch (error) {
                console.error('❌ Failed to sync operation:', error);
                await markOperationFailed(db, operation.id, error.message);
                failedCount++;
            }
        }
        
        console.log(`✅ Background sync completed: ${successCount} success, ${failedCount} failed`);
        
        // Notify all clients
        await notifyClients({
            type: 'SYNC_COMPLETE',
            success: successCount,
            failed: failedCount
        });
        
    } catch (error) {
        console.error('❌ Error in background sync:', error);
        throw error;
    }
}

/**
 * Open IndexedDB
 * @returns {Promise<IDBDatabase>} Database instance
 */
function openIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('ProdifyDB', 10);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get pending operations from sync queue
 * @param {IDBDatabase} db - Database instance
 * @returns {Promise<Array>} Pending operations
 */
function getPendingOperations(db) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['syncQueue'], 'readonly');
        const store = transaction.objectStore('syncQueue');
        const request = store.getAll();
        
        request.onsuccess = () => {
            const operations = request.result.filter(op => op.synced === 0);
            resolve(operations.slice(0, 20)); // Limit to 20
        };
        
        request.onerror = () => reject(request.error);
    });
}

/**
 * Sync operation to Firestore (simplified for Service Worker)
 * @param {Object} operation - Sync queue operation
 * @returns {Promise<void>}
 */
async function syncToFirestore(operation) {
    // This would need Firebase initialization in Service Worker
    // For now, just log. In production, use Firebase Admin SDK or REST API
    console.log('🔄 Syncing operation:', operation);
    
    // Placeholder: Make fetch request to Firebase REST API
    // const response = await fetch(`https://firestore.googleapis.com/v1/...`, {
    //     method: 'POST',
    //     body: JSON.stringify(operation.payload)
    // });
    
    return Promise.resolve();
}

/**
 * Mark operation as synced
 * @param {IDBDatabase} db - Database instance
 * @param {number} operationId - Operation ID
 * @returns {Promise<void>}
 */
function markOperationSynced(db, operationId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['syncQueue'], 'readwrite');
        const store = transaction.objectStore('syncQueue');
        const request = store.get(operationId);
        
        request.onsuccess = () => {
            const operation = request.result;
            operation.synced = true;
            operation.syncedAt = new Date().toISOString();
            
            const updateRequest = store.put(operation);
            updateRequest.onsuccess = () => resolve();
            updateRequest.onerror = () => reject(updateRequest.error);
        };
        
        request.onerror = () => reject(request.error);
    });
}

/**
 * Mark operation as failed
 * @param {IDBDatabase} db - Database instance
 * @param {number} operationId - Operation ID
 * @param {string} error - Error message
 * @returns {Promise<void>}
 */
function markOperationFailed(db, operationId, error) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['syncQueue'], 'readwrite');
        const store = transaction.objectStore('syncQueue');
        const request = store.get(operationId);
        
        request.onsuccess = () => {
            const operation = request.result;
            operation.retries = (operation.retries || 0) + 1;
            operation.error = error;
            operation.lastAttempt = new Date().toISOString();
            
            const updateRequest = store.put(operation);
            updateRequest.onsuccess = () => resolve();
            updateRequest.onerror = () => reject(updateRequest.error);
        };
        
        request.onerror = () => reject(request.error);
    });
}

/**
 * Notify all clients about sync completion
 * @param {Object} message - Message to send
 * @returns {Promise<void>}
 */
async function notifyClients(message) {
    const clients = await self.clients.matchAll({
        includeUncontrolled: true,
        type: 'window'
    });
    
    clients.forEach(client => {
        client.postMessage(message);
    });
}

// Handle messages from main thread
self.addEventListener('message', (event) => {
    // Safely handle event data
    if (!event.data || typeof event.data !== 'object') {
        console.log('Invalid message received:', event.data);
        return;
    }
    
    const { type, data } = event.data;
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'TRIGGER_SYNC':
            // Register a sync event
            self.registration.sync.register(SYNC_TAG).catch(console.error);
            break;
            
        case 'CLEAR_CACHE':
            caches.delete(CACHE_NAME).then(() => {
                if (event.ports && event.ports[0]) {
                    event.ports[0].postMessage({ success: true });
                }
            });
            break;
            
        default:
            console.log('Unknown message type:', type);
    }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'prodify-periodic-sync') {
        console.log('⏰ Periodic sync triggered');
        event.waitUntil(performBackgroundSync());
    }
});

// Push notification handling (for future use)
self.addEventListener('push', (event) => {
    console.log('📬 Push message received');
    
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Prodify';
    const options = {
        body: data.body || 'New update available',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        data: data
    };
    
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
    console.log('🔔 Notification clicked');
    
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow('/')
    );
});

console.log('✅ Service Worker script loaded');
