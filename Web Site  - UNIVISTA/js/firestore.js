// js/firestore.js - Centralized functions for Firebase Firestore and Storage operations

// Ensure db, storage, and auth are initialized in firebase-config.js and accessible globally
if (typeof db === 'undefined' || typeof storage === 'undefined' || typeof auth === 'undefined') {
    console.error("Firebase Auth, Firestore, or Storage is not initialized correctly.");
}

// =========================================================================
// --- 0. HELPER FUNCTIONS ---
// =========================================================================

/**
 * Gets the current user's profile and role from Firestore.
 * @returns {Promise<object>} A promise that resolves with the user's data (e.g., { role: "user", faculty: "..." }) or { role: "guest" }.
 */
async function getCurrentUserRole() {
    return new Promise(resolve => {
        // Use onAuthStateChanged to ensure user state is loaded
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user) {
                try {
                    const userDoc = await db.collection("users").doc(user.uid).get();
                    unsubscribe(); // Stop listening after fetching the first time
                    if (userDoc.exists) {
                        resolve(userDoc.data()); // Returns { name: "...", role: "user" / "crew", faculty: "..." }
                    } else {
                        resolve({ role: "user", uid: user.uid, email: user.email }); // Logged in but no user doc found
                    }
                } catch (error) {
                    unsubscribe();
                    console.error("Error fetching user role:", error);
                    resolve({ role: "guest" });
                }
            } else {
                unsubscribe();
                resolve({ role: "guest" });
            }
        });
    });
}
window.getCurrentUserRole = getCurrentUserRole;

// =========================================================================
// --- 1. USER EVENT SUBMISSION LOGIC (for post-event.html) ---
// =========================================================================

/**
 * Handles uploading an image and saving new event data to Firestore 
 * with a default status of 'pending' for crew review.
 * @param {object} eventData - Data from the event submission form (post-event.html).
 */
async function submitNewEvent(eventData) {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("User not authenticated.");
    }

    const userProfile = await getCurrentUserRole();
    
    let imageUrl = '';

    // 1. Upload Image to Firebase Storage (if provided)
    if (eventData.imageFile) {
        const file = eventData.imageFile;
        const storageRef = storage.ref(`event_posters/${user.uid}/${Date.now()}_${file.name}`);
        const snapshot = await storageRef.put(file);
        imageUrl = await snapshot.ref.getDownloadURL();
    }

    // 2. Prepare Firestore Document Data
    const newEvent = {
        // Core Event Details (using fields from post-event.html)
        name: eventData.title, 
        faculty: eventData.faculty,
        description: eventData.description,
        date: eventData.date, 
        time: eventData.time,
        location: eventData.location,
        postImageUrl: imageUrl,
        
        // Ticket Details (Mapping isPaid/price from post-event.html)
        hasTickets: eventData.isPaid,
        ticketPrice: eventData.price,
        availableTickets: 0, // Crew must set availability later
        
        // Approval & Tracking Fields
        status: 'pending', // CRITICAL: Starts as pending
        postedByUid: user.uid,
        postedByName: userProfile.name || user.email,
        submissionTimestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    // 3. Save to Firestore
    return db.collection("events").add(newEvent);
}
window.submitNewEvent = submitNewEvent;

// =========================================================================
// --- 2. CREW DIRECT POSTING LOGIC (Internal/Official Events) ---
// =========================================================================

/**
 * CREW ONLY: Allows a crew member to post an event that bypasses the 'pending'
 * status and is immediately 'approved'. (Used for official faculty posts).
 */
