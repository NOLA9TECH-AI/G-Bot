
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
  
  const joystickState = useRef({ active: false, startX: 0, startY: 0, moveX: 0, moveY: 0, angle: 0, distance: 0 });
  const [joystickUI, setJoystickUI] = useState({ x: 0, y: 0, show: false, stickX: 0, stickY: 0 });
  
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  const getNeonTexture = (text: string, color: string) => {
    const key = `${text}-${color}`;
    if (textureCache[key]) return textureCache[key];

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 80px Permanent Marker, Courier New';
    ctx.fillStyle = color;
    ctx.shadowBlur = 30;
    ctx.shadowColor = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    textureCache[key] = texture;
    return texture;
  };

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
    const accentStr = '#' + accent.toString(16).padStart(6, '0');

    if (env === EnvironmentType.NONE) {
      const ringGeo = new THREE.TorusGeometry(10, 0.1, 16, 100);
      const ringMat = new THREE.MeshBasicMaterial({ color: accent });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 12;
      group.add(ring);

      const studioLight = new THREE.PointLight(accent, 50, 30);
      studioLight.position.set(0, 10, 0);
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
          if (building.position.length() < 20) building.position.multiplyScalar(4);
          group.add(building);

          if (Math.random() > 0.4) {
            const texts = ["G-3", "2026", "CORE", "HUSTLE", "REBEL", "ROOT"];
            const signTex = getNeonTexture(texts[Math.floor(Math.random() * texts.length)], accentStr);
            const sign = new THREE.Mesh(
              new THREE.PlaneGeometry(6, 1.5),
              new THREE.MeshBasicMaterial({ map: signTex, transparent: true, side: THREE.DoubleSide })
            );
            sign.position.copy(building.position);
            sign.position.y += Math.random() * (h/2);
            sign.position.x += (w/2 + 0.1) * (Math.random() > 0.5 ? 1 : -1);
            sign.rotation.y = Math.PI / 2;
            group.add(sign);
            
            const pLight = new THREE.PointLight(accent, 20, 15);
            pLight.position.copy(sign.position);
            group.add(pLight);
          }
        }
        break;

      case EnvironmentType.NEO_TOKYO:
        for (let i = 0; i < 40; i++) {
          const size = 4 + Math.random() * 8;
          const billboard = new THREE.Mesh(
            new THREE.PlaneGeometry(size * 1.5, size),
            new THREE.MeshBasicMaterial({
              color: i % 2 === 0 ? 0xff00ff : 0x00ffff,
              transparent: true,
              opacity: 0.25,
              side: THREE.DoubleSide
            })
          );
          billboard.position.set((Math.random() - 0.5) * 150, 15 + Math.random() * 30, (Math.random() - 0.5) * 150);
          billboard.rotation.y = Math.random() * Math.PI;
          group.add(billboard);

          const glow = new THREE.PointLight(billboard.material.color, 25, 40);
          glow.position.copy(billboard.position);
          group.add(glow);
        }
        break;

      case EnvironmentType.DATA_CORE:
        for (let i = 0; i < 250; i++) {
          const h = 5 + Math.random() * 35;
          const stream = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, h, 0.12),
            new THREE.MeshStandardMaterial({
              color: 0x00ff00,
              emissive: 0x00ff00,
              emissiveIntensity: 5,
              transparent: true,
              opacity: 0.8
            })
          );
          stream.position.set((Math.random() - 0.5) * 80, h / 2, (Math.random() - 0.5) * 80);
          group.add(stream);
        }
        break;

      case EnvironmentType.SYNTH_HORIZON:
        const sun = new THREE.Mesh(
          new THREE.CircleGeometry(50, 64),
          new THREE.MeshBasicMaterial({ color: 0xff0055, side: THREE.DoubleSide })
        );
        sun.position.set(0, 15, -120);
        group.add(sun);
        
        for(let i = 0; i < 20; i++) {
            const line = new THREE.Mesh(
                new THREE.PlaneGeometry(300, 1.5),
                new THREE.MeshBasicMaterial({ color: 0x000000 })
            );
            line.position.set(0, -30 + i * 10, -119);
            group.add(line);
        }
        const horizonGlow = new THREE.PointLight(0xff0055, 150, 250);
        horizonGlow.position.set(0, 30, -60);
        group.add(horizonGlow);
        break;

      case EnvironmentType.MECHA_HANGAR:
        for (let i = 0; i < 15; i++) {
          const tower = new THREE.Mesh(
            new THREE.BoxGeometry(6, 60, 6),
            new THREE.MeshStandardMaterial({ color: 0x080808, metalness: 1.0, roughness: 0.1 })
          );
          tower.position.set((Math.random() - 0.5) * 100, 30, (Math.random() - 0.5) * 100);
          group.add(tower);
          
          const alarm = new THREE.PointLight(0xff3300, 15, 30);
          alarm.position.set(tower.position.x, 5 + Math.random() * 25, tower.position.z);
          group.add(alarm);
          
          const alarmLens = new THREE.Mesh(new THREE.SphereGeometry(0.4), new THREE.MeshBasicMaterial({ color: 0xff3300 }));
          alarmLens.position.copy(alarm.position);
          group.add(alarmLens);
        }
        break;
    }
  };

  const getEnvConfig = (env: EnvironmentType) => {
    switch (env) {
      case EnvironmentType.NEURAL_VOID: return { bg: 0x040008, fog: 0x040008, fogNear: 2, fogFar: 45 };
      case EnvironmentType.CYBER_DISTRICT: return { bg: 0x010102, fog: 0x020208, fogNear: 10, fogFar: 80 };
      case EnvironmentType.DATA_CORE: return { bg: 0x000300, fog: 0x000600, fogNear: 5, fogFar: 40 };
      case EnvironmentType.SYNTH_HORIZON: return { bg: 0x0c000c, fog: 0x150015, fogNear: 30, fogFar: 200 };
      case EnvironmentType.MECHA_HANGAR: return { bg: 0x030303, fog: 0x0a0a0a, fogNear: 15, fogFar: 90 };
      case EnvironmentType.NEO_TOKYO: return { bg: 0x010001, fog: 0x050005, fogNear: 5, fogFar: 75 };
      default: return { bg: 0x020202, fog: 0x020202, fogNear: 5, fogFar: 50 };
    }
  };

  const updateCanvasColors = () => {
    if (!sceneRef.current || !groundRef.current) return;
    const config = getEnvConfig(environment);
    sceneRef.current.background = new THREE.Color(config.bg);
    sceneRef.current.fog = new THREE.Fog(config.fog, config.fogNear, config.fogFar);
    
    if (groundRef.current.material instanceof THREE.MeshStandardMaterial) {
      groundRef.current.material.color.setHex(config.bg);
      groundRef.current.material.roughness = environment === EnvironmentType.NONE ? 0.1 : 0.015;
      groundRef.current.material.metalness = environment === EnvironmentType.NONE ? 0.5 : 0.98;
    }
    createCyberpunkScene(environment);
  };

  const applyRobotSkins = () => {
    if (!modelRef.current) return;
    const accentColor = new THREE.Color(getThemeAccentHex());
    const bodyColor = new THREE.Color(color);
    modelRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const isEmissivePart = child.name.toLowerCase().includes('eye') || child.name.toLowerCase().includes('mouth');
        mesh.material = new THREE.MeshPhysicalMaterial({
          color: isEmissivePart ? accentColor : bodyColor,
          metalness: isEmissivePart ? 0 : 1.0,
          roughness: isEmissivePart ? 0.0 : 0.08,
          emissive: isEmissivePart ? accentColor : new THREE.Color(0x000000),
          emissiveIntensity: isEmissivePart ? 8.0 : 0.0,
          envMap: envMapRef.current,
          reflectivity: 1.0,
          clearcoat: 1.0,
          clearcoatRoughness: 0.0
        });
      }
    });
    if (robotLightRef.current) robotLightRef.current.color.set(accentColor);
  };

  const playAnimation = (name: string) => {
    let actual = name;
    if (name === RobotAnimation.CELEBRATE) actual = RobotAnimation.THUMBSUP;
    if (name === RobotAnimation.PONDER) actual = RobotAnimation.SITTING;
    if (name === RobotAnimation.ALERT) actual = RobotAnimation.JUMP;
    if (name === RobotAnimation.GREET) actual = RobotAnimation.WAVE;

    const action = actionsRef.current[actual];
    if (action && activeActionRef.current !== action) {
      if (activeActionRef.current) activeActionRef.current.fadeOut(0.2);
      action.reset().fadeIn(0.2).play();
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

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 7, 18);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", alpha: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    containerRef.current.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    envMapRef.current = pmrem.fromScene(new RoomEnvironment()).texture;
    scene.environment = envMapRef.current;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxDistance = 30;
    controls.minDistance = 5;
    controls.maxPolarAngle = Math.PI / 1.75;
    controlsRef.current = controls;

    // Increased ambient lighting for black robots
    scene.add(new THREE.HemisphereLight(0xffffff, 0x000000, 0.5));

    const pLight = new THREE.PointLight(0x39ff14, 25, 20);
    scene.add(pLight);
    robotLightRef.current = pLight;

    const groundGeo = new THREE.PlaneGeometry(3000, 3000);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.015, metalness: 0.98 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
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
      const elapsed = clock.getElapsedTime();
      if (mixerRef.current) mixerRef.current.update(dt);

      environmentGroupRef.current.children.forEach((child, i) => {
        if (environment === EnvironmentType.NEURAL_VOID) {
          child.rotation.x += 0.02;
          child.rotation.y += 0.03;
        } else if (environment === EnvironmentType.DATA_CORE) {
          child.position.y -= 0.2;
          if (child.position.y < -5) child.position.y = 30;
        } else if (environment === EnvironmentType.NEO_TOKYO) {
           if ((child as any).material) {
             (child as any).material.opacity = 0.2 + Math.sin(elapsed * 4 + i) * 0.15;
           }
        }
      });

      if (modelRef.current && cameraRef.current) {
        robotLightRef.current?.position.set(
          modelRef.current.position.x,
          modelRef.current.position.y + 2,
          modelRef.current.position.z
        );

        if (joystickState.current.active && joystickState.current.distance > 5) {
          const moveSpeed = (joystickState.current.distance / 50) * 0.22;
          const cameraDir = new THREE.Vector3();
          cameraRef.current.getWorldDirection(cameraDir);
          cameraDir.y = 0;
          cameraDir.normalize();
          const cameraRight = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), cameraDir).normalize();
          const moveDir = new THREE.Vector3()
            .addScaledVector(cameraRight, -joystickState.current.moveX / 50)
            .addScaledVector(cameraDir, -joystickState.current.moveY / 50)
            .normalize();

          modelRef.current.position.add(moveDir.multiplyScalar(moveSpeed));
          const targetAngle = Math.atan2(moveDir.x, moveDir.z);
          modelRef.current.rotation.y = THREE.MathUtils.lerp(modelRef.current.rotation.y, targetAngle, 0.2);
          
          if (moveSpeed > 0.12) playAnimation(RobotAnimation.RUNNING);
          else playAnimation(RobotAnimation.WALKING);
        } else if (activeActionRef.current?.getClip().name === RobotAnimation.WALKING || activeActionRef.current?.getClip().name === RobotAnimation.RUNNING) {
          playAnimation(RobotAnimation.IDLE);
        }
        controls.target.lerp(modelRef.current.position.clone().add(new THREE.Vector3(0, 1.8, 0)), 0.12);
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onStart = (e: TouchEvent | PointerEvent) => {
      const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as PointerEvent).clientX;
      const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as PointerEvent).clientY;
      if (clientX < window.innerWidth / 2) {
        joystickState.current = { active: true, startX: clientX, startY: clientY, moveX: 0, moveY: 0, angle: 0, distance: 0 };
        setJoystickUI({ x: clientX, y: clientY, show: true, stickX: 0, stickY: 0 });
        controls.enabled = false;
      } else {
        mouseRef.current.x = (clientX / window.innerWidth) * 2 - 1;
        mouseRef.current.y = -(clientY / window.innerHeight) * 2 + 1;
        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        if (modelRef.current && raycasterRef.current.intersectObject(modelRef.current, true).length > 0) {
           playAnimation(RobotAnimation.GREET);
        }
      }
    };

    const onMove = (e: TouchEvent | PointerEvent) => {
      if (!joystickState.current.active) return;
      const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as PointerEvent).clientX;
      const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as PointerEvent).clientY;
      const dx = clientX - joystickState.current.startX;
      const dy = clientY - joystickState.current.startY;
      const dist = Math.min(Math.sqrt(dx*dx + dy*dy), 50);
      const angle = Math.atan2(dy, dx);
      joystickState.current.moveX = Math.cos(angle) * dist;
      joystickState.current.moveY = Math.sin(angle) * dist;
      joystickState.current.distance = dist;
      setJoystickUI(prev => ({ ...prev, stickX: joystickState.current.moveX, stickY: joystickState.current.moveY }));
    };

    const onEnd = () => {
      joystickState.current.active = false;
      setJoystickUI(prev => ({ ...prev, show: false }));
      controls.enabled = true;
    };

    window.addEventListener('touchstart', onStart, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('pointerdown', onStart);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    return () => {
      renderer.dispose();
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, []);

  useEffect(() => { updateCanvasColors(); }, [environment, theme]);
  useEffect(() => { applyRobotSkins(); }, [style, color, theme]);
  useEffect(() => { if (modelRef.current) modelRef.current.scale.set(size, size, size); }, [size]);

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 bg-black overflow-hidden">
      {joystickUI.show && (
        <div 
          className="fixed pointer-events-none z-[100] flex items-center justify-center rounded-full border-2 bg-white/5 backdrop-blur-2xl shadow-2xl transition-opacity duration-200"
          style={{ left: joystickUI.x - 60, top: joystickUI.y - 60, width: 120, height: 120, borderColor: getThemeAccentHex() + '66' }}
        >
          <div 
            className="absolute rounded-full shadow-lg"
            style={{ width: 50, height: 50, backgroundColor: getThemeAccentHex(), transform: `translate(${joystickUI.stickX}px, ${joystickUI.stickY}px)`, boxShadow: `0 0 40px ${getThemeAccentHex()}` }}
          />
        </div>
      )}
    </div>
  );
});

export default RobotCanvas;
