// Firebase Configuration
// Set window.__FIREBASE_CONFIG__ before this file loads, or create
// www/js/core/firebase-config.local.js from the example template.
const firebaseConfig = window.__FIREBASE_CONFIG__ || {};

const requiredFirebaseConfigKeys = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId'
];

const missingFirebaseConfigKeys = requiredFirebaseConfigKeys.filter((key) => !firebaseConfig[key]);

let currentUserId = null;
let isFirebaseConfigured = false; // Track if Firebase has been configured
let isFirestoreConfigured = false; // Track if Firestore has been configured

// Initialize Firebase when DOM is ready
// Initialize Firebase immediately, not waiting for DOM
try {
    if (typeof firebase === 'undefined') {
        console.error("❌ Firebase SDK not loaded");
    } else if (missingFirebaseConfigKeys.length > 0) {
        console.error("❌ Firebase config missing:", missingFirebaseConfigKeys.join(', '));
        console.warn("ℹ️ Firebase will stay disabled until a local config override is provided.");
    } else if (!isFirebaseConfigured) {
        // Only configure once
        isFirebaseConfigured = true;
        
        // Check if Firebase is already initialized
        let app;
        try {
            app = firebase.app(); // Get existing app
            console.log("ℹ️ Firebase already initialized");
        } catch (error) {
            // Not initialized yet, so initialize it
            app = firebase.initializeApp(firebaseConfig);
            console.log("✅ Firebase initialized");
        }
        
        // Configure Firestore BEFORE first access
        if (!isFirestoreConfigured) {
            isFirestoreConfigured = true;
            
            // Get Firestore instance
            const db = firebase.firestore();
            
            // Apply settings (only works before any Firestore operations)
            try {
                db.settings({
                    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
                    ignoreUndefinedProperties: true,
                    merge: true // Merge with existing settings if any
                });
                console.log("✅ Firestore settings configured");
            } catch (settingsError) {
                // Settings already applied, ignore
                console.log("ℹ️ Firestore settings already configured");
            }
            
            // Reduce Firebase logging verbosity (suppress timeout warnings)
            if (firebase.firestore.setLogLevel) {
                firebase.firestore.setLogLevel('error'); // Only show errors, not warnings
            }
            
            // Enable offline persistence
            db.enablePersistence({ synchronizeTabs: true })
                .then(() => {
                    console.log("✅ Firestore offline persistence enabled");
                })
                .catch((error) => {
                    if (error.code === 'failed-precondition') {
                        console.log('ℹ️ Offline persistence: Multiple tabs open, using memory cache');
                    } else if (error.code === 'unimplemented') {
                        console.log('ℹ️ Offline persistence not supported in this browser');
                    } else {
                        console.log('ℹ️ Offline persistence error:', error.code);
                    }
                });
        }
    }
} catch (error) {
    console.error("❌ Firebase init error:", error.message);
}

// ===== Firestore Functions for Tasks =====

