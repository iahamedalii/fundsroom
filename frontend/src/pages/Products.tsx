import React, { useEffect, useState } from "react";
import { api } from "../api/client";

interface Product {
  id: string;
  name: string;
  sku: string;
  category?: string;
  unitPrice: string;
  stock: number;
  minStock: number;
  location?: string;
}

export default function Products() {
  const [items, setItems] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", sku: "", category: "", unitPrice: "", minStock: "0", location: "" });
  const [movementFor, setMovementFor] = useState<Product | null>(null);
  const [movement, setMovement] = useState({ quantity: "", movementType: "IN", reason: "" });

  async function load() {
    const res = await api.get("/products", { params: { search } });
    setItems(res.data.items);
  }

  useEffect(() => { load(); }, [search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/products", { ...form, unitPrice: Number(form.unitPrice), minStock: Number(form.minStock) });
      setShowForm(false);
      setForm({ name: "", sku: "", category: "", unitPrice: "", minStock: "0", location: "" });
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create product");
    }
  }

  async function handleMovement(e: React.FormEvent) {
    e.preventDefault();
    if (!movementFor) return;
    setError("");
    try {
      await api.post(`/products/${movementFor.id}/stock-movements`, {
        quantity: Number(movement.quantity),
        movementType: movement.movementType,
        reason: movement.reason,
      });
      setMovementFor(null);
      setMovement({ quantity: "", movementType: "IN", reason: "" });
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || "Stock movement failed");
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Products</h1>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add Product"}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {showForm && (
        <form className="panel-form" onSubmit={handleCreate}>
          <div className="form-grid">
            <div><label>Name *</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label>SKU *</label><input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
            <div><label>Category</label><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            <div><label>Unit Price *</label><input required type="number" step="0.01" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} /></div>
            <div><label>Min Stock Alert</label><input type="number" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} /></div>
            <div><label>Location</label><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
          </div>
          <button className="btn-primary" type="submit">Save Product</button>
        </form>
      )}

      {movementFor && (
        <form className="panel-form" onSubmit={handleMovement}>
          <h3>Stock Movement — {movementFor.name}</h3>
          <div className="form-grid">
            <div>
              <label>Type</label>
              <select value={movement.movementType} onChange={(e) => setMovement({ ...movement, movementType: e.target.value })}>
                <option value="IN">IN</option>
                <option value="OUT">OUT</option>
              </select>
            </div>
            <div><label>Quantity *</label><input required type="number" min="1" value={movement.quantity} onChange={(e) => setMovement({ ...movement, quantity: e.target.value })} /></div>
            <div className="span-2"><label>Reason</label><input value={movement.reason} onChange={(e) => setMovement({ ...movement, reason: e.target.value })} /></div>
          </div>
          <div className="btn-row">
            <button className="btn-primary" type="submit">Record Movement</button>
            <button className="btn-ghost" type="button" onClick={() => setMovementFor(null)}>Cancel</button>
          </div>
        </form>
      )}

      <input className="search-input" placeholder="Search by name, SKU, category..." value={search} onChange={(e) => setSearch(e.target.value)} />

      <table className="data-table">
        <thead>
          <tr><th>Name</th><th>SKU</th><th>Category</th><th>Price</th><th>Stock</th><th>Location</th><th></th></tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id} className={p.stock <= p.minStock ? "row-warn" : ""}>
              <td>{p.name}</td>
              <td>{p.sku}</td>
              <td>{p.category || "-"}</td>
              <td>₹{p.unitPrice}</td>
              <td>{p.stock} {p.stock <= p.minStock && <span className="badge badge-inactive">LOW</span>}</td>
              <td>{p.location || "-"}</td>
              <td><button className="btn-ghost small" onClick={() => setMovementFor(p)}>Adjust Stock</button></td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={7} className="empty-row">No products found</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
