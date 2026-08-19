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

    // Request Button Action
    document.getElementById('requestBtn').addEventListener('click', () => {
        const guests = guestSlider.value;
        const total = totalPriceEl.textContent;
        const toppings = optToppings.checked ? 'Ja' : 'Nein';
        const vegan = optVegan.checked ? 'Ja' : 'Nein';
        
        const message = `Hallo EisFavorite-Team,%0A%0Aich interessiere mich für ein Catering.%0A%0ADetails:%0A- Gäste: ${guests}%0A- Topping-Bar: ${toppings}%0A- Vegane Option: ${vegan}%0A- Budget-Schätzung: ca. ${total} €%0A%0ABitte kontaktieren Sie mich zwecks eines genauen Angebots.`;
        
        // Open WhatsApp with pre-filled message (or mailto)
        window.open(`https://wa.me/4917656813172?text=${message}`, '_blank');
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
