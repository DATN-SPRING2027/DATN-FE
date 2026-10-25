"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

export type RobotStatus = "idle" | "thinking" | "speaking" | "happy";

const STATUS_MOTION: Record<
  RobotStatus,
  {
    speed: number;
    height: number;
    tilt: number;
    timeScale: number;
    lightIntensity: number;
  }
> = {
  idle: {
    speed: 1.6,
    height: 0.06,
    tilt: 0.04,
    timeScale: 0.85,
    lightIntensity: 1.8,
  },
  thinking: {
    speed: 4.2,
    height: 0.09,
    tilt: 0.13,
    timeScale: 1.65,
    lightIntensity: 3.2,
  },
  speaking: {
    speed: 5.0,
    height: 0.1,
    tilt: 0.1,
    timeScale: 1.35,
    lightIntensity: 2.6,
  },
  happy: {
    speed: 7.0,
    height: 0.18,
    tilt: 0.18,
    timeScale: 1.85,
    lightIntensity: 3.5,
  },
};

let cachedGltfPromise: Promise<GLTF> | null = null;

function loadRobotGltf(modelPath: string): Promise<GLTF> {
  if (!cachedGltfPromise) {
    const loader = new GLTFLoader();
    cachedGltfPromise = new Promise<GLTF>((resolve, reject) => {
      loader.load(
        modelPath,
        (gltf) => resolve(gltf),
        undefined,
        (error) => {
          cachedGltfPromise = null;
          reject(error);
        },
      );
    });
  }
  return cachedGltfPromise;
}

function canUseWebGL(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }
  if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) {
    return false;
  }
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")),
    );
  } catch {
    return false;
  }
}

