// ===== Authentication & UI State =====

let isLoginMode = true;
let isNewlySignedUp = false; // Flag to determine if we should migrate data

// Helper: detect Capacitor native platform
function isNativePlatform() {
    return typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
}

document.addEventListener("DOMContentLoaded", function () {
    // ─── Handle Google Sign-In redirect result (fires after signInWithRedirect completes) ───
    if (typeof firebase !== 'undefined') {
        firebase.auth().getRedirectResult()
            .then((result) => {
                if (result && result.user) {
                    console.log('✅ Google redirect sign-in success:', result.user.uid);
                }
                // Remove loading state from Google button if present
                const gBtn = document.getElementById('authGoogleBtn');
                if (gBtn) gBtn.classList.remove('loading');
            })
            .catch((error) => {
                // Silence network errors when offline - this is expected behavior
                if (error.code === 'auth/network-request-failed') {
                    console.log('ℹ️ Auth: No network connection, using offline mode');
                    const gBtn = document.getElementById('authGoogleBtn');
                    if (gBtn) gBtn.classList.remove('loading');
                    return;
                }
                
                console.error('Google redirect sign-in error:', error.message);
                const gBtn = document.getElementById('authGoogleBtn');
                if (gBtn) gBtn.classList.remove('loading');
                const errorMsg = document.getElementById('authErrorMsg');
                if (errorMsg && error.code !== 'auth/popup-closed-by-user') {
                    errorMsg.textContent = getGoogleSignInErrorMessage(error);
                    errorMsg.style.display = 'block';
                }
            });
    }
    const authContainer = document.getElementById("authContainer");
    const appContainer = document.getElementById("appContainer");

    const authTitle = document.getElementById("authTitle");
    const authEmail = document.getElementById("authEmail");
    const authPassword = document.getElementById("authPassword");
    const authSubmitBtn = document.getElementById("authSubmitBtn");
    const authAnonymousBtn = document.getElementById("authAnonymousBtn");
    const authSwitchPrompt = document.getElementById("authSwitchPrompt");
    const authSwitchLink = document.getElementById("authSwitchLink");
    const togglePasswordBtn = document.getElementById("togglePassword");
    const forgotPasswordLink = document.getElementById("forgotPasswordLink");
    const authForgotRow = document.getElementById("authForgotRow");

    // Note: Body is visible by default; splash screen covers it initially

    // Password visibility toggle
    if (togglePasswordBtn && authPassword) {
        togglePasswordBtn.addEventListener("click", () => {
            const isPassword = authPassword.type === "password";
            authPassword.type = isPassword ? "text" : "password";
            togglePasswordBtn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
            const eyeIcon = document.getElementById("eyeIcon");
            if (eyeIcon) {
                eyeIcon.innerHTML = isPassword
                    ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path><line x1="1" y1="1" x2="23" y2="23"></line>'
                    : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
            }
        });
    }

    // Toggle between Login and Signup modes
    if (authSwitchLink) {
        authSwitchLink.addEventListener("click", (e) => {
            e.preventDefault();
            isLoginMode = !isLoginMode;

            if (isLoginMode) {
                authTitle.textContent = "Login to Prodify";
                authSubmitBtn.textContent = "Login";
                authSwitchPrompt.textContent = "Don't have an account?";
                authSwitchLink.textContent = "Sign up";
                if (authForgotRow) authForgotRow.style.display = "flex";
            } else {
                authTitle.textContent = "Create an Account";
                authSubmitBtn.textContent = "Sign Up";
                authSwitchPrompt.textContent = "Already have an account?";
                authSwitchLink.textContent = "Login";
                if (authForgotRow) authForgotRow.style.display = "none";
            }

            // Clear any lingering errors
            const authErrorMsg = document.getElementById("authErrorMsg");
            if (authErrorMsg) authErrorMsg.style.display = "none";
        });
    }

    // Handle Auth Submit
    if (authSubmitBtn) {
        authSubmitBtn.addEventListener("click", () => {
            const email = authEmail.value.trim();
            const password = authPassword.value.trim();
            const errorMsg = document.getElementById("authErrorMsg");

            // Hide old errors first
            if (errorMsg) errorMsg.style.display = "none";

            if (!email || !password) {
                if (errorMsg) {
                    errorMsg.textContent = "Please enter both email and password.";
                    errorMsg.style.display = "block";
                }
                return;
            }

            if (isLoginMode) {
                handleLogin(email, password, authSubmitBtn);
            } else {
                handleSignup(email, password, authSubmitBtn);
            }
        });

        // Allow pressing Enter to submit
        const enterToSubmit = (e) => {
            if (e.key === "Enter") authSubmitBtn.click();
        };

        if (authEmail) authEmail.addEventListener("keypress", enterToSubmit);
        if (authPassword) authPassword.addEventListener("keypress", enterToSubmit);
    }

    // Handle Anonymous Login
    if (authAnonymousBtn) {
        authAnonymousBtn.addEventListener("click", () => {
            firebase.auth().signInAnonymously().catch(error => {
                // Graceful handling for network errors
                if (error.code === 'auth/network-request-failed') {
                    console.log('ℹ️ Auth: No network connection for anonymous sign-in');
                    if (typeof Notify !== 'undefined') {
                        Notify.error('No internet connection. Please check your network and try again.');
                    } else {
                        alert('No internet connection. Please check your network and try again.');
                    }
                    return;
                }
                
                console.error("Auth error:", error.message);
                if (typeof Notify !== 'undefined') Notify.error(error.message); else alert("Error: " + error.message);
            });
        });
    }

    // Handle Google Sign-In (native on Android, redirect on web)
    const authGoogleBtn = document.getElementById("authGoogleBtn");
    if (authGoogleBtn) {
        authGoogleBtn.addEventListener("click", async () => {
            authGoogleBtn.classList.add("loading");

            // Hide old errors
            const errorMsg = document.getElementById("authErrorMsg");
            if (errorMsg) errorMsg.style.display = "none";

            // Web Client ID from Firebase/Google Cloud Console
            const WEB_CLIENT_ID = "769404048438-307el276svj7rr81e8fvgpaps1t8j114.apps.googleusercontent.com";

            if (isNativePlatform() && Capacitor.Plugins.GoogleSignInNative) {
                // ── Native Android: use native Google Sign-In (Chrome Custom Tabs) ──
                try {
                    console.log('📱 Google Sign-In: using native flow');
                    const result = await Capacitor.Plugins.GoogleSignInNative.signIn({
                        webClientId: WEB_CLIENT_ID
                    });

                    // Use the ID token to sign in with Firebase
                    const credential = firebase.auth.GoogleAuthProvider.credential(result.idToken);
                    await firebase.auth().signInWithCredential(credential);
                    console.log('✅ Google native sign-in success');
                    authGoogleBtn.classList.remove("loading");
                } catch (error) {
                    console.error("Google native sign-in error:", error);
                    authGoogleBtn.classList.remove("loading");
                    if (errorMsg) {
                        const msg = (error && error.message) || 'Google Sign-In failed. Please try again.';
                        // Don't show error for user cancellation
                        if (!msg.includes('cancelled')) {
                            errorMsg.textContent = msg;
                            errorMsg.style.display = "block";
                        }
                    }
                }
            } else {
                // ── Web browser: use signInWithRedirect ──
                console.log('🌐 Google Sign-In: using redirect flow');
                const provider = new firebase.auth.GoogleAuthProvider();
                provider.addScope('email');
                provider.addScope('profile');
                firebase.auth().signInWithRedirect(provider)
                    .catch((error) => {
                        // Graceful handling for network errors
                        if (error.code === 'auth/network-request-failed') {
                            console.log('ℹ️ Auth: No network connection for Google sign-in');
                            authGoogleBtn.classList.remove("loading");
                            if (errorMsg) {
                                errorMsg.textContent = "No internet connection. Please check your network and try again.";
                                errorMsg.style.display = "block";
                            }
                            return;
                        }
                        
                        console.error("Google sign-in redirect error:", error.message);
                        authGoogleBtn.classList.remove("loading");
                        if (errorMsg) {
                            errorMsg.textContent = getGoogleSignInErrorMessage(error);
                            errorMsg.style.display = "block";
                        }
                    });
            }
        });
    }

    // Handle Forgot Password
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener("click", (e) => {
            e.preventDefault();
            const email = authEmail ? authEmail.value.trim() : "";
            const errorMsg = document.getElementById("authErrorMsg");

            if (!email) {
                if (errorMsg) {
                    errorMsg.textContent = "Please enter your email address first.";
                    errorMsg.style.display = "block";
                }
                return;
            }

            // Hide old errors
            if (errorMsg) errorMsg.style.display = "none";

            firebase.auth().sendPasswordResetEmail(email)
                .then(() => {
                    if (errorMsg) {
                        errorMsg.style.color = "#10b981";
                        errorMsg.style.borderColor = "rgba(16, 185, 129, 0.2)";
                        errorMsg.style.background = "rgba(16, 185, 129, 0.08)";
                        errorMsg.textContent = "Password reset email sent! Check your inbox.";
                        errorMsg.style.display = "block";
                        // Reset colors after 5 seconds
                        setTimeout(() => {
                            errorMsg.style.display = "none";
                            errorMsg.style.color = "";
                            errorMsg.style.borderColor = "";
                            errorMsg.style.background = "";
                        }, 5000);
                    }
                })
                .catch((error) => {
                    if (errorMsg) {
                        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') {
                            errorMsg.textContent = "No account found with this email.";
                        } else if (error.code === 'auth/too-many-requests') {
                            errorMsg.textContent = "Too many requests. Please try again later.";
                        } else {
                            errorMsg.textContent = "Could not send reset email. Please try again.";
                        }
                        errorMsg.style.display = "block";
                    }
                });
        });
    }

});

