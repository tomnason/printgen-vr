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
  IBLTexture,
} from "@iwsdk/core";
import { PanelDocument, UIKitDocument } from "@iwsdk/core";

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


const VITE_API_ENDPOINT = (import.meta as any).env?.VITE_API_ENDPOINT ?? '';
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
  console.log(message);
}

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
  
  const levelRoot = world.activeLevel.value;

  levelRoot.addComponent(IBLTexture, {
    src: 'room', // Built-in room environment
    intensity: 0.8, // Slightly brighter than default
  });

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

  const userInputPanel = world
    .createTransformEntity()
    .addComponent(PanelUI, {
      config: "/ui/userinput.json",
      maxHeight: 0.8,
      maxWidth: 1.6,
    })
    .addComponent(Interactable)
    .addComponent(ScreenSpace, {
      top: "20px",
      left: "400px",
      height: "40%",
    });
  userInputPanel.object3D!.position.set(0, 3, -1.9);

  // Wire up the Generate button using the PanelDocument (UIKit) so element
  // lookups work even if PanelUI renders into an internal document.
  try {
    const doc = PanelDocument.data.document[userInputPanel.index] as UIKitDocument | undefined;
    if (!doc) {
      // If the document isn't ready yet, subscribe to qualify events in PanelSystem
      // or poll for a short time. We'll poll briefly here.
      let attempts = 0;
      const poll = setInterval(() => {
        const d = PanelDocument.data.document[userInputPanel.index] as UIKitDocument | undefined;
        attempts += 1;
        if (d) {
          clearInterval(poll);
          wirePanelDocument(d);
        } else if (attempts > 10) {
          clearInterval(poll);
          vrLog('Panel document for user input not available');
        }
      }, 200);
    } else {
      wirePanelDocument(doc);
    }
  } catch (e: any) {
    vrLog(`Error initializing panel wiring: ${e?.message ?? String(e)}`);
  }

  function wirePanelDocument(document: UIKitDocument) {
    try {
      // UIKit elements expose a getElementById API similar to DOM
      const promptEl = document.getElementById('prompt') as any;
      const generateEl = document.getElementById('generate') as any;
      const statusEl = document.getElementById('status') as any;

      if (!generateEl) {
        vrLog('Generate element not found in panel document');
        return;
      }

      generateEl.addEventListener('click', async () => {
        // For input elements in UIKit, value may be exposed as .value or via getProperties().
        // Debug the available shape so we can adapt if necessary.
        try {
          vrLog(`promptEl shape: keys=${Object.keys(promptEl || {}).join(',')}`);
        } catch (_) {}

        // Simplified prompt extraction: prefer inputProperties.value (UIKit),
        // then fall back to the element's value property.
        let prompt = '';
        try {
          if (promptEl) {
            // prefer the structured inputProperties value if available
            prompt = (promptEl.inputProperties && typeof promptEl.inputProperties.value === 'string')
              ? promptEl.inputProperties.value
              : (typeof promptEl.value === 'string' ? promptEl.value : '');

            if (prompt) vrLog(`prompt read from ${promptEl.inputProperties && promptEl.inputProperties.value ? 'promptEl.inputProperties.value' : 'promptEl.value'}`);
          }
        } catch (err: any) {
          vrLog(`Error reading prompt element: ${err?.message ?? String(err)}`);
        }

        if (!prompt) {
          if (statusEl && statusEl.setProperties) statusEl.setProperties({ text: 'Please enter a prompt.' });
          if (statusEl && !statusEl.setProperties) statusEl.textContent = 'Please enter a prompt.';
          vrLog('Generate: empty prompt');
          return;
        }

        if (statusEl && statusEl.setProperties) statusEl.setProperties({ text: 'Sending request...' });
        if (statusEl && !statusEl.setProperties) statusEl.textContent = 'Sending request...';
        vrLog(`Generate: sending prompt: ${prompt}`);
        console.log(`VITE_API_ENDPOINT: ${VITE_API_ENDPOINT}`);
        try {
          const apiUrl = VITE_API_ENDPOINT ? `${VITE_API_ENDPOINT.replace(/\/$/, '')}/generate` : '/generate';
          const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, quality: 'fast' }),
          });

          if (!res.ok) {
            const text = await res.text();
            const msg = `Generate failed: ${res.status} ${res.statusText} - ${text}`;
            if (statusEl && statusEl.setProperties) statusEl.setProperties({ text: msg });
            if (statusEl && !statusEl.setProperties) statusEl.textContent = msg;
            vrLog(msg);
            return;
          }

          let bodyText = '';
          try {
            const data = await res.json();
            bodyText = JSON.stringify(data);

            // If the backend returned a glb_url, automatically load it into the world
            if (data && data.glb_url) {
              const glbUrl = data.glb_url as string;
              const loadingMsg = `Generate success, loading GLB: ${glbUrl}`;
              if (statusEl && statusEl.setProperties) statusEl.setProperties({ text: loadingMsg });
              if (statusEl && !statusEl.setProperties) statusEl.textContent = loadingMsg;
              vrLog(loadingMsg);
              try {
                await loadModelUrl(glbUrl);
                const loadedMsg = `Model loaded: ${glbUrl}`;
                if (statusEl && statusEl.setProperties) statusEl.setProperties({ text: loadedMsg });
                if (statusEl && !statusEl.setProperties) statusEl.textContent = loadedMsg;
                vrLog(loadedMsg);
              } catch (loadErr: any) {
                const errMsg = `Failed to load GLB: ${loadErr?.message ?? String(loadErr)}`;
                if (statusEl && statusEl.setProperties) statusEl.setProperties({ text: errMsg });
                if (statusEl && !statusEl.setProperties) statusEl.textContent = errMsg;
                vrLog(errMsg);
              }
            }
          } catch (e) {
            bodyText = await res.text();
          }

          const successMsg = `Generate success: ${bodyText}`;
          if (statusEl && statusEl.setProperties) statusEl.setProperties({ text: successMsg });
          if (statusEl && !statusEl.setProperties) statusEl.textContent = successMsg;
          vrLog(successMsg);
        } catch (err: any) {
          const msg = `Generate error: ${err?.message ?? String(err)}`;
          if (statusEl && statusEl.setProperties) statusEl.setProperties({ text: msg });
          if (statusEl && !statusEl.setProperties) statusEl.textContent = msg;
          vrLog(msg);
        }
      });
    } catch (e: any) {
      vrLog(`Error wiring panel document: ${e?.message ?? String(e)}`);
    }
  }

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