export default function Robot3D({
  status = "idle",
  modelPath = "/models/robot.glb",
  interactiveMouse = true,
  className = "",
}: {
  status?: RobotStatus;
  modelPath?: string;
  interactiveMouse?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<RobotStatus>(status);
  const pointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [webglFailed, setWebglFailed] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!interactiveMouse || typeof window === "undefined") return;

    const handlePointerMove = (event: MouseEvent) => {
      const nx = (event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
      const ny = -((event.clientY / Math.max(window.innerHeight, 1)) * 2 - 1);
      pointerRef.current = {
        x: Math.max(-1, Math.min(1, nx)),
        y: Math.max(-1, Math.min(1, ny)),
      };
    };

    window.addEventListener("mousemove", handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
    };
  }, [interactiveMouse]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !canUseWebGL()) return;

    let disposed = false;
    let frameId = 0;
    let renderer: THREE.WebGLRenderer | null = null;

    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      return;
    }

    const width = Math.max(container.clientWidth, 120);
    const height = Math.max(container.clientHeight, 120);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const canvas = renderer.domElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.innerHTML = "";
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(0, 0.08, 4.7);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(3, 5, 4);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 1.4);
    rimLight.position.set(-3, 2, -2);
    scene.add(rimLight);

    const glowLight = new THREE.PointLight(0x3b82f6, 2.0, 8);
    glowLight.position.set(0, 0.2, 2.2);
    scene.add(glowLight);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    let mixer: THREE.AnimationMixer | null = null;
    let primaryAction: THREE.AnimationAction | null = null;
    let eyesNode: THREE.Object3D | null = null;
    let mouthNode: THREE.Object3D | null = null;
    let leftHandNode: THREE.Object3D | null = null;
    let rightHandNode: THREE.Object3D | null = null;
    let waveNodes: THREE.Object3D[] = [];
    let baseMouthScaleY = 1;
    let baseEyesScaleY = 1;

    loadRobotGltf(modelPath)
      .then((gltf) => {
        if (disposed) return;

        const clonedScene = gltf.scene.clone(true);
        const box = new THREE.Box3().setFromObject(clonedScene);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const longestSide = Math.max(size.x, size.y, size.z, 0.001);
        const normalizedScale = 2.25 / longestSide;

        const offsetGroup = new THREE.Group();
        clonedScene.scale.setScalar(normalizedScale);
        offsetGroup.position.set(
          -center.x * normalizedScale,
          -center.y * normalizedScale,
          -center.z * normalizedScale,
        );
        offsetGroup.add(clonedScene);
        rootGroup.add(offsetGroup);

        eyesNode = clonedScene.getObjectByName("Eyes") ?? null;
        mouthNode = clonedScene.getObjectByName("Mouth") ?? null;
        leftHandNode = clonedScene.getObjectByName("Hand origin") ?? null;
        rightHandNode = clonedScene.getObjectByName("Hand origin.002") ?? null;
        waveNodes = ["Wave", "Wave.001", "Wave.002", "Wave.003"]
          .map((name) => clonedScene.getObjectByName(name))
          .filter((node): node is THREE.Object3D => Boolean(node));

        if (mouthNode) baseMouthScaleY = mouthNode.scale.y || 1;
        if (eyesNode) baseEyesScaleY = eyesNode.scale.y || 1;

        if (gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(clonedScene);
          const clip = gltf.animations[0];
          primaryAction = mixer.clipAction(clip);
          primaryAction.play();
        }

        setIsLoaded(true);
      })
      .catch(() => {
        if (!disposed) {
          setWebglFailed(true);
        }
      });

    const clock = new THREE.Clock();

    const animate = () => {
      if (disposed || !renderer) return;
      frameId = window.requestAnimationFrame(animate);

      const delta = Math.min(clock.getDelta(), 0.1);
      const t = clock.getElapsedTime();
      const currentStatus = statusRef.current;
      const cfg = STATUS_MOTION[currentStatus] || STATUS_MOTION.idle;

      if (mixer) {
        if (primaryAction) {
          primaryAction.timeScale = THREE.MathUtils.lerp(
            primaryAction.timeScale,
            cfg.timeScale,
            0.08,
          );
        }
        mixer.update(delta);
      }

      glowLight.intensity = THREE.MathUtils.lerp(
        glowLight.intensity,
        cfg.lightIntensity,
        0.1,
      );

      const targetY = Math.sin(t * cfg.speed) * cfg.height;
      const targetRotZ = Math.sin(t * cfg.speed * 0.55) * cfg.tilt;
      const mouseYaw = interactiveMouse ? pointerRef.current.x * 0.28 : 0;
      const mousePitch = interactiveMouse ? -pointerRef.current.y * 0.16 : 0;

      const scanYaw =
        currentStatus === "thinking"
          ? Math.sin(t * 2.6) * 0.25
          : Math.sin(t * 0.8) * 0.12;

      rootGroup.position.y = THREE.MathUtils.lerp(
        rootGroup.position.y,
        targetY,
        0.12,
      );
      rootGroup.rotation.z = THREE.MathUtils.lerp(
        rootGroup.rotation.z,
        targetRotZ,
        0.12,
      );
      rootGroup.rotation.y = THREE.MathUtils.lerp(
        rootGroup.rotation.y,
        scanYaw + mouseYaw,
        0.08,
      );
      rootGroup.rotation.x = THREE.MathUtils.lerp(
        rootGroup.rotation.x,
        mousePitch + (currentStatus === "thinking" ? 0.08 : 0),
        0.08,
      );

      const pulseScale =
        currentStatus === "happy"
          ? 1 + Math.sin(t * 7.5) * 0.045
          : currentStatus === "speaking"
            ? 1 + Math.sin(t * 5.5) * 0.02
            : 1;
      rootGroup.scale.setScalar(
        THREE.MathUtils.lerp(rootGroup.scale.x, pulseScale, 0.15),
      );

      if (mouthNode) {
        if (currentStatus === "speaking") {
          const talkFactor = 0.65 + Math.abs(Math.sin(t * 18)) * 0.95;
          mouthNode.scale.y = baseMouthScaleY * talkFactor;
        } else if (currentStatus === "happy") {
          mouthNode.scale.y = baseMouthScaleY * 1.25;
        } else {
          mouthNode.scale.y = THREE.MathUtils.lerp(
            mouthNode.scale.y,
            baseMouthScaleY,
            0.15,
          );
        }
      }

      if (eyesNode) {
        const blinkCycle = t % 3.8;
        const isBlinking = blinkCycle > 3.65;
        const targetEyeY = isBlinking
          ? baseEyesScaleY * 0.15
          : currentStatus === "happy"
            ? baseEyesScaleY * 1.18
            : baseEyesScaleY;
        eyesNode.scale.y = THREE.MathUtils.lerp(
          eyesNode.scale.y,
          targetEyeY,
          0.25,
        );
      }

      if (leftHandNode && rightHandNode) {
        if (currentStatus === "happy") {
          leftHandNode.rotation.z = Math.sin(t * 10) * 0.25;
          rightHandNode.rotation.z = -Math.sin(t * 10) * 0.25;
        } else if (currentStatus === "speaking") {
          leftHandNode.rotation.x = Math.sin(t * 6) * 0.15;
          rightHandNode.rotation.x = -Math.sin(t * 6) * 0.15;
        }
      }

      if (waveNodes.length > 0 && currentStatus === "thinking") {
        waveNodes.forEach((wave, index) => {
          wave.rotation.y += delta * (2.2 + index * 0.5);
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container || !renderer) return;
      const nextW = Math.max(container.clientWidth, 80);
      const nextH = Math.max(container.clientHeight, 80);
      camera.aspect = nextW / nextH;
      camera.updateProjectionMatrix();
      renderer.setSize(nextW, nextH);
    };

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(handleResize)
        : null;
    resizeObserver?.observe(container);
    window.addEventListener("resize", handleResize);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleResize);
      if (mixer) {
        mixer.stopAllAction();
      }
      renderer?.dispose();
    };
  }, [modelPath, interactiveMouse]);

  return (
    <div
      data-testid="robot-3d-stage"
      data-status={status}
      className={`relative h-full w-full select-none ${className}`}
    >
      <div ref={containerRef} className="h-full w-full" />

      {(webglFailed || !isLoaded) && (
        <div
          data-testid="robot-3d-fallback"
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
        >
          <div
            className={`relative flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-200/80 bg-gradient-to-b from-white to-brand-50/80 shadow-md transition-transform duration-300 dark:border-brand-500/30 dark:from-gray-800 dark:to-gray-900 ${
              status === "happy"
                ? "-translate-y-1.5 scale-105"
                : status === "thinking"
                  ? "animate-pulse"
                  : ""
            }`}
          >
            <div className="flex h-8 w-11 flex-col items-center justify-center rounded-lg bg-gray-900 px-1.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" />
                <span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" />
              </div>
              <span
                className={`mt-1.5 rounded-full bg-sky-400 transition-all ${
                  status === "speaking"
                    ? "h-1.5 w-4"
                    : status === "happy"
                      ? "h-1 w-5"
                      : "h-0.5 w-3"
                }`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
