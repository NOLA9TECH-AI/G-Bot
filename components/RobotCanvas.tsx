
import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RobotStyle, RobotAnimation, RobotVisualMood, SystemTheme } from '../types';

interface RobotCanvasProps {
  style: RobotStyle;
  size: number;
  mood: RobotVisualMood;
  theme: SystemTheme;
}

export interface RobotRef {
  triggerAnimation: (name: RobotAnimation) => void;
}

const MODEL_URL = 'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb';

const RobotCanvas = forwardRef<RobotRef, RobotCanvasProps>(({ style, size, mood, theme }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<{ [key: string]: THREE.AnimationAction }>({});
  const activeActionRef = useRef<THREE.AnimationAction | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const spot1Ref = useRef<THREE.SpotLight | null>(null);
  const spot2Ref = useRef<THREE.SpotLight | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const envMapRef = useRef<THREE.Texture | null>(null);
  const idleReturnTimeoutRef = useRef<number | null>(null);

  // Core animation trigger logic
  const playAnimation = (name: string) => {
    let actualClipName: string = name;
    
    // Semantic mappings to the actual GLB clips
    if (name === RobotAnimation.CELEBRATE) actualClipName = RobotAnimation.THUMBSUP;
    if (name === RobotAnimation.PONDER) actualClipName = RobotAnimation.SITTING;
    if (name === RobotAnimation.ALERT) actualClipName = RobotAnimation.JUMP;
    if (name === RobotAnimation.SHUTDOWN) actualClipName = RobotAnimation.DEATH;
    if (name === RobotAnimation.FLEX) actualClipName = RobotAnimation.PUNCH;
    if (name === RobotAnimation.SHOCK) actualClipName = RobotAnimation.JUMP;
    if (name === RobotAnimation.SULK) actualClipName = RobotAnimation.SITTING;
    if (name === RobotAnimation.GREET) actualClipName = RobotAnimation.WAVE;

    const action = actionsRef.current[actualClipName];
    if (action) {
      fadeToAction(actualClipName, 0.2);
      
      // Clear any existing return-to-idle timers
      if (idleReturnTimeoutRef.current) {
        window.clearTimeout(idleReturnTimeoutRef.current);
        idleReturnTimeoutRef.current = null;
      }

      // If it's a one-shot animation (not a loop like Walking/Dancing), return to Idle
      if (!['Idle', 'Walking', 'Running', 'Dance', 'Sitting', 'Standing'].includes(actualClipName)) {
        const duration = action.getClip().duration;
        idleReturnTimeoutRef.current = window.setTimeout(() => {
          fadeToAction(RobotAnimation.IDLE, 0.5);
          idleReturnTimeoutRef.current = null;
        }, duration * 1000);
      }
    }
  };

  useImperativeHandle(ref, () => ({
    triggerAnimation: (name: RobotAnimation) => {
      playAnimation(name);
    }
  }));

  const fadeToAction = (name: string, duration: number) => {
    const previousAction = activeActionRef.current;
    const activeAction = actionsRef.current[name];

    if (activeAction && previousAction !== activeAction) {
      if (previousAction) previousAction.fadeOut(duration);
      activeAction.reset().fadeIn(duration).play();
      activeActionRef.current = activeAction;
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.03);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(-5, 3, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    containerRef.current.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envScene = new RoomEnvironment();
    const envMap = pmremGenerator.fromScene(envScene).texture;
    scene.environment = envMap;
    envMapRef.current = envMap;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 2, 0);
    controls.enableDamping = true;
    controls.update();

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2);
    scene.add(hemiLight);

    const spot1 = new THREE.SpotLight(0x39ff14, 150, 20, Math.PI / 4, 0.5);
    spot1.position.set(5, 10, 5);
    scene.add(spot1);
    spot1Ref.current = spot1;

    const spot2 = new THREE.SpotLight(0xbc13fe, 150, 20, Math.PI / 4, 0.5);
    spot2.position.set(-5, 10, -5);
    scene.add(spot2);
    spot2Ref.current = spot2;

    const grid = new THREE.GridHelper(200, 40, 0x39ff14, 0x050505);
    grid.position.y = -0.01;
    scene.add(grid);
    gridRef.current = grid;

    const loader = new GLTFLoader();
    loader.load(MODEL_URL, (gltf) => {
      const model = gltf.scene;
      modelRef.current = model;
      scene.add(model);

      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const prevMaterial = mesh.material as THREE.MeshStandardMaterial;
          mesh.material = new THREE.MeshPhysicalMaterial({
             color: prevMaterial.color,
             metalness: 0.5,
             roughness: 0.5,
             envMap: envMap,
             envMapIntensity: 1.0,
          });
        }
      });

      const mixer = new THREE.AnimationMixer(model);
      mixerRef.current = mixer;

      gltf.animations.forEach((clip) => {
        const action = mixer.clipAction(clip);
        actionsRef.current[clip.name] = action;
        // Non-looping one-shots
        if (!['Idle', 'Walking', 'Running', 'Dance', 'Sitting', 'Standing'].includes(clip.name)) {
          action.clampWhenFinished = true;
          action.loop = THREE.LoopOnce;
        }
      });

      const idleAction = actionsRef.current[RobotAnimation.IDLE];
      if (idleAction) {
        idleAction.play();
        activeActionRef.current = idleAction;
      }
    });

    const clock = new THREE.Clock();
    const animate = () => {
      requestAnimationFrame(animate);
      const dt = clock.getDelta();
      
      if (mixerRef.current) mixerRef.current.update(dt);
      controls.update();
      
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      pmremGenerator.dispose();
      renderer.dispose();
      if (containerRef.current) containerRef.current.innerHTML = '';
      if (idleReturnTimeoutRef.current) window.clearTimeout(idleReturnTimeoutRef.current);
    };
  }, []);

  // Autonomous "Life" Loop Effect
  useEffect(() => {
    let lifeTimeout: number;

    const scheduleLifeEvent = () => {
      // Trigger random idle animation every 8-18 seconds
      const delay = 8000 + Math.random() * 10000;
      lifeTimeout = window.setTimeout(() => {
        // Only trigger if we are currently idling and in a calm mood
        const isCurrentIdle = activeActionRef.current?.getClip().name === RobotAnimation.IDLE;
        const isRobotCalm = mood === RobotVisualMood.NONE;

        if (isCurrentIdle && isRobotCalm && mixerRef.current) {
          const lifeAnimations = [
            RobotAnimation.YES,
            RobotAnimation.NO,
            RobotAnimation.WAVE,
            RobotAnimation.THUMBSUP,
            RobotAnimation.JUMP
          ];
          const randomChoice = lifeAnimations[Math.floor(Math.random() * lifeAnimations.length)];
          playAnimation(randomChoice);
        }
        scheduleLifeEvent();
      }, delay);
    };

    scheduleLifeEvent();

    return () => {
      if (lifeTimeout) window.clearTimeout(lifeTimeout);
    };
  }, [mood]); // Re-run if mood changes to ensure we don't start loops during active tasks

  useEffect(() => {
    if (!spot1Ref.current || !spot2Ref.current || !gridRef.current) return;
    
    switch (theme) {
      case SystemTheme.HOOD:
        spot1Ref.current.color.setHex(0xFFD700); 
        spot2Ref.current.color.setHex(0x00BFFF); 
        gridRef.current.material.color.setHex(0xFFD700);
        break;
      case SystemTheme.TOXIC:
        spot1Ref.current.color.setHex(0xCCFF00); 
        spot2Ref.current.color.setHex(0xFF3300); 
        gridRef.current.material.color.setHex(0xCCFF00);
        break;
      case SystemTheme.FROST:
        spot1Ref.current.color.setHex(0x00FFFF); 
        spot2Ref.current.color.setHex(0xFFFFFF); 
        gridRef.current.material.color.setHex(0x00FFFF);
        break;
      case SystemTheme.BLOOD:
        spot1Ref.current.color.setHex(0xFF0000); 
        spot2Ref.current.color.setHex(0x660000); 
        gridRef.current.material.color.setHex(0xFF0000);
        break;
      case SystemTheme.VOID:
        spot1Ref.current.color.setHex(0x9400D3); 
        spot2Ref.current.color.setHex(0x4B0082); 
        gridRef.current.material.color.setHex(0x9400D3);
        break;
      case SystemTheme.SUNSET:
        spot1Ref.current.color.setHex(0xFF4500); 
        spot2Ref.current.color.setHex(0xFF1493); 
        gridRef.current.material.color.setHex(0xFF8C00);
        break;
      case SystemTheme.EMERALD:
        spot1Ref.current.color.setHex(0x50C878); 
        spot2Ref.current.color.setHex(0xFFD700); 
        gridRef.current.material.color.setHex(0x50C878);
        break;
      case SystemTheme.MIDNIGHT:
        spot1Ref.current.color.setHex(0x191970); 
        spot2Ref.current.color.setHex(0xC0C0C0); 
        gridRef.current.material.color.setHex(0x191970);
        break;
      default:
        spot1Ref.current.color.setHex(0x39ff14); 
        spot2Ref.current.color.setHex(0xbc13fe); 
        gridRef.current.material.color.setHex(0x39ff14);
    }
    gridRef.current.transparent = true;
    gridRef.current.opacity = 0.2;
  }, [theme]);

  useEffect(() => {
    if (!modelRef.current) return;
    modelRef.current.scale.set(size, size, size);

    let accentHex = 0x39ff14;
    let secondaryHex = 0xbc13fe;

    switch (theme) {
      case SystemTheme.HOOD: accentHex = 0xFFD700; secondaryHex = 0x00BFFF; break;
      case SystemTheme.TOXIC: accentHex = 0xCCFF00; secondaryHex = 0xFF3300; break;
      case SystemTheme.FROST: accentHex = 0x00FFFF; secondaryHex = 0xFFFFFF; break;
      case SystemTheme.BLOOD: accentHex = 0xFF0000; secondaryHex = 0x660000; break;
      case SystemTheme.VOID: accentHex = 0x9400D3; secondaryHex = 0x4B0082; break;
      case SystemTheme.SUNSET: accentHex = 0xFF4500; secondaryHex = 0xFF1493; break;
      case SystemTheme.EMERALD: accentHex = 0x50C878; secondaryHex = 0xFFD700; break;
      case SystemTheme.MIDNIGHT: accentHex = 0x191970; secondaryHex = 0xC0C0C0; break;
    }

    modelRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const material = mesh.material as THREE.MeshPhysicalMaterial;
        
        material.envMap = envMapRef.current;
        material.envMapIntensity = 1.5;

        const isEye = mesh.name.toLowerCase().includes('eye');
        const isJoint = mesh.name.toLowerCase().includes('joint') || mesh.name.toLowerCase().includes('link');

        let targetStyle = style;
        if (theme === SystemTheme.HOOD && style === RobotStyle.CYBER) targetStyle = RobotStyle.GOLD;

        switch (targetStyle) {
          case RobotStyle.GOLD:
            material.color.setHex(isEye ? 0xFFFFFF : 0xFFD700);
            material.metalness = 1.0;
            material.roughness = 0.05;
            material.clearcoat = 1.0;
            material.emissive.setHex(isEye ? 0xFFD700 : 0x000000);
            material.emissiveIntensity = isEye ? 2.0 : 0;
            break;
          case RobotStyle.STEALTH:
            material.color.setHex(isEye ? accentHex : 0x080808);
            material.metalness = 0.9;
            material.roughness = 0.3;
            material.clearcoat = 0.2;
            material.emissive.setHex(isEye ? accentHex : 0x000000);
            material.emissiveIntensity = isEye ? 3.0 : 0;
            break;
          case RobotStyle.STREET:
            material.color.setHex(isEye ? 0xFFFFFF : secondaryHex);
            material.metalness = 0.3;
            material.roughness = 0.2;
            material.emissive.setHex(isEye ? secondaryHex : 0x000000);
            material.emissiveIntensity = isEye ? 1.5 : 0;
            break;
          default: // CYBER
            material.color.setHex(isEye ? 0xFFFFFF : 0xDDDDDD);
            material.metalness = 0.4;
            material.roughness = 0.6;
            material.emissive.setHex(isEye || isJoint ? accentHex : 0x000000);
            material.emissiveIntensity = (isEye || isJoint) ? 1.0 : 0;
        }
        
        material.needsUpdate = true;
      }
    });
  }, [style, size, theme]);

  return <div ref={containerRef} className="absolute inset-0 z-0 bg-black" />;
});

export default RobotCanvas;
