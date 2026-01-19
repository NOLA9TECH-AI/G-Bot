
import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RobotStyle, RobotAnimation, RobotVisualMood, SystemTheme, EnvironmentType } from '../types';

interface RobotCanvasProps {
  style: RobotStyle;
  size: number;
  mood: RobotVisualMood;
  theme: SystemTheme;
  environment: EnvironmentType;
  color: string;
}

export interface RobotRef {
  triggerAnimation: (name: RobotAnimation) => void;
}

const MODEL_URL = 'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb';

const textureCache: { [key: string]: THREE.CanvasTexture } = {};

const RobotCanvas = forwardRef<RobotRef, RobotCanvasProps>(({ style, size, mood, theme, environment, color }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<{ [key: string]: THREE.AnimationAction }>({});
  const activeActionRef = useRef<THREE.AnimationAction | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const envMapRef = useRef<THREE.Texture | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const groundRef = useRef<THREE.Mesh | null>(null);
  const environmentGroupRef = useRef<THREE.Group>(new THREE.Group());
  const robotLightRef = useRef<THREE.PointLight | null>(null);
  
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  const getThemeAccentHex = () => {
    switch (theme) {
      case SystemTheme.HOOD: return 0xFFD700;
      case SystemTheme.TOXIC: return 0xCCFF00;
      case SystemTheme.FROST: return 0x00FFFF;
      case SystemTheme.BLOOD: return 0xFF0000;
      case SystemTheme.VOID: return 0x9400D3;
      case SystemTheme.SUNSET: return 0xFF4500;
      case SystemTheme.EMERALD: return 0x50C878;
      case SystemTheme.MIDNIGHT: return 0x191970;
      case SystemTheme.CYBERPUNK: return 0x39ff14;
      case SystemTheme.PHANTOM: return 0x8a2be2;
      case SystemTheme.ONYX: return 0xffffff;
      case SystemTheme.NEBULA: return 0xff00ff;
      case SystemTheme.GHOST: return 0xdddddd;
      case SystemTheme.CARBON: return 0xa1a1aa;
      case SystemTheme.VULCAN: return 0xf97316;
      case SystemTheme.COBALT: return 0x2563eb;
      case SystemTheme.TITAN: return 0xd4af37;
      case SystemTheme.CRIMSON: return 0x991b1b;
      default: return 0x39ff14;
    }
  };

  const clearEnvironment = () => {
    while (environmentGroupRef.current.children.length > 0) {
      const obj = environmentGroupRef.current.children[0];
      if ((obj as any).geometry) (obj as any).geometry.dispose();
      if ((obj as any).material) {
        if (Array.isArray((obj as any).material)) {
          (obj as any).material.forEach((m: any) => m.dispose());
        } else {
          (obj as any).material.dispose();
        }
      }
      environmentGroupRef.current.remove(obj);
    }
  };

  const createCyberpunkScene = (env: EnvironmentType) => {
    clearEnvironment();
    const group = environmentGroupRef.current;
    const accent = getThemeAccentHex();
    
    if (env === EnvironmentType.NONE) {
      const studioLight = new THREE.PointLight(accent, 80, 40);
      studioLight.position.set(0, 15, 0);
      group.add(studioLight);
      return;
    }

    switch (env) {
      case EnvironmentType.CYBER_DISTRICT:
        for (let i = 0; i < 30; i++) {
          const h = 10 + Math.random() * 30;
          const w = 5 + Math.random() * 8;
          const building = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, w),
            new THREE.MeshStandardMaterial({ color: 0x010101, roughness: 0.05, metalness: 0.9 })
          );
          building.position.set((Math.random() - 0.5) * 150, h / 2 - 2, (Math.random() - 0.5) * 150);
          if (building.position.length() < 25) building.position.multiplyScalar(3.5);
          group.add(building);
          
          const glow = new THREE.PointLight(accent, 40, 25);
          glow.position.copy(building.position);
          glow.position.y += h/2;
          group.add(glow);
        }
        break;

      case EnvironmentType.MECHA_HANGAR:
        for (let i = 0; i < 20; i++) {
          const tower = new THREE.Mesh(
            new THREE.BoxGeometry(8, 70, 8),
            new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 1.0, roughness: 0.1 })
          );
          tower.position.set((Math.random() - 0.5) * 120, 35, (Math.random() - 0.5) * 120);
          group.add(tower);
          
          const alarm = new THREE.PointLight(accent, 30, 40);
          alarm.position.set(tower.position.x, 10 + Math.random() * 30, tower.position.z);
          group.add(alarm);
        }
        break;

      case EnvironmentType.NEURAL_VOID:
        for (let i = 0; i < 150; i++) {
          const particle = new THREE.Mesh(
            new THREE.SphereGeometry(Math.random() * 0.3),
            new THREE.MeshBasicMaterial({ color: accent })
          );
          particle.position.set((Math.random()-0.5)*100, (Math.random()-0.5)*100, (Math.random()-0.5)*100);
          group.add(particle);
        }
        break;
    }
  };

  const updateCanvasColors = () => {
    if (!sceneRef.current || !groundRef.current) return;
    sceneRef.current.background = new THREE.Color(0x000000);
    sceneRef.current.fog = new THREE.Fog(0x000000, 5, 60);
    createCyberpunkScene(environment);
  };

  const applyRobotSkins = () => {
    if (!modelRef.current) return;
    const accentColor = new THREE.Color(getThemeAccentHex());
    let bodyColor = new THREE.Color(color);

    // Style-specific material properties
    let metalness = 1.0;
    let roughness = 0.05;
    let clearcoat = 1.0;
    let reflectivity = 1.0;

    switch (style) {
      case RobotStyle.STREET:
        metalness = 0.2;
        roughness = 0.85;
        clearcoat = 0.1;
        break;
      case RobotStyle.GOLD:
        metalness = 1.0;
        roughness = 0.01;
        clearcoat = 1.0;
        // Blend base color with a gold hue for better effect
        bodyColor.lerp(new THREE.Color(0xffd700), 0.5);
        break;
      case RobotStyle.STEALTH:
        metalness = 0.1;
        roughness = 0.95;
        clearcoat = 0.0;
        reflectivity = 0.1;
        break;
      case RobotStyle.CYBER:
      default:
        metalness = 1.0;
        roughness = 0.05;
        clearcoat = 1.0;
        break;
    }

    modelRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const isEmissivePart = child.name.toLowerCase().includes('eye') || child.name.toLowerCase().includes('mouth');
        mesh.material = new THREE.MeshPhysicalMaterial({
          color: isEmissivePart ? accentColor : bodyColor,
          metalness: isEmissivePart ? 0 : metalness,
          roughness: isEmissivePart ? 0 : roughness,
          emissive: isEmissivePart ? accentColor : new THREE.Color(0x000000),
          emissiveIntensity: isEmissivePart ? 15.0 : 0.0,
          envMap: envMapRef.current,
          reflectivity: isEmissivePart ? 0 : reflectivity,
          clearcoat: isEmissivePart ? 0 : clearcoat,
          clearcoatRoughness: 0.0
        });
      }
    });
    if (robotLightRef.current) robotLightRef.current.color.set(accentColor);
  };

  const playAnimation = (name: string) => {
    const action = actionsRef.current[name];
    if (action && activeActionRef.current !== action) {
      if (activeActionRef.current) activeActionRef.current.fadeOut(0.3);
      action.reset().fadeIn(0.3).play();
      activeActionRef.current = action;
    }
  };

  useImperativeHandle(ref, () => ({
    triggerAnimation: (name: RobotAnimation) => playAnimation(name)
  }));

  useEffect(() => {
    if (!containerRef.current) return;
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.add(environmentGroupRef.current);

    const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 8, 22);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.8;
    containerRef.current.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    envMapRef.current = pmrem.fromScene(new RoomEnvironment()).texture;
    scene.environment = envMapRef.current;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 1.8;
    controlsRef.current = controls;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x000000, 0.6));
    const pLight = new THREE.PointLight(0xffffff, 40, 30);
    scene.add(pLight);
    robotLightRef.current = pLight;

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(5000, 5000),
      new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.05, metalness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    groundRef.current = ground;

    updateCanvasColors();

    const loader = new GLTFLoader();
    loader.load(MODEL_URL, (gltf) => {
      const model = gltf.scene;
      modelRef.current = model;
      scene.add(model);
      applyRobotSkins();
      const mixer = new THREE.AnimationMixer(model);
      mixerRef.current = mixer;
      gltf.animations.forEach(clip => {
        actionsRef.current[clip.name] = mixer.clipAction(clip);
        if (!['Idle', 'Walking', 'Running'].includes(clip.name)) {
          actionsRef.current[clip.name].clampWhenFinished = true;
          actionsRef.current[clip.name].loop = THREE.LoopOnce;
        }
      });
      playAnimation(RobotAnimation.IDLE);
    });

    const clock = new THREE.Clock();
    const animate = () => {
      requestAnimationFrame(animate);
      const dt = clock.getDelta();
      if (mixerRef.current) mixerRef.current.update(dt);
      
      if (modelRef.current) {
        robotLightRef.current?.position.set(
          modelRef.current.position.x,
          modelRef.current.position.y + 3,
          modelRef.current.position.z + 2
        );
        controls.target.lerp(modelRef.current.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 0.1);
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      renderer.dispose();
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, []);

  useEffect(() => { updateCanvasColors(); }, [environment, theme]);
  useEffect(() => { applyRobotSkins(); }, [style, color, theme]);
  useEffect(() => { if (modelRef.current) modelRef.current.scale.set(size, size, size); }, [size]);

  return <div ref={containerRef} className="absolute inset-0 z-0 bg-black overflow-hidden" />;
});

export default RobotCanvas;
