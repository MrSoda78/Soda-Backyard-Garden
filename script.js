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
    let quantityInputs = orderForm
        ? Array.from(orderForm.querySelectorAll("input[data-product-id]"))
        : [];

    function formatStock(product, element) {
        if (!product.active) {
            return product.priceCents > 0 ? "Currently unavailable" : "Ordering not open yet";
        }

        if (product.madeToOrder) {
            return "Made to order" + formatOrderLimit(product);
        }

        const quantity = product.quantity;
        const singular = element.dataset.unitSingular;
        const plural = element.dataset.unitPlural;

        if (singular && plural) {
            return (
                quantity + " " + (quantity === 1 ? singular : plural) + " available" +
                formatOrderLimit(product)
            );
        }

        return quantity + " available" + formatOrderLimit(product);
    }

    function formatProductPrice(product) {
        if (product.priceCents <= 0) {
            return "Price to be determined";
        }

        const amount = "$" + (product.priceCents / 100).toFixed(2);
        return product.unit === "each" ? amount + " each" : amount + " per " + product.unit;
    }

    function formatOrderLimit(product) {
        return Number.isInteger(product.orderLimit)
            ? " · Maximum " + product.orderLimit + " per order"
            : "";
    }

    function renderDynamicProductCards(products) {
        document.querySelectorAll("[data-dynamic-products]").forEach(function (grid) {
            const category = grid.dataset.dynamicProducts;
            const activeProducts = products.filter(function (product) {
                return (
                    product.isSlot &&
                    product.category === category &&
                    product.active &&
                    product.priceCents > 0
                );
            });

            grid.querySelectorAll("[data-dynamic-product-card]").forEach(function (card) {
                card.remove();
            });

            activeProducts.forEach(function (product) {
                const card = document.createElement("div");
                card.className = "product-card";
                card.dataset.dynamicProductCard = product.id;

                const placeholder = document.createElement("div");
                placeholder.className = "product-image-placeholder dynamic-product-image";
                placeholder.textContent = "Image coming soon";
                card.appendChild(placeholder);

                const content = document.createElement("div");
                content.className = "product-card-content";

                const heading = document.createElement("h3");
                heading.textContent = product.name;

                const price = document.createElement("p");
                price.className = "price";
                price.dataset.priceDisplay = product.id;
                price.textContent = formatProductPrice(product);

                const description = document.createElement("p");
                description.className = "dynamic-product-description";
                description.textContent = product.description;

                const stock = document.createElement("p");
                stock.className = "stock-count";
                const stockText = document.createElement("strong");
                stockText.dataset.stock = product.id;
                stockText.textContent = (
                    product.madeToOrder
                        ? "Made to order"
                        : product.quantity + " available"
                ) + formatOrderLimit(product);
                stock.appendChild(stockText);

                const status = document.createElement("span");
                const available = product.madeToOrder || product.quantity > 0;
                status.className = "status " + (available ? "available" : "sold-out");
                status.dataset.productStatus = product.id;
                status.textContent = available ? "Available" : "Sold out";

                content.append(heading, price, description, stock, status);
                card.appendChild(content);
                grid.appendChild(card);
            });

            const section = document.querySelector(
                '[data-dynamic-section="' + category + '"]'
            );

            if (section) {
                section.hidden = activeProducts.length === 0;
            }
        });
    }

    function renderDynamicOrderProducts(products) {
        if (!orderForm) {
            return;
        }

        document.querySelectorAll("[data-dynamic-order-products]").forEach(function (container) {
            const category = container.dataset.dynamicOrderProducts;
            const activeProducts = products.filter(function (product) {
                return (
                    product.isSlot &&
                    product.category === category &&
                    product.active &&
                    product.priceCents > 0
                );
            });
            const group = document.querySelector(
                '[data-dynamic-order-group="' + category + '"]'
            );
            container.replaceChildren();

            activeProducts.forEach(function (product) {
                const row = document.createElement("div");
                row.className = "product-row";

                const inputId = "dynamic-" + product.id;
                const label = document.createElement("label");
                label.htmlFor = inputId;
                label.append(product.name + " (");

                const price = document.createElement("span");
                price.dataset.priceDisplay = product.id;
                price.textContent = formatProductPrice(product);
                label.appendChild(price);
                label.append(") ");

                const stock = document.createElement("small");
                stock.dataset.orderStock = product.id;
                stock.textContent = (
                    product.madeToOrder
                        ? "Made to order"
                        : product.quantity + " available"
                ) + formatOrderLimit(product);
                label.appendChild(stock);

                const input = document.createElement("input");
                input.type = "number";
                input.id = inputId;
                input.name = product.id + "Qty";
                input.min = "0";
                input.value = "0";
                input.dataset.price = (product.priceCents / 100).toString();
                input.dataset.productId = product.id;

                if (product.orderLimit !== null) {
                    input.dataset.orderLimit = product.orderLimit.toString();
                }

                if (product.madeToOrder) {
                    if (product.orderLimit !== null) {
                        input.max = product.orderLimit.toString();
                    }
                } else {
                    const maximumQuantity = product.orderLimit === null
                        ? product.quantity
                        : Math.min(product.quantity, product.orderLimit);
                    input.max = maximumQuantity.toString();
                    input.disabled = product.quantity === 0;
                }

                row.append(label, input);
                container.appendChild(row);
            });

            if (group) {
                group.hidden = activeProducts.length === 0;
            }
        });

        quantityInputs = Array.from(orderForm.querySelectorAll("input[data-product-id]"));
    }

    function renderInventory(products) {
        renderDynamicProductCards(products);
        renderDynamicOrderProducts(products);

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
                return product && product.active && (product.madeToOrder || product.quantity > 0);
            });

            element.textContent = hasStock ? "Available" : "Sold out";
            element.classList.toggle("available", hasStock);
            element.classList.toggle("sold-out", !hasStock);
        });

        document.querySelectorAll("[data-price-display]").forEach(function (element) {
            const product = productMap.get(element.dataset.priceDisplay);
            const hasKnownPrice = product && product.priceCents > 0;
            element.textContent = hasKnownPrice ? formatProductPrice(product) : "Price to be determined";
            element.classList.toggle("price-placeholder", !hasKnownPrice);
        });

        document.querySelectorAll("[data-product-status]").forEach(function (element) {
            const product = productMap.get(element.dataset.productStatus);
            const isComingSoon = !product || product.priceCents <= 0;
            const isUnavailable = product && product.priceCents > 0 && !product.active;
            const isAvailable = product && product.active && (product.madeToOrder || product.quantity > 0);
            element.textContent = isComingSoon
                ? "Coming soon"
                : (isUnavailable ? "Unavailable" : (isAvailable ? "Available" : "Sold out"));
            element.classList.toggle("coming", Boolean(isComingSoon || isUnavailable));
            element.classList.toggle("available", Boolean(isAvailable));
            element.classList.toggle("sold-out", Boolean(product && product.active && !isAvailable));
        });

        document.querySelectorAll("[data-coming-soon-note]").forEach(function (element) {
            const product = productMap.get(element.dataset.comingSoonNote);
            element.hidden = Boolean(product && product.active);
        });

        quantityInputs.forEach(function (input) {
            const product = productMap.get(input.dataset.productId);
            const stockLabel = document.querySelector('[data-order-stock="' + input.dataset.productId + '"]');

            if (!product || !product.active || product.priceCents <= 0) {
                input.disabled = true;
                input.value = "0";

                if (stockLabel && product && product.priceCents > 0) {
                    stockLabel.textContent = "Currently unavailable";
                }

                return;
            }

            input.dataset.price = (product.priceCents / 100).toString();

            if (product.orderLimit === null) {
                delete input.dataset.orderLimit;
            } else {
                input.dataset.orderLimit = product.orderLimit.toString();
            }

            if (product.madeToOrder) {
                if (product.orderLimit === null) {
                    input.removeAttribute("max");
                } else {
                    input.max = product.orderLimit.toString();

                    if (Number.parseInt(input.value, 10) > product.orderLimit) {
                        input.value = product.orderLimit;
                    }
                }
                input.disabled = false;
            } else {
                const maximumQuantity = product.orderLimit === null
                    ? product.quantity
                    : Math.min(product.quantity, product.orderLimit);
                input.max = maximumQuantity.toString();
                input.disabled = product.quantity === 0;

                if (Number.parseInt(input.value, 10) > maximumQuantity) {
                    input.value = maximumQuantity;
                }
            }

            if (stockLabel) {
                stockLabel.textContent = (
                    product.madeToOrder
                        ? "Made to order"
                        : product.quantity + " available"
                ) + formatOrderLimit(product);
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

    if (
        document.querySelector("[data-stock]") ||
        document.querySelector("[data-price-display]") ||
        document.querySelector("[data-product-status]") ||
        orderForm
    ) {
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
        const confirmationEmailStatus = document.getElementById("confirmationEmailStatus");
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

        async function sendEmailNotification(orderNumber, items, total) {
            const emailEndpoint = orderForm.dataset.emailEndpoint;

            if (!emailEndpoint) {
                return;
            }

            const customerName = orderForm.elements.namedItem("customerName").value.trim();
            const customerEmail = orderForm.elements.namedItem("email").value.trim();
            const phone = orderForm.elements.namedItem("phone").value.trim();
            const notes = orderForm.elements.namedItem("notes").value.trim();
            const emailData = new FormData();
            emailData.set("_subject", "New Garden Order " + orderNumber);
            emailData.set("_template", "table");
            emailData.set("_captcha", "false");
            emailData.set("_cc", customerEmail);
            emailData.set("Order Number", orderNumber);
            emailData.set("Customer", customerName);
            emailData.set("email", customerEmail);
            emailData.set("Phone", phone);
            emailData.set(
                "Items",
                items.map(function (item) {
                    return item.quantity + " × " + item.name + " — " + item.lineTotal;
                }).join("\n")
            );
            emailData.set("Estimated Total", total);
            emailData.set("Payment", "Send payment to marlenereid@hotmail.com");

            if (notes) {
                emailData.set("Notes", notes);
            }

            const response = await fetch(emailEndpoint, {
                method: "POST",
                body: emailData,
                headers: { "Accept": "application/json" }
            });

            if (!response.ok) {
                throw new Error("The order was saved, but the email notification failed.");
            }
        }

        orderForm.addEventListener("input", function (event) {
            if (event.target.matches("input[data-product-id]")) {
                updateOrderTotal();
            }
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

                let emailSent = true;

                try {
                    await sendEmailNotification(result.orderNumber, result.items, result.total);
                } catch (emailError) {
                    emailSent = false;
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

                    if (confirmationEmailStatus) {
                        confirmationEmailStatus.textContent = emailSent
                            ? "A copy of your order has been sent to your email address."
                            : "Your order was saved, but the email copy could not be sent.";
                        confirmationEmailStatus.classList.toggle("confirmation-email-error", !emailSent);
                    }

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

        updateOrderTotal();
    }

    const publicDonationForm = document.getElementById("publicDonationForm");

    if (publicDonationForm) {
        const amountInput = publicDonationForm.elements.namedItem("amount");
        const formMessageElement = document.getElementById("donationFormMessage");
        const confirmation = document.getElementById("donationConfirmation");
        const confirmationNameElement = document.getElementById("donationConfirmationName");
        const confirmationNumberElement = document.getElementById("donationConfirmationNumber");
        const confirmationAmountElement = document.getElementById("donationConfirmationAmount");
        const anotherDonationButton = document.getElementById("makeAnotherDonation");
        const submitButton = publicDonationForm.querySelector('button[type="submit"]');
        const amountButtons = Array.from(document.querySelectorAll("[data-donation-amount]"));
        let donationSubmitting = false;

        function selectDonationAmount(amount) {
            amountInput.value = Number(amount).toFixed(2);
            amountButtons.forEach(function (button) {
                const selected = Number(button.dataset.donationAmount) === Number(amount);
                button.classList.toggle("selected", selected);
                button.setAttribute("aria-pressed", selected.toString());
            });
            amountInput.focus();
        }

        async function sendDonationEmail(referenceNumber) {
            const emailEndpoint = publicDonationForm.dataset.emailEndpoint;

            if (!emailEndpoint) {
                return;
            }

            const emailData = new FormData(publicDonationForm);
            emailData.set("_subject", "New Garden Donation Request " + referenceNumber);
            emailData.set("referenceNumber", referenceNumber);

            const response = await fetch(emailEndpoint, {
                method: "POST",
                body: emailData,
                headers: { "Accept": "application/json" }
            });

            if (!response.ok) {
                throw new Error("The donation request was saved, but the email notification failed.");
            }
        }

        amountButtons.forEach(function (button) {
            button.setAttribute("aria-pressed", "false");
            button.addEventListener("click", function () {
                selectDonationAmount(button.dataset.donationAmount);
            });
        });

        amountInput.addEventListener("input", function () {
            amountButtons.forEach(function (button) {
                const selected = Number(button.dataset.donationAmount) === Number(amountInput.value);
                button.classList.toggle("selected", selected);
                button.setAttribute("aria-pressed", selected.toString());
            });
        });

        publicDonationForm.addEventListener("submit", async function (event) {
            event.preventDefault();

            if (donationSubmitting) {
                return;
            }

            const amount = Number.parseFloat(amountInput.value);

            if (!Number.isFinite(amount) || amount < 1) {
                formMessageElement.textContent = "Please enter a donation amount of at least $1.00.";
                formMessageElement.className = "form-message error";
                return;
            }

            donationSubmitting = true;
            submitButton.disabled = true;
            submitButton.textContent = "Submitting request...";
            formMessageElement.textContent = "";
            formMessageElement.className = "form-message";

            try {
                const response = await fetch("/api/donations", {
                    method: "POST",
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        donorName: publicDonationForm.elements.namedItem("donorName").value,
                        phone: publicDonationForm.elements.namedItem("phone").value,
                        email: publicDonationForm.elements.namedItem("email").value,
                        amountCents: Math.round(amount * 100),
                        note: publicDonationForm.elements.namedItem("note").value,
                        website: publicDonationForm.elements.namedItem("website").value
                    })
                });
                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || "We could not submit your donation request.");
                }

                try {
                    await sendDonationEmail(result.referenceNumber);
                } catch (emailError) {
                    console.warn(emailError);
                }

                const donorName = publicDonationForm.elements.namedItem("donorName").value.trim();
                publicDonationForm.reset();
                amountButtons.forEach(function (button) {
                    button.classList.remove("selected");
                    button.setAttribute("aria-pressed", "false");
                });
                confirmationNameElement.textContent = donorName.split(/\s+/)[0] || "friend";
                confirmationNumberElement.textContent = result.referenceNumber;
                confirmationAmountElement.textContent = "Donation amount: " + result.amount;
                publicDonationForm.hidden = true;
                confirmation.hidden = false;
                confirmation.focus();
            } catch (error) {
                formMessageElement.textContent = error.message || "We could not submit your donation request. Please try again.";
                formMessageElement.className = "form-message error";
            } finally {
                donationSubmitting = false;
                submitButton.disabled = false;
                submitButton.textContent = "Submit Donation Request";
            }
        });

        anotherDonationButton.addEventListener("click", function () {
            confirmation.hidden = true;
            publicDonationForm.hidden = false;
            formMessageElement.textContent = "";
            formMessageElement.className = "form-message";
            publicDonationForm.elements.namedItem("donorName").focus();
        });
    }
});
