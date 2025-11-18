// js/profile.js - Handles loading and displaying user-specific data on profile.html

document.addEventListener('DOMContentLoaded', () => {

    if (typeof auth === 'undefined' || typeof db === 'undefined') {
        console.error("Firebase Auth or Firestore not initialized.");
        document.querySelector('.profile-content').innerHTML = "<h1>System Error: Firebase is not configured correctly.</h1>";
        return;
    }

    // 1. Check Auth State and Redirect if necessary
    auth.onAuthStateChanged((user) => {
        if (!user) {
            alert("You must be logged in to view your profile.");
            window.location.href = 'login.html';
            return;
        }

        // 2. Load User Profile Details
        loadUserDetails(user);

        // 3. Load User Submitted Events (Posted & Pending)
        loadSubmittedEvents(user.uid);
        
        // 4. Load Purchased Tickets
        loadPurchasedTickets(user.uid);
        
        // 5. Render Calendar (Requires event data from submissions/tickets)
        renderEventCalendar(user.uid); 
    });

    /**
     * Fetches and displays the current user's details (name, email, role).
     */
    function loadUserDetails(user) {
        db.collection("users").doc(user.uid).get()
            .then((doc) => {
                if (doc.exists) {
                    const profile = doc.data();
                    
                    document.getElementById('profile-name').textContent = profile.name || 'N/A';
                    document.getElementById('profile-email').textContent = profile.email || user.email;
                    document.getElementById('profile-role').textContent = profile.role || 'user';
                } else {
                    document.getElementById('user-details-container').innerHTML = "<p>User profile data not found in Firestore.</p>";
                }
            })
            .catch(error => {
                console.error("Error fetching user details:", error);
                document.getElementById('user-details-container').innerHTML = "<p style='color:red;'>Error loading user profile. Check console for details.</p>";
            });
    }

    /**
     * Fetches and displays events submitted by this user (including pending status).
     */
    function loadSubmittedEvents(userId) {
        const eventsListContainer = document.getElementById('user-submitted-events-list');
        eventsListContainer.innerHTML = ''; 

        // Query events where 'postedByUid' matches the current user's UID
        db.collection("events")
            .where("postedByUid", "==", userId)
            .orderBy("timestamp", "desc")
            .get()
            .then((querySnapshot) => {
                if (querySnapshot.empty) {
                    eventsListContainer.innerHTML = '<p>You have not submitted any events yet.</p>';
                    return;
                }

                let html = '<ul class="submitted-event-list">';
                querySnapshot.forEach((doc) => {
                    const event = doc.data();
                    const statusClass = event.status === 'approved' ? 'status-approved' : 
                                        event.status === 'rejected' ? 'status-rejected' : 'status-pending';

                    html += `
                        <li class="submitted-event-item">
                            <h4>${event.title} (${event.faculty})</h4>
                            <p><strong>Status:</strong> <span class="${statusClass}">${event.status.toUpperCase()}</span></p>
                            <p><strong>Date:</strong> ${event.date}</p>
                            ${event.rejectionReason ? `<p class="rejection-reason">Reason: ${event.rejectionReason}</p>` : ''}
                            <p><a href="event-details.html?id=${doc.id}">View Details</a></p>
                        </li>
                    `;
                });
                html += '</ul>';
                eventsListContainer.innerHTML = html;

            })
            .catch(error => {
                console.error("Error loading submitted events:", error);
                eventsListContainer.innerHTML = '<p style="color:red;">Error loading event submission history.</p>';
            });
    }

    /**
     * Fetches and displays events for which the user has purchased a ticket.
     * Requires a 'tickets' collection structured as: tickets/{ticketId} -> { userId: '...', eventId: '...', ...}
     */
    function loadPurchasedTickets(userId) {
        const ticketsListContainer = document.getElementById('purchased-tickets-list');
        ticketsListContainer.innerHTML = '';
        
        // This requires a 'tickets' collection to link users to purchased events
        db.collection("tickets")
            .where("userId", "==", userId)
            .get()
            .then(async (ticketSnapshot) => {
                if (ticketSnapshot.empty) {
                    ticketsListContainer.innerHTML = '<p>You have not purchased any tickets yet.</p>';
                    return;
                }
                
                let eventPromises = [];
                ticketSnapshot.forEach(ticketDoc => {
                    const eventId = ticketDoc.data().eventId;
                    // Fetch the event details for each ticket
                    eventPromises.push(db.collection("events").doc(eventId).get());
                });

                const eventDocs = await Promise.all(eventPromises);
                
                let html = '<ul class="purchased-tickets-list">';
                eventDocs.forEach((doc) => {
                    if (doc.exists) {
                        const event = doc.data();
                        html += `
                            <li class="ticket-item">
                                <h4>${event.title}</h4>
                                <p><strong>Date:</strong> ${event.date} at ${event.time}</p>
                                <p><strong>Ticket ID:</strong> ${ticketSnapshot.docs.find(t => t.data().eventId === doc.id)?.id || 'N/A'}</p>
                                <p><a href="event-details.html?id=${doc.id}">View Event</a> | <a href="#" onclick="alert('Ticket QR Code functionality coming soon!')">Show QR Ticket</a></p>
                            </li>
                        `;
                    }
                });
                html += '</ul>';
                ticketsListContainer.innerHTML = html;
                
            }).catch(error => {
                console.error("Error loading purchased tickets:", error);
                ticketsListContainer.innerHTML = '<p style="color:red;">Error loading purchased tickets.</p>';
            });
    }

    /**
     * Placeholder function to render the calendar. 
     * You would integrate a library like FullCalendar here.
     */
    function renderEventCalendar(userId) {
        const calendarEl = document.getElementById('user-event-calendar');
        calendarEl.innerHTML = '<p>Calendar data loading...</p>';
        
        // For a full implementation, you would merge data from two queries:
        // 1. Events submitted by user (to track their own schedule)
        // 2. Events where the user purchased a ticket.
        
        // Example: Only showing approved events from tickets for simplicity
        
        // This should be replaced with actual calendar library integration (e.g., FullCalendar)
        setTimeout(() => {
            calendarEl.innerHTML = '<p>Calendar visualization placeholder: This section requires a library like FullCalendar to render event dates from your purchased tickets and submitted events.</p>';
        }, 1500);
    }
});