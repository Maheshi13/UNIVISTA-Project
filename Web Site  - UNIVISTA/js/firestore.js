// js/firestore.js - Centralized functions for Firebase Firestore and Storage operations

// Ensure db, storage, and auth are initialized in firebase-config.js and accessible globally
if (typeof db === 'undefined' || typeof storage === 'undefined' || typeof auth === 'undefined') {
    console.error("Firebase Auth, Firestore, or Storage is not initialized correctly. Check firebase-config.js.");
}

// =========================================================================
// --- 0. HELPER FUNCTIONS ---
// =========================================================================

/**
 * Gets the current user's profile and role from Firestore.
 * Uses onAuthStateChanged to reliably wait for the Firebase Auth state.
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
                        // User is logged in but the user document is missing. Assign default role.
                        resolve({ role: "user", uid: user.uid, email: user.email }); 
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


/**
 * Fetches details for a single event by its ID. Used by event-details.html.
 * @param {string} eventId - The document ID of the event.
 * @returns {Promise<object|null>} The event data or null if not found.
 */
async function fetchEventDetails(eventId) {
    try {
        const doc = await db.collection("events").doc(eventId).get();
        if (doc.exists) {
            return { id: doc.id, ...doc.data() };
        } else {
            console.error("No event found with ID:", eventId);
            return null;
        }
    } catch (error) {
        console.error("Error fetching event details:", error);
        return null;
    }
}
window.fetchEventDetails = fetchEventDetails;


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
        // Use the user's UID to organize files
        const storageRef = storage.ref(`event_posters/${user.uid}/${Date.now()}_${file.name}`); 
        const snapshot = await storageRef.put(file);
        imageUrl = await snapshot.ref.getDownloadURL();
    }

    // 2. Prepare Firestore Document Data
    const newEvent = {
        // Core Event Details (Mapping to your expected event structure)
        name: eventData.title, // Assuming eventData.title maps to event name
        faculty: eventData.faculty,
        description: eventData.description,
        date: eventData.date, 
        time: eventData.time,
        location: eventData.location,
        postImageUrl: imageUrl,
        
        // Ticket Details (Mapping isPaid/price)
        hasTickets: eventData.isPaid,
        ticketPrice: parseFloat(eventData.price) || 0,
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
            ticketPrice: parseFloat(eventData.ticketPrice) || 0,
            availableTickets: parseInt(eventData.availableTickets) || 0,
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
 * Fetches events that are pending approval for the crew's assigned faculty and renders them.
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
            
            // Fallback for name/title to be more robust
            const eventName = event.name || event.title || 'Untitled Event';

            html += `
                <li class="approval-item" data-id="${eventId}">
                    <h4>${eventName} (${event.faculty})</h4>
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
        // Ensure availableTickets is set to a non-zero value upon approval if tickets are required.
        // For now, setting a high default (100) or relying on crew to manually update.
        availableTickets: firebase.firestore.FieldValue.serverTimestamp() ? 100 : 0, 
        rejectionReason: firebase.firestore.FieldValue.delete() 
    })
    .then(() => {
        alert(`Event ID ${eventId} approved and is now live!`);
        // Remove the item from the list visually
        const listItem = document.querySelector(`.approval-item[data-id="${eventId}"]`);
        if(listItem) listItem.remove();
        // A better approach is to re-call fetchPendingEvents, but for this structure, removing the element is fine.
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
    if (!reason || reason.trim() === '') {
        alert("Rejection reason is required.");
        return;
    }
    const user = auth.currentUser;
    if (!user) {
        alert("Authentication error. Please log in again.");
        return;
    }

    const eventRef = db.collection("events").doc(eventId);

    eventRef.update({
        status: 'rejected',
        approvedBy: user.uid, // The user who performed the rejection
        rejectionReason: reason.trim(),
        approvalTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
    })
    .then(() => {
        alert(`Event ID ${eventId} rejected. Reason saved.`);
        // Remove the item from the list visually
        const listItem = document.querySelector(`.approval-item[data-id="${eventId}"]`);
        if(listItem) listItem.remove();
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
        // Query for events hosted by the selected faculty OR marked as University Wide
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
        const eventCardsHtml = [];

        if (snapshot.empty) {
            eventsList.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">No upcoming events found.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const event = doc.data();
            const isFree = event.hasTickets === false || parseFloat(event.ticketPrice) === 0;
            const priceText = isFree ? 'Free' : `Rs. ${parseFloat(event.ticketPrice || 0).toFixed(2)}`;
            const eventName = event.name || event.title || 'Untitled Event';
            
            eventCardsHtml.push(`
                <div class="event-card" data-category="${event.category || ''}" data-faculty="${event.faculty}">
                    <img src="${event.postImageUrl || 'https://via.placeholder.com/300x200?text=UNIVISTA+Event'}" alt="${eventName}">
                    <h3>${eventName}</h3>
                    <p>Date: ${event.date} | Time: ${event.time}</p>
                    <p>Location: ${event.location}</p>
                    <p class="event-price">Ticket: ${priceText}</p>
                    <button class="view-details-button" onclick="window.location.href='event-details.html?id=${doc.id}'">View Details</button>
                </div>
            `);
        });

        eventsList.innerHTML = eventCardsHtml.join('');

    } catch (error) {
        eventsList.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: red;">Error loading events.</p>';
        console.error("Error fetching events:", error);
    }
}
window.fetchAndDisplayEvents = fetchAndDisplayEvents;


/**
 * Renders the top 3 upcoming events on the homepage.
 * NOTE: This relies on fetchAndDisplayEvents being run first, or you can implement 
 * a separate query here to grab the data.
 */
// This function remains a basic template and should be called after fetching data.
function renderEventsToHomepage(events) {
    const upcomingContainer = document.getElementById('upcoming-events-container'); 
    if (!upcomingContainer) return;

    // Filter to only include approved events before slicing
    const approvedEvents = (events || []).filter(e => e.status === 'approved');

    if (approvedEvents.length === 0) {
        upcomingContainer.innerHTML = '<h2>Upcoming Events</h2><p>No upcoming events at this time.</p>';
        return;
    }
    
    let html = '<h2>Upcoming Events</h2>';
    approvedEvents.slice(0, 3).forEach(event => {
        const eventName = event.name || event.title || 'Untitled Event';
        html += `
            <div class="upcoming-event-card">
                <h3>${eventName}</h3>
                <p>${event.faculty} - ${event.date}</p>
                <button onclick="window.location.href='event-details.html?id=${event.id}'">Details</button>
            </div>
        `;
    });
    upcomingContainer.innerHTML = html;
}
window.renderEventsToHomepage = renderEventsToHomepage;


// =========================================================================
// --- 5. DOM CONTENT LOADED & TICKET BOOKING LOGIC (event-details.html) ---
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- File upload handler (for post-event.html) ---
    const fileUploadBox = document.getElementById('file-upload-box');
    const eventPostImageInput = document.getElementById('event-post-image');
    const fileNameDisplay = document.getElementById('file-name-display');

    if (fileUploadBox && eventPostImageInput && fileNameDisplay) {
        // Standard click handler
        fileUploadBox.addEventListener('click', () => eventPostImageInput.click()); 

        // Drag and Drop Handlers
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

        // File Selection Handler
        eventPostImageInput.addEventListener('change', () => {
            if (eventPostImageInput.files.length) {
                fileNameDisplay.textContent = eventPostImageInput.files[0].name;
            } else {
                fileNameDisplay.textContent = 'Drag & Drop or Click to Upload Image';
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

            const count = parseInt(document.getElementById('booking-count').value, 10);
            
            // CRITICAL: Recalculate total price based on ticket price displayed on the page
            const ticketPriceElement = document.getElementById('ticket-price-display');
            const priceMatch = ticketPriceElement ? ticketPriceElement.textContent.match(/Rs\. ([\d.]+)/) : null;
            const unitPrice = priceMatch ? parseFloat(priceMatch[1]) : 0;
            const totalDue = count * unitPrice;

            // Update the display element before moving to payment
            const totalPaymentDisplay = document.getElementById('total-payment-display');
            if (totalPaymentDisplay) {
                totalPaymentDisplay.textContent = totalDue.toFixed(2);
            }

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
            const step2 = document.getElementById('event-step-2-booking');
            const step3 = document.getElementById('event-step-3-payment');
            const paymentDueDisplay = document.getElementById('payment-due-display');

            if (step2 && step3 && paymentDueDisplay) {
                step2.classList.add('hidden');
                step3.classList.remove('hidden');
                paymentDueDisplay.textContent = totalDue.toFixed(2);
            } else {
                 console.error("Missing UI elements for payment step.");
                 alert("A critical part of the payment UI is missing. Cannot proceed.");
            }
        });
    }

    // --- Payment Simulation & Final Booking ---
    const paymentForm = document.getElementById('payment-form');
    if (paymentForm) {
        paymentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Check if booking details are available from step 2
            if (!window.bookingDetails || !window.bookingDetails.eventId) {
                alert("Booking details are missing. Please start over.");
                window.location.reload(); 
                return;
            }

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
                    
                    const currentAvailable = eventDoc.data().availableTickets || 0;

                    // Ensure tickets are still available
                    if (currentAvailable < count) {
                         throw new Error(`Only ${currentAvailable} ticket(s) remaining. Cannot book ${count}.`);
                    }

                    const newAvailable = currentAvailable - count;
                    
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
                    userPhone: phone,
                    ticketCount: count,
                    amountPaid: total,
                    paymentStatus: 'paid',
                    qrCodeData: ticketId, // Simple data for QR code generation
                    bookedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // 4. Update UI to Confirmation (Step 4)
                const step3 = document.getElementById('event-step-3-payment');
                const step4 = document.getElementById('event-step-4-confirmation');

                if (step3 && step4) {
                    step3.classList.add('hidden');
                    step4.classList.remove('hidden');
                    document.getElementById('confirmed-email').textContent = email;
                    document.getElementById('ticket-id-display').textContent = ticketId;
                    
                    // TODO: Implement QR Code Generation here using the ticketId
                    // E.g., new QRCode(document.getElementById('qr-code-display'), ticketId);

                } else {
                     alert("Booking succeeded, but confirmation UI failed to load.");
                }
                

            } catch (error) {
                alert(`Booking Failed: ${error.message}`);
                console.error("Booking Error:", error);
                // On failure, revert back to the beginning step 
                const step3 = document.getElementById('event-step-3-payment');
                const step1 = document.getElementById('event-step-1-details');
                if (step3 && step1) {
                     step3.classList.add('hidden');
                     step1.classList.remove('hidden');
                }
            }
        });
    }
});
