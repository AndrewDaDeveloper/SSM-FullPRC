import { proxy, subscribe, snapshot } from 'valtio';
import { subscribeKey, watch }        from 'valtio/utils';

export type AppPhase =
  | 'booting'
  | 'hud-building'
  | 'ready'
  | 'modal-open'
  | 'corridor'
  | 'error';

export type MapMode = 'overview' | 'sector' | 'detail';

export type SystemAlert = {
  id:        string;
  level:     'info' | 'warn' | 'critical';
  message:   string;
  expiresAt: number;
};

export type BusEvent =
  | { type: 'PHASE_CHANGE';      payload: { from: AppPhase; to: AppPhase } }
  | { type: 'MODAL_OPEN'  }
  | { type: 'MODAL_CLOSE' }
  | { type: 'VFX_READY'   }
  | { type: 'BOOT_DISMISSED' }
  | { type: 'CORRIDOR_START' }
  | { type: 'CORRIDOR_END'   }
  | { type: 'SECTOR_SELECT'; payload: { sector: string | null } }
  | { type: 'ALERT_ADDED';   payload: SystemAlert }
  | { type: 'ALERT_EXPIRED'; payload: { id: string } }
  | { type: 'WEBGL_UNAVAILABLE' };

type BusListener = (event: BusEvent) => void;

export interface HUDState {
  phase:           AppPhase;
  prevPhase:       AppPhase;
  phaseChangedAt:  number;
  modalOpen:       boolean;
  webglAvailable:  boolean;
  vfxReady:        boolean;
  bootDismissed:   boolean;
  corridorActive:  boolean;
  fps:             number;
  hudTLText:       string;
  hudBRText:       string;
  tickerText:      string;
  frameLabel:      string;
  mapMode:         MapMode;
  selectedSector:  string | null;
  alerts:          SystemAlert[];
}

export interface DerivedState {
  hudVisible:     boolean;
  isBooting:      boolean;
  isReady:        boolean;
  systemOnline:   boolean;
  inTransition:   boolean;
  criticalAlerts: SystemAlert[];
  hasAlerts:      boolean;
  mapInteractive: boolean;
}

export const hudState = proxy<HUDState>({
  phase:           'booting',
  prevPhase:       'booting',
  phaseChangedAt:  Date.now(),
  modalOpen:       false,
  webglAvailable:  true,
  vfxReady:        false,
  bootDismissed:   false,
  corridorActive:  false,
  fps:             0,
  hudTLText:       'SYS·ACTIVE\nINP·LOCKED\nVER 2.4.1',
  hudBRText:       'SECTOR 17·C\nNODE 0x4A3F\nSIGNAL ████',
  tickerText:
    'PROTOCOL·ACTIVE \u00a0··\u00a0 UPLINK·ESTABLISHED \u00a0··\u00a0 ' +
    'SCANNING·ENVIRONMENT \u00a0··\u00a0 DATA·INTEGRITY·99.7% \u00a0··\u00a0 ' +
    'CITY·17·SECTOR·DELTA \u00a0··\u00a0 RESISTANCE·ACTIVE \u00a0··\u00a0',
  frameLabel:      'FRAME·REF',
  mapMode:         'overview',
  selectedSector:  null,
  alerts:          [],
});

export const derived = proxy<DerivedState>({
  hudVisible:     true,
  isBooting:      true,
  isReady:        false,
  systemOnline:   false,
  inTransition:   false,
  criticalAlerts: [],
  hasAlerts:      false,
  mapInteractive: false,
});

function syncDerived() {
  derived.hudVisible     = !hudState.modalOpen;
  derived.isBooting      = hudState.phase === 'booting';
  derived.isReady        = hudState.phase === 'ready';
  derived.systemOnline   = hudState.webglAvailable && hudState.vfxReady;
  derived.inTransition   = hudState.corridorActive;
  derived.criticalAlerts = hudState.alerts.filter((a: SystemAlert) => a.level === 'critical');
  derived.hasAlerts      = hudState.alerts.length > 0;
  derived.mapInteractive = hudState.phase === 'modal-open' && !hudState.corridorActive;
}

