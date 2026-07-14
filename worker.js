const SCHEMA_STATEMENTS = [
    `CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        unit TEXT NOT NULL,
        price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
        quantity INTEGER CHECK (quantity IS NULL OR quantity >= 0),
        made_to_order INTEGER NOT NULL DEFAULT 0 CHECK (made_to_order IN (0, 1)),
        sort_order INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        order_number TEXT NOT NULL UNIQUE,
        customer_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        delivery_day TEXT NOT NULL,
        notes TEXT,
        total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        unit_price_cents INTEGER NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        line_total_cents INTEGER NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
    )`,
    `CREATE TRIGGER IF NOT EXISTS deduct_inventory_before_order_item
    BEFORE INSERT ON order_items
    WHEN (SELECT made_to_order FROM products WHERE id = NEW.product_id) = 0
    BEGIN
        SELECT CASE
            WHEN (SELECT quantity FROM products WHERE id = NEW.product_id) IS NULL
              OR (SELECT quantity FROM products WHERE id = NEW.product_id) < NEW.quantity
            THEN RAISE(ABORT, 'INSUFFICIENT_STOCK')
        END;
        UPDATE products
        SET quantity = quantity - NEW.quantity
        WHERE id = NEW.product_id;
    END`,
    `CREATE TRIGGER IF NOT EXISTS restock_inventory_after_order_cancel
    AFTER UPDATE OF status ON orders
    WHEN NEW.status = 'cancelled' AND OLD.status <> 'cancelled'
    BEGIN
        UPDATE products
        SET quantity = quantity + COALESCE((
            SELECT SUM(order_items.quantity)
            FROM order_items
            WHERE order_items.order_id = NEW.id
              AND order_items.product_id = products.id
        ), 0)
        WHERE made_to_order = 0
          AND id IN (
              SELECT product_id
              FROM order_items
              WHERE order_id = NEW.id
          );
    END`,
    `INSERT INTO products (id, name, unit, price_cents, quantity, made_to_order, sort_order) VALUES
        ('callaloo', 'Callaloo, vacuum sealed', 'pack', 600, 11, 0, 10),
        ('beets', 'Beets', 'bunch', 600, 2, 0, 20),
        ('yellow-zucchini', 'Yellow Zucchini', 'each', 100, 8, 0, 30),
        ('green-zucchini', 'Green Zucchini', 'each', 100, 6, 0, 40),
        ('lebanese-zucchini', 'Lebanese Zucchini', 'each', 100, 2, 0, 50),
        ('small-courgette', 'Small Courgette', 'each', 100, 2, 0, 60),
        ('cold-flu-tea', 'Cold & Flu Tea Mix', 'mix', 600, NULL, 1, 70),
        ('menopause-tea', 'Perimenopause / Menopause Tea Mix', 'mix', 700, NULL, 1, 80),
        ('mullein-tea', 'Mullein Tea Mix', 'mix', 600, NULL, 1, 90)
    ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        unit = excluded.unit,
        price_cents = excluded.price_cents,
        made_to_order = excluded.made_to_order,
        sort_order = excluded.sort_order,
        active = 1`
];

let databaseInitialization;

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff"
        }
    });
}

function ensureDatabase(db) {
    if (!databaseInitialization) {
        const statements = SCHEMA_STATEMENTS.map(function (statement) {
            return db.prepare(statement);
        });
        databaseInitialization = db.batch(statements).catch(function (error) {
            databaseInitialization = undefined;
            throw error;
        });
    }

    return databaseInitialization;
}

function cleanText(value, maximumLength) {
    return typeof value === "string" ? value.trim().slice(0, maximumLength) : "";
}

function createOrderNumber() {
    const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();
    return "SBG-" + date + "-" + suffix;
}

function getCookie(request, name) {
    const cookieHeader = request.headers.get("Cookie") || "";
    const cookies = cookieHeader.split(";");

    for (const cookie of cookies) {
        const [cookieName, ...valueParts] = cookie.trim().split("=");

        if (cookieName === name) {
            return valueParts.join("=");
        }
    }

    return "";
}

function constantTimeEqual(left, right) {
    if (left.length !== right.length) {
        return false;
    }

    let difference = 0;

    for (let index = 0; index < left.length; index += 1) {
        difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }

    return difference === 0;
}

async function createAdminToken(password) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode("soda-backyard-garden-admin-v1")
    );
    const bytes = new Uint8Array(signature);
    let binary = "";

    bytes.forEach(function (byte) {
        binary += String.fromCharCode(byte);
    });

    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function isAdmin(request, env) {
    if (!env.ADMIN_PASSWORD) {
        return false;
    }

    const providedToken = getCookie(request, "sbg_admin");
    const expectedToken = await createAdminToken(env.ADMIN_PASSWORD);
    return constantTimeEqual(providedToken, expectedToken);
}

