document.addEventListener("DOMContentLoaded", function () {
    const loginPanel = document.getElementById("adminLoginPanel");
    const loginForm = document.getElementById("adminLoginForm");
    const loginMessage = document.getElementById("adminLoginMessage");
    const dashboard = document.getElementById("adminDashboard");
    const ordersList = document.getElementById("ordersList");
    const adminMessage = document.getElementById("adminMessage");
    const refreshButton = document.getElementById("refreshOrders");
    const logoutButton = document.getElementById("adminLogout");
    const ordersTab = document.getElementById("ordersTab");
    const inventoryTab = document.getElementById("inventoryTab");
    const ordersPanel = document.getElementById("ordersPanel");
    const inventoryPanel = document.getElementById("inventoryPanel");
    const inventoryRows = document.getElementById("inventoryRows");
    const inventoryMessage = document.getElementById("inventoryMessage");
    const refreshInventoryButton = document.getElementById("refreshInventory");
    const saveInventoryButton = document.getElementById("saveInventory");

    function formatMoney(cents) {
        return "$" + (cents / 100).toFixed(2);
    }

    function setMessage(element, message, type) {
        element.textContent = message || "";
        element.className = "form-message" + (type ? " " + type : "");
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

    function switchPanel(panelName) {
        const showInventory = panelName === "inventory";
        ordersPanel.hidden = showInventory;
        inventoryPanel.hidden = !showInventory;
        ordersTab.classList.toggle("active", !showInventory);
        inventoryTab.classList.toggle("active", showInventory);
        ordersTab.setAttribute("aria-selected", (!showInventory).toString());
        inventoryTab.setAttribute("aria-selected", showInventory.toString());

        if (showInventory) {
            loadInventory().catch(function (error) {
                setMessage(inventoryMessage, error.message, "error");
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

        products.forEach(function (product) {
            const row = document.createElement("tr");
            row.dataset.productId = product.id;

            const nameCell = document.createElement("td");
            const nameInput = createInventoryInput("text", product.name, "inventory-name");
            nameInput.setAttribute("aria-label", "Product name");
            nameCell.appendChild(nameInput);

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

            row.append(nameCell, priceCell, quantityCell, unitCell, madeCell, activeCell);
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
        return Array.from(inventoryRows.querySelectorAll("tr")).map(function (row) {
            const price = Number.parseFloat(row.querySelector(".inventory-price-input").value);
            const quantityValue = row.querySelector(".inventory-quantity").value;

            return {
                id: row.dataset.productId,
                name: row.querySelector(".inventory-name").value,
                unit: row.querySelector(".inventory-unit").value,
                priceCents: Math.round(price * 100),
                quantity: quantityValue === "" ? null : Number(quantityValue),
                madeToOrder: row.querySelector(".inventory-made-to-order").checked,
                active: row.querySelector(".inventory-active").checked
            };
        });
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
            details.appendChild(createTextElement("p", "", "Submitted: " + submitted.toLocaleString()));
            details.appendChild(createTextElement("p", "", "Phone: " + order.phone));

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
            await loadOrders();
        } catch (error) {
            setMessage(loginMessage, error.message, "error");
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

        button.disabled = true;
        setMessage(adminMessage, "Updating order...", "success");

        try {
            const response = await fetch(
                "/api/admin/orders/" + encodeURIComponent(button.dataset.orderId) + "/action",
                {
                    method: "POST",
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ action: button.dataset.action })
                }
            );
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "The order could not be updated.");
            }

            await loadOrders();
        } catch (error) {
            setMessage(adminMessage, error.message, "error");
            button.disabled = false;
        }
    });

    refreshButton.addEventListener("click", function () {
        loadOrders().catch(function (error) {
            setMessage(adminMessage, error.message, "error");
        });
    });

    ordersTab.addEventListener("click", function () {
        switchPanel("orders");
    });

    inventoryTab.addEventListener("click", function () {
        switchPanel("inventory");
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

            await loadInventory();
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

    loadOrders().catch(function (error) {
        showLogin(error.message);
    });
});
