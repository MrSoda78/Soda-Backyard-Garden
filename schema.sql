CREATE TABLE IF NOT EXISTS products (
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
    order_limit INTEGER CHECK (order_limit IS NULL OR order_limit > 0)
);

CREATE TABLE IF NOT EXISTS orders (
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
    paid_at TEXT,
    source TEXT NOT NULL DEFAULT 'online'
);

CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    unit_price_cents INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    line_total_cents INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS donations (
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
);

CREATE TRIGGER IF NOT EXISTS deduct_inventory_before_order_item
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
END;

CREATE TRIGGER IF NOT EXISTS restock_inventory_after_order_cancel
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
END;

CREATE TRIGGER IF NOT EXISTS restock_inventory_after_order_item_reduce
AFTER UPDATE OF quantity ON order_items
WHEN NEW.quantity < OLD.quantity
  AND (SELECT status FROM orders WHERE id = OLD.order_id) <> 'cancelled'
BEGIN
    UPDATE products
    SET quantity = quantity + (OLD.quantity - NEW.quantity)
    WHERE id = OLD.product_id AND made_to_order = 0;
END;

CREATE TRIGGER IF NOT EXISTS restock_inventory_after_order_item_delete
AFTER DELETE ON order_items
WHEN (SELECT status FROM orders WHERE id = OLD.order_id) <> 'cancelled'
BEGIN
    UPDATE products
    SET quantity = quantity + OLD.quantity
    WHERE id = OLD.product_id AND made_to_order = 0;
END;

INSERT INTO products (id, name, unit, price_cents, quantity, made_to_order, sort_order, active) VALUES
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
    ('sage', 'Sage', 'bunch', 600, 0, 0, 240, 1)
ON CONFLICT(id) DO NOTHING;

UPDATE products
SET price_cents = 500, active = 1
WHERE id = 'hardo-bread' AND price_cents = 0;

UPDATE products
SET order_limit = 1
WHERE id = 'hardo-bread' AND order_limit IS NULL;

UPDATE products
SET category = 'baked'
WHERE id = 'hardo-bread';

UPDATE products
SET category = 'produce'
WHERE id IN (
    'callaloo', 'beets', 'yellow-zucchini', 'green-zucchini',
    'lebanese-zucchini', 'small-courgette', 'dragon-tongue-beans',
    'purple-beans', 'green-beans', 'potatoes', 'fresh-garlic',
    'fresh-onions', 'sage', 'brown-eggs', 'white-eggs-flat'
);

UPDATE products
SET category = 'tea'
WHERE id IN (
    'cold-flu-tea', 'menopause-tea', 'mullein-tea',
    'red-raspberry-leaf-tea', 'bloating-tea', 'sleep-tea'
);

UPDATE products
SET category = 'pain-rub'
WHERE id IN (
    'pain-rub-oil-2oz', 'pain-rub-oil-4oz',
    'pain-rub-balm-2oz', 'pain-rub-balm-4oz'
);

INSERT INTO products (
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
ON CONFLICT(id) DO NOTHING;
