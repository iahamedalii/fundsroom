import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";

interface LineItem {
  productId: string;
  productName: string;
  availableStock: number;
  quantity: number;
}

export default function ChallanNew() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/customers", { params: { limit: 100 } }).then((r) => setCustomers(r.data.items));
    api.get("/products", { params: { limit: 100 } }).then((r) => setProducts(r.data.items));
  }, []);

  function addItem() {
    setError("");
    if (!selectedProductId || Number(qty) <= 0) return;
    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return;
    if (items.some((i) => i.productId === product.id)) {
      setError("Product already added to this challan");
      return;
    }
    setItems([...items, { productId: product.id, productName: product.name, availableStock: product.stock, quantity: Number(qty) }]);
    setSelectedProductId("");
    setQty("1");
  }

  function removeItem(productId: string) {
    setItems(items.filter((i) => i.productId !== productId));
  }

  async function save(status: "DRAFT" | "CONFIRMED") {
    setError("");
    if (!customerId || items.length === 0) {
      setError("Select a customer and add at least one product");
      return;
    }
    try {
      const res = await api.post("/challans", {
        customerId,
        status,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      });
      navigate(`/challans`);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save challan");
    }
  }

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div>
      <h1>New Sales Challan</h1>
      {error && <div className="error-banner">{error}</div>}

      <div className="panel-form">
        <label>Customer *</label>
        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">-- Select customer --</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.businessName || c.name} ({c.mobile})</option>
          ))}
        </select>

        <h3 style={{ marginTop: 20 }}>Add Products</h3>
        <div className="inline-form">
          <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}>
            <option value="">-- Select product --</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} (stock: {p.stock})</option>
            ))}
          </select>
          <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} style={{ width: 90 }} />
          <button type="button" className="btn-primary" onClick={addItem}>Add</button>
        </div>

        <table className="data-table" style={{ marginTop: 16 }}>
          <thead><tr><th>Product</th><th>Available Stock</th><th>Quantity</th><th></th></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.productId} className={i.quantity > i.availableStock ? "row-warn" : ""}>
                <td>{i.productName}</td>
                <td>{i.availableStock}</td>
                <td>{i.quantity}</td>
                <td><button className="btn-ghost small" onClick={() => removeItem(i.productId)}>Remove</button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={4} className="empty-row">No products added yet</td></tr>}
          </tbody>
        </table>
        <p className="muted">Total quantity: {totalQty}</p>

        <div className="btn-row">
          <button className="btn-ghost" onClick={() => save("DRAFT")}>Save as Draft</button>
          <button className="btn-primary" onClick={() => save("CONFIRMED")}>Confirm Challan</button>
        </div>
      </div>
    </div>
  );
}
