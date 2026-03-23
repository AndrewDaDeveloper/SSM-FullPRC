"use client";
import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useSnapshot } from "valtio";
import styles from "./UIModal.module.css";
import { hudState, closeModal } from "@/lib/store/hudStore";

const MapPanel = dynamic(() => import("./MapPanel"), { ssr: false });

export default function UIModal() {
  const snap  = useSnapshot(hudState);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => setClosing(false), 500);
    closeModal();
  }, []);

  useEffect(() => {
    if (snap.modalOpen) requestAnimationFrame(() => setVisible(true));
    else setVisible(false);
  }, [snap.modalOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose]);

  if (!snap.modalOpen) return null;

  return (
    <div className={[styles.overlay, visible && styles.vis, closing && styles.closing].filter(Boolean).join(" ")}>
      <div className={styles.mapSection}>
        <div className={styles.mapViewport}>
          <MapPanel />
        </div>
      </div>
      <div className={styles.bottomBar}>
        <div className={styles.btnRow}>
          <button className={styles.enterBtn} onClick={closeModal}>ENTER</button>
          <button className={styles.closeBtn} onClick={handleClose}>CLOSE</button>
        </div>
        <span className={styles.escHint}>ESC TO DISMISS</span>
      </div>
    </div>
  );
}