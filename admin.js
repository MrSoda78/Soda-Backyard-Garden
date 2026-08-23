document.addEventListener("DOMContentLoaded", function () {
    const loginPanel = document.getElementById("adminLoginPanel");
    const loginForm = document.getElementById("adminLoginForm");
    const loginMessage = document.getElementById("adminLoginMessage");
    const dashboard = document.getElementById("adminDashboard");
    const ordersList = document.getElementById("ordersList");
    const adminMessage = document.getElementById("adminMessage");
    const refreshButton = document.getElementById("refreshOrders");
    const deleteCancelledOrdersButton = document.getElementById("deleteCancelledOrders");
    const offlineOrderForm = document.getElementById("offlineOrderForm");
    const offlineOrderProducts = document.getElementById("offlineOrderProducts");
    const offlineOrderTotal = document.getElementById("offlineOrderTotal");
    const offlineOrderMessage = document.getElementById("offlineOrderMessage");
    const logoutButton = document.getElementById("adminLogout");
    const ordersTab = document.getElementById("ordersTab");
    const inventoryTab = document.getElementById("inventoryTab");
    const homeTab = document.getElementById("homeTab");
    const salesTab = document.getElementById("salesTab");
    const blockedTab = document.getElementById("blockedTab");
    const ordersPanel = document.getElementById("ordersPanel");
    const inventoryPanel = document.getElementById("inventoryPanel");
    const homePanel = document.getElementById("homePanel");
    const salesPanel = document.getElementById("salesPanel");
    const blockedPanel = document.getElementById("blockedPanel");
    const inventoryRows = document.getElementById("inventoryRows");
    const inventoryMessage = document.getElementById("inventoryMessage");
    const refreshInventoryButton = document.getElementById("refreshInventory");
    const saveInventoryButton = document.getElementById("saveInventory");
    const selectAllInventoryButton = document.getElementById("selectAllInventory");
    const deselectAllInventoryButton = document.getElementById("deselectAllInventory");
    const salesMessage = document.getElementById("salesMessage");
    const refreshSalesButton = document.getElementById("refreshSales");
    const exportSalesButton = document.getElementById("exportSales");
    const salesProductRows = document.getElementById("salesProductRows");
    const recentPaymentRows = document.getElementById("recentPaymentRows");
    const donationForm = document.getElementById("donationForm");
    const donationMessage = document.getElementById("donationMessage");
    const donationRows = document.getElementById("donationRows");
    const orderSearch = document.getElementById("adminOrderSearch");
    const orderSearchMessage = document.getElementById("adminOrderSearchMessage");
    const blockedCustomersList = document.getElementById("blockedCustomersList");
    const blockedCustomerCount = document.getElementById("blockedCustomerCount");
    const blockedCustomerForm = document.getElementById("blockedCustomerForm");
    const blockedCustomerMessage = document.getElementById("blockedCustomerMessage");
    const inventorySearch = document.getElementById("adminInventorySearch");
    const inventorySearchMessage = document.getElementById("adminInventorySearchMessage");
    const salesSearch = document.getElementById("adminSalesSearch");
    const salesSearchMessage = document.getElementById("adminSalesSearchMessage");
    const carouselMessage = document.getElementById("carouselMessage");
    const carouselItems = document.getElementById("carouselItems");
    const carouselUploadForm = document.getElementById("carouselUploadForm");
    const carouselProductForm = document.getElementById("carouselProductForm");
    const carouselProductImage = document.getElementById("carouselProductImage");
    const refreshCarouselButton = document.getElementById("refreshCarousel");
    const saveCarouselButton = document.getElementById("saveCarousel");
    let offlineQuantityInputs = [];
    let offlineProductsLoaded = false;
    let orderAdjustmentProducts = [];
    let carouselLoaded = false;
    const collapsedInventorySections = new Set();
    let inventorySectionsInitialized = false;

    function formatMoney(cents) {
        return "$" + (cents / 100).toFixed(2);
    }

    function setMessage(element, message, type) {
        element.textContent = message || "";
        element.className = "form-message" + (type ? " " + type : "");
    }

    function localDateValue() {
        const today = new Date();
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const day = String(today.getDate()).padStart(2, "0");
        return today.getFullYear() + "-" + month + "-" + day;
    }

    function resetDonationForm() {
        donationForm.reset();
        donationForm.receivedAt.value = localDateValue();
        donationForm.receivedAt.max = localDateValue();
    }

    function showLogin(message) {
        dashboard.hidden = true;
        loginPanel.hidden = false;
        setMessage(loginMessage, message || "", message ? "error" : "");
    }

    function showDashboard() {
        loginPanel.hidden = true;
        dashboard.hidden = false;
    }

    function createTextElement(tagName, className, text) {
        const element = document.createElement(tagName);
        element.className = className;
        element.textContent = text;
        return element;
    }

    function createActionButton(label, action, orderId, extraClass) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "button admin-action " + (extraClass || "");
        button.textContent = label;
        button.dataset.action = action;
        button.dataset.orderId = orderId;
        return button;
    }

    function createCancellationEmailLink(order) {
        const firstName = order.customerName.trim().split(/\s+/)[0] || order.customerName;
        const subject = "Update about your Soda Backyard Garden order " + order.orderNumber;
        const body = [
            "Hello " + firstName + ",",
            "",
            "Your Soda Backyard Garden order " + order.orderNumber + " has been cancelled.",
            "",
            "Any items reserved for this order have been returned to availability.",
            "",
            "If you already sent payment, please reply to this email so we can arrange the next step.",
            "",
            "We are sorry for the inconvenience. Please contact us if you have any questions.",
            "",
            "Soda Backyard Garden"
        ].join("\r\n");
        const link = document.createElement("a");
        link.className = "button admin-action danger";
        link.textContent = "Email Cancellation";
        link.href = "mailto:" + encodeURIComponent(order.email)
            + "?subject=" + encodeURIComponent(subject)
            + "&body=" + encodeURIComponent(body);
        link.setAttribute("aria-label", "Email cancellation notice to " + order.customerName);
        return link;
    }

    function createRefusalEmailLink(order) {
        const firstName = order.customerName.trim().split(/\s+/)[0] || order.customerName;
        const subject = "Update about your Soda Backyard Garden order " + order.orderNumber;
        const body = [
            "Hello " + firstName + ",",
            "",
            "Your order request " + order.orderNumber + " has not been accepted and will not be fulfilled.",
            "",
            "Any items held for this request have been returned to availability.",
            "",
            "If you already sent payment, please reply to this email so the next steps can be arranged.",
            "",
            "Thank you,",
            "Soda Backyard Garden"
        ].join("\r\n");
        const link = document.createElement("a");
        link.className = "button admin-action danger";
        link.textContent = "Email Refusal";
        link.href = "mailto:" + encodeURIComponent(order.email)
            + "?subject=" + encodeURIComponent(subject)
            + "&body=" + encodeURIComponent(body);
        link.setAttribute("aria-label", "Email refusal notice to " + order.customerName);
        return link;
    }

    function createOrderReceiptEmailLink(order) {
        const firstName = order.customerName.trim().split(/\s+/)[0] || order.customerName;
        const subject = "Your Soda Backyard Garden order " + order.orderNumber;
        const itemLines = order.items.map(function (item) {
            return item.quantity + " x " + item.name + " - " + formatMoney(item.lineTotalCents);
        });
        const body = [
            "Hello " + firstName + ",",
            "",
            "We received your Soda Backyard Garden order request.",
            "",
            "Order number: " + order.orderNumber,
            "",
            "Your order:",
            ...itemLines,
            "",
            "Estimated total: " + formatMoney(order.totalCents),
            order.notes ? "Your notes: " + order.notes : "",
            "",
            "What happens next:",
            "1. Send payment to marlenereid@hotmail.com.",
            "2. Your order is confirmed once payment is received.",
            "",
            "Please reply to this email if you need to make a change.",
            "",
            "Soda Backyard Garden"
        ].join("\r\n");
        const link = document.createElement("a");
        link.className = "button admin-action";
        link.textContent = "Email / Resend Order Receipt";
        link.href = "mailto:" + encodeURIComponent(order.email)
            + "?subject=" + encodeURIComponent(subject)
            + "&body=" + encodeURIComponent(body);
        link.setAttribute("aria-label", "Email order receipt to " + order.customerName);
        return link;
    }

    function updateOfflineOrderTotal() {
        const totalCents = offlineQuantityInputs.reduce(function (total, input) {
            const quantity = Math.max(0, Number.parseInt(input.value, 10) || 0);
            return total + (quantity * Number(input.dataset.priceCents));
        }, 0);
        offlineOrderTotal.textContent = "Total: " + formatMoney(totalCents);
    }

    function renderOfflineOrderProducts(products) {
        const categoryLabels = {
            produce: "Fresh Produce",
            tea: "Tea Mixes",
            baked: "Baked Goods",
            "pain-rub": "Pain Rub"
        };
        const categoryOrder = ["produce", "tea", "baked", "pain-rub"];
        const availableProducts = products.filter(function (product) {
            return product.active && product.priceCents > 0;
        });
        const groupedProducts = new Map();

        offlineOrderProducts.replaceChildren();

        availableProducts.forEach(function (product) {
            const category = product.category || "produce";

            if (!groupedProducts.has(category)) {
                groupedProducts.set(category, []);
            }

            groupedProducts.get(category).push(product);
        });

        const orderedCategories = [
            ...categoryOrder.filter(function (category) {
                return groupedProducts.has(category);
            }),
            ...Array.from(groupedProducts.keys()).filter(function (category) {
                return !categoryOrder.includes(category);
            })
        ];

        orderedCategories.forEach(function (category) {
            const group = document.createElement("div");
            group.className = "product-group";
            const heading = createTextElement(
                "h4",
                "product-group-title",
                categoryLabels[category] || "Other Products"
            );
            group.appendChild(heading);

            groupedProducts.get(category).forEach(function (product) {
                const row = document.createElement("div");
                row.className = "product-row";
                const inputId = "offline-quantity-" + product.id;
                const label = document.createElement("label");
                label.htmlFor = inputId;
                const stockText = product.madeToOrder
                    ? "No fixed quantity"
                    : product.quantity + " available";
                label.textContent = product.name + " (" + formatMoney(product.priceCents) + " per " + product.unit + ") ";
                label.appendChild(createTextElement("small", "", stockText));

                const input = document.createElement("input");
                input.type = "number";
                input.id = inputId;
                input.min = "0";
                input.value = "0";
                input.dataset.productId = product.id;
                input.dataset.priceCents = product.priceCents.toString();

                const maximumQuantity = product.madeToOrder
                    ? (product.orderLimit === null ? 50 : product.orderLimit)
                    : (product.orderLimit === null
                        ? product.quantity
                        : Math.min(product.quantity, product.orderLimit));
                input.max = maximumQuantity.toString();
                input.disabled = maximumQuantity === 0;

                row.append(label, input);
                group.appendChild(row);
            });

            offlineOrderProducts.appendChild(group);
        });

        if (availableProducts.length === 0) {
            offlineOrderProducts.appendChild(createTextElement(
                "p",
                "admin-empty",
                "No products are currently available to order."
            ));
        }

        offlineQuantityInputs = Array.from(
            offlineOrderProducts.querySelectorAll("input[data-product-id]")
        );
        updateOfflineOrderTotal();
    }

    async function loadOfflineOrderProducts() {
        offlineOrderProducts.textContent = "Loading available products...";
        const response = await fetch("/api/admin/inventory", {
            headers: { "Accept": "application/json" },
            cache: "no-store"
        });

        if (response.status === 401) {
            showLogin();
            return;
        }

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Available products could not be loaded.");
        }

        renderOfflineOrderProducts(result.products);
        offlineProductsLoaded = true;
    }

    function switchPanel(panelName) {
        const panels = {
            orders: { tab: ordersTab, panel: ordersPanel },
            inventory: { tab: inventoryTab, panel: inventoryPanel },
            home: { tab: homeTab, panel: homePanel },
            sales: { tab: salesTab, panel: salesPanel },
            blocked: { tab: blockedTab, panel: blockedPanel }
        };

        Object.entries(panels).forEach(function ([name, entry]) {
            const isActive = name === panelName;
            entry.panel.hidden = !isActive;
            entry.tab.classList.toggle("active", isActive);
            entry.tab.setAttribute("aria-selected", isActive.toString());
        });

        if (panelName === "inventory") {
            loadInventory().catch(function (error) {
                setMessage(inventoryMessage, error.message, "error");
            });
        } else if (panelName === "home") {
            loadCarousel().catch(function (error) {
                setMessage(carouselMessage, error.message, "error");
            });
        } else if (panelName === "sales") {
            loadSales().catch(function (error) {
                setMessage(salesMessage, error.message, "error");
            });
        }
    }

    function createInventoryInput(type, value, className) {
        const input = document.createElement("input");
        input.type = type;
        input.value = value;
        input.className = className;
        return input;
    }

    function createImageSelect(className, value, options, label) {
        const select = document.createElement("select");
        select.className = className;
        select.setAttribute("aria-label", label);

        options.forEach(function (option) {
            const element = document.createElement("option");
            element.value = option.value;
            element.textContent = option.label;
            element.selected = option.value === value;
            select.appendChild(element);
        });

        return select;
    }

    const imageFitOptions = [
        { value: "cover", label: "Fill frame" },
        { value: "contain", label: "Show whole image" }
    ];
    const imagePositionOptions = [
        { value: "center", label: "Centre" },
        { value: "top", label: "Top" },
        { value: "bottom", label: "Bottom" },
        { value: "left", label: "Left" },
        { value: "right", label: "Right" }
    ];

    function loadImageElement(file) {
        return new Promise(function (resolve, reject) {
            const image = new Image();
            const objectUrl = URL.createObjectURL(file);
            image.onload = function () {
                URL.revokeObjectURL(objectUrl);
                resolve(image);
            };
            image.onerror = function () {
                URL.revokeObjectURL(objectUrl);
                reject(new Error("That image could not be read."));
            };
            image.src = objectUrl;
        });
    }

    async function prepareImageForUpload(file) {
        if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            throw new Error("Choose a JPG, PNG, or WebP image.");
        }

        const image = await loadImageElement(file);
        const maximumDimension = 1600;
        const scale = Math.min(1, maximumDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        const blob = await new Promise(function (resolve) {
            canvas.toBlob(resolve, "image/webp", 0.84);
        });

        if (!blob) {
            throw new Error("That image could not be prepared for upload.");
        }

        const baseName = file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "garden-image";
        return new File([blob], baseName + ".webp", { type: "image/webp" });
    }

    function isEmptyProductSlot(product) {
        return product.isSlot && product.name.trim().startsWith("New Product Slot");
    }

    function appendInventoryHeading(label, isCurrentSection, sectionKey, productCount) {
        const sectionRow = document.createElement("tr");
        const sectionCell = document.createElement("th");
        const toggle = document.createElement("button");
        sectionCell.colSpan = 9;
        sectionCell.scope = "rowgroup";
        sectionCell.className = "inventory-section-heading";
        sectionCell.classList.toggle("inventory-current-heading", isCurrentSection);
        sectionRow.dataset.inventoryHeading = sectionKey;
        toggle.type = "button";
        toggle.className = "inventory-section-toggle";
        toggle.dataset.inventorySectionToggle = sectionKey;
        toggle.innerHTML = "<span>" + label + " <small>(" + productCount + ")</small></span><span class=\"inventory-toggle-icon\" aria-hidden=\"true\"></span>";
        sectionCell.appendChild(toggle);
        sectionRow.appendChild(sectionCell);
        inventoryRows.appendChild(sectionRow);
    }

    function normalizedSearch(value) {
        return value.trim().toLocaleLowerCase();
    }

    function filterOrders() {
        const query = normalizedSearch(orderSearch.value);
        const cards = Array.from(ordersList.querySelectorAll(".admin-order-card"));
        let visibleCount = 0;

        cards.forEach(function (card) {
            const matches = !query || card.dataset.orderSearch.includes(query);
            card.hidden = !matches;
            visibleCount += matches ? 1 : 0;
        });

        orderSearchMessage.textContent = query
            ? (visibleCount === 0 ? "No matching orders found." : visibleCount + " matching order" + (visibleCount === 1 ? "" : "s") + ".")
            : "";
    }

    function filterSales() {
        const query = normalizedSearch(salesSearch.value);
        const rows = Array.from(document.querySelectorAll(
            "#salesProductRows tr, #recentPaymentRows tr, #donationRows tr"
        ));
        let visibleCount = 0;

        rows.forEach(function (row) {
            const matches = !query || row.textContent.toLocaleLowerCase().includes(query);
            row.hidden = !matches;
            visibleCount += matches ? 1 : 0;
        });

        salesSearchMessage.textContent = query
            ? (visibleCount === 0 ? "No matching sales or donations found." : visibleCount + " matching record" + (visibleCount === 1 ? "" : "s") + ".")
            : "";
    }

    function filterInventoryRows() {
        const query = normalizedSearch(inventorySearch.value);
        const sectionMatches = new Map();
        let visibleCount = 0;

        inventoryRows.querySelectorAll("tr[data-product-id]").forEach(function (row) {
            const liveValues = Array.from(row.querySelectorAll("input, textarea")).map(function (input) {
                return input.value;
            }).join(" ").toLocaleLowerCase();
            const matches = !query || (row.dataset.inventorySearch + " " + liveValues).includes(query);
            const collapsed = collapsedInventorySections.has(row.dataset.inventorySection);
            row.hidden = !matches || (!query && collapsed);

            if (matches) {
                visibleCount += 1;
                sectionMatches.set(row.dataset.inventorySection, true);
            }
        });

        inventoryRows.querySelectorAll("tr[data-inventory-heading]").forEach(function (row) {
            const sectionKey = row.dataset.inventoryHeading;
            const toggle = row.querySelector(".inventory-section-toggle");
            const collapsed = collapsedInventorySections.has(sectionKey);
            row.hidden = query ? !sectionMatches.get(sectionKey) : false;
            toggle.setAttribute("aria-expanded", (!collapsed || Boolean(query)).toString());
            toggle.classList.toggle("is-collapsed", collapsed && !query);
        });

        inventorySearchMessage.textContent = query
            ? (visibleCount === 0 ? "No matching inventory products found." : visibleCount + " matching product" + (visibleCount === 1 ? "" : "s") + ".")
            : "";
    }

    function renderInventory(products) {
        inventoryRows.replaceChildren();
        const categories = [
            { id: "produce", label: "Fresh Produce" },
            { id: "tea", label: "Tea Mixes" },
            { id: "baked", label: "Baked Goods" },
            { id: "pain-rub", label: "Pain Rub" }
        ];
        const displayedProductIds = new Set();
        const displayRows = [];

        categories.forEach(function (category) {
            const currentProducts = products.filter(function (product) {
                return product.category === category.id && !isEmptyProductSlot(product);
            });
            const emptySlots = products.filter(function (product) {
                return product.category === category.id && isEmptyProductSlot(product);
            });

            if (currentProducts.length > 0) {
                displayRows.push({ heading: category.label + " — Current Products", current: true, sectionKey: category.id + "-current", productCount: currentProducts.length });
                currentProducts.forEach(function (product) {
                    displayRows.push({ product, sectionKey: category.id + "-current" });
                    displayedProductIds.add(product.id);
                });
            }

            if (emptySlots.length > 0) {
                displayRows.push({ heading: category.label + " — New Product Slots", current: false, sectionKey: category.id + "-slots", productCount: emptySlots.length });
                emptySlots.forEach(function (product) {
                    displayRows.push({ product, sectionKey: category.id + "-slots" });
                    displayedProductIds.add(product.id);
                });
            }
        });

        const uncategorizedProducts = products.filter(function (product) {
            return !displayedProductIds.has(product.id) && product.category !== "retired";
        });

        if (uncategorizedProducts.length > 0) {
            displayRows.push({ heading: "Other Products", current: true, sectionKey: "other-current", productCount: uncategorizedProducts.length });
            uncategorizedProducts.forEach(function (product) {
                displayRows.push({ product, sectionKey: "other-current" });
            });
        }

        if (!inventorySectionsInitialized) {
            displayRows.filter(function (entry) {
                return entry.sectionKey && entry.sectionKey.endsWith("-slots");
            }).forEach(function (entry) {
                collapsedInventorySections.add(entry.sectionKey);
            });
            inventorySectionsInitialized = true;
        }

        displayRows.forEach(function (entry) {
            if (entry.heading) {
                appendInventoryHeading(entry.heading, entry.current, entry.sectionKey, entry.productCount);
                return;
            }

            const product = entry.product;
            const emptySlot = isEmptyProductSlot(product);

            const row = document.createElement("tr");
            row.dataset.productId = product.id;
            row.dataset.inventorySection = entry.sectionKey;
            row.dataset.inventorySearch = [
                product.name,
                product.description,
                product.unit,
                product.category,
                product.active ? "available" : "unavailable",
                product.madeToOrder ? "made to order" : "fixed quantity"
            ].join(" ").toLocaleLowerCase();
            row.classList.toggle("inventory-slot-row", emptySlot);
            row.classList.toggle("inventory-custom-product-row", product.isSlot);

            const nameCell = document.createElement("td");
            const nameInput = createInventoryInput("text", product.name, "inventory-name");
            nameInput.setAttribute("aria-label", "Product name");
            nameCell.appendChild(nameInput);

            const imageCell = document.createElement("td");
            const imageEditor = document.createElement("div");
            imageEditor.className = "inventory-image-editor";
            const imagePreview = document.createElement("div");
            imagePreview.className = "inventory-image-preview";
            imagePreview.dataset.productImagePreview = product.id;

            if (product.imageUrl) {
                const previewImage = document.createElement("img");
                previewImage.src = product.imageUrl;
                previewImage.alt = "Current managed image for " + product.name;
                previewImage.style.objectFit = product.imageFit;
                previewImage.style.objectPosition = product.imagePosition;
                imagePreview.appendChild(previewImage);
            } else {
                imagePreview.textContent = "Uses existing page image";
            }

            const imageFile = document.createElement("input");
            imageFile.type = "file";
            imageFile.accept = "image/jpeg,image/png,image/webp";
            imageFile.className = "inventory-image-file";
            imageFile.setAttribute("aria-label", "Choose an image for " + product.name);
            const imageFit = createImageSelect(
                "inventory-image-fit",
                product.imageFit,
                imageFitOptions,
                product.name + " image display"
            );
            const imagePosition = createImageSelect(
                "inventory-image-position",
                product.imagePosition,
                imagePositionOptions,
                product.name + " image focal point"
            );
            const imageActions = document.createElement("div");
            imageActions.className = "inventory-image-actions";
            const uploadImageButton = document.createElement("button");
            uploadImageButton.type = "button";
            uploadImageButton.className = "button inventory-image-upload";
            uploadImageButton.dataset.inventoryImageAction = "upload";
            uploadImageButton.textContent = product.imageUrl ? "Replace" : "Upload";
            const removeImageButton = document.createElement("button");
            removeImageButton.type = "button";
            removeImageButton.className = "button secondary inventory-image-remove";
            removeImageButton.dataset.inventoryImageAction = "remove";
            removeImageButton.textContent = "Remove";
            removeImageButton.hidden = !product.imageUrl;
            imageActions.append(uploadImageButton, removeImageButton);
            imageEditor.append(imagePreview, imageFile, imageFit, imagePosition, imageActions);
            imageCell.appendChild(imageEditor);

            const descriptionCell = document.createElement("td");
            const descriptionInput = document.createElement("textarea");
            descriptionInput.value = product.description || "";
            descriptionInput.className = "inventory-description";
            descriptionInput.rows = 3;
            descriptionInput.maxLength = 500;
            descriptionInput.placeholder = "Describe the product, or begin with Ingredients:";
            descriptionInput.setAttribute("aria-label", product.name + " description");
            descriptionCell.appendChild(descriptionInput);

            const priceCell = document.createElement("td");
            const priceWrap = document.createElement("label");
            priceWrap.className = "inventory-price";
            priceWrap.append("$");
            const priceInput = createInventoryInput("number", (product.priceCents / 100).toFixed(2), "inventory-price-input");
            priceInput.min = "0";
            priceInput.max = "10000";
            priceInput.step = "0.01";
            priceInput.setAttribute("aria-label", product.name + " price");
            priceWrap.appendChild(priceInput);
            priceCell.appendChild(priceWrap);

            const quantityCell = document.createElement("td");
            const quantityInput = createInventoryInput(
                "number",
                product.quantity === null ? "" : product.quantity,
                "inventory-quantity"
            );
            quantityInput.min = "0";
            quantityInput.max = "1000000";
            quantityInput.step = "1";
            quantityInput.disabled = product.madeToOrder;
            quantityInput.setAttribute("aria-label", product.name + " quantity");
            quantityCell.appendChild(quantityInput);

            const orderLimitCell = document.createElement("td");
            const orderLimitInput = createInventoryInput(
                "number",
                product.orderLimit === null ? "" : product.orderLimit,
                "inventory-order-limit"
            );
            orderLimitInput.min = "1";
            orderLimitInput.max = "50";
            orderLimitInput.step = "1";
            orderLimitInput.placeholder = "No limit";
            orderLimitInput.setAttribute("aria-label", product.name + " maximum per order");
            orderLimitCell.appendChild(orderLimitInput);

            const unitCell = document.createElement("td");
            const unitInput = createInventoryInput("text", product.unit, "inventory-unit");
            unitInput.setAttribute("aria-label", product.name + " selling unit");
            unitCell.appendChild(unitInput);

            const madeCell = document.createElement("td");
            const madeInput = document.createElement("input");
            madeInput.type = "checkbox";
            madeInput.checked = product.madeToOrder;
            madeInput.className = "inventory-made-to-order";
            madeInput.setAttribute("aria-label", product.name + " is made to order");
            madeCell.appendChild(madeInput);

            const activeCell = document.createElement("td");
            const activeInput = document.createElement("input");
            activeInput.type = "checkbox";
            activeInput.checked = product.active;
            activeInput.className = "inventory-active";
            activeInput.setAttribute("aria-label", product.name + " is available to order");
            activeCell.appendChild(activeInput);

            row.append(
                nameCell,
                imageCell,
                descriptionCell,
                priceCell,
                quantityCell,
                orderLimitCell,
                unitCell,
                madeCell,
                activeCell
            );
            inventoryRows.appendChild(row);
        });

        filterInventoryRows();
    }

    async function loadInventory() {
        setMessage(inventoryMessage, "Loading inventory...", "success");
        const response = await fetch("/api/admin/inventory", {
            headers: { "Accept": "application/json" },
            cache: "no-store"
        });

        if (response.status === 401) {
            showLogin();
            return;
        }

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Inventory could not be loaded.");
        }

        renderInventory(result.products);
        setMessage(inventoryMessage, "", "");
    }

    function collectInventory() {
        return Array.from(inventoryRows.querySelectorAll("tr[data-product-id]")).map(function (row) {
            const price = Number.parseFloat(row.querySelector(".inventory-price-input").value);
            const quantityValue = row.querySelector(".inventory-quantity").value;
            const orderLimitValue = row.querySelector(".inventory-order-limit").value;

            return {
                id: row.dataset.productId,
                name: row.querySelector(".inventory-name").value,
                description: row.querySelector(".inventory-description").value,
                unit: row.querySelector(".inventory-unit").value,
                priceCents: Math.round(price * 100),
                quantity: quantityValue === "" ? null : Number(quantityValue),
                orderLimit: orderLimitValue === "" ? null : Number(orderLimitValue),
                madeToOrder: row.querySelector(".inventory-made-to-order").checked,
                active: row.querySelector(".inventory-active").checked,
                imageFit: row.querySelector(".inventory-image-fit").value,
                imagePosition: row.querySelector(".inventory-image-position").value
            };
        });
    }

    function updateInventoryImagePreview(row, imageUrl) {
        const preview = row.querySelector(".inventory-image-preview");
        const removeButton = row.querySelector(".inventory-image-remove");
        const uploadButton = row.querySelector(".inventory-image-upload");
        preview.replaceChildren();

        if (imageUrl) {
            const image = document.createElement("img");
            image.src = imageUrl;
            image.alt = "Current managed image for " + row.querySelector(".inventory-name").value;
            image.style.objectFit = row.querySelector(".inventory-image-fit").value;
            image.style.objectPosition = row.querySelector(".inventory-image-position").value;
            preview.appendChild(image);
            removeButton.hidden = false;
            uploadButton.textContent = "Replace";
        } else {
            preview.textContent = "Uses existing page image";
            removeButton.hidden = true;
            uploadButton.textContent = "Upload";
        }
    }

    async function uploadInventoryImage(row, button) {
        const fileInput = row.querySelector(".inventory-image-file");
        const file = fileInput.files[0];

        if (!file) {
            setMessage(inventoryMessage, "Choose an image file first.", "error");
            fileInput.focus();
            return;
        }

        button.disabled = true;
        setMessage(inventoryMessage, "Preparing and uploading the product image...", "success");

        try {
            const preparedImage = await prepareImageForUpload(file);
            const formData = new FormData();
            formData.append("image", preparedImage, preparedImage.name);
            formData.append("imageFit", row.querySelector(".inventory-image-fit").value);
            formData.append("imagePosition", row.querySelector(".inventory-image-position").value);
            const response = await fetch(
                "/api/admin/products/" + encodeURIComponent(row.dataset.productId) + "/image",
                { method: "POST", headers: { "Accept": "application/json" }, body: formData }
            );
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "The product image could not be uploaded.");
            }

            fileInput.value = "";
            updateInventoryImagePreview(row, result.imageUrl);
            carouselLoaded = false;
            setMessage(inventoryMessage, result.message, "success");
        } catch (error) {
            setMessage(inventoryMessage, error.message, "error");
        } finally {
            button.disabled = false;
        }
    }

    async function removeInventoryImage(row, button) {
        const productName = row.querySelector(".inventory-name").value;

        if (!window.confirm("Remove the managed image from " + productName + "? The original page image or placeholder will be used instead.")) {
            return;
        }

        button.disabled = true;
        setMessage(inventoryMessage, "Removing the product image...", "success");

        try {
            const response = await fetch(
                "/api/admin/products/" + encodeURIComponent(row.dataset.productId) + "/image",
                { method: "DELETE", headers: { "Accept": "application/json" } }
            );
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "The product image could not be removed.");
            }

            updateInventoryImagePreview(row, "");
            carouselLoaded = false;
            setMessage(inventoryMessage, result.message, "success");
        } catch (error) {
            setMessage(inventoryMessage, error.message, "error");
        } finally {
            button.disabled = false;
        }
    }

    function canBeMadeAvailable(row) {
        const price = Number.parseFloat(row.querySelector(".inventory-price-input").value);

        if (!Number.isFinite(price) || price <= 0) {
            return false;
        }

        if (!row.classList.contains("inventory-custom-product-row")) {
            return true;
        }

        const name = row.querySelector(".inventory-name").value.trim();
        return !name.startsWith("New Product Slot");
    }

    function setAllInventoryAvailability(available) {
        const rows = Array.from(inventoryRows.querySelectorAll("tr[data-product-id]"));
        let skipped = 0;

        rows.forEach(function (row) {
            const checkbox = row.querySelector(".inventory-active");

            if (available && !canBeMadeAvailable(row)) {
                checkbox.checked = false;
                skipped += 1;
                return;
            }

            checkbox.checked = available;
        });

        if (available) {
            const skippedMessage = skipped > 0
                ? " " + skipped + " unfinished or price-less product" +
                    (skipped === 1 ? " was" : "s were") + " left unavailable."
                : "";
            setMessage(
                inventoryMessage,
                "Selected all ready products." + skippedMessage + " Click Save Changes to apply.",
                "success"
            );
        } else {
            setMessage(
                inventoryMessage,
                "Deselected all products. Click Save Changes to apply.",
                "success"
            );
        }
    }

    function renderCarousel(carousel, productImages) {
        carouselItems.replaceChildren();
        carouselProductImage.replaceChildren();
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = productImages.length > 0
            ? "Choose a product image"
            : "Upload a product image in Inventory first";
        carouselProductImage.appendChild(placeholder);
        carouselProductImage.disabled = productImages.length === 0;

        productImages.forEach(function (product) {
            const option = document.createElement("option");
            option.value = product.id;
            option.textContent = product.name;
            carouselProductImage.appendChild(option);
        });

        if (carousel.length === 0) {
            const empty = createTextElement("p", "admin-empty", "No carousel images are available. Upload one above.");
            carouselItems.appendChild(empty);
            return;
        }

        carousel.forEach(function (slide, index) {
            const card = document.createElement("article");
            card.className = "admin-carousel-card";
            card.dataset.carouselId = slide.id;

            const order = createTextElement("span", "admin-carousel-order", "Slide " + (index + 1));
            const preview = document.createElement("img");
            preview.className = "admin-carousel-preview";
            preview.src = slide.imageUrl;
            preview.alt = slide.altText;
            preview.style.objectFit = slide.imageFit;
            preview.style.objectPosition = slide.imagePosition;

            const fields = document.createElement("div");
            fields.className = "admin-carousel-fields";
            const altGroup = document.createElement("div");
            altGroup.className = "form-group";
            const altLabel = document.createElement("label");
            altLabel.textContent = "Image description";
            const altInput = createInventoryInput("text", slide.altText, "carousel-alt-text");
            altInput.maxLength = 160;
            altInput.required = true;
            altInput.setAttribute("aria-label", "Description for slide " + (index + 1));
            altGroup.append(altLabel, altInput);

            const displayOptions = document.createElement("div");
            displayOptions.className = "image-display-options";
            const fitGroup = document.createElement("div");
            fitGroup.className = "form-group";
            const fitLabel = document.createElement("label");
            fitLabel.textContent = "Display";
            const fitSelect = createImageSelect(
                "carousel-image-fit",
                slide.imageFit,
                imageFitOptions,
                "Display for slide " + (index + 1)
            );
            fitGroup.append(fitLabel, fitSelect);
            const positionGroup = document.createElement("div");
            positionGroup.className = "form-group";
            const positionLabel = document.createElement("label");
            positionLabel.textContent = "Focal point";
            const positionSelect = createImageSelect(
                "carousel-image-position",
                slide.imagePosition,
                imagePositionOptions,
                "Focal point for slide " + (index + 1)
            );
            positionGroup.append(positionLabel, positionSelect);
            displayOptions.append(fitGroup, positionGroup);

            const visibleLabel = document.createElement("label");
            visibleLabel.className = "carousel-visible-control";
            const visibleInput = document.createElement("input");
            visibleInput.type = "checkbox";
            visibleInput.className = "carousel-active";
            visibleInput.checked = slide.active;
            visibleLabel.append(visibleInput, " Show on home page");
            fields.append(altGroup, displayOptions, visibleLabel);

            const actions = document.createElement("div");
            actions.className = "admin-carousel-actions";
            [
                { label: "Move Up", action: "up", disabled: index === 0 },
                { label: "Move Down", action: "down", disabled: index === carousel.length - 1 },
                { label: "Remove", action: "remove", danger: true, disabled: false }
            ].forEach(function (definition) {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "button " + (definition.danger ? "danger" : "secondary");
                button.dataset.carouselAction = definition.action;
                button.textContent = definition.label;
                button.disabled = definition.disabled;
                actions.appendChild(button);
            });

            card.append(order, preview, fields, actions);
            carouselItems.appendChild(card);
        });
    }

    async function loadCarousel() {
        setMessage(carouselMessage, "Loading home page images...", "success");
        const response = await fetch("/api/admin/carousel", {
            headers: { "Accept": "application/json" },
            cache: "no-store"
        });

        if (response.status === 401) {
            showLogin();
            return;
        }

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Home page images could not be loaded.");
        }

        renderCarousel(result.carousel, result.productImages);
        carouselLoaded = true;
        setMessage(carouselMessage, "", "");
    }

    function collectCarousel() {
        return Array.from(carouselItems.querySelectorAll("[data-carousel-id]")).map(function (card) {
            return {
                id: card.dataset.carouselId,
                altText: card.querySelector(".carousel-alt-text").value,
                imageFit: card.querySelector(".carousel-image-fit").value,
                imagePosition: card.querySelector(".carousel-image-position").value,
                active: card.querySelector(".carousel-active").checked
            };
        });
    }

    function refreshCarouselOrderControls() {
        const cards = Array.from(carouselItems.querySelectorAll("[data-carousel-id]"));
        cards.forEach(function (card, index) {
            card.querySelector(".admin-carousel-order").textContent = "Slide " + (index + 1);
            card.querySelector('[data-carousel-action="up"]').disabled = index === 0;
            card.querySelector('[data-carousel-action="down"]').disabled = index === cards.length - 1;
        });
    }

    async function removeCarouselImage(card, button) {
        if (!window.confirm("Remove this image from the home page carousel?")) {
            return;
        }

        button.disabled = true;
        setMessage(carouselMessage, "Removing carousel image...", "success");

        try {
            const response = await fetch(
                "/api/admin/carousel/" + encodeURIComponent(card.dataset.carouselId),
                { method: "DELETE", headers: { "Accept": "application/json" } }
            );
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "The carousel image could not be removed.");
            }

            await loadCarousel();
            setMessage(carouselMessage, result.message, "success");
        } catch (error) {
            button.disabled = false;
            setMessage(carouselMessage, error.message, "error");
        }
    }

    function appendSalesRow(container, values, emptyMessage) {
        const row = document.createElement("tr");

        if (emptyMessage) {
            const cell = document.createElement("td");
            cell.colSpan = values;
            cell.className = "sales-empty";
            cell.textContent = emptyMessage;
            row.appendChild(cell);
        } else {
            values.forEach(function (value) {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });
        }

        container.appendChild(row);
    }

    function renderSales(result) {
        const summary = result.summary;
        document.getElementById("salesAllTime").textContent = formatMoney(summary.allTimeCents);
        document.getElementById("salesMonth").textContent = formatMoney(summary.monthCents);
        document.getElementById("salesWeek").textContent = formatMoney(summary.weekCents);
        document.getElementById("salesToday").textContent = formatMoney(summary.todayCents);
        document.getElementById("salesPaidOrders").textContent = summary.paidOrders.toString();
        document.getElementById("salesPending").textContent = formatMoney(summary.pendingCents);
        document.getElementById("salesPendingOrders").textContent =
            summary.pendingOrders + (summary.pendingOrders === 1 ? " order" : " orders");
        document.getElementById("salesDonations").textContent = formatMoney(summary.donationsCents);
        document.getElementById("salesDonationCount").textContent =
            summary.donationCount + (summary.donationCount === 1 ? " donation" : " donations");
        document.getElementById("salesPendingDonations").textContent =
            formatMoney(summary.pendingDonationCents);
        document.getElementById("salesPendingDonationCount").textContent =
            summary.pendingDonationCount +
            (summary.pendingDonationCount === 1 ? " request" : " requests");

        salesProductRows.replaceChildren();

        if (result.products.length === 0) {
            appendSalesRow(salesProductRows, 3, "No paid product sales yet.");
        } else {
            result.products.forEach(function (product) {
                appendSalesRow(salesProductRows, [
                    product.name,
                    product.quantitySold.toString(),
                    formatMoney(product.revenueCents)
                ]);
            });
        }

        recentPaymentRows.replaceChildren();

        if (result.recentPayments.length === 0) {
            appendSalesRow(recentPaymentRows, 4, "No payments have been confirmed yet.");
        } else {
            result.recentPayments.forEach(function (payment) {
                const paidAt = new Date(payment.paidAt.replace(" ", "T") + "Z");
                appendSalesRow(recentPaymentRows, [
                    payment.orderNumber,
                    payment.customerName,
                    paidAt.toLocaleString(),
                    formatMoney(payment.totalCents)
                ]);
            });
        }

        donationRows.replaceChildren();

        if (result.donations.length === 0) {
            appendSalesRow(donationRows, 8, "No donation requests or payments have been recorded yet.");
        } else {
            result.donations.forEach(function (donation) {
                const row = document.createElement("tr");
                const displayDate = donation.status === "pending"
                    ? new Date(donation.createdAt.replace(" ", "T") + "Z").toLocaleDateString()
                    : new Date(donation.receivedAt + "T12:00:00").toLocaleDateString();
                const contact = [donation.phone, donation.email].filter(Boolean).join(" / ") || "—";
                [
                    donation.referenceNumber || "Manual entry",
                    donation.donorName,
                    displayDate,
                    contact,
                    donation.note || "—",
                    formatMoney(donation.amountCents),
                    donation.status === "pending" ? "Pending" : "Received"
                ].forEach(function (value) {
                    const cell = document.createElement("td");
                    cell.textContent = value;
                    row.appendChild(cell);
                });

                const actionCell = document.createElement("td");
                if (donation.status === "pending") {
                    const confirmButton = document.createElement("button");
                    confirmButton.type = "button";
                    confirmButton.className = "donation-confirm";
                    confirmButton.textContent = "Confirm Received";
                    confirmButton.dataset.donationAction = "confirm";
                    confirmButton.dataset.donationId = donation.id;
                    confirmButton.setAttribute(
                        "aria-label",
                        "Confirm donation received from " + donation.donorName
                    );
                    actionCell.appendChild(confirmButton);
                }

                const deleteButton = document.createElement("button");
                deleteButton.type = "button";
                deleteButton.className = "donation-delete";
                deleteButton.textContent = "Delete";
                deleteButton.dataset.donationId = donation.id;
                deleteButton.setAttribute("aria-label", "Delete donation from " + donation.donorName);
                actionCell.appendChild(deleteButton);
                row.appendChild(actionCell);
                donationRows.appendChild(row);
            });
        }

        filterSales();
    }

    async function loadSales() {
        setMessage(salesMessage, "Loading sales...", "success");
        const response = await fetch("/api/admin/sales", {
            headers: { "Accept": "application/json" },
            cache: "no-store"
        });

        if (response.status === 401) {
            showLogin();
            return;
        }

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Sales could not be loaded.");
        }

        renderSales(result);
        setMessage(salesMessage, "", "");
    }

    async function exportSalesWorkbook() {
        exportSalesButton.disabled = true;
        setMessage(salesMessage, "Preparing Excel workbook...", "success");

        try {
            const response = await fetch("/api/admin/sales/export", {
                headers: {
                    "Accept": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                },
                cache: "no-store"
            });

            if (response.status === 401) {
                showLogin();
                return;
            }

            if (!response.ok) {
                const result = await response.json().catch(function () {
                    return {};
                });
                throw new Error(result.error || "The Excel workbook could not be created.");
            }

            const workbook = await response.blob();
            const disposition = response.headers.get("Content-Disposition") || "";
            const filenameMatch = disposition.match(/filename="([^"]+)"/);
            const filename = filenameMatch
                ? filenameMatch[1]
                : "Soda-Backyard-Garden-Finances.xlsx";
            const downloadUrl = URL.createObjectURL(workbook);
            const downloadLink = document.createElement("a");

            downloadLink.href = downloadUrl;
            downloadLink.download = filename;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            downloadLink.remove();
            window.setTimeout(function () {
                URL.revokeObjectURL(downloadUrl);
            }, 0);
            setMessage(
                salesMessage,
                "Excel workbook downloaded. Enter garden costs on its Expenses sheet.",
                "success"
            );
        } catch (error) {
            setMessage(salesMessage, error.message, "error");
        } finally {
            exportSalesButton.disabled = false;
        }
    }

    function renderBlockedCustomers(customers) {
        blockedCustomersList.replaceChildren();
        blockedCustomerCount.textContent = "(" + customers.length + ")";

        if (customers.length === 0) {
            blockedCustomersList.appendChild(createTextElement(
                "p",
                "admin-empty-inline",
                "No customers are currently blocked."
            ));
            return;
        }

        customers.forEach(function (customer) {
            const card = document.createElement("article");
            card.className = "blocked-customer-card";
            const details = document.createElement("div");
            details.appendChild(createTextElement("strong", "", customer.customerName || "Unnamed customer"));

            if (customer.email) {
                details.appendChild(createTextElement("span", "", "Email: " + customer.email));
            }

            if (customer.phone) {
                details.appendChild(createTextElement("span", "", "Phone: " + customer.phone));
            }

            if (customer.household) {
                details.appendChild(createTextElement("span", "", "Address / Household: " + customer.household));
            }

            if (customer.reason) {
                details.appendChild(createTextElement("span", "", "Private note: " + customer.reason));
            }

            const blockedDate = new Date(customer.createdAt.replace(" ", "T") + "Z");
            details.appendChild(createTextElement("small", "", "Blocked: " + blockedDate.toLocaleString()));

            const unblockButton = document.createElement("button");
            unblockButton.type = "button";
            unblockButton.className = "button secondary admin-action";
            unblockButton.textContent = "Unblock";
            unblockButton.dataset.blockedCustomerId = customer.id;
            unblockButton.dataset.blockedCustomerName = customer.customerName || "this customer";
            card.append(details, unblockButton);
            blockedCustomersList.appendChild(card);
        });
    }

    function renderOrders(orders) {
        ordersList.replaceChildren();

        if (orders.length === 0) {
            ordersList.appendChild(createTextElement("p", "admin-empty", "No orders have been submitted yet."));
            filterOrders();
            return;
        }

        orders.forEach(function (order) {
            const card = document.createElement("article");
            card.className = "admin-order-card";
            card.dataset.orderSearch = [
                order.orderNumber,
                order.customerName,
                order.phone,
                order.email,
                order.household,
                order.deliveryDay,
                order.status,
                order.source,
                order.notes,
                order.items.map(function (item) { return item.name; }).join(" ")
            ].filter(Boolean).join(" ").toLocaleLowerCase();
            const heading = document.createElement("div");
            heading.className = "admin-order-heading";
            const headingCopy = document.createElement("div");
            headingCopy.appendChild(createTextElement("h3", "", order.customerName));
            headingCopy.appendChild(createTextElement("p", "admin-order-number", order.orderNumber));
            const status = createTextElement("span", "admin-status status-" + order.status, order.status);
            heading.append(headingCopy, status);
            card.appendChild(heading);

            const details = document.createElement("div");
            details.className = "admin-order-details";
            const submitted = new Date(order.createdAt.replace(" ", "T") + "Z");
            const sourceLabels = {
                online: "Website",
                phone: "Phone",
                "in-person": "In person",
                other: "Other offline order"
            };
            details.appendChild(createTextElement("p", "", "Submitted: " + submitted.toLocaleString()));
            details.appendChild(createTextElement(
                "p",
                "",
                "Source: " + (sourceLabels[order.source] || "Website")
            ));
            if (order.phone) {
                details.appendChild(createTextElement("p", "", "Phone: " + order.phone));
            }

            if (order.email) {
                details.appendChild(createTextElement("p", "", "Email: " + order.email));
            }

            if (order.household) {
                details.appendChild(createTextElement("p", "", "Address / Household: " + order.household));
            }

            if (order.customerBlocked) {
                details.appendChild(createTextElement("p", "admin-customer-blocked", "Future website orders blocked"));
            }

            details.appendChild(createTextElement("p", "", "Delivery: " + order.deliveryDay));
            card.appendChild(details);

            const itemList = document.createElement("ul");
            itemList.className = "admin-item-list";
            order.items.forEach(function (item) {
                itemList.appendChild(createTextElement(
                    "li",
                    "",
                    item.quantity + " × " + item.name + " — " + formatMoney(item.lineTotalCents)
                ));
            });
            card.appendChild(itemList);

            if (order.status === "pending" || order.status === "confirmed") {
                const adjustmentPanel = document.createElement("details");
                adjustmentPanel.className = "admin-item-adjustments";
                const adjustmentSummary = document.createElement("summary");
                adjustmentSummary.textContent = "Adjust Individual Items";
                adjustmentPanel.appendChild(adjustmentSummary);
                adjustmentPanel.appendChild(createTextElement(
                    "p",
                    "admin-adjustment-help",
                    "Enter the customer's new quantity, use 0 to remove an item, or add another product below. Inventory and the order total update automatically. Admin changes may override the public per-order limit."
                ));
                const adjustmentRows = document.createElement("div");
                adjustmentRows.className = "admin-adjustment-rows";

                order.items.forEach(function (item) {
                    const row = document.createElement("div");
                    row.className = "admin-adjustment-row";
                    const inputId = "order-item-" + order.id + "-" + item.id;
                    const label = document.createElement("label");
                    label.htmlFor = inputId;
                    const availabilityText = item.madeToOrder
                        ? "no fixed inventory"
                        : item.availableQuantity + " more available";
                    label.textContent = item.name + " — new quantity (" + availabilityText + ")";
                    const input = document.createElement("input");
                    input.type = "number";
                    input.id = inputId;
                    input.min = "0";
                    input.max = item.madeToOrder
                        ? "50"
                        : Math.min(50, item.quantity + item.availableQuantity).toString();
                    input.value = item.quantity.toString();
                    input.dataset.orderItemId = item.id;
                    input.dataset.originalQuantity = item.quantity.toString();
                    row.append(label, input);
                    adjustmentRows.appendChild(row);
                });

                const existingProductIds = new Set(order.items.map(function (item) {
                    return item.productId;
                }));
                const addableProducts = orderAdjustmentProducts.filter(function (product) {
                    return !existingProductIds.has(product.id) &&
                        (product.madeToOrder || product.quantity > 0);
                });

                if (addableProducts.length > 0) {
                    adjustmentRows.appendChild(createTextElement(
                        "h4",
                        "admin-adjustment-subheading",
                        "Add Products"
                    ));

                    addableProducts.forEach(function (product) {
                        const row = document.createElement("div");
                        row.className = "admin-adjustment-row";
                        const inputId = "add-product-" + order.id + "-" + product.id;
                        const label = document.createElement("label");
                        label.htmlFor = inputId;
                        const availabilityText = product.madeToOrder
                            ? "no fixed inventory"
                            : product.quantity + " available";
                        label.textContent = product.name + " — " +
                            formatMoney(product.priceCents) + " (" + availabilityText + ")";
                        const input = document.createElement("input");
                        input.type = "number";
                        input.id = inputId;
                        input.min = "0";
                        input.max = product.madeToOrder
                            ? "50"
                            : Math.min(50, product.quantity).toString();
                        input.value = "0";
                        input.dataset.addProductId = product.id;
                        input.dataset.productName = product.name;
                        row.append(label, input);
                        adjustmentRows.appendChild(row);
                    });
                }

                adjustmentPanel.appendChild(adjustmentRows);
                adjustmentPanel.appendChild(createActionButton(
                    "Save Item Changes",
                    "adjust-items",
                    order.id
                ));
                card.appendChild(adjustmentPanel);
            }

            card.appendChild(createTextElement("p", "admin-order-total", "Total: " + formatMoney(order.totalCents)));

            if (order.notes) {
                card.appendChild(createTextElement("p", "admin-order-notes", "Notes: " + order.notes));
            }

            const actions = document.createElement("div");
            actions.className = "admin-order-actions";

            if (order.email && order.status !== "cancelled" && order.status !== "refused") {
                actions.appendChild(createOrderReceiptEmailLink(order));
            }

            if (order.status === "pending") {
                actions.appendChild(createActionButton("Confirm Payment", "confirm", order.id));
                actions.appendChild(createActionButton("Refuse Order", "refuse", order.id, "danger"));
                actions.appendChild(createActionButton("Cancel & Return Stock", "cancel", order.id, "danger"));
            } else if (order.status === "confirmed") {
                actions.appendChild(createActionButton("Mark Delivered", "complete", order.id));
                actions.appendChild(createActionButton("Refuse Order", "refuse", order.id, "danger"));
                actions.appendChild(createActionButton("Cancel & Return Stock", "cancel", order.id, "danger"));
            } else if (order.status === "refused") {
                if (order.email) {
                    actions.appendChild(createRefusalEmailLink(order));
                }
            } else if (order.status === "cancelled") {
                if (order.email) {
                    actions.appendChild(createCancellationEmailLink(order));
                }
                actions.appendChild(createActionButton("Delete Cancelled Order", "delete", order.id, "danger"));
            }

            if (actions.children.length > 0) {
                card.appendChild(actions);
            }

            ordersList.appendChild(card);
        });

        filterOrders();
    }

    async function loadOrders() {
        setMessage(adminMessage, "Loading orders...", "success");
        const response = await fetch("/api/admin/orders", {
            headers: { "Accept": "application/json" },
            cache: "no-store"
        });

        if (response.status === 401) {
            showLogin();
            return;
        }

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Orders could not be loaded.");
        }

        showDashboard();
        setMessage(adminMessage, "", "");
        orderAdjustmentProducts = Array.isArray(result.adjustmentProducts)
            ? result.adjustmentProducts
            : [];
        renderBlockedCustomers(Array.isArray(result.blockedCustomers)
            ? result.blockedCustomers
            : []);
        renderOrders(result.orders);

        if (!offlineProductsLoaded) {
            try {
                await loadOfflineOrderProducts();
            } catch (error) {
                setMessage(offlineOrderMessage, error.message, "error");
            }
        }
    }

    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const submitButton = loginForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        setMessage(loginMessage, "Signing in...", "success");

        try {
            const response = await fetch("/api/admin/login", {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ password: loginForm.password.value })
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Sign in failed.");
            }

            loginForm.reset();
            offlineProductsLoaded = false;
            await loadOrders();
        } catch (error) {
            setMessage(loginMessage, error.message, "error");
        } finally {
            submitButton.disabled = false;
        }
    });

    offlineOrderProducts.addEventListener("input", function (event) {
        if (event.target.matches("input[data-product-id]")) {
            const maximum = Number.parseInt(event.target.max, 10);
            const quantity = Math.max(0, Number.parseInt(event.target.value, 10) || 0);

            if (!Number.isNaN(maximum) && quantity > maximum) {
                event.target.value = maximum;
            }

            updateOfflineOrderTotal();
        }
    });

    offlineOrderForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const submitButton = offlineOrderForm.querySelector('button[type="submit"]');
        const items = {};

        offlineQuantityInputs.forEach(function (input) {
            const quantity = Math.max(0, Number.parseInt(input.value, 10) || 0);

            if (quantity > 0) {
                items[input.dataset.productId] = quantity;
            }
        });

        if (Object.keys(items).length === 0) {
            setMessage(offlineOrderMessage, "Select at least one product.", "error");
            return;
        }

        submitButton.disabled = true;
        setMessage(offlineOrderMessage, "Creating order...", "success");

        try {
            const response = await fetch("/api/admin/orders", {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    customerName: offlineOrderForm.customerName.value,
                    source: offlineOrderForm.source.value,
                    phone: offlineOrderForm.phone.value,
                    email: offlineOrderForm.email.value,
                    household: offlineOrderForm.household.value,
                    deliveryDay: offlineOrderForm.deliveryDay.value,
                    paymentReceived: offlineOrderForm.paymentReceived.checked,
                    notes: offlineOrderForm.notes.value,
                    items
                })
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "The offline order could not be created.");
            }

            offlineOrderForm.reset();
            offlineProductsLoaded = false;
            await loadOrders();
            setMessage(
                offlineOrderMessage,
                "Order " + result.orderNumber + " created as " +
                    (result.status === "confirmed" ? "paid" : "pending payment") +
                    ". Total: " + result.total,
                "success"
            );
        } catch (error) {
            setMessage(offlineOrderMessage, error.message, "error");
        } finally {
            submitButton.disabled = false;
        }
    });

    ordersList.addEventListener("click", async function (event) {
        const button = event.target.closest("button[data-action]");

        if (!button) {
            return;
        }

        if (button.dataset.action === "cancel" && !window.confirm("Cancel this order and return its produce to availability?")) {
            return;
        }

        if (button.dataset.action === "refuse" && !window.confirm("Refuse this order, return its items to availability, and email the customer that the order was not accepted?")) {
            return;
        }

        if (button.dataset.action === "delete" && !window.confirm("Permanently delete this cancelled order? This cannot be undone.")) {
            return;
        }

        let adjustedItems = null;
        let addedProducts = null;

        if (button.dataset.action === "adjust-items") {
            const card = button.closest(".admin-order-card");
            const inputs = Array.from(card.querySelectorAll("input[data-order-item-id]"));
            const additionInputs = Array.from(card.querySelectorAll("input[data-add-product-id]"));
            adjustedItems = inputs.map(function (input) {
                return {
                    id: input.dataset.orderItemId,
                    quantity: Number.parseInt(input.value, 10),
                    originalQuantity: Number.parseInt(input.dataset.originalQuantity, 10)
                };
            });
            const invalidItem = adjustedItems.find(function (item) {
                return !Number.isInteger(item.quantity) ||
                    item.quantity < 0 ||
                    item.quantity > 50;
            });

            if (invalidItem) {
                setMessage(adminMessage, "Enter a quantity between 0 and 50.", "error");
                return;
            }

            const changes = adjustedItems.filter(function (item) {
                return item.quantity !== item.originalQuantity;
            });
            addedProducts = additionInputs.map(function (input) {
                return {
                    productId: input.dataset.addProductId,
                    productName: input.dataset.productName,
                    quantity: Number.parseInt(input.value, 10),
                    maximum: Number.parseInt(input.max, 10)
                };
            }).filter(function (item) {
                return item.quantity > 0;
            });
            const invalidAddition = additionInputs.find(function (input) {
                const quantity = Number.parseInt(input.value, 10);
                const maximum = Number.parseInt(input.max, 10);
                return !Number.isInteger(quantity) || quantity < 0 || quantity > maximum;
            });

            if (invalidAddition) {
                setMessage(
                    adminMessage,
                    "Enter a valid quantity within the available amount for products being added.",
                    "error"
                );
                return;
            }

            if (changes.length === 0 && addedProducts.length === 0) {
                setMessage(
                    adminMessage,
                    "Change at least one item quantity or add a product before saving.",
                    "error"
                );
                return;
            }

            if (!window.confirm("Save these order changes? Added products and increases will deduct available inventory, reductions will return inventory, and the order total will be updated.")) {
                return;
            }
        }

        button.disabled = true;
        setMessage(adminMessage, "Updating order...", "success");

        try {
            const isDelete = button.dataset.action === "delete";
            const isItemAdjustment = button.dataset.action === "adjust-items";
            const response = await fetch(
                "/api/admin/orders/" + encodeURIComponent(button.dataset.orderId) +
                    (isDelete ? "" : (isItemAdjustment ? "/items" : "/action")),
                isDelete
                    ? {
                        method: "DELETE",
                        headers: { "Accept": "application/json" }
                    }
                    : {
                        method: "POST",
                        headers: {
                            "Accept": "application/json",
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(isItemAdjustment
                            ? {
                                items: adjustedItems.map(function (item) {
                                    return { id: item.id, quantity: item.quantity };
                                }),
                                additions: addedProducts.map(function (item) {
                                    return { productId: item.productId, quantity: item.quantity };
                                })
                            }
                            : { action: button.dataset.action })
                    }
            );
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "The order could not be updated.");
            }

            offlineProductsLoaded = false;
            await loadOrders();

            if (result.message) {
                setMessage(adminMessage, result.message, result.emailSent === false ? "error" : "success");
            }
        } catch (error) {
            setMessage(adminMessage, error.message, "error");
            button.disabled = false;
        }
    });

    blockedCustomersList.addEventListener("click", async function (event) {
        const button = event.target.closest("button[data-blocked-customer-id]");

        if (!button) {
            return;
        }

        if (!window.confirm("Unblock " + button.dataset.blockedCustomerName + " and allow future website orders?")) {
            return;
        }

        button.disabled = true;
        setMessage(adminMessage, "Unblocking customer...", "success");

        try {
            const response = await fetch(
                "/api/admin/blocked-customers/" + encodeURIComponent(button.dataset.blockedCustomerId),
                {
                    method: "DELETE",
                    headers: { "Accept": "application/json" }
                }
            );
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "The customer could not be unblocked.");
            }

            await loadOrders();
            setMessage(adminMessage, result.message, "success");
        } catch (error) {
            setMessage(adminMessage, error.message, "error");
            button.disabled = false;
        }
    });

    blockedCustomerForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const submitButton = blockedCustomerForm.querySelector('button[type="submit"]');
        const formData = new FormData(blockedCustomerForm);
        const customer = {
            customerName: String(formData.get("customerName") || "").trim(),
            email: String(formData.get("email") || "").trim(),
            phone: String(formData.get("phone") || "").trim(),
            household: String(formData.get("household") || "").trim(),
            reason: String(formData.get("reason") || "").trim()
        };

        if (!customer.customerName && !customer.email && !customer.phone && !customer.household) {
            setMessage(blockedCustomerMessage, "Enter at least a customer name, email address, phone number, or address/household.", "error");
            return;
        }

        if (!window.confirm("Block website orders matching the information entered?")) {
            return;
        }

        submitButton.disabled = true;
        setMessage(blockedCustomerMessage, "Adding customer to the blocked list...", "success");

        try {
            const response = await fetch("/api/admin/blocked-customers", {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(customer)
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "The customer could not be blocked.");
            }

            blockedCustomerForm.reset();
            await loadOrders();
            setMessage(blockedCustomerMessage, result.message, "success");
        } catch (error) {
            setMessage(blockedCustomerMessage, error.message, "error");
        } finally {
            submitButton.disabled = false;
        }
    });

    refreshButton.addEventListener("click", function () {
        offlineProductsLoaded = false;
        loadOrders().catch(function (error) {
            setMessage(adminMessage, error.message, "error");
        });
    });

    deleteCancelledOrdersButton.addEventListener("click", async function () {
        if (!window.confirm("Permanently delete every cancelled order? Pending, confirmed, and delivered orders will not be affected.")) {
            return;
        }

        deleteCancelledOrdersButton.disabled = true;
        setMessage(adminMessage, "Deleting cancelled orders...", "success");

        try {
            const response = await fetch("/api/admin/orders/cancelled", {
                method: "DELETE",
                headers: { "Accept": "application/json" }
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "The cancelled orders could not be deleted.");
            }

            await loadOrders();
            setMessage(
                adminMessage,
                result.deletedCount === 1
                    ? "1 cancelled order deleted."
                    : result.deletedCount + " cancelled orders deleted.",
                "success"
            );
        } catch (error) {
            setMessage(adminMessage, error.message, "error");
        } finally {
            deleteCancelledOrdersButton.disabled = false;
        }
    });

    ordersTab.addEventListener("click", function () {
        switchPanel("orders");
    });

    inventoryTab.addEventListener("click", function () {
        switchPanel("inventory");
    });

    homeTab.addEventListener("click", function () {
        switchPanel("home");
    });

    salesTab.addEventListener("click", function () {
        switchPanel("sales");
    });

    blockedTab.addEventListener("click", function () {
        switchPanel("blocked");
    });

    exportSalesButton.addEventListener("click", exportSalesWorkbook);

    inventoryRows.addEventListener("change", function (event) {
        if (
            event.target.classList.contains("inventory-image-fit") ||
            event.target.classList.contains("inventory-image-position")
        ) {
            const row = event.target.closest("tr");
            const image = row.querySelector(".inventory-image-preview img");

            if (image) {
                image.style.objectFit = row.querySelector(".inventory-image-fit").value;
                image.style.objectPosition = row.querySelector(".inventory-image-position").value;
            }
            return;
        }

        if (!event.target.classList.contains("inventory-made-to-order")) {
            return;
        }

        const quantityInput = event.target.closest("tr").querySelector(".inventory-quantity");
        quantityInput.disabled = event.target.checked;

        if (!event.target.checked && quantityInput.value === "") {
            quantityInput.value = "0";
        }
    });

    refreshInventoryButton.addEventListener("click", function () {
        loadInventory().catch(function (error) {
            setMessage(inventoryMessage, error.message, "error");
        });
    });

    inventoryRows.addEventListener("click", function (event) {
        const button = event.target.closest("[data-inventory-image-action]");

        if (!button) {
            return;
        }

        const row = button.closest("tr[data-product-id]");

        if (button.dataset.inventoryImageAction === "upload") {
            uploadInventoryImage(row, button);
        } else if (button.dataset.inventoryImageAction === "remove") {
            removeInventoryImage(row, button);
        }
    });

    selectAllInventoryButton.addEventListener("click", function () {
        setAllInventoryAvailability(true);
    });

    deselectAllInventoryButton.addEventListener("click", function () {
        setAllInventoryAvailability(false);
    });

    refreshSalesButton.addEventListener("click", function () {
        loadSales().catch(function (error) {
            setMessage(salesMessage, error.message, "error");
        });
    });

    refreshCarouselButton.addEventListener("click", function () {
        loadCarousel().catch(function (error) {
            setMessage(carouselMessage, error.message, "error");
        });
    });

    saveCarouselButton.addEventListener("click", async function () {
        saveCarouselButton.disabled = true;
        setMessage(carouselMessage, "Saving home page carousel...", "success");

        try {
            const response = await fetch("/api/admin/carousel", {
                method: "PUT",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ carousel: collectCarousel() })
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "The home page carousel could not be saved.");
            }

            await loadCarousel();
            setMessage(carouselMessage, result.message, "success");
        } catch (error) {
            setMessage(carouselMessage, error.message, "error");
        } finally {
            saveCarouselButton.disabled = false;
        }
    });

    carouselItems.addEventListener("change", function (event) {
        if (
            !event.target.classList.contains("carousel-image-fit") &&
            !event.target.classList.contains("carousel-image-position")
        ) {
            return;
        }

        const card = event.target.closest("[data-carousel-id]");
        const preview = card.querySelector(".admin-carousel-preview");
        preview.style.objectFit = card.querySelector(".carousel-image-fit").value;
        preview.style.objectPosition = card.querySelector(".carousel-image-position").value;
    });

    carouselItems.addEventListener("click", function (event) {
        const button = event.target.closest("[data-carousel-action]");

        if (!button) {
            return;
        }

        const card = button.closest("[data-carousel-id]");
        const action = button.dataset.carouselAction;

        if (action === "remove") {
            removeCarouselImage(card, button);
            return;
        }

        if (action === "up" && card.previousElementSibling) {
            carouselItems.insertBefore(card, card.previousElementSibling);
        } else if (action === "down" && card.nextElementSibling) {
            carouselItems.insertBefore(card.nextElementSibling, card);
        }

        refreshCarouselOrderControls();
        setMessage(carouselMessage, "Order changed. Click Save Carousel to publish it.", "success");
    });

    carouselUploadForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const submitButton = carouselUploadForm.querySelector('button[type="submit"]');
        const file = carouselUploadForm.image.files[0];
        submitButton.disabled = true;
        setMessage(carouselMessage, "Preparing and uploading the carousel image...", "success");

        try {
            const preparedImage = await prepareImageForUpload(file);
            const formData = new FormData(carouselUploadForm);
            formData.set("image", preparedImage, preparedImage.name);
            const response = await fetch("/api/admin/carousel/images", {
                method: "POST",
                headers: { "Accept": "application/json" },
                body: formData
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "The carousel image could not be uploaded.");
            }

            carouselUploadForm.reset();
            await loadCarousel();
            setMessage(carouselMessage, result.message, "success");
        } catch (error) {
            setMessage(carouselMessage, error.message, "error");
        } finally {
            submitButton.disabled = false;
        }
    });

    carouselProductForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const submitButton = carouselProductForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        setMessage(carouselMessage, "Adding product image to the carousel...", "success");

        try {
            const response = await fetch("/api/admin/carousel/product-image", {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ productId: carouselProductImage.value })
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "The product image could not be added.");
            }

            carouselProductForm.reset();
            await loadCarousel();
            setMessage(carouselMessage, result.message, "success");
        } catch (error) {
            setMessage(carouselMessage, error.message, "error");
        } finally {
            submitButton.disabled = false;
        }
    });

    donationForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const submitButton = donationForm.querySelector('button[type="submit"]');
        const amount = Number.parseFloat(donationForm.amount.value);
        submitButton.disabled = true;
        setMessage(donationMessage, "Recording donation...", "success");

        try {
            const response = await fetch("/api/admin/donations", {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    donorName: donationForm.donorName.value,
                    amountCents: Math.round(amount * 100),
                    receivedAt: donationForm.receivedAt.value,
                    note: donationForm.note.value
                })
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "The donation could not be recorded.");
            }

            resetDonationForm();
            await loadSales();
            setMessage(donationMessage, "Donation recorded.", "success");
        } catch (error) {
            setMessage(donationMessage, error.message, "error");
        } finally {
            submitButton.disabled = false;
        }
    });

    donationRows.addEventListener("click", async function (event) {
        const actionButton = event.target.closest("button[data-donation-action]");

        if (actionButton) {
            if (!window.confirm("Confirm that this donation payment has been received?")) {
                return;
            }

            actionButton.disabled = true;
            setMessage(donationMessage, "Confirming donation...", "success");

            try {
                const response = await fetch(
                    "/api/admin/donations/" +
                        encodeURIComponent(actionButton.dataset.donationId) +
                        "/action",
                    {
                        method: "POST",
                        headers: {
                            "Accept": "application/json",
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({ action: actionButton.dataset.donationAction })
                    }
                );
                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || "The donation could not be confirmed.");
                }

                await loadSales();
                setMessage(donationMessage, "Donation confirmed as received.", "success");
            } catch (error) {
                actionButton.disabled = false;
                setMessage(donationMessage, error.message, "error");
            }
            return;
        }

        const button = event.target.closest("button[data-donation-id]");

        if (!button || !window.confirm("Delete this donation entry?")) {
            return;
        }

        button.disabled = true;
        setMessage(donationMessage, "Deleting donation...", "success");

        try {
            const response = await fetch(
                "/api/admin/donations/" + encodeURIComponent(button.dataset.donationId),
                { method: "DELETE", headers: { "Accept": "application/json" } }
            );
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "The donation could not be deleted.");
            }

            await loadSales();
            setMessage(donationMessage, "Donation deleted.", "success");
        } catch (error) {
            button.disabled = false;
            setMessage(donationMessage, error.message, "error");
        }
    });

    orderSearch.addEventListener("input", filterOrders);
    inventorySearch.addEventListener("input", filterInventoryRows);
    salesSearch.addEventListener("input", filterSales);

    document.querySelectorAll("[data-clear-search]").forEach(function (button) {
        button.addEventListener("click", function () {
            const input = document.getElementById(button.dataset.clearSearch);
            input.value = "";
            input.dispatchEvent(new Event("input"));
            input.focus();
        });
    });

    inventoryRows.addEventListener("click", function (event) {
        const toggle = event.target.closest("[data-inventory-section-toggle]");

        if (!toggle) {
            return;
        }

        const sectionKey = toggle.dataset.inventorySectionToggle;

        if (collapsedInventorySections.has(sectionKey)) {
            collapsedInventorySections.delete(sectionKey);
        } else {
            collapsedInventorySections.add(sectionKey);
        }

        filterInventoryRows();
    });

    saveInventoryButton.addEventListener("click", async function () {
        saveInventoryButton.disabled = true;
        setMessage(inventoryMessage, "Saving changes...", "success");

        try {
            const response = await fetch("/api/admin/inventory", {
                method: "PUT",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ products: collectInventory() })
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Inventory could not be saved.");
            }

            await Promise.all([loadInventory(), loadOfflineOrderProducts()]);
            setMessage(inventoryMessage, "Inventory saved. The website is now using these updates.", "success");
        } catch (error) {
            setMessage(inventoryMessage, error.message, "error");
        } finally {
            saveInventoryButton.disabled = false;
        }
    });

    logoutButton.addEventListener("click", async function () {
        await fetch("/api/admin/logout", { method: "POST" });
        showLogin();
    });

    resetDonationForm();

    loadOrders().catch(function (error) {
        showLogin(error.message);
    });
});
