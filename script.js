document.addEventListener("DOMContentLoaded", function () {
    const carouselImages = Array.from(document.querySelectorAll(".carousel-image"));
    const slidesContainer = document.querySelector(".slides");
    const dotsContainer = document.querySelector(".carousel-dots");
    const previousButton = document.querySelector(".carousel-btn.prev");
    const nextButton = document.querySelector(".carousel-btn.next");
    const supportImagesContainer = document.querySelector(".support-images");
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let applyProductPageSearch = function () {};
    let applyOrderProductSearch = function () {};
    let syncOrderFormFromBasket = function () {};
    let currentProductMap = new Map();
    const basketStorageKey = "sbg-basket-v1";

    function readBasket() {
        try {
            const storedBasket = JSON.parse(window.localStorage.getItem(basketStorageKey) || "{}");

            if (!storedBasket || typeof storedBasket !== "object" || Array.isArray(storedBasket)) {
                return {};
            }

            return Object.fromEntries(Object.entries(storedBasket).filter(function (entry) {
                return typeof entry[0] === "string" && Number.isInteger(entry[1]) && entry[1] > 0;
            }));
        } catch (_error) {
            return {};
        }
    }

    let basket = readBasket();

    function saveBasket() {
        try {
            window.localStorage.setItem(basketStorageKey, JSON.stringify(basket));
        } catch (_error) {
            // The basket still works for this visit if browser storage is unavailable.
        }
    }

    function createSearchControl(id, labelText, placeholder) {
        const container = document.createElement("div");
        const label = document.createElement("label");
        const inputRow = document.createElement("div");
        const input = document.createElement("input");
        const clearButton = document.createElement("button");
        const message = document.createElement("p");

        container.className = "site-search";
        label.htmlFor = id;
        label.textContent = labelText;
        inputRow.className = "search-input-row";
        input.type = "search";
        input.id = id;
        input.placeholder = placeholder;
        clearButton.type = "button";
        clearButton.className = "button secondary search-clear-button";
        clearButton.textContent = "Clear";
        message.className = "search-result-message";
        message.setAttribute("aria-live", "polite");
        inputRow.append(input, clearButton);
        container.append(label, inputRow, message);

        clearButton.addEventListener("click", function () {
            input.value = "";
            input.dispatchEvent(new Event("input"));
            input.focus();
        });

        return { container, input, message };
    }

    const productGrids = Array.from(document.querySelectorAll("main .product-grid"));

    if (productGrids.length > 0) {
        const search = createSearchControl(
            "productPageSearch",
            "Search products",
            "Type a product name or description"
        );
        const firstGrid = productGrids[0];
        firstGrid.parentNode.insertBefore(search.container, firstGrid);

        applyProductPageSearch = function () {
            const query = search.input.value.trim().toLocaleLowerCase();
            const cards = Array.from(document.querySelectorAll("main .product-card"));
            let visibleCount = 0;

            cards.forEach(function (card) {
                const imageText = Array.from(card.querySelectorAll("img")).map(function (image) {
                    return image.alt;
                }).join(" ");
                const searchableText = (card.textContent + " " + imageText).toLocaleLowerCase();
                const isRetired = card.dataset.productRetired === "true";
                const matches = !isRetired && (!query || searchableText.includes(query));
                card.hidden = !matches;
                visibleCount += matches ? 1 : 0;
            });

            search.message.textContent = query
                ? (visibleCount === 0 ? "No matching products found." : visibleCount + " matching product" + (visibleCount === 1 ? "" : "s") + ".")
                : "";
        };

        search.input.addEventListener("input", applyProductPageSearch);
    }

    if (carouselImages.length > 1 && !prefersReducedMotion) {
        let currentImage = 0;

        window.setInterval(function () {
            carouselImages[currentImage].classList.remove("active");
            currentImage = (currentImage + 1) % carouselImages.length;
            carouselImages[currentImage].classList.add("active");
        }, 3500);
    }

    function initializeHomeCarousel() {
        const slides = Array.from(document.querySelectorAll(".slide"));

        if (slides.length === 0) {
            return;
        }

        const dots = [];
        let currentSlide = 0;
        let slideTimer;

        if (dotsContainer) {
            dotsContainer.replaceChildren();
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

    async function loadHomeCarousel() {
        if (!slidesContainer) {
            return;
        }

        try {
            const response = await fetch("/api/site-content", {
                headers: { "Accept": "application/json" },
                cache: "no-store"
            });

            if (!response.ok) {
                throw new Error("Home page images could not be loaded.");
            }

            const result = await response.json();

            if (Array.isArray(result.carousel) && result.carousel.length > 0) {
                slidesContainer.replaceChildren();
                result.carousel.forEach(function (slide, index) {
                    const image = document.createElement("img");
                    image.src = slide.imageUrl;
                    image.className = "slide" + (index === 0 ? " active" : "");
                    image.alt = slide.altText;
                    image.style.objectFit = slide.imageFit;
                    image.style.objectPosition = slide.imagePosition;
                    slidesContainer.appendChild(image);
                });
            }
        } catch (_error) {
            // Keep the built-in images as a safe fallback if the content service is unavailable.
        }

        initializeHomeCarousel();
    }

    loadHomeCarousel();

    async function loadSupportImages() {
        if (!supportImagesContainer) {
            return;
        }

        try {
            const response = await fetch("/api/site-content", {
                headers: { "Accept": "application/json" },
                cache: "no-store"
            });

            if (!response.ok) {
                throw new Error("Support page images could not be loaded.");
            }

            const result = await response.json();

            if (Array.isArray(result.supportImages) && result.supportImages.length > 0) {
                supportImagesContainer.replaceChildren();
                result.supportImages.forEach(function (managedImage) {
                    const image = document.createElement("img");
                    image.src = managedImage.imageUrl;
                    image.alt = managedImage.altText;
                    image.style.objectFit = managedImage.imageFit;
                    image.style.objectPosition = managedImage.imagePosition;
                    supportImagesContainer.appendChild(image);
                });
            }
        } catch (_error) {
            // Keep the built-in Support page images if the content service is unavailable.
        }
    }

    loadSupportImages();

    const orderForm = document.getElementById("orderForm");
    const orderTotal = document.getElementById("orderTotal");
    const orderTotalInput = document.getElementById("orderTotalInput");
    const formMessage = document.getElementById("formMessage");
    let quantityInputs = orderForm
        ? Array.from(orderForm.querySelectorAll("input[data-product-id]"))
        : [];
    const simpleAvailabilityProductIds = new Set([
        "brown-eggs",
        "white-eggs-flat"
    ]);

    function usesSimpleAvailability(product) {
        return simpleAvailabilityProductIds.has(product.id);
    }

    function formatStock(product, element) {
        if (!product.active) {
            return "Currently unavailable";
        }

        if (
            usesSimpleAvailability(product) &&
            (product.madeToOrder || product.quantity > 0)
        ) {
            return "Available" + formatOrderLimit(product);
        }

        if (product.madeToOrder) {
            return "Made to order" + formatOrderLimit(product);
        }

        const quantity = product.quantity;

        if (!Number.isFinite(quantity) || quantity <= 0) {
            return "Sold out" + formatOrderLimit(product);
        }

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

    function maximumBasketQuantity(product) {
        if (!product || !product.active || product.priceCents <= 0) {
            return 0;
        }

        const stockMaximum = product.madeToOrder
            ? 50
            : Math.max(0, Number.parseInt(product.quantity, 10) || 0);
        const orderMaximum = Number.isInteger(product.orderLimit)
            ? product.orderLimit
            : 50;

        return Math.max(0, Math.min(stockMaximum, orderMaximum, 50));
    }

    function basketQuantity(productId) {
        return Math.max(0, Number.parseInt(basket[productId], 10) || 0);
    }

    function setBasketQuantity(productId, requestedQuantity) {
        const maximum = maximumBasketQuantity(currentProductMap.get(productId));
        const quantity = Math.max(0, Math.min(
            Number.parseInt(requestedQuantity, 10) || 0,
            maximum
        ));

        if (quantity > 0) {
            basket[productId] = quantity;
        } else {
            delete basket[productId];
        }

        saveBasket();
    }

    function clearBasket() {
        basket = {};
        saveBasket();
    }

    function reconcileBasket(productMap) {
        let changed = false;

        Object.keys(basket).forEach(function (productId) {
            const maximum = maximumBasketQuantity(productMap.get(productId));
            const quantity = Math.min(basketQuantity(productId), maximum);

            if (quantity <= 0) {
                delete basket[productId];
                changed = true;
            } else if (quantity !== basket[productId]) {
                basket[productId] = quantity;
                changed = true;
            }
        });

        if (changed) {
            saveBasket();
        }
    }

    function productIdsForCard(card) {
        const productIds = [];
        const addProductId = function (productId) {
            const cleanProductId = productId.trim();

            if (cleanProductId && !productIds.includes(cleanProductId)) {
                productIds.push(cleanProductId);
            }
        };

        if (card.dataset.dynamicProductCard) {
            addProductId(card.dataset.dynamicProductCard);
        }

        [
            "data-price-display",
            "data-stock",
            "data-product-status",
            "data-stock-status",
            "data-product-group-status",
            "data-description-display",
            "data-product-image"
        ].forEach(function (attribute) {
            card.querySelectorAll("[" + attribute + "]").forEach(function (element) {
                element.getAttribute(attribute).split(",").forEach(addProductId);
            });
        });

        return productIds;
    }

    function basketIcon() {
        const icon = document.createElement("img");
        icon.src = "favicons/order.png";
        icon.alt = "";
        icon.setAttribute("aria-hidden", "true");
        return icon;
    }

    function createBasketProductAction(product) {
        const action = document.createElement("div");
        action.className = "basket-product-action";
        action.dataset.basketProductId = product.id;

        const maximum = maximumBasketQuantity(product);
        const quantity = Math.min(basketQuantity(product.id), maximum);

        if (maximum === 0) {
            const unavailable = document.createElement("button");
            unavailable.type = "button";
            unavailable.className = "basket-add-button";
            unavailable.disabled = true;
            unavailable.textContent = product.priceCents <= 0
                ? "Coming soon"
                : (product.active ? "Sold out" : "Unavailable");
            action.appendChild(unavailable);
            return action;
        }

        if (quantity === 0) {
            const addButton = document.createElement("button");
            addButton.type = "button";
            addButton.className = "basket-add-button";
            addButton.dataset.basketAction = "add";
            addButton.dataset.productId = product.id;
            addButton.setAttribute("aria-label", "Add " + product.name + " to basket");
            addButton.append(basketIcon(), document.createTextNode("Add to Basket"));
            action.appendChild(addButton);
            return action;
        }

        const stepper = document.createElement("div");
        stepper.className = "basket-quantity-control";

        const decreaseButton = document.createElement("button");
        decreaseButton.type = "button";
        decreaseButton.dataset.basketAction = "decrease";
        decreaseButton.dataset.productId = product.id;
        decreaseButton.textContent = "−";
        decreaseButton.setAttribute("aria-label", "Decrease " + product.name);

        const quantityDisplay = document.createElement("strong");
        quantityDisplay.className = "basket-quantity";
        quantityDisplay.textContent = quantity.toString();
        quantityDisplay.setAttribute("aria-label", quantity + " " + product.name + " in basket");

        const increaseButton = document.createElement("button");
        increaseButton.type = "button";
        increaseButton.dataset.basketAction = "increase";
        increaseButton.dataset.productId = product.id;
        increaseButton.textContent = "+";
        increaseButton.disabled = quantity >= maximum;
        increaseButton.setAttribute("aria-label", "Increase " + product.name);

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "basket-remove-button";
        removeButton.dataset.basketAction = "remove";
        removeButton.dataset.productId = product.id;
        removeButton.textContent = "Remove";
        removeButton.setAttribute("aria-label", "Remove " + product.name + " from basket");

        stepper.append(decreaseButton, quantityDisplay, increaseButton, removeButton);
        action.appendChild(stepper);
        return action;
    }

    function renderProductBasketControls(productMap) {
        document.querySelectorAll("[data-product-basket-controls]").forEach(function (controls) {
            controls.remove();
        });

        document.querySelectorAll("main .product-card").forEach(function (card) {
            const productIds = productIdsForCard(card);
            const products = productIds.map(function (productId) {
                return productMap.get(productId);
            }).filter(Boolean);
            const currentProducts = products.filter(function (product) {
                return product.category !== "retired";
            });

            if (productIds.length > 0 && currentProducts.length === 0) {
                card.dataset.productRetired = "true";
                card.hidden = true;
                return;
            }

            delete card.dataset.productRetired;

            if (currentProducts.length === 0) {
                return;
            }

            const content = card.querySelector(":scope > .product-card-content");

            if (!content) {
                return;
            }

            const controls = document.createElement("div");
            controls.className = "product-basket-controls";
            controls.dataset.productBasketControls = "true";

            if (currentProducts.length === 1) {
                controls.appendChild(createBasketProductAction(currentProducts[0]));
            } else {
                const heading = document.createElement("p");
                heading.className = "basket-options-heading";
                heading.textContent = "Choose an option";
                controls.appendChild(heading);

                currentProducts.forEach(function (product) {
                    const row = document.createElement("div");
                    row.className = "basket-variant-row";

                    const name = document.createElement("span");
                    name.className = "basket-variant-name";
                    name.textContent = product.name;

                    row.append(name, createBasketProductAction(product));
                    controls.appendChild(row);
                });
            }

            content.appendChild(controls);
        });

        applyProductPageSearch();
    }

    function updateReviewBasket(productMap) {
        const hasProductCards = Boolean(document.querySelector("main .product-card"));
        let reviewButton = document.getElementById("reviewBasketButton");

        if (!hasProductCards) {
            if (reviewButton) {
                reviewButton.remove();
            }
            return;
        }

        const basketItems = Object.keys(basket).map(function (productId) {
            const product = productMap.get(productId);
            const quantity = basketQuantity(productId);
            return { product, quantity };
        }).filter(function (item) {
            return item.product && item.quantity > 0;
        });
        const itemCount = basketItems.reduce(function (sum, item) {
            return sum + item.quantity;
        }, 0);
        const totalCents = basketItems.reduce(function (sum, item) {
            return sum + (item.product.priceCents * item.quantity);
        }, 0);

        if (!reviewButton) {
            reviewButton = document.createElement("a");
            reviewButton.id = "reviewBasketButton";
            reviewButton.className = "basket-review-button";
            reviewButton.href = "order.html#orderForm";
            reviewButton.setAttribute("aria-live", "polite");
            document.body.appendChild(reviewButton);
        }

        reviewButton.replaceChildren();
        reviewButton.appendChild(basketIcon());

        const text = document.createElement("span");
        text.className = "basket-review-text";
        const title = document.createElement("strong");
        title.textContent = "Review Basket";
        const summary = document.createElement("small");
        summary.textContent = itemCount + " " + (itemCount === 1 ? "item" : "items") +
            " · $" + (totalCents / 100).toFixed(2);
        text.append(title, summary);

        const orderAction = document.createElement("span");
        orderAction.className = "basket-review-action";
        orderAction.textContent = "Go to Order →";
        reviewButton.append(text, orderAction);
        reviewButton.hidden = itemCount === 0;
        document.body.classList.toggle("has-basket-review", itemCount > 0);
    }

    function renderBasketDisplays(productMap) {
        renderProductBasketControls(productMap);
        updateReviewBasket(productMap);
    }

    document.addEventListener("click", function (event) {
        const button = event.target.closest("[data-basket-action]");

        if (!button || button.disabled) {
            return;
        }

        const productId = button.dataset.productId;
        const action = button.dataset.basketAction;
        const quantity = basketQuantity(productId);

        if (action === "add" || action === "increase") {
            setBasketQuantity(productId, quantity + 1);
        } else if (action === "decrease") {
            setBasketQuantity(productId, quantity - 1);
        } else if (action === "remove") {
            setBasketQuantity(productId, 0);
        } else {
            return;
        }

        renderBasketDisplays(currentProductMap);
        syncOrderFormFromBasket(currentProductMap);
    });

    window.addEventListener("storage", function (event) {
        if (event.key !== basketStorageKey) {
            return;
        }

        basket = readBasket();
        reconcileBasket(currentProductMap);
        renderBasketDisplays(currentProductMap);
        syncOrderFormFromBasket(currentProductMap);
    });

    let productDetailsSequence = 0;

    function enhanceProductCards(root = document) {
        root.querySelectorAll(".product-card:not([data-details-toggle-ready])").forEach(function (card) {
            const content = card.querySelector(":scope > .product-card-content");
            const heading = content ? content.querySelector(":scope > h3") : null;

            if (!content || !heading) {
                return;
            }

            const detailElements = Array.from(content.children).filter(function (element) {
                return element !== heading;
            });

            if (detailElements.length === 0) {
                return;
            }

            productDetailsSequence += 1;
            const detailsId = "product-details-" + productDetailsSequence;
            const details = document.createElement("div");
            details.className = "product-card-details";
            details.id = detailsId;
            details.hidden = true;
            detailElements.forEach(function (element) {
                details.appendChild(element);
            });

            const toggle = document.createElement("button");
            toggle.type = "button";
            toggle.className = "product-details-toggle";
            toggle.textContent = "View details";
            toggle.setAttribute("aria-expanded", "false");
            toggle.setAttribute("aria-controls", detailsId);
            toggle.setAttribute("aria-label", "View details for " + heading.textContent.trim());
            toggle.addEventListener("click", function () {
                const willOpen = details.hidden;
                details.hidden = !willOpen;
                toggle.textContent = willOpen ? "Hide details" : "View details";
                toggle.setAttribute("aria-expanded", willOpen.toString());
                toggle.setAttribute(
                    "aria-label",
                    (willOpen ? "Hide details for " : "View details for ") + heading.textContent.trim()
                );
            });

            content.append(toggle, details);
            card.dataset.detailsToggleReady = "true";
            card.classList.add("is-collapsible");
        });
    }

    enhanceProductCards();

    let orderProductGroupSequence = 0;

    function updateOrderProductGroupSelection(group) {
        if (!group) {
            return;
        }

        const selection = group.querySelector(".order-product-group-selection");

        if (!selection) {
            return;
        }

        const selectedCount = Array.from(group.querySelectorAll("input[data-product-id]")).filter(function (input) {
            return (Number.parseInt(input.value, 10) || 0) > 0;
        }).length;

        selection.textContent = selectedCount + " selected";
        selection.hidden = selectedCount === 0;
    }

    function updateOrderProductGroupSummaries(productMap) {
        if (!orderForm) {
            return;
        }

        orderForm.querySelectorAll(".order-product-group").forEach(function (group) {
            const availability = group.querySelector(".order-product-group-availability");
            const products = Array.from(group.querySelectorAll("input[data-product-id]")).map(function (input) {
                return productMap.get(input.dataset.productId);
            }).filter(Boolean);
            const availableCount = products.filter(function (product) {
                return product.active && product.priceCents > 0 && (product.madeToOrder || product.quantity > 0);
            }).length;
            const hasActivePricedProduct = products.some(function (product) {
                return product.active && product.priceCents > 0;
            });
            const hasKnownPrice = products.some(function (product) {
                return product.priceCents > 0;
            });

            if (availability) {
                availability.textContent = availableCount > 0
                    ? availableCount + (availableCount === 1 ? " item available" : " items available")
                    : (hasActivePricedProduct ? "Sold out" : (hasKnownPrice ? "Unavailable" : "Coming soon"));
                availability.classList.toggle("is-available", availableCount > 0);
                availability.classList.toggle("is-unavailable", availableCount === 0);
            }

            updateOrderProductGroupSelection(group);
        });
    }

    function enhanceOrderProductGroups() {
        if (!orderForm) {
            return;
        }

        orderForm.querySelectorAll(".product-box > .product-group:not([data-order-group-toggle-ready]):not([data-order-group-always-open])").forEach(function (group) {
            const heading = group.querySelector(":scope > .product-group-title");

            if (!heading) {
                return;
            }

            const productElements = Array.from(group.children).filter(function (element) {
                return element !== heading;
            });

            if (productElements.length === 0) {
                return;
            }

            orderProductGroupSequence += 1;
            const detailsId = "order-product-group-" + orderProductGroupSequence;
            const details = document.createElement("div");
            details.className = "order-product-group-details";
            details.id = detailsId;
            details.hidden = true;

            productElements.forEach(function (element) {
                details.appendChild(element);
            });

            const categoryName = heading.textContent.trim();
            const controls = document.createElement("span");
            controls.className = "order-product-group-controls";

            const availability = document.createElement("span");
            availability.className = "order-product-group-availability";
            availability.textContent = "Checking availability...";

            const selection = document.createElement("span");
            selection.className = "order-product-group-selection";
            selection.textContent = "0 selected";
            selection.setAttribute("aria-live", "polite");
            selection.hidden = true;

            const toggle = document.createElement("button");
            toggle.type = "button";
            toggle.className = "order-product-group-toggle";
            toggle.textContent = "View products";
            toggle.setAttribute("aria-expanded", "false");
            toggle.setAttribute("aria-controls", detailsId);
            toggle.setAttribute("aria-label", "View products in " + categoryName);
            toggle.addEventListener("click", function () {
                const willOpen = details.hidden;
                details.hidden = !willOpen;
                toggle.textContent = willOpen ? "Hide products" : "View products";
                toggle.setAttribute("aria-expanded", willOpen.toString());
                toggle.setAttribute(
                    "aria-label",
                    (willOpen ? "Hide products in " : "View products in ") + categoryName
                );
            });

            controls.append(availability, selection, toggle);
            heading.appendChild(controls);
            group.appendChild(details);
            group.dataset.orderGroupToggleReady = "true";
            group.dataset.orderGroupName = categoryName;
            group.classList.add("order-product-group");
        });

        orderForm.addEventListener("invalid", function (event) {
            const details = event.target.closest(".order-product-group-details");

            if (!details || !details.hidden) {
                return;
            }

            const group = details.closest(".order-product-group");
            const toggle = group ? group.querySelector(".order-product-group-toggle") : null;

            details.hidden = false;

            if (toggle) {
                const categoryName = group.dataset.orderGroupName;
                toggle.textContent = "Hide products";
                toggle.setAttribute("aria-expanded", "true");
                toggle.setAttribute("aria-label", "Hide products in " + categoryName);
            }
        }, true);
    }

    enhanceOrderProductGroups();

    if (orderForm) {
        const productBox = orderForm.querySelector(".product-box");
        const productBoxTitle = productBox ? productBox.querySelector(".product-box-title") : null;

        if (productBox && productBoxTitle) {
            const search = createSearchControl(
                "orderProductSearch",
                "Search order products",
                "Type a product name"
            );
            productBoxTitle.insertAdjacentElement("afterend", search.container);

            applyOrderProductSearch = function () {
                const query = search.input.value.trim().toLocaleLowerCase();
                let visibleCount = 0;

                productBox.querySelectorAll(".product-row").forEach(function (row) {
                    const matches = !query || row.textContent.toLocaleLowerCase().includes(query);
                    row.hidden = !matches;
                    visibleCount += matches ? 1 : 0;
                });

                productBox.querySelectorAll(".product-group").forEach(function (group) {
                    const matchingRows = Array.from(group.querySelectorAll(".product-row")).filter(function (row) {
                        return !row.hidden;
                    });
                    group.hidden = query ? matchingRows.length === 0 : false;

                    if (query && matchingRows.length > 0) {
                        const details = group.querySelector(".order-product-group-details");
                        const toggle = group.querySelector(".order-product-group-toggle");

                        if (details) {
                            details.hidden = false;
                        }

                        if (toggle) {
                            toggle.textContent = "Hide products";
                            toggle.setAttribute("aria-expanded", "true");
                        }
                    }
                });

                search.message.textContent = query
                    ? (visibleCount === 0 ? "No matching order products found." : visibleCount + " matching product" + (visibleCount === 1 ? "" : "s") + ".")
                    : "";
            };

            search.input.addEventListener("input", applyOrderProductSearch);
        }
    }

    function createProductDescriptionElement(description, className) {
        const ingredientMatch = description.trim().match(/^ingredients\s*:\s*([\s\S]*)$/i);

        if (ingredientMatch) {
            const container = document.createElement("div");
            container.className = "ingredient-list " + className;

            const heading = document.createElement("h4");
            heading.textContent = "Ingredients";

            const ingredientText = document.createElement("p");
            ingredientText.textContent = ingredientMatch[1].trim();

            container.append(heading, ingredientText);
            return container;
        }

        const descriptionElement = document.createElement("p");
        descriptionElement.className = className;
        descriptionElement.textContent = description;
        return descriptionElement;
    }

    function createDynamicProductImage(product, imageSlot, imageUrl) {
        const image = document.createElement("img");
        image.className = "dynamic-product-image";
        image.src = imageUrl;
        image.alt = product.name + (imageSlot === 2 ? " — second view" : "");
        image.style.objectFit = imageSlot === 2
            ? (product.imageFit2 || "cover")
            : (product.imageFit || "cover");
        image.style.objectPosition = imageSlot === 2
            ? (product.imagePosition2 || "center")
            : (product.imagePosition || "center");
        image.addEventListener("error", function () {
            const placeholder = document.createElement("div");
            placeholder.className = "product-image-placeholder dynamic-product-image";
            placeholder.textContent = "Image coming soon";
            image.replaceWith(placeholder);
        }, { once: true });
        return image;
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

                const imageFileName = product.name === "Sweet Corn"
                    ? "Sweet Corn 2.jpg"
                    : product.name + ".jpg";
                const image = createDynamicProductImage(
                    product,
                    1,
                    product.imageUrl || ("images/" + encodeURIComponent(imageFileName))
                );

                if (product.imageUrl2) {
                    const imageStrip = document.createElement("div");
                    imageStrip.className = "product-photo-strip";
                    imageStrip.append(
                        image,
                        createDynamicProductImage(product, 2, product.imageUrl2)
                    );
                    card.appendChild(imageStrip);
                } else {
                    card.appendChild(image);
                }

                const content = document.createElement("div");
                content.className = "product-card-content";

                const heading = document.createElement("h3");
                heading.textContent = product.name;

                const price = document.createElement("p");
                price.className = "price";
                price.dataset.priceDisplay = product.id;
                price.textContent = formatProductPrice(product);

                const description = createProductDescriptionElement(
                    product.description,
                    "dynamic-product-description"
                );

                const stock = document.createElement("p");
                stock.className = "stock-count";
                const stockText = document.createElement("strong");
                stockText.dataset.stock = product.id;
                stockText.textContent = (
                    product.madeToOrder
                        ? (usesSimpleAvailability(product) ? "Available" : "Made to order")
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

        enhanceProductCards();
        applyProductPageSearch();
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
                        ? (usesSimpleAvailability(product) ? "Available" : "Made to order")
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

            if (group && !group.hasAttribute("data-dynamic-order-keep-visible")) {
                group.hidden = activeProducts.length === 0;
            }
        });

        quantityInputs = Array.from(orderForm.querySelectorAll("input[data-product-id]"));
    }

    function productDescriptions(productIds, productMap) {
        const descriptions = [];

        productIds.forEach(function (productId) {
            const product = productMap.get(productId.trim());
            const description = product ? product.description.trim() : "";

            if (description && !descriptions.includes(description)) {
                descriptions.push(description);
            }
        });

        return descriptions.join(" ");
    }

    function renderProductDescriptions(productMap) {
        document.querySelectorAll("[data-description-display]").forEach(function (element) {
            let description = productDescriptions(element.dataset.descriptionDisplay.split(","), productMap);
            const stripLabel = element.dataset.descriptionStripLabel;

            if (
                stripLabel &&
                description.toLocaleLowerCase().startsWith(stripLabel.toLocaleLowerCase() + ":")
            ) {
                description = description.slice(stripLabel.length + 1).trim();
            }

            element.textContent = description;
            element.hidden = description.length === 0;

            const container = element.closest("[data-description-container]");

            if (container) {
                container.hidden = description.length === 0;
            }
        });

        document.querySelectorAll(".product-card:not([data-dynamic-product-card])").forEach(function (card) {
            const content = card.querySelector(".product-card-content");

            if (!content || content.querySelector("[data-description-display]")) {
                return;
            }

            const productIds = [];
            const productIdAttributes = [
                "data-price-display",
                "data-stock",
                "data-product-status",
                "data-stock-status",
                "data-product-group-status"
            ];

            productIdAttributes.forEach(function (attribute) {
                content.querySelectorAll("[" + attribute + "]").forEach(function (element) {
                    element.getAttribute(attribute).split(",").forEach(function (productId) {
                        const cleanProductId = productId.trim();

                        if (cleanProductId && !productIds.includes(cleanProductId)) {
                            productIds.push(cleanProductId);
                        }
                    });
                });
            });

            const description = productDescriptions(productIds, productMap);
            const existingDescription = content.querySelector(".admin-product-description");

            if (existingDescription) {
                existingDescription.remove();
            }

            if (!description) {
                return;
            }

            const descriptionElement = createProductDescriptionElement(
                description,
                "product-note admin-product-description"
            );
            const detailsContainer = content.querySelector(":scope > .product-card-details");
            const insertionContainer = detailsContainer || content;

            const insertionPoint = insertionContainer.querySelector(
                ".availability-list, .ingredient-list, .stock-count, .status"
            );

            if (insertionPoint) {
                insertionContainer.insertBefore(descriptionElement, insertionPoint);
            } else {
                insertionContainer.appendChild(descriptionElement);
            }
        });
    }

    function renderManagedProductImages(productMap) {
        document.querySelectorAll("[data-product-image]").forEach(function (image) {
            const productIds = image.dataset.productImage.split(",").map(function (productId) {
                return productId.trim();
            });
            const product = productIds.map(function (productId) {
                return productMap.get(productId.trim());
            }).find(function (candidate) {
                return candidate && (candidate.imageUrl || candidate.imageUrl2);
            });

            if (!product) {
                return;
            }

            if (product.imageUrl) {
                image.src = product.imageUrl;
                image.alt = product.name;
                image.style.objectFit = product.imageFit || "cover";
                image.style.objectPosition = product.imagePosition || "center";
            }

            if (!product.imageUrl2 || productIds.length !== 1) {
                return;
            }

            let imageStrip = image.parentElement;

            if (!imageStrip.classList.contains("product-photo-strip")) {
                imageStrip = document.createElement("div");
                imageStrip.className = "product-photo-strip";
                image.replaceWith(imageStrip);
                imageStrip.appendChild(image);
            }

            let secondImage = imageStrip.querySelector(
                '[data-managed-product-second-image="' + product.id + '"]'
            );

            if (!secondImage) {
                secondImage = Array.from(imageStrip.querySelectorAll("img")).find(function (candidate) {
                    return candidate !== image && !candidate.dataset.productImage;
                }) || document.createElement("img");
                secondImage.dataset.managedProductSecondImage = product.id;

                if (!secondImage.parentElement) {
                    imageStrip.appendChild(secondImage);
                }
            }

            secondImage.src = product.imageUrl2;
            secondImage.alt = product.name + " — second view";
            secondImage.style.objectFit = product.imageFit2 || "cover";
            secondImage.style.objectPosition = product.imagePosition2 || "center";
        });
    }

    function renderInventory(products) {
        renderDynamicProductCards(products);
        renderDynamicOrderProducts(products);

        const productMap = new Map(products.map(function (product) {
            return [product.id, product];
        }));

        renderProductDescriptions(productMap);
        renderManagedProductImages(productMap);

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

        document.querySelectorAll("[data-product-group-status]").forEach(function (element) {
            const productsInGroup = element.dataset.productGroupStatus.split(",").map(function (productId) {
                return productMap.get(productId);
            }).filter(Boolean);
            const isAvailable = productsInGroup.some(function (product) {
                return product.active && (product.madeToOrder || product.quantity > 0);
            });
            const hasActiveProduct = productsInGroup.some(function (product) {
                return product.active && product.priceCents > 0;
            });
            const hasKnownPrice = productsInGroup.some(function (product) {
                return product.priceCents > 0;
            });
            const statusText = isAvailable
                ? "Available"
                : (hasActiveProduct ? "Sold out" : (hasKnownPrice ? "Unavailable" : "Coming soon"));

            element.textContent = statusText;
            element.classList.toggle("available", isAvailable);
            element.classList.toggle("sold-out", !isAvailable && hasActiveProduct);
            element.classList.toggle("coming", !isAvailable && !hasActiveProduct);
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

            if (product && input.labels && input.labels.length > 0) {
                const label = input.labels[0];
                const priceDisplay = label.querySelector("[data-price-display]");
                const nameNode = Array.from(label.childNodes).find(function (node) {
                    return node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0;
                });

                if (priceDisplay && nameNode) {
                    nameNode.textContent = product.name + " (";
                }
            }

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
                        ? (usesSimpleAvailability(product) ? "Available" : "Made to order")
                        : (product.quantity > 0 ? product.quantity + " available" : "Sold out")
                ) + formatOrderLimit(product);
            }
        });

        currentProductMap = productMap;
        reconcileBasket(productMap);
        renderBasketDisplays(productMap);
        syncOrderFormFromBasket(productMap);
        updateOrderProductGroupSummaries(productMap);
        applyOrderProductSearch();
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

            document.querySelectorAll(".order-product-group-availability").forEach(function (element) {
                element.textContent = "Unavailable";
                element.classList.add("is-unavailable");
            });

            if (formMessage) {
                formMessage.textContent = "We could not load the current produce quantities. Please try again shortly.";
                formMessage.classList.add("error");
            }
        });
    }

    if (orderForm && orderTotal) {
        const submitButton = orderForm.querySelector('button[type="submit"]');
        const clearOrderButton = document.getElementById("clearOrderButton");
        const clearOrderDialog = document.getElementById("clearOrderDialog");
        const keepOrderButton = document.getElementById("keepOrderButton");
        const confirmClearOrderButton = document.getElementById("confirmClearOrderButton");
        const orderConfirmation = document.getElementById("orderConfirmation");
        const confirmationName = document.getElementById("confirmationName");
        const confirmationOrderNumber = document.getElementById("confirmationOrderNumber");
        const confirmationTotal = document.getElementById("confirmationTotal");
        const confirmationItemList = document.getElementById("confirmationItemList");
        const validationSummary = document.getElementById("orderValidationSummary");
        const requiredFields = Array.from(orderForm.querySelectorAll("[required]"));
        let isSubmitting = false;
        let validationFocusScheduled = false;

        function getFieldLabel(field) {
            const label = orderForm.querySelector('label[for="' + field.id + '"]');
            return label ? label.childNodes[0].textContent.trim() : "This field";
        }

        function getFieldValidationMessage(field) {
            const label = getFieldLabel(field);

            if (field.validity.valueMissing) {
                return "Please enter your " + label.toLowerCase() + ".";
            }

            if (field.validity.typeMismatch && field.type === "email") {
                return "Please enter a valid email address, such as name@example.com.";
            }

            return "Please check your " + label.toLowerCase() + ".";
        }

        function showFieldError(field) {
            const group = field.closest(".form-group");
            const error = field.getAttribute("aria-describedby")
                ? document.getElementById(field.getAttribute("aria-describedby"))
                : null;

            field.classList.add("field-invalid");
            field.setAttribute("aria-invalid", "true");

            if (group) {
                group.classList.add("has-error");
            }

            if (error) {
                error.textContent = getFieldValidationMessage(field);
                error.hidden = false;
            }
        }

        function clearFieldError(field) {
            const group = field.closest(".form-group");
            const error = field.getAttribute("aria-describedby")
                ? document.getElementById(field.getAttribute("aria-describedby"))
                : null;

            field.classList.remove("field-invalid");
            field.removeAttribute("aria-invalid");

            if (group) {
                group.classList.remove("has-error");
            }

            if (error) {
                error.textContent = "";
                error.hidden = true;
            }
        }

        function formatFieldList(fields) {
            const labels = fields.map(getFieldLabel);

            if (labels.length < 2) {
                return labels[0] || "";
            }

            if (labels.length === 2) {
                return labels[0] + " and " + labels[1];
            }

            return labels.slice(0, -1).join(", ") + ", and " + labels[labels.length - 1];
        }

        function updateValidationSummary() {
            if (!validationSummary) {
                return [];
            }

            const invalidFields = requiredFields.filter(function (field) {
                return !field.validity.valid;
            });

            if (invalidFields.length === 0) {
                validationSummary.textContent = "";
                validationSummary.hidden = true;
                return invalidFields;
            }

            validationSummary.textContent = "Your order has not been submitted. Please complete or correct: " +
                formatFieldList(invalidFields) + ".";
            validationSummary.hidden = false;
            return invalidFields;
        }

        function focusFirstInvalidField() {
            const invalidFields = updateValidationSummary();
            const firstInvalidField = invalidFields[0];

            if (!firstInvalidField) {
                return;
            }

            firstInvalidField.focus({ preventScroll: true });
            firstInvalidField.scrollIntoView({ behavior: "smooth", block: "center" });
        }

        orderForm.addEventListener("invalid", function (event) {
            if (!requiredFields.includes(event.target)) {
                return;
            }

            event.preventDefault();
            showFieldError(event.target);

            if (!validationFocusScheduled) {
                validationFocusScheduled = true;
                window.setTimeout(function () {
                    focusFirstInvalidField();
                    validationFocusScheduled = false;
                }, 0);
            }
        }, true);

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

        syncOrderFormFromBasket = function (productMap) {
            quantityInputs.forEach(function (input) {
                const product = productMap.get(input.dataset.productId);
                const maximum = maximumBasketQuantity(product);
                input.value = Math.min(basketQuantity(input.dataset.productId), maximum).toString();
            });

            orderForm.querySelectorAll(".order-product-group").forEach(function (group) {
                updateOrderProductGroupSelection(group);
            });
            updateOrderTotal();
        };

        async function sendEmailNotification(orderNumber, items, total) {
            const emailEndpoint = orderForm.dataset.emailEndpoint;

            if (!emailEndpoint) {
                return;
            }

            const customerName = orderForm.elements.namedItem("customerName").value.trim();
            const customerEmail = orderForm.elements.namedItem("email").value.trim();
            const phone = orderForm.elements.namedItem("phone").value.trim();
            const household = orderForm.elements.namedItem("household").value.trim();
            const notes = orderForm.elements.namedItem("notes").value.trim();
            const emailData = new FormData();
            emailData.set("_subject", "New Garden Order " + orderNumber);
            emailData.set("_template", "table");
            emailData.set("_captcha", "false");
            emailData.set("Order Number", orderNumber);
            emailData.set("Customer", customerName);
            emailData.set("email", customerEmail);
            emailData.set("Phone", phone);

            if (household) {
                emailData.set("Address / Household", household);
            }
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
            if (requiredFields.includes(event.target)) {
                if (event.target.validity.valid) {
                    clearFieldError(event.target);

                    if (validationSummary && !validationSummary.hidden) {
                        updateValidationSummary();
                    }
                } else if (event.target.classList.contains("field-invalid")) {
                    showFieldError(event.target);
                }
            }

            if (event.target.matches("input[data-product-id]")) {
                setBasketQuantity(event.target.dataset.productId, event.target.value);
                renderBasketDisplays(currentProductMap);
                updateOrderTotal();
                updateOrderProductGroupSelection(event.target.closest(".order-product-group"));
            }
        });

        function clearOrderSelections() {
            clearBasket();
            quantityInputs.forEach(function (input) {
                input.value = "0";
            });
            renderBasketDisplays(currentProductMap);
            orderForm.querySelectorAll(".order-product-group").forEach(function (group) {
                updateOrderProductGroupSelection(group);
            });
            updateOrderTotal();

            if (formMessage) {
                formMessage.textContent = "Order selections cleared.";
                formMessage.className = "form-message";
            }
        }

        if (clearOrderButton) {
            clearOrderButton.addEventListener("click", function () {
                const hasSelectedProducts = quantityInputs.some(function (input) {
                    return (Number.parseInt(input.value, 10) || 0) > 0;
                });

                if (!hasSelectedProducts) {
                    if (formMessage) {
                        formMessage.textContent = "There were no selected products to clear.";
                        formMessage.className = "form-message";
                    }
                    return;
                }

                if (clearOrderDialog && typeof clearOrderDialog.showModal === "function") {
                    clearOrderDialog.showModal();
                    return;
                }

                clearOrderSelections();
            });
        }

        if (keepOrderButton && clearOrderDialog) {
            keepOrderButton.addEventListener("click", function () {
                clearOrderDialog.close();
            });
        }

        if (confirmClearOrderButton && clearOrderDialog) {
            confirmClearOrderButton.addEventListener("click", function () {
                clearOrderDialog.close();
                clearOrderSelections();
            });
        }

        if (clearOrderDialog) {
            clearOrderDialog.addEventListener("click", function (event) {
                if (event.target === clearOrderDialog) {
                    clearOrderDialog.close();
                }
            });
        }

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
            if (clearOrderButton) {
                clearOrderButton.disabled = true;
            }
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
                        household: orderForm.elements.namedItem("household").value,
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
                    await sendEmailNotification(result.orderNumber, result.items, result.total);
                } catch (emailError) {
                    console.warn(emailError);
                }

                const customerName = orderForm.elements.namedItem("customerName").value.trim();
                clearBasket();
                orderForm.reset();
                updateOrderTotal();
                await loadInventory();

                if (orderConfirmation) {
                    confirmationName.textContent = customerName.split(/\s+/)[0] || "friend";
                    confirmationOrderNumber.textContent = result.orderNumber;
                    confirmationTotal.textContent = "Estimated total: " + result.total;
                    const confirmationEmailStatus = document.getElementById("confirmationEmailStatus");

                    if (confirmationEmailStatus) {
                        confirmationEmailStatus.textContent = result.customerEmailSent
                            ? "A copy of this receipt was sent to your email address. Please check your junk folder if it is not in your inbox."
                            : "Please save or screenshot this receipt. We could not send the email copy, so the garden will contact you directly.";
                        confirmationEmailStatus.classList.toggle(
                            "confirmation-email-error",
                            !result.customerEmailSent
                        );
                    }

                    if (confirmationItemList) {
                        confirmationItemList.replaceChildren();
                        result.items.forEach(function (item) {
                            const listItem = document.createElement("li");
                            const itemDescription = document.createElement("span");
                            const itemTotal = document.createElement("strong");
                            itemDescription.textContent = item.quantity + " × " + item.name;
                            itemTotal.textContent = item.lineTotal;
                            listItem.append(itemDescription, itemTotal);
                            confirmationItemList.appendChild(listItem);
                        });
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
                if (clearOrderButton) {
                    clearOrderButton.disabled = false;
                }
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
