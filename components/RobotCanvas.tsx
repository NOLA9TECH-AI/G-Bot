
import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
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

const BG_MAPS: Record<string, string> = {
  [EnvironmentType.NEURAL_VOID]: 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?auto=format&fit=crop&q=80&w=2000',
  [EnvironmentType.CYBER_DISTRICT]: 'https://images.unsplash.com/photo-1605806616949-1e87b487fc2f?auto=format&fit=crop&q=80&w=2000',
  [EnvironmentType.DATA_CORE]: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=2000',
  [EnvironmentType.SYNTH_HORIZON]: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=2000',
  [EnvironmentType.MECHA_HANGAR]: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=2000',
  [EnvironmentType.NEO_TOKYO]: 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?auto=format&fit=crop&q=80&w=2000'
};

const RobotCanvas = forwardRef<RobotRef, RobotCanvasProps>(({ style, size, mood, theme, environment, color }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<{ [key: string]: THREE.AnimationAction }>({});
  const activeActionRef = useRef<THREE.AnimationAction | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const spot1Ref = useRef<THREE.SpotLight | null>(null);
  const spot2Ref = useRef<THREE.SpotLight | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const textureLoaderRef = useRef<THREE.TextureLoader | null>(null);
  const idleReturnTimeoutRef = useRef<number | null>(null);
  
  // Navigation Refs
  const targetPositionRef = useRef<THREE.Vector3 | null>(null);
  const targetRotationYRef = useRef<number | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const groundPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));

  const envMapRef = useRef<THREE.Texture | null>(null);

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
      default: return 0x39ff14;
    }
  };

  const applyRobotSkins = () => {
    if (!modelRef.current) return;
    const accentHex = getThemeAccentHex();
    const accentColor = new THREE.Color(accentHex);
    const bodyColor = new THREE.Color(color);

    modelRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        let mat: THREE.MeshPhysicalMaterial;

        const isEmissivePart = child.name.toLowerCase().includes('eye') || child.name.toLowerCase().includes('mouth');

        if (style === RobotStyle.CYBER) {
          mat = new THREE.MeshPhysicalMaterial({
            color: isEmissivePart ? accentColor : bodyColor,
            metalness: isEmissivePart ? 0 : 0.95,
            roughness: isEmissivePart ? 0.2 : 0.1,
            emissive: isEmissivePart ? accentColor : new THREE.Color(0x000000),
            emissiveIntensity: isEmissivePart ? 5.0 : 0.0,
            envMap: envMapRef.current,
            envMapIntensity: 1.5,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
          });
        } else if (style === RobotStyle.STEALTH) {
          mat = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(0x050505),
            metalness: 0.1,
            roughness: 0.9,
            envMap: envMapRef.current,
            envMapIntensity: 0.2,
          });
        } else if (style === RobotStyle.GOLD) {
          mat = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(0xFFD700),
            metalness: 1.0,
            roughness: 0.05,
            envMap: envMapRef.current,
            envMapIntensity: 2.0,
            clearcoat: 1.0,
          });
        } else {
          mat = new THREE.MeshPhysicalMaterial({
            color: bodyColor,
            metalness: 0.8,
            roughness: 0.2,
            envMap: envMapRef.current,
            envMapIntensity: 1.0,
          });
        }
        mesh.material = mat;
      }
    });
  };

  const playAnimation = (name: string) => {
    let actualClipName: string = name;
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
      if (idleReturnTimeoutRef.current) {
        window.clearTimeout(idleReturnTimeoutRef.current);
        idleReturnTimeoutRef.current = null;
      }
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
    sceneRef.current = scene;
    scene.fog = new THREE.FogExp2(0x000000, 0.05);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(-6, 4, 12);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    containerRef.current.appendChild(renderer.domElement);

    textureLoaderRef.current = new THREE.TextureLoader();

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envScene = new RoomEnvironment();
    const envMap = pmremGenerator.fromScene(envScene).texture;
    envMapRef.current = envMap;
    scene.environment = envMap;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.5, 0);
    controls.enableDamping = true;
    controls.maxDistance = 30;
    controls.minDistance = 3;
    controls.maxPolarAngle = Math.PI / 1.8;
    controls.update();

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2.0);
    scene.add(hemiLight);

    const spot1 = new THREE.SpotLight(0x39ff14, 400, 40, Math.PI / 4, 0.4);
    spot1.position.set(5, 15, 5);
    scene.add(spot1);
    spot1Ref.current = spot1;

    const spot2 = new THREE.SpotLight(0xbc13fe, 200, 40, Math.PI / 4, 0.4);
    spot2.position.set(-5, 15, -5);
    scene.add(spot2);
    spot2Ref.current = spot2;

    const grid = new THREE.GridHelper(30, 60, 0x39ff14, 0x0a0a0a);
    grid.position.y = 0.01;
    scene.add(grid);
    gridRef.current = grid;

    const loader = new GLTFLoader();
    loader.load(MODEL_URL, (gltf) => {
      const model = gltf.scene;
      modelRef.current = model;
      scene.add(model);
      
      applyRobotSkins();

      const mixer = new THREE.AnimationMixer(model);
      mixerRef.current = mixer;
      gltf.animations.forEach((clip) => {
        const action = mixer.clipAction(clip);
        actionsRef.current[clip.name] = action;
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
      const elapsed = clock.getElapsedTime();
      
      if (mixerRef.current) mixerRef.current.update(dt);

      // Emissive Pulse Effect
      if (modelRef.current && style === RobotStyle.CYBER) {
        const pulse = 2.0 + Math.sin(elapsed * 4.0) * 1.5;
        modelRef.current.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mat = (child as THREE.Mesh).material as THREE.MeshPhysicalMaterial;
            if (mat && mat.emissiveIntensity !== undefined && mat.emissiveIntensity > 0) {
              mat.emissiveIntensity = pulse;
            }
          }
        });
      }

      // Smooth Navigation and Rotation Logic
      if (modelRef.current) {
        // Handle explicit rotation targets (like facing the user)
        if (targetRotationYRef.current !== null) {
          modelRef.current.rotation.y = THREE.MathUtils.lerp(
            modelRef.current.rotation.y, 
            targetRotationYRef.current, 
            0.1
          );
          
          // Clear target once reached
          if (Math.abs(modelRef.current.rotation.y - targetRotationYRef.current) < 0.01) {
            targetRotationYRef.current = null;
          }
        }

        if (targetPositionRef.current) {
          const currentPos = modelRef.current.position;
          const targetPos = targetPositionRef.current;
          const distance = currentPos.distanceTo(targetPos);

          if (distance > 0.1) {
            const direction = new THREE.Vector3().subVectors(targetPos, currentPos).normalize();
            const targetRotationY = Math.atan2(direction.x, direction.z);
            modelRef.current.rotation.y = THREE.MathUtils.lerp(modelRef.current.rotation.y, targetRotationY, 0.1);
            const moveStep = direction.multiplyScalar(Math.min(0.12, distance));
            modelRef.current.position.add(moveStep);
            if (activeActionRef.current?.getClip().name !== RobotAnimation.WALKING) {
              playAnimation(RobotAnimation.WALKING);
            }
          } else {
            targetPositionRef.current = null;
            const emotes = [RobotAnimation.THUMBSUP, RobotAnimation.WAVE, RobotAnimation.GREET];
            const randomEmote = emotes[Math.floor(Math.random() * emotes.length)];
            playAnimation(randomEmote);
          }
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target !== renderer.domElement) return;
      
      // Update mouse vector
      mouseRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
      
      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      // 1. Check if clicked on the robot itself
      if (modelRef.current) {
        const robotIntersects = raycasterRef.current.intersectObject(modelRef.current, true);
        if (robotIntersects.length > 0) {
          // USER PRESSED ON HIM: Stop, face user, and wave
          targetPositionRef.current = null; // Stop moving
          
          // Calculate rotation to face camera
          const camPos = camera.position.clone();
          const modelPos = modelRef.current.position.clone();
          // We only care about Y rotation
          const angle = Math.atan2(camPos.x - modelPos.x, camPos.z - modelPos.z);
          targetRotationYRef.current = angle;
          
          playAnimation(RobotAnimation.GREET);
          return; // Don't process ground click
        }
      }

      // 2. Check for ground movement if robot wasn't clicked
      const intersection = new THREE.Vector3();
      if (raycasterRef.current.ray.intersectPlane(groundPlaneRef.current, intersection)) {
        targetPositionRef.current = intersection.clone();
        targetRotationYRef.current = null; // Ground click overrides "face user" mode
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', handleResize);
      pmremGenerator.dispose();
      renderer.dispose();
      if (containerRef.current) containerRef.current.innerHTML = '';
      if (idleReturnTimeoutRef.current) window.clearTimeout(idleReturnTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    applyRobotSkins();
  }, [style, color, theme]);

  useEffect(() => {
    if (!sceneRef.current || !textureLoaderRef.current) return;
    if (environment === EnvironmentType.NONE) {
      sceneRef.current.background = new THREE.Color(0x000000);
      return;
    }
    const url = BG_MAPS[environment];
    if (url) {
      textureLoaderRef.current.load(url, (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        if (sceneRef.current) {
          sceneRef.current.background = texture;
        }
      });
    }
  }, [environment]);

  useEffect(() => {
    if (!spot1Ref.current || !spot2Ref.current || !gridRef.current) return;
    const accentHex = getThemeAccentHex();
    spot1Ref.current.color.setHex(accentHex);
    gridRef.current.material.color.setHex(accentHex);
    gridRef.current.material.transparent = true;
    gridRef.current.material.opacity = 0.4;
  }, [theme]);

  useEffect(() => {
    if (!modelRef.current) return;
    modelRef.current.scale.set(size, size, size);
  }, [size]);

  return <div ref={containerRef} className="absolute inset-0 z-0 bg-black cursor-crosshair" />;
});

export default RobotCanvas;
