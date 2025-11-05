import {
  AssetManifest,
  AssetType,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SessionMode,
  SRGBColorSpace,
  AssetManager,
  World,
} from "@iwsdk/core";

import {
  AudioSource,
  DistanceGrabbable,
  MovementMode,
  Interactable,
  PanelUI,
  PlaybackMode,
  ScreenSpace,
} from "@iwsdk/core";

import { EnvironmentType, LocomotionEnvironment } from "@iwsdk/core";

import { PanelSystem } from "./panel.js";

import { Robot } from "./robot.js";

import { RobotSystem } from "./robot.js";




const assets: AssetManifest = {
  chimeSound: {
    url: "/audio/chime.mp3",
    type: AssetType.Audio,
    priority: "background",
  },
  webxr: {
    url: "/textures/webxr.png",
    type: AssetType.Texture,
    priority: "critical",
  },

  plantSansevieria: {
    url: "/gltf/plantSansevieria/plantSansevieria.gltf",
    type: AssetType.GLTF,
    priority: "critical",
  },
  robot: {
    url: "/gltf/robot/robot.gltf",
    type: AssetType.GLTF,
    priority: "critical",
  },
  duck: {
    url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF/Duck.gltf",
    type: AssetType.GLTF,
    priority: "background",
  },
};


// Utility function to log messages to VR overlay
export function vrLog(message: string) {
  const logDiv = document.getElementById('vrConsole');
  if (!logDiv) return;
  const entry = document.createElement('div');
  entry.textContent = message;
  logDiv.appendChild(entry);
  logDiv.scrollTop = logDiv.scrollHeight;
}

// Fetch a test API and log the result into the VR console
async function fetchAndLogApi() {
  try {
    // Example public API (JSON placeholder)
    const res = await fetch('https://jsonplaceholder.typicode.com/todos/1');
    if (!res.ok) {
      vrLog(`API error: ${res.status} ${res.statusText}`);
      return;
    }
    const data = await res.json();
    // Log a compact string representation
    vrLog(`API response: ${JSON.stringify(data)}`);
  } catch (err: any) {
    vrLog(`Fetch failed: ${err?.message ?? String(err)}`);
  }
}

// Run the fetch but don't block world creatio
await fetchAndLogApi();


let appWorld: any = null;

// Simple overlay UI for pasting a GLTF URL and loading it into the scene
function createLoadUi() {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.right = '12px';
  container.style.top = '12px';
  container.style.zIndex = '1000';
  container.style.background = 'rgba(0,0,0,0.6)';
  container.style.padding = '8px';
  container.style.borderRadius = '6px';
  container.style.color = 'white';
  container.style.fontFamily = 'sans-serif';
  container.style.maxWidth = '360px';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Paste GLTF URL here';
  input.style.width = '260px';
  input.style.marginRight = '6px';
  input.value = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/refs/heads/main/2.0/Fox/glTF/Fox.gltf'

  const btn = document.createElement('button');
  btn.textContent = 'Load';

  const status = document.createElement('div');
  status.style.fontSize = '12px';
  status.style.marginTop = '6px';

  btn.onclick = async () => {
    const url = input.value.trim();
    if (!url) {
      status.textContent = 'Enter a URL first';
      return;
    }
    status.textContent = 'Loading...';
    try {
      await loadModelUrl(url);
      status.textContent = 'Loaded';
    } catch (err: any) {
      status.textContent = `Error: ${err?.message ?? err}`;
    }
  };

  container.appendChild(input);
  container.appendChild(btn);
  container.appendChild(status);
  document.body.appendChild(container);
}

