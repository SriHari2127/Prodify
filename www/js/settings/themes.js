// ===== CUSTOM THEMES MODULE (js/themes.js) =====
// Extends existing dark/light toggle with accent color picker & Firestore sync
// Does NOT rewrite the existing applyTheme() — works alongside it

const ThemeManager = (function () {
    'use strict';

    // Predefined accent color palette with RGB values for alpha compositing
    const ACCENT_COLORS = [
        { id: 'royal-indigo',  hex: '#4F46E5', rgb: '79, 70, 229',   hover: '#4338CA', name: 'Royal Indigo' },
        { id: 'emerald-green', hex: '#10B981', rgb: '16, 185, 129',  hover: '#059669', name: 'Emerald Green' },
        { id: 'electric-blue', hex: '#2563EB', rgb: '37, 99, 235',   hover: '#1D4ED8', name: 'Electric Blue' },
        { id: 'sunset-orange', hex: '#F97316', rgb: '249, 115, 22',  hover: '#EA580C', name: 'Sunset Orange' },
        { id: 'deep-violet',   hex: '#7C3AED', rgb: '124, 58, 237',  hover: '#6D28D9', name: 'Deep Violet' },
        { id: 'teal-fusion',   hex: '#14B8A6', rgb: '20, 184, 166',  hover: '#0D9488', name: 'Teal Fusion' }
    ];

    const STORAGE_KEY = 'prodify_accentColor';
    const RECENT_COLORS_KEY = 'prodify_recentColors';
    let currentAccent = 'royal-indigo';
    let pickrInstance = null;

    // ─── Helpers for Custom Colors ──────────────────────────────────────
    function hexToRgb(hex) {
        hex = hex.replace(/^#/, '');
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const num = parseInt(hex, 16);
        return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
    }

    function darkenHex(hex, percent) {
        const rgb = hexToRgb(hex);
        const r = Math.max(0, Math.floor(rgb.r * (1 - percent)));
        const g = Math.max(0, Math.floor(rgb.g * (1 - percent)));
        const b = Math.max(0, Math.floor(rgb.b * (1 - percent)));
        return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
    }

    function getColorObject(colorId) {
        let color = ACCENT_COLORS.find(c => c.id === colorId);
        if (color) return color;
        // If it's a hex code create a custom color object dynamically
        if (colorId && colorId.startsWith('#')) {
            const rgbInfo = hexToRgb(colorId);
            return {
                id: colorId,
                hex: colorId,
                rgb: `${rgbInfo.r}, ${rgbInfo.g}, ${rgbInfo.b}`,
                hover: darkenHex(colorId, 0.15),
                name: 'Custom'
            };
        }
        return ACCENT_COLORS[0]; // fallback
    }

    function getRecentColors() {
        try {
            return JSON.parse(localStorage.getItem(RECENT_COLORS_KEY)) || [];
        } catch {
            return [];
        }
    }

    function addRecentColor(hex) {
        let recents = getRecentColors();
        // Remove if exists to move to front
        recents = recents.filter(c => c.toLowerCase() !== hex.toLowerCase());
        recents.unshift(hex);
        if (recents.length > 6) recents.pop(); // keep max 6
        localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(recents));
        renderRecentColors();
    }

    // ─── Apply Accent Color (CSS Variable) ──────────────────────────────

    function applyAccentColor(colorId) {
        const color = getColorObject(colorId);
        if (!color) return;

        currentAccent = color.id;
        
        // Update all accent-related CSS variables on BOTH html and body
        // Body is strictly necessary to override 'body.light' CSS rules
        const targets = [document.documentElement];
        if (document.body) targets.push(document.body);

        targets.forEach(target => {
            target.style.setProperty('--accent-color', color.hex);
            target.style.setProperty('--accent-rgb', color.rgb);
            target.style.setProperty('--accent-hover', color.hover);
            target.style.setProperty('--accent-light', `rgba(${color.rgb}, 0.10)`);
            target.style.setProperty('--accent-muted', `rgba(${color.rgb}, 0.06)`);
            target.style.setProperty('--accent-surface', `rgba(${color.rgb}, 0.06)`);
            target.style.setProperty('--accent-surface-hover', `rgba(${color.rgb}, 0.10)`);
            target.style.setProperty('--accent-border', `rgba(${color.rgb}, 0.20)`);
            target.style.setProperty('--progress-track', `rgba(${color.rgb}, 0.15)`);
            target.style.setProperty('--accent-glow', `0 0 20px rgba(${color.rgb}, 0.25)`);
            target.style.setProperty('--focus-ring', `0 0 0 2px rgba(${color.rgb}, 0.25)`);
            target.style.setProperty('--hover-bg', `rgba(${color.rgb}, 0.08)`);
        });

        // Also update the meta theme-color
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) metaTheme.setAttribute('content', color.hex);
    }

    // ─── Persistence ────────────────────────────────────────────────────

    function loadAccentColor() {
        // Local first (instant)
        const local = localStorage.getItem(STORAGE_KEY);
        if (local) {
            // Check if it's a default color or hex code
            const isStandard = ACCENT_COLORS.some(c => c.id === local);
            if (isStandard || local.startsWith('#')) {
                currentAccent = local;
                applyAccentColor(currentAccent);
            }
        }

        // Sync from Firestore
        loadFromFirestore();
    }

    function saveAccentColor(colorId) {
        currentAccent = colorId;
        localStorage.setItem(STORAGE_KEY, colorId);
        applyAccentColor(colorId);
        saveToFirestore();
        updateColorPickerUI();
    }

    async function loadFromFirestore() {
        if (!currentUserId || typeof firebase === 'undefined') return;

        try {
            // Check if online before fetching from Firestore
            if (!navigator.onLine) {
                console.log('ℹ️ Themes: Offline, using cached settings');
                return;
            }
            
            const doc = await firebase.firestore()
                .collection('users').doc(currentUserId)
                .get();

            if (doc.exists && doc.data().settings?.accentColor) {
                const fsColor = doc.data().settings.accentColor;
                const isStandard = ACCENT_COLORS.some(c => c.id === fsColor);
                if (isStandard || (fsColor && fsColor.startsWith('#'))) {
                    currentAccent = fsColor;
                    localStorage.setItem(STORAGE_KEY, fsColor);
                    applyAccentColor(fsColor);
                    updateColorPickerUI();
                }
            }
        } catch (err) {
            // Only log error if not offline-related
            if (err.code !== 'unavailable' && !err.message.includes('offline')) {
                console.warn('Themes: Firestore load failed', err);
            } else {
                console.log('ℹ️ Themes: Offline, using cached settings');
            }
        }
    }

    async function saveToFirestore() {
        if (!currentUserId || typeof firebase === 'undefined') return;

        try {
            const currentTheme = localStorage.getItem('theme') || 'light';
            await firebase.firestore()
                .collection('users').doc(currentUserId)
                .set({
                    settings: {
                        mode: currentTheme,
                        accentColor: currentAccent
                    }
                }, { merge: true });
        } catch (err) {
            console.warn('Themes: Firestore save failed', err);
        }
    }

    // ─── UI: Color Picker in Profile ────────────────────────────────────

    function renderColorPicker() {
        const container = document.getElementById('accentColorPicker');
        if (!container) return;

        const html = ACCENT_COLORS.map(color => `
            <button class="color-swatch ${color.id === currentAccent ? 'active' : ''}"
                    data-color="${color.id}"
                    title="${color.name}"
                    style="background-color: ${color.hex};">
                ${color.id === currentAccent ? '<i class="fa-solid fa-check" style="font-size:11px;"></i>' : ''}
            </button>
        `).join('');

        container.innerHTML = html;

        // Attach handlers
        container.querySelectorAll('.color-swatch').forEach(btn => {
            btn.addEventListener('click', () => {
                saveAccentColor(btn.dataset.color);
            });
        });

        // Setup advanced color picker
        const customInput = document.getElementById('customColorInput');
        const customHexInput = document.getElementById('customHexInput');

        if (customInput && typeof Pickr !== 'undefined') {
            const initialHex = currentAccent.startsWith('#') ? currentAccent : getColorObject(currentAccent).hex;
            
            if (pickrInstance) {
                pickrInstance.destroyAndRemove();
            }

            // Create container for pickr
            customInput.innerHTML = '<div class="pickr-container"></div>';

            pickrInstance = Pickr.create({
                el: customInput.querySelector('.pickr-container'),
                theme: 'nano', // Clean minimal theme fitting profile
                default: initialHex,
                swatches: null,
                components: {
                    preview: true,
                    opacity: false,
                    hue: true,
                    interaction: {
                        hex: true,
                        input: true,
                        save: true
                    }
                },
                strings: {
                    save: '✔' // small tick button to save
                }
            });

            pickrInstance.on('change', (color, source, instance) => {
                const hex = color.toHEXA().toString();
                if (customHexInput) customHexInput.value = hex.toUpperCase();
                saveAccentColor(hex);
            });

            pickrInstance.on('save', (color, instance) => {
                const hex = color.toHEXA().toString();
                addRecentColor(hex);
                instance.hide();
            });
        } else if (customInput) {
            // Fallback: Native Color Input
            const initialHex = currentAccent.startsWith('#') ? currentAccent : getColorObject(currentAccent).hex;
            customInput.value = initialHex;
            if (customHexInput) customHexInput.value = initialHex.toUpperCase();

            customInput.addEventListener('input', (e) => {
                const hex = e.target.value;
                if (customHexInput) customHexInput.value = hex.toUpperCase();
                saveAccentColor(hex);
            });
            
            customInput.addEventListener('change', (e) => {
                addRecentColor(e.target.value);
            });
        }

        if (customHexInput) {
            customHexInput.addEventListener('input', (e) => {
                let hex = e.target.value;
                if (!hex.startsWith('#')) hex = '#' + hex;
                if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
                    if (pickrInstance) {
                        pickrInstance.setColor(hex);
                    } else if (customInput) {
                        customInput.value = hex;
                    }
                    saveAccentColor(hex);
                }
            });
            customHexInput.addEventListener('change', (e) => {
                let hex = e.target.value;
                if (!hex.startsWith('#')) hex = '#' + hex;
                if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
                    addRecentColor(hex);
                }
            });
        }

        const customColorOkBtn = document.getElementById('customColorOkBtn');
        if (customColorOkBtn && customHexInput) {
            customColorOkBtn.addEventListener('click', () => {
                let hex = customHexInput.value;
                if (!hex.startsWith('#')) hex = '#' + hex;
                if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
                    if (pickrInstance) {
                        pickrInstance.setColor(hex, true);
                    } else if (customInput) {
                        customInput.value = hex;
                    }
                    saveAccentColor(hex);
                    addRecentColor(hex);
                    
                    // Visual feedback
                    const originalText = customColorOkBtn.textContent;
                    customColorOkBtn.textContent = 'Saved!';
                    customColorOkBtn.style.opacity = '0.7';
                    setTimeout(() => {
                        customColorOkBtn.textContent = originalText;
                        customColorOkBtn.style.opacity = '1';
                    }, 1000);
                }
            });
        }
        
        renderRecentColors();
    }

    function renderRecentColors() {
        const container = document.getElementById('recentColorsContainer');
        const section = document.getElementById('recentColorsSection');
        if (!container) return;

        const recents = getRecentColors();
        
        if (recents.length === 0) {
            if (section) section.style.display = 'none';
            container.innerHTML = '';
            return;
        }

        if (section) section.style.display = 'block';

        const html = recents.map(hex => `
            <button class="color-swatch recent-swatch ${hex.toLowerCase() === currentAccent.toLowerCase() ? 'active' : ''}"
                    data-color="${hex}"
                    title="${hex.toUpperCase()}"
                    style="background-color: ${hex};">
                ${hex.toLowerCase() === currentAccent.toLowerCase() ? '<i class="fa-solid fa-check" style="font-size:10px;"></i>' : ''}
            </button>
        `).join('');

        container.innerHTML = html;

        // Attach handlers to recents
        container.querySelectorAll('.color-swatch').forEach(btn => {
            btn.addEventListener('click', () => {
                saveAccentColor(btn.dataset.color);
            });
        });
    }

    function updateColorPickerUI() {
        // Update Default swatches
        const container = document.getElementById('accentColorPicker');
        if (container) {
            container.querySelectorAll('.color-swatch').forEach(btn => {
                const isActive = btn.dataset.color === currentAccent;
                btn.classList.toggle('active', isActive);
                btn.innerHTML = isActive ? '<i class="fa-solid fa-check" style="font-size:11px;"></i>' : '';
            });
        }

        // Update Custom input matching
        const customInput = document.getElementById('customColorInput');
        const customHexInput = document.getElementById('customHexInput');
        
        const hexVal = currentAccent.startsWith('#') ? currentAccent : getColorObject(currentAccent).hex;
        if (customHexInput) customHexInput.value = hexVal.toUpperCase();

        if (customInput) {
            if (pickrInstance) {
                // Prevent recursive event firing during UI update
                pickrInstance.setColor(hexVal, true); // true = silent, doesn't trigger 'change'
            } else {
                customInput.value = hexVal;
            }
        }

        // Re-render recent entirely to reflect current checkmark
        renderRecentColors();
    }

    // ─── Init ───────────────────────────────────────────────────────────

    function init() {
        loadAccentColor();
        renderColorPicker();
    }

    // ─── Public API ─────────────────────────────────────────────────────

    return {
        init,
        getAccentColors: () => [...ACCENT_COLORS],
        getCurrentAccent: () => currentAccent,
        saveAccentColor,
        renderColorPicker,
        applyAccentColor
    };
})();

// ─── Immediate Accent Color Application ─────────────────────────────────
// Apply accent color from localStorage immediately (before auth completes)
(function() {
    const stored = localStorage.getItem('prodify_accentColor');
    if (stored && typeof ThemeManager !== 'undefined') {
        ThemeManager.applyAccentColor(stored);
    }
})();