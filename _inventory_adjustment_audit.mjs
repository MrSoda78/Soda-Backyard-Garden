const baseUrl = "http://127.0.0.1:8793";

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

async function jsonRequest(path, options = {}) {
    const response = await fetch(baseUrl + path, options);
    const body = await response.json();
    return { response, body };
}

const initialInventory = (await jsonRequest("/api/inventory")).body.products;
const initialById = new Map(initialInventory.map((product) => [product.id, product]));

const created = await jsonRequest("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        customerName: "Full Inventory Audit",
        phone: "4165550199",
        email: "audit@example.com",
        deliveryDay: "Tuesday",
        notes: "Local automated test",
        website: "",
        items: {
            callaloo: 1,
            "hardo-bread": 1,
            "cold-flu-tea": 1,
            "brown-eggs": 1
        }
    })
});
assert(created.response.status === 201, "Could not create the mixed inventory test order.");

const login = await fetch(baseUrl + "/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "test-password" })
});
assert(login.ok, "Admin login failed.");
const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
const adminHeaders = { Cookie: cookie, "Content-Type": "application/json" };

async function getTestOrder() {
    const result = await jsonRequest("/api/admin/orders", { headers: { Cookie: cookie } });
    assert(result.response.ok, "Could not read admin orders.");
    return result.body.orders.find((order) => order.orderNumber === created.body.orderNumber);
}

function adjustmentPayload(order, quantitiesByName) {
    return {
        items: order.items.map((item) => ({
            id: String(item.id),
            quantity: quantitiesByName[item.name]
        }))
    };
}

let order = await getTestOrder();
const increased = await jsonRequest(`/api/admin/orders/${order.id}/items`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify(adjustmentPayload(order, {
        "Callaloo, vacuum sealed": 2,
        "Hardo Bread": 2,
        "Cold & Flu Tea Mix": 3,
        "Brown Eggs": 2
    }))
});
assert(increased.response.ok, "Mixed product increases failed.");

order = await getTestOrder();
const afterIncreaseInventory = (await jsonRequest("/api/inventory")).body.products;
const afterIncreaseById = new Map(afterIncreaseInventory.map((product) => [product.id, product]));
assert(order.totalCents === 5200, "Mixed increase did not recalculate the order total.");
assert(order.items.find((item) => item.name === "Callaloo, vacuum sealed").quantity === 2, "Produce increase failed.");
assert(order.items.find((item) => item.name === "Hardo Bread").quantity === 2, "Baked-goods increase failed.");
assert(order.items.find((item) => item.name === "Cold & Flu Tea Mix").quantity === 3, "Made-to-order tea increase failed.");
assert(order.items.find((item) => item.name === "Brown Eggs").quantity === 2, "Open-availability egg increase failed.");
assert(afterIncreaseById.get("callaloo").quantity === initialById.get("callaloo").quantity - 2, "Produce inventory was not deducted.");
assert(afterIncreaseById.get("hardo-bread").quantity === initialById.get("hardo-bread").quantity - 2, "Bread inventory was not deducted.");
assert(afterIncreaseById.get("cold-flu-tea").quantity === null, "Made-to-order tea incorrectly gained fixed inventory.");
assert(afterIncreaseById.get("brown-eggs").quantity === null, "Open-availability eggs incorrectly gained fixed inventory.");

const reduced = await jsonRequest(`/api/admin/orders/${order.id}/items`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify(adjustmentPayload(order, {
        "Callaloo, vacuum sealed": 1,
        "Hardo Bread": 1,
        "Cold & Flu Tea Mix": 1,
        "Brown Eggs": 1
    }))
});
assert(reduced.response.ok, "Mixed product reductions failed.");

order = await getTestOrder();
const afterReductionInventory = (await jsonRequest("/api/inventory")).body.products;
const afterReductionById = new Map(afterReductionInventory.map((product) => [product.id, product]));
assert(order.totalCents === 2300, "Reduction did not recalculate the order total.");
assert(afterReductionById.get("callaloo").quantity === initialById.get("callaloo").quantity - 1, "Produce reduction did not return inventory.");
assert(afterReductionById.get("hardo-bread").quantity === initialById.get("hardo-bread").quantity - 1, "Bread reduction did not return inventory.");

const excessivePayload = adjustmentPayload(order, {
    "Callaloo, vacuum sealed": 50,
    "Hardo Bread": 1,
    "Cold & Flu Tea Mix": 1,
    "Brown Eggs": 1
});
const excessive = await jsonRequest(`/api/admin/orders/${order.id}/items`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify(excessivePayload)
});
assert(excessive.response.status === 409, "Insufficient fixed inventory was not rejected.");
order = await getTestOrder();
assert(order.items.find((item) => item.name === "Callaloo, vacuum sealed").quantity === 1, "Rejected increase changed the order.");

const removed = await jsonRequest(`/api/admin/orders/${order.id}/items`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify(adjustmentPayload(order, {
        "Callaloo, vacuum sealed": 0,
        "Hardo Bread": 0,
        "Cold & Flu Tea Mix": 0,
        "Brown Eggs": 0
    }))
});
assert(removed.response.ok, "Removing all order items failed.");
order = await getTestOrder();
const finalInventory = (await jsonRequest("/api/inventory")).body.products;
const finalById = new Map(finalInventory.map((product) => [product.id, product]));
assert(order.status === "cancelled", "Empty order was not cancelled.");
assert(order.totalCents === 0, "Empty order total was not zero.");
assert(finalById.get("callaloo").quantity === initialById.get("callaloo").quantity, "Produce inventory did not fully reconcile.");
assert(finalById.get("hardo-bread").quantity === initialById.get("hardo-bread").quantity, "Bread inventory did not fully reconcile.");

console.log(JSON.stringify({
    passed: true,
    tested: [
        "fixed-stock produce",
        "fixed-stock baked goods",
        "made-to-order tea",
        "open-availability eggs",
        "increase",
        "reduction",
        "removal",
        "insufficient-stock rejection",
        "total recalculation",
        "inventory reconciliation"
    ]
}, null, 2));
