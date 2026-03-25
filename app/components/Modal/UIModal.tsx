"use client";
import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useSnapshot } from "valtio";
import styles from "./UIModal.module.css";
import { hudState, closeModal } from "@/lib/store/hudStore";

interface UIModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const MapPanel = dynamic(() => import("./MapPanel"), { ssr: false });

export default function UIModal({ isOpen, onClose }: UIModalProps) {
  const snap = useSnapshot(hudState);
  const [visible, setVisible] = useState(false);
  const [uiFading, setUIFading] = useState(false);
  const [closing, setClosing] = useState(false);
  
  const isModalOpen = isOpen ?? snap.modalOpen;
  
  const handleClose = useCallback(() => {
    if (uiFading || closing) return;
    
    // Phase 1: fade out UI elements
    setUIFading(true);
    
    // Phase 2: fade out container after UI elements
    setTimeout(() => {
      setUIFading(false);
      setClosing(true);
      
      // Phase 3: actually close after container fade
      setTimeout(() => {
        if (onClose) {
          onClose();
        } else {
          closeModal();
        }
        setClosing(false);
        setVisible(false);
      }, 500);
    }, 400);
  }, [uiFading, closing, onClose]);
  
  // Handle ESC key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { 
      if (e.key === "Escape" && isModalOpen && !uiFading && !closing) {
        handleClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isModalOpen, handleClose, uiFading, closing]);
  
  // Handle visibility
  useEffect(() => {
    if (isModalOpen) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setUIFading(false);
      setClosing(false);
      setVisible(false);
    }
  }, [isModalOpen]);
  
  if (!isModalOpen && !visible) return null;
  
  return (
    <div 
      className={[
        styles.overlay, 
        visible && styles.vis,
        closing && styles.closing
      ].filter(Boolean).join(" ")}
    >
      <div className={styles.mapSection}>
        <div className={styles.mapViewport}>
          <MapPanel />
        </div>
      </div>
      
      <div 
        className={[
          styles.bottomBar, 
          uiFading && styles.uiFading
        ].filter(Boolean).join(" ")}
      >
        <div className={[
          styles.btnRow, 
          uiFading && styles.uiFading
        ].filter(Boolean).join(" ")}>
          <button 
            className={[
              styles.enterBtn, 
              uiFading && styles.uiFading
            ].filter(Boolean).join(" ")}
            onClick={() => {
              if (onClose) onClose();
              else closeModal();
            }}
          >
            ENTER
          </button>
          <button 
            className={[
              styles.closeBtn, 
              uiFading && styles.uiFading
            ].filter(Boolean).join(" ")}
            onClick={handleClose}
            disabled={uiFading || closing}
          >
            CLOSE
          </button>
        </div>
        <span className={[
          styles.escHint, 
          uiFading && styles.uiFading
        ].filter(Boolean).join(" ")}>ESC TO DISMISS</span>
      </div>
    </div>
  );
}
