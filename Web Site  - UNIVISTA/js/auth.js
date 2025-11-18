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
            if (!faculty) {
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
                window.location.href = 'main.html'; 
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
                // 1. Sign in the user
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                const user = userCredential.user;

                // 2. Check the user's role for redirection logic (in case a crew member uses this form)
                const userDoc = await db.collection("users").doc(user.uid).get();
                let role = userDoc.exists ? userDoc.data().role : 'user';

                alert("Login successful!");
                
                // CRITICAL CHANGE: Redirect based on role
                if (role === 'crew') {
                    // Crew should go to their dedicated dashboard
                    window.location.href = 'crew-dashboard.html'; 
                } else {
                    // Standard user goes to the main events page
                    window.location.href = 'main.html'; 
                }
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

    // --- Crew Registration Select Faculty (crew-register.html) ---
    const facultyBoxes = document.querySelectorAll('.faculty-box');
    const crewRegisterForm = document.getElementById('crew-register-form');
    const selectedFacultyInput = document.getElementById('crew-reg-faculty');
    const selectedFacultyNameDisplay = document.getElementById('selected-faculty-name');

    facultyBoxes.forEach(box => {
        box.addEventListener('click', () => {
            // Deselect all
            facultyBoxes.forEach(b => b.classList.remove('selected'));
            
            // Select current
            box.classList.add('selected');
            const facultyName = box.dataset.faculty;
            
            // Update form fields
            selectedFacultyInput.value = facultyName;
            selectedFacultyNameDisplay.textContent = facultyName;
            crewRegisterForm.classList.remove('hidden');
        });
    });

    // --- Crew Registration Submission (crew-register.html) ---
    if (crewRegisterForm) {
        crewRegisterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('crew-reg-username').value;
            const email = document.getElementById('crew-reg-email').value;
            const password = document.getElementById('crew-reg-password').value;
            const faculty = document.getElementById('crew-reg-faculty').value;
            
            try {
                // 1. Check if the provided username is one of the 11 pre-approved usernames
                const usernameDoc = await db.collection("crew_usernames").doc(username).get();
                
                if (!usernameDoc.exists || usernameDoc.data().isRegistered) {
                    alert("Invalid or already registered username. Please contact the Admin for your unique username.");
                    return;
                }

                // 2. Create the crew user using the email/password
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;

                // 3. Store crew data in 'users' collection with role and faculty
                await db.collection("users").doc(user.uid).set({
                    username: username,
                    email: email,
                    role: "crew",
                    faculty: faculty,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // 4. Mark the username as registered to prevent reuse
                await db.collection("crew_usernames").doc(username).update({
                    isRegistered: true,
                    uid: user.uid
                });

                alert(`Crew account for ${faculty} registered successfully! You can now log in.`);
                window.location.href = 'crew-login.html';
            } catch (error) {
                alert(`Crew Registration Error: ${error.message}`);
                console.error("Crew Registration Error:", error);
            }
        });
    }

    // --- Crew Login (crew-login.html) ---
    const crewLoginForm = document.getElementById('crew-login-form');
    if (crewLoginForm) {
        crewLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('crew-login-username').value;
            const password = document.getElementById('crew-login-password').value;

            try {
                // 1. Find the crew user's email using their unique username
                const crewQuery = await db.collection("users")
                    .where("username", "==", username)
                    .where("role", "==", "crew")
                    .limit(1).get();

                if (crewQuery.empty) {
                    alert("Invalid username or not a crew member.");
                    return;
                }

                const crewUserDoc = crewQuery.docs[0];
                const crewEmail = crewUserDoc.data().email;
                
                // 2. Log in using the retrieved email and password
                await auth.signInWithEmailAndPassword(crewEmail, password);
                
                alert(`Welcome, ${crewUserDoc.data().faculty} crew member!`);
                window.location.href = 'crew-dashboard.html';
            } catch (error) {
                alert(`Crew Login failed: ${error.message}`);
                console.error("Crew Login Error:", error);
            }
        });
    }

    // --- Crew Logout (crew-dashboard.html) ---
    const crewLogoutButton = document.getElementById('crew-logout-button');
    if (crewLogoutButton) {
        crewLogoutButton.addEventListener('click', async () => {
            try {
                await auth.signOut();
                alert("Logged out successfully.");
                window.location.href = 'index.html';
            } catch (error) {
                alert("Logout failed. Please try again.");
                console.error("Logout Error:", error);
            }
        });
    }
});