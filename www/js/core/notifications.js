// ===== PREMIUM NOTIFICATION SYSTEM (notifications.js) =====
// Stylish, stackable in-app toast notifications with glassmorphism design

const Notify = (function () {
    'use strict';

    let container = null;
    let notifQueue = [];
    const MAX_VISIBLE = 4;
    const DEFAULT_DURATION = 3500;

    // Notification type configs
    const TYPES = {
        success: {
            icon: '<i class="fa-solid fa-circle-check"></i>',
            class: 'notif--success',
            defaultTitle: 'Success'
        },
        error: {
            icon: '<i class="fa-solid fa-circle-xmark"></i>',
            class: 'notif--error',
            defaultTitle: 'Error'
        },
        warning: {
            icon: '<i class="fa-solid fa-triangle-exclamation"></i>',
            class: 'notif--warning',
            defaultTitle: 'Warning'
        },
        info: {
            icon: '<i class="fa-solid fa-circle-info"></i>',
            class: 'notif--info',
            defaultTitle: 'Info'
        },
        achievement: {
            icon: '<i class="fa-solid fa-trophy"></i>',
            class: 'notif--achievement',
            defaultTitle: 'Achievement Unlocked!'
        },
        xp: {
            icon: '<i class="fa-solid fa-star"></i>',
            class: 'notif--xp',
            defaultTitle: 'XP Earned'
        }
    };

    // ─── Initialize ─────────────────────────────────────────────────
    function init() {
        if (container) return;
        container = document.createElement('div');
        container.id = 'notifContainer';
        container.className = 'notif-container';
        document.body.appendChild(container);
    }

    // ─── Core Show Function ─────────────────────────────────────────
    function show(type, message, options = {}) {
        init(); // Ensure container exists

        const config = TYPES[type] || TYPES.info;
        const title = options.title || config.defaultTitle;
        const duration = options.duration || DEFAULT_DURATION;
        const icon = options.icon || config.icon;
        const customEmoji = options.emoji || null;

        // Create notification element
        const notif = document.createElement('div');
        notif.className = `notif-toast ${config.class}`;

        notif.innerHTML = `
            <div class="notif-progress" style="animation-duration: ${duration}ms"></div>
            <div class="notif-body">
                <div class="notif-icon-wrap">
                    ${customEmoji ? `<span class="notif-emoji">${customEmoji}</span>` : icon}
                </div>
                <div class="notif-content">
                    <span class="notif-title">${title}</span>
                    <span class="notif-message">${message}</span>
                </div>
                <button class="notif-close" aria-label="Dismiss">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `;

        // Close button handler
        notif.querySelector('.notif-close').addEventListener('click', () => dismiss(notif));

        // Swipe to dismiss (touch)
        let startX = 0;
        let currentX = 0;
        notif.addEventListener('touchstart', (e) => {
            if (!e.touches || e.touches.length === 0) return;
            startX = e.touches[0].clientX;
            notif.style.transition = 'none';
        }, { passive: true });

        notif.addEventListener('touchmove', (e) => {
            if (!e.touches || e.touches.length === 0) return;
            currentX = e.touches[0].clientX;
            const diff = currentX - startX;
            if (diff > 0) {
                notif.style.transform = `translateX(${diff}px)`;
                notif.style.opacity = Math.max(0, 1 - diff / 200);
            }
        }, { passive: true });

        notif.addEventListener('touchend', () => {
            const diff = currentX - startX;
            notif.style.transition = '';
            if (diff > 80) {
                dismiss(notif);
            } else {
                notif.style.transform = '';
                notif.style.opacity = '';
            }
            startX = 0;
            currentX = 0;
        });

        // Add to container
        container.appendChild(notif);

        // Trigger entrance animation
        requestAnimationFrame(() => {
            notif.classList.add('notif-enter');
        });

        // Manage max visible
        const toasts = container.querySelectorAll('.notif-toast');
        if (toasts.length > MAX_VISIBLE) {
            dismiss(toasts[0]);
        }

        // Auto dismiss
        const timer = setTimeout(() => dismiss(notif), duration);
        notif._timer = timer;

        // Pause timer on hover
        notif.addEventListener('mouseenter', () => {
            clearTimeout(notif._timer);
            const progress = notif.querySelector('.notif-progress');
            if (progress) progress.style.animationPlayState = 'paused';
        });

        notif.addEventListener('mouseleave', () => {
            const progress = notif.querySelector('.notif-progress');
            if (progress) progress.style.animationPlayState = 'running';
            notif._timer = setTimeout(() => dismiss(notif), 1500);
        });

        return notif;
    }

    // ─── Dismiss ────────────────────────────────────────────────────
    function dismiss(notif) {
        if (!notif || notif._dismissing) return;
        notif._dismissing = true;
        clearTimeout(notif._timer);

        notif.classList.add('notif-exit');
        notif.addEventListener('animationend', () => {
            notif.remove();
        }, { once: true });

        // Fallback removal
        setTimeout(() => {
            if (notif.parentNode) notif.remove();
        }, 500);
    }

    // ─── Convenience Methods ────────────────────────────────────────
    function success(message, options = {}) {
        return show('success', message, options);
    }

    function error(message, options = {}) {
        return show('error', message, { duration: 4500, ...options });
    }

    function warning(message, options = {}) {
        return show('warning', message, options);
    }

    function info(message, options = {}) {
        return show('info', message, options);
    }

    function achievement(title, description, emoji) {
        return show('achievement', description, {
            title: title,
            emoji: emoji,
            duration: 4500
        });
    }

    function xp(amount, reason) {
        return show('xp', reason, {
            title: `+${amount} XP`,
            duration: 2500
        });
    }

    // ─── Public API ─────────────────────────────────────────────────
    return {
        init,
        show,
        success,
        error,
        warning,
        info,
        achievement,
        xp,
        dismiss
    };
})();
