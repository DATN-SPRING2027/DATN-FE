"use client";

import * as React from "react";
import * as THREE from "three";
import { useTranslations } from "next-intl";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type {
  NeuralCortexSceneProps,
  NeuralCortexSceneHandle,
} from "./neural-atlas-contract";
import type { UniverseSceneUnavailableReason } from "./universe-webgl-capability";
import styles from "./neural-atlas.module.css";
import {
  ATLAS_FRAMING,
  atlasSeed as seed,
  atlasConnectionCurve,
  buildAtlasLayout,
  projectAtlasLabel,
} from "./neural-atlas-layout";
import { atlasNodeView } from "./neural-atlas-camera";

export interface NeuralAtlasSceneHandle extends NeuralCortexSceneHandle {
  zoomIn: () => void;
  zoomOut: () => void;
}

type Props = NeuralCortexSceneProps & {
  onUnavailable: (reason: UniverseSceneUnavailableReason) => void;
  keyboardHint: string;
  sceneRef?: React.Ref<NeuralAtlasSceneHandle>;
};

const COPPER = "#b97b42";
const COLORS = ["#87977e", "#7f8c77", "#746d75", "#8f7e69", "#789887"];

interface NodeVisualRecord {
  key: string;
  group: number;
  baseRadius: number;
  pearlOffset: number;
  isMatched: boolean;
  position: THREE.Vector3;
  mesh: THREE.Mesh;
  material: THREE.MeshPhysicalMaterial;
  hitTarget: THREE.Mesh;
  sprite: THREE.Sprite;
  spriteMaterial: THREE.SpriteMaterial;
}

interface EdgeVisualRecord {
  sourceKey: string;
  targetKey: string;
  sourceGroup: number;
  targetGroup: number;
  cross: boolean;
  material: THREE.LineBasicMaterial;
}

interface EvidenceLineRecord {
  colorAttribute: THREE.Float32BufferAttribute;
  segmentGroups: readonly number[];
}

interface BeaconVisualRecord {
  mesh: THREE.InstancedMesh;
  groups: readonly number[];
}

function disposeMaterialTextures(
  material: THREE.Material,
  sharedTextures?: ReadonlySet<THREE.Texture>,
) {
  const record = material as unknown as Record<string, unknown>;
  for (const value of Object.values(record)) {
    if (
      value instanceof THREE.Texture &&
      (!sharedTextures || !sharedTextures.has(value))
    ) {
      value.dispose();
    }
  }
}

function createGlow() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,.9)");
    gradient.addColorStop(0.18, "rgba(255,255,255,.4)");
    gradient.addColorStop(0.5, "rgba(255,255,255,.08)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(canvas);
}

function disposeNetwork(
  group: THREE.Group,
  sharedTextures?: ReadonlySet<THREE.Texture>,
) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  group.traverse((object) => {
    if (object instanceof THREE.InstancedMesh) object.dispose();
    if (
      object instanceof THREE.Mesh ||
      object instanceof THREE.Line ||
      object instanceof THREE.Sprite
    ) {
      if ("geometry" in object) geometries.add(object.geometry);
      (Array.isArray(object.material)
        ? object.material
        : [object.material]
      ).forEach((material) => materials.add(material));
    }
  });
  group.clear();
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => {
    disposeMaterialTextures(material, sharedTextures);
    material.dispose();
  });
}

