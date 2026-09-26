"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

function formatTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

export default function KitchenPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const busyIds = useRef(new Set()); // ป้องกันกดปุ่มซ้ำระหว่างรอ update

  // 1. โหลดออเดอร์เริ่มต้น
  useEffect(() => {
    let active = true;
    async function loadOrders() {
      setLoading(true);
      const { data, error } = await supabase
        .from("orders")
        .select("id, table_number, items, status, created_at")
        .in("status", ["received", "cooking"])
        .order("created_at", { ascending: true });

      if (!active) return;

      if (error) {
        setErrorMsg("โหลดออเดอร์ไม่สำเร็จ: " + error.message);
      } else {
        setOrders(data || []);
      }
      setLoading(false);
    }
    loadOrders();
    return () => {
      active = false;
    };
  }, []);

  // 2. Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("kitchen-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const row = payload.new;
          if (row.status === "received" || row.status === "cooking") {
            setOrders((prev) => {
              if (prev.some((o) => o.id === row.id)) return prev;
              return [...prev, row];
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const row = payload.new;
          setOrders((prev) => {
            if (row.status === "served" || row.status === "cancelled") {
              return prev.filter((o) => o.id !== row.id);
            }
            const exists = prev.some((o) => o.id === row.id);
            if (!exists) {
              if (row.status === "received" || row.status === "cooking") {
                return [...prev, row];
              }
              return prev;
            }
            return prev.map((o) => (o.id === row.id ? row : o));
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function startCooking(order) {
    if (busyIds.current.has(order.id)) return;
    busyIds.current.add(order.id);

    // อัปเดตหน้าจอทันที (optimistic)
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, status: "cooking" } : o))
    );

    const { error } = await supabase
      .from("orders")
      .update({ status: "cooking" })
      .eq("id", order.id);

    if (error) {
      setErrorMsg("เปลี่ยนสถานะไม่สำเร็จ: " + error.message);
      // ย้อนกลับถ้าพลาด
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: order.status } : o))
      );
    }
    busyIds.current.delete(order.id);
  }

  async function markServed(order) {
    if (busyIds.current.has(order.id)) return;
    busyIds.current.add(order.id);

    // เอาการ์ดออกจากจอทันที
    setOrders((prev) => prev.filter((o) => o.id !== order.id));

    const { error } = await supabase
      .from("orders")
      .update({ status: "served" })
      .eq("id", order.id);

    if (error) {
      setErrorMsg("เปลี่ยนสถานะไม่สำเร็จ: " + error.message);
      // ถ้าพลาด เอากลับมาแสดงใหม่
      setOrders((prev) => {
        if (prev.some((o) => o.id === order.id)) return prev;
        return [...prev, order];
      });
    }
    busyIds.current.delete(order.id);
  }

  return (
    <main className="kitchen-page">
      <style>{styles}</style>

      <header className="kitchen-header">
        <h1>ออเดอร์ในครัว</h1>
        <span className="count-badge">{orders.length} ออเดอร์</span>
      </header>

      {errorMsg && <div className="error-banner">{errorMsg}</div>}

      {loading ? (
        <div className="loading-msg">กำลังโหลดออเดอร์...</div>
      ) : orders.length === 0 ? (
        <div className="empty-msg">ยังไม่มีออเดอร์เข้ามา</div>
      ) : (
        <div className="order-grid">
          {orders.map((order) => (
            <div
              key={order.id}
              className={
                "order-card" +
                (order.status === "cooking" ? " cooking" : "")
              }
            >
              <div className="card-top">
                <span className="table-number">โต๊ะ {order.table_number}</span>
                <span className="order-time">{formatTime(order.created_at)}</span>
              </div>

              <ul className="item-list">
                {(order.items || []).map((it, idx) => (
                  <li key={idx}>
                    {it.name} <span className="qty">x{it.quantity}</span>
                  </li>
                ))}
              </ul>

              <div className="card-actions">
                {order.status !== "cooking" && (
                  <button
                    className="start-btn"
                    onClick={() => startCooking(order)}
                  >
                    เริ่มทำ
                  </button>
                )}
                <button
                  className="served-btn"
                  onClick={() => markServed(order)}
                >
                  จัดเสิร์ฟแล้ว
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

const styles = `
  * { box-sizing: border-box; }
  body { margin: 0; }
  .kitchen-page {
    min-height: 100vh;
    background: #1c1f1d;
    font-family: -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
    padding: 1.2rem 1.5rem 2.5rem;
  }
  .kitchen-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.2rem;
  }
  .kitchen-header h1 {
    color: #fff;
    font-size: 2rem;
    margin: 0;
  }
  .count-badge {
    background: #2f6f4e;
    color: #fff;
    font-size: 1.2rem;
    font-weight: 700;
    padding: 0.4rem 1rem;
    border-radius: 999px;
  }
  .error-banner {
    background: #fdecea;
    color: #b3261e;
    padding: 0.7rem 1rem;
    font-weight: 700;
    border-radius: 10px;
    margin-bottom: 1rem;
  }
  .loading-msg, .empty-msg {
    color: #cfd3d0;
    font-size: 1.4rem;
    text-align: center;
    padding: 4rem 0;
  }
  .order-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 1.1rem;
    align-items: start;
  }
  .order-card {
    background: #fff;
    border-radius: 16px;
    padding: 1.2rem;
    border: 4px solid #4a4f4c;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }
  .order-card.cooking {
    border-color: #e8871e;
    background: #fff6ea;
  }
  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .table-number {
    font-size: 1.7rem;
    font-weight: 900;
    color: #1f2321;
  }
  .order-time {
    font-size: 1.1rem;
    font-weight: 700;
    color: #6b6f6c;
  }
  .item-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .item-list li {
    font-size: 1.25rem;
    font-weight: 600;
    color: #2a2e2b;
  }
  .qty {
    font-weight: 800;
    color: #2f6f4e;
  }
  .order-card.cooking .qty {
    color: #b3560a;
  }
  .card-actions {
    display: flex;
    gap: 0.6rem;
    margin-top: 0.4rem;
  }
  .start-btn, .served-btn {
    flex: 1;
    font-size: 1.15rem;
    font-weight: 800;
    padding: 0.8rem;
    border-radius: 12px;
    border: none;
  }
  .start-btn {
    background: #e8871e;
    color: #fff;
  }
  .served-btn {
    background: #2f6f4e;
    color: #fff;
  }
`;
