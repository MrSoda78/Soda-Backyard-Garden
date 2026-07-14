document.addEventListener("DOMContentLoaded", function () {
    const carouselImages = Array.from(document.querySelectorAll(".carousel-image"));
    const slides = Array.from(document.querySelectorAll(".slide"));
    const dotsContainer = document.querySelector(".carousel-dots");
    const previousButton = document.querySelector(".carousel-btn.prev");
    const nextButton = document.querySelector(".carousel-btn.next");
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (carouselImages.length > 1 && !prefersReducedMotion) {
        let currentImage = 0;

        window.setInterval(function () {
            carouselImages[currentImage].classList.remove("active");
            currentImage = (currentImage + 1) % carouselImages.length;
            carouselImages[currentImage].classList.add("active");
        }, 3500);
    }

    if (slides.length > 0) {
        const dots = [];
        let currentSlide = 0;
        let slideTimer;

        if (dotsContainer) {
            slides.forEach(function (_slide, slideIndex) {
                const dot = document.createElement("button");
                dot.className = "dot";
                dot.type = "button";
                dot.setAttribute("aria-label", "Show garden photo " + (slideIndex + 1));
                dotsContainer.appendChild(dot);
                dots.push(dot);
            });
        }

        function showSlide(index) {
            currentSlide = (index + slides.length) % slides.length;

            slides.forEach(function (slide, slideIndex) {
                slide.classList.toggle("active", slideIndex === currentSlide);
            });

            dots.forEach(function (dot, dotIndex) {
                dot.classList.toggle("active", dotIndex === currentSlide);
                dot.setAttribute("aria-current", dotIndex === currentSlide ? "true" : "false");
            });
        }

        function restartSlideTimer() {
            if (slideTimer) {
                window.clearInterval(slideTimer);
            }

            if (!prefersReducedMotion && slides.length > 1) {
                slideTimer = window.setInterval(function () {
                    showSlide(currentSlide + 1);
                }, 4500);
            }
        }

        if (previousButton) {
            previousButton.addEventListener("click", function () {
                showSlide(currentSlide - 1);
                restartSlideTimer();
            });
        }

        if (nextButton) {
            nextButton.addEventListener("click", function () {
                showSlide(currentSlide + 1);
                restartSlideTimer();
            });
        }

        dots.forEach(function (dot, dotIndex) {
            dot.addEventListener("click", function () {
                showSlide(dotIndex);
                restartSlideTimer();
            });
        });

        showSlide(0);
        restartSlideTimer();
    }

    const orderForm = document.getElementById("orderForm");
    const orderTotal = document.getElementById("orderTotal");
    const orderTotalInput = document.getElementById("orderTotalInput");

    if (orderForm && orderTotal) {
        const quantityInputs = Array.from(orderForm.querySelectorAll("input[data-price]"));

        function updateOrderTotal() {
            const total = quantityInputs.reduce(function (sum, input) {
                const requestedQuantity = Math.max(0, Number.parseInt(input.value, 10) || 0);
                const maximumQuantity = Number.parseInt(input.max, 10);
                const quantity = Number.isNaN(maximumQuantity)
                    ? requestedQuantity
                    : Math.min(requestedQuantity, maximumQuantity);
                const price = Number.parseFloat(input.dataset.price) || 0;

                if (quantity !== requestedQuantity) {
                    input.value = quantity;
                }

                return sum + (quantity * price);
            }, 0);

            const formattedTotal = "$" + total.toFixed(2);
            orderTotal.textContent = "Estimated total: " + formattedTotal;

            if (orderTotalInput) {
                orderTotalInput.value = formattedTotal;
            }

            const formMessage = document.getElementById("formMessage");

            if (formMessage && total > 0) {
                formMessage.textContent = "";
                formMessage.classList.remove("error");
            }
        }

        quantityInputs.forEach(function (input) {
            input.addEventListener("input", updateOrderTotal);
        });

        orderForm.addEventListener("submit", function (event) {
            const itemCount = quantityInputs.reduce(function (sum, input) {
                return sum + (Number.parseInt(input.value, 10) || 0);
            }, 0);

            if (itemCount === 0) {
                event.preventDefault();
                const formMessage = document.getElementById("formMessage");

                if (formMessage) {
                    formMessage.textContent = "Please select at least one item before submitting your order request.";
                    formMessage.classList.add("error");
                }
            }
        });

        updateOrderTotal();
    }
});
