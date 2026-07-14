CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    quantity INTEGER CHECK (quantity IS NULL OR quantity >= 0),
    made_to_order INTEGER NOT NULL DEFAULT 0 CHECK (made_to_order IN (0, 1)),
    sort_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
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
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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

INSERT INTO products (id, name, unit, price_cents, quantity, made_to_order, sort_order) VALUES
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
    active = 1;
