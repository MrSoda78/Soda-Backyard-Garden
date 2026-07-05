document.addEventListener("DOMContentLoaded", function () {

    // Order Form Elements
    const orderForm = document.getElementById("orderForm");
    const totalDisplay = document.getElementById("orderTotal");
    const formMessage = document.getElementById("formMessage");
    const quantityInputs = document.querySelectorAll(".product-row input[type='number']");

    // Calculate Order Total
    function updateTotal() {
        let total = 0;

        quantityInputs.forEach(function (input) {
            const price = parseFloat(input.dataset.price) || 0;
            const quantity = parseInt(input.value, 10) || 0;

            total += price * quantity;
        });

        if (totalDisplay) {
            totalDisplay.textContent = "Total: $" + total.toFixed(2);
        }
    }

    // Update Total When Quantities Change
    quantityInputs.forEach(function (input) {
        input.addEventListener("input", updateTotal);
    });

    // Order Form Submission Message
    if (orderForm && formMessage) {
        orderForm.addEventListener("submit", function () {
            formMessage.textContent =
                "Thank you. Your order request has been submitted.";
        });
    }

    // Initial Total Calculation
    updateTotal();

    console.log("Garden website loaded.");

    // =====================================
    // About Our Garden Slideshow
    // =====================================

    const images = [
        "images/Cabbage Row.jpg",
        "images/Vertical Planter.jpg",
        "images/Bok Choy.jpg",
        "images/Lettuce.jpg"
    ];

    let currentImage = 0;

    const aboutImage = document.getElementById("aboutImage");

    if (aboutImage) {

        aboutImage.style.opacity = 1;

        setInterval(function () {

            aboutImage.style.opacity = 0;

            setTimeout(function () {

                currentImage = (currentImage + 1) % images.length;

                aboutImage.src = images[currentImage];

                aboutImage.style.opacity = 1;

            }, 500);

        }, 4000);

    }

});