subscribe(hudState, syncDerived);

function createBus() {
  const listeners = new Set<BusListener>();
  return {
    emit(event: BusEvent) {
      listeners.forEach(fn => {
        try { fn(event); } catch (err) { console.error('[HUD Bus]', err); }
      });
    },
    on(fn: BusListener): () => void {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    once<T extends BusEvent['type']>(
      type: T,
      fn:   (event: Extract<BusEvent, { type: T }>) => void
    ): () => void {
      const off = this.on((e: BusEvent) => {
        if (e.type === type) {
          off();
          fn(e as Extract<BusEvent, { type: T }>);
        }
      });
      return off;
    },
  };
}

export const bus = createBus();

function _setPhase(next: AppPhase) {
  const prev = hudState.phase;
  if (prev === next) return;
  hudState.prevPhase      = prev;
  hudState.phase          = next;
  hudState.phaseChangedAt = Date.now();
  bus.emit({ type: 'PHASE_CHANGE', payload: { from: prev, to: next } });
}

export function openModal() {
  hudState.modalOpen = true;
  _setPhase('modal-open');
  bus.emit({ type: 'MODAL_OPEN' });
}

export function closeModal() {
  hudState.modalOpen = false;
  _setPhase(hudState.vfxReady ? 'ready' : 'hud-building');
  bus.emit({ type: 'MODAL_CLOSE' });
}

export function dismissBoot() {
  hudState.bootDismissed = true;
  _setPhase('hud-building');
  bus.emit({ type: 'BOOT_DISMISSED' });
}

export function markHUDReady() {
  if (hudState.phase === 'hud-building') _setPhase('ready');
}

export function markVFXReady() {
  hudState.vfxReady = true;
  bus.emit({ type: 'VFX_READY' });
}

export function markWebGLUnavailable() {
  hudState.webglAvailable = false;
  _setPhase('error');
  bus.emit({ type: 'WEBGL_UNAVAILABLE' });
}

export function startCorridor() {
  hudState.corridorActive = true;
  bus.emit({ type: 'CORRIDOR_START' });
}

export function endCorridor() {
  hudState.corridorActive = false;
  bus.emit({ type: 'CORRIDOR_END' });
}

export function updateFPS(fps: number) {
  hudState.fps = fps;
}

export function selectSector(sector: string | null) {
  hudState.selectedSector = sector;
  hudState.mapMode        = sector ? 'sector' : 'overview';
  bus.emit({ type: 'SECTOR_SELECT', payload: { sector } });
}

export function setMapMode(mode: MapMode) {
  hudState.mapMode = mode;
}

export function setHUDText(
  slot: 'hudTLText' | 'hudBRText' | 'tickerText' | 'frameLabel',
  text: string
) {
  hudState[slot] = text;
}

let _alertSeq = 0;

export function addAlert(
  message: string,
  level:   SystemAlert['level'] = 'info',
  ttl      = 5000
): string {
  const id    = `alert-${Date.now()}-${_alertSeq++}`;
  const alert: SystemAlert = { id, level, message, expiresAt: Date.now() + ttl };
  hudState.alerts.push(alert);
  bus.emit({ type: 'ALERT_ADDED', payload: alert });
  setTimeout(() => {
    hudState.alerts = hudState.alerts.filter((a: SystemAlert) => a.id !== id);
    bus.emit({ type: 'ALERT_EXPIRED', payload: { id } });
  }, ttl);
  return id;
}

export function dismissAlert(id: string) {
  hudState.alerts = hudState.alerts.filter((a: SystemAlert) => a.id !== id);
}

type Unsubscribe = () => void;

export function onPhaseChange(cb: (next: AppPhase, prev: AppPhase) => void): Unsubscribe {
  let prev = hudState.phase;
  return subscribeKey(hudState, 'phase', (next: AppPhase) => {
    cb(next, prev);
    prev = next;
  });
}

export function onModalToggle(cb: (open: boolean) => void): Unsubscribe {
  return subscribeKey(hudState, 'modalOpen', cb);
}

export function onVFXReady(cb: () => void): Unsubscribe {
  if (hudState.vfxReady) { cb(); return () => {}; }
  return subscribeKey(hudState, 'vfxReady', (ready: boolean) => {
    if (ready) cb();
  });
}

export function onSystemOnline(cb: () => void): Unsubscribe {
  const check = () => hudState.webglAvailable && hudState.vfxReady;
  if (check()) { cb(); return () => {}; }
  return subscribe(hudState, () => { if (check()) cb(); });
}

type Snap = Readonly<HUDState>;

export const selectModal   = (s: Snap) => ({ modalOpen:  s.modalOpen });
export const selectPhase   = (s: Snap) => ({ phase: s.phase, prevPhase: s.prevPhase });
export const selectSystem  = (s: Snap) => ({ webglAvailable: s.webglAvailable, vfxReady: s.vfxReady, fps: s.fps });
export const selectHUDText = (s: Snap) => ({ hudTLText: s.hudTLText, hudBRText: s.hudBRText, tickerText: s.tickerText, frameLabel: s.frameLabel });
export const selectMap     = (s: Snap) => ({ mapMode: s.mapMode, selectedSector: s.selectedSector });
export const selectAlerts  = (s: Snap) => ({ alerts: s.alerts });

const PERSIST_KEY = 'ssm:hud:session';
type PersistedSlice = Pick<HUDState, 'bootDismissed' | 'selectedSector' | 'mapMode'>;

export function hydrateFromSession() {
  try {
    const raw = sessionStorage.getItem(PERSIST_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Partial<PersistedSlice>;
    if (saved.bootDismissed  !== undefined) hudState.bootDismissed  = saved.bootDismissed;
    if (saved.selectedSector !== undefined) hudState.selectedSector = saved.selectedSector;
    if (saved.mapMode        !== undefined) hudState.mapMode        = saved.mapMode;
  } catch { }
}

export function persistToSession() {
  try {
    const s = snapshot(hudState);
    sessionStorage.setItem(PERSIST_KEY, JSON.stringify({
      bootDismissed:  s.bootDismissed,
      selectedSector: s.selectedSector,
      mapMode:        s.mapMode,
    }));
  } catch { }
}

subscribe(hudState, persistToSession);

if (process.env.NODE_ENV === 'development') {
  watch((get) => {
    const s = get(hudState);
    console.groupCollapsed(
      `%c[HUD] %c${s.phase}%c  fps:${s.fps.toFixed(0)}  modal:${s.modalOpen}  vfx:${s.vfxReady}`,
      'color:#666;font-weight:normal',
      'color:#7df;font-weight:bold',
      'color:#888;font-weight:normal',
    );
    console.table({
      phase:          s.phase,
      modalOpen:      s.modalOpen,
      vfxReady:       s.vfxReady,
      webglAvailable: s.webglAvailable,
      bootDismissed:  s.bootDismissed,
      corridorActive: s.corridorActive,
      mapMode:        s.mapMode,
      selectedSector: s.selectedSector,
      alerts:         s.alerts.length,
    });
    console.groupEnd();
  });

  bus.on((e: BusEvent) => {
    console.log(
      `%c[BUS] %c${e.type}`,
      'color:#fa0;font-weight:normal',
      'color:#fff;font-weight:bold',
      'payload' in e ? (e as BusEvent & { payload?: unknown }).payload : '',
    );
  });

  if (typeof window !== 'undefined') {
    (window as any).__HUD__ = {
      state:   hudState,
      derived,
      bus,
      actions: {
        openModal, closeModal, dismissBoot, markHUDReady,
        markVFXReady, markWebGLUnavailable, startCorridor, endCorridor,
        selectSector, setMapMode, addAlert, dismissAlert, setHUDText,
      },
      snap: () => snapshot(hudState),
    };
    console.info('%c[HUD] __HUD__ exposed on window', 'color:#7df');
  }
}