// Firebase Auth Functions
function handleSignup(email, password, btn) {
    if (btn) btn.classList.add("loading");
    const errorMsg = document.getElementById("authErrorMsg");

    firebase.auth().createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            console.log("User created:", userCredential.user);
            isNewlySignedUp = true; // Set flag so onAuthStateChanged knows to migrate
            if (btn) btn.classList.remove("loading");
        })
        .catch((error) => {
            // Graceful handling for network errors
            if (error.code === 'auth/network-request-failed') {
                console.log('ℹ️ Auth: No network connection for signup');
                if (btn) btn.classList.remove("loading");
                if (errorMsg) {
                    errorMsg.textContent = "No internet connection. Please check your network and try again.";
                    errorMsg.style.display = "block";
                }
                return;
            }
            
            console.error("Auth error:", error.message);
            if (btn) btn.classList.remove("loading");
            if (errorMsg) {
                errorMsg.textContent = error.message;
                errorMsg.style.display = "block";
            }
        });
}

function handleLogin(email, password, btn) {
    if (btn) btn.classList.add("loading");
    const errorMsg = document.getElementById("authErrorMsg");

    firebase.auth().signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            console.log("User logged in:", userCredential.user);
            if (btn) btn.classList.remove("loading");
        })
        .catch((error) => {
            // Graceful handling for network errors
            if (error.code === 'auth/network-request-failed') {
                console.log('ℹ️ Auth: No network connection for login');
                if (btn) btn.classList.remove("loading");
                if (errorMsg) {
                    errorMsg.textContent = "No internet connection. Please check your network and try again.";
                    errorMsg.style.display = "block";
                }
                return;
            }
            
            console.error("Auth error:", error.message);
            if (btn) btn.classList.remove("loading");
            if (errorMsg) {
                // Show generic wrong credential message for security and clarity
                if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                    errorMsg.textContent = "Wrong username or password";
                } else {
                    errorMsg.textContent = error.message;
                }
                errorMsg.style.display = "block";
            }
        });
}

