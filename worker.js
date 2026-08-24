import { buildSalesWorkbook } from "./sales-workbook.js";

const SCHEMA_STATEMENTS = [
    `CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        unit TEXT NOT NULL,
        price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
        quantity INTEGER CHECK (quantity IS NULL OR quantity >= 0),
        made_to_order INTEGER NOT NULL DEFAULT 0 CHECK (made_to_order IN (0, 1)),
        sort_order INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        description TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT '',
        is_slot INTEGER NOT NULL DEFAULT 0 CHECK (is_slot IN (0, 1)),
        order_limit INTEGER CHECK (order_limit IS NULL OR order_limit > 0),
        image_key TEXT NOT NULL DEFAULT '',
        image_fit TEXT NOT NULL DEFAULT 'cover',
        image_position TEXT NOT NULL DEFAULT 'center'
    )`,
    `CREATE TABLE IF NOT EXISTS carousel_images (
        id TEXT PRIMARY KEY,
        image_key TEXT NOT NULL DEFAULT '',
        static_path TEXT NOT NULL DEFAULT '',
        alt_text TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        image_fit TEXT NOT NULL DEFAULT 'cover',
        image_position TEXT NOT NULL DEFAULT 'center',
        source_product_id TEXT,
        deleted INTEGER NOT NULL DEFAULT 0 CHECK (deleted IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK (image_key <> '' OR static_path <> '')
    )`,
    `CREATE TABLE IF NOT EXISTS support_images (
        id TEXT PRIMARY KEY,
        image_key TEXT NOT NULL DEFAULT '',
        static_path TEXT NOT NULL DEFAULT '',
        alt_text TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        image_fit TEXT NOT NULL DEFAULT 'cover',
        image_position TEXT NOT NULL DEFAULT 'center',
        source_product_id TEXT,
        deleted INTEGER NOT NULL DEFAULT 0 CHECK (deleted IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK (image_key <> '' OR static_path <> '')
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        order_number TEXT NOT NULL UNIQUE,
        customer_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        household TEXT NOT NULL DEFAULT '',
        delivery_day TEXT NOT NULL,
        notes TEXT,
        total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        paid_at TEXT,
        completed_at TEXT,
        source TEXT NOT NULL DEFAULT 'online'
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
    `CREATE TABLE IF NOT EXISTS blocked_customers (
        id TEXT PRIMARY KEY,
        customer_name TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        household TEXT NOT NULL DEFAULT '',
        reason TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK (customer_name <> '' OR email <> '' OR phone <> '' OR household <> '')
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
    `CREATE TRIGGER IF NOT EXISTS deduct_inventory_before_order_item_increase
    BEFORE UPDATE OF quantity ON order_items
    WHEN NEW.quantity > OLD.quantity
      AND (SELECT made_to_order FROM products WHERE id = NEW.product_id) = 0
    BEGIN
        SELECT CASE
            WHEN (SELECT quantity FROM products WHERE id = NEW.product_id) IS NULL
              OR (SELECT quantity FROM products WHERE id = NEW.product_id) < (NEW.quantity - OLD.quantity)
            THEN RAISE(ABORT, 'INSUFFICIENT_STOCK')
        END;
        UPDATE products
        SET quantity = quantity - (NEW.quantity - OLD.quantity)
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
    `CREATE TRIGGER IF NOT EXISTS restock_inventory_after_order_refuse
    AFTER UPDATE OF status ON orders
    WHEN NEW.status = 'refused' AND OLD.status <> 'refused'
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
    `CREATE TRIGGER IF NOT EXISTS restock_inventory_after_order_item_reduce
    AFTER UPDATE OF quantity ON order_items
    WHEN NEW.quantity < OLD.quantity
      AND (SELECT status FROM orders WHERE id = OLD.order_id) <> 'cancelled'
    BEGIN
        UPDATE products
        SET quantity = quantity + (OLD.quantity - NEW.quantity)
        WHERE id = OLD.product_id AND made_to_order = 0;
    END`,
    `CREATE TRIGGER IF NOT EXISTS restock_inventory_after_order_item_delete
    AFTER DELETE ON order_items
    WHEN (SELECT status FROM orders WHERE id = OLD.order_id) <> 'cancelled'
    BEGIN
        UPDATE products
        SET quantity = quantity + OLD.quantity
        WHERE id = OLD.product_id AND made_to_order = 0;
    END`,
    `INSERT INTO products (id, name, unit, price_cents, quantity, made_to_order, sort_order, active) VALUES
        ('callaloo', 'Callaloo, vacuum sealed', 'pack', 600, 11, 0, 10, 1),
        ('honey-1kg', 'Honey - 1 kg', 'pail', 1800, 0, 0, 15, 0),
        ('honey-3kg', 'Honey - 3 kg', 'pail', 4800, 0, 0, 16, 0),
        ('pasta-sauce-1l', 'Pasta Sauce - 1 litre', 'jar', 600, 6, 0, 17, 1),
        ('pasta-sauce-750ml', 'Pasta Sauce - 750 mL', 'jar', 500, 6, 0, 18, 1),
        ('hot-sauce-250ml', 'Hot Sauce - 250 mL', 'bottle', 500, 0, 0, 19, 0),
        ('beets', 'Turnips', 'bundle', 300, 2, 0, 20, 1),
        ('fresh-beets', 'Beets', 'bunch', 0, 0, 0, 21, 0),
        ('yellow-zucchini', 'Yellow Zucchini', 'each', 100, 8, 0, 30, 1),
        ('green-zucchini', 'Green Zucchini', 'each', 100, 6, 0, 40, 1),
        ('lebanese-zucchini', 'Lebanese Zucchini', 'each', 100, 2, 0, 50, 1),
        ('lemon-cucumber-pack', 'Lemon Cucumber - Pack of 3', 'pack', 100, 0, 0, 55, 0),
        ('small-courgette', 'Small Courgette', 'each', 100, 2, 0, 60, 1),
        ('dragon-tongue-beans', 'Dragon Tongue Beans', 'litre', 600, NULL, 1, 70, 1),
        ('purple-beans', 'Purple Beans', 'litre', 600, NULL, 1, 80, 1),
        ('green-beans', 'Green Beans', 'litre', 600, NULL, 1, 90, 1),
        ('yellow-beans', 'Yellow Beans', 'litre', 600, NULL, 1, 95, 1),
        ('potatoes', 'Pink Potatoes', 'bag', 0, 0, 0, 96, 0),
        ('red-potatoes', 'Red Potatoes', 'bag', 0, 0, 0, 97, 0),
        ('red-fingerling-potatoes', 'Red Fingerling Potatoes', 'bag', 0, 0, 0, 98, 0),
        ('white-potatoes', 'White Potatoes', 'bag', 0, 0, 0, 99, 0),
        ('white-fingerling-potatoes', 'White Fingerling Potatoes', 'bag', 0, 0, 0, 100, 0),
        ('russet-potatoes', 'Russet Potatoes', 'bag', 400, 7, 0, 101, 1),
        ('cold-flu-tea', 'Cold & Flu Tea Mix', 'mix', 600, NULL, 1, 110, 1),
        ('menopause-tea', 'Perimenopause / Menopause Tea Mix', 'mix', 700, NULL, 1, 120, 1),
        ('mullein-tea', 'Mullein Tea Mix', 'mix', 600, NULL, 1, 130, 1),
        ('red-raspberry-leaf-tea', 'Red Raspberry Leaf Tea Mix', 'mix', 0, NULL, 1, 140, 0),
        ('bloating-tea', 'Bloating Tea Blend', 'mix', 0, NULL, 1, 145, 0),
        ('sleep-tea', 'Sleep Tea Blend', 'mix', 0, NULL, 1, 146, 0),
        ('hardo-bread', 'Hardo Bread', 'loaf', 500, 12, 0, 150, 1),
        ('brown-eggs', 'Brown Eggs', 'dozen', 600, 0, 0, 160, 1),
        ('white-eggs-flat', 'Flat of White Eggs', 'flat', 1000, 0, 0, 170, 1),
        ('pain-rub-oil-2oz', 'Pain Rub Oil - 2 oz', 'bottle', 6000, 0, 0, 180, 1),
        ('pain-rub-oil-4oz', 'Pain Rub Oil - 4 oz', 'bottle', 8000, 0, 0, 190, 1),
        ('pain-rub-balm-2oz', 'Pain Rub Balm - 2 oz', 'jar', 6000, 0, 0, 200, 1),
        ('pain-rub-balm-4oz', 'Pain Rub Balm - 4 oz', 'jar', 8000, 0, 0, 210, 1),
        ('fresh-garlic', 'Fresh Garlic', 'each', 0, 0, 0, 220, 0),
        ('fresh-onions', 'Fresh Onions', 'each', 0, 0, 0, 230, 0),
        ('onions', 'Yellow Spanish Onion', 'each', 0, 0, 0, 235, 0),
        ('red-onion', 'Red Onion', 'each', 0, 0, 0, 236, 0),
        ('white-onion', 'White Onion', 'each', 0, 0, 0, 237, 0),
        ('tri-colour-carrots', 'Tri-Colour Carrots', 'bunch', 0, 0, 0, 238, 0),
        ('sage', 'Sage', 'bunch', 600, 0, 0, 240, 1)
    ON CONFLICT(id) DO NOTHING`,
    `INSERT INTO carousel_images (
        id, static_path, alt_text, sort_order, active, image_fit, image_position
    ) VALUES
        ('home-watermelon', 'images/Watermelon.jpg', 'Watermelon', 10, 1, 'cover', 'center'),
        ('home-peppers-3', 'images/Peppers 3.jpg', 'Peppers growing in a bucket', 20, 1, 'cover', 'center'),
        ('home-flowers-8', 'images/Flowers 8.jpg', 'Flowers', 30, 1, 'cover', 'center'),
        ('home-flowers-7', 'images/Flowers 7.jpg', 'Flowers', 40, 1, 'cover', 'center'),
        ('home-onions-2', 'images/Onions 2.jpg', 'Onions ready to pick', 50, 1, 'cover', 'center'),
        ('home-red-sunflower-2', 'images/Red Sunflower 2 - dimensions.jpg', 'Red Sunflower', 60, 1, 'cover', 'center'),
        ('home-yellow-red-sunflowers', 'images/Yellow and Red Sunflowers.jpg', 'Yellow and Red Sunflowers', 70, 1, 'cover', 'center'),
        ('home-red-sunflower', 'images/Red Sunflower.jpg', 'Red Sunflower', 80, 1, 'cover', 'center'),
        ('home-peppers-2', 'images/Peppers 2.jpg', 'Peppers growing in a bucket', 90, 1, 'cover', 'center'),
        ('home-peppers', 'images/Peppers.jpg', 'Peppers growing in a bucket', 100, 1, 'cover', 'center')
    ON CONFLICT(id) DO NOTHING`,
    `INSERT INTO support_images (
        id, static_path, alt_text, sort_order, active, image_fit, image_position
    ) VALUES
        ('support-artichoke', 'images/Artichoke.jpg', 'Artichoke growing in the garden', 10, 1, 'cover', 'center'),
        ('support-pea-aisle', 'images/Pea Aisle.jpg', 'Pea plants growing along a garden aisle', 20, 1, 'cover', 'center')
    ON CONFLICT(id) DO NOTHING`,
    `UPDATE products
    SET name = 'Turnips'
    WHERE id = 'beets' AND name IN ('Beets', 'Turnip')`,
    `UPDATE products
    SET name = 'Pink Potatoes', sort_order = 96
    WHERE id = 'potatoes' AND name = 'Potatoes'`,
    `UPDATE products
    SET name = 'Yellow Spanish Onion'
    WHERE id = 'onions' AND name IN ('Onions', 'Yellow Spanish Onions')`,
    `UPDATE products
    SET price_cents = 500, active = 1
    WHERE id = 'hardo-bread' AND price_cents = 0`,
    `UPDATE products
    SET category = 'produce'
    WHERE id IN (
        'callaloo', 'honey-1kg', 'honey-3kg', 'pasta-sauce-1l',
        'pasta-sauce-750ml', 'hot-sauce-250ml', 'beets', 'fresh-beets', 'lemon-cucumber-pack',
        'yellow-zucchini', 'green-zucchini',
        'lebanese-zucchini', 'small-courgette', 'dragon-tongue-beans',
        'purple-beans', 'green-beans', 'yellow-beans', 'potatoes',
        'red-potatoes', 'red-fingerling-potatoes', 'white-potatoes',
        'white-fingerling-potatoes', 'russet-potatoes', 'fresh-garlic', 'fresh-onions', 'onions',
        'red-onion', 'white-onion', 'tri-colour-carrots', 'sage',
        'brown-eggs', 'white-eggs-flat'
    )`,
    `UPDATE products
    SET description = 'Ingredients: Tomato, tomato paste, garlic, garlic powder, basil, oregano, thyme, and salt.'
    WHERE id IN ('pasta-sauce-1l', 'pasta-sauce-750ml')
      AND description = ''`,
    `UPDATE products
    SET description = '250 mL bottle.'
    WHERE id = 'hot-sauce-250ml'
      AND description = ''`,
    `UPDATE products
    SET description = 'Three lemon cucumbers per pack.'
    WHERE id = 'lemon-cucumber-pack'
      AND description = ''`,
    `UPDATE products
    SET description = 'Ingredients: Mullein, hibiscus, sage, mint, lemon balm, lemon pieces, and ginger pieces.'
    WHERE id = 'cold-flu-tea'
      AND description = ''`,
    `UPDATE products
    SET description = 'Ingredients: Red clover, raspberry leaf, hibiscus, sage, lavender, and lemon balm.'
    WHERE id = 'menopause-tea'
      AND description = ''`,
    `UPDATE products
    SET description = 'Ingredients: Mint, fennel, clove, nettle, and anise.'
    WHERE id = 'bloating-tea'
      AND description = ''`,
    `UPDATE products
    SET description = 'Ingredients: Chamomile, mint, lemon balm, lemongrass, lavender, bee balm, blue vervain, and rosemary.'
    WHERE id = 'sleep-tea'
      AND description = ''`,
    `UPDATE products
    SET category = 'tea'
    WHERE id IN (
        'cold-flu-tea', 'menopause-tea', 'mullein-tea',
        'red-raspberry-leaf-tea', 'bloating-tea', 'sleep-tea'
    )`,
    `UPDATE products
    SET category = 'baked'
    WHERE id = 'hardo-bread'`,
    `UPDATE products
    SET category = 'pain-rub'
    WHERE id IN (
        'pain-rub-oil-2oz', 'pain-rub-oil-4oz',
        'pain-rub-balm-2oz', 'pain-rub-balm-4oz'
    )`,
    `UPDATE products
    SET active = 0, quantity = 0, category = 'retired'
    WHERE id IN (
        'beets', 'lebanese-zucchini', 'potatoes',
        'red-fingerling-potatoes', 'white-fingerling-potatoes', 'fresh-onions'
    )`,
    `UPDATE products
    SET quantity = NULL, made_to_order = 1
    WHERE id IN ('brown-eggs', 'white-eggs-flat')
      AND active = 1
      AND made_to_order = 0
      AND quantity = 0`,
    `INSERT INTO products (
        id, name, unit, price_cents, quantity, made_to_order,
        sort_order, active, description, category, is_slot
    ) VALUES
        ('okra', 'Okra', 'each', 0, 0, 0, 245, 0,
            'Freshly harvested okra.', 'produce', 1),
        ('sweet-banana-peppers', 'Sweet Banana Peppers', 'each', 0, 0, 0, 246, 0,
            'Fresh sweet banana peppers.', 'produce', 1)
    ON CONFLICT(id) DO NOTHING`
];

const PRODUCT_SLOT_INSERT = `INSERT INTO products (
        id, name, unit, price_cents, quantity, made_to_order,
        sort_order, active, description, category, is_slot
    ) VALUES
        ('slot-produce-1', 'New Product Slot 1', 'each', 0, 0, 0, 1001, 0, '', 'produce', 1),
        ('slot-produce-2', 'New Product Slot 2', 'each', 0, 0, 0, 1002, 0, '', 'produce', 1),
        ('slot-produce-3', 'New Product Slot 3', 'each', 0, 0, 0, 1003, 0, '', 'produce', 1),
        ('slot-produce-4', 'New Product Slot 4', 'each', 0, 0, 0, 1004, 0, '', 'produce', 1),
        ('slot-produce-5', 'New Product Slot 5', 'each', 0, 0, 0, 1005, 0, '', 'produce', 1),
        ('slot-tea-1', 'New Product Slot 1', 'mix', 0, NULL, 1, 1101, 0, '', 'tea', 1),
        ('slot-tea-2', 'New Product Slot 2', 'mix', 0, NULL, 1, 1102, 0, '', 'tea', 1),
        ('slot-tea-3', 'New Product Slot 3', 'mix', 0, NULL, 1, 1103, 0, '', 'tea', 1),
        ('slot-tea-4', 'New Product Slot 4', 'mix', 0, NULL, 1, 1104, 0, '', 'tea', 1),
        ('slot-tea-5', 'New Product Slot 5', 'mix', 0, NULL, 1, 1105, 0, '', 'tea', 1),
        ('slot-baked-1', 'New Product Slot 1', 'each', 0, 0, 0, 1201, 0, '', 'baked', 1),
        ('slot-baked-2', 'New Product Slot 2', 'each', 0, 0, 0, 1202, 0, '', 'baked', 1),
        ('slot-baked-3', 'New Product Slot 3', 'each', 0, 0, 0, 1203, 0, '', 'baked', 1),
        ('slot-baked-4', 'New Product Slot 4', 'each', 0, 0, 0, 1204, 0, '', 'baked', 1),
        ('slot-baked-5', 'New Product Slot 5', 'each', 0, 0, 0, 1205, 0, '', 'baked', 1),
        ('slot-pain-rub-1', 'New Product Slot 1', 'each', 0, 0, 0, 1301, 0, '', 'pain-rub', 1),
        ('slot-pain-rub-2', 'New Product Slot 2', 'each', 0, 0, 0, 1302, 0, '', 'pain-rub', 1),
        ('slot-pain-rub-3', 'New Product Slot 3', 'each', 0, 0, 0, 1303, 0, '', 'pain-rub', 1),
        ('slot-pain-rub-4', 'New Product Slot 4', 'each', 0, 0, 0, 1304, 0, '', 'pain-rub', 1),
        ('slot-pain-rub-5', 'New Product Slot 5', 'each', 0, 0, 0, 1305, 0, '', 'pain-rub', 1)
    ON CONFLICT(id) DO NOTHING`;

const PRODUCT_SLOT_SETTINGS = [
    { category: "produce", unit: "each", madeToOrder: false, sortBase: 1000 },
    { category: "tea", unit: "mix", madeToOrder: true, sortBase: 1100 },
    { category: "baked", unit: "each", madeToOrder: false, sortBase: 1200 },
    { category: "pain-rub", unit: "each", madeToOrder: false, sortBase: 1300 }
];
const EMPTY_PRODUCT_SLOTS_PER_CATEGORY = 5;

function isEmptyProductSlot(product) {
    return product.is_slot === 1 && product.name.startsWith("New Product Slot");
}

async function ensureEmptyProductSlots(db) {
    const result = await db.prepare(`
        SELECT id, name, category, is_slot
        FROM products
        WHERE is_slot = 1
    `).all();
    const inserts = [];

    PRODUCT_SLOT_SETTINGS.forEach(function (settings) {
        const categoryProducts = result.results.filter(function (product) {
            return product.category === settings.category;
        });
        const emptySlotCount = categoryProducts.filter(isEmptyProductSlot).length;
        let nextNumber = categoryProducts.reduce(function (highest, product) {
            const prefix = "slot-" + settings.category + "-";

            if (!product.id.startsWith(prefix)) {
                return highest;
            }

            const number = Number.parseInt(product.id.slice(prefix.length), 10);
            return Number.isInteger(number) ? Math.max(highest, number) : highest;
        }, 0) + 1;

        for (let index = emptySlotCount; index < EMPTY_PRODUCT_SLOTS_PER_CATEGORY; index += 1) {
            const id = "slot-" + settings.category + "-" + nextNumber;
            const name = "New Product Slot " + nextNumber;

            inserts.push(
                db.prepare(`
                    INSERT OR IGNORE INTO products (
                        id, name, unit, price_cents, quantity, made_to_order,
                        sort_order, active, description, category, is_slot
                    ) VALUES (?, ?, ?, 0, ?, ?, ?, 0, '', ?, 1)
                `).bind(
                    id,
                    name,
                    settings.unit,
                    settings.madeToOrder ? null : 0,
                    settings.madeToOrder ? 1 : 0,
                    settings.sortBase + nextNumber,
                    settings.category
                )
            );
            nextNumber += 1;
        }
    });

    if (inserts.length > 0) {
        await db.batch(inserts);
    }
}

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

            const blockedCustomerTable = await db.prepare(`
                SELECT sql
                FROM sqlite_master
                WHERE type = 'table' AND name = 'blocked_customers'
            `).first();
            const blockedCustomerSchema = String(blockedCustomerTable && blockedCustomerTable.sql || "");
            const blockedCustomerColumns = await db.prepare("PRAGMA table_info(blocked_customers)").all();
            const hasBlockedHousehold = blockedCustomerColumns.results.some(function (column) {
                return column.name === "household";
            });

            if (!hasBlockedHousehold || !blockedCustomerSchema.includes("OR household <> ''")) {
                await db.batch([
                    db.prepare("DROP TABLE IF EXISTS blocked_customers_rebuild"),
                    db.prepare(`
                        CREATE TABLE blocked_customers_rebuild (
                            id TEXT PRIMARY KEY,
                            customer_name TEXT NOT NULL DEFAULT '',
                            email TEXT NOT NULL DEFAULT '',
                            phone TEXT NOT NULL DEFAULT '',
                            household TEXT NOT NULL DEFAULT '',
                            reason TEXT NOT NULL DEFAULT '',
                            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            CHECK (customer_name <> '' OR email <> '' OR phone <> '' OR household <> '')
                        )
                    `),
                    db.prepare(`
                        INSERT INTO blocked_customers_rebuild (
                            id, customer_name, email, phone, household, reason, created_at
                        )
                        SELECT id, customer_name, email, phone, ${hasBlockedHousehold ? "household" : "''"}, reason, created_at
                        FROM blocked_customers
                    `),
                    db.prepare("DROP TABLE blocked_customers"),
                    db.prepare("ALTER TABLE blocked_customers_rebuild RENAME TO blocked_customers")
                ]);
            }

            const orderColumns = await db.prepare("PRAGMA table_info(orders)").all();
            const hasPaidAt = orderColumns.results.some(function (column) {
                return column.name === "paid_at";
            });

            if (!hasPaidAt) {
                await db.prepare("ALTER TABLE orders ADD COLUMN paid_at TEXT").run();
            }

            const hasCompletedAt = orderColumns.results.some(function (column) {
                return column.name === "completed_at";
            });

            if (!hasCompletedAt) {
                await db.prepare("ALTER TABLE orders ADD COLUMN completed_at TEXT").run();
            }

            const hasSource = orderColumns.results.some(function (column) {
                return column.name === "source";
            });

            if (!hasSource) {
                await db.prepare("ALTER TABLE orders ADD COLUMN source TEXT NOT NULL DEFAULT 'online'").run();
            }

            const hasHousehold = orderColumns.results.some(function (column) {
                return column.name === "household";
            });

            if (!hasHousehold) {
                await db.prepare("ALTER TABLE orders ADD COLUMN household TEXT NOT NULL DEFAULT ''").run();
            }

            await db.prepare(`
                UPDATE orders
                SET paid_at = created_at
                WHERE paid_at IS NULL AND status IN ('confirmed', 'completed')
            `).run();

            const productColumns = await db.prepare("PRAGMA table_info(products)").all();
            const productColumnNames = new Set(productColumns.results.map(function (column) {
                return column.name;
            }));
            const productMigrations = [
                ["description", "ALTER TABLE products ADD COLUMN description TEXT NOT NULL DEFAULT ''"],
                ["category", "ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT ''"],
                ["is_slot", "ALTER TABLE products ADD COLUMN is_slot INTEGER NOT NULL DEFAULT 0"],
                ["order_limit", "ALTER TABLE products ADD COLUMN order_limit INTEGER"],
                ["image_key", "ALTER TABLE products ADD COLUMN image_key TEXT NOT NULL DEFAULT ''"],
                ["image_fit", "ALTER TABLE products ADD COLUMN image_fit TEXT NOT NULL DEFAULT 'cover'"],
                ["image_position", "ALTER TABLE products ADD COLUMN image_position TEXT NOT NULL DEFAULT 'center'"]
            ];

            for (const [columnName, migration] of productMigrations) {
                if (!productColumnNames.has(columnName)) {
                    await db.prepare(migration).run();
                }
            }

            await db.prepare(PRODUCT_SLOT_INSERT).run();
            await ensureEmptyProductSlots(db);
            await db.prepare(`
                UPDATE products
                SET order_limit = COALESCE(order_limit, 1),
                    category = 'baked'
                WHERE id = 'hardo-bread'
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

function normalizeImageFit(value) {
    return value === "contain" ? "contain" : "cover";
}

function normalizeImagePosition(value) {
    const allowedPositions = new Set(["center", "top", "bottom", "left", "right"]);
    return allowedPositions.has(value) ? value : "center";
}

function mediaUrlForKey(key) {
    if (!key) {
        return "";
    }

    return "/media/" + key.split("/").map(encodeURIComponent).join("/");
}

function imageUrlForRecord(record) {
    return record.image_key ? mediaUrlForKey(record.image_key) : (record.static_path || "");
}

function normalizeCustomerEmail(value) {
    return cleanText(value, 150).toLocaleLowerCase();
}

function normalizeCustomerName(value) {
    return cleanText(value, 100).toLocaleLowerCase();
}

function normalizeCustomerPhone(value) {
    return cleanText(value, 40).replace(/\D/g, "");
}

function normalizeHousehold(value) {
    return cleanText(value, 200).replace(/\s+/g, " ").toLocaleLowerCase();
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
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
        SELECT
            id, name, unit, price_cents, quantity, made_to_order, active,
            description, category, is_slot, order_limit,
            image_key, image_fit, image_position
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
            active: product.active === 1,
            description: product.description || "",
            category: product.category || "",
            isSlot: product.is_slot === 1,
            orderLimit: product.order_limit,
            imageUrl: mediaUrlForKey(product.image_key),
            imageFit: normalizeImageFit(product.image_fit),
            imagePosition: normalizeImagePosition(product.image_position)
        };
    });
}

async function handleInventory(db) {
    return jsonResponse({ products: await getProducts(db, true) });
}

async function getCarouselSlides(db, includeInactive = false) {
    const result = await db.prepare(`
        SELECT
            id, image_key, static_path, alt_text, sort_order, active,
            image_fit, image_position, source_product_id
        FROM carousel_images
        WHERE deleted = 0 ${includeInactive ? "" : "AND active = 1"}
        ORDER BY sort_order, created_at, id
    `).all();

    return result.results.map(function (slide) {
        return {
            id: slide.id,
            imageUrl: imageUrlForRecord(slide),
            altText: slide.alt_text,
            sortOrder: slide.sort_order,
            active: slide.active === 1,
            imageFit: normalizeImageFit(slide.image_fit),
            imagePosition: normalizeImagePosition(slide.image_position),
            sourceProductId: slide.source_product_id || ""
        };
    });
}

async function getSupportImages(db, includeInactive = false) {
    const result = await db.prepare(`
        SELECT
            id, image_key, static_path, alt_text, sort_order, active,
            image_fit, image_position, source_product_id
        FROM support_images
        WHERE deleted = 0 ${includeInactive ? "" : "AND active = 1"}
        ORDER BY sort_order, created_at, id
    `).all();

    return result.results.map(function (image) {
        return {
            id: image.id,
            imageUrl: imageUrlForRecord(image),
            altText: image.alt_text,
            sortOrder: image.sort_order,
            active: image.active === 1,
            imageFit: normalizeImageFit(image.image_fit),
            imagePosition: normalizeImagePosition(image.image_position),
            sourceProductId: image.source_product_id || ""
        };
    });
}

async function handleSiteContent(db) {
    const [carousel, supportImages] = await Promise.all([
        getCarouselSlides(db),
        getSupportImages(db)
    ]);
    return jsonResponse({ carousel, supportImages });
}

async function sendBrevoOrderReceipt(env, order) {
    if (!env.BREVO_API_KEY) {
        console.error("Brevo purchaser receipt skipped: BREVO_API_KEY is not configured.");
        return false;
    }

    const itemRows = order.items.map(function (item) {
        return `
            <tr>
                <td style="padding:8px;border-bottom:1px solid #dce8dc;">${escapeHtml(item.name)}</td>
                <td style="padding:8px;border-bottom:1px solid #dce8dc;text-align:center;">${item.quantity}</td>
                <td style="padding:8px;border-bottom:1px solid #dce8dc;text-align:right;">${escapeHtml(item.lineTotal)}</td>
            </tr>
        `;
    }).join("");
    const notesHtml = order.notes
        ? `<p><strong>Your notes:</strong> ${escapeHtml(order.notes)}</p>`
        : "";
    const htmlContent = `
        <!doctype html>
        <html>
            <body style="margin:0;padding:24px;background:#f5f7f2;color:#26362a;font-family:Arial,sans-serif;">
                <div style="max-width:620px;margin:0 auto;padding:28px;border:1px solid #dce8dc;border-radius:14px;background:white;">
                    <h1 style="margin-top:0;color:#285936;font-size:24px;">Soda Backyard Garden</h1>
                    <p>Hello ${escapeHtml(order.customerName)},</p>
                    <p>We received your order request. Please keep this email for your records.</p>
                    <p><strong>Order number:</strong> ${escapeHtml(order.orderNumber)}</p>
                    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                        <thead>
                            <tr style="background:#eef6ed;color:#285936;">
                                <th style="padding:8px;text-align:left;">Item</th>
                                <th style="padding:8px;text-align:center;">Quantity</th>
                                <th style="padding:8px;text-align:right;">Total</th>
                            </tr>
                        </thead>
                        <tbody>${itemRows}</tbody>
                    </table>
                    <p style="font-size:18px;"><strong>Estimated total: ${escapeHtml(order.total)}</strong></p>
                    ${notesHtml}
                    <h2 style="color:#285936;font-size:19px;">What happens next?</h2>
                    <ol>
                        <li>Send payment to <a href="mailto:marlenereid@hotmail.com">marlenereid@hotmail.com</a>.</li>
                        <li>Your order is confirmed once payment is received.</li>
                    </ol>
                    <p>Need to make a change? Reply to this email and include your order number.</p>
                </div>
            </body>
        </html>
    `;
    const textItems = order.items.map(function (item) {
        return item.quantity + " x " + item.name + " - " + item.lineTotal;
    }).join("\n");
    const textContent = [
        "Soda Backyard Garden",
        "",
        "Hello " + order.customerName + ",",
        "We received your order request.",
        "Order number: " + order.orderNumber,
        "",
        textItems,
        "",
        "Estimated total: " + order.total,
        order.notes ? "Your notes: " + order.notes : "",
        "",
        "Send payment to marlenereid@hotmail.com.",
        "Your order is confirmed once payment is received."
    ].filter(function (line) {
        return line !== "";
    }).join("\n");
    const brevoRequest = new Request("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "api-key": env.BREVO_API_KEY
        },
        body: JSON.stringify({
            sender: {
                name: "Soda Backyard Garden",
                email: "sodabackyardgarden@outlook.com"
            },
            to: [{
                name: order.customerName,
                email: order.email
            }],
            replyTo: {
                name: "Soda Backyard Garden",
                email: "sodabackyardgarden@outlook.com"
            },
            subject: "Your Soda Backyard Garden order " + order.orderNumber,
            htmlContent,
            textContent,
            tags: ["garden-order"]
        })
    });
    const response = env.BREVO_API
        ? await env.BREVO_API.fetch(brevoRequest)
        : await fetch(brevoRequest);

    if (!response.ok) {
        const details = (await response.text()).slice(0, 300);
        console.error("Brevo purchaser receipt failed:", response.status, details);
        return false;
    }

    return true;
}

async function sendBrevoOrderRefusal(env, order) {
    if (!env.BREVO_API_KEY || !order.email) {
        console.error("Brevo refusal notice skipped: email service or customer email is unavailable.");
        return false;
    }

    const firstName = order.customerName.trim().split(/\s+/)[0] || order.customerName;
    const hasOrderNumber = Boolean(order.orderNumber);
    const futureOrdersRefused = order.futureOrdersRefused === true;
    const refusalSentence = futureOrdersRefused
        ? "We are writing to let you know that your current order request has not been accepted and future order requests will not be accepted."
        : hasOrderNumber
            ? `We are writing to let you know that your order request <strong>${escapeHtml(order.orderNumber)}</strong> has not been accepted and will not be fulfilled.`
            : "We are writing to let you know that your order request has not been accepted and will not be fulfilled.";
    const htmlContent = `
        <!doctype html>
        <html>
            <body style="margin:0;padding:24px;background:#f5f7f2;color:#26362a;font-family:Arial,sans-serif;">
                <div style="max-width:620px;margin:0 auto;padding:28px;border:1px solid #dce8dc;border-radius:14px;background:white;">
                    <h1 style="margin-top:0;color:#285936;font-size:24px;">Soda Backyard Garden</h1>
                    <p>Hello ${escapeHtml(firstName)},</p>
                    <p>${refusalSentence}</p>
                    ${hasOrderNumber ? "<p>Any items held for this request have been returned to availability.</p>" : ""}
                    <p>If you already sent payment, please reply to this email so the next steps can be arranged.</p>
                    <p>Thank you,<br>Soda Backyard Garden</p>
                </div>
            </body>
        </html>
    `;
    const textContent = [
        "Soda Backyard Garden",
        "",
        "Hello " + firstName + ",",
        "",
        futureOrdersRefused
            ? "Your current order request has not been accepted and future order requests will not be accepted."
            : "Your order request" + (hasOrderNumber ? " " + order.orderNumber : "") + " has not been accepted and will not be fulfilled.",
        ...(hasOrderNumber ? ["Any items held for this request have been returned to availability."] : []),
        "",
        "If you already sent payment, please reply to this email so the next steps can be arranged.",
        "",
        "Thank you,",
        "Soda Backyard Garden"
    ].join("\n");
    const brevoRequest = new Request("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "api-key": env.BREVO_API_KEY
        },
        body: JSON.stringify({
            sender: {
                name: "Soda Backyard Garden",
                email: "sodabackyardgarden@outlook.com"
            },
            to: [{
                name: order.customerName,
                email: order.email
            }],
            replyTo: {
                name: "Soda Backyard Garden",
                email: "sodabackyardgarden@outlook.com"
            },
            subject: "Update about your Soda Backyard Garden order" + (hasOrderNumber ? " " + order.orderNumber : " request"),
            htmlContent,
            textContent,
            tags: ["garden-order-refused"]
        })
    });
    const response = env.BREVO_API
        ? await env.BREVO_API.fetch(brevoRequest)
        : await fetch(brevoRequest);

    if (!response.ok) {
        const details = (await response.text()).slice(0, 300);
        console.error("Brevo refusal notice failed:", response.status, details);
        return false;
    }

    return true;
}

async function findBlockedCustomer(db, customerName, email, phone, household) {
    const normalizedName = normalizeCustomerName(customerName);
    const normalizedEmail = normalizeCustomerEmail(email);
    const normalizedPhone = normalizeCustomerPhone(phone);
    const normalizedHousehold = normalizeHousehold(household);

    if (!normalizedName && !normalizedEmail && !normalizedPhone && !normalizedHousehold) {
        return null;
    }

    return db.prepare(`
        SELECT id, customer_name, email, phone, household, reason, created_at
        FROM blocked_customers
        WHERE (customer_name <> '' AND LOWER(TRIM(customer_name)) = ?)
           OR (email <> '' AND email = ?)
           OR (phone <> '' AND phone = ?)
           OR (household <> '' AND LOWER(TRIM(household)) = ?)
        ORDER BY created_at DESC
        LIMIT 1
    `).bind(normalizedName, normalizedEmail, normalizedPhone, normalizedHousehold).first();
}

async function blockCustomer(db, order) {
    const normalizedName = normalizeCustomerName(order.customerName);
    const normalizedEmail = normalizeCustomerEmail(order.email);
    const normalizedPhone = normalizeCustomerPhone(order.phone);
    const normalizedHousehold = normalizeHousehold(order.household);

    if (!normalizedName && !normalizedEmail && !normalizedPhone && !normalizedHousehold) {
        return false;
    }

    await db.batch([
        db.prepare(`
            DELETE FROM blocked_customers
            WHERE (customer_name <> '' AND LOWER(TRIM(customer_name)) = ?)
               OR (email <> '' AND email = ?)
               OR (phone <> '' AND phone = ?)
               OR (household <> '' AND LOWER(TRIM(household)) = ?)
        `).bind(normalizedName, normalizedEmail, normalizedPhone, normalizedHousehold),
        db.prepare(`
            INSERT INTO blocked_customers (
                id, customer_name, email, phone, household, reason
            ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
            crypto.randomUUID(),
            order.customerName,
            normalizedEmail,
            normalizedPhone,
            cleanText(order.household, 200).replace(/\s+/g, " "),
            cleanText(order.reason, 300) || (order.orderNumber
                ? "Blocked from order " + order.orderNumber
                : "Added manually by an administrator")
        )
    ]);

    return true;
}

