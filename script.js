document.addEventListener("DOMContentLoaded", function () {
    const carouselImages = Array.from(document.querySelectorAll(".carousel-image"));
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (carouselImages.length > 1 && !prefersReducedMotion) {
        let currentImage = 0;

        window.setInterval(function () {
            carouselImages[currentImage].classList.remove("active");
            currentImage = (currentImage + 1) % carouselImages.length;
            carouselImages[currentImage].classList.add("active");
        }, 3500);
    }

    const orderForm = document.getElementById("orderForm");
    const orderTotal = document.getElementById("orderTotal");
    const orderTotalInput = document.getElementById("orderTotalInput");

    if (orderForm && orderTotal) {
        const quantityInputs = Array.from(orderForm.querySelectorAll("input[data-price]"));

        function updateOrderTotal() {
            const total = quantityInputs.reduce(function (sum, input) {
                const quantity = Math.max(0, Number.parseInt(input.value, 10) || 0);
                const price = Number.parseFloat(input.dataset.price) || 0;
                return sum + (quantity * price);
            }, 0);

            const formattedTotal = "$" + total.toFixed(2);
            orderTotal.textContent = "Estimated total: " + formattedTotal;

            if (orderTotalInput) {
                orderTotalInput.value = formattedTotal;
            }
        }

        quantityInputs.forEach(function (input) {
            input.addEventListener("input", updateOrderTotal);
        });

        updateOrderTotal();
    }
});
