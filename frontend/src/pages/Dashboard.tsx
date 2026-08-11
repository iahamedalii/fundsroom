import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ customers: 0, products: 0, draftChallans: 0, lowStock: 0 });

  useEffect(() => {
    async function load() {
      const [customers, products, drafts] = await Promise.all([
        api.get("/customers?limit=1"),
        api.get("/products?limit=100"),
        api.get("/challans?status=DRAFT&limit=1"),
      ]);
      const lowStock = products.data.items.filter((p: any) => p.stock <= p.minStock).length;
      setStats({
        customers: customers.data.total,
        products: products.data.total,
        draftChallans: drafts.data.total,
        lowStock,
      });
    }
    load();
  }, []);

  return (
    <div>
      <h1>Welcome, {user?.name}</h1>
      <p className="muted">Role: {user?.role}</p>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.customers}</div>
          <div className="stat-label">Total Customers</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.products}</div>
          <div className="stat-label">Total Products</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.draftChallans}</div>
          <div className="stat-label">Draft Challans</div>
        </div>
        <div className="stat-card warn">
          <div className="stat-value">{stats.lowStock}</div>
          <div className="stat-label">Low Stock Products</div>
        </div>
      </div>
    </div>
  );
}