/**
 * Securely updates the user's password requiring reauthentication.
 * Converts raw Firebase errors into user-friendly UI messages.
 */
async function updateUserPassword(currentPassword, newPassword) {
    const user = firebase.auth().currentUser;
    if (!user) {
        throw new Error("You must be logged in to change your password.");
    }

    // Reauthenticate
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);

    try {
        await user.reauthenticateWithCredential(credential);
    } catch (error) {
        console.error("Reauth error:", error);
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            throw new Error("Incorrect current password.");
        } else if (error.code === 'auth/too-many-requests') {
            throw new Error("Too many failed attempts. Please try again later.");
        } else if (error.code === 'auth/network-request-failed') {
            throw new Error("Network error. Please check your connection.");
        } else {
            throw new Error("Failed to verify current password.");
        }
    }

    // Update Password
    try {
        await user.updatePassword(newPassword);
        return { success: true };
    } catch (error) {
        console.error("Update password error:", error);
        if (error.code === 'auth/weak-password') {
            throw new Error("New password is too weak. Please use at least 6 characters.");
        } else if (error.code === 'auth/requires-recent-login') {
            throw new Error("Please log out and log back in to change your password.");
        } else if (error.code === 'auth/network-request-failed') {
            throw new Error("Network error. Please check your connection.");
        } else {
            throw new Error("Failed to update password. Please try again.");
        }
    }
}

