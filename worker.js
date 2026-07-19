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
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        paid_at TEXT
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
    `CREATE TABLE IF NOT EXISTS donations (
        id TEXT PRIMARY KEY,
        donation_number TEXT UNIQUE,
        donor_name TEXT NOT NULL,
        donor_phone TEXT,
        donor_email TEXT,
        amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
        note TEXT,
        received_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'received',
        confirmed_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
    `INSERT INTO products (id, name, unit, price_cents, quantity, made_to_order, sort_order, active) VALUES
        ('callaloo', 'Callaloo, vacuum sealed', 'pack', 600, 11, 0, 10, 1),
        ('beets', 'Beets', 'bunch', 600, 2, 0, 20, 1),
        ('yellow-zucchini', 'Yellow Zucchini', 'each', 100, 8, 0, 30, 1),
        ('green-zucchini', 'Green Zucchini', 'each', 100, 6, 0, 40, 1),
        ('lebanese-zucchini', 'Lebanese Zucchini', 'each', 100, 2, 0, 50, 1),
        ('small-courgette', 'Small Courgette', 'each', 100, 2, 0, 60, 1),
        ('dragon-tongue-beans', 'Dragon Tongue Beans', 'litre', 600, NULL, 1, 70, 1),
        ('purple-beans', 'Purple Beans', 'litre', 600, NULL, 1, 80, 1),
        ('green-beans', 'Green Beans', 'litre', 600, NULL, 1, 90, 1),
        ('potatoes', 'Potatoes', 'bag', 0, 0, 0, 100, 0),
        ('cold-flu-tea', 'Cold & Flu Tea Mix', 'mix', 600, NULL, 1, 110, 1),
        ('menopause-tea', 'Perimenopause / Menopause Tea Mix', 'mix', 700, NULL, 1, 120, 1),
        ('mullein-tea', 'Mullein Tea Mix', 'mix', 600, NULL, 1, 130, 1),
        ('red-raspberry-leaf-tea', 'Red Raspberry Leaf Tea Mix', 'mix', 0, NULL, 1, 140, 0),
        ('hardo-bread', 'Hardo Bread', 'loaf', 500, 12, 0, 150, 1),
        ('brown-eggs', 'Brown Eggs', 'dozen', 600, 0, 0, 160, 1),
        ('white-eggs-flat', 'Flat of White Eggs', 'flat', 1000, 0, 0, 170, 1),
        ('pain-rub-oil-2oz', 'Pain Rub Oil - 2 oz', 'bottle', 6000, 0, 0, 180, 1),
        ('pain-rub-oil-4oz', 'Pain Rub Oil - 4 oz', 'bottle', 8000, 0, 0, 190, 1),
        ('pain-rub-balm-2oz', 'Pain Rub Balm - 2 oz', 'jar', 6000, 0, 0, 200, 1),
        ('pain-rub-balm-4oz', 'Pain Rub Balm - 4 oz', 'jar', 8000, 0, 0, 210, 1),
        ('fresh-garlic', 'Fresh Garlic', 'each', 0, 0, 0, 220, 0),
        ('fresh-onions', 'Fresh Onions', 'each', 0, 0, 0, 230, 0),
        ('sage', 'Sage', 'bunch', 600, 0, 0, 240, 1)
    ON CONFLICT(id) DO NOTHING`,
    `UPDATE products
    SET price_cents = 500, active = 1
    WHERE id = 'hardo-bread' AND price_cents = 0`
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
        databaseInitialization = (async function () {
            const statements = SCHEMA_STATEMENTS.map(function (statement) {
                return db.prepare(statement);
            });
            await db.batch(statements);

            const orderColumns = await db.prepare("PRAGMA table_info(orders)").all();
            const hasPaidAt = orderColumns.results.some(function (column) {
                return column.name === "paid_at";
            });

            if (!hasPaidAt) {
                await db.prepare("ALTER TABLE orders ADD COLUMN paid_at TEXT").run();
            }

            await db.prepare(`
                UPDATE orders
                SET paid_at = created_at
                WHERE paid_at IS NULL AND status IN ('confirmed', 'completed')
            `).run();

            const donationColumns = await db.prepare("PRAGMA table_info(donations)").all();
            const donationColumnNames = new Set(donationColumns.results.map(function (column) {
                return column.name;
            }));
            const donationMigrations = [
                ["donation_number", "ALTER TABLE donations ADD COLUMN donation_number TEXT"],
                ["donor_phone", "ALTER TABLE donations ADD COLUMN donor_phone TEXT"],
                ["donor_email", "ALTER TABLE donations ADD COLUMN donor_email TEXT"],
                ["status", "ALTER TABLE donations ADD COLUMN status TEXT NOT NULL DEFAULT 'received'"],
                ["confirmed_at", "ALTER TABLE donations ADD COLUMN confirmed_at TEXT"]
            ];

            for (const [columnName, migration] of donationMigrations) {
                if (!donationColumnNames.has(columnName)) {
                    await db.prepare(migration).run();
                }
            }

            await db.prepare(`
                UPDATE donations
                SET status = 'received',
                    confirmed_at = COALESCE(confirmed_at, received_at, created_at)
                WHERE status IS NULL OR status = ''
            `).run();
        })().catch(function (error) {
            databaseInitialization = undefined;
            throw error;
        });
    }

    return databaseInitialization;
}

function torontoDateKey(timestamp) {
    const date = timestamp instanceof Date
        ? timestamp
        : new Date(String(timestamp).replace(" ", "T") + "Z");
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Toronto",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(function (part) {
        return [part.type, part.value];
    }));
    return values.year + "-" + values.month + "-" + values.day;
}

function startOfWeekKey(dateKey) {
    const date = new Date(dateKey + "T12:00:00Z");
    const daysSinceMonday = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - daysSinceMonday);
    return date.toISOString().slice(0, 10);
}

function cleanText(value, maximumLength) {
    return typeof value === "string" ? value.trim().slice(0, maximumLength) : "";
}

function createOrderNumber() {
    const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();
    return "SBG-" + date + "-" + suffix;
}

function createDonationNumber() {
    const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();
    return "DON-" + date + "-" + suffix;
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

async function getProducts(db, includeInactive = false) {
    const result = await db.prepare(`
        SELECT id, name, unit, price_cents, quantity, made_to_order, active
        FROM products
        ${includeInactive ? "" : "WHERE active = 1"}
        ORDER BY sort_order, name
    `).all();

    return result.results.map(function (product) {
        return {
            id: product.id,
            name: product.name,
            unit: product.unit,
            priceCents: product.price_cents,
            quantity: product.quantity,
            madeToOrder: product.made_to_order === 1,
            active: product.active === 1
        };
    });
}

async function handleInventory(db) {
    return jsonResponse({ products: await getProducts(db, true) });
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

        if (productId === "hardo-bread" && quantity > 1) {
            return jsonResponse({ error: "Hardo Bread is limited to one loaf per household." }, 400);
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

async function handleDonationRequest(request, db) {
    let body;

    try {
        body = await request.json();
    } catch (_error) {
        return jsonResponse({ error: "The donation information was not valid." }, 400);
    }

    if (cleanText(body.website, 100)) {
        return jsonResponse({
            referenceNumber: "DON-RECEIVED",
            amount: "$0.00"
        });
    }

    const donorName = cleanText(body.donorName, 100);
    const phone = cleanText(body.phone, 40);
    const email = cleanText(body.email, 150);
    const note = cleanText(body.note, 500);
    const amountCents = Number(body.amountCents);

    if (donorName.length < 2) {
        return jsonResponse({ error: "Please enter your full name." }, 400);
    }

    if (phone.replace(/\D/g, "").length < 7) {
        return jsonResponse({ error: "Please enter a valid phone number." }, 400);
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return jsonResponse({ error: "Please enter a valid email address or leave it blank." }, 400);
    }

    if (!Number.isInteger(amountCents) || amountCents < 100 || amountCents > 100000000) {
        return jsonResponse({ error: "Please enter a valid donation amount of at least $1.00." }, 400);
    }

    const referenceNumber = createDonationNumber();
    const submittedDate = torontoDateKey(new Date());

    await db.prepare(`
        INSERT INTO donations (
            id, donation_number, donor_name, donor_phone, donor_email,
            amount_cents, note, received_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).bind(
        crypto.randomUUID(),
        referenceNumber,
        donorName,
        phone,
        email || null,
        amountCents,
        note || null,
        submittedDate
    ).run();

    return jsonResponse({
        referenceNumber,
        amount: "$" + (amountCents / 100).toFixed(2)
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

async function handleAdminInventory(db) {
    const result = await db.prepare(`
        SELECT id, name, unit, price_cents, quantity, made_to_order, sort_order, active
        FROM products
        ORDER BY sort_order, name
    `).all();

    return jsonResponse({
        products: result.results.map(function (product) {
            return {
                id: product.id,
                name: product.name,
                unit: product.unit,
                priceCents: product.price_cents,
                quantity: product.quantity,
                madeToOrder: product.made_to_order === 1,
                active: product.active === 1
            };
        })
    });
}

async function handleAdminSales(db) {
    const results = await db.batch([
        db.prepare(`
            SELECT
                order_number,
                customer_name,
                total_cents,
                COALESCE(paid_at, created_at) AS paid_at
            FROM orders
            WHERE status IN ('confirmed', 'completed')
            ORDER BY COALESCE(paid_at, created_at) DESC
        `),
        db.prepare(`
            SELECT COUNT(*) AS order_count, COALESCE(SUM(total_cents), 0) AS total_cents
            FROM orders
            WHERE status = 'pending'
        `),
        db.prepare(`
            SELECT
                order_items.product_name,
                SUM(order_items.quantity) AS quantity_sold,
                SUM(order_items.line_total_cents) AS revenue_cents
            FROM order_items
            JOIN orders ON orders.id = order_items.order_id
            WHERE orders.status IN ('confirmed', 'completed')
            GROUP BY order_items.product_name
            ORDER BY revenue_cents DESC, order_items.product_name
        `),
        db.prepare(`
            SELECT COUNT(*) AS donation_count, COALESCE(SUM(amount_cents), 0) AS total_cents
            FROM donations
            WHERE status = 'received'
        `),
        db.prepare(`
            SELECT
                id, donation_number, donor_name, donor_phone, donor_email,
                amount_cents, note, received_at, status, confirmed_at, created_at
            FROM donations
            WHERE status <> 'cancelled'
            ORDER BY
                CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
                created_at DESC
            LIMIT 100
        `),
        db.prepare(`
            SELECT COUNT(*) AS donation_count, COALESCE(SUM(amount_cents), 0) AS total_cents
            FROM donations
            WHERE status = 'pending'
        `)
    ]);
    const payments = results[0].results;
    const pending = results[1].results[0] || { order_count: 0, total_cents: 0 };
    const donationSummary = results[3].results[0] || { donation_count: 0, total_cents: 0 };
    const pendingDonationSummary = results[5].results[0] || { donation_count: 0, total_cents: 0 };
    const todayKey = torontoDateKey(new Date());
    const monthKey = todayKey.slice(0, 7);
    const weekKey = startOfWeekKey(todayKey);
    const summary = {
        allTimeCents: 0,
        todayCents: 0,
        weekCents: 0,
        monthCents: 0,
        paidOrders: payments.length,
        pendingCents: Number(pending.total_cents) || 0,
        pendingOrders: Number(pending.order_count) || 0,
        donationsCents: Number(donationSummary.total_cents) || 0,
        donationCount: Number(donationSummary.donation_count) || 0,
        pendingDonationCents: Number(pendingDonationSummary.total_cents) || 0,
        pendingDonationCount: Number(pendingDonationSummary.donation_count) || 0
    };

    payments.forEach(function (payment) {
        const amount = Number(payment.total_cents) || 0;
        const paymentDateKey = torontoDateKey(payment.paid_at);
        summary.allTimeCents += amount;

        if (paymentDateKey === todayKey) {
            summary.todayCents += amount;
        }

        if (paymentDateKey >= weekKey && paymentDateKey <= todayKey) {
            summary.weekCents += amount;
        }

        if (paymentDateKey.startsWith(monthKey)) {
            summary.monthCents += amount;
        }
    });

    return jsonResponse({
        summary,
        products: results[2].results.map(function (product) {
            return {
                name: product.product_name,
                quantitySold: Number(product.quantity_sold) || 0,
                revenueCents: Number(product.revenue_cents) || 0
            };
        }),
        recentPayments: payments.slice(0, 10).map(function (payment) {
            return {
                orderNumber: payment.order_number,
                customerName: payment.customer_name,
                totalCents: Number(payment.total_cents) || 0,
                paidAt: payment.paid_at
            };
        }),
        donations: results[4].results.map(function (donation) {
            return {
                id: donation.id,
                referenceNumber: donation.donation_number,
                donorName: donation.donor_name,
                phone: donation.donor_phone,
                email: donation.donor_email,
                amountCents: Number(donation.amount_cents) || 0,
                note: donation.note,
                receivedAt: donation.received_at,
                status: donation.status,
                confirmedAt: donation.confirmed_at,
                createdAt: donation.created_at
            };
        })
    });
}

async function handleAdminDonationCreate(request, db) {
    let body;

    try {
        body = await request.json();
    } catch (_error) {
        return jsonResponse({ error: "The donation information was not valid." }, 400);
    }

    const donorName = cleanText(body.donorName, 100);
    const note = cleanText(body.note, 500);
    const receivedAt = cleanText(body.receivedAt, 10);
    const amountCents = Number(body.amountCents);
    const parsedDate = new Date(receivedAt + "T12:00:00Z");

    if (donorName.length < 2) {
        return jsonResponse({ error: "Enter the donor's name or Anonymous." }, 400);
    }

    if (!Number.isInteger(amountCents) || amountCents < 1 || amountCents > 100000000) {
        return jsonResponse({ error: "Enter a valid donation amount." }, 400);
    }

    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(receivedAt) ||
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== receivedAt ||
        receivedAt > torontoDateKey(new Date())
    ) {
        return jsonResponse({ error: "Enter a valid donation date that is not in the future." }, 400);
    }

    await db.prepare(`
        INSERT INTO donations (
            id, donation_number, donor_name, amount_cents, note,
            received_at, status, confirmed_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 'received', ?)
    `).bind(
        crypto.randomUUID(),
        createDonationNumber(),
        donorName,
        amountCents,
        note || null,
        receivedAt,
        receivedAt
    ).run();

    return jsonResponse({ success: true }, 201);
}

async function handleAdminDonationAction(request, db, donationId) {
    let body;

    try {
        body = await request.json();
    } catch (_error) {
        return jsonResponse({ error: "The donation action was not valid." }, 400);
    }

    const action = cleanText(body.action, 20);

    if (action !== "confirm") {
        return jsonResponse({ error: "That donation action is not supported." }, 400);
    }

    const receivedAt = torontoDateKey(new Date());
    const result = await db.prepare(`
        UPDATE donations
        SET status = 'received',
            received_at = ?,
            confirmed_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'pending'
    `).bind(receivedAt, donationId).run();

    if (!result.meta || result.meta.changes < 1) {
        return jsonResponse({
            error: "The donation has already changed status. Refresh the Sales page and try again."
        }, 409);
    }

    return jsonResponse({ success: true });
}

async function handleAdminDonationDelete(db, donationId) {
    const result = await db.prepare("DELETE FROM donations WHERE id = ?")
        .bind(donationId)
        .run();

    if (!result.meta || result.meta.changes < 1) {
        return jsonResponse({ error: "That donation entry was not found." }, 404);
    }

    return jsonResponse({ success: true });
}

async function handleAdminInventoryUpdate(request, db) {
    let body;

    try {
        body = await request.json();
    } catch (_error) {
        return jsonResponse({ error: "The inventory changes were not valid." }, 400);
    }

    if (!body.products || !Array.isArray(body.products) || body.products.length === 0) {
        return jsonResponse({ error: "No inventory changes were received." }, 400);
    }

    const existingResult = await db.prepare("SELECT id FROM products").all();
    const existingIds = new Set(existingResult.results.map(function (product) {
        return product.id;
    }));
    const seenIds = new Set();
    const updates = [];

    for (const submitted of body.products) {
        const id = cleanText(submitted.id, 100);
        const name = cleanText(submitted.name, 100);
        const unit = cleanText(submitted.unit, 30).toLowerCase();
        const priceCents = Number(submitted.priceCents);
        const madeToOrder = submitted.madeToOrder === true;
        const active = submitted.active === true;
        const quantity = madeToOrder ? null : Number(submitted.quantity);

        if (!existingIds.has(id) || seenIds.has(id)) {
            return jsonResponse({ error: "One of the inventory products was not recognized." }, 400);
        }

        if (name.length < 2 || unit.length < 1) {
            return jsonResponse({ error: "Every product needs a name and selling unit." }, 400);
        }

        if (!Number.isInteger(priceCents) || priceCents < 0 || priceCents > 1000000) {
            return jsonResponse({ error: "Enter a valid price for " + name + "." }, 400);
        }

        if (!madeToOrder && (!Number.isInteger(quantity) || quantity < 0 || quantity > 1000000)) {
            return jsonResponse({ error: "Enter a valid quantity for " + name + "." }, 400);
        }

        if (active && priceCents === 0) {
            return jsonResponse({ error: name + " needs a price before it can be available to order." }, 400);
        }

        seenIds.add(id);
        updates.push(
            db.prepare(`
                UPDATE products
                SET name = ?, unit = ?, price_cents = ?, quantity = ?,
                    made_to_order = ?, active = ?
                WHERE id = ?
            `).bind(
                name,
                unit,
                priceCents,
                quantity,
                madeToOrder ? 1 : 0,
                active ? 1 : 0,
                id
            )
        );
    }

    await db.batch(updates);
    return jsonResponse({ success: true });
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
            SET status = 'confirmed', paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP)
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

    if (!result.meta || result.meta.changes < 1) {
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

            if (url.pathname === "/api/donations" && request.method === "POST") {
                return handleDonationRequest(request, env.DB);
            }

            if (url.pathname.startsWith("/api/admin/")) {
                if (!(await isAdmin(request, env))) {
                    return jsonResponse({ error: "Admin sign-in required." }, 401);
                }

                if (url.pathname === "/api/admin/orders" && request.method === "GET") {
                    return handleAdminOrders(env.DB);
                }

                if (url.pathname === "/api/admin/inventory" && request.method === "GET") {
                    return handleAdminInventory(env.DB);
                }

                if (url.pathname === "/api/admin/inventory" && request.method === "PUT") {
                    return handleAdminInventoryUpdate(request, env.DB);
                }

                if (url.pathname === "/api/admin/sales" && request.method === "GET") {
                    return handleAdminSales(env.DB);
                }

                if (url.pathname === "/api/admin/donations" && request.method === "POST") {
                    return handleAdminDonationCreate(request, env.DB);
                }

                const donationMatch = url.pathname.match(/^\/api\/admin\/donations\/([^/]+)$/);

                if (donationMatch && request.method === "DELETE") {
                    return handleAdminDonationDelete(env.DB, donationMatch[1]);
                }

                const donationActionMatch = url.pathname.match(/^\/api\/admin\/donations\/([^/]+)\/action$/);

                if (donationActionMatch && request.method === "POST") {
                    return handleAdminDonationAction(request, env.DB, donationActionMatch[1]);
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
