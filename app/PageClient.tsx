'use client';
import { useEffect } from 'react';
import { initBootScreen } from '../lib/interface/bootScreen';
import { initVFX } from '../lib/vfxShaders/initVFX';
import UIModal from './components/Modal/UIModal';
import ErrorBoundary from './components/ErrorBoundary';

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return gl instanceof WebGLRenderingContext;
  } catch {
    return false;
  }
}

function showWebGLError(): void {
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;inset:0;background:#000;color:#fff;display:flex;flex-direction:column;' +
    'align-items:center;justify-content:center;font-family:monospace;z-index:999999;padding:20px;text-align:center;';
  el.innerHTML =
    '<h1 style="color:#ff4444;margin-bottom:20px;">WebGL Not Available</h1>' +
    '<p style="max-width:500px;line-height:1.6;">Your browser does not support WebGL. ' +
    'Please enable hardware acceleration or try a different browser.</p>';
  document.body.appendChild(el);
}

function useVFXInit() {
  useEffect(() => {
    if (!isWebGLAvailable()) {
      showWebGLError();
      return;
    }
    const vfx = initVFX();
    return () => vfx.destroy();
  }, []);
}

function useBootScreen() {
  useEffect(() => {
    initBootScreen();
  }, []);
}

export default function PageClient() {
  useBootScreen();
  useVFXInit();

  return (
    <ErrorBoundary>
      <UIModal />
    </ErrorBoundary>
  );
}