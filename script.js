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
    const formMessage = document.getElementById("formMessage");
    const quantityInputs = orderForm
        ? Array.from(orderForm.querySelectorAll("input[data-product-id]"))
        : [];

    function formatStock(product, element) {
        if (product.madeToOrder) {
            return "Made to order";
        }

        const quantity = product.quantity;
        const singular = element.dataset.unitSingular;
        const plural = element.dataset.unitPlural;

        if (singular && plural) {
            return quantity + " " + (quantity === 1 ? singular : plural) + " available";
        }

        return quantity + " available";
    }

    function renderInventory(products) {
        const productMap = new Map(products.map(function (product) {
            return [product.id, product];
        }));

        document.querySelectorAll("[data-stock]").forEach(function (element) {
            const product = productMap.get(element.dataset.stock);

            if (product) {
                element.textContent = formatStock(product, element);
            }
        });

        document.querySelectorAll("[data-stock-status]").forEach(function (element) {
            const productIds = element.dataset.stockStatus.split(",");
            const hasStock = productIds.some(function (productId) {
                const product = productMap.get(productId);
                return product && (product.madeToOrder || product.quantity > 0);
            });

            element.textContent = hasStock ? "Available" : "Sold out";
            element.classList.toggle("available", hasStock);
            element.classList.toggle("sold-out", !hasStock);
        });

        quantityInputs.forEach(function (input) {
            const product = productMap.get(input.dataset.productId);
            const stockLabel = document.querySelector('[data-order-stock="' + input.dataset.productId + '"]');

            if (!product) {
                input.disabled = true;
                return;
            }

            input.dataset.price = (product.priceCents / 100).toString();

            if (product.madeToOrder) {
                input.removeAttribute("max");
                input.disabled = false;
            } else {
                const orderLimit = Number.parseInt(input.dataset.orderLimit, 10);
                const maximumQuantity = Number.isNaN(orderLimit)
                    ? product.quantity
                    : Math.min(product.quantity, orderLimit);
                input.max = maximumQuantity.toString();
                input.disabled = product.quantity === 0;

                if (Number.parseInt(input.value, 10) > maximumQuantity) {
                    input.value = maximumQuantity;
                }
            }

            if (stockLabel) {
                stockLabel.textContent = product.madeToOrder
                    ? "Made to order"
                    : product.quantity + " available";
            }
        });
    }

    async function loadInventory() {
        const response = await fetch("/api/inventory", {
            headers: { "Accept": "application/json" },
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("Inventory is temporarily unavailable.");
        }

        const result = await response.json();
        renderInventory(result.products);
        return result.products;
    }

    if (document.querySelector("[data-stock]") || orderForm) {
        quantityInputs.forEach(function (input) {
            if (input.dataset.productId.indexOf("-tea") === -1) {
                input.disabled = true;
            }
        });

        loadInventory().catch(function () {
            document.querySelectorAll("[data-stock], [data-order-stock]").forEach(function (element) {
                element.textContent = "Availability temporarily unavailable";
            });

            if (formMessage) {
                formMessage.textContent = "We could not load the current produce quantities. Please try again shortly.";
                formMessage.classList.add("error");
            }
        });
    }

    if (orderForm && orderTotal) {
        const submitButton = orderForm.querySelector('button[type="submit"]');
        const orderConfirmation = document.getElementById("orderConfirmation");
        const confirmationName = document.getElementById("confirmationName");
        const confirmationOrderNumber = document.getElementById("confirmationOrderNumber");
        const confirmationTotal = document.getElementById("confirmationTotal");
        const placeAnotherOrderButton = document.getElementById("placeAnotherOrder");
        let isSubmitting = false;

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

            if (formMessage && total > 0 && !formMessage.classList.contains("success")) {
                formMessage.textContent = "";
                formMessage.classList.remove("error");
            }
        }

        async function sendEmailNotification(orderNumber) {
            const emailEndpoint = orderForm.dataset.emailEndpoint;

            if (!emailEndpoint) {
                return;
            }

            const emailData = new FormData(orderForm);
            emailData.set("_subject", "New Garden Order " + orderNumber);
            emailData.set("orderNumber", orderNumber);

            const response = await fetch(emailEndpoint, {
                method: "POST",
                body: emailData,
                headers: { "Accept": "application/json" }
            });

            if (!response.ok) {
                throw new Error("The order was saved, but the email notification failed.");
            }
        }

        quantityInputs.forEach(function (input) {
            input.addEventListener("input", updateOrderTotal);
        });

        orderForm.addEventListener("submit", async function (event) {
            event.preventDefault();

            if (isSubmitting) {
                return;
            }

            const items = {};

            quantityInputs.forEach(function (input) {
                const quantity = Math.max(0, Number.parseInt(input.value, 10) || 0);

                if (quantity > 0) {
                    items[input.dataset.productId] = quantity;
                }
            });

            if (Object.keys(items).length === 0) {
                formMessage.textContent = "Please select at least one item before submitting your order request.";
                formMessage.className = "form-message error";
                return;
            }

            isSubmitting = true;
            submitButton.disabled = true;
            submitButton.textContent = "Submitting order...";
            formMessage.textContent = "";
            formMessage.className = "form-message";

            try {
                const response = await fetch("/api/orders", {
                    method: "POST",
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        customerName: orderForm.elements.namedItem("customerName").value,
                        phone: orderForm.elements.namedItem("phone").value,
                        email: orderForm.elements.namedItem("email").value,
                        deliveryDay: orderForm.elements.namedItem("deliveryDay")
                            ? orderForm.elements.namedItem("deliveryDay").value
                            : "To be confirmed",
                        notes: orderForm.elements.namedItem("notes").value,
                        website: orderForm.elements.namedItem("website").value,
                        items: items
                    })
                });
                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || "We could not submit your order.");
                }

                try {
                    await sendEmailNotification(result.orderNumber);
                } catch (emailError) {
                    console.warn(emailError);
                }

                const customerName = orderForm.elements.namedItem("customerName").value.trim();
                orderForm.reset();
                updateOrderTotal();
                await loadInventory();

                if (orderConfirmation) {
                    confirmationName.textContent = customerName.split(/\s+/)[0] || "friend";
                    confirmationOrderNumber.textContent = result.orderNumber;
                    confirmationTotal.textContent = "Estimated total: " + result.total;
                    orderForm.hidden = true;
                    orderConfirmation.hidden = false;
                    orderConfirmation.focus();
                } else {
                    formMessage.textContent = "Order received! Your order number is " + result.orderNumber + ". We will contact you to confirm delivery.";
                    formMessage.className = "form-message success";
                }
            } catch (error) {
                formMessage.textContent = error.message || "We could not submit your order. Please try again.";
                formMessage.className = "form-message error";

                try {
                    await loadInventory();
                } catch (inventoryError) {
                    console.warn(inventoryError);
                }
            } finally {
                isSubmitting = false;
                submitButton.disabled = false;
                submitButton.textContent = "Submit Order Request";
            }
        });

        if (placeAnotherOrderButton && orderConfirmation) {
            placeAnotherOrderButton.addEventListener("click", function () {
                orderConfirmation.hidden = true;
                orderForm.hidden = false;
                formMessage.textContent = "";
                formMessage.className = "form-message";
                orderForm.elements.namedItem("customerName").focus();
            });
        }

        updateOrderTotal();
    }
});