async function saveTaskToFirestore(taskText, taskId, isCompleted, dueDate, dueTime = null, priority = null) {
    if (!currentUserId || typeof firebase === 'undefined') return;

    try {
        await firebase.firestore().collection("users").doc(currentUserId).collection("tasks").doc(taskId).set({
            text: taskText,
            completed: isCompleted,
            completedDate: null,
            dueDate: dueDate || null,
            dueTime: dueTime || null,
            priority: priority || null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log("✅ Task saved to Firestore:", taskId);
    } catch (error) {
        console.error("❌ Error saving task:", error);
    }
}

async function updateTaskInFirestore(taskId, updates) {
    if (!currentUserId || typeof firebase === 'undefined') return;

    try {
        await firebase.firestore().collection("users").doc(currentUserId).collection("tasks").doc(taskId).update(updates);
        console.log("✅ Task updated in Firestore:", taskId);
    } catch (error) {
        console.error("❌ Error updating task:", error);
    }
}

async function deleteTaskFromFirestore(taskId) {
    if (!currentUserId || typeof firebase === 'undefined') return;

    try {
        await firebase.firestore().collection("users").doc(currentUserId).collection("tasks").doc(taskId).delete();
        console.log("✅ Task deleted from Firestore:", taskId);
    } catch (error) {
        console.error("❌ Error deleting task:", error);
    }
}

// NOTE: loadTasksFromFirestore is implemented in data.js to handle syncing and deduplication

// ===== Firestore Functions for Habits =====

async function saveHabitToFirestore(habitObj) {
    if (!currentUserId || typeof firebase === 'undefined') return;

    try {
        await firebase.firestore().collection("users").doc(currentUserId).collection("habits").doc(habitObj.id).set({
            name: habitObj.name,
            streak: habitObj.streak || 0,
            history: habitObj.history || [],
            frequency: habitObj.frequency || 'daily',
            targetDays: habitObj.targetDays || [],
            reminderTime: Array.isArray(habitObj.reminderTime) ? habitObj.reminderTime : [],
            createdDate: habitObj.createdDate || new Date().toISOString().split('T')[0],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log("✅ Habit saved to Firestore:", habitObj.id);
    } catch (error) {
        console.error("❌ Error saving habit:", error);
    }
}

async function updateHabitInFirestore(habitId, updates) {
    if (!currentUserId || typeof firebase === 'undefined') return;

    try {
        await firebase.firestore().collection("users").doc(currentUserId).collection("habits").doc(habitId).update(updates);
        console.log("✅ Habit updated in Firestore:", habitId);
    } catch (error) {
        console.error("❌ Error updating habit:", error);
    }
}

async function deleteHabitFromFirestore(habitId) {
    if (!currentUserId || typeof firebase === 'undefined') return;

    try {
        await firebase.firestore().collection("users").doc(currentUserId).collection("habits").doc(habitId).delete();
        console.log("✅ Habit deleted from Firestore:", habitId);
    } catch (error) {
        console.error("❌ Error deleting habit:", error);
    }
}

// NOTE: loadHabitsFromFirestore is implemented in data.js to handle syncing and deduplication

// ===== Firestore Functions for Subjects =====

async function saveSubjectToFirestore(subjectObj) {
    if (!currentUserId || typeof firebase === 'undefined') return;
    try {
        await firebase.firestore().collection("users").doc(currentUserId)
            .collection("subjects").doc(subjectObj.id).set({
                name: subjectObj.name,
                color: subjectObj.color || '#3b82f6',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
    } catch (e) { console.error("❌ Error saving subject:", e); }
}

async function deleteSubjectFromFirestore(subjectId) {
    if (!currentUserId || typeof firebase === 'undefined') return;
    try {
        await firebase.firestore().collection("users").doc(currentUserId)
            .collection("subjects").doc(subjectId).delete();
    } catch (e) { console.error("❌ Error deleting subject:", e); }
}

// ===== Firestore Functions for Study Blocks =====

async function saveStudyBlockToFirestore(block) {
    if (!currentUserId || typeof firebase === 'undefined') return;
    try {
        await firebase.firestore().collection("users").doc(currentUserId)
            .collection("studyBlocks").doc(block.id).set({
                subjectId: block.subjectId || null,
                day: block.day,
                duration: block.duration,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
    } catch (e) { console.error("❌ Error saving study block:", e); }
}

async function deleteStudyBlockFromFirestore(blockId) {
    if (!currentUserId || typeof firebase === 'undefined') return;
    try {
        await firebase.firestore().collection("users").doc(currentUserId)
            .collection("studyBlocks").doc(blockId).delete();
    } catch (e) { console.error("❌ Error deleting study block:", e); }
}

// ===== Firestore Functions for Exams =====

async function saveExamToFirestore(exam) {
    if (!currentUserId || typeof firebase === 'undefined') return;
    try {
        await firebase.firestore().collection("users").doc(currentUserId)
            .collection("exams").doc(exam.id).set({
                name: exam.name,
                subjectId: exam.subjectId || null,
                date: exam.date,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
    } catch (e) { console.error("❌ Error saving exam:", e); }
}

async function updateExamInFirestore(examId, updates) {
    if (!currentUserId || typeof firebase === 'undefined') return;
    try {
        await firebase.firestore().collection("users").doc(currentUserId)
            .collection("exams").doc(examId).update(updates);
        console.log("✅ Exam updated in Firestore:", examId);
    } catch (error) {
        console.error("❌ Error updating exam:", error);
    }
}

async function deleteExamFromFirestore(examId) {
    if (!currentUserId || typeof firebase === 'undefined') return;
    try {
        await firebase.firestore().collection("users").doc(currentUserId)
            .collection("exams").doc(examId).delete();
    } catch (e) { console.error("❌ Error deleting exam:", e); }
}

// ===== Firestore Functions for Focus Sessions =====

async function saveFocusSessionToFirestore(session) {
    if (!currentUserId || typeof firebase === 'undefined') return;
    try {
        await firebase.firestore().collection("users").doc(currentUserId)
            .collection("focusSessions").doc(session.id).set({
                subjectId: session.subjectId || null,
                duration: session.duration,
                completedAt: session.completedAt || new Date().toISOString()
            });
    } catch (e) { console.error("❌ Error saving focus session:", e); }
}
