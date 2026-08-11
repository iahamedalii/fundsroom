import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

export default function Challans() {
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const res = await api.get("/challans", { params: status ? { status } : {} });
    setItems(res.data.items);
  }

  useEffect(() => { load(); }, [status]);

  async function handleConfirm(id: string) {
    setError("");
    try {
      await api.post(`/challans/${id}/confirm`);
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to confirm challan");
    }
  }

  async function handleCancel(id: string) {
    setError("");
    try {
      await api.post(`/challans/${id}/cancel`);
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to cancel challan");
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Sales Challans</h1>
        <Link to="/challans/new" className="btn-primary">+ New Challan</Link>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="filter-row">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <table className="data-table">
        <thead>
          <tr><th>Challan #</th><th>Customer</th><th>Total Qty</th><th>Status</th><th>Date</th><th></th></tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id}>
              <td>{c.challanNumber}</td>
              <td>{c.customer?.businessName || c.customer?.name}</td>
              <td>{c.totalQuantity}</td>
              <td><span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span></td>
              <td>{new Date(c.createdAt).toLocaleDateString()}</td>
              <td>
                {c.status === "DRAFT" && (
                  <div className="btn-row">
                    <button className="btn-ghost small" onClick={() => handleConfirm(c.id)}>Confirm</button>
                    <button className="btn-ghost small" onClick={() => handleCancel(c.id)}>Cancel</button>
                  </div>
                )}
                {c.status === "CONFIRMED" && (
                  <button className="btn-ghost small" onClick={() => handleCancel(c.id)}>Cancel</button>
                )}
              </td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={6} className="empty-row">No challans found</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
