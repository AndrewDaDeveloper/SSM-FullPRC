/**
 * Web Worker for modal close animation orchestration
 * Handles timing orchestration off the main thread
 */

let uiFadeDuration: number = 0;
let animationDuration: number = 0;
let isRunning: boolean = false;
let animationFrameId: number | null = null;
let uiFadeCompleteSent: boolean = false;

// Message handler types
type InitMessage = { type: 'init' };
type StartMessage = { type: 'start'; duration: number; uiFadeDuration: number };
type WorkerMessage = InitMessage | StartMessage;

// Message handler
self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;
  
  switch (msg.type) {
    case 'init':
      // Ready to receive start command
      self.postMessage({ type: 'ready' });
      break;
      
    case 'start':
      animationDuration = msg.duration;
      uiFadeDuration = msg.uiFadeDuration;
      uiFadeCompleteSent = false;
      runAnimation();
      break;
  }
};

function runAnimation() {
  isRunning = true;
  const startTime = performance.now();
  
  function step(now: number) {
    if (!isRunning) return;
    
    const elapsed = now - startTime;
    const raw = Math.min(elapsed / animationDuration, 1);
    const uiProgress = Math.min(elapsed / uiFadeDuration, 1);
    
    // First phase: UI fade
    if (uiProgress < 1) {
      if (uiProgress > 0) {
        self.postMessage({ type: 'uiFadeStart' });
      }
    } 
    // Second phase: container dissolve
    else if (raw < 1) {
      if (!uiFadeCompleteSent) {
        uiFadeCompleteSent = true;
        self.postMessage({ type: 'uiFadeComplete' });
      }
    } 
    // Complete
    else {
      self.postMessage({ type: 'complete' });
      isRunning = false;
      return;
    }
    
    animationFrameId = requestAnimationFrame(step);
  }
  
  animationFrameId = requestAnimationFrame(step);
}
