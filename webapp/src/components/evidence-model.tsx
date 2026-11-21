"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { USDLoader } from "three/addons/loaders/USDLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

function disposeModel(model: THREE.Object3D) {
  model.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    node.geometry.dispose();
    const materials: THREE.Material[] = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      material.dispose();
    }
  });
}

export default function EvidenceModel({ source, format }: { source: string; format: "glb" | "usdz" }) {
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const target = container.current;
    if (!target) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      const error = window.setTimeout(() => setState("error"), 0);
      return () => window.clearTimeout(error);
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    target.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 1.2;
    controls.maxDistance = 7;
    camera.position.set(1.6, 1.1, 2.8);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xa9bacc, 2.1));
    const key = new THREE.DirectionalLight(0xfff4e4, 2);
    key.position.set(2, 4, 3);
    scene.add(key);

    const resize = new ResizeObserver(() => {
      const { clientWidth: width, clientHeight: height } = target;
      if (!width || !height) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    resize.observe(target);
    let stopped = false;
    let asset: THREE.Object3D | undefined;
    const load = format === "glb"
      ? new GLTFLoader().loadAsync(source).then(gltf => gltf.scene)
      : new USDLoader().loadAsync(source);
    load.then(model => {
      if (stopped) {
        disposeModel(model);
        return;
      }
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const span = Math.max(size.x, size.y, size.z);
      if (!Number.isFinite(span) || span <= 0) {
        disposeModel(model);
        setState("error");
        return;
      }
      const pivot = new THREE.Group();
      model.position.sub(bounds.getCenter(new THREE.Vector3()));
      pivot.add(model);
      pivot.scale.setScalar(1.75 / span);
      asset = pivot;
      scene.add(pivot);
      setState("ready");
    }).catch(() => {
      if (!stopped) setState("error");
    });
    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });
    return () => {
      stopped = true;
      resize.disconnect();
      controls.dispose();
      renderer.setAnimationLoop(null);
      if (asset) disposeModel(asset);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [format, source]);

  return (
    <div className="model-stage" aria-label="马克杯三维查看器">
      <div className="model-canvas" ref={container} />
      {state !== "ready" && <div className="model-overlay">
        <p>{state === "loading" ? "正在加载三维模型…" : "浏览器无法显示此模型。"}</p>
        <a href={source} download={`mug.${format}`}>下载模型</a>
      </div>}
    </div>
  );
}