// ─── Google Sign-In Error Message Helper ────────────────────────────────
function getGoogleSignInErrorMessage(error) {
    switch (error.code) {
        case 'auth/popup-closed-by-user':
            return 'Sign-in cancelled.';
        case 'auth/popup-blocked':
            return 'Popup was blocked. Trying alternative method...';
        case 'auth/cancelled-popup-request':
            return 'Sign-in cancelled. Please try again.';
        case 'auth/network-request-failed':
            return 'Network error. Please check your connection.';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please try again later.';
        case 'auth/operation-not-allowed':
            return 'Google Sign-In is not enabled. Please contact support.';
        case 'auth/unauthorized-domain':
            return 'This domain is not authorized for Google Sign-In.';
        case 'auth/internal-error':
            return 'Sign-in failed. Please try again.';
        default:
            return error.message || 'Google Sign-In failed. Please try again.';
    }
}

// Fallback timeout: Hide splash after 3 seconds max (in case Firebase is slow)
let splashHidden = false;
let authStateKnown = false;
setTimeout(() => {
    if (!splashHidden && !authStateKnown) {
        const splashScreen = document.getElementById('splashScreen');
        if (splashScreen) {
            console.log('⏱️ Splash timeout - hiding splash after 3 seconds');
            splashScreen.classList.add('splash-hidden');
            setTimeout(() => splashScreen.remove(), 600);
            splashHidden = true;
        }
        
        // Show app container (skeleton loaders will show)
        const appContainer = document.getElementById("appContainer");
        if (appContainer) {
            appContainer.style.display = "block";
            appContainer.style.visibility = "visible";
        }
        
        // Keep auth container hidden until Firebase determines state
        // This prevents login page flash
        const authContainer = document.getElementById("authContainer");
        if (authContainer) {
            authContainer.classList.add("auth-hidden");
        }
    }
}, 3000);

// Extra fallback: If Firebase takes too long (6 seconds), show login screen
setTimeout(() => {
    if (!authStateKnown) {
        console.log('⚠️ Firebase took too long - showing login screen as fallback');
        const authContainer = document.getElementById("authContainer");
        const appContainer = document.getElementById("appContainer");
        // Hide app, show auth
        if (appContainer) {
            appContainer.style.display = "none";
            appContainer.style.visibility = "hidden";
        }
        if (authContainer) {
            authContainer.classList.remove("auth-hidden");
        }
    }
}, 6000);

