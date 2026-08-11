import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

interface Customer {
  id: string;
  name: string;
  mobile: string;
  businessName?: string;
  customerType: string;
  status: string;
}

export default function Customers() {
  const [items, setItems] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", mobile: "", email: "", businessName: "", gstNumber: "",
    customerType: "RETAIL", address: "", status: "LEAD", notes: "",
  });
  const [error, setError] = useState("");

  async function load() {
    const res = await api.get("/customers", { params: { search } });
    setItems(res.data.items);
  }

  useEffect(() => { load(); }, [search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/customers", form);
      setShowForm(false);
      setForm({ name: "", mobile: "", email: "", businessName: "", gstNumber: "", customerType: "RETAIL", address: "", status: "LEAD", notes: "" });
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create customer");
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Customers</h1>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add Customer"}
        </button>
      </div>

      {showForm && (
        <form className="panel-form" onSubmit={handleCreate}>
          {error && <div className="error-banner">{error}</div>}
          <div className="form-grid">
            <div><label>Name *</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label>Mobile *</label><input required value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
            <div><label>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label>Business Name</label><input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} /></div>
            <div><label>GST Number</label><input value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} /></div>
            <div>
              <label>Customer Type</label>
              <select value={form.customerType} onChange={(e) => setForm({ ...form, customerType: e.target.value })}>
                <option value="RETAIL">Retail</option>
                <option value="WHOLESALE">Wholesale</option>
                <option value="DISTRIBUTOR">Distributor</option>
              </select>
            </div>
            <div>
              <label>Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="LEAD">Lead</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
            <div className="span-2"><label>Address</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="span-2"><label>Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <button className="btn-primary" type="submit">Save Customer</button>
        </form>
      )}

      <input className="search-input" placeholder="Search by name, mobile, business..." value={search} onChange={(e) => setSearch(e.target.value)} />

      <table className="data-table">
        <thead>
          <tr><th>Name</th><th>Mobile</th><th>Business</th><th>Type</th><th>Status</th></tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id}>
              <td><Link to={`/customers/${c.id}`}>{c.name}</Link></td>
              <td>{c.mobile}</td>
              <td>{c.businessName || "-"}</td>
              <td>{c.customerType}</td>
              <td><span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span></td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={5} className="empty-row">No customers found</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
