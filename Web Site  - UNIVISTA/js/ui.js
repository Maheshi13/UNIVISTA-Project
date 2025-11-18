// UI Logic (Used to populate dynamic data on events.html/main.html and handle navigation)

document.addEventListener('DOMContentLoaded', () => {

    // --- Initial Event Load for Events Page (main.html is now the Events page) ---
    // The fetchAndDisplayEvents function must be defined in js/firestore.js
    if (document.getElementById('events-list')) {
        // We assume 'main.html' is the page where we want to list events.
        // The fetchAndDisplayEvents function must be defined in js/firestore.js
        if (typeof fetchAndDisplayEvents !== 'undefined') {
            fetchAndDisplayEvents(); 
        } else {
            console.warn("fetchAndDisplayEvents is not defined in js/firestore.js");
        }
        
        // Setup filters 
        const categoryFilter = document.getElementById('event-category-filter');
        const facultyFilter = document.getElementById('event-faculty-filter');
        const eventTypeFilter = document.getElementById('event-type-filter');
        const eventTicketFilter = document.getElementById('event-ticket-filter');

        const filters = [categoryFilter, facultyFilter, eventTypeFilter, eventTicketFilter];
        filters.forEach(filter => {
            if (filter) {
                filter.addEventListener('change', () => {
                    const currentFilters = {
                        category: categoryFilter ? categoryFilter.value : 'all',
                        faculty: facultyFilter ? facultyFilter.value : 'all',
                        type: eventTypeFilter ? eventTypeFilter.value : 'all',
                        ticket: eventTicketFilter ? eventTicketFilter.value : 'all',
                    };
                    if (typeof fetchAndDisplayEvents !== 'undefined') {
                        fetchAndDisplayEvents(currentFilters);
                    }
                });
            }
        });
        
        // populateFacultyFilters is defined below
        populateFacultyFilters();
    }
    
    // --- Faculty Filter Population ---
    function populateFacultyFilters() {
        const faculties = [
            "Science", "Art", "Medicine", "Law", "Management & Finance", 
            "Technology", "Nursing", "Indigenous Medicine", "Education", 
            "Sri Palee Drama", "UCSC"
        ];
        
        const filterSelects = document.querySelectorAll('#event-faculty-filter');
        filterSelects.forEach(select => {
            select.querySelectorAll('option:not([value="all"])').forEach(o => o.remove());
            
            faculties.forEach(faculty => {
                const option = document.createElement('option');
                option.value = faculty;
                option.textContent = faculty;
                select.appendChild(option);
            });
            const uniWide = document.createElement('option');
            uniWide.value = 'University Wide';
            uniWide.textContent = 'University Wide';
            select.appendChild(uniWide);
        });
    }

    // --- Single Event Details Loader (event-details.html) ---
    const eventDetailsContainer = document.querySelector('.event-details-container');
    if (eventDetailsContainer) {
        const eventId = new URLSearchParams(window.location.search).get('id');
        if (eventId) {
            // loadEventDetails function must be defined in js/firestore.js
            if (typeof loadEventDetails !== 'undefined') {
                 loadEventDetails(eventId);
            }
        } else {
            eventDetailsContainer.innerHTML = '<h2>Error: Event ID not provided.</h2>';
        }
    }
    
    // --- Auth State Change Listener (The Core Navigation and Redirection Handler) ---
    if (typeof auth === 'undefined') {
        console.error("Firebase Auth object 'auth' is not defined. Check firebase-config.js.");
        return;
    }
    
    auth.onAuthStateChanged((user) => {
        
        // Elements in navbar-right
        const navLogin = document.getElementById('nav-login');
        
        // Elements in navbar-left (main navigation)
        const profileLi = document.getElementById('nav-profile-li');
        const navProfile = document.getElementById('nav-profile');
        const logoutLi = document.getElementById('logout-button-li');
        const logoutButton = document.getElementById('logout-button');
        
        if (!navLogin || !profileLi || !navProfile || !logoutLi || !logoutButton) {
            // Allow this to fail gracefully if we are on index.html or login.html
        }

        if (user) {
            // User is signed in. Fetch role and handle redirection/navigation.
            // Check if db is defined to prevent errors
            if (typeof db !== 'undefined') {
                db.collection("users").doc(user.uid).get().then((doc) => {
                    let role = 'user';
                    if (doc.exists) {
                        role = doc.data().role;
                    }
                    
                    if (navLogin) {
                        updateNav(true, role, navLogin, profileLi, navProfile, logoutLi, logoutButton);
                    }
                    
                    // CRITICAL: Redirection check only for login page
                    if (window.location.pathname.includes('login.html')) {
                        if (role === 'crew') {
                            window.location.href = 'crew-dashboard.html';
                        } else {
                            window.location.href = 'main.html'; 
                        }
                    }
                    
                    // Attach logout handler (only if the button exists)
                    if(logoutButton) {
                        logoutButton.removeEventListener('click', handleLogout);
                        logoutButton.addEventListener('click', handleLogout);
                    }

                }).catch(error => {
                    console.error("Error fetching user role:", error);
                    // Fallback to updateNav if profile fetch fails
                    if (navLogin) {
                        updateNav(true, 'user', navLogin, profileLi, navProfile, logoutLi, logoutButton);
                    }
                });
            } else {
                // If db is not defined, we can't fetch role, just assume logged in state
                if (navLogin) {
                    updateNav(true, 'user', navLogin, profileLi, navProfile, logoutLi, logoutButton);
                }
            }
            
        } else {
            // User is signed out.
            if (navLogin) {
                updateNav(false, null, navLogin, profileLi, navProfile, logoutLi, logoutButton);
            }
        }
    });
});

/**
 * Updates the visibility and content of the navigation bar elements based on login state and role.
 */
function updateNav(isLoggedIn, role, navLogin, profileLi, navProfile, logoutLi, logoutButton) {

    // Ensure all elements exist before proceeding
    if (!navLogin || !profileLi || !navProfile || !logoutLi || !logoutButton) return; 

    if (isLoggedIn) {
        // Logged-in view: Hide Login, Show Profile/Dashboard and Logout
        navLogin.style.display = 'none';
        
        profileLi.style.display = 'list-item';
        logoutLi.style.display = 'list-item';
        
        // Adjust Profile Link/Button appearance and destination
        if (role === 'crew') {
            navProfile.textContent = 'Crew Dashboard';
            navProfile.href = 'crew-dashboard.html';
        } else {
            navProfile.textContent = 'Profile';
            navProfile.href = 'profile.html'; // Directs to the profile page
        }
        
        // Apply the requested button style
        navProfile.classList.add('profile-button-style');
        
    } else {
        // Logged-out view: Show Login, Hide Profile/Dashboard and Logout
        navLogin.style.display = 'inline-block';
        
        profileLi.style.display = 'none';
        logoutLi.style.display = 'none';
        
        navProfile.classList.remove('profile-button-style');
    }
}

/**
 * Handles the Firebase logout process.
 */
function handleLogout() {
    if (typeof auth === 'undefined') {
        console.error("Firebase Auth not initialized.");
        return;
    }
    
    auth.signOut().then(() => {
        // Redirect to home page after logout
        window.location.href = 'index.html'; 
    }).catch((error) => {
        console.error("Logout Error:", error);
        alert("Logout failed. Check console for details.");
    });
};