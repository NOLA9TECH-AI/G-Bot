
import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RobotStyle, RobotAnimation, RobotVisualMood, SystemTheme, EnvironmentType } from '../types';

interface LightConfig {
  color: string;
  intensity: number;
  position: { x: number; y: number; z: number };
}

interface RobotCanvasProps {
  style: RobotStyle;
  size: number;
  mood: RobotVisualMood;
  theme: SystemTheme;
  environment: EnvironmentType;
  color: string;
  overheadLight: LightConfig;
  accentLight: LightConfig;
  useManualLighting: boolean;
}

export interface RobotRef {
  triggerAnimation: (name: RobotAnimation, loop?: boolean) => void;
  resetView: () => void;
}

const MODEL_URL = 'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb';

const RobotCanvas = forwardRef<RobotRef, RobotCanvasProps>(({ 
  style, size, mood, theme, environment, color,
  overheadLight, accentLight, useManualLighting
}, ref) => {
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
  
  const targetColor = useRef(new THREE.Color(0x7096ff));
  const currentAccentColor = useRef(new THREE.Color(0x7096ff));

  // State for the "Run to User" sequence
  const isApproaching = useRef(false);
  const targetZ = useRef(9.8); 
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());

  const getThemeAccentHex = () => {
    switch (theme) {
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

  const getMoodColor = () => {
    switch (mood) {
      case RobotVisualMood.HAPPY: return 0x00ff88;
      case RobotVisualMood.ANGRY: return 0xff1100;
      case RobotVisualMood.LOADING: return 0xffaa00;
      case RobotVisualMood.PAINTING: return 0xff00cc;
      case RobotVisualMood.EXCITED: return 0x00ffff;
      default: return getThemeAccentHex();
    }
  };

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
      isApproaching.current = false;
      if (modelRef.current) {
        modelRef.current.position.set(0, 0, 0);
        modelRef.current.rotation.set(0, 0, 0);
      }
    }
  }));

  useEffect(() => {
    targetColor.current.setHex(getMoodColor());
  }, [theme, mood]);

  useEffect(() => {
    if (overheadLightRef.current) {
      if (useManualLighting) {
        overheadLightRef.current.color.set(overheadLight.color);
        overheadLightRef.current.intensity = overheadLight.intensity; 
        overheadLightRef.current.position.set(overheadLight.position.x, overheadLight.position.y, overheadLight.position.z);
      } else {
        overheadLightRef.current.color.set(0xffffff);
        overheadLightRef.current.intensity = 200; // REDUCED
        overheadLightRef.current.position.set(0, 20, 10);
      }
    }
    if (accentLightRef.current) {
      if (useManualLighting) {
        accentLightRef.current.color.set(accentLight.color);
        accentLightRef.current.intensity = accentLight.intensity;
        accentLightRef.current.position.set(accentLight.position.x, accentLight.position.y, accentLight.position.z);
      } else {
        accentLightRef.current.intensity = 80; // REDUCED
      }
    }
  }, [useManualLighting, overheadLight, accentLight]);

  useEffect(() => {
    if (!containerRef.current) return;
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x010101);

    const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 14);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8; // REDUCED EXPOSURE
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.2, 0.4, 0.8); // REDUCED BLOOM
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    composerRef.current = composer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2;
    controls.minDistance = 2;
    controls.maxDistance = 30;

    scene.add(new THREE.AmbientLight(0xffffff, 0.3)); // REDUCED AMBIENT
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4); // REDUCED HEMI
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const overhead = new THREE.SpotLight(0xffffff, 200);
    overhead.position.set(0, 20, 10);
    overhead.angle = Math.PI / 4;
    overhead.penumbra = 0.5;
    scene.add(overhead);
    overheadLightRef.current = overhead;

    const accentLight = new THREE.PointLight(currentAccentColor.current, 80, 40);
    accentLight.position.set(0, 4, 10);
    scene.add(accentLight);
    accentLightRef.current = accentLight;

    const floorGeo = new THREE.CircleGeometry(15, 64);
    const floorMat = new THREE.MeshStandardMaterial({ 
      color: 0x040404, 
      roughness: 0.1, 
      metalness: 0.2,
      transparent: true,
      opacity: 0.8
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    scene.add(floor);

    const loader = new GLTFLoader();
    loader.load(MODEL_URL, (gltf) => {
      const model = gltf.scene;
      modelRef.current = model;
      model.position.set(0, 0, 0);
      scene.add(model);
      const mixer = new THREE.AnimationMixer(model);
      mixerRef.current = mixer;
      gltf.animations.forEach(clip => { actionsRef.current[clip.name] = mixer.clipAction(clip); });
      playAnimation(RobotAnimation.IDLE);
    });

    const onPointerDown = (event: PointerEvent) => {
      if (!modelRef.current || !cameraRef.current) return;
      
      mouse.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
      
      raycaster.current.setFromCamera(mouse.current, cameraRef.current);
      const intersects = raycaster.current.intersectObject(modelRef.current, true);
      
      if (intersects.length > 0 && !isApproaching.current) {
        isApproaching.current = true;
        playAnimation(RobotAnimation.RUNNING);
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    const clock = new THREE.Clock();
    const animate = () => {
      requestAnimationFrame(animate);
      const dt = clock.getDelta();
      
      if (!useManualLighting) {
        currentAccentColor.current.lerp(targetColor.current, 0.05);
        if (accentLightRef.current) accentLightRef.current.color.copy(currentAccentColor.current);
      }

      if (modelRef.current) {
        if (isApproaching.current) {
          const targetRotation = 0; 
          
          modelRef.current.rotation.y = THREE.MathUtils.lerp(modelRef.current.rotation.y, targetRotation, 0.1);
          modelRef.current.position.x = THREE.MathUtils.lerp(modelRef.current.position.x, 0, 0.08);
          modelRef.current.position.z = THREE.MathUtils.lerp(modelRef.current.position.z, targetZ.current, 0.05);

          if (Math.abs(modelRef.current.position.z - targetZ.current) < 0.1) {
            isApproaching.current = false;
            modelRef.current.position.x = 0;
            modelRef.current.rotation.y = targetRotation;
            
            playAnimation(RobotAnimation.GREET); 
            setTimeout(() => {
               if (!isApproaching.current && modelRef.current) {
                 playAnimation(RobotAnimation.IDLE);
               }
            }, 3000);
          }
        }

        const bodyCol = new THREE.Color(color);
        let metalness = 0.5, roughness = 0.5, clearcoat = 0.5, flatShading = false;
        
        if (style === RobotStyle.BLACK_DIAMOND) { 
          metalness = 1.0; 
          roughness = 0.02; 
          clearcoat = 1.0; 
          bodyCol.set(0x050505); 
          flatShading = true; // CREATES THE FACETED LOOK
        } else if (style === RobotStyle.STREET) { 
          metalness = 0.1; roughness = 0.7; clearcoat = 0.1; 
        } else if (style === RobotStyle.GOLD) { 
          metalness = 1.0; roughness = 0.1; bodyCol.set(0xffd700); 
        } else if (style === RobotStyle.STEALTH) { 
          metalness = 0.05; roughness = 0.9; bodyCol.set(0x151515); 
        }

        modelRef.current.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const isEmissive = child.name.toLowerCase().includes('eye') || child.name.toLowerCase().includes('mouth');
            
            if (!mesh.material || !(mesh.material instanceof THREE.MeshPhysicalMaterial)) {
              mesh.material = new THREE.MeshPhysicalMaterial({ reflectivity: 1.0, envMapIntensity: 1.0 });
            }
            
            const mat = mesh.material as THREE.MeshPhysicalMaterial;
            mat.flatShading = flatShading; // Faceting applied here
            mat.needsUpdate = true; // Required when changing flatShading property

            if (isEmissive) {
              const emissiveCol = useManualLighting ? new THREE.Color(accentLight.color) : currentAccentColor.current;
              mat.color.copy(emissiveCol);
              mat.emissive.copy(emissiveCol);
              mat.emissiveIntensity = 2.0; // REDUCED GLOW
              mat.metalness = 0;
            } else {
              mat.color.copy(bodyCol);
              mat.emissive.set(0,0,0);
              mat.metalness = metalness;
              mat.roughness = roughness;
              mat.clearcoat = clearcoat;
            }
          }
        });
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
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.dispose();
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, []);

  useEffect(() => { if (modelRef.current) modelRef.current.scale.set(size, size, size); }, [size]);

  return <div ref={containerRef} className="absolute inset-0 z-0 bg-black cursor-crosshair" />;
});

export default RobotCanvas;
