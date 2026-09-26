"use client";

import { use, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

const ADULT_PRICE = 289;
const CHILD_PRICE = 145;
const MAX_CART_ITEMS = 10;

export default function OrderPage({ params }) {
  const { tableNumber } = use(params);
  const tableNum = parseInt(tableNumber, 10);

  const [checkingSession, setCheckingSession] = useState(true);
  const [session, setSession] = useState(null); // { id, adult_count, child_count }
  const [sessionClosed, setSessionClosed] = useState(false);

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [menuLoading, setMenuLoading] = useState(false);

  const [cart, setCart] = useState([]); // [{ cartId, name, quantity }]
  const [cartOpen, setCartOpen] = useState(false);
  const [qtyByItem, setQtyByItem] = useState({}); // itemId -> selected qty (1-5)
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [billOpen, setBillOpen] = useState(false);
  const [billing, setBilling] = useState(false);

  // 1. เช็ค session ของโต๊ะนี้
  useEffect(() => {
    let active = true;
    async function checkSession() {
      setCheckingSession(true);
      const { data, error } = await supabase
        .from("sessions")
        .select("id, adult_count, child_count")
        .eq("table_number", tableNum)
        .eq("status", "open")
        .limit(1);

      if (!active) return;

      if (error || !data || data.length === 0) {
        setSession(null);
      } else {
        setSession(data[0]);
      }
      setCheckingSession(false);
    }
    if (tableNum) checkSession();
    else setCheckingSession(false);
    return () => {
      active = false;
    };
  }, [tableNum]);

  // 2. โหลดเมนู เมื่อมี session
  useEffect(() => {
    let active = true;
    async function loadMenu() {
      setMenuLoading(true);
      const { data: cats } = await supabase
        .from("menu_categories")
        .select("id, name, sort_order")
        .order("sort_order", { ascending: true });

      const { data: menuItems } = await supabase
        .from("menu_items")
        .select("id, category_id, name");

      if (!active) return;

      setCategories(cats || []);
      setItems(menuItems || []);
      if (cats && cats.length > 0) {
        setActiveCategoryId(cats[0].id);
      }
      setMenuLoading(false);
    }
    if (session) loadMenu();
    return () => {
      active = false;
    };
  }, [session]);

  const itemsInActiveCategory = useMemo(
    () => items.filter((i) => i.category_id === activeCategoryId),
    [items, activeCategoryId]
  );

  function getQty(itemId) {
    return qtyByItem[itemId] || 1;
  }

  function setQty(itemId, qty) {
    setQtyByItem((prev) => ({ ...prev, [itemId]: qty }));
  }

  function addToCart(item) {
    if (cart.length >= MAX_CART_ITEMS) {
      setErrorMsg(`ตะกร้าเต็มแล้ว (สูงสุด ${MAX_CART_ITEMS} รายการต่อการส่ง)`);
      return;
    }
    setErrorMsg("");
    const quantity = getQty(item.id);
    setCart((prev) => [
      ...prev,
      { cartId: `${item.id}-${Date.now()}`, name: item.name, quantity },
    ]);
    setToast(`เพิ่ม ${item.name} x${quantity} ลงตะกร้า`);
    setTimeout(() => setToast(""), 1200);
  }

  function removeFromCart(cartId) {
    setCart((prev) => prev.filter((c) => c.cartId !== cartId));
  }

  const totalCartCount = cart.length;

  async function submitOrder() {
    if (cart.length === 0 || !session) return;
    setSubmitting(true);
    setErrorMsg("");
    try {
      const orderItems = cart.map((c) => ({
        name: c.name,
        quantity: c.quantity,
      }));

      const { error } = await supabase.from("orders").insert({
        session_id: session.id,
        table_number: tableNum,
        items: orderItems,
        status: "received",
      });

      if (error) {
        setErrorMsg("ส่งออเดอร์ไม่สำเร็จ: " + error.message);
        setSubmitting(false);
        return;
      }

      setCart([]);
      setCartOpen(false);
      setToast("ส่งออเดอร์แล้ว");
      setTimeout(() => setToast(""), 2000);
    } catch (err) {
      setErrorMsg("เกิดข้อผิดพลาดที่ไม่คาดคิด: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmBill() {
    if (!session) return;
    setBilling(true);
    setErrorMsg("");
    try {
      const { error } = await supabase
        .from("sessions")
        .update({ status: "closed" })
        .eq("id", session.id)
        .eq("status", "open");

      if (error) {
        setErrorMsg("ปิดโต๊ะไม่สำเร็จ: " + error.message);
        setBilling(false);
        return;
      }

      setBillOpen(false);
      setSessionClosed(true);
    } catch (err) {
      setErrorMsg("เกิดข้อผิดพลาดที่ไม่คาดคิด: " + err.message);
    } finally {
      setBilling(false);
    }
  }

  const billTotal = session
    ? session.adult_count * ADULT_PRICE + session.child_count * CHILD_PRICE
    : 0;

  // ---------- Render states ----------

  if (checkingSession) {
    return (
      <main className="fullscreen-msg">
        <style>{globalStyles}</style>
        <p>กำลังตรวจสอบโต๊ะ...</p>
      </main>
    );
  }

  if (!session && !sessionClosed) {
    return (
      <main className="fullscreen-msg">
        <style>{globalStyles}</style>
        <p>โต๊ะนี้ยังไม่เปิดใช้งาน กรุณาแจ้งพนักงาน</p>
      </main>
    );
  }

  if (sessionClosed) {
    return (
      <main className="fullscreen-msg thankyou">
        <style>{globalStyles}</style>
        <p>ขอบคุณที่ใช้บริการ</p>
      </main>
    );
  }

  return (
    <main className="order-page">
      <style>{globalStyles}</style>

      <header className="top-bar">
        <div className="table-label">โต๊ะ {tableNum}</div>
        <button className="bill-btn" onClick={() => setBillOpen(true)}>
          เรียกเก็บเงิน
        </button>
      </header>

      {errorMsg && <div className="error-banner">{errorMsg}</div>}

      {menuLoading ? (
        <div className="menu-loading">กำลังโหลดเมนู...</div>
      ) : (
        <>
          <nav className="tabs">
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={
                  "tab" + (cat.id === activeCategoryId ? " tab-active" : "")
                }
                onClick={() => setActiveCategoryId(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </nav>

          <section className="item-list">
            {itemsInActiveCategory.length === 0 && (
              <p className="empty-cat">ยังไม่มีเมนูในหมวดนี้</p>
            )}
            {itemsInActiveCategory.map((item) => (
              <div key={item.id} className="item-card">
                <div className="item-name">{item.name}</div>
                <div className="item-controls">
                  <select
                    className="qty-select"
                    value={getQty(item.id)}
                    onChange={(e) => setQty(item.id, parseInt(e.target.value, 10))}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <button
                    className="add-btn"
                    onClick={() => addToCart(item)}
                    aria-label={`เพิ่ม ${item.name}`}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </section>
        </>
      )}

      {toast && <div className="toast">{toast}</div>}

      {/* floating cart bar */}
      <div className="cart-bar" onClick={() => setCartOpen((v) => !v)}>
        <span>ตะกร้า: {totalCartCount} รายการ</span>
        <span className="chevron">{cartOpen ? "▾ ปิด" : "▴ ดูตะกร้า"}</span>
      </div>

      {cartOpen && (
        <div className="cart-drawer">
          {cart.length === 0 ? (
            <p className="empty-cart">ยังไม่มีรายการในตะกร้า</p>
          ) : (
            <ul className="cart-list">
              {cart.map((c) => (
                <li key={c.cartId} className="cart-item">
                  <span>
                    {c.name} x{c.quantity}
                  </span>
                  <button
                    className="remove-btn"
                    onClick={() => removeFromCart(c.cartId)}
                  >
                    ลบ
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            className="submit-btn"
            disabled={cart.length === 0 || submitting}
            onClick={submitOrder}
          >
            {submitting ? "กำลังส่ง..." : "ส่งออเดอร์"}
          </button>
        </div>
      )}

      {billOpen && (
        <div className="overlay">
          <div className="bill-box">
            <h2>ยืนยันเรียกเก็บเงิน</h2>
            <p>
              ผู้ใหญ่ {session.adult_count} x {ADULT_PRICE} บาท
            </p>
            <p>
              เด็ก {session.child_count} x {CHILD_PRICE} บาท
            </p>
            <p className="bill-total">ยอดรวม {billTotal.toLocaleString()} บาท</p>
            <div className="bill-actions">
              <button
                className="btn-secondary"
                onClick={() => setBillOpen(false)}
                disabled={billing}
              >
                ยกเลิก
              </button>
              <button
                className="btn-confirm"
                onClick={confirmBill}
                disabled={billing}
              >
                {billing ? "กำลังปิด..." : "ยืนยัน"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const globalStyles = `
  * { box-sizing: border-box; }
  body { margin: 0; }
  .fullscreen-msg {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 2rem;
    font-family: -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
    font-size: 1.4rem;
    font-weight: 700;
    color: #2a2e2b;
    background: #f7f5f2;
  }
  .fullscreen-msg.thankyou {
    background: #2f6f4e;
    color: #fff;
    font-size: 1.8rem;
  }
  .order-page {
    min-height: 100vh;
    background: #f7f5f2;
    font-family: -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
    padding-bottom: 90px;
  }
  .top-bar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.9rem 1rem;
    background: #fff;
    border-bottom: 1px solid #e5e2db;
  }
  .table-label {
    font-size: 1.3rem;
    font-weight: 800;
    color: #1f2321;
  }
  .bill-btn {
    font-size: 1rem;
    font-weight: 700;
    padding: 0.6rem 1rem;
    border-radius: 10px;
    border: none;
    background: #d64545;
    color: #fff;
  }
  .error-banner {
    background: #fdecea;
    color: #b3261e;
    padding: 0.7rem 1rem;
    font-weight: 600;
    font-size: 0.95rem;
  }
  .menu-loading {
    padding: 2rem;
    text-align: center;
    color: #6b6f6c;
    font-size: 1.1rem;
  }
  .tabs {
    display: flex;
    overflow-x: auto;
    gap: 0.5rem;
    padding: 0.8rem 1rem;
    background: #fff;
    position: sticky;
    top: 58px;
    z-index: 19;
    border-bottom: 1px solid #e5e2db;
  }
  .tab {
    flex: 0 0 auto;
    font-size: 1.05rem;
    font-weight: 700;
    padding: 0.6rem 1.1rem;
    border-radius: 999px;
    border: 2px solid #d8d5cf;
    background: #fff;
    color: #2a2e2b;
    white-space: nowrap;
  }
  .tab-active {
    background: #2f6f4e;
    border-color: #2f6f4e;
    color: #fff;
  }
  .item-list {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }
  .empty-cat {
    text-align: center;
    color: #6b6f6c;
    padding: 2rem 0;
  }
  .item-card {
    background: #fff;
    border-radius: 14px;
    border: 1px solid #e5e2db;
    padding: 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
  }
  .item-name {
    font-size: 1.15rem;
    font-weight: 700;
    color: #1f2321;
    flex: 1;
  }
  .item-controls {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .qty-select {
    font-size: 1.1rem;
    padding: 0.5rem 0.5rem;
    border-radius: 8px;
    border: 2px solid #d8d5cf;
  }
  .add-btn {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: none;
    background: #2f6f4e;
    color: #fff;
    font-size: 1.6rem;
    font-weight: 700;
    line-height: 1;
  }
  .toast {
    position: fixed;
    bottom: 90px;
    left: 50%;
    transform: translateX(-50%);
    background: #1f2321;
    color: #fff;
    padding: 0.6rem 1.1rem;
    border-radius: 999px;
    font-size: 0.95rem;
    z-index: 40;
  }
  .cart-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #2f6f4e;
    color: #fff;
    padding: 1rem 1.2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 1.15rem;
    font-weight: 700;
    z-index: 30;
    cursor: pointer;
  }
  .cart-drawer {
    position: fixed;
    bottom: 66px;
    left: 0;
    right: 0;
    max-height: 55vh;
    overflow-y: auto;
    background: #fff;
    border-top: 2px solid #e5e2db;
    padding: 1rem;
    z-index: 29;
    box-shadow: 0 -6px 18px rgba(0,0,0,0.08);
  }
  .empty-cart {
    text-align: center;
    color: #6b6f6c;
    padding: 1rem 0;
  }
  .cart-list {
    list-style: none;
    margin: 0 0 1rem;
    padding: 0;
  }
  .cart-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.6rem 0;
    border-bottom: 1px solid #f0eee9;
    font-size: 1.05rem;
  }
  .remove-btn {
    border: none;
    background: none;
    color: #b3261e;
    font-weight: 700;
    font-size: 0.95rem;
  }
  .submit-btn {
    width: 100%;
    font-size: 1.25rem;
    font-weight: 800;
    padding: 0.9rem;
    border-radius: 12px;
    border: none;
    background: #2f6f4e;
    color: #fff;
  }
  .submit-btn:disabled {
    background: #9cb3a7;
  }
  .overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 50;
  }
  .bill-box {
    background: #fff;
    border-radius: 14px;
    padding: 1.5rem;
    max-width: 360px;
    width: 100%;
    border: 3px solid #d64545;
  }
  .bill-box h2 {
    margin: 0 0 0.8rem;
    color: #b3261e;
    font-size: 1.3rem;
  }
  .bill-box p {
    margin: 0.3rem 0;
    font-size: 1.1rem;
    color: #2a2e2b;
  }
  .bill-total {
    font-weight: 800;
    font-size: 1.3rem;
    margin-top: 0.6rem;
  }
  .bill-actions {
    display: flex;
    gap: 0.7rem;
    margin-top: 1.2rem;
  }
  .btn-secondary, .btn-confirm {
    flex: 1;
    font-size: 1.05rem;
    font-weight: 700;
    padding: 0.7rem;
    border-radius: 10px;
    border: none;
  }
  .btn-secondary {
    background: #fff;
    border: 2px solid #d8d5cf;
    color: #2a2e2b;
  }
  .btn-confirm {
    background: #d64545;
    color: #fff;
  }
`;
