import React, { useRef, useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';

/**
 * Check WebGL capability safely in browser
 */
function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

interface WorkspaceSceneProps {
  workspace: number; // 1, 2, 3
  theme: string;
  isMobile: boolean;
  reducedMotion: boolean;
}

/**
 * Minimalist kinetic sculpture cluster tailored for VEGA OS.
 * Designed with restrained architectural elegance, subtle matte porcelain/slate shaders,
 * and positioned in the mid-right quadrant well below the topbar and search trigger.
 */
function MinimalistSculpturalCluster({
  position,
  theme,
  clusterIndex,
}: {
  position: [number, number, number];
  theme: string;
  clusterIndex: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const isDark = theme === 'dark';

  // Refined palette matching VEGA OS natural aesthetic (travertine, porcelain, sage, slate)
  const materialProps = useMemo(() => {
    if (isDark) {
      return {
        mainColor: '#3d4b42',
        secondaryColor: '#28332c',
        accentColor: '#5c7363',
        ringColor: '#6e8a76',
        roughness: 0.6,
        metalness: 0.08,
      };
    }
    return {
      mainColor: '#dadfd4',
      secondaryColor: '#edebe4',
      accentColor: '#c2ccc0',
      ringColor: '#8a9b88',
      roughness: 0.5,
      metalness: 0.04,
    };
  }, [isDark]);

  useFrame(state => {
    const t = state.clock.getElapsedTime();
    if (groupRef.current) {
      // Extremely subtle, restrained floating breathing
      groupRef.current.position.y = position[1] + Math.sin(t * 0.35 + clusterIndex * 1.5) * 0.035;
      groupRef.current.rotation.y = Math.sin(t * 0.18 + clusterIndex) * 0.06;
    }
    if (ringRef.current) {
      // Smooth, meditative orbital halo rotation
      ringRef.current.rotation.z = t * 0.12;
      ringRef.current.rotation.x = Math.sin(t * 0.15) * 0.15 + (clusterIndex === 2 ? Math.PI / 2 + 0.1 : 1.15);
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {clusterIndex === 0 && (
        <>
          {/* Workspace 1 (Main): "Zen Pebble & Orbital Halo" */}
          {/* Smooth, vertically elongated ceramic river pebble */}
          <mesh position={[0, 0, 0]} scale={[0.72, 1.15, 0.72]}>
            <sphereGeometry args={[0.75, 48, 48]} />
            <meshStandardMaterial
              color={materialProps.mainColor}
              roughness={materialProps.roughness}
              metalness={materialProps.metalness}
            />
          </mesh>

          {/* Delicate orbital halo ring */}
          <mesh ref={ringRef} position={[0, 0, 0]} rotation={[1.15, 0.35, 0.1]}>
            <torusGeometry args={[1.25, 0.032, 16, 64]} />
            <meshStandardMaterial
              color={materialProps.ringColor}
              roughness={0.4}
              metalness={0.15}
            />
          </mesh>

          {/* Satellite pearl bead */}
          <mesh position={[0.95, 0.45, 0.25]}>
            <sphereGeometry args={[0.13, 24, 24]} />
            <meshStandardMaterial
              color={materialProps.secondaryColor}
              roughness={0.5}
              metalness={0.1}
            />
          </mesh>
        </>
      )}

      {clusterIndex === 1 && (
        <>
          {/* Workspace 2 (Dev): "Geometric Monolith & Architectural Plinth" */}
          {/* Clean faceted icosahedron core */}
          <mesh position={[0, 0.05, 0]} rotation={[0.4, 0.2, 0.1]} scale={[0.85, 0.95, 0.85]}>
            <icosahedronGeometry args={[0.82, 0]} />
            <meshStandardMaterial
              color={materialProps.mainColor}
              roughness={materialProps.roughness}
              metalness={0.12}
            />
          </mesh>

          {/* Delicate tilted geometric orbit ring */}
          <mesh ref={ringRef} position={[0, 0, 0]} rotation={[0.6, 0.8, -0.3]}>
            <torusGeometry args={[1.28, 0.026, 16, 48]} />
            <meshStandardMaterial
              color={materialProps.ringColor}
              roughness={0.3}
              metalness={0.2}
            />
          </mesh>

          {/* Floating minimalist stone disc plinth */}
          <mesh position={[0, -0.65, 0]} rotation={[0.15, 0, 0]}>
            <cylinderGeometry args={[0.65, 0.65, 0.06, 32]} />
            <meshStandardMaterial
              color={materialProps.secondaryColor}
              roughness={0.7}
              metalness={0.05}
            />
          </mesh>
        </>
      )}

      {clusterIndex === 2 && (
        <>
          {/* Workspace 3 (Focus): "Equilibrium Stone & Water Ripple" */}
          {/* Ultra-smooth flattened zen stone */}
          <mesh position={[0, -0.05, 0]} scale={[1.1, 0.52, 0.9]}>
            <sphereGeometry args={[0.85, 48, 48]} />
            <meshStandardMaterial
              color={materialProps.secondaryColor}
              roughness={materialProps.roughness}
              metalness={materialProps.metalness}
            />
          </mesh>

          {/* Whisper-thin horizontal ripple halo */}
          <mesh ref={ringRef} position={[0, -0.05, 0]} rotation={[Math.PI / 2 + 0.12, 0.05, 0]}>
            <torusGeometry args={[1.35, 0.028, 16, 64]} />
            <meshStandardMaterial
              color={materialProps.ringColor}
              roughness={0.4}
              metalness={0.12}
            />
          </mesh>

          {/* Poised minimalist droplet */}
          <mesh position={[0, 0.62, 0]} scale={[0.8, 1.1, 0.8]}>
            <sphereGeometry args={[0.18, 32, 32]} />
            <meshStandardMaterial
              color={materialProps.mainColor}
              roughness={0.5}
              metalness={0.1}
            />
          </mesh>
        </>
      )}
    </group>
  );
}

/**
 * Camera controller for spatial workspace navigation and mouse parallax
 */
function SpatialCameraController({
  workspace,
  reducedMotion,
  isMobile,
}: {
  workspace: number;
  reducedMotion: boolean;
  isMobile: boolean;
}) {
  const { camera } = useThree();
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (reducedMotion) return;

    const handlePointerMove = (e: MouseEvent) => {
      // Normalized coordinates [-1, 1]
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [reducedMotion]);

  useFrame((_, delta) => {
    // Target camera X based on active workspace (Space 1 = 0, Space 2 = 3.6, Space 3 = 7.2)
    const targetWorkspaceX = (workspace - 1) * 3.6;

    // Gentle parallax shift (very restrained)
    const parallaxIntensity = isMobile ? 0.06 : 0.16;
    const targetParallaxX = reducedMotion ? 0 : mouseRef.current.x * parallaxIntensity;
    const targetParallaxY = reducedMotion ? 0 : mouseRef.current.y * (parallaxIntensity * 0.6);

    // Smooth lerp damping for camera position
    const lerpSpeed = Math.min(delta * 4.5, 0.2);
    camera.position.x = THREE.MathUtils.lerp(
      camera.position.x,
      targetWorkspaceX + targetParallaxX,
      lerpSpeed
    );
    camera.position.y = THREE.MathUtils.lerp(
      camera.position.y,
      targetParallaxY,
      lerpSpeed
    );
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, 5.2, lerpSpeed);

    // Focus camera slightly below center to leave upper topbar clean and clear
    camera.lookAt(targetWorkspaceX, -0.15, 0);
  });

  return null;
}

/**
 * 3D Scene content
 */
function WorkspaceSceneContent({
  workspace,
  theme,
  isMobile,
  reducedMotion,
}: WorkspaceSceneProps) {
  const isDark = theme === 'dark';
  // Offset clusters into the mid-right quadrant to guarantee zero overlap with topbar/search
  const offsetX = isMobile ? 0.2 : 1.25;
  const offsetY = isMobile ? -0.3 : -0.42;

  return (
    <>
      {/* Lighting tuned for minimal matte ceramic elegance */}
      <ambientLight intensity={isDark ? 0.85 : 1.25} />
      <directionalLight
        position={[6, 8, 5]}
        intensity={isDark ? 1.0 : 1.5}
        color={isDark ? '#e0ebe3' : '#ffffff'}
      />
      <directionalLight
        position={[-6, -4, -3]}
        intensity={isDark ? 0.35 : 0.55}
        color={isDark ? '#3d5245' : '#d2ddd1'}
      />

      {/* Spatial Clusters corresponding to Workspaces 1, 2, 3 positioned cleanly */}
      <MinimalistSculpturalCluster position={[offsetX, offsetY, -0.6]} theme={theme} clusterIndex={0} />
      <MinimalistSculpturalCluster position={[3.6 + offsetX, offsetY, -0.6]} theme={theme} clusterIndex={1} />
      <MinimalistSculpturalCluster position={[7.2 + offsetX, offsetY, -0.6]} theme={theme} clusterIndex={2} />

      <SpatialCameraController
        workspace={workspace}
        reducedMotion={reducedMotion}
        isMobile={isMobile}
      />
    </>
  );
}

export interface Workspace3DProps {
  workspace: number; // 1, 2, 3
  theme: string;
  enabled: boolean;
  reducedMotion: boolean;
  onToggleEnabled?: () => void;
}

export default function Workspace3D({
  workspace,
  theme,
  enabled,
  reducedMotion,
}: Workspace3DProps) {
  const [webGLSupported, setWebGLSupported] = useState<boolean>(true);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [canvasVisible, setCanvasVisible] = useState<boolean>(true);

  useEffect(() => {
    setWebGLSupported(isWebGLAvailable());
    const checkMobile = () => {
      setIsMobile(
        window.innerWidth <= 768 ||
          ('ontouchstart' in window && window.innerWidth <= 1024)
      );
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const handleVisibility = () => {
      setCanvasVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('resize', checkMobile);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Determine whether to render 3D canvas or fall back to 2D
  const shouldRender3D =
    enabled &&
    webGLSupported &&
    !reducedMotion &&
    canvasVisible;

  if (!shouldRender3D) {
    return null;
  }

  return (
    <div
      className="workspace-3d-container absolute inset-0 pointer-events-none overflow-hidden select-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      <Canvas
        camera={{ position: [0, 0, 5.2], fov: 42 }}
        dpr={isMobile ? [1, 1.25] : [1, 1.75]}
        gl={{
          antialias: !isMobile,
          powerPreference: 'high-performance',
          alpha: true,
        }}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
        }}
      >
        <WorkspaceSceneContent
          workspace={workspace}
          theme={theme}
          isMobile={isMobile}
          reducedMotion={reducedMotion}
        />
      </Canvas>
    </div>
  );
}
