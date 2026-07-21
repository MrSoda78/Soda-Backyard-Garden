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
    const salesTab = document.getElementById("salesTab");
    const ordersPanel = document.getElementById("ordersPanel");
    const inventoryPanel = document.getElementById("inventoryPanel");
    const salesPanel = document.getElementById("salesPanel");
    const inventoryRows = document.getElementById("inventoryRows");
    const inventoryMessage = document.getElementById("inventoryMessage");
    const refreshInventoryButton = document.getElementById("refreshInventory");
    const saveInventoryButton = document.getElementById("saveInventory");
    const selectAllInventoryButton = document.getElementById("selectAllInventory");
    const deselectAllInventoryButton = document.getElementById("deselectAllInventory");
    const salesMessage = document.getElementById("salesMessage");
    const refreshSalesButton = document.getElementById("refreshSales");
    const salesProductRows = document.getElementById("salesProductRows");
    const recentPaymentRows = document.getElementById("recentPaymentRows");
    const donationForm = document.getElementById("donationForm");
    const donationMessage = document.getElementById("donationMessage");
    const donationRows = document.getElementById("donationRows");
    let offlineQuantityInputs = [];
    let offlineProductsLoaded = false;

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
            sales: { tab: salesTab, panel: salesPanel }
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

    function renderInventory(products) {
        inventoryRows.replaceChildren();
        const categoryLabels = {
            produce: "Fresh Produce — New Product Slots",
            tea: "Tea Mixes — New Product Slots",
            baked: "Baked Goods — New Product Slots",
            "pain-rub": "Pain Rub — New Product Slots"
        };
        let lastSlotCategory = "";
        let currentProductsHeadingAdded = false;

        products.forEach(function (product) {
            if (!product.isSlot && !currentProductsHeadingAdded) {
                const currentRow = document.createElement("tr");
                const currentCell = document.createElement("th");
                currentCell.colSpan = 8;
                currentCell.scope = "rowgroup";
                currentCell.className = "inventory-section-heading inventory-current-heading";
                currentCell.textContent = "Current Products";
                currentRow.appendChild(currentCell);
                inventoryRows.appendChild(currentRow);
                currentProductsHeadingAdded = true;
            }

            if (product.isSlot && product.category !== lastSlotCategory) {
                const sectionRow = document.createElement("tr");
                const sectionCell = document.createElement("th");
                sectionCell.colSpan = 8;
                sectionCell.scope = "rowgroup";
                sectionCell.className = "inventory-section-heading";
                sectionCell.textContent = categoryLabels[product.category] || "New Product Slots";
                sectionRow.appendChild(sectionCell);
                inventoryRows.appendChild(sectionRow);
                lastSlotCategory = product.category;
            }

            const row = document.createElement("tr");
            row.dataset.productId = product.id;
            row.classList.toggle("inventory-slot-row", product.isSlot);

            const nameCell = document.createElement("td");
            const nameInput = createInventoryInput("text", product.name, "inventory-name");
            nameInput.setAttribute("aria-label", "Product name");
            nameCell.appendChild(nameInput);

            const descriptionCell = document.createElement("td");
            const descriptionInput = document.createElement("textarea");
            descriptionInput.value = product.description || "";
            descriptionInput.className = "inventory-description";
            descriptionInput.rows = 3;
            descriptionInput.maxLength = 500;
            descriptionInput.disabled = !product.isSlot;
            descriptionInput.placeholder = product.isSlot
                ? "Describe the product for customers"
                : "Existing card description is managed on its page";
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
                active: row.querySelector(".inventory-active").checked
            };
        });
    }

    function canBeMadeAvailable(row) {
        const price = Number.parseFloat(row.querySelector(".inventory-price-input").value);

        if (!Number.isFinite(price) || price <= 0) {
            return false;
        }

        if (!row.classList.contains("inventory-slot-row")) {
            return true;
        }

        const name = row.querySelector(".inventory-name").value.trim();
        const description = row.querySelector(".inventory-description").value.trim();
        return !name.startsWith("New Product Slot") && description.length >= 3;
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

    function renderOrders(orders) {
        ordersList.replaceChildren();

        if (orders.length === 0) {
            ordersList.appendChild(createTextElement("p", "admin-empty", "No orders have been submitted yet."));
            return;
        }

        orders.forEach(function (order) {
            const card = document.createElement("article");
            card.className = "admin-order-card";
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
                    "Enter the quantity the customer is keeping. Use 0 to remove an item completely. Quantities can only be reduced."
                ));
                const adjustmentRows = document.createElement("div");
                adjustmentRows.className = "admin-adjustment-rows";

                order.items.forEach(function (item) {
                    const row = document.createElement("div");
                    row.className = "admin-adjustment-row";
                    const inputId = "order-item-" + order.id + "-" + item.id;
                    const label = document.createElement("label");
                    label.htmlFor = inputId;
                    label.textContent = item.name + " — quantity to keep";
                    const input = document.createElement("input");
                    input.type = "number";
                    input.id = inputId;
                    input.min = "0";
                    input.max = item.quantity.toString();
                    input.value = item.quantity.toString();
                    input.dataset.orderItemId = item.id;
                    input.dataset.originalQuantity = item.quantity.toString();
                    row.append(label, input);
                    adjustmentRows.appendChild(row);
                });

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

            if (order.status === "pending") {
                actions.appendChild(createActionButton("Confirm Payment", "confirm", order.id));
                actions.appendChild(createActionButton("Cancel & Return Stock", "cancel", order.id, "danger"));
            } else if (order.status === "confirmed") {
                actions.appendChild(createActionButton("Mark Delivered", "complete", order.id));
                actions.appendChild(createActionButton("Cancel & Return Stock", "cancel", order.id, "danger"));
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

        if (button.dataset.action === "delete" && !window.confirm("Permanently delete this cancelled order? This cannot be undone.")) {
            return;
        }

        let adjustedItems = null;

        if (button.dataset.action === "adjust-items") {
            const card = button.closest(".admin-order-card");
            const inputs = Array.from(card.querySelectorAll("input[data-order-item-id]"));
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
                    item.quantity > item.originalQuantity;
            });

            if (invalidItem) {
                setMessage(adminMessage, "Enter a quantity between 0 and the current amount.", "error");
                return;
            }

            const reductions = adjustedItems.filter(function (item) {
                return item.quantity < item.originalQuantity;
            });

            if (reductions.length === 0) {
                setMessage(adminMessage, "Reduce at least one item quantity before saving.", "error");
                return;
            }

            if (!window.confirm("Save these item reductions? Removed quantities will return to availability and the order total will be updated.")) {
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
        } catch (error) {
            setMessage(adminMessage, error.message, "error");
            button.disabled = false;
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

    salesTab.addEventListener("click", function () {
        switchPanel("sales");
    });

    inventoryRows.addEventListener("change", function (event) {
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
