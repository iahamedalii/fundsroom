import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";

export default function CustomerDetail() {
  const { id } = useParams();
  const [customer, setCustomer] = useState<any>(null);
  const [note, setNote] = useState("");

  async function load() {
    const res = await api.get(`/customers/${id}`);
    setCustomer(res.data);
  }

  useEffect(() => { load(); }, [id]);

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    await api.post(`/customers/${id}/follow-ups`, { note });
    setNote("");
    load();
  }

  if (!customer) return <p>Loading...</p>;

  return (
    <div>
      <h1>{customer.name}</h1>
      <p className="muted">{customer.businessName} · {customer.customerType} · <span className={`badge badge-${customer.status.toLowerCase()}`}>{customer.status}</span></p>

      <div className="detail-grid">
        <div className="panel">
          <h3>Details</h3>
          <p><strong>Mobile:</strong> {customer.mobile}</p>
          <p><strong>Email:</strong> {customer.email || "-"}</p>
          <p><strong>GST:</strong> {customer.gstNumber || "-"}</p>
          <p><strong>Address:</strong> {customer.address || "-"}</p>
          <p><strong>Notes:</strong> {customer.notes || "-"}</p>
        </div>

        <div className="panel">
          <h3>Follow-ups</h3>
          <form onSubmit={addNote} className="inline-form">
            <input placeholder="Add a follow-up note..." value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn-primary" type="submit">Add</button>
          </form>
          <ul className="followup-list">
            {customer.followUps?.map((f: any) => (
              <li key={f.id}>
                <div>{f.note}</div>
                <div className="muted small">{f.createdBy?.name} · {new Date(f.createdAt).toLocaleString()}</div>
              </li>
            ))}
            {customer.followUps?.length === 0 && <li className="muted">No follow-ups yet</li>}
          </ul>
        </div>

        <div className="panel span-2">
          <h3>Sales Challans</h3>
          <table className="data-table">
            <thead><tr><th>Challan #</th><th>Qty</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {customer.challans?.map((c: any) => (
                <tr key={c.id}>
                  <td>{c.challanNumber}</td>
                  <td>{c.totalQuantity}</td>
                  <td><span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span></td>
                  <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {customer.challans?.length === 0 && <tr><td colSpan={4} className="empty-row">No challans yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
