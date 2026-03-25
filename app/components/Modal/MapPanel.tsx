"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as MaplibreMap, CustomRenderMethodInput } from "maplibre-gl";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const CX = 23.3219;
const CY = 42.6977;
const CENTER: [number, number] = [CX, CY];

const MODEL_LNG = 23.3328;
const MODEL_LAT = 42.7070;
const MODEL_SCALE_METERS = 3000;

const MAP_STYLE: any = {
  version: 8,
  sources: { omt: { type: "vector", url: "https://tiles.openfreemap.org/planet" } },
  layers: [
    { id: "bg", type: "background",     paint: { "background-color": "#000205" } },
    { id: "wt", type: "fill",           source: "omt", "source-layer": "water",    paint: { "fill-color": "#00060d" } },
    { id: "lu", type: "fill",           source: "omt", "source-layer": "landuse",  paint: { "fill-color": "#020408" } },
    { id: "bf", type: "fill",           source: "omt", "source-layer": "building", paint: { "fill-color": "#03060e", "fill-outline-color": "#0d0d0d" } },
    { id: "b3", type: "fill-extrusion", source: "omt", "source-layer": "building", minzoom: 13,
      paint: {
        "fill-extrusion-color":             ["interpolate",["linear"],["get","render_height"],0,"#090909",20,"#111111",60,"#1a1a1a",150,"#222222"],
        "fill-extrusion-height":            ["coalesce",["get","render_height"],0],
        "fill-extrusion-base":              ["coalesce",["get","render_min_height"],0],
        "fill-extrusion-opacity":           0.95,
        "fill-extrusion-vertical-gradient": false,
      },
    },
    { id: "rb",  type: "line", source: "omt", "source-layer": "transportation", filter: ["in",["get","class"],["literal",["motorway","trunk","primary","secondary","tertiary","minor","service"]]], paint: { "line-color": "#000", "line-width": 2 } },
    { id: "gmo", type: "line", source: "omt", "source-layer": "transportation", filter: ["in",["get","class"],["literal",["minor","tertiary","service"]]], paint: { "line-color": "#555", "line-width": 6,   "line-blur": 8,  "line-opacity": 0.18 } },
    { id: "gmm", type: "line", source: "omt", "source-layer": "transportation", filter: ["in",["get","class"],["literal",["minor","tertiary","service"]]], paint: { "line-color": "#888", "line-width": 1.5, "line-blur": 2,  "line-opacity": 0.35 } },
    { id: "gmc", type: "line", source: "omt", "source-layer": "transportation", filter: ["in",["get","class"],["literal",["minor","tertiary","service"]]], paint: { "line-color": "#aaa", "line-width": 0.6, "line-blur": 0,  "line-opacity": 0.55 } },
    { id: "gso", type: "line", source: "omt", "source-layer": "transportation", filter: ["==",["get","class"],"secondary"], paint: { "line-color": "#666", "line-width": 10,  "line-blur": 10, "line-opacity": 0.28 } },
    { id: "gsm", type: "line", source: "omt", "source-layer": "transportation", filter: ["==",["get","class"],"secondary"], paint: { "line-color": "#999", "line-width": 3,   "line-blur": 4,  "line-opacity": 0.5  } },
    { id: "gsc", type: "line", source: "omt", "source-layer": "transportation", filter: ["==",["get","class"],"secondary"], paint: { "line-color": "#ddd", "line-width": 0.8, "line-blur": 0,  "line-opacity": 0.85 } },
    { id: "gpo", type: "line", source: "omt", "source-layer": "transportation", filter: ["==",["get","class"],"primary"],   paint: { "line-color": "#777", "line-width": 14,  "line-blur": 12, "line-opacity": 0.32 } },
    { id: "gpm", type: "line", source: "omt", "source-layer": "transportation", filter: ["==",["get","class"],"primary"],   paint: { "line-color": "#aaa", "line-width": 4,   "line-blur": 5,  "line-opacity": 0.6  } },
    { id: "gpc", type: "line", source: "omt", "source-layer": "transportation", filter: ["==",["get","class"],"primary"],   paint: { "line-color": "#eee", "line-width": 1,   "line-blur": 0,  "line-opacity": 1    } },
    { id: "gxo", type: "line", source: "omt", "source-layer": "transportation", filter: ["in",["get","class"],["literal",["motorway","trunk"]]], paint: { "line-color": "#888", "line-width": 20,  "line-blur": 16, "line-opacity": 0.38 } },
    { id: "gxm", type: "line", source: "omt", "source-layer": "transportation", filter: ["in",["get","class"],["literal",["motorway","trunk"]]], paint: { "line-color": "#bbb", "line-width": 5,   "line-blur": 6,  "line-opacity": 0.7  } },
    { id: "gxc", type: "line", source: "omt", "source-layer": "transportation", filter: ["in",["get","class"],["literal",["motorway","trunk"]]], paint: { "line-color": "#fff", "line-width": 1.2, "line-blur": 0,  "line-opacity": 1    } },
  ],
};