// Try to dynamically import GLTFLoader and load the model into the world
async function loadModelUrl(url: string) {
  if (!appWorld) throw new Error('World not ready yet');

  vrLog(`Loading model: ${url}`);

  try {
    // three/examples may not provide type declarations in this project; ignore TypeScript for this dynamic import
    // @ts-ignore
    const mod = await import('three/examples/jsm/loaders/GLTFLoader');
    const { GLTFLoader } = mod as any;
    const loader = new GLTFLoader();
    return new Promise<void>((resolve, reject) => {
      loader.load(
        url,
        (gltf: any) => {
          try {
            const mesh = gltf.scene;
            mesh.position.set(0, 0, -2);
            mesh.scale.setScalar(0.01);
            appWorld
              .createTransformEntity(mesh)
              .addComponent(Interactable)
              .addComponent(DistanceGrabbable, { movementMode: MovementMode.MoveFromTarget });
            vrLog('Model loaded via GLTFLoader');
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        undefined,
        (err: any) => {
          reject(err);
        },
      );
    });
  } catch (e: any) {
    // Dynamic import failed (likely examples not available). Provide a helpful message.
    vrLog('Failed to import GLTFLoader. Try installing the official three package or three-stdlib.');
    throw e;
  }
}

createLoadUi();

World.create(document.getElementById("scene-container") as HTMLDivElement, {
  assets,
  xr: {
    sessionMode: SessionMode.ImmersiveAR,
    offer: "always",
    // Optional structured features; layers/local-floor are offered by default
    features: {
      handTracking: true,
      anchors: true,
      hitTest: true,
      planeDetection: true,
      meshDetection: true,
      layers: true,
    },
  },
  features: {
    locomotion: false,
    grabbing: true,
    physics: false,
    sceneUnderstanding: true,
  },
}).then((world) => {
  // expose the world instance to the UI loader
  appWorld = world;
  const { camera } = world;

  camera.position.set(0, 1, 0.5);

  const { scene: plantMesh } = AssetManager.getGLTF("plantSansevieria")!;

  plantMesh.position.set(1.2, 0.2, -1.8);
  plantMesh.scale.setScalar(2);

  world
    .createTransformEntity(plantMesh)
    .addComponent(Interactable)
    .addComponent(DistanceGrabbable, {
      movementMode: MovementMode.MoveFromTarget,
    });

  const { scene: robotMesh } = AssetManager.getGLTF("robot")!;
  // defaults for AR
  robotMesh.position.set(-1.2, 0.4, -1.8);
  robotMesh.scale.setScalar(1);
  

  world
    .createTransformEntity(robotMesh)
    .addComponent(Interactable)
    .addComponent(Robot)
    .addComponent(AudioSource, {
      src: "/audio/chime.mp3",
      maxInstances: 3,
      playbackMode: PlaybackMode.FadeRestart,
    });

  const panelEntity = world
    .createTransformEntity()
    .addComponent(PanelUI, {
      config: "/ui/welcome.json",
      maxHeight: 0.8,
      maxWidth: 1.6,
    })
    .addComponent(Interactable)
    .addComponent(ScreenSpace, {
      top: "20px",
      left: "20px",
      height: "40%",
    });
  panelEntity.object3D!.position.set(0, 1.29, -1.9);

  const webxrLogoTexture = AssetManager.getTexture("webxr")!;
  webxrLogoTexture.colorSpace = SRGBColorSpace;
  const logoBanner = new Mesh(
    new PlaneGeometry(3.39, 0.96),
    new MeshBasicMaterial({
      map: webxrLogoTexture,
      transparent: true,
    }),
  );
  world.createTransformEntity(logoBanner);
  logoBanner.position.set(0, 1, 1.8);
  logoBanner.rotateY(Math.PI);

  world.registerSystem(PanelSystem).registerSystem(RobotSystem);

  // Create Duck model from manifest (loaded via AssetManager).
  // AssetManager may not have finished loading the duck yet, so poll for it
  // with a short timeout.
  async function waitForGLTF(key: string, timeoutMs = 5000, intervalMs = 200) {
    const start = performance.now();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const res = AssetManager.getGLTF(key);
      if (res) return res;
      if (performance.now() - start > timeoutMs) return null;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }


});
