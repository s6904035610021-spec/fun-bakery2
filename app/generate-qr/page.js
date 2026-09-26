"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

function minutesSince(isoString) {
  const created = new Date(isoString).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - created) / 60000));
}

export default function GenerateQrPage() {
  const [tableNumber, setTableNumber] = useState("");
  const [adultCount, setAdultCount] = useState("");
  const [childCount, setChildCount] = useState("0");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [openWarning, setOpenWarning] = useState(null); // existing open session row
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmElapsed, setConfirmElapsed] = useState(0);
  const [closing, setClosing] = useState(false);

  const [qrResult, setQrResult] = useState(null); // { tableNumber, adultCount, childCount, url }
  const [copied, setCopied] = useState(false);

  function resetForm() {
    setTableNumber("");
    setAdultCount("");
    setChildCount("0");
    setQrResult(null);
    setOpenWarning(null);
    setConfirmOpen(false);
    setErrorMsg("");
    setCopied(false);
  }

  async function handleOpenTable(e) {
    e.preventDefault();
    setErrorMsg("");

    const tableNum = parseInt(tableNumber, 10);
    const adults = parseInt(adultCount, 10);
    const children = parseInt(childCount, 10) || 0;

    if (!tableNum || tableNum <= 0) {
      setErrorMsg("กรุณากรอกเลขโต๊ะให้ถูกต้อง");
      return;
    }
    if (!adults || adults <= 0) {
      setErrorMsg("กรุณากรอกจำนวนผู้ใหญ่อย่างน้อย 1 คน");
      return;
    }

    setLoading(true);
    try {
      const { data: existing, error: findError } = await supabase
        .from("sessions")
        .select("id, table_number, adult_count, child_count, created_at")
        .eq("table_number", tableNum)
        .eq("status", "open")
        .limit(1);

      if (findError) {
        setErrorMsg("เกิดข้อผิดพลาดในการตรวจสอบโต๊ะ: " + findError.message);
        setLoading(false);
        return;
      }

      if (existing && existing.length > 0) {
        setOpenWarning(existing[0]);
        setLoading(false);
        return;
      }

      const { error: insertError } = await supabase.from("sessions").insert({
        table_number: tableNum,
        adult_count: adults,
        child_count: children,
        status: "open",
      });

      if (insertError) {
        setErrorMsg("เกิดข้อผิดพลาดในการเปิดโต๊ะ: " + insertError.message);
        setLoading(false);
        return;
      }

      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const url = `${origin}/order/${tableNum}`;

      setQrResult({
        tableNumber: tableNum,
        adultCount: adults,
        childCount: children,
        url,
      });
    } catch (err) {
      setErrorMsg("เกิดข้อผิดพลาดที่ไม่คาดคิด: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  function openConfirmDialog() {
    if (!openWarning) return;
    setConfirmElapsed(minutesSince(openWarning.created_at));
    setConfirmOpen(true);
  }

  function cancelConfirmDialog() {
    setConfirmOpen(false);
  }

  async function confirmCloseOldSession() {
    if (!openWarning) return;
    setClosing(true);
    setErrorMsg("");
    try {
      const { data, error } = await supabase
        .from("sessions")
        .update({ status: "closed" })
        .eq("id", openWarning.id)
        .eq("status", "open")
        .select("id");

      if (error) {
        setErrorMsg("เกิดข้อผิดพลาดในการปิดโต๊ะเดิม: " + error.message);
        setClosing(false);
        return;
      }

      if (!data || data.length === 0) {
        setErrorMsg(
          "โต๊ะนี้ถูกปิดไปแล้วโดยผู้ใช้อื่น กรุณากด \"เปิดโต๊ะ\" อีกครั้ง"
        );
        setOpenWarning(null);
        setConfirmOpen(false);
        setClosing(false);
        return;
      }

      // ปิดสำเร็จ: กลับไปฟอร์มเดิม ค่าที่กรอกไว้ยังอยู่ครบ
      setConfirmOpen(false);
      setOpenWarning(null);
    } catch (err) {
      setErrorMsg("เกิดข้อผิดพลาดที่ไม่คาดคิด: " + err.message);
    } finally {
      setClosing(false);
    }
  }

  async function copyLink() {
    if (!qrResult) return;
    try {
      await navigator.clipboard.writeText(qrResult.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setErrorMsg("คัดลอกลิงก์ไม่สำเร็จ กรุณาคัดลอกด้วยตนเอง");
    }
  }

  const qrImageSrc = qrResult
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
        qrResult.url
      )}`
    : null;

  return (
    <main className="page">
      <style>{`
        .page {
          min-height: 100vh;
          background: #f7f5f2;
          padding: 2rem 1.25rem;
          font-family: -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
          display: flex;
          justify-content: center;
        }
        .card {
          width: 100%;
          max-width: 480px;
        }
        h1 {
          font-size: 1.9rem;
          margin: 0 0 0.25rem;
          color: #1f2321;
        }
        .subtitle {
          color: #6b6f6c;
          margin: 0 0 1.5rem;
          font-size: 1rem;
        }
        .field {
          margin-bottom: 1.1rem;
        }
        label {
          display: block;
          font-size: 1.05rem;
          font-weight: 600;
          margin-bottom: 0.4rem;
          color: #2a2e2b;
        }
        input {
          width: 100%;
          font-size: 1.4rem;
          padding: 0.7rem 0.8rem;
          border-radius: 10px;
          border: 2px solid #d8d5cf;
          box-sizing: border-box;
        }
        input:focus {
          outline: none;
          border-color: #2f6f4e;
        }
        .btn {
          display: inline-block;
          width: 100%;
          font-size: 1.3rem;
          font-weight: 700;
          padding: 0.9rem 1rem;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          text-align: center;
        }
        .btn-primary {
          background: #2f6f4e;
          color: #fff;
        }
        .btn-primary:disabled {
          background: #9cb3a7;
          cursor: not-allowed;
        }
        .btn-danger {
          background: #d64545;
          color: #fff;
          margin-top: 0.9rem;
        }
        .btn-secondary {
          background: #fff;
          color: #2a2e2b;
          border: 2px solid #d8d5cf;
        }
        .btn-outline {
          background: transparent;
          color: #2f6f4e;
          border: 2px solid #2f6f4e;
        }
        .error {
          color: #b3261e;
          font-weight: 600;
          margin-bottom: 1rem;
        }
        .warning-box {
          background: #fff4e5;
          border: 2px solid #e8871e;
          border-radius: 12px;
          padding: 1.1rem;
          margin-bottom: 1.2rem;
        }
        .warning-box p {
          margin: 0 0 0.6rem;
          font-size: 1.15rem;
          font-weight: 700;
          color: #8a4b0a;
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
        .confirm-box {
          background: #fff;
          border-radius: 14px;
          padding: 1.5rem;
          max-width: 380px;
          width: 100%;
          border: 3px solid #d64545;
        }
        .confirm-box h2 {
          margin: 0 0 0.8rem;
          color: #b3261e;
          font-size: 1.3rem;
        }
        .confirm-box p {
          margin: 0.3rem 0;
          font-size: 1.1rem;
          color: #2a2e2b;
        }
        .confirm-actions {
          display: flex;
          gap: 0.7rem;
          margin-top: 1.2rem;
        }
        .confirm-actions .btn {
          font-size: 1.1rem;
          padding: 0.7rem;
        }
        .qr-result {
          text-align: center;
        }
        .qr-result img {
          width: 240px;
          height: 240px;
          margin: 0 auto 1rem;
          border-radius: 8px;
          border: 1px solid #d8d5cf;
        }
        .qr-summary {
          font-size: 1.2rem;
          font-weight: 700;
          color: #1f2321;
          margin-bottom: 0.5rem;
        }
        .qr-link-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          justify-content: center;
          margin-bottom: 1.4rem;
          flex-wrap: wrap;
        }
        .qr-link-row a {
          color: #2f6f4e;
          word-break: break-all;
          font-size: 0.95rem;
        }
        .copy-btn {
          font-size: 0.9rem;
          padding: 0.35rem 0.7rem;
          border-radius: 8px;
          border: 2px solid #2f6f4e;
          background: #fff;
          color: #2f6f4e;
          cursor: pointer;
          white-space: nowrap;
        }
      `}</style>

      <div className="card">
        <h1>เปิดโต๊ะ — Fun Bakery</h1>
        <p className="subtitle">กรอกข้อมูลลูกค้าเพื่อเปิดโต๊ะและสร้าง QR</p>

        {errorMsg && <div className="error">{errorMsg}</div>}

        {openWarning && !confirmOpen && (
          <div className="warning-box">
            <p>โต๊ะนี้มีลูกค้าอยู่ระหว่างทานอาหาร กรุณาปิดออเดอร์เดิมก่อน</p>
            <button
              type="button"
              className="btn btn-danger"
              onClick={openConfirmDialog}
            >
              ปิดออเดอร์เดิม
            </button>
          </div>
        )}

        {!qrResult && (
          <form onSubmit={handleOpenTable}>
            <div className="field">
              <label htmlFor="tableNumber">เลขโต๊ะ</label>
              <input
                id="tableNumber"
                type="number"
                inputMode="numeric"
                min="1"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="เช่น 7"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="adultCount">จำนวนผู้ใหญ่</label>
              <input
                id="adultCount"
                type="number"
                inputMode="numeric"
                min="1"
                value={adultCount}
                onChange={(e) => setAdultCount(e.target.value)}
                placeholder="เช่น 2"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="childCount">จำนวนเด็ก</label>
              <input
                id="childCount"
                type="number"
                inputMode="numeric"
                min="0"
                value={childCount}
                onChange={(e) => setChildCount(e.target.value)}
                placeholder="เช่น 1"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "กำลังเปิดโต๊ะ..." : "เปิดโต๊ะ"}
            </button>
          </form>
        )}

        {qrResult && (
          <div className="qr-result">
            <img src={qrImageSrc} alt={`QR โต๊ะ ${qrResult.tableNumber}`} />
            <div className="qr-summary">
              โต๊ะ {qrResult.tableNumber} · ผู้ใหญ่ {qrResult.adultCount} · เด็ก{" "}
              {qrResult.childCount}
            </div>
            <div className="qr-link-row">
              <a href={qrResult.url} target="_blank" rel="noreferrer">
                {qrResult.url}
              </a>
              <button type="button" className="copy-btn" onClick={copyLink}>
                {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
              </button>
            </div>
            <button
              type="button"
              className="btn btn-outline"
              onClick={resetForm}
            >
              เปิดโต๊ะใหม่
            </button>
          </div>
        )}
      </div>

      {confirmOpen && openWarning && (
        <div className="overlay">
          <div className="confirm-box">
            <h2>ยืนยันปิดโต๊ะเดิม</h2>
            <p>โต๊ะ {openWarning.table_number}</p>
            <p>
              ผู้ใหญ่ {openWarning.adult_count} · เด็ก{" "}
              {openWarning.child_count}
            </p>
            <p>เปิดมาแล้ว {confirmElapsed} นาที</p>
            <div className="confirm-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={cancelConfirmDialog}
                disabled={closing}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={confirmCloseOldSession}
                disabled={closing}
              >
                {closing ? "กำลังปิด..." : "ยืนยันปิดโต๊ะเดิม"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
