// General UI and Client-Side Interactions (Used across multiple pages)

document.addEventListener('DOMContentLoaded', () => {

    // --- Crew Register Faculty Box Selection (crew-register.html) ---
    const facultyBoxes = document.querySelectorAll('.faculty-box');
    const crewRegisterForm = document.getElementById('crew-register-form');
    const selectedFacultyInput = document.getElementById('crew-reg-faculty');
    const selectedFacultyNameDisplay = document.getElementById('selected-faculty-name');

    if (facultyBoxes.length > 0) {
        facultyBoxes.forEach(box => {
            box.addEventListener('click', () => {
                facultyBoxes.forEach(b => b.classList.remove('selected'));
                box.classList.add('selected');
                const facultyName = box.dataset.faculty;
                
                selectedFacultyInput.value = facultyName;
                selectedFacultyNameDisplay.textContent = facultyName;
                crewRegisterForm.classList.remove('hidden');
            });
        });
    }


    // --- Event Details Page: Ticket Price Calculation ---
    const bookingCountInput = document.getElementById('booking-count');
    const totalPaymentDisplay = document.getElementById('total-payment-display');
    const eventPriceDisplay = document.getElementById('event-price-display');

    if (bookingCountInput && totalPaymentDisplay && eventPriceDisplay) {
        
        // Simple logic to extract price. In a real app, this price would come from Firestore.
        function calculateTotal() {
            const priceText = eventPriceDisplay.textContent.toLowerCase();
            let unitPrice = 0;
            if (priceText.includes('rs.')) {
                unitPrice = parseFloat(priceText.replace('rs.', '').trim());
            } else if (priceText.includes('free')) {
                unitPrice = 0;
            } else {
                return;
            }
            
            const count = parseInt(bookingCountInput.value) || 0;
            const total = unitPrice * count;
            totalPaymentDisplay.textContent = total.toFixed(2);
        }
        
        bookingCountInput.addEventListener('input', calculateTotal);
        // Initial call (simulated event details loading should call this)
        // calculateTotal(); 
    }


    // --- Crew Dashboard: Event Form Review/Summary ---
    window.showSummary = function() {
        const form = document.getElementById('add-event-form');
        if (!form.checkValidity()) {
            form.reportValidity(); // Show native HTML validation messages
            return;
        }

        // 1. Gather Data
        const eventData = {
            name: document.getElementById('event-name').value,
            date: document.getElementById('event-date').value,
            time: document.getElementById('event-time').value,
            location: document.getElementById('event-location').value,
            category: document.getElementById('event-category').value,
            faculty: document.getElementById('event-faculty').value,
            description: document.getElementById('event-description').value,
            contact: document.getElementById('event-contact').value,
            audienceType: document.querySelector('input[name="audience-type"]:checked').value,
            audienceRestriction: document.getElementById('audience-faculty').value,
            hasTickets: document.getElementById('has-ticket-booking').checked,
            postImageFile: document.getElementById('event-post-image').files[0]
        };
        
        if (eventData.hasTickets) {
            eventData.ticketPrice = parseFloat(document.getElementById('ticket-price').value);
            eventData.availableTickets = parseInt(document.getElementById('available-tickets').value);
        } else {
            eventData.ticketPrice = 0;
            eventData.availableTickets = 99999; // Essentially unlimited for free events
        }

        // 2. Build Summary Alert/Modal
        let summary = `Event Summary (Faculty: ${eventData.faculty})\n\n`;
        summary += `Title: ${eventData.name}\n`;
        summary += `Date/Time: ${eventData.date} at ${eventData.time}\n`;
        summary += `Location: ${eventData.location}\n`;
        summary += `Category: ${eventData.category}\n`;
        summary += `Audience: ${eventData.audienceRestriction === 'all-university' ? 'University Wide' : eventData.audienceRestriction}\n`;
        summary += `Ticket Status: ${eventData.hasTickets ? 'Paid' : 'Free'}\n`;
        if (eventData.hasTickets) {
            summary += `  - Price: Rs. ${eventData.ticketPrice.toFixed(2)}\n`;
            summary += `  - Available: ${eventData.availableTickets}\n`;
        }
        summary += `\nImage: ${eventData.postImageFile ? eventData.postImageFile.name : 'No file selected'}\n`;
        
        if (confirm(summary + "\n\nDo you want to submit this event?")) {
            // Call the function in firestore.js to handle upload and save
            window.submitEvent(eventData); 
        }
    }
});

// NOTE: The Calendar logic for 'events.html' is a significant piece of client-side code 
// that is too long to include here, but it would involve standard JS Date objects
// and DOM manipulation to generate the grid, marking dates by checking the 'events' collection data.

// Simplified Calendar Logic placeholder (goes inside main.js)
// function renderCalendar(eventsData) { /* ... implementation ... */ }