type MapRef = MaplibreMap & { _ro?: ResizeObserver };

export default function MapPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<MapRef | null>(null);

  const [loaded, setLoaded]       = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [aboutPos, setAboutPos]   = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let destroyed = false;

    import("maplibre-gl").then(({ Map: MLMap, MercatorCoordinate }) => {
      if (destroyed) return;

      const map = new MLMap({
        container: containerRef.current!,
        style: MAP_STYLE,
        center: CENTER,
        zoom: 14.8, minZoom: 12, maxZoom: 18,
        pitch: 60, bearing: -20,
        attributionControl: false,
        interactive: true,
        dragPan: true, dragRotate: true, scrollZoom: true,
        boxZoom: false, keyboard: true, doubleClickZoom: true,
        touchZoomRotate: true, touchPitch: true, fadeDuration: 0,
      });

      const setPtr = () => map.getCanvas().style.setProperty("pointer-events", "auto", "important");
      setPtr();

      map.on("load", () => {
        if (destroyed) { map.remove(); return; }

        const origin        = MercatorCoordinate.fromLngLat([MODEL_LNG, MODEL_LAT], 0);
        const metersPerUnit = origin.meterInMercatorCoordinateUnits();
        const scale         = metersPerUnit * MODEL_SCALE_METERS;

        const whiteMaterial = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.6,
          metalness: 0.0,
        });

        let camera:   THREE.Camera        | null = null;
        let scene:    THREE.Scene         | null = null;
        let renderer: THREE.WebGLRenderer | null = null;

        const customLayer = {
          id: "citadel-model",
          type: "custom" as const,
          renderingMode: "3d" as const,

          onAdd(_map: MaplibreMap, gl: WebGLRenderingContext) {
            camera = new THREE.Camera();
            scene  = new THREE.Scene();

            scene.add(new THREE.AmbientLight(0xffffff, 0.8));

            const sun = new THREE.DirectionalLight(0xffffff, 1.4);
            sun.position.set(1, -1, 2).normalize();
            scene.add(sun);

            const fill = new THREE.DirectionalLight(0xddeeff, 0.5);
            fill.position.set(-1, 0.5, 0.5).normalize();
            scene.add(fill);

            new GLTFLoader().load(
              "/Citadel.glb",
              (gltf: { scene: THREE.Group }) => {
                const model = gltf.scene;

                model.traverse((child) => {
                  if ((child as THREE.Mesh).isMesh) {
                    (child as THREE.Mesh).material = whiteMaterial;
                  }
                });

                const box = new THREE.Box3().setFromObject(model);
                const size = new THREE.Vector3();
                box.getSize(size);
                const maxDim = Math.max(size.x, size.y, size.z);
                model.scale.setScalar(1 / maxDim);

                const groundedBox = new THREE.Box3().setFromObject(model);
                model.position.y -= groundedBox.min.y;

                scene!.add(model);
                map.triggerRepaint();
              },
              undefined,
              (err: unknown) => console.error("GLTFLoader error:", err),
            );

            renderer = new THREE.WebGLRenderer({
              canvas: map.getCanvas(),
              context: gl,
              antialias: true,
            });
            renderer.autoClear = false;
          },

          render(_gl: WebGLRenderingContext, options: CustomRenderMethodInput) {
            if (!camera || !scene || !renderer) return;

            const matrix = new THREE.Matrix4().fromArray(
              options.defaultProjectionData.mainMatrix,
            );

            const localMatrix = new THREE.Matrix4()
              .makeTranslation(origin.x, origin.y, origin.z ?? 0)
              .scale(new THREE.Vector3(scale, -scale, scale))
              .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));

            camera.projectionMatrix = matrix.multiply(localMatrix);
            renderer.resetState();
            renderer.render(scene, camera);
            map.triggerRepaint();
          },
        };

        map.addLayer(customLayer);
        setPtr();
        setLoaded(true);

        map.on("click", (e: any) => {
          if (map.queryRenderedFeatures(e.point, { layers: ["b3", "bf"] }).length) {
            setAboutPos({ x: e.point.x, y: e.point.y });
            setAboutOpen(true);
          }
        });
      });

      map.on("idle", setPtr);

      const ro = new ResizeObserver(() => { if (!destroyed) map.resize(); });
      if (containerRef.current) ro.observe(containerRef.current);

      const m = map as MapRef;
      m._ro = ro;
      mapRef.current = m;
    });

    return () => {
      destroyed = true;
      mapRef.current?._ro?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div
      style={{ position: "relative", width: "100%", height: "100%", cursor: "grab", touchAction: "pan-x pan-y" }}
      onMouseDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
      onMouseMove={e => e.stopPropagation()}
      onTouchMove={e => e.stopPropagation()}
      onWheel={e => e.stopPropagation()}
    >
      {!loaded && <MapSkeleton />}
      <div ref={containerRef} style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }} />
      {aboutOpen && <AboutPanel x={aboutPos.x} y={aboutPos.y} onClose={() => setAboutOpen(false)} />}
    </div>
  );
}