window.crewPostApprovedEvent = async function(eventData) {
    try {
        const crewProfile = await getCurrentUserRole();
        if (crewProfile.role !== 'crew') {
            throw new Error("Access Denied. Only crew members can post directly.");
        }

        // 1. Upload Image to Firebase Storage
        const file = eventData.postImageFile;
        let imageUrl = '';
        if (file) {
            const storageRef = storage.ref();
            const imageRef = storageRef.child(`event_posters/${Date.now()}_${file.name}`);
            await imageRef.put(file);
            imageUrl = await imageRef.getDownloadURL();
        }

        // 2. Prepare event data for Firestore (Implicitly approved)
        const eventDocData = {
            // Using existing field names from your provided file
            name: eventData.name,
            date: eventData.date,
            time: eventData.time,
            location: eventData.location,
            category: eventData.category,
            faculty: eventData.faculty,
            description: eventData.description,
            contact: eventData.contact, 
            audienceType: eventData.audienceType,
            audienceRestriction: eventData.audienceRestriction,
            hasTickets: eventData.hasTickets,
            ticketPrice: eventData.ticketPrice,
            availableTickets: eventData.availableTickets,
            postImageUrl: imageUrl,
            
            // Approval fields - Crew post is immediately approved
            status: 'approved', 
            postedByUid: auth.currentUser.uid,
            postedByName: crewProfile.name || auth.currentUser.email,
            approvedBy: auth.currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        return db.collection("events").add(eventDocData);

    } catch (error) {
        throw new Error(`Crew Event Posting Failed: ${error.message}`);
    }
};

// =========================================================================
// --- 3. CREW APPROVAL LOGIC (for crew-dashboard.html) ---
// =========================================================================

/**
 * Fetches events that are pending approval for the crew's assigned faculty.
 * @param {string} faculty - The faculty the crew member is assigned to.
 */
async function fetchPendingEvents(faculty) {
    const approvalList = document.getElementById('pending-events-list');
    if (!approvalList) return;
    
    approvalList.innerHTML = '<h3>Loading pending events...</h3>';
    
    try {
        const snapshot = await db.collection("events")
            .where("status", "==", "pending")
            .where("faculty", "==", faculty)
            .orderBy("submissionTimestamp", "asc")
            .get();

        approvalList.innerHTML = ''; 

        if (snapshot.empty) {
            approvalList.innerHTML = '<p>No pending events require your approval.</p>';
            return;
        }

        let html = '<ul class="approval-list">';
        snapshot.forEach(doc => {
            const event = doc.data();
            const eventId = doc.id;
            
            html += `
                <li class="approval-item">
                    <h4>${event.name || event.title} (${event.faculty})</h4>
                    <p>Submitted by: ${event.postedByName || 'N/A'}</p>
                    <p>Date: ${event.date} | Location: ${event.location}</p>
                    <button onclick="approveEvent('${eventId}')" class="approve-btn">Approve</button>
                    <button onclick="showRejectForm('${eventId}')" class="reject-btn">Reject</button>
                    <div id="reject-form-${eventId}" style="display:none; margin-top: 10px;">
                        <textarea id="reason-${eventId}" placeholder="Rejection Reason" required></textarea>
                        <button onclick="rejectEvent('${eventId}', document.getElementById('reason-${eventId}').value)" class="btn-submit-reason">Submit Rejection</button>
                    </div>
                </li>
            `;
        });
        html += '</ul>';
        approvalList.innerHTML = html;

    } catch (error) {
        console.error("Error fetching pending events:", error);
        approvalList.innerHTML = `<p class="error-message">Error loading approval queue: ${error.message}</p>`;
    }
}
window.fetchPendingEvents = fetchPendingEvents; 

/**
 * Utility function to toggle the rejection reason form visibility.
 * @param {string} eventId
 */
function showRejectForm(eventId) {
    const form = document.getElementById(`reject-form-${eventId}`);
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
}
window.showRejectForm = showRejectForm;

/**
 * Updates an event's status to 'approved'.
 * @param {string} eventId - The document ID of the event.
 */
function approveEvent(eventId) {
    const user = auth.currentUser;
    if (!user) {
        alert("Authentication error. Please log in again.");
        return;
    }
    const eventRef = db.collection("events").doc(eventId);
    
    eventRef.update({
        status: 'approved',
        approvedBy: user.uid,
        approvalTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
        rejectionReason: firebase.firestore.FieldValue.delete() 
    })
    .then(() => {
        alert(`Event ID ${eventId} approved and is now live!`);
        // Note: The UI refresh is typically handled by re-calling fetchPendingEvents or using onSnapshot.
    })
    .catch(error => {
        console.error("Error approving event:", error);
        alert("Failed to approve event.");
    });
}
window.approveEvent = approveEvent;

/**
 * Updates an event's status to 'rejected' with a reason.
 * @param {string} eventId - The document ID of the event.
 * @param {string} reason - The reason for rejection.
 */
function rejectEvent(eventId, reason) {
    if (!reason) {
        alert("Rejection reason is required.");
        return;
    }
    const user = auth.currentUser;
    const eventRef = db.collection("events").doc(eventId);

    eventRef.update({
        status: 'rejected',
        approvedBy: user.uid,
        rejectionReason: reason,
        approvalTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
    })
    .then(() => {
        alert(`Event ID ${eventId} rejected. Reason saved.`);
    })
    .catch(error => {
        console.error("Error rejecting event:", error);
        alert("Failed to reject event.");
    });
}
window.rejectEvent = rejectEvent;


// =========================================================================
// --- 4. GENERAL EVENT FETCHING (index.html, events.html) ---
// =========================================================================

/**
 * Fetches APPROVED events from Firestore and displays them on the page.
 * @param {object} filters - Contains filtering criteria (faculty, ticket).
 */
async function fetchAndDisplayEvents(filters = {}) {
    const eventsList = document.getElementById('events-list');
    if (!eventsList) return;

    eventsList.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">Loading Events...</p>';
    
    // CRITICAL: Only fetch events that have been approved
    let eventsRef = db.collection("events").where("status", "==", "approved"); 
    
    // Apply Filters
    if (filters.faculty && filters.faculty !== 'all') {
        eventsRef = eventsRef.where('faculty', 'in', [filters.faculty, 'University Wide']);
    }
    
    if (filters.ticket === 'paid') {
         eventsRef = eventsRef.where('hasTickets', '==', true);
    } else if (filters.ticket === 'free') {
         eventsRef = eventsRef.where('hasTickets', '==', false);
    }
    
    // Order by date
    eventsRef = eventsRef.orderBy('date', 'asc');
    
    try {
        const snapshot = await eventsRef.get();
        if (snapshot.empty) {
            eventsList.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">No upcoming events found.</p>';
            return;
        }

        eventsList.innerHTML = '';
        snapshot.forEach(doc => {
            const event = doc.data();
            const isFree = event.hasTickets === false || event.ticketPrice === 0;
            const priceText = isFree ? 'Free' : `Rs. ${parseFloat(event.ticketPrice || 0).toFixed(2)}`;
            
            const eventCard = `
                <div class="event-card" data-category="${event.category || ''}" data-faculty="${event.faculty}">
                    <img src="${event.postImageUrl || 'https://via.placeholder.com/300x200?text=UNIVISTA+Event'}" alt="${event.name || event.title}">
                    <h3>${event.name || event.title}</h3>
                    <p>Date: ${event.date} | Time: ${event.time}</p>
                    <p>Location: ${event.location}</p>
                    <p class="event-price">Ticket: ${priceText}</p>
                    <button class="view-details-button" onclick="window.location.href='event-details.html?id=${doc.id}'">View Details</button>
                </div>
            `;
            eventsList.innerHTML += eventCard;
        });

    } catch (error) {
        eventsList.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: red;">Error loading events.</p>';
        console.error("Error fetching events:", error);
    }
}
window.fetchAndDisplayEvents = fetchAndDisplayEvents;


/**
 * Renders the top 3 upcoming events on the homepage.
 * NOTE: This function requires a separate, efficient query for approved events. 
 * For simplicity, you can call fetchAndDisplayEvents and reuse the data if available.
 */
// This function remains a basic template. You should implement the fetching logic if needed.
function renderEventsToHomepage(events) {
    const upcomingContainer = document.getElementById('upcoming-events-container'); 
    if (!upcomingContainer) return;

    if (events.length === 0) {
        upcomingContainer.innerHTML = '<p>No upcoming events at this time.</p>';
        return;
    }
    
    upcomingContainer.innerHTML = '<h2>Upcoming Events</h2>';
    events.slice(0, 3).forEach(event => {
        const eventCard = `
            <div class="upcoming-event-card">
                <h3>${event.name || event.title}</h3>
                <p>${event.faculty} - ${event.date}</p>
            </div>
        `;
        upcomingContainer.innerHTML += eventCard;
    });
}
window.renderEventsToHomepage = renderEventsToHomepage;


// =========================================================================
// --- 5. DOM CONTENT LOADED & TICKET BOOKING LOGIC (event-details.html) ---
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- File upload handler (Kept from your original file) ---
    const fileUploadBox = document.getElementById('file-upload-box');
    const eventPostImageInput = document.getElementById('event-post-image');
    const fileNameDisplay = document.getElementById('file-name-display');

    if (fileUploadBox) {
        fileUploadBox.addEventListener('click', () => eventPostImageInput.click());
        fileUploadBox.addEventListener('dragover', (e) => { e.preventDefault(); fileUploadBox.classList.add('dragover'); });
        fileUploadBox.addEventListener('dragleave', () => fileUploadBox.classList.remove('dragover'));
        fileUploadBox.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUploadBox.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                eventPostImageInput.files = e.dataTransfer.files;
                fileNameDisplay.textContent = eventPostImageInput.files[0].name;
            }
        });
        eventPostImageInput.addEventListener('change', () => {
            if (eventPostImageInput.files.length) {
                fileNameDisplay.textContent = eventPostImageInput.files[0].name;
            } else {
                fileNameDisplay.textContent = '';
            }
        });
    }

    // --- Ticket Booking Logic (event-details.html) ---
    const bookingForm = document.getElementById('ticket-booking-form');
    if (bookingForm) {
        bookingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Get user's UID if logged in, otherwise default to "Guest"
            const user = auth.currentUser;
            const userId = user ? user.uid : 'GUEST_' + Math.random().toString(36).substr(2, 9);

            const count = parseInt(document.getElementById('booking-count').value);
            const totalDue = parseFloat(document.getElementById('total-payment-display').textContent);
            
            window.bookingDetails = {
                email: document.getElementById('booking-email').value,
                name: document.getElementById('booking-name').value,
                phone: document.getElementById('booking-phone').value,
                count: count,
                total: totalDue,
                userId: userId, 
                eventId: new URLSearchParams(window.location.search).get('id') // Get event ID from URL
            };

            // Move to Step 3: Payment
            document.getElementById('event-step-2-booking').classList.add('hidden');
            document.getElementById('event-step-3-payment').classList.remove('hidden');
            document.getElementById('payment-due-display').textContent = totalDue.toFixed(2);
        });
    }

    // --- Payment Simulation & Final Booking ---
    const paymentForm = document.getElementById('payment-form');
    if (paymentForm) {
        paymentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // **DUMMY PAYMENT COMPLETE**
            alert("Dummy payment processing complete.");

            try {
                const { email, name, phone, count, total, eventId, userId } = window.bookingDetails;

                // 1. Generate a unique ticket ID/QR code data
                const ticketId = `TICKET-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
                
                // 2. Update event ticket count (Atomic update using transaction)
                const eventRef = db.collection("events").doc(eventId);
                await db.runTransaction(async (transaction) => {
                    const eventDoc = await transaction.get(eventRef);
                    if (!eventDoc.exists) throw new Error("Event does not exist!");
                    
                    const newAvailable = (eventDoc.data().availableTickets || 0) - count;
                    if (newAvailable < 0) throw new Error("Not enough tickets available!");
                    
                    // Update available tickets
                    transaction.update(eventRef, { availableTickets: newAvailable });
                });

                // 3. Create a ticket record in 'tickets' collection
                await db.collection("tickets").add({
                    ticketId: ticketId,
                    eventId: eventId,
                    userId: userId, // CRITICAL: Link the ticket to the user/guest ID
                    userEmail: email,
                    userName: name,
                    ticketCount: count,
                    amountPaid: total,
                    paymentStatus: 'paid',
                    qrCodeData: ticketId,
                    bookedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // 4. Update UI to Confirmation (Step 4)
                document.getElementById('event-step-3-payment').classList.add('hidden');
                document.getElementById('event-step-4-confirmation').classList.remove('hidden');
                document.getElementById('confirmed-email').textContent = email;
                document.getElementById('ticket-id-display').textContent = ticketId;
                

            } catch (error) {
                alert(`Booking Failed: ${error.message}`);
                console.error("Booking Error:", error);
                // On failure, revert back to the beginning step 
                document.getElementById('event-step-3-payment').classList.add('hidden');
                document.getElementById('event-step-1-details').classList.remove('hidden');
            }
        });
    }
});