// Authentication Logic (Used by login.html, register.html, crew-login.html, crew-register.html)

document.addEventListener('DOMContentLoaded', () => {

    // --- User Registration (register.html) ---
    const userRegisterForm = document.getElementById('user-register-form');
    if (userRegisterForm) {
        userRegisterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('reg-name').value;
            const email = document.getElementById('reg-email').value;
            // !!! NEW: Get faculty value !!!
            const faculty = document.getElementById('reg-faculty').value; 
            const password = document.getElementById('reg-password').value;
            const confirmPassword = document.getElementById('reg-confirm-password').value;

            if (password !== confirmPassword) {
                alert("Passwords do not match!");
                return;
            }
            
            // !!! NEW: Validate faculty selection !!!
            if (document.getElementById('reg-faculty') && !faculty) {
                alert("Please select your Faculty.");
                return;
            }

            try {
                // 1. Create user with Email/Password
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;

                // 2. Store additional user data in Firestore 'users' collection
                await db.collection("users").doc(user.uid).set({
                    name: name,
                    email: email,
                    // !!! NEW: Save faculty to profile !!!
                    faculty: faculty, 
                    role: "user", // Default role for standard users
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                alert("Registration successful! You are now logged in.");
                // CRITICAL CHANGE: Redirect to main.html after registration
                window.location.href = 'events.html'; 
            } catch (error) {
                alert(`Error registering: ${error.message}`);
                console.error("Registration Error:", error);
            }
        });
    }

    // --- User Login (login.html) ---
    const userLoginForm = document.getElementById('user-login-form');
    if (userLoginForm) {
        userLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            try {
                await auth.signInWithEmailAndPassword(email, password); // Uses global 'auth'
                // User login successful, redirect to a general user page
                window.location.href = 'events.html'; 
            } catch (error) {
                alert(`Login failed: ${error.message}`);
                console.error("Login Error:", error);
            }
        });
    }
    
    // --- Forgot Password (login.html) ---
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = prompt("Enter your email address to reset your password:");
            if (email) {
                try {
                    await auth.sendPasswordResetEmail(email);
                    alert("Password reset email sent! Check your inbox.");
                } catch (error) {
                    alert(`Error sending reset email: ${error.message}`);
                }
            }
        });
    }

    // --- Crew Login (crew-login.html) ---
    const crewLoginForm = document.getElementById('crew-login-form');
    if (crewLoginForm) {
        crewLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            // Assuming the crew-login.html now uses email/password for Firebase Auth
            const email = document.getElementById('crew-login-email').value;
            const password = document.getElementById('crew-login-password').value;

            try {
                // 1. Log in with Email/Password
                const userCredential = await auth.signInWithEmailAndPassword(email, password); // Uses global 'auth'
                const user = userCredential.user;

                // 2. Fetch the user's profile to verify 'crew' role
                const userDoc = await db.collection("users").doc(user.uid).get(); // Uses global 'db'
                const userProfile = userDoc.data();

                if (userProfile && userProfile.role === 'crew') {
                    // Success: Crew member logged in. IMMEDIATE REDIRECT.
                    window.location.href = 'crew-manage-events.html';
                } else {
                    // Fail: Logged in, but not a crew member. Force log out.
                    await auth.signOut(); // Uses global 'auth'
                    alert("Access denied. Your account is not authorized as a crew member. Redirecting to login.");
                    window.location.href = 'crew-login.html';
                }

            } catch (error) {
                // Handle Firebase authentication errors (e.g., wrong password, user not found)
                alert(`Crew Login failed: ${error.message}`);
                console.error("Crew Login Error:", error);
            }
        });
    }
    // Select all potential logout buttons
    const allLogoutButtons = document.querySelectorAll('#logout-button, #crew-logout-button');
    allLogoutButtons.forEach(button => {
        button.addEventListener('click', async () => {
            try {
                await auth.signOut(); // Uses global 'auth'
                // Redirecting to index.html for general logout
                window.location.href = 'index.html'; 
            } catch (error) {
                alert("Logout failed. Please try again.");
                console.error("Logout Error:", error);
            }
        });
    }
)});