export const NeuralAtlasScene = React.forwardRef<NeuralAtlasSceneHandle, Props>(
  function NeuralAtlasScene(props, ref) {
    const t = useTranslations("knowledgeUniverse");
    const containerRef = React.useRef<HTMLDivElement>(null);
    const labelsRef = React.useRef<HTMLDivElement>(null);
    const latest = React.useRef(props);
    React.useEffect(() => {
      latest.current = props;
    });
    const [hovered, setHovered] = React.useState<string | null>(null);
    const hoveringRegionRef = React.useRef(false);
    const positions = React.useRef(new Map<string, THREE.Vector3>());
    const fitKey = React.useRef("");
    const hostSizeRef = React.useRef({ width: 0, height: 0 });
    const labelSizeMapRef = React.useRef(
      new WeakMap<HTMLElement, { width: number; height: number }>(),
    );
    const labelStyleCacheRef = React.useRef(
      new WeakMap<
        HTMLElement,
        {
          visibility: string;
          transform: string;
          anchorX: string;
          anchorY: string;
          leaderLength: string;
          leaderAngle: string;
        }
      >(),
    );
    const stateRef = React.useRef<{
      camera: THREE.PerspectiveCamera;
      controls: OrbitControls;
      network: THREE.Group;
      bokeh: BokehPass;
      glow: THREE.CanvasTexture;
      sharedTextures: Set<THREE.Texture>;
      pickable: THREE.Mesh[];
      ring: THREE.Mesh | null;
      nodeVisuals: Map<string, NodeVisualRecord>;
      edgeVisuals: EdgeVisualRecord[];
      evidenceLine: EvidenceLineRecord | null;
      beaconVisual: BeaconVisualRecord | null;
      dirty: boolean;
    } | null>(null);
    const flight = React.useRef<{
      from: THREE.Vector3;
      to: THREE.Vector3;
      start: number;
      targetFrom: THREE.Vector3;
      targetTo: THREE.Vector3;
    } | null>(null);

    const layout = React.useMemo(
      () =>
        buildAtlasLayout({
          neurons: props.neurons,
          regions: props.regions,
          edges: props.edges,
          filterMode: props.filterMode,
        }),
      [props.neurons, props.regions, props.edges, props.filterMode],
    );
    const layoutRef = React.useRef(layout);
    React.useEffect(() => {
      layoutRef.current = layout;
    }, [layout]);

    const moveCamera = React.useCallback(
      (position: THREE.Vector3, target: THREE.Vector3, animate = true) => {
        const state = stateRef.current;
        if (!state) return;
        const from = state.camera.position.clone();
        const targetFrom = state.controls.target.clone();
        state.controls.enableDamping = false;
        state.controls.update();
        state.camera.position.copy(from);
        state.controls.target.copy(targetFrom);
        state.controls.update();
        state.controls.enableDamping = true;
        flight.current = null;
        state.dirty = true;
        if (animate && !latest.current.reducedMotion) {
          flight.current = {
            from,
            to: position,
            start: performance.now(),
            targetFrom,
            targetTo: target,
          };
        } else {
          state.camera.position.copy(position);
          state.controls.target.copy(target);
          state.controls.update();
        }
      },
      [],
    );

    const focusNode = React.useCallback(
      (key: string, animate = true) => {
        const state = stateRef.current;
        const host = containerRef.current;
        const position = positions.current.get(key);
        const hostWidth = hostSizeRef.current.width || host?.clientWidth || 0;
        const hostHeight = hostSizeRef.current.height || host?.clientHeight || 0;
        if (!state || !host || !position || !hostWidth || !hostHeight) {
          return;
        }
        const bounds = host.getBoundingClientRect();
        const panel = host
          .closest("[data-universe-knowledge]")
          ?.querySelector("[data-universe-detail-panel]")
          ?.getBoundingClientRect();
        let right = bounds.width;
        let bottom = bounds.height;
        if (panel && panel.top < bounds.bottom && panel.bottom > bounds.top) {
          if (panel.width < bounds.width * 0.75) {
            right = Math.max(bounds.width * 0.35, panel.left - bounds.left - 24);
          } else {
            bottom = Math.max(
              bounds.height * 0.25,
              panel.top - bounds.top - 24,
            );
          }
        }
        const radius = Math.max(
          95,
          (layoutRef.current.points.get(key)?.radius ?? 9) * 12,
        );
        const view = atlasNodeView(state.camera, position, radius, {
          width: bounds.width,
          height: bounds.height,
          right,
          bottom,
        });
        moveCamera(view.position, view.target, animate);
      },
      [moveCamera],
    );

    const fit = React.useCallback(
      (animate = true) => {
        const state = stateRef.current;
        if (!state) return;
        state.dirty = true;
        if (!layoutRef.current.points.size) return;
        const box = new THREE.Box3()
          .setFromPoints([
            ...[...layoutRef.current.points.values()].map(
              (point) => point.position,
            ),
            ...layoutRef.current.beacons.map((beacon) => beacon.position),
          ])
          .expandByScalar(35);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const tangent = Math.tan(THREE.MathUtils.degToRad(state.camera.fov / 2));
        const distance =
          Math.max(
            size.y / (2 * tangent),
            size.x / (2 * tangent * state.camera.aspect),
          ) *
            1.1 +
          size.z * 0.5;
        const destination = center
          .clone()
          .add(new THREE.Vector3(0, 0, Math.max(440, distance)));
        if (
          animate &&
          !latest.current.reducedMotion &&
          state.camera.position.distanceTo(destination) < 220
        ) {
          state.camera.position.copy(
            destination.clone().add(new THREE.Vector3(0, 26, 340)),
          );
          state.controls.target.copy(
            center.clone().add(new THREE.Vector3(0, -18, 0)),
          );
          state.controls.update();
        }
        moveCamera(destination, center, animate);
      },
      [moveCamera],
    );

    const handleFactory = React.useCallback(
      (): NeuralAtlasSceneHandle => ({
        focusAll: () => fit(),
        focusNode,
        zoomIn: () => {
          const state = stateRef.current;
          if (state) {
            flight.current = null;
            state.camera.position
              .sub(state.controls.target)
              .multiplyScalar(0.82)
              .add(state.controls.target);
            state.controls.update();
            state.dirty = true;
          }
        },
        zoomOut: () => {
          const state = stateRef.current;
          if (state) {
            flight.current = null;
            state.camera.position
              .sub(state.controls.target)
              .multiplyScalar(1.22)
              .add(state.controls.target);
            state.controls.update();
            state.dirty = true;
          }
        },
      }),
      [fit, focusNode],
    );

    React.useImperativeHandle(ref, handleFactory, [handleFactory]);
    React.useImperativeHandle(props.sceneRef, handleFactory, [handleFactory]);

    React.useEffect(() => {
      const host = containerRef.current;
      if (!host) return;
      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          powerPreference: "high-performance",
        });
      } catch {
        latest.current.onUnavailable("context-creation");
        return;
      }
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#1b2024");
      scene.fog = new THREE.FogExp2("#1b2024", 0.00035);
      const camera = new THREE.PerspectiveCamera(
        ATLAS_FRAMING.fov,
        1,
        1,
        3500,
      );
      camera.position.set(0, 0, ATLAS_FRAMING.distance);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      host.appendChild(renderer.domElement);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.09;
      controls.rotateSpeed = 0.45;
      controls.minDistance = 120;
      controls.maxDistance = 2800;
      const pmrem = new THREE.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      const environment = pmrem.fromScene(room, 0.04);
      scene.environment = environment.texture;
      scene.environmentIntensity = 0.9;
      room.dispose();
      pmrem.dispose();
      scene.add(new THREE.AmbientLight("#e3ddd1", 0.4));
      const keyLight = new THREE.DirectionalLight("#fff2dc", 2.8);
      keyLight.position.set(-300, 400, 500);
      scene.add(keyLight);
      const fill = new THREE.DirectionalLight("#b0c6bd", 0.45);
      fill.position.set(80, -100, 120);
      scene.add(fill);
      const network = new THREE.Group();
      scene.add(network);
      const glow = createGlow();
      const sharedTextures = new Set<THREE.Texture>([glow]);
      const target = new THREE.WebGLRenderTarget(1, 1, {
        type: THREE.HalfFloatType,
        samples: Math.min(4, renderer.capabilities.maxSamples),
      });
      const composer = new EffectComposer(renderer, target);
      const renderPass = new RenderPass(scene, camera);
      const bokeh = new BokehPass(scene, camera, {
        focus: 800,
        aperture: 0.000009,
        maxblur: 0.004,
      });
      const outputPass = new OutputPass();
      composer.addPass(renderPass);
      composer.addPass(bokeh);
      composer.addPass(outputPass);
      const state = {
        camera,
        controls,
        network,
        bokeh,
        glow,
        sharedTextures,
        pickable: [] as THREE.Mesh[],
        ring: null as THREE.Mesh | null,
        nodeVisuals: new Map<string, NodeVisualRecord>(),
        edgeVisuals: [] as EdgeVisualRecord[],
        evidenceLine: null as EvidenceLineRecord | null,
        beaconVisual: null as BeaconVisualRecord | null,
        dirty: true,
      };
      stateRef.current = state;
      const interruptFlight = () => {
        flight.current = null;
        state.dirty = true;
      };
      controls.addEventListener("start", interruptFlight);
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const scratchVec = new THREE.Vector3();
      let down = { x: 0, y: 0 };
      let pointerActive = false;
      let frameId = 0;
      let lastFrame = 0;
      let visible = true;
      let pageVisible = document.visibilityState !== "hidden";
      const hit = (event: MouseEvent) => {
        const bounds = renderer.domElement.getBoundingClientRect();
        pointer.set(
          ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
          -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
        );
        raycaster.setFromCamera(pointer, camera);
        const intersection = raycaster.intersectObjects(state.pickable, false)[0];
        return intersection
          ? ((intersection.instanceId === undefined
              ? intersection.object.userData.key
              : intersection.object.userData.keys?.[
                  intersection.instanceId
                ]) as string | undefined)
          : undefined;
      };
      const pointerDown = (event: PointerEvent) => {
        down = { x: event.clientX, y: event.clientY };
        pointerActive = true;
        flight.current = null;
      };
      const pointerMove = (event: PointerEvent) => {
        if (event.buttons || hoveringRegionRef.current) return;
        const key = hit(event) ?? null;
        renderer.domElement.style.cursor = key ? "pointer" : "grab";
        setHovered((previous) => (previous === key ? previous : key));
      };
      const pointerUp = (event: PointerEvent) => {
        if (!pointerActive) return;
        pointerActive = false;
        if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) {
          return;
        }
        const key = hit(event);
        const point = key ? layoutRef.current.points.get(key) : undefined;
        if (point) latest.current.onSelectNeuron(point.neuron);
        else latest.current.onClearSelection();
      };
      const dblClick = (event: MouseEvent) => {
        const key = hit(event);
        const point = key ? layoutRef.current.points.get(key) : undefined;
        if (point) latest.current.onDiveNeuron?.(point.neuron);
      };
      const pointerLeave = () => {
        pointerActive = false;
        setHovered(null);
      };
      const contextLost = (event: Event) => {
        event.preventDefault();
        latest.current.onUnavailable("context-lost");
      };
      renderer.domElement.addEventListener("pointerdown", pointerDown);
      renderer.domElement.addEventListener("pointermove", pointerMove);
      renderer.domElement.addEventListener("pointerup", pointerUp);
      renderer.domElement.addEventListener("dblclick", dblClick);
      renderer.domElement.addEventListener("pointerleave", pointerLeave);
      renderer.domElement.addEventListener("webglcontextlost", contextLost);

      const resize = new ResizeObserver((entries) => {
        const entry = entries[0];
        const width = Math.round(entry?.contentRect.width ?? host.clientWidth);
        const height = Math.round(
          entry?.contentRect.height ?? host.clientHeight,
        );
        if (!width || !height) return;
        hostSizeRef.current = { width, height };
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        composer.setSize(width, height);
        bokeh.materialBokeh.uniforms.aspect.value = camera.aspect;
        state.dirty = true;
        if (fitKey.current) {
          if (latest.current.selectedKey) {
            focusNode(latest.current.selectedKey, false);
          } else {
            fit(false);
          }
        }
      });
      resize.observe(host);

      const animate = (now: number) => {
        frameId = 0;
        if (!visible || !pageVisible || document.hidden) {
          return;
        }
        frameId = requestAnimationFrame(animate);
        if (now - lastFrame < 1000 / 60 - 1) {
          return;
        }
        lastFrame = now;
        const hostWidth = hostSizeRef.current.width;
        const hostHeight = hostSizeRef.current.height;
        if (!hostWidth || !hostHeight) return;

        if (flight.current) {
          const value = flight.current;
          const progress = latest.current.reducedMotion
            ? 1
            : Math.max(0, Math.min(1, (now - value.start) / 900));
          const eased = progress * progress * (3 - 2 * progress);
          camera.position.lerpVectors(value.from, value.to, eased);
          controls.target.lerpVectors(value.targetFrom, value.targetTo, eased);
          if (progress === 1) flight.current = null;
        }
        const changed = controls.update();
        if (!changed && !flight.current && !state.dirty) return;
        state.dirty = false;
        camera.updateMatrixWorld();
        const pixelRadius = hostWidth < 600 ? 16 : 8;
        const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        for (const object of state.pickable) {
          if (typeof object.userData.radius !== "number") continue;
          const depth = -scratchVec
            .copy(object.position)
            .applyMatrix4(camera.matrixWorldInverse).z;
          object.scale.setScalar(
            Math.max(
              object.userData.radius,
              (pixelRadius * 2 * Math.max(1, depth) * tangent) / hostHeight,
            ),
          );
        }
        const focus = latest.current.selectedKey
          ? layoutRef.current.points.get(latest.current.selectedKey)
          : undefined;
        bokeh.materialBokeh.uniforms.focus.value = focus
          ? -scratchVec
              .copy(focus.position)
              .applyMatrix4(camera.matrixWorldInverse).z
          : camera.position.distanceTo(controls.target) - 100;
        if (state.ring && state.ring.visible) {
          state.ring.quaternion.copy(camera.quaternion);
        }
        composer.render();

        const placed: Array<{
          x: number;
          y: number;
          width: number;
          height: number;
        }> = [];
        const labelNodes = labelsRef.current?.children;
        if (!labelNodes) return;

        for (let i = 0; i < labelNodes.length; i += 1) {
          const element = labelNodes[i] as HTMLElement;
          const position = positions.current.get(element.dataset.key ?? "");
          if (!position) continue;
          const anchor = projectAtlasLabel(
            position,
            camera,
            hostWidth,
            hostHeight,
          );
          const { x, y } = anchor;
          const cachedSize = labelSizeMapRef.current.get(element);
          const region = element.dataset.kind === "region";
          const width = cachedSize?.width ?? (region ? 164 : 140);
          const height = cachedSize?.height ?? (region ? 38 : 28);
          const minLeft =
            region && latest.current.leftDrawerOpen && hostWidth > 840
              ? 388
              : 16;
          const maxLeft =
            region && latest.current.rightDrawerOpen && hostWidth > 840
              ? hostWidth - width - 388
              : hostWidth - width - 16;
          const left = Math.round(
            Math.max(minLeft, Math.min(maxLeft, x + (region ? -22 : 18))),
          );
          const minTop = 74;
          const maxTop = Math.max(minTop, hostHeight - height - 82);
          const baseTop = Math.round(
            Math.max(
              minTop,
              Math.min(
                maxTop,
                region ? y - height - 48 : y - height * 0.5 - 13,
              ),
            ),
          );
          const overlapsAt = (candidateTop: number) =>
            placed.some(
              (rect) =>
                left < rect.x + rect.width + 8 &&
                left + width + 8 > rect.x &&
                candidateTop < rect.y + rect.height + 6 &&
                candidateTop + height + 6 > rect.y,
            );
          const nudgeOffsets = region
            ? [0, -34, 34, -68, 68, -102, 102]
            : [0, 32, -32, 64, -64];
          let top = baseTop;
          let overlaps = overlapsAt(baseTop);
          if (overlaps) {
            for (const offset of nudgeOffsets) {
              const candidate = Math.max(
                minTop,
                Math.min(maxTop, baseTop + offset),
              );
              if (!overlapsAt(candidate)) {
                top = candidate;
                overlaps = false;
                break;
              }
            }
          }
          const originX = left + 11;
          const originY = top + height * 0.5;
          const dx = x - originX;
          const dy = y - originY;
          const leaderDistance = Math.hypot(dx, dy);
          const hidden =
            !anchor.visible ||
            (region && leaderDistance > 360) ||
            overlaps;
          const nextVisibility = hidden ? "hidden" : "visible";
          const nextTransform = `translate3d(${left}px,${top}px,0)`;
          const nextAnchorX = String(x);
          const nextAnchorY = String(y);
          const nextLeaderLength = region ? `${leaderDistance}px` : "";
          const nextLeaderAngle = region ? `${Math.atan2(dy, dx)}rad` : "";

          const prev = labelStyleCacheRef.current.get(element);
          if (!prev || prev.visibility !== nextVisibility) {
            element.style.visibility = nextVisibility;
          }
          if (!prev || prev.transform !== nextTransform) {
            element.style.transform = nextTransform;
          }
          if (!prev || prev.anchorX !== nextAnchorX) {
            element.dataset.anchorX = nextAnchorX;
          }
          if (!prev || prev.anchorY !== nextAnchorY) {
            element.dataset.anchorY = nextAnchorY;
          }
          if (region) {
            if (!prev || prev.leaderLength !== nextLeaderLength) {
              element.style.setProperty("--leader-length", nextLeaderLength);
            }
            if (!prev || prev.leaderAngle !== nextLeaderAngle) {
              element.style.setProperty("--leader-angle", nextLeaderAngle);
            }
          }
          labelStyleCacheRef.current.set(element, {
            visibility: nextVisibility,
            transform: nextTransform,
            anchorX: nextAnchorX,
            anchorY: nextAnchorY,
            leaderLength: nextLeaderLength,
            leaderAngle: nextLeaderAngle,
          });
          if (!hidden) placed.push({ x: left, y: top, width, height });
        }
      };

      const startLoop = () => {
        if (!frameId && visible && pageVisible && !document.hidden) {
          state.dirty = true;
          frameId = requestAnimationFrame(animate);
        }
      };
      const stopLoop = () => {
        if (frameId) {
          cancelAnimationFrame(frameId);
          frameId = 0;
        }
      };

      const intersection = new IntersectionObserver(([entry]) => {
        visible = entry?.isIntersecting ?? true;
        if (visible) startLoop();
        else stopLoop();
      });
      intersection.observe(host);

      const handleVisibilityChange = () => {
        pageVisible = document.visibilityState !== "hidden";
        if (pageVisible) startLoop();
        else stopLoop();
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);

      startLoop();
      return () => {
        stopLoop();
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        resize.disconnect();
        intersection.disconnect();
        renderer.domElement.removeEventListener("pointerdown", pointerDown);
        renderer.domElement.removeEventListener("pointermove", pointerMove);
        renderer.domElement.removeEventListener("pointerup", pointerUp);
        renderer.domElement.removeEventListener("dblclick", dblClick);
        renderer.domElement.removeEventListener("pointerleave", pointerLeave);
        renderer.domElement.removeEventListener("webglcontextlost", contextLost);
        controls.removeEventListener("start", interruptFlight);
        controls.dispose();
        disposeNetwork(network, sharedTextures);
        glow.dispose();
        environment.dispose();
        renderPass.dispose();
        bokeh.dispose();
        outputPass.dispose();
        target.dispose();
        composer.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
        stateRef.current = null;
        fitKey.current = "";
      };
    }, [fit, focusNode]);

    // Observe label dimensions via ResizeObserver so rAF loop never triggers forced reflows
    React.useEffect(() => {
      const container = labelsRef.current;
      if (!container || typeof ResizeObserver === "undefined") return;
      const labelObserver = new ResizeObserver((entries) => {
        let updated = false;
        for (const entry of entries) {
          const target = entry.target as HTMLElement;
          const borderSize = entry.borderBoxSize?.[0];
          const width = Math.round(
            borderSize ? borderSize.inlineSize : entry.contentRect.width,
          );
          const height = Math.round(
            borderSize ? borderSize.blockSize : entry.contentRect.height,
          );
          if (width > 0 && height > 0) {
            labelSizeMapRef.current.set(target, { width, height });
            updated = true;
          }
        }
        if (updated && stateRef.current) {
          stateRef.current.dirty = true;
        }
      });
      const children = Array.from(container.children) as HTMLElement[];
      for (const child of children) {
        labelObserver.observe(child);
      }
      return () => {
        labelObserver.disconnect();
      };
    }, [layout.labels, hovered, props.selectedKey]);

    // Effect A: Build WebGL scene geometry ONLY when the graph layout changes
    React.useEffect(() => {
      const state = stateRef.current;
      if (!state) return;
      state.dirty = true;
      disposeNetwork(state.network, state.sharedTextures);
      state.pickable = [];
      state.nodeVisuals.clear();
      state.edgeVisuals = [];
      state.evidenceLine = null;
      state.beaconVisual = null;
      positions.current.clear();
      state.ring = null;

      const sphere = new THREE.SphereGeometry(1, 24, 20);
      const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
      const baseColorFor = (group: number) =>
        new THREE.Color(group === 0 ? COPPER : COLORS[group % COLORS.length]);

      layout.points.forEach((point, key) => {
        const pearlOffset = (seed(key + ":pearl") - 0.5) * 0.12;
        const color = baseColorFor(point.group).offsetHSL(0, 0, pearlOffset);
        const material = new THREE.MeshPhysicalMaterial({
          color,
          metalness: 0.35,
          roughness: 0.19,
          clearcoat: 1,
          clearcoatRoughness: 0.1,
          envMapIntensity: 0.72,
          emissive: color.clone(),
          emissiveIntensity: 0.008,
        });
        const mesh = new THREE.Mesh(sphere, material);
        mesh.scale.setScalar(point.radius);
        mesh.position.copy(point.position);
        state.network.add(mesh);
        positions.current.set(key, point.position);

        const hitTarget = new THREE.Mesh(sphere, hitMaterial);
        hitTarget.position.copy(point.position);
        hitTarget.scale.setScalar(Math.max(point.radius, 7));
        hitTarget.userData.key = key;
        hitTarget.userData.radius = point.radius;
        state.network.add(hitTarget);
        state.pickable.push(hitTarget);

        const spriteMaterial = new THREE.SpriteMaterial({
          map: state.glow,
          color: color.clone(),
          transparent: true,
          opacity: 0.045,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.copy(point.position);
        sprite.scale.setScalar(point.radius * 5);
        sprite.visible = point.radius > 5;
        state.network.add(sprite);

        state.nodeVisuals.set(key, {
          key,
          group: point.group,
          baseRadius: point.radius,
          pearlOffset,
          isMatched: point.neuron.isMatched,
          position: point.position,
          mesh,
          material,
          hitTarget,
          sprite,
          spriteMaterial,
        });
      });

      if (!layout.points.size) {
        sphere.dispose();
        hitMaterial.dispose();
      } else {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(1, 0.042, 8, 64),
          new THREE.MeshBasicMaterial({ color: "#ffe3bd" }),
        );
        ring.visible = false;
        state.ring = ring;
        state.network.add(ring);
      }

      const beaconGeometry = new THREE.SphereGeometry(1, 10, 8);
      const beaconMesh = new THREE.InstancedMesh(
        beaconGeometry,
        new THREE.MeshStandardMaterial({
          color: "#ffffff",
          metalness: 0.36,
          roughness: 0.33,
        }),
        layout.beacons.length,
      );
      const matrix = new THREE.Matrix4();
      const quaternion = new THREE.Quaternion();
      const scaleVec = new THREE.Vector3();
      const evidencePositions: number[] = [];
      const evidenceColors: number[] = [];
      const evidenceSegmentGroups: number[] = [];
      const parentKeys: string[] = [];
      const beaconGroups: number[] = [];

      layout.beacons.forEach((beacon, index) => {
        scaleVec.setScalar(beacon.radius);
        matrix.compose(beacon.position, quaternion, scaleVec);
        beaconMesh.setMatrixAt(index, matrix);
        beaconMesh.setColorAt(
          index,
          baseColorFor(beacon.group).offsetHSL(0, -0.05, 0.09),
        );
        parentKeys.push(beacon.parentKey);
        beaconGroups.push(beacon.group);
        const parent = layout.points.get(beacon.parentKey)!;
        const samples = atlasConnectionCurve(
          parent.position,
          beacon.position,
          `${beacon.parentKey}:${index}`,
          false,
        ).getPoints(10);
        const color = baseColorFor(beacon.group).multiplyScalar(
          beacon.group === 0 ? 1 : 0.6,
        );
        for (let sample = 1; sample < samples.length; sample++) {
          evidencePositions.push(
            ...samples[sample - 1].toArray(),
            ...samples[sample].toArray(),
          );
          evidenceColors.push(...color.toArray(), ...color.toArray());
          evidenceSegmentGroups.push(beacon.group);
        }
      });
      beaconMesh.userData.keys = parentKeys;
      if (layout.beacons.length) {
        state.network.add(beaconMesh);
        state.pickable.push(beaconMesh);
        state.beaconVisual = { mesh: beaconMesh, groups: beaconGroups };
      } else {
        beaconGeometry.dispose();
        beaconMesh.material.dispose();
      }

      const evidenceGeometry = new THREE.BufferGeometry();
      evidenceGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(evidencePositions, 3),
      );
      const evidenceColorAttr = new THREE.Float32BufferAttribute(
        evidenceColors,
        3,
      );
      evidenceGeometry.setAttribute("color", evidenceColorAttr);
      state.network.add(
        new THREE.LineSegments(
          evidenceGeometry,
          new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.3,
            depthWrite: false,
          }),
        ),
      );
      state.evidenceLine = {
        colorAttribute: evidenceColorAttr,
        segmentGroups: evidenceSegmentGroups,
      };

      layout.centers.forEach((position, key) =>
        positions.current.set(key, position),
      );
      layout.labels.forEach((label) =>
        positions.current.set(label.region.key, label.position),
      );

      const degree = new Map<string, number>();
      const crossCount = new Map<string, number>();
      for (const edge of [...layout.edges].sort(
        (a, b) => b.weight - a.weight || a.id.localeCompare(b.id),
      )) {
        const source = layout.points.get(edge.sourceKey)!;
        const target = layout.points.get(edge.targetKey)!;
        const cross = source.group !== target.group;
        const pair = [source.group, target.group]
          .sort((a, b) => a - b)
          .join(":");
        if (
          (degree.get(edge.sourceKey) ?? 0) >= 7 ||
          (degree.get(edge.targetKey) ?? 0) >= 7 ||
          (cross && (crossCount.get(pair) ?? 0) >= 8)
        ) {
          continue;
        }
        degree.set(edge.sourceKey, (degree.get(edge.sourceKey) ?? 0) + 1);
        degree.set(edge.targetKey, (degree.get(edge.targetKey) ?? 0) + 1);
        if (cross) crossCount.set(pair, (crossCount.get(pair) ?? 0) + 1);

        const samples = atlasConnectionCurve(
          source.position,
          target.position,
          edge.id,
          cross,
          source.group,
          target.group,
        ).getPoints(cross ? 40 : 20);
        const coordinates: number[] = [];
        for (let sample = 1; sample < samples.length; sample++) {
          coordinates.push(
            ...samples[sample - 1].toArray(),
            ...samples[sample].toArray(),
          );
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(coordinates, 3),
        );
        const material = new THREE.LineBasicMaterial({
          color: "#829681",
          transparent: true,
          opacity: 0.15,
          depthWrite: false,
        });
        state.network.add(new THREE.LineSegments(geometry, material));
        state.edgeVisuals.push({
          sourceKey: edge.sourceKey,
          targetKey: edge.targetKey,
          sourceGroup: source.group,
          targetGroup: target.group,
          cross,
          material,
        });
      }
    }, [layout]);

    // Effect B: Update highlight colors/emissive/ring in-place on neuron selection (zero WebGL rebuild!)
    React.useEffect(() => {
      const state = stateRef.current;
      if (!state) return;
      const focusedGroup = props.selectedKey
        ? (layout.points.get(props.selectedKey)?.group ?? 0)
        : 0;
      const scratchColor = new THREE.Color();
      const setColorForGroup = (group: number) =>
        scratchColor.set(
          group === focusedGroup ? COPPER : COLORS[group % COLORS.length],
        );

      let selectedVisual: NodeVisualRecord | null = null;
      state.nodeVisuals.forEach((visual) => {
        const isSelected = visual.key === props.selectedKey;
        const isActive = visual.group === focusedGroup || visual.isMatched;
        if (isSelected) {
          scratchColor.set("#e0a264");
          selectedVisual = visual;
        } else {
          setColorForGroup(visual.group);
        }
        scratchColor.offsetHSL(0, 0, visual.pearlOffset);
        visual.material.color.copy(scratchColor);
        visual.material.emissive.copy(scratchColor);
        visual.material.emissiveIntensity = isSelected
          ? 0.6
          : isActive
            ? 0.025
            : 0.008;

        const radius = isSelected
          ? Math.max(10, visual.baseRadius * 1.1)
          : visual.baseRadius;
        visual.mesh.scale.setScalar(radius);
        visual.hitTarget.scale.setScalar(Math.max(radius, 7));
        visual.hitTarget.userData.radius = radius;

        visual.sprite.visible = isSelected || visual.baseRadius > 5;
        visual.spriteMaterial.color.copy(scratchColor);
        visual.spriteMaterial.opacity = isSelected
          ? 0.9
          : isActive
            ? 0.11
            : 0.045;
        visual.sprite.scale.setScalar(radius * (isSelected ? 8 : 5));
      });

      if (state.ring) {
        if (selectedVisual) {
          const picked = selectedVisual as NodeVisualRecord;
          const ringRadius = Math.max(10, picked.baseRadius * 1.1) * 1.1;
          state.ring.position.copy(picked.position);
          state.ring.scale.setScalar(ringRadius);
          state.ring.visible = true;
        } else {
          state.ring.visible = false;
        }
      }

      if (state.beaconVisual) {
        const { mesh, groups } = state.beaconVisual;
        for (let i = 0; i < groups.length; i += 1) {
          setColorForGroup(groups[i]!).offsetHSL(0, -0.05, 0.09);
          mesh.setColorAt(i, scratchColor);
        }
        if (mesh.instanceColor) {
          mesh.instanceColor.needsUpdate = true;
        }
      }

      if (state.evidenceLine) {
        const { colorAttribute, segmentGroups } = state.evidenceLine;
        const arr = colorAttribute.array as Float32Array;
        for (let i = 0; i < segmentGroups.length; i += 1) {
          const group = segmentGroups[i]!;
          setColorForGroup(group).multiplyScalar(
            group === focusedGroup ? 1 : 0.6,
          );
          const offset = i * 6;
          arr[offset] = scratchColor.r;
          arr[offset + 1] = scratchColor.g;
          arr[offset + 2] = scratchColor.b;
          arr[offset + 3] = scratchColor.r;
          arr[offset + 4] = scratchColor.g;
          arr[offset + 5] = scratchColor.b;
        }
        colorAttribute.needsUpdate = true;
      }

      for (const edge of state.edgeVisuals) {
        const isSelected =
          edge.sourceKey === props.selectedKey ||
          edge.targetKey === props.selectedKey;
        const isActive =
          edge.sourceGroup === focusedGroup ||
          edge.targetGroup === focusedGroup;
        const nextOpacity = isSelected
          ? 0.42
          : isActive
            ? edge.cross
              ? 0.18
              : 0.22
            : 0.15;
        const edgeMaterial = edge.material;
        edgeMaterial.color.set(isActive ? "#d3a16d" : "#829681");
        edgeMaterial.setValues({ opacity: nextOpacity });
      }

      state.dirty = true;
    }, [layout, props.selectedKey]);

    // Effect C: Fit camera only when active region or layout key changes
    React.useEffect(() => {
      const nextFitKey = `${props.activeRegionKey ?? "overview"}::${layout.key}`;
      if (nextFitKey !== fitKey.current && layout.points.size > 0) {
        const animate = Boolean(fitKey.current);
        fitKey.current = nextFitKey;
        fit(animate);
      }
    }, [layout.key, layout.points.size, props.activeRegionKey, fit]);

    React.useEffect(() => {
      if (stateRef.current) stateRef.current.dirty = true;
    }, [hovered, props.regions, props.leftDrawerOpen, props.rightDrawerOpen]);

    React.useEffect(() => setHovered(null), [props.selectedKey]);

    React.useEffect(() => {
      if (props.selectedKey) focusNode(props.selectedKey);
    }, [props.selectedKey, layout.key, focusNode]);

    const focus = hovered
      ? layout.points.get(hovered)
      : props.selectedKey
        ? layout.points.get(props.selectedKey)
        : undefined;

    return (
      <div className={styles.scene}>
        <div
          ref={containerRef}
          className={styles.sceneCanvas}
          data-atlas-units={layout.points.size}
          data-atlas-evidence={layout.beacons.length}
          tabIndex={0}
          role="group"
          aria-label={props.keyboardHint}
          onKeyDown={(event) => {
            const points = [...layout.points.values()];
            if (!points.length) return;
            const current = points.findIndex(
              (point) => point.neuron.key === (hovered ?? props.selectedKey),
            );
            const direction = ["ArrowRight", "ArrowDown"].includes(event.key)
              ? 1
              : ["ArrowLeft", "ArrowUp"].includes(event.key)
                ? -1
                : 0;
            if (direction) {
              event.preventDefault();
              setHovered(
                points[
                  (Math.max(0, current) + direction + points.length) %
                    points.length
                ].neuron.key,
              );
            }
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              props.onSelectNeuron(points[Math.max(0, current)].neuron);
            }
          }}
        />
        <div ref={labelsRef} className={styles.sceneLabels}>
          {layout.labels.map((label) => (
            <button
              type="button"
              key={label.region.key}
              data-key={label.region.key}
              data-kind="region"
              data-group={label.group}
              data-hero-key={label.heroKey}
              className={styles.regionLabel}
              data-active={
                label.group ===
                (props.selectedKey
                  ? layout.points.get(props.selectedKey)?.group
                  : 0)
              }
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onPointerEnter={() => {
                hoveringRegionRef.current = true;
                setHovered(null);
                props.onHoverRegion?.(label.region);
              }}
              onPointerLeave={() => {
                hoveringRegionRef.current = false;
                props.onHoverRegion?.(null);
              }}
              onClick={(event) => {
                event.stopPropagation();
                props.onSelectRegion(label.region);
              }}
            >
              <span className={styles.regionLabelTitle}>
                {label.region.label}
              </span>
              <span
                className={`${styles.regionLabelBadge} tabular-nums`}
                aria-label={t("clusterStats", {
                  units: label.region.node.unit_count,
                  sources: label.region.node.source_count,
                })}
              >
                {label.region.node.unit_count}
                {label.region.childCount
                  ? ` · +${label.region.childCount}`
                  : ""}
                <span className={styles.regionLabelArrow} aria-hidden="true">
                  ↗
                </span>
              </span>
            </button>
          ))}
          {focus && (
            <button
              type="button"
              data-key={focus.neuron.key}
              className={styles.neuronLabel}
              onClick={() => props.onSelectNeuron(focus.neuron)}
            >
              {focus.neuron.cleanLabel}
            </button>
          )}
        </div>
      </div>
    );
  },
);