// Global Auth State Observer
firebase.auth().onAuthStateChanged(user => {
    // Mark that auth state is now known
    authStateKnown = true;
    
    // Get the splash screen
    const splashScreen = document.getElementById('splashScreen');

    // We must fetch elements inside here, but also handle cases where DOM isn't ready
    const authContainer = document.getElementById("authContainer");
    const appContainer = document.getElementById("appContainer");
    const logoutBtn = document.getElementById("logoutBtn");

    if (user) {
        currentUserId = user.uid;
        console.log("✅ Authenticated as:", currentUserId);

        // FIRST: Hide login container and show app immediately (prevents flash)
        // Do this synchronously before any timeouts
        if (authContainer) {
            authContainer.classList.add("auth-hidden");
        }
        
        // Show App immediately
        if (appContainer) {
            appContainer.style.display = "block";
            appContainer.style.visibility = "visible";
            // Ensure main app is actually visible even with fade-section helper
            if (appContainer.classList.contains("fade-section")) {
                appContainer.classList.add("is-visible");
            }
        }

        // THEN: Hide splash screen so skeleton screens can show (small delay to ensure app is rendered)
        if (splashScreen && !splashHidden) {
            setTimeout(() => {
                splashScreen.classList.add('splash-hidden');
                setTimeout(() => splashScreen.remove(), 600);
                splashHidden = true;
            }, 50);
        }

        // Welcome notification (delayed)
        setTimeout(() => {
            if (typeof Notify !== 'undefined' && !user.isAnonymous) {
                Notify.info('Welcome back! Let\'s make today productive.', { title: '👋 Hello!' });
            }
        }, 2200);

        // Handle newly signed up users
        if (isNewlySignedUp) {
            // Wait for auth to settle, then migrate
            setTimeout(() => {
                if (typeof uploadLocalDataToFirestore === 'function') {
                    uploadLocalDataToFirestore().then(() => {
                        // Load it back just to be perfectly synced
                        if (typeof loadTasksFromFirestore !== 'undefined') loadTasksFromFirestore();
                        if (typeof loadHabitsFromFirestore !== 'undefined') loadHabitsFromFirestore();
                        isNewlySignedUp = false;
                    });
                }
            }, 500);
        }

        // ============================================================
        // PHASE 1: IMMEDIATE INITIALIZATION (StartupManager handles this)
        // ============================================================
        // Essential data loading is now handled by StartupManager Phase 1
        // This ensures fast initial render with skeleton loaders

        // ============================================================
        // PHASE 2: DELAYED INITIALIZATION (Background Services)
        // ============================================================
        // Sync Manager, Network Monitor, Background Tasks are handled by StartupManager Phase 2

        // ============================================================
        // ESSENTIAL UI SYSTEMS (Loaded after Phase 1 completes)
        // ============================================================
        
        // Initialize Today Dashboard (delayed slightly for smooth UX)
        setTimeout(() => {
            if (typeof TodayDashboard !== 'undefined') {
                TodayDashboard.init();
            }
        }, 800);

        // Initialize Premium systems (XP, Level, Badges, Themes, Avatar)
        setTimeout(async () => {
            if (typeof XPSystem !== 'undefined') await XPSystem.init();
            if (typeof LevelSystem !== 'undefined') LevelSystem.init();
            if (typeof BadgeSystem !== 'undefined') BadgeSystem.init();
            if (typeof ThemeManager !== 'undefined') ThemeManager.init();
            if (typeof AvatarSystem !== 'undefined') AvatarSystem.init();

            // Initialize Push Notifications
            if (typeof PushNotif !== 'undefined') PushNotif.init();
        }, 2000);

        // Check for first login and offer cloud restore (delayed)
        setTimeout(() => {
            if (typeof BackupSync !== 'undefined') {
                BackupSync.checkFirstLogin();
            }
        }, 3000);

        // NOTE: Heavy systems (Analytics, AI Coach, Calendar, Scheduler) are lazy-loaded
        // They initialize only when their respective tabs are opened (see ui.js switchTab)

    } else {
        // User is NOT authenticated
        if (splashScreen && !splashHidden) {
            splashScreen.classList.add('splash-hidden');
            setTimeout(() => splashScreen.remove(), 600);
            splashHidden = true;
        }

        // Clear Snapshot memory tracking so user data doesn't cross-leak
        if (typeof unsubscribeAllListeners !== 'undefined') {
            unsubscribeAllListeners();
        }

        // Cleanup Smart Analytics
        if (typeof SmartAnalytics !== 'undefined') {
            SmartAnalytics.cleanup();
        }

        // Invalidate profile name cache
        if (typeof cachedProfileName !== 'undefined') {
            cachedProfileName = null;
            cachedProfileUserId = null;
        }

        // Hide app (user is not authenticated)
        if (appContainer) {
            appContainer.style.display = "none";
            appContainer.style.visibility = "hidden";
        }
        
        // Show login screen after splash fade completes
        setTimeout(() => {
            if (authContainer) {
                authContainer.classList.remove("auth-hidden");
            }
        }, 650);
    }
});
