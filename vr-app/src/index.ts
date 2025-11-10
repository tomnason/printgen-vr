import {
  AssetManifest,
  AssetType,
  // Mesh,
  // MeshBasicMaterial,
  // PlaneGeometry,
  SessionMode,
  // SRGBColorSpace,
  AssetManager,
  World,
  IBLTexture,
} from "@iwsdk/core";
// import { PanelDocument, UIKitDocument } from "@iwsdk/core";

import {
  AudioSource,
  DistanceGrabbable,
  MovementMode,
  Interactable,
  PanelUI,
  PlaybackMode,
  ScreenSpace,
} from "@iwsdk/core";

// import { EnvironmentType, LocomotionEnvironment } from "@iwsdk/core";

import { PanelSystem } from "./panel.js";

import { Robot } from "./robot.js";

// import { RobotSystem } from "./robot.js";

import { vrLog } from './vrlog';

vrLog('VR App starting up...');
vrLog('v0.1.3');
vrLog('The first model generated may take a few minutes while the cloud GPU model service warms up');


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

  // plantSansevieria: {
  //   url: "/gltf/plantSansevieria/plantSansevieria.gltf",
  //   type: AssetType.GLTF,
  //   priority: "critical",
  // },
  // robot: {
  //   url: "/gltf/robot/robot.gltf",
  //   type: AssetType.GLTF,
  //   priority: "critical",
  // },
  // duck: {
  //   url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF/Duck.gltf",
  //   type: AssetType.GLTF,
  //   priority: "background",
  // },
};




let appWorld: any = null;

// Listen for model load events dispatched by UI panels (PanelSystem)
window.addEventListener('load-model', async (e: any) => {
  const url = e?.detail?.url as string | undefined;
  if (!url) return;
  try {
    vrLog(`Loading model from panel event: ${url}`);
    await loadModelUrl(url);
    vrLog(`Model loaded: ${url}`);
  } catch (err: any) {
    vrLog(`Failed to load model from panel event: ${err?.message ?? String(err)}`);
  }
});

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
  input.value = 'https://storage.googleapis.com/printgen-vr-models/models/86349d32-7abe-4312-9ddf-2e0e9698c07b.glb'

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
            mesh.scale.setScalar(1);
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

// createLoadUi();

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

  // const { scene: plantMesh } = AssetManager.getGLTF("plantSansevieria")!;

  // plantMesh.position.set(1.2, 0.2, -1.8);
  // plantMesh.scale.setScalar(2);

  // world
  //   .createTransformEntity(plantMesh)
  //   .addComponent(Interactable)
  //   .addComponent(DistanceGrabbable, {
  //     movementMode: MovementMode.MoveFromTarget,
  //   });

  // const { scene: robotMesh } = AssetManager.getGLTF("robot")!;
  // // defaults for AR
  // robotMesh.position.set(-1.2, 0.4, -1.8);
  // robotMesh.scale.setScalar(1);
  
  const levelRoot = world.activeLevel.value;

  levelRoot.addComponent(IBLTexture, {
    src: 'room', // Built-in room environment
    intensity: 0.8, // Slightly brighter than default
  });

  // world
  //   .createTransformEntity(robotMesh)
  //   .addComponent(Interactable)
  //   .addComponent(Robot)
  //   .addComponent(AudioSource, {
  //     src: "/audio/chime.mp3",
  //     maxInstances: 3,
  //     playbackMode: PlaybackMode.FadeRestart,
  //   });

  const panelEntity = world
    .createTransformEntity()
    .addComponent(PanelUI, {
      config: "/ui/welcome.json",
      maxHeight: 0.8,
      maxWidth: 1.6,
    })
    .addComponent(Interactable)
    .addComponent(ScreenSpace, {
      top: "10vh",
      left: "10vw",
      height: "40vh",
      width: "30vw"
    });
  panelEntity.object3D!.position.set(-0.8, 1.29, -1.9);

  const userInputPanel = world
    .createTransformEntity()
    .addComponent(PanelUI, {
      config: "/ui/userinput.json",
      maxHeight: 0.8,
      maxWidth: 1.6,
    })
    .addComponent(Interactable)
    .addComponent(ScreenSpace, {
      top: "10vh",
      left: "60vw",
      height: "40vh",
      width: "30vw"
    });
  userInputPanel.object3D!.position.set(0.8, 1.29, -1.9);

  // Panel wiring (prompt/generate/status) is handled by `PanelSystem` in
  // `vr-app/src/panel.ts` via the `userInputPanel.subscribe('qualify', ...)`
  // handler. No local polling is required here.

  // const webxrLogoTexture = AssetManager.getTexture("webxr")!;
  // webxrLogoTexture.colorSpace = SRGBColorSpace;
  // const logoBanner = new Mesh(
  //   new PlaneGeometry(3.39, 0.96),
  //   new MeshBasicMaterial({
  //     map: webxrLogoTexture,
  //     transparent: true,
  //   }),
  // );
  // world.createTransformEntity(logoBanner);
  // logoBanner.position.set(0, 1, 1.8);
  // logoBanner.rotateY(Math.PI);

  world.registerSystem(PanelSystem);
  // world.registerSystem(RobotSystem);

});