async function createOrderRecord(body, db, options = {}) {
    const requireEmail = options.requireEmail === true;
    const requirePhone = options.requirePhone === true;
    const paymentReceived = options.paymentReceived === true;
    const source = cleanText(options.source || "online", 30);
    const customerName = cleanText(body.customerName, 100);
    const phone = cleanText(body.phone, 40);
    const email = cleanText(body.email, 150);
    const household = cleanText(body.household, 200).replace(/\s+/g, " ");
    const deliveryDay = cleanText(body.deliveryDay, 20);
    const notes = cleanText(body.notes, 1000);
    const allowedDeliveryDays = new Set([
        "Tuesday", "Wednesday", "Thursday", "Friday", "To be confirmed"
    ]);

    if (customerName.length < 2) {
        return jsonResponse({ error: "Please enter your full name." }, 400);
    }

    if (requirePhone && phone.replace(/\D/g, "").length < 7) {
        return jsonResponse({ error: "Please enter a valid phone number." }, 400);
    }

    if (phone && phone.replace(/\D/g, "").length < 7) {
        return jsonResponse({ error: "Please enter a valid phone number or leave it blank." }, 400);
    }

    if (requireEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return jsonResponse({ error: "Please enter a valid email address." }, 400);
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return jsonResponse({ error: "Please enter a valid email address or leave it blank." }, 400);
    }

    if (options.checkBlocked === true && await findBlockedCustomer(db, customerName, email, phone, household)) {
        try {
            await sendBrevoOrderRefusal(options.env || {}, {
                customerName,
                email,
                orderNumber: "",
                futureOrdersRefused: true
            });
        } catch (error) {
            console.error("Blocked-order refusal notice failed:", error);
        }

        return jsonResponse({
            error: "Your current order request has not been accepted, and future order requests will not be accepted."
        }, 403);
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

        if (product.orderLimit !== null && quantity > product.orderLimit) {
            return jsonResponse({
                error: product.name + " is limited to " + product.orderLimit + " per order."
            }, 400);
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
                id, order_number, customer_name, phone, email, household,
                delivery_day, notes, total_cents, status, paid_at, source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END, ?)
        `).bind(
            orderId,
            orderNumber,
            customerName,
            phone,
            email || null,
            household,
            deliveryDay,
            notes || null,
            totalCents,
            paymentReceived ? "confirmed" : "pending",
            paymentReceived ? 1 : 0,
            source || "online"
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

    const responseItems = requestedItems.map(function (item) {
        return {
            name: item.product.name,
            quantity: item.quantity,
            lineTotal: "$" + ((item.product.priceCents * item.quantity) / 100).toFixed(2)
        };
    });
    return {
        customerName,
        email,
        household,
        notes,
        orderNumber,
        total: "$" + (totalCents / 100).toFixed(2),
        items: responseItems,
        status: paymentReceived ? "confirmed" : "pending"
    };
}

async function handleOrder(request, db, env) {
    let body;

    try {
        body = await request.json();
    } catch (_error) {
        return jsonResponse({ error: "The order information was not valid." }, 400);
    }

    if (cleanText(body.website, 100)) {
        return jsonResponse({ orderNumber: "SBG-RECEIVED", total: "$0.00" });
    }

    const order = await createOrderRecord(body, db, {
        requireEmail: true,
        requirePhone: true,
        checkBlocked: true,
        env,
        source: "online"
    });

    if (order instanceof Response) {
        return order;
    }

    let customerEmailSent = false;

    try {
        customerEmailSent = await sendBrevoOrderReceipt(env, order);
    } catch (error) {
        console.error("Brevo purchaser receipt request failed:", error);
    }

    return jsonResponse({
        orderNumber: order.orderNumber,
        total: order.total,
        items: order.items,
        customerEmailSent
    }, 201);
}

async function handleAdminOrderCreate(request, db) {
    let body;

    try {
        body = await request.json();
    } catch (_error) {
        return jsonResponse({ error: "The offline order information was not valid." }, 400);
    }

    const allowedSources = new Set(["phone", "in-person", "other"]);
    const source = cleanText(body.source, 30);

    if (!allowedSources.has(source)) {
        return jsonResponse({ error: "Please select how the offline order was received." }, 400);
    }

    const order = await createOrderRecord(body, db, {
        paymentReceived: body.paymentReceived === true,
        requireEmail: false,
        requirePhone: false,
        source
    });

    if (order instanceof Response) {
        return order;
    }

    return jsonResponse({
        success: true,
        orderNumber: order.orderNumber,
        total: order.total,
        status: order.status
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
    const [result, adjustmentProducts, blockedCustomersResult] = await Promise.all([
        db.prepare(`
        SELECT
            orders.id,
            orders.order_number,
            orders.customer_name,
            orders.phone,
            orders.email,
            orders.household,
            orders.delivery_day,
            orders.notes,
            orders.total_cents,
            orders.status,
            orders.source,
            orders.created_at,
            orders.completed_at,
            order_items.id AS order_item_id,
            order_items.product_id,
            order_items.product_name,
            order_items.unit_price_cents,
            order_items.quantity,
            order_items.line_total_cents,
            products.quantity AS available_quantity,
            products.made_to_order
        FROM orders
        LEFT JOIN order_items ON order_items.order_id = orders.id
        LEFT JOIN products ON products.id = order_items.product_id
        ORDER BY orders.created_at DESC, order_items.id
        LIMIT 500
        `).all(),
        getProducts(db, true),
        db.prepare(`
            SELECT id, customer_name, email, phone, household, reason, created_at
            FROM blocked_customers
            ORDER BY created_at DESC
        `).all()
    ]);
    const orderMap = new Map();
    const blockedCustomers = blockedCustomersResult.results.map(function (customer) {
        return {
            id: customer.id,
            customerName: customer.customer_name,
            email: customer.email,
            phone: customer.phone,
            household: customer.household,
            reason: customer.reason,
            createdAt: customer.created_at
        };
    });

    result.results.forEach(function (row) {
        if (!orderMap.has(row.id)) {
            orderMap.set(row.id, {
                id: row.id,
                orderNumber: row.order_number,
                customerName: row.customer_name,
                phone: row.phone,
                email: row.email,
                household: row.household,
                deliveryDay: row.delivery_day,
                notes: row.notes,
                totalCents: row.total_cents,
                status: row.status,
                source: row.source || "online",
                createdAt: row.created_at,
                completedAt: row.completed_at || "",
                items: []
            });
        }

        if (row.product_name) {
            orderMap.get(row.id).items.push({
                id: row.order_item_id,
                productId: row.product_id,
                name: row.product_name,
                quantity: row.quantity,
                unitPriceCents: row.unit_price_cents,
                lineTotalCents: row.line_total_cents,
                availableQuantity: row.available_quantity,
                madeToOrder: row.made_to_order === 1
            });
        }
    });

    orderMap.forEach(function (order) {
        const orderName = normalizeCustomerName(order.customerName);
        const orderEmail = normalizeCustomerEmail(order.email);
        const orderPhone = normalizeCustomerPhone(order.phone);
        const orderHousehold = normalizeHousehold(order.household);
        order.customerBlocked = blockedCustomers.some(function (customer) {
            return (customer.customerName && normalizeCustomerName(customer.customerName) === orderName) ||
                (customer.email && customer.email === orderEmail) ||
                (customer.phone && customer.phone === orderPhone) ||
                (customer.household && normalizeHousehold(customer.household) === orderHousehold);
        });
    });

    return jsonResponse({
        orders: Array.from(orderMap.values()),
        blockedCustomers,
        adjustmentProducts: adjustmentProducts.filter(function (product) {
            return product.active && product.priceCents > 0;
        })
    });
}

async function handleAdminInventory(db) {
    const result = await db.prepare(`
        SELECT
            id, name, unit, price_cents, quantity, made_to_order, sort_order, active,
            description, category, is_slot, order_limit,
            image_key, image_fit, image_position
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
                active: product.active === 1,
                description: product.description || "",
                category: product.category || "",
                isSlot: product.is_slot === 1,
                orderLimit: product.order_limit,
                imageUrl: mediaUrlForKey(product.image_key),
                imageFit: normalizeImageFit(product.image_fit),
                imagePosition: normalizeImagePosition(product.image_position)
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

async function handleAdminSalesExport(db) {
    const results = await db.batch([
        db.prepare(`
            SELECT
                COALESCE(orders.paid_at, orders.created_at) AS paid_at,
                orders.order_number,
                orders.customer_name,
                orders.source,
                order_items.product_name,
                order_items.unit_price_cents,
                order_items.quantity,
                order_items.line_total_cents
            FROM order_items
            JOIN orders ON orders.id = order_items.order_id
            WHERE orders.status IN ('confirmed', 'completed')
            ORDER BY
                COALESCE(orders.paid_at, orders.created_at) DESC,
                orders.order_number,
                order_items.id
        `),
        db.prepare(`
            SELECT
                donation_number, donor_name, amount_cents, note,
                received_at, status, created_at
            FROM donations
            WHERE status <> 'cancelled'
            ORDER BY created_at DESC
        `)
    ]);
    const workbook = buildSalesWorkbook({
        exportedAt: new Date().toISOString(),
        sales: results[0].results.map(function (line) {
            return {
                paidAt: line.paid_at,
                orderNumber: line.order_number,
                customerName: line.customer_name,
                source: line.source || "online",
                productName: line.product_name,
                unitPriceCents: Number(line.unit_price_cents) || 0,
                quantity: Number(line.quantity) || 0,
                lineTotalCents: Number(line.line_total_cents) || 0
            };
        }),
        donations: results[1].results.map(function (donation) {
            return {
                referenceNumber: donation.donation_number,
                donorName: donation.donor_name,
                amountCents: Number(donation.amount_cents) || 0,
                note: donation.note,
                receivedAt: donation.received_at,
                status: donation.status,
                createdAt: donation.created_at
            };
        })
    });
    const filename = "Soda-Backyard-Garden-Finances-" + torontoDateKey(new Date()) + ".xlsx";

    return new Response(workbook, {
        headers: {
            "Cache-Control": "no-store",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }
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

    const existingResult = await db.prepare("SELECT id, is_slot FROM products").all();
    const existingProducts = new Map(existingResult.results.map(function (product) {
        return [product.id, product];
    }));
    const seenIds = new Set();
    const updates = [];

    for (const submitted of body.products) {
        const id = cleanText(submitted.id, 100);
        const name = cleanText(submitted.name, 100);
        const description = cleanText(submitted.description, 500);
        const unit = cleanText(submitted.unit, 30).toLowerCase();
        const priceCents = Number(submitted.priceCents);
        const madeToOrder = submitted.madeToOrder === true;
        const active = submitted.active === true;
        const quantity = madeToOrder ? null : Number(submitted.quantity);
        const orderLimit = submitted.orderLimit === null || submitted.orderLimit === ""
            ? null
            : Number(submitted.orderLimit);
        const imageFit = normalizeImageFit(submitted.imageFit);
        const imagePosition = normalizeImagePosition(submitted.imagePosition);

        const existingProduct = existingProducts.get(id);

        if (!existingProduct || seenIds.has(id)) {
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

        if (
            orderLimit !== null &&
            (!Number.isInteger(orderLimit) || orderLimit < 1 || orderLimit > 50)
        ) {
            return jsonResponse({
                error: "Enter a maximum per order between 1 and 50 for " + name + ", or leave it blank."
            }, 400);
        }

        if (active && priceCents === 0) {
            return jsonResponse({ error: name + " needs a price before it can be available to order." }, 400);
        }

        if (
            active &&
            existingProduct.is_slot === 1 &&
            name.startsWith("New Product Slot")
        ) {
            return jsonResponse({
                error: "Complete the product name for " + name + " before making it available."
            }, 400);
        }

        seenIds.add(id);
        updates.push(
            db.prepare(`
                UPDATE products
                SET name = ?, unit = ?, price_cents = ?, quantity = ?,
                    made_to_order = ?, active = ?, description = ?, order_limit = ?,
                    image_fit = ?, image_position = ?
                WHERE id = ?
            `).bind(
                name,
                unit,
                priceCents,
                quantity,
                madeToOrder ? 1 : 0,
                active ? 1 : 0,
                description,
                orderLimit,
                imageFit,
                imagePosition,
                id
            )
        );
    }

    await db.batch(updates);
    await ensureEmptyProductSlots(db);
    return jsonResponse({ success: true });
}

function imageStorageUnavailable() {
    return jsonResponse({
        error: "Image storage is not configured yet. Add the MEDIA_BUCKET R2 binding in Cloudflare."
    }, 503);
}

function imageExtension(contentType) {
    const extensions = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp"
    };
    return extensions[contentType] || "";
}

async function storeUploadedImage(request, bucket, folder) {
    const formData = await request.formData();
    const image = formData.get("image");
    const contentType = image && cleanText(image.type, 50).toLowerCase();
    const extension = imageExtension(contentType);

    if (!image || typeof image.arrayBuffer !== "function" || !extension) {
        throw new Error("Choose a JPG, PNG, or WebP image.");
    }

    if (image.size < 1 || image.size > 6 * 1024 * 1024) {
        throw new Error("The uploaded image must be smaller than 6 MB.");
    }

    const key = folder + "/" + crypto.randomUUID() + "." + extension;
    await bucket.put(key, await image.arrayBuffer(), {
        httpMetadata: {
            contentType,
            cacheControl: "public, max-age=31536000, immutable"
        }
    });

    return { key, formData };
}

async function deleteMediaIfUnused(db, bucket, key) {
    if (!bucket || !key) {
        return;
    }

    const usage = await db.prepare(`
        SELECT
            (SELECT COUNT(*) FROM products WHERE image_key = ?) +
            (SELECT COUNT(*) FROM carousel_images WHERE image_key = ? AND deleted = 0) +
            (SELECT COUNT(*) FROM support_images WHERE image_key = ? AND deleted = 0)
            AS reference_count
    `).bind(key, key, key).first();

    if (!usage || Number(usage.reference_count) === 0) {
        await bucket.delete(key);
    }
}

async function handleMedia(request, bucket, encodedKey) {
    if (!bucket) {
        return new Response("Image storage is not configured.", { status: 503 });
    }

    let key;

    try {
        key = decodeURIComponent(encodedKey);
    } catch (_error) {
        return new Response("Invalid image path.", { status: 400 });
    }

    if (!key || key.includes("..")) {
        return new Response("Invalid image path.", { status: 400 });
    }

    const object = await bucket.get(key);

    if (!object) {
        return new Response("Image not found.", { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("ETag", object.httpEtag);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(request.method === "HEAD" ? null : object.body, { headers });
}

async function handleAdminProductImageUpload(request, db, bucket, productId) {
    if (!bucket) {
        return imageStorageUnavailable();
    }

    const product = await db.prepare(`
        SELECT id, name, image_key
        FROM products
        WHERE id = ?
    `).bind(productId).first();

    if (!product) {
        return jsonResponse({ error: "That product was not found." }, 404);
    }

    let stored;

    try {
        stored = await storeUploadedImage(
            request,
            bucket,
            "products/" + productId.replace(/[^a-z0-9-]/gi, "-")
        );
    } catch (error) {
        return jsonResponse({ error: error.message || "The product image could not be uploaded." }, 400);
    }

    const imageFit = normalizeImageFit(cleanText(stored.formData.get("imageFit"), 20));
    const imagePosition = normalizeImagePosition(cleanText(stored.formData.get("imagePosition"), 20));

    try {
        await db.batch([
            db.prepare(`
                UPDATE products
                SET image_key = ?, image_fit = ?, image_position = ?
                WHERE id = ?
            `).bind(stored.key, imageFit, imagePosition, productId),
            db.prepare(`
                UPDATE carousel_images
                SET image_key = ?
                WHERE source_product_id = ? AND deleted = 0
            `).bind(stored.key, productId),
            db.prepare(`
                UPDATE support_images
                SET image_key = ?
                WHERE source_product_id = ? AND deleted = 0
            `).bind(stored.key, productId)
        ]);
    } catch (error) {
        await bucket.delete(stored.key);
        throw error;
    }

    await deleteMediaIfUnused(db, bucket, product.image_key);
    return jsonResponse({
        success: true,
        imageUrl: mediaUrlForKey(stored.key),
        message: "Image saved for " + product.name + "."
    });
}

async function handleAdminProductImageDelete(db, bucket, productId) {
    const product = await db.prepare(`
        SELECT id, name, image_key
        FROM products
        WHERE id = ?
    `).bind(productId).first();

    if (!product) {
        return jsonResponse({ error: "That product was not found." }, 404);
    }

    await db.prepare("UPDATE products SET image_key = '' WHERE id = ?")
        .bind(productId)
        .run();
    await deleteMediaIfUnused(db, bucket, product.image_key);
    return jsonResponse({ success: true, message: "The managed image was removed from " + product.name + "." });
}

async function handleAdminCarousel(db) {
    const productImages = await db.prepare(`
        SELECT id, name, image_key
        FROM products
        WHERE image_key <> '' AND category <> 'retired'
        ORDER BY name
    `).all();

    return jsonResponse({
        carousel: await getCarouselSlides(db, true),
        productImages: productImages.results.map(function (product) {
            return {
                id: product.id,
                name: product.name,
                imageUrl: mediaUrlForKey(product.image_key)
            };
        })
    });
}

async function handleAdminCarouselUpload(request, db, bucket) {
    if (!bucket) {
        return imageStorageUnavailable();
    }

    let stored;

    try {
        stored = await storeUploadedImage(request, bucket, "carousel");
    } catch (error) {
        return jsonResponse({ error: error.message || "The carousel image could not be uploaded." }, 400);
    }

    const altText = cleanText(stored.formData.get("altText"), 160);

    if (altText.length < 2) {
        await bucket.delete(stored.key);
        return jsonResponse({ error: "Add a short image description for accessibility." }, 400);
    }

    const imageFit = normalizeImageFit(cleanText(stored.formData.get("imageFit"), 20));
    const imagePosition = normalizeImagePosition(cleanText(stored.formData.get("imagePosition"), 20));
    const maximum = await db.prepare(`
        SELECT COALESCE(MAX(sort_order), 0) AS maximum
        FROM carousel_images
        WHERE deleted = 0
    `).first();
    const id = "carousel-" + crypto.randomUUID();

    try {
        await db.prepare(`
            INSERT INTO carousel_images (
                id, image_key, alt_text, sort_order, active, image_fit, image_position
            ) VALUES (?, ?, ?, ?, 1, ?, ?)
        `).bind(
            id,
            stored.key,
            altText,
            Number(maximum && maximum.maximum || 0) + 10,
            imageFit,
            imagePosition
        ).run();
    } catch (error) {
        await bucket.delete(stored.key);
        throw error;
    }

    return jsonResponse({ success: true, message: "Carousel image uploaded." }, 201);
}

async function handleAdminCarouselProductImage(request, db) {
    let body;

    try {
        body = await request.json();
    } catch (_error) {
        return jsonResponse({ error: "Choose a product image to add." }, 400);
    }

    const productId = cleanText(body.productId, 100);
    const product = await db.prepare(`
        SELECT id, name, image_key
        FROM products
        WHERE id = ? AND image_key <> ''
    `).bind(productId).first();

    if (!product) {
        return jsonResponse({ error: "That product does not have a managed image." }, 404);
    }

    const maximum = await db.prepare(`
        SELECT COALESCE(MAX(sort_order), 0) AS maximum
        FROM carousel_images
        WHERE deleted = 0
    `).first();

    await db.prepare(`
        INSERT INTO carousel_images (
            id, image_key, alt_text, sort_order, active,
            image_fit, image_position, source_product_id
        ) VALUES (?, ?, ?, ?, 1, 'cover', 'center', ?)
    `).bind(
        "carousel-" + crypto.randomUUID(),
        product.image_key,
        product.name,
        Number(maximum && maximum.maximum || 0) + 10,
        product.id
    ).run();

    return jsonResponse({ success: true, message: product.name + " was added to the carousel." }, 201);
}

async function handleAdminCarouselUpdate(request, db) {
    let body;

    try {
        body = await request.json();
    } catch (_error) {
        return jsonResponse({ error: "The carousel changes were not valid." }, 400);
    }

    if (!Array.isArray(body.carousel) || body.carousel.length === 0) {
        return jsonResponse({ error: "Keep at least one carousel image." }, 400);
    }

    const existing = await db.prepare(`
        SELECT id
        FROM carousel_images
        WHERE deleted = 0
    `).all();
    const existingIds = new Set(existing.results.map(function (slide) { return slide.id; }));
    const seenIds = new Set();
    const updates = [];
    let activeCount = 0;

    for (let index = 0; index < body.carousel.length; index += 1) {
        const slide = body.carousel[index];
        const id = cleanText(slide.id, 100);
        const altText = cleanText(slide.altText, 160);

        if (!existingIds.has(id) || seenIds.has(id)) {
            return jsonResponse({
                error: "One of the carousel images was not recognized. Refresh and try again."
            }, 400);
        }

        if (altText.length < 2) {
            return jsonResponse({ error: "Every carousel image needs a short description." }, 400);
        }

        const active = slide.active === true;
        activeCount += active ? 1 : 0;
        seenIds.add(id);
        updates.push(db.prepare(`
            UPDATE carousel_images
            SET alt_text = ?, sort_order = ?, active = ?, image_fit = ?, image_position = ?
            WHERE id = ? AND deleted = 0
        `).bind(
            altText,
            (index + 1) * 10,
            active ? 1 : 0,
            normalizeImageFit(slide.imageFit),
            normalizeImagePosition(slide.imagePosition),
            id
        ));
    }

    if (seenIds.size !== existingIds.size) {
        return jsonResponse({ error: "The carousel changed elsewhere. Refresh and try again." }, 409);
    }

    if (activeCount === 0) {
        return jsonResponse({ error: "Keep at least one carousel image visible." }, 400);
    }

    await db.batch(updates);
    return jsonResponse({ success: true, message: "Home page carousel saved." });
}

async function handleAdminCarouselDelete(db, bucket, carouselId) {
    const slide = await db.prepare(`
        SELECT id, image_key, active
        FROM carousel_images
        WHERE id = ? AND deleted = 0
    `).bind(carouselId).first();

    if (!slide) {
        return jsonResponse({ error: "That carousel image was not found." }, 404);
    }

    if (slide.active === 1) {
        const activeCount = await db.prepare(`
            SELECT COUNT(*) AS count
            FROM carousel_images
            WHERE deleted = 0 AND active = 1
        `).first();

        if (Number(activeCount && activeCount.count) <= 1) {
            return jsonResponse({ error: "Keep at least one carousel image visible." }, 400);
        }
    }

    await db.prepare(`
        UPDATE carousel_images
        SET deleted = 1, active = 0
        WHERE id = ?
    `).bind(carouselId).run();
    await deleteMediaIfUnused(db, bucket, slide.image_key);
    return jsonResponse({ success: true, message: "Carousel image removed." });
}

async function handleAdminSupportImages(db) {
    const productImages = await db.prepare(`
        SELECT id, name, image_key
        FROM products
        WHERE image_key <> '' AND category <> 'retired'
        ORDER BY name
    `).all();

    return jsonResponse({
        supportImages: await getSupportImages(db, true),
        productImages: productImages.results.map(function (product) {
            return {
                id: product.id,
                name: product.name,
                imageUrl: mediaUrlForKey(product.image_key)
            };
        })
    });
}

async function handleAdminSupportImageUpload(request, db, bucket) {
    if (!bucket) {
        return imageStorageUnavailable();
    }

    let stored;

    try {
        stored = await storeUploadedImage(request, bucket, "support");
    } catch (error) {
        return jsonResponse({ error: error.message || "The Support page image could not be uploaded." }, 400);
    }

    const altText = cleanText(stored.formData.get("altText"), 160);

    if (altText.length < 2) {
        await bucket.delete(stored.key);
        return jsonResponse({ error: "Add a short image description for accessibility." }, 400);
    }

    const imageFit = normalizeImageFit(cleanText(stored.formData.get("imageFit"), 20));
    const imagePosition = normalizeImagePosition(cleanText(stored.formData.get("imagePosition"), 20));
    const maximum = await db.prepare(`
        SELECT COALESCE(MAX(sort_order), 0) AS maximum
        FROM support_images
        WHERE deleted = 0
    `).first();
    const id = "support-" + crypto.randomUUID();

    try {
        await db.prepare(`
            INSERT INTO support_images (
                id, image_key, alt_text, sort_order, active, image_fit, image_position
            ) VALUES (?, ?, ?, ?, 1, ?, ?)
        `).bind(
            id,
            stored.key,
            altText,
            Number(maximum && maximum.maximum || 0) + 10,
            imageFit,
            imagePosition
        ).run();
    } catch (error) {
        await bucket.delete(stored.key);
        throw error;
    }

    return jsonResponse({ success: true, message: "Support page image uploaded." }, 201);
}

async function handleAdminSupportProductImage(request, db) {
    let body;

    try {
        body = await request.json();
    } catch (_error) {
        return jsonResponse({ error: "Choose a product image to add." }, 400);
    }

    const productId = cleanText(body.productId, 100);
    const product = await db.prepare(`
        SELECT id, name, image_key
        FROM products
        WHERE id = ? AND image_key <> ''
    `).bind(productId).first();

    if (!product) {
        return jsonResponse({ error: "That product does not have a managed image." }, 404);
    }

    const maximum = await db.prepare(`
        SELECT COALESCE(MAX(sort_order), 0) AS maximum
        FROM support_images
        WHERE deleted = 0
    `).first();

    await db.prepare(`
        INSERT INTO support_images (
            id, image_key, alt_text, sort_order, active,
            image_fit, image_position, source_product_id
        ) VALUES (?, ?, ?, ?, 1, 'cover', 'center', ?)
    `).bind(
        "support-" + crypto.randomUUID(),
        product.image_key,
        product.name,
        Number(maximum && maximum.maximum || 0) + 10,
        product.id
    ).run();

    return jsonResponse({ success: true, message: product.name + " was added to the Support page." }, 201);
}

async function handleAdminSupportImagesUpdate(request, db) {
    let body;

    try {
        body = await request.json();
    } catch (_error) {
        return jsonResponse({ error: "The Support page image changes were not valid." }, 400);
    }

    if (!Array.isArray(body.supportImages) || body.supportImages.length === 0) {
        return jsonResponse({ error: "Keep at least one Support page image." }, 400);
    }

    const existing = await db.prepare(`
        SELECT id
        FROM support_images
        WHERE deleted = 0
    `).all();
    const existingIds = new Set(existing.results.map(function (image) { return image.id; }));
    const seenIds = new Set();
    const updates = [];
    let activeCount = 0;

    for (let index = 0; index < body.supportImages.length; index += 1) {
        const image = body.supportImages[index];
        const id = cleanText(image.id, 100);
        const altText = cleanText(image.altText, 160);

        if (!existingIds.has(id) || seenIds.has(id)) {
            return jsonResponse({
                error: "One of the Support page images was not recognized. Refresh and try again."
            }, 400);
        }

        if (altText.length < 2) {
            return jsonResponse({ error: "Every Support page image needs a short description." }, 400);
        }

        const active = image.active === true;
        activeCount += active ? 1 : 0;
        seenIds.add(id);
        updates.push(db.prepare(`
            UPDATE support_images
            SET alt_text = ?, sort_order = ?, active = ?, image_fit = ?, image_position = ?
            WHERE id = ? AND deleted = 0
        `).bind(
            altText,
            (index + 1) * 10,
            active ? 1 : 0,
            normalizeImageFit(image.imageFit),
            normalizeImagePosition(image.imagePosition),
            id
        ));
    }

    if (seenIds.size !== existingIds.size) {
        return jsonResponse({ error: "The Support page images changed elsewhere. Refresh and try again." }, 409);
    }

    if (activeCount === 0) {
        return jsonResponse({ error: "Keep at least one Support page image visible." }, 400);
    }

    await db.batch(updates);
    return jsonResponse({ success: true, message: "Support the Garden images saved." });
}

async function handleAdminSupportImageDelete(db, bucket, imageId) {
    const image = await db.prepare(`
        SELECT id, image_key, active
        FROM support_images
        WHERE id = ? AND deleted = 0
    `).bind(imageId).first();

    if (!image) {
        return jsonResponse({ error: "That Support page image was not found." }, 404);
    }

    if (image.active === 1) {
        const activeCount = await db.prepare(`
            SELECT COUNT(*) AS count
            FROM support_images
            WHERE deleted = 0 AND active = 1
        `).first();

        if (Number(activeCount && activeCount.count) <= 1) {
            return jsonResponse({ error: "Keep at least one Support page image visible." }, 400);
        }
    }

    await db.prepare(`
        UPDATE support_images
        SET deleted = 1, active = 0
        WHERE id = ?
    `).bind(imageId).run();
    await deleteMediaIfUnused(db, bucket, image.image_key);
    return jsonResponse({ success: true, message: "Support page image removed." });
}

async function handleAdminOrderAction(request, db, env, orderId) {
    let body;

    try {
        body = await request.json();
    } catch (_error) {
        return jsonResponse({ error: "The order action was not valid." }, 400);
    }

    const action = cleanText(body.action, 20);
    let result;

    if (action === "refuse" || action === "refuse-block" || action === "block") {
        const order = await db.prepare(`
            SELECT id, order_number, customer_name, phone, email, household, status
            FROM orders
            WHERE id = ?
        `).bind(orderId).first();

        if (!order) {
            return jsonResponse({ error: "That order could not be found." }, 404);
        }

        const customer = {
            customerName: order.customer_name,
            email: order.email || "",
            phone: order.phone || "",
            household: order.household || "",
            orderNumber: order.order_number
        };

        if (action === "block") {
            if (!(await blockCustomer(db, customer))) {
                return jsonResponse({
                    error: "This order does not have an email address or phone number to block."
                }, 400);
            }

            return jsonResponse({
                success: true,
                blocked: true,
                message: "Future website orders matching this customer name, email address, phone number, or address/household are now blocked."
            });
        }

        result = await db.prepare(`
            UPDATE orders
            SET status = 'refused'
            WHERE id = ? AND status IN ('pending', 'confirmed')
        `).bind(orderId).run();

        if (!result.meta || result.meta.changes < 1) {
            return jsonResponse({
                error: "The order has already changed status. Refresh the order list and try again."
            }, 409);
        }

        let blocked = false;

        if (action === "refuse-block") {
            blocked = await blockCustomer(db, customer);
            customer.futureOrdersRefused = blocked;
        }

        let emailSent = false;

        try {
            emailSent = await sendBrevoOrderRefusal(env, customer);
        } catch (error) {
            console.error("Brevo refusal notice request failed:", error);
        }

        const messageParts = ["Order refused and reserved stock returned."];

        if (blocked) {
            messageParts.push("Future website orders matching this customer are blocked.");
        }

        messageParts.push(emailSent
            ? "The customer refusal email was sent."
            : "The automatic email was not sent; use Email Refusal on the order card.");

        return jsonResponse({
            success: true,
            status: "refused",
            blocked,
            emailSent,
            message: messageParts.join(" ")
        });
    }

    if (action === "confirm") {
        result = await db.prepare(`
            UPDATE orders
            SET status = 'confirmed', paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP)
            WHERE id = ? AND status = 'pending'
        `).bind(orderId).run();
    } else if (action === "complete") {
        result = await db.prepare(`
            UPDATE orders
            SET status = 'completed', completed_at = CURRENT_TIMESTAMP
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

async function handleAdminBlockedCustomerCreate(request, db) {
    let body;

    try {
        body = await request.json();
    } catch (_error) {
        return jsonResponse({ error: "The blocked customer information was not valid." }, 400);
    }

    const customerName = cleanText(body.customerName, 100);
    const email = cleanText(body.email, 150);
    const phone = cleanText(body.phone, 40);
    const household = cleanText(body.household, 200).replace(/\s+/g, " ");
    const reason = cleanText(body.reason, 300);

    if (!customerName && !email && !phone && !household) {
        return jsonResponse({ error: "Enter at least a customer name, email address, phone number, or address/household." }, 400);
    }

    if (customerName && customerName.length < 2) {
        return jsonResponse({ error: "Enter at least two characters for the customer name." }, 400);
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return jsonResponse({ error: "Enter a valid email address or leave it blank." }, 400);
    }

    if (phone && normalizeCustomerPhone(phone).length < 7) {
        return jsonResponse({ error: "Enter a valid phone number or leave it blank." }, 400);
    }

    if (household && household.length < 3) {
        return jsonResponse({ error: "Enter at least three characters for the address/household or leave it blank." }, 400);
    }

    const blocked = await blockCustomer(db, {
        customerName,
        email,
        phone,
        household,
        reason
    });

    if (!blocked) {
        return jsonResponse({ error: "The customer could not be blocked." }, 400);
    }

    return jsonResponse({
        success: true,
        message: "Customer added to the blocked list. Matching website orders will now be refused."
    }, 201);
}

async function handleAdminBlockedCustomerDelete(db, blockedCustomerId) {
    const result = await db.prepare(`
        DELETE FROM blocked_customers
        WHERE id = ?
    `).bind(blockedCustomerId).run();

    if (!result.meta || result.meta.changes < 1) {
        return jsonResponse({ error: "That blocked customer could not be found." }, 404);
    }

    return jsonResponse({
        success: true,
        message: "Customer unblocked. Future website orders will be accepted normally."
    });
}

async function handleAdminOrderItemsUpdate(request, db, orderId) {
    let body;

    try {
        body = await request.json();
    } catch (_error) {
        return jsonResponse({ error: "The item changes were not valid." }, 400);
    }

    if (!Array.isArray(body.items) ||
        (body.additions !== undefined && !Array.isArray(body.additions))) {
        return jsonResponse({ error: "The item changes were not valid." }, 400);
    }

    const order = await db.prepare(`
        SELECT id, status
        FROM orders
        WHERE id = ?
    `).bind(orderId).first();

    if (!order) {
        return jsonResponse({ error: "That order was not found." }, 404);
    }

    if (!new Set(["pending", "confirmed"]).has(order.status)) {
        return jsonResponse({
            error: "Only pending or confirmed orders can have items adjusted."
        }, 409);
    }

    const currentResult = await db.prepare(`
        SELECT id, product_id, product_name, quantity
        FROM order_items
        WHERE order_id = ?
    `).bind(orderId).all();
    const currentItems = new Map(currentResult.results.map(function (item) {
        return [String(item.id), item];
    }));
    const seenIds = new Set();
    const changes = [];

    for (const submitted of body.items) {
        const itemId = String(submitted.id || "");
        const quantity = Number(submitted.quantity);
        const current = currentItems.get(itemId);

        if (!current || seenIds.has(itemId) || !Number.isInteger(quantity)) {
            return jsonResponse({ error: "One of the item changes was not valid." }, 400);
        }

        if (quantity < 0 || quantity > 50) {
            return jsonResponse({
                error: current.product_name + " must have a quantity between 0 and 50."
            }, 400);
        }

        seenIds.add(itemId);

        if (quantity !== current.quantity) {
            changes.push({ id: itemId, quantity });
        }
    }

    const submittedAdditions = body.additions || [];
    const products = await getProducts(db, true);
    const productMap = new Map(products.map(function (product) {
        return [product.id, product];
    }));
    const existingProductIds = new Set(currentResult.results.map(function (item) {
        return item.product_id;
    }));
    const seenProductIds = new Set();
    const additions = [];

    for (const submitted of submittedAdditions) {
        const productId = cleanText(submitted.productId, 100);
        const quantity = Number(submitted.quantity);
        const product = productMap.get(productId);

        if (!product || !product.active || product.priceCents <= 0 ||
            existingProductIds.has(productId) || seenProductIds.has(productId) ||
            !Number.isInteger(quantity)) {
            return jsonResponse({ error: "One of the products being added was not valid." }, 400);
        }

        if (quantity < 1 || quantity > 50) {
            return jsonResponse({
                error: product.name + " must have a quantity between 1 and 50."
            }, 400);
        }

        seenProductIds.add(productId);
        additions.push({ product, quantity });
    }

    if (changes.length === 0 && additions.length === 0) {
        return jsonResponse({
            error: "Change at least one quantity or add a product before saving."
        }, 400);
    }

    const statements = changes.map(function (change) {
        if (change.quantity === 0) {
            return db.prepare(`
                DELETE FROM order_items
                WHERE id = ? AND order_id = ?
            `).bind(change.id, orderId);
        }

        return db.prepare(`
            UPDATE order_items
            SET quantity = ?, line_total_cents = unit_price_cents * ?
            WHERE id = ? AND order_id = ?
        `).bind(change.quantity, change.quantity, change.id, orderId);
    });

    additions.forEach(function (addition) {
        statements.push(db.prepare(`
            INSERT INTO order_items (
                order_id, product_id, product_name,
                unit_price_cents, quantity, line_total_cents
            ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
            orderId,
            addition.product.id,
            addition.product.name,
            addition.product.priceCents,
            addition.quantity,
            addition.product.priceCents * addition.quantity
        ));
    });

    statements.push(
        db.prepare(`
            UPDATE orders
            SET total_cents = COALESCE((
                    SELECT SUM(line_total_cents)
                    FROM order_items
                    WHERE order_id = ?
                ), 0),
                status = CASE
                    WHEN EXISTS (
                        SELECT 1 FROM order_items WHERE order_id = ?
                    ) THEN status
                    ELSE 'cancelled'
                END
            WHERE id = ? AND status IN ('pending', 'confirmed')
        `).bind(orderId, orderId, orderId)
    );

    try {
        await db.batch(statements);
    } catch (error) {
        if (String(error).includes("INSUFFICIENT_STOCK")) {
            return jsonResponse({
                error: "There is not enough available inventory for that increase. Refresh the order and check Inventory before trying again."
            }, 409);
        }

        console.error("Order item adjustment failed", error);
        return jsonResponse({ error: "The item changes could not be saved." }, 500);
    }

    const updatedOrder = await db.prepare(`
        SELECT total_cents, status
        FROM orders
        WHERE id = ?
    `).bind(orderId).first();

    return jsonResponse({
        success: true,
        totalCents: updatedOrder.total_cents,
        status: updatedOrder.status
    });
}

async function handleAdminOrderDelete(db, orderId) {
    const results = await db.batch([
        db.prepare(`
            DELETE FROM order_items
            WHERE order_id IN (
                SELECT id FROM orders WHERE id = ? AND status = 'cancelled'
            )
        `).bind(orderId),
        db.prepare(`
            DELETE FROM orders
            WHERE id = ? AND status = 'cancelled'
        `).bind(orderId)
    ]);
    const result = results[1];

    if (!result.meta || result.meta.changes < 1) {
        return jsonResponse({
            error: "Only cancelled orders can be deleted. Refresh the order list and try again."
        }, 409);
    }

    return jsonResponse({ success: true });
}

async function handleAdminCancelledOrdersDelete(db) {
    const results = await db.batch([
        db.prepare(`
            DELETE FROM order_items
            WHERE order_id IN (
                SELECT id FROM orders WHERE status = 'cancelled'
            )
        `),
        db.prepare(`
            DELETE FROM orders
            WHERE status = 'cancelled'
        `)
    ]);
    const result = results[1];

    return jsonResponse({
        success: true,
        deletedCount: result.meta ? result.meta.changes : 0
    });
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (
            url.pathname.startsWith("/media/") &&
            (request.method === "GET" || request.method === "HEAD")
        ) {
            return handleMedia(request, env.MEDIA_BUCKET, url.pathname.slice("/media/".length));
        }

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

            if (url.pathname === "/api/site-content" && request.method === "GET") {
                return handleSiteContent(env.DB);
            }

            if (url.pathname === "/api/orders" && request.method === "POST") {
                return handleOrder(request, env.DB, env);
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

                if (url.pathname === "/api/admin/orders" && request.method === "POST") {
                    return handleAdminOrderCreate(request, env.DB);
                }

                if (url.pathname === "/api/admin/orders/cancelled" && request.method === "DELETE") {
                    return handleAdminCancelledOrdersDelete(env.DB);
                }

                if (url.pathname === "/api/admin/inventory" && request.method === "GET") {
                    return handleAdminInventory(env.DB);
                }

                if (url.pathname === "/api/admin/inventory" && request.method === "PUT") {
                    return handleAdminInventoryUpdate(request, env.DB);
                }

                const productImageMatch = url.pathname.match(/^\/api\/admin\/products\/([^/]+)\/image$/);

                if (productImageMatch && request.method === "POST") {
                    return handleAdminProductImageUpload(
                        request,
                        env.DB,
                        env.MEDIA_BUCKET,
                        decodeURIComponent(productImageMatch[1])
                    );
                }

                if (productImageMatch && request.method === "DELETE") {
                    return handleAdminProductImageDelete(
                        env.DB,
                        env.MEDIA_BUCKET,
                        decodeURIComponent(productImageMatch[1])
                    );
                }

                if (url.pathname === "/api/admin/carousel" && request.method === "GET") {
                    return handleAdminCarousel(env.DB);
                }

                if (url.pathname === "/api/admin/carousel" && request.method === "PUT") {
                    return handleAdminCarouselUpdate(request, env.DB);
                }

                if (url.pathname === "/api/admin/carousel/images" && request.method === "POST") {
                    return handleAdminCarouselUpload(request, env.DB, env.MEDIA_BUCKET);
                }

                if (url.pathname === "/api/admin/carousel/product-image" && request.method === "POST") {
                    return handleAdminCarouselProductImage(request, env.DB);
                }

                const carouselMatch = url.pathname.match(/^\/api\/admin\/carousel\/([^/]+)$/);

                if (carouselMatch && request.method === "DELETE") {
                    return handleAdminCarouselDelete(
                        env.DB,
                        env.MEDIA_BUCKET,
                        decodeURIComponent(carouselMatch[1])
                    );
                }

                if (url.pathname === "/api/admin/support-images" && request.method === "GET") {
                    return handleAdminSupportImages(env.DB);
                }

                if (url.pathname === "/api/admin/support-images" && request.method === "PUT") {
                    return handleAdminSupportImagesUpdate(request, env.DB);
                }

                if (url.pathname === "/api/admin/support-images/upload" && request.method === "POST") {
                    return handleAdminSupportImageUpload(request, env.DB, env.MEDIA_BUCKET);
                }

                if (url.pathname === "/api/admin/support-images/product-image" && request.method === "POST") {
                    return handleAdminSupportProductImage(request, env.DB);
                }

                const supportImageMatch = url.pathname.match(/^\/api\/admin\/support-images\/([^/]+)$/);

                if (supportImageMatch && request.method === "DELETE") {
                    return handleAdminSupportImageDelete(
                        env.DB,
                        env.MEDIA_BUCKET,
                        decodeURIComponent(supportImageMatch[1])
                    );
                }

                if (url.pathname === "/api/admin/sales" && request.method === "GET") {
                    return handleAdminSales(env.DB);
                }

                if (url.pathname === "/api/admin/sales/export" && request.method === "GET") {
                    return handleAdminSalesExport(env.DB);
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
                    return handleAdminOrderAction(request, env.DB, env, orderActionMatch[1]);
                }

                const blockedCustomerMatch = url.pathname.match(/^\/api\/admin\/blocked-customers\/([^/]+)$/);

                if (url.pathname === "/api/admin/blocked-customers" && request.method === "POST") {
                    return handleAdminBlockedCustomerCreate(request, env.DB);
                }

                if (blockedCustomerMatch && request.method === "DELETE") {
                    return handleAdminBlockedCustomerDelete(env.DB, blockedCustomerMatch[1]);
                }

                const orderItemsMatch = url.pathname.match(/^\/api\/admin\/orders\/([^/]+)\/items$/);

                if (orderItemsMatch && request.method === "POST") {
                    return handleAdminOrderItemsUpdate(request, env.DB, orderItemsMatch[1]);
                }

                const orderMatch = url.pathname.match(/^\/api\/admin\/orders\/([^/]+)$/);

                if (orderMatch && request.method === "DELETE") {
                    return handleAdminOrderDelete(env.DB, orderMatch[1]);
                }
            }

            return jsonResponse({ error: "Not found." }, 404);
        } catch (error) {
            console.error("Database initialization failed", error);
            return jsonResponse({ error: "The order system is temporarily unavailable." }, 503);
        }
    }
};
