// ===== AVATAR SYSTEM MODULE (js/avatar.js) =====
// Predefined avatar selection with Firestore sync

const AvatarSystem = (function () {
    'use strict';

    // Predefined avatar icons - Productivity Themed
    const AVATARS = [
        '<i class="fa-solid fa-user"></i>', '<i class="fa-solid fa-laptop"></i>', '<i class="fa-solid fa-book"></i>', '<i class="fa-solid fa-file-pen"></i>', '<i class="fa-solid fa-calendar"></i>', '<i class="fa-solid fa-clock"></i>', '<i class="fa-solid fa-chart-simple"></i>', '<i class="fa-solid fa-arrow-trend-up"></i>',
        '<i class="fa-solid fa-lightbulb"></i>', '<i class="fa-solid fa-brain"></i>', '<i class="fa-solid fa-bullseye"></i>', '<i class="fa-solid fa-trophy"></i>', '<i class="fa-solid fa-star"></i>', '<i class="fa-solid fa-graduation-cap"></i>', '<i class="fa-solid fa-briefcase"></i>', '<i class="fa-solid fa-battery-full"></i>',
        '<i class="fa-solid fa-bolt"></i>', '<i class="fa-solid fa-hourglass"></i>', '<i class="fa-solid fa-glasses"></i>', '<i class="fa-solid fa-pen"></i>', '<i class="fa-solid fa-check"></i>', '<i class="fa-solid fa-rocket"></i>', '<i class="fa-solid fa-book-journal-whills"></i>', '<i class="fa-solid fa-thumbtack"></i>'
    ];

    const STORAGE_KEY = 'prodify_avatar';
    let currentAvatar = '<i class="fa-solid fa-user"></i>';

    // ─── Load / Save ────────────────────────────────────────────────────

    function loadAvatar() {
        // Local first
        const local = localStorage.getItem(STORAGE_KEY);
        if (local) currentAvatar = local;
        applyAvatar();

        // Firestore
        loadFromFirestore();
    }

    function saveAvatar(emoji) {
        currentAvatar = emoji;
        localStorage.setItem(STORAGE_KEY, emoji);
        applyAvatar();
        saveToFirestore();
        updateAvatarPickerUI();
    }

    async function loadFromFirestore() {
        if (!currentUserId || typeof firebase === 'undefined') return;

        // Check if online before fetching from Firestore
        if (!navigator.onLine) {
            console.log('ℹ️ Avatar: Offline, using cached avatar');
            return;
        }
        
        try {
            const doc = await firebase.firestore()
                .collection('users').doc(currentUserId)
                .get();

            if (doc.exists && doc.data().avatarURL) {
                currentAvatar = doc.data().avatarURL;
                localStorage.setItem(STORAGE_KEY, currentAvatar);
                applyAvatar();
                updateAvatarPickerUI();
            }
        } catch (err) {
            // Only log error if not offline-related
            if (err.code !== 'unavailable' && !err.message.includes('offline')) {
                console.warn('Avatar: Firestore load failed', err);
            } else {
                console.log('ℹ️ Avatar: Offline, using cached avatar');
            }
        }
    }

    async function saveToFirestore() {
        if (!currentUserId || typeof firebase === 'undefined') return;

        try {
            await firebase.firestore()
                .collection('users').doc(currentUserId)
                .set({ avatarURL: currentAvatar }, { merge: true });
        } catch (err) {
            console.warn('Avatar: Firestore save failed', err);
        }
    }

    // ─── Apply Avatar to UI ─────────────────────────────────────────────

    function applyAvatar() {
        // Profile modal avatar
        const profileAvatar = document.querySelector('.profile-avatar');
        if (profileAvatar) {
            if (currentAvatar.startsWith('http') || currentAvatar.startsWith('data:')) {
                // It's an image
                profileAvatar.innerHTML = '';
                profileAvatar.style.backgroundImage = `url('${currentAvatar}')`;
                profileAvatar.style.backgroundSize = 'cover';
                profileAvatar.style.backgroundPosition = 'center';
            } else {
                // It's an FA icon
                profileAvatar.style.backgroundImage = '';
                profileAvatar.innerHTML = currentAvatar;
            }
        }

        // Apply to any other avatar instances if they exist
        const sidebarAvatar = document.querySelector('.sidebar-avatar');
        if (sidebarAvatar) {
             if (currentAvatar.startsWith('http') || currentAvatar.startsWith('data:')) {
                sidebarAvatar.innerHTML = '';
                sidebarAvatar.style.backgroundImage = `url('${currentAvatar}')`;
                sidebarAvatar.style.backgroundSize = 'cover';
                sidebarAvatar.style.backgroundPosition = 'center';
            } else {
                sidebarAvatar.style.backgroundImage = '';
                sidebarAvatar.innerHTML = currentAvatar;
            }
        }
    }

    // ─── UI: Avatar Picker ──────────────────────────────────────────────

    function renderAvatarPicker() {
        const container = document.getElementById('avatarPicker');
        if (!container) return;

        let html = '';

        // Check if current is one of the defaults
        const isDefault = AVATARS.includes(currentAvatar);
        const isCustom = !isDefault;

        // 1. "+" Button for Upload
        html += `
            <button class="avatar-option" id="addPhotoBtn" title="Upload Photo"
                    style="border: 2px dashed var(--accent-color); color: var(--accent-color); background: var(--accent-surface); display:flex; align-items:center; justify-content:center;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
            </button>
            <input type="file" id="avatarUploadInput" accept="image/*" style="display: none;">
        `;

        // Helper: escape HTML for use inside data attributes
        function escAttr(str) {
            return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        // 2. If Current is Custom (uploaded image), show it first
        if (isCustom) {
             const isImg = currentAvatar.startsWith('data:') || currentAvatar.startsWith('http');
             if (isImg) {
                html += `
                <button class="avatar-option active custom-avatar-btn" 
                        data-avatar="${escAttr(currentAvatar)}" 
                        style="background-image: url('${currentAvatar}'); background-size: cover; background-position: center; color: transparent;">
                </button>
                `;
             } else {
                 // Custom emoji fallback
                html += `<button class="avatar-option active" data-avatar="${escAttr(currentAvatar)}">${currentAvatar}</button>`;
             }
        }

        // 3. Render Defaults
        html += AVATARS.map(emoji => `
            <button class="avatar-option ${emoji === currentAvatar ? 'active' : ''}"
                    data-avatar="${escAttr(emoji)}">
                ${emoji}
            </button>
        `).join('');

        container.innerHTML = html;

        // Attach Standard Handlers
        container.querySelectorAll('.avatar-option[data-avatar]').forEach(btn => {
            btn.addEventListener('click', () => {
                saveAvatar(btn.dataset.avatar);
            });
        });

        // Attach Upload Handlers
        const addBtn = document.getElementById('addPhotoBtn');
        const uploadInput = document.getElementById('avatarUploadInput');

        if (addBtn && uploadInput) {
            addBtn.addEventListener('click', (e) => {
                e.preventDefault();
                uploadInput.click();
            });

            uploadInput.addEventListener('change', handleFileUpload);
        }
    }

    let cropper = null;

    function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file || !file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (event) => {
             // Open Cropper Modal
             openCropperModal(event.target.result);
        };
        reader.readAsDataURL(file);
        
        // Reset input so same file can be selected again
        e.target.value = '';
    }

    function openCropperModal(imageSrc) {
        const modal = document.getElementById('cropModal');
        const image = document.getElementById('cropImage');
        const cancelBtn = document.getElementById('cancelCropBtn');
        const confirmBtn = document.getElementById('confirmCropBtn');

        if (!modal || !image) return;

        // Reset image src
        image.src = imageSrc;
        modal.style.display = 'flex';
        // Add show class for transition
        setTimeout(() => modal.classList.add('show'), 10);

        // Determine when to initialize Cropper
        const initCropper = function() { // use function expression for clarity
             // Prevent double init if called via both onload and complete check
             if (image.dataset.cropperInit === 'true') return;
             image.dataset.cropperInit = 'true';

             if (cropper) {
                 cropper.destroy();
             }
             
             // Wrap in requestAnimationFrame to ensure layout is ready
             requestAnimationFrame(() => {
                 cropper = new Cropper(image, {
                    aspectRatio: 1, // Square
                    viewMode: 1,
                    dragMode: 'move',
                    autoCropArea: 0.8,
                    restore: false,
                    guides: false,
                    center: true,
                    highlight: false,
                    cropBoxMovable: true,
                    cropBoxResizable: true,
                    toggleDragModeOnDblclick: false,
                    minContainerHeight: 250,
                    background: false
                });
             });
        };

        // Reset init flag
        image.dataset.cropperInit = 'false';
        
        // Wait for image to load to ensure dimensions are ready
        image.onload = initCropper;
        
        // Handle case where image is already loaded (from cache)
        if (image.complete) {
            image.onload();
        }

        // Handlers without duplicating
        const close = () => {
             modal.classList.remove('show');
             setTimeout(() => {
                 modal.style.display = 'none';
                 if (cropper) {
                     cropper.destroy();
                     cropper = null;
                 }
                 // Clear src to prevent flicker on reopen
                 image.src = '';
             }, 300);
        };

        cancelBtn.onclick = close;

        confirmBtn.onclick = () => {
            if (!cropper) return;
            
            // Get cropped canvas
            const canvas = cropper.getCroppedCanvas({
                width: 300,
                height: 300,
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high',
            });

            if (canvas) {
                // Compress to JPEG
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                saveAvatar(dataUrl);
            }
            close();
        };
    }
    
    function updateAvatarPickerUI() {
        // Full re-render needed to show/hide custom avatar slot properly
        renderAvatarPicker();
    }

    // ─── Init ───────────────────────────────────────────────────────────

    function init() {
        loadAvatar();
        renderAvatarPicker();
    }

    return {
        init,
        getAvatars: () => [...AVATARS],
        getCurrentAvatar: () => currentAvatar,
        saveAvatar,
        renderAvatarPicker
    };
})();