async function getProducts(db) {
    const result = await db.prepare(`
        SELECT id, name, unit, price_cents, quantity, made_to_order
        FROM products
        WHERE active = 1
        ORDER BY sort_order, name
    `).all();

    return result.results.map(function (product) {
        return {
            id: product.id,
            name: product.name,
            unit: product.unit,
            priceCents: product.price_cents,
            quantity: product.quantity,
            madeToOrder: product.made_to_order === 1
        };
    });
}

async function handleInventory(db) {
    return jsonResponse({ products: await getProducts(db) });
}

async function handleOrder(request, db) {
    let body;

    try {
        body = await request.json();
    } catch (_error) {
        return jsonResponse({ error: "The order information was not valid." }, 400);
    }

    if (cleanText(body.website, 100)) {
        return jsonResponse({ orderNumber: "SBG-RECEIVED", total: "$0.00" });
    }

    const customerName = cleanText(body.customerName, 100);
    const phone = cleanText(body.phone, 40);
    const email = cleanText(body.email, 150);
    const deliveryDay = cleanText(body.deliveryDay, 20);
    const notes = cleanText(body.notes, 1000);
    const allowedDeliveryDays = new Set([
        "Tuesday", "Wednesday", "Thursday", "Friday", "To be confirmed"
    ]);

    if (customerName.length < 2) {
        return jsonResponse({ error: "Please enter your full name." }, 400);
    }

    if (phone.replace(/\D/g, "").length < 7) {
        return jsonResponse({ error: "Please enter a valid phone number." }, 400);
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return jsonResponse({ error: "Please enter a valid email address or leave it blank." }, 400);
    }

    if (!allowedDeliveryDays.has(deliveryDay)) {
        return jsonResponse({ error: "The delivery day selection was not valid." }, 400);
    }

    if (!body.items || typeof body.items !== "object" || Array.isArray(body.items)) {
        return jsonResponse({ error: "Please select at least one item." }, 400);
    }

    const products = await getProducts(db);
    const productMap = new Map(products.map(function (product) {
        return [product.id, product];
    }));
    const requestedItems = [];

    for (const [productId, value] of Object.entries(body.items)) {
        const quantity = Number(value);
        const product = productMap.get(productId);

        if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
            return jsonResponse({ error: "One of the selected quantities is not valid." }, 400);
        }

        requestedItems.push({ product, quantity });
    }

    if (requestedItems.length === 0) {
        return jsonResponse({ error: "Please select at least one item." }, 400);
    }

    const totalCents = requestedItems.reduce(function (total, item) {
        return total + (item.product.priceCents * item.quantity);
    }, 0);
    const orderId = crypto.randomUUID();
    const orderNumber = createOrderNumber();
    const statements = [
        db.prepare(`
            INSERT INTO orders (
                id, order_number, customer_name, phone, email,
                delivery_day, notes, total_cents
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            orderId,
            orderNumber,
            customerName,
            phone,
            email || null,
            deliveryDay,
            notes || null,
            totalCents
        )
    ];

    requestedItems.forEach(function (item) {
        statements.push(
            db.prepare(`
                INSERT INTO order_items (
                    order_id, product_id, product_name,
                    unit_price_cents, quantity, line_total_cents
                ) VALUES (?, ?, ?, ?, ?, ?)
            `).bind(
                orderId,
                item.product.id,
                item.product.name,
                item.product.priceCents,
                item.quantity,
                item.product.priceCents * item.quantity
            )
        );
    });

    try {
        await db.batch(statements);
    } catch (error) {
        if (String(error).includes("INSUFFICIENT_STOCK")) {
            return jsonResponse({
                error: "One of those items just sold out or no longer has enough stock. The quantities have been refreshed; please adjust your order."
            }, 409);
        }

        console.error("Order storage failed", error);
        return jsonResponse({ error: "We could not save the order. Please try again shortly." }, 500);
    }

    return jsonResponse({
        orderNumber,
        total: "$" + (totalCents / 100).toFixed(2)
    }, 201);
}

async function handleAdminLogin(request, env) {
    if (!env.ADMIN_PASSWORD) {
        return jsonResponse({
            error: "The admin password has not been configured in Cloudflare yet."
        }, 503);
    }

    let body;

    try {
        body = await request.json();
    } catch (_error) {
        return jsonResponse({ error: "Please enter the admin password." }, 400);
    }

    const password = cleanText(body.password, 200);

    if (!constantTimeEqual(password, env.ADMIN_PASSWORD)) {
        return jsonResponse({ error: "That password was not correct." }, 401);
    }

    const token = await createAdminToken(env.ADMIN_PASSWORD);
    const response = jsonResponse({ success: true });
    response.headers.set(
        "Set-Cookie",
        "sbg_admin=" + token + "; Path=/; Max-Age=43200; HttpOnly; Secure; SameSite=Strict"
    );
    return response;
}

function handleAdminLogout() {
    const response = jsonResponse({ success: true });
    response.headers.set(
        "Set-Cookie",
        "sbg_admin=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict"
    );
    return response;
}

async function handleAdminOrders(db) {
    const result = await db.prepare(`
        SELECT
            orders.id,
            orders.order_number,
            orders.customer_name,
            orders.phone,
            orders.email,
            orders.delivery_day,
            orders.notes,
            orders.total_cents,
            orders.status,
            orders.created_at,
            order_items.product_name,
            order_items.unit_price_cents,
            order_items.quantity,
            order_items.line_total_cents
        FROM orders
        LEFT JOIN order_items ON order_items.order_id = orders.id
        ORDER BY orders.created_at DESC, order_items.id
        LIMIT 500
    `).all();
    const orderMap = new Map();

    result.results.forEach(function (row) {
        if (!orderMap.has(row.id)) {
            orderMap.set(row.id, {
                id: row.id,
                orderNumber: row.order_number,
                customerName: row.customer_name,
                phone: row.phone,
                email: row.email,
                deliveryDay: row.delivery_day,
                notes: row.notes,
                totalCents: row.total_cents,
                status: row.status,
                createdAt: row.created_at,
                items: []
            });
        }

        if (row.product_name) {
            orderMap.get(row.id).items.push({
                name: row.product_name,
                quantity: row.quantity,
                unitPriceCents: row.unit_price_cents,
                lineTotalCents: row.line_total_cents
            });
        }
    });

    return jsonResponse({ orders: Array.from(orderMap.values()) });
}

async function handleAdminOrderAction(request, db, orderId) {
    let body;

    try {
        body = await request.json();
    } catch (_error) {
        return jsonResponse({ error: "The order action was not valid." }, 400);
    }

    const action = cleanText(body.action, 20);
    let result;

    if (action === "confirm") {
        result = await db.prepare(`
            UPDATE orders
            SET status = 'confirmed'
            WHERE id = ? AND status = 'pending'
        `).bind(orderId).run();
    } else if (action === "complete") {
        result = await db.prepare(`
            UPDATE orders
            SET status = 'completed'
            WHERE id = ? AND status = 'confirmed'
        `).bind(orderId).run();
    } else if (action === "cancel") {
        result = await db.prepare(`
            UPDATE orders
            SET status = 'cancelled'
            WHERE id = ? AND status IN ('pending', 'confirmed')
        `).bind(orderId).run();
    } else {
        return jsonResponse({ error: "That order action is not supported." }, 400);
    }

    if (!result.meta || result.meta.changes !== 1) {
        return jsonResponse({
            error: "The order has already changed status. Refresh the order list and try again."
        }, 409);
    }

    return jsonResponse({ success: true });
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (!url.pathname.startsWith("/api/")) {
            return env.ASSETS.fetch(request);
        }

        if (!env.DB) {
            return jsonResponse({ error: "The order database binding is not configured." }, 503);
        }

        const origin = request.headers.get("Origin");

        if (origin && new URL(origin).origin !== url.origin) {
            return jsonResponse({ error: "This request is not allowed." }, 403);
        }

        try {
            if (url.pathname === "/api/admin/login" && request.method === "POST") {
                return handleAdminLogin(request, env);
            }

            if (url.pathname === "/api/admin/logout" && request.method === "POST") {
                return handleAdminLogout();
            }

            await ensureDatabase(env.DB);

            if (url.pathname === "/api/inventory" && request.method === "GET") {
                return handleInventory(env.DB);
            }

            if (url.pathname === "/api/orders" && request.method === "POST") {
                return handleOrder(request, env.DB);
            }

            if (url.pathname.startsWith("/api/admin/")) {
                if (!(await isAdmin(request, env))) {
                    return jsonResponse({ error: "Admin sign-in required." }, 401);
                }

                if (url.pathname === "/api/admin/orders" && request.method === "GET") {
                    return handleAdminOrders(env.DB);
                }

                const orderActionMatch = url.pathname.match(/^\/api\/admin\/orders\/([^/]+)\/action$/);

                if (orderActionMatch && request.method === "POST") {
                    return handleAdminOrderAction(request, env.DB, orderActionMatch[1]);
                }
            }

            return jsonResponse({ error: "Not found." }, 404);
        } catch (error) {
            console.error("Database initialization failed", error);
            return jsonResponse({ error: "The order system is temporarily unavailable." }, 503);
        }
    }
};
