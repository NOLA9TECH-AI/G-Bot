
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
  triggerAnimation: (name: RobotAnimation, loop?: boolean) => void;
  resetView: () => void;
}

const MODEL_URL = 'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb';

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

  const getThemeAccentHex = () => {
    switch (theme) {
      case SystemTheme.STORM_GRAY_BLUE: return 0x7096ff;
      case SystemTheme.SANGUINE_NOIR: return 0x990000;
      case SystemTheme.SLATE_PHOSPHOR: return 0x00ff99;
      case SystemTheme.DEEP_TRENCH: return 0x00e5ff;
      case SystemTheme.CRIMSON_SHADOW: return 0xff1e1e;
      case SystemTheme.INK_VERIDIAN: return 0x00ffaa;
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
      case SystemTheme.MAGMA: return 0xff4500;
      case SystemTheme.COBALT_STRIKE: return 0x2e5bff;
      case SystemTheme.NEON_BONE: return 0xf5f5f5;
      case SystemTheme.NIGHTSHADE: return 0x4b0082;
      case SystemTheme.SULFUR: return 0xdfff00;
      case SystemTheme.NOIR_COMIC: return 0xffffff;
      case SystemTheme.VIGILANTE: return 0xffd700;
      case SystemTheme.PULP_FICTION: return 0xff4d4d;
      case SystemTheme.MUTANT_X: return 0xadff2f;
      case SystemTheme.COSMIC_RAYS: return 0xff00ff;
      default: return 0x39ff14;
    }
  };

  const getMoodColor = () => {
    switch (mood) {
      case RobotVisualMood.HAPPY: return 0x00ff88;
      case RobotVisualMood.EXCITED: return 0xffff00;
      case RobotVisualMood.ANGRY: return 0xff1100;
      case RobotVisualMood.SAD: return 0x0055ff;
      case RobotVisualMood.CURIOUS: return 0xbb00ff;
      case RobotVisualMood.TALKING: return 0xffffff;
      case RobotVisualMood.LOADING: return 0xffaa00;
      case RobotVisualMood.PAINTING: return 0xff00cc;
      default: return getThemeAccentHex();
    }
  };

  const applyRobotSkins = () => {
    if (!modelRef.current) return;
    const accentColor = new THREE.Color(getThemeAccentHex());
    const moodColor = new THREE.Color(getMoodColor());
    let bodyColor = new THREE.Color(color);

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
        bodyColor.lerp(new THREE.Color(0xffd700), 0.5);
        break;
      case RobotStyle.STEALTH:
        metalness = 0.1;
        roughness = 0.95;
        clearcoat = 0.0;
        reflectivity = 0.1;
        break;
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
          color: isEmissivePart ? moodColor : bodyColor,
          metalness: isEmissivePart ? 0 : metalness,
          roughness: isEmissivePart ? 0 : roughness,
          emissive: isEmissivePart ? moodColor : new THREE.Color(0x000000),
          emissiveIntensity: isEmissivePart ? 15.0 : 0.0,
          envMap: envMapRef.current,
          reflectivity: isEmissivePart ? 0 : reflectivity,
          clearcoat: isEmissivePart ? 0 : clearcoat,
          clearcoatRoughness: 0.0
        });
      }
    });
    if (robotLightRef.current) robotLightRef.current.color.set(moodColor);
  };

  const playAnimation = (name: string, loop: boolean = false) => {
    let clipName = name;
    let speed = 1.0;

    if (name === RobotAnimation.FLEX) { clipName = 'Punch'; speed = 0.5; }
    if (name === RobotAnimation.DANCE_ROBOT) { clipName = 'Dance'; speed = 1.8; }
    if (name === RobotAnimation.DANCE_BREAKDANCE) { clipName = 'Jump'; speed = 2.2; }
    if (name === RobotAnimation.DANCE_FLOSS) { clipName = 'Wave'; speed = 3.0; }
    if (name === RobotAnimation.DANCE_SHUFFLE) { clipName = 'Running'; speed = 2.5; }
    if (name === RobotAnimation.DANCE_GROOVE) { clipName = 'Dance'; speed = 0.7; }

    const action = actionsRef.current[clipName];
    if (action) {
      const isDance = name.startsWith('Dance_') || name === RobotAnimation.FLEX;
      const shouldLoop = loop || ['Idle', 'Walking', 'Running', 'Dance'].includes(clipName) || isDance;
      
      if (activeActionRef.current !== action) {
        if (activeActionRef.current) activeActionRef.current.fadeOut(0.3);
        action.reset().setEffectiveTimeScale(speed).setLoop(shouldLoop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity).fadeIn(0.3).play();
        activeActionRef.current = action;
      }
    }
  };

  useImperativeHandle(ref, () => ({
    triggerAnimation: (name: RobotAnimation, loop: boolean = false) => playAnimation(name, loop),
    resetView: () => {
      if (cameraRef.current && controlsRef.current && modelRef.current) {
        cameraRef.current.position.set(0, 8, 22);
        controlsRef.current.target.copy(modelRef.current.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
        controlsRef.current.update();
      }
    }
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
        const pulse = 1.0 + Math.sin(clock.elapsedTime * (mood === RobotVisualMood.EXCITED ? 10 : 2)) * 0.2;
        if (robotLightRef.current) robotLightRef.current.intensity = 40 * pulse;
        
        robotLightRef.current?.position.set(modelRef.current.position.x, modelRef.current.position.y + 3, modelRef.current.position.z + 2);
        controls.target.lerp(modelRef.current.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 0.1);
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => { renderer.dispose(); if (containerRef.current) containerRef.current.innerHTML = ''; };
  }, []);

  useEffect(() => { applyRobotSkins(); }, [style, color, theme, mood]);
  useEffect(() => { if (modelRef.current) modelRef.current.scale.set(size, size, size); }, [size]);

  return <div ref={containerRef} className="absolute inset-0 z-0 bg-black overflow-hidden" />;
});

export default RobotCanvas;
