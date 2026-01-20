
import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RobotStyle, RobotFinish, RobotAnimation, RobotVisualMood, SystemTheme, EnvironmentType } from '../types';

interface LightConfig {
  color: string;
  intensity: number;
  position: { x: number; y: number; z: number };
}

interface RobotCanvasProps {
  style: RobotStyle;
  finish: RobotFinish;
  size: number;
  mood: RobotVisualMood;
  theme: SystemTheme;
  environment: EnvironmentType;
  color: string;
  gridColor: string;
  overheadLight: LightConfig;
  accentLight: LightConfig;
  useManualLighting: boolean;
}

export interface RobotRef {
  triggerAnimation: (name: RobotAnimation, loop?: boolean) => void;
  resetView: () => void;
}

const MODEL_URL = 'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb';

const RobotCanvas = forwardRef<RobotRef, RobotCanvasProps>((props, ref) => {
  const { 
    style, finish, size, mood, theme, environment, color, gridColor,
    overheadLight, accentLight, useManualLighting 
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<{ [key: string]: THREE.AnimationAction }>({});
  const activeActionRef = useRef<THREE.AnimationAction | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  
  const overheadLightRef = useRef<THREE.SpotLight | null>(null);
  const accentLightRef = useRef<THREE.PointLight | null>(null);
  const rimLightRef = useRef<THREE.PointLight | null>(null);
  const fillLightRef = useRef<THREE.DirectionalLight | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  }, [props]);

  const targetColor = useRef(new THREE.Color(0x7096ff));
  const currentAccentColor = useRef(new THREE.Color(0x7096ff));
  const currentArmorColor = useRef(new THREE.Color(color));
  const currentGridColor = useRef(new THREE.Color(gridColor));

  const playAnimation = (name: string, loop: boolean = false) => {
    let clipName = name;
    if (name === RobotAnimation.FLEX) clipName = 'Punch';
    if (name.startsWith('Dance_')) clipName = 'Dance';
    const action = actionsRef.current[clipName];
    if (action && activeActionRef.current !== action) {
      if (activeActionRef.current) activeActionRef.current.fadeOut(0.3);
      action.reset().setLoop(loop || ['Idle', 'Walking', 'Running'].includes(clipName) ? THREE.LoopRepeat : THREE.LoopOnce, Infinity).fadeIn(0.3).play();
      activeActionRef.current = action;
    }
  };

  useImperativeHandle(ref, () => ({
    triggerAnimation: (name: RobotAnimation, loop: boolean = false) => playAnimation(name, loop),
    resetView: () => {
      if (cameraRef.current) cameraRef.current.position.set(0, 5, 14);
      if (modelRef.current) {
        modelRef.current.position.set(0, 0, 0);
        modelRef.current.rotation.set(0, 0, 0);
      }
    }
  }));

  const getThemeAccentHex = (t: SystemTheme) => {
    switch (t) {
      case SystemTheme.CYBER_BLUE: return 0x7096ff;
      case SystemTheme.SANGUINE: return 0x990000;
      case SystemTheme.PHOSPHOR: return 0x00ff99;
      case SystemTheme.DEEP_SEA: return 0x00e5ff;
      case SystemTheme.CRIMSON: return 0xff1e1e;
      case SystemTheme.VERIDIAN: return 0x00ffaa;
      case SystemTheme.GOLD_LEAF: return 0xFFD700;
      case SystemTheme.TOXIC_LIME: return 0xCCFF00;
      case SystemTheme.ELECTRIC_VIOLET: return 0x8a2be2;
      case SystemTheme.SOLAR_ORANGE: return 0xff4500;
      case SystemTheme.NEON_PINK: return 0xff007f;
      case SystemTheme.NEURAL_WHITE: return 0xffffff;
      default: return 0x39ff14;
    }
  };

  const getMoodColor = (m: RobotVisualMood, t: SystemTheme) => {
    switch (m) {
      case RobotVisualMood.HAPPY: return 0x00ff88;
      case RobotVisualMood.ANGRY: return 0xff1100;
      case RobotVisualMood.LOADING: return 0xffaa00;
      case RobotVisualMood.PAINTING: return 0xff00cc;
      case RobotVisualMood.EXCITED: return 0x00ffff;
      default: return getThemeAccentHex(t);
    }
  };

  useEffect(() => {
    targetColor.current.setHex(getMoodColor(mood, theme));
  }, [theme, mood]);

  useEffect(() => {
    if (!containerRef.current) return;
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x010101);

    const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 14);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25; 
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.35, 0.4, 0.85);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    composerRef.current = composer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 1.95;
    controls.minDistance = 4;
    controls.maxDistance = 22;

    const ambient = new THREE.AmbientLight(0xffffff, 0.7); 
    scene.add(ambient);
    
    const fill = new THREE.DirectionalLight(0xffffff, 0.6); 
    fill.position.set(-10, 5, 5);
    scene.add(fill);
    fillLightRef.current = fill;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 0.9); 
    hemi.position.set(0, 50, 0);
    scene.add(hemi);

    const overhead = new THREE.SpotLight(0xffffff, 180); 
    overhead.position.set(10, 30, 10);
    overhead.castShadow = true;
    overhead.angle = Math.PI / 4;
    overhead.penumbra = 0.6;
    scene.add(overhead);
    overheadLightRef.current = overhead;

    const accent = new THREE.PointLight(0xffffff, 120, 100); 
    accent.position.set(-15, 8, 15);
    scene.add(accent);
    accentLightRef.current = accent;

    const rim = new THREE.PointLight(0xffffff, 150, 50); 
    rim.position.set(5, 10, -10);
    scene.add(rim);
    rimLightRef.current = rim;

    const floorGeo = new THREE.PlaneGeometry(200, 200);
    const floorMat = new THREE.MeshStandardMaterial({ 
      color: 0x000000, 
      roughness: 0.85,
      metalness: 0.1, 
      transparent: true,
      opacity: 0.98
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(100, 50, 0x555555, 0x111111);
    grid.position.y = 0.01;
    scene.add(grid);
    gridRef.current = grid;

    const loader = new GLTFLoader();
    loader.load(MODEL_URL, (gltf) => {
      const model = gltf.scene;
      modelRef.current = model;
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.material = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            metalness: 1.0,
            roughness: 0.15,
            reflectivity: 0.9,
            envMapIntensity: 1.5,
            clearcoat: 0.8,
            clearcoatRoughness: 0.1,
          });
        }
      });
      scene.add(model);
      const mixer = new THREE.AnimationMixer(model);
      mixerRef.current = mixer;
      gltf.animations.forEach(clip => { actionsRef.current[clip.name] = mixer.clipAction(clip); });
      playAnimation(RobotAnimation.IDLE);
    });

    const clock = new THREE.Clock();
    const animate = () => {
      requestAnimationFrame(animate);
      const dt = clock.getDelta();
      const currentProps = propsRef.current;

      if (modelRef.current) {
        currentArmorColor.current.lerp(new THREE.Color(currentProps.color), 0.2);
        currentAccentColor.current.lerp(targetColor.current, 0.15);
        currentGridColor.current.lerp(new THREE.Color(currentProps.gridColor), 0.2);

        const armorColor = currentArmorColor.current.clone();
        
        let metalness = 1.0, 
            roughness = 0.18, 
            sheen = 0.1, 
            clearcoat = 0.8, 
            envIntensity = 1.5, 
            reflectivity = 0.9,
            clearcoatRoughness = 0.1;
        
        if (currentProps.finish === RobotFinish.MATTE) {
          metalness = 0.05;
          roughness = 0.85;
          sheen = 1.0;
          clearcoat = 0.0;
          envIntensity = 0.25;
          reflectivity = 0.1;
          clearcoatRoughness = 0.9;
        }

        if (currentProps.style === RobotStyle.BLACK_DIAMOND) {
          armorColor.lerp(new THREE.Color(0x000000), 0.82);
          if (currentProps.finish === RobotFinish.METALLIC) envIntensity = 2.0;
        } else if (currentProps.style === RobotStyle.GOLD) {
          armorColor.lerp(new THREE.Color(0xffd700), 0.35);
        } else if (currentProps.style === RobotStyle.STEALTH) {
          armorColor.lerp(new THREE.Color(0x010101), 0.93);
          metalness = 0.1; roughness = 0.95; sheen = 0; clearcoat = 0; envIntensity = 0.15;
        }

        const brightness = (armorColor.r + armorColor.g + armorColor.b) / 3;
        const autoLightingFactor = brightness < 0.2 ? 1.7 : 1.05;

        modelRef.current.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const mat = mesh.material as THREE.MeshPhysicalMaterial;
            const isEmissive = child.name.toLowerCase().includes('eye') || child.name.toLowerCase().includes('mouth');

            if (isEmissive) {
              const eCol = currentAccentColor.current;
              mat.color.copy(eCol);
              mat.emissive.copy(eCol);
              mat.emissiveIntensity = 4.5;
              mat.metalness = 0;
            } else {
              mat.color.copy(armorColor);
              mat.metalness = THREE.MathUtils.lerp(mat.metalness, metalness, 0.1);
              mat.roughness = THREE.MathUtils.lerp(mat.roughness, roughness, 0.1);
              mat.sheen = THREE.MathUtils.lerp(mat.sheen || 0, sheen, 0.1);
              mat.clearcoat = THREE.MathUtils.lerp(mat.clearcoat || 0, clearcoat, 0.1);
              mat.clearcoatRoughness = THREE.MathUtils.lerp(mat.clearcoatRoughness || 0, clearcoatRoughness, 0.1);
              mat.reflectivity = THREE.MathUtils.lerp(mat.reflectivity, reflectivity, 0.1);
              mat.envMapIntensity = THREE.MathUtils.lerp(mat.envMapIntensity, envIntensity, 0.1);
              mat.sheenColor.copy(currentArmorColor.current).lerp(new THREE.Color(0xffffff), 0.2);
              mat.emissive.set(0,0,0);
            }
          }
        });

        floorMat.color.copy(armorColor).lerp(new THREE.Color(0x000000), 0.96);
        
        if (gridRef.current) {
          const finalGridColor = currentGridColor.current.clone();
          gridRef.current.material.color.copy(finalGridColor).multiplyScalar(0.2); 
          gridRef.current.material.opacity = 0.2 + (0.12 * (1 - brightness));
        }

        if (sceneRef.current) {
          const bgCol = currentArmorColor.current.clone().lerp(new THREE.Color(0x000000), 0.993);
          sceneRef.current.background = bgCol;
        }

        if (!currentProps.useManualLighting) {
          if (accentLightRef.current) {
            accentLightRef.current.color.copy(currentArmorColor.current);
            accentLightRef.current.intensity = 170 * autoLightingFactor; 
          }
          if (rimLightRef.current) {
            rimLightRef.current.color.copy(currentArmorColor.current).lerp(new THREE.Color(0xffffff), 0.6);
            rimLightRef.current.intensity = 210 * autoLightingFactor; 
          }
          if (fillLightRef.current) {
            fillLightRef.current.intensity = 0.75 * autoLightingFactor; 
          }
          if (overheadLightRef.current) {
            overheadLightRef.current.intensity = 150 * autoLightingFactor; 
          }
        }
      }

      if (mixerRef.current) mixerRef.current.update(dt);
      controls.update();
      composer.render();
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, []);

  useEffect(() => {
    if (modelRef.current) modelRef.current.scale.set(size, size, size);
  }, [size]);

  useEffect(() => {
    if (overheadLightRef.current && useManualLighting) {
      overheadLightRef.current.color.set(overheadLight.color);
      overheadLightRef.current.intensity = overheadLight.intensity;
      overheadLightRef.current.position.set(overheadLight.position.x, overheadLight.position.y, overheadLight.position.z);
    }
    if (accentLightRef.current && useManualLighting) {
      accentLightRef.current.color.set(accentLight.color);
      accentLightRef.current.intensity = accentLight.intensity;
      accentLightRef.current.position.set(accentLight.position.x, accentLight.position.y, accentLight.position.z);
    }
  }, [useManualLighting, overheadLight, accentLight]);

  return <div ref={containerRef} className="absolute inset-0 z-0 bg-black" />;
});

export default RobotCanvas;
