document.addEventListener('DOMContentLoaded', () => {
    console.log('--- Script Initialized (DOMContentLoaded) ---'); // LOG 1

    // --- Splash Screen Logic ---
    const splashScreen = document.getElementById('splash-screen');
    console.log('Attempting to find splash screen element:', splashScreen); // LOG 2

    if (splashScreen) {
        console.log('Splash screen element FOUND. Setting timeout to fade out...'); // LOG 3

        // Set a timeout to add the fade-out class after 2 seconds (2000 milliseconds)
        setTimeout(() => {
            console.log('Timeout triggered (after 2s). Adding splash-fade-out class.'); // LOG 4
            splashScreen.classList.add('splash-fade-out'); // Add the class that starts the fade

            // Listen for the end of the CSS transition (1 second fade)
            splashScreen.addEventListener('transitionend', () => {
                console.log('CSS transitionend event fired. Removing splash screen from DOM.'); // LOG 5
                splashScreen.remove(); // Remove the splash screen div from the HTML
            }, { once: true }); // Ensures this listener runs only once
        }, 2000); // 2-second delay before fade starts (for a total ~3s disappearance)
    } else {
        console.log('Splash screen element NOT FOUND. Splash screen will not operate.'); // LOG 6
    }

    // --- Common Functions ---

    // Function to navigate
    const navigateTo = (url) => {
        window.location.href = url;
    };

    // --- Authentication Logic (Simulated with localStorage) ---
    // Select ALL buttons that should be dynamic
    const authButtons = document.querySelectorAll('.auth-button-dynamic');

    const updateAuthButtons = () => {
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true'; // Check login state

        authButtons.forEach(button => { // Loop through each dynamic button
            if (isLoggedIn) {
                button.textContent = 'Logout';
                button.href = '#'; // Will handle logout via JS
                button.classList.remove('login-button-header'); // Remove login specific style
                button.classList.add('logout-button-header'); // Add logout specific style
            } else {
                button.textContent = 'Login→';
                button.href = 'login.html';
                button.classList.remove('logout-button-header');
                button.classList.add('login-button-header');
            }
        });
    };

    const handleLogout = () => {
        localStorage.setItem('isLoggedIn', 'false'); // Set logged out
        alert('You have been logged out.');
        updateAuthButtons(); // Update all buttons immediately
        navigateTo('index.html'); // Redirect to homepage
    };

    // Add event listeners for all dynamic buttons
    authButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
            if (isLoggedIn) {
                event.preventDefault(); // Prevent default link behavior for logout
                handleLogout();
            } else {
                // If not logged in, allow default navigation to login.html
            }
        });
    });

    // --- Login button horizontal jump animation ---
    const animateAllLoginButtons = () => {
        authButtons.forEach(button => { // Apply animation to each dynamic button
            button.classList.add('jump-animation');
            // Remove the animation class after it completes so it can be re-triggered
            button.addEventListener('animationend', function() {
                this.classList.remove('jump-animation'); // 'this' refers to the button that finished animating
            }, { once: true }); // { once: true } ensures the listener is removed after one execution
        });
    };

    // Trigger the animation exactly every 3 seconds for ALL buttons
    setInterval(animateAllLoginButtons, 3000); // Trigger animation every 3 seconds

    // --- Login/Register Page Logic ---
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            if (password !== confirmPassword) {
                alert('Passwords do not match!');
                return;
            }

            console.log('Registering user:', { name, email, password });
            alert('Registration successful! Please log in.');
            navigateTo('login.html');
        });
    }

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            console.log('Logging in user:', { email, password });
            // Simulate successful login
            if (email === 'test@example.com' && password === 'password123') {
                localStorage.setItem('isLoggedIn', 'true'); // Set logged in
                alert('Login successful!');
                navigateTo('index.html'); // Redirect to homepage
            } else {
                alert('Invalid email or password.');
            }
        });
    }

    // --- Homepage Logic ---
    const uocLogo = document.querySelector('.uoc-logo');
    if (uocLogo) {
        uocLogo.addEventListener('click', () => {
            // Already handled by href in HTML
        });
    }

    const eventManagementCrewLink = document.querySelector('.event-crew-link');
    if (eventManagementCrewLink) {
        eventManagementCrewLink.addEventListener('click', (event) => {
            event.preventDefault();
            navigateTo('event-management-crew.html');
        });
    }

    // Simulate upcoming events loading
    const upcomingEventsGrid = document.getElementById('upcoming-events-grid');
    const noUpcomingEventsMessage = document.getElementById('no-upcoming-events');

    const fetchUpcomingEvents = () => {
        return new Promise(resolve => {
            setTimeout(() => {
                const events = [
                    { title: 'Annual Sports Meet', date: '2025-08-15' },
                    { title: 'Inter-Faculty Debate', date: '2025-09-01' },
                    { title: 'Cultural Night', date: '2025-09-20' }
                ];
                // Uncomment the line below to simulate no events
                // const events = [];
                resolve(events);
            }, 500);
        });
    };

    if (upcomingEventsGrid && noUpcomingEventsMessage) {
        fetchUpcomingEvents().then(events => {
            if (events.length === 0) {
                upcomingEventsGrid.innerHTML = '';
                noUpcomingEventsMessage.style.display = 'block';
            } else {
                noUpcomingEventsMessage.style.display = 'none';
                upcomingEventsGrid.innerHTML = '';

                events.forEach(event => {
                    const eventCard = document.createElement('div');
                    eventCard.classList.add('event-card');
                    eventCard.innerHTML = `
                        <h4>${event.title}</h4>
                        <p>Date: ${event.date}</p>
                        <button class="book-now" data-event-title="${event.title}">Book Now>></button>
                    `;
                    upcomingEventsGrid.appendChild(eventCard);
                });

                document.querySelectorAll('.book-now').forEach(button => {
                    button.addEventListener('click', (event) => {
                        const eventTitle = event.target.dataset.eventTitle;
                        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

                        if (isLoggedIn) {
                            alert(`Booking for ${eventTitle}. Proceeding to payment.`);
                            // In a real app, redirect to a payment page for this event
                            // navigateTo('payment.html?event=' + encodeURIComponent(eventTitle));
                        } else {
                            alert(`Please login to book tickets for ${eventTitle}. Redirecting to login.`);
                            navigateTo('login.html');
                        }
                    });
                });
            }
        }).catch(error => {
            console.error("Error fetching upcoming events:", error);
            upcomingEventsGrid.innerHTML = '<p>Failed to load upcoming events.</p>';
            noUpcomingEventsMessage.style.display = 'block';
        });
    }

    // --- Initial call to update button state on page load ---
    updateAuthButtons(); // Changed to updateAuthButtons
});