function MapSkeleton() {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 10, background: "#060608", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        width: 28, height: 28,
        border: "1.5px solid rgba(255,255,255,0.12)",
        borderTopColor: "rgba(255,255,255,0.4)",
        borderRadius: "50%",
        animation: "skspin 0.9s linear infinite",
      }} />
      <style>{`@keyframes skspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function AboutPanel({ x, y, onClose }: { x: number; y: number; onClose: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const PW = 260, PH = 180;
  const vw = typeof window !== "undefined" ? window.innerWidth  : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const left = Math.min(Math.max(x - PW / 2, 12), vw - PW - 12);
  const top  = Math.min(Math.max(y - PH - 24, 12), vh - PH - 12);

  return (
    <>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 100, cursor: "default" }} />
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: "absolute", left, top, width: PW, zIndex: 200,
          borderRadius: 18,
          background: "rgba(255,255,255,0.045)",
          backdropFilter: "blur(28px) saturate(1.6)",
          WebkitBackdropFilter: "blur(28px) saturate(1.6)",
          border: "1px solid rgba(255,255,255,0.13)",
          boxShadow: "0 8px 48px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.12)",
          padding: "28px 26px 22px",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0) scale(1)" : "translateY(10px) scale(0.97)",
          transition: "opacity 0.35s cubic-bezier(0.16,1,0.3,1),transform 0.35s cubic-bezier(0.16,1,0.3,1)",
          pointerEvents: "all",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "60%", height: 1, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)" }} />
        <button
          onClick={onClose}
          style={{ position: "absolute", top: 12, right: 14, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 13, lineHeight: 1, padding: 4, transition: "color 0.2s" }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
        >✕</button>
        <div style={{ fontFamily: "var(--font-press-start), monospace", fontSize: 7, letterSpacing: "0.22em", color: "rgba(255,255,255,0.28)", textTransform: "uppercase", marginBottom: 14 }}>ABOUT US</div>
        <div style={{ fontFamily: "var(--font-press-start), monospace", fontSize: 11, lineHeight: 1.9, color: "rgba(255,255,255,0.88)", letterSpacing: "0.04em" }}>we are rebel faction</div>
        <div style={{ marginTop: 20, height: 1, background: "linear-gradient(90deg,rgba(255,255,255,0.06),rgba(255,255,255,0.14),rgba(255,255,255,0.06))" }} />
        <div style={{ marginTop: 14, display: "flex", gap: 6, alignItems: "center" }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: i === 0 ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.15)" }} />
          ))}
        </div>
        <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "40%", height: 1, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)" }} />
      </div>
    </>
  );
}