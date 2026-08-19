document.addEventListener('DOMContentLoaded', () => {
    
    // --- B2B Event Calculator Logic ---
    const guestSlider = document.getElementById('guestSlider');
    const guestCountVal = document.getElementById('guestCountVal');
    const totalPriceEl = document.getElementById('totalPrice');
    
    const optToppings = document.getElementById('optToppings');
    const optVegan = document.getElementById('optVegan');
    
    // Pricing configuration
    const basePricePerPerson = 4.50; // base price for ice cream catering per person
    const baseSetupFee = 150; // fixed cost for driving, setup, cart
    
    function calculatePrice() {
        const guests = parseInt(guestSlider.value);
        let perPersonCost = basePricePerPerson;
        
        // Add options
        if(optToppings.checked) {
            perPersonCost += parseFloat(optToppings.value);
        }
        if(optVegan.checked) {
            perPersonCost += parseFloat(optVegan.value);
        }
        
        // Calculate total
        // Volume discount: slight reduction per person if > 200 guests
        if(guests > 200) {
            perPersonCost *= 0.9;
        }
        
        let total = baseSetupFee + (guests * perPersonCost);
        
        // Update UI
        guestCountVal.textContent = guests;
        
        // Animate price change
        animateValue(totalPriceEl, parseInt(totalPriceEl.textContent), Math.round(total), 300);
    }
    
    // Listeners
    guestSlider.addEventListener('input', calculatePrice);
    optToppings.addEventListener('change', calculatePrice);
    optVegan.addEventListener('change', calculatePrice);
    
    // Init calculate
    calculatePrice();

    // Request Button Action - Opens Modal
    const modal = document.getElementById('bookingModal');
    const closeBtn = document.querySelector('.close-modal');
    
    document.getElementById('requestBtn').addEventListener('click', () => {
        document.getElementById('modalGuestCount').textContent = guestSlider.value;
        modal.classList.add('active');
    });

    closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    modal.addEventListener('click', (e) => {
        if(e.target === modal) {
            modal.classList.remove('active');
        }
    });

    // Handle Form Submit
    document.getElementById('bookingForm').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const guests = guestSlider.value;
        const total = totalPriceEl.textContent;
        const toppings = optToppings.checked ? 'Ja' : 'Nein';
        const vegan = optVegan.checked ? 'Ja' : 'Nein';
        
        const name = document.getElementById('bName').value;
        const email = document.getElementById('bEmail').value;
        const date = document.getElementById('bDate').value; // Format: YYYY-MM-DD -> Convert to DD.MM.YYYY
        const dateObj = new Date(date);
        const formattedDate = `${dateObj.getDate().toString().padStart(2, '0')}.${(dateObj.getMonth() + 1).toString().padStart(2, '0')}.${dateObj.getFullYear()}`;
        
        const phone = document.getElementById('bPhone').value;
        const location = document.getElementById('bLocation').value;
        const notes = document.getElementById('bNotes').value;
        
        // Format body exactly for the email-zu-json parser!
        const body = `Buchungsanfrage von der Website:
        
Von: ${name} <${email}>
Firma: ${name}

📅 Details zur Veranstaltung:
Datum: ${formattedDate}
Anzahl Gäste: ${guests} Personen

📍 Veranstaltungsort:
${location}

📞 Kontaktdaten:
Tel: ${phone}
E-Mail: ${email}

Besondere Wünsche:
Topping-Bar: ${toppings}
Vegane Option: ${vegan}
Budget-Schätzung: ca. ${total} €

Anmerkungen:
${notes}`;
        
        const subject = encodeURIComponent(`Neue Buchungsanfrage - ${formattedDate}`);
        const mailtoLink = `mailto:eisfavorit@gmail.com?subject=${subject}&body=${encodeURIComponent(body)}`;
        
        window.location.href = mailtoLink;
        modal.classList.remove('active');
    });

    // --- Helper: Animate Number ---
    function animateValue(obj, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    // --- Smooth Scrolling for Anchor Links ---
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if(target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});
