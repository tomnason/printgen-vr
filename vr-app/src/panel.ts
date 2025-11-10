import {
  createSystem,
  PanelUI,
  PanelDocument,
  eq,
  VisibilityState,
  UIKitDocument,
  UIKit,
} from "@iwsdk/core";
import { vrLog } from './vrlog';

export class PanelSystem extends createSystem({
  welcomePanel: {
    required: [PanelUI, PanelDocument],
    where: [eq(PanelUI, "config", "/ui/welcome.json")],
  },
  userInputPanel: {
    required: [PanelUI, PanelDocument],
    where: [eq(PanelUI, "config", "/ui/userinput.json")],
  },
}) {
  init() {
    this.queries.welcomePanel.subscribe("qualify", (entity) => {
      const document = PanelDocument.data.document[
        entity.index
      ] as UIKitDocument;
      if (!document) return;

      const xrButton = document.getElementById("xr-button") as UIKit.Text;
      xrButton.addEventListener("click", () => {
        if (this.world.visibilityState.value === VisibilityState.NonImmersive) {
          this.world.launchXR();
        } else {
          this.world.exitXR();
        }
      });
      this.world.visibilityState.subscribe((visibilityState) => {
        if (visibilityState === VisibilityState.NonImmersive) {
          xrButton.setProperties({ text: "Enter XR" });
        } else {
          xrButton.setProperties({ text: "Exit to Browser" });
        }
      });
    });

    // Initialize the user input panel when it appears so other code can
    // reliably find elements like 'prompt', 'generate', and 'status'.
    this.queries.userInputPanel.subscribe("qualify", (entity) => {
      const document = PanelDocument.data.document[entity.index] as UIKitDocument;
      if (!document) return;
      
      const promptEl = document.getElementById('prompt') as any;
      const generateEl = document.getElementById('generate') as any;
      const statusEl = document.getElementById('status') as any;
      const recordEl = document.getElementById('record') as any;

      if (recordEl && !recordEl.__hasInitClick_record) {
        const handleClick = () => {
          vrLog('Record button clicked — checking SpeechRecognition support');
          const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
          if (!SpeechRecognition) {
            vrLog('SpeechRecognition API not supported in this browser');
            if (statusEl && statusEl.setProperties) statusEl.setProperties({ text: 'Speech recognition not supported.' });
            return;
          }

          const recognition = new SpeechRecognition();
          recognition.lang = 'en-US';
          recognition.interimResults = false;
          recognition.maxAlternatives = 1;

          vrLog('Starting speech recognition');
          if (recordEl && recordEl.setProperties) recordEl.setProperties({ text: 'Recording...' });
          recognition.start();

          // Safety timeout in case onend/onresult don't fire
          const stopTimeout = setTimeout(() => {
            vrLog('Recording timeout reached — stopping recognition');
            try { recognition.stop(); } catch (_) {}
          }, 5000);

          recognition.onresult = (event: any) => {
            const speechResult = event.results[0][0].transcript;
            vrLog(`Speech recognition result: ${speechResult}`);
            if (promptEl && promptEl.setProperties) {
              promptEl.setProperties({ value: speechResult });
            }
          };

          recognition.onspeechend = () => {
            vrLog('Speech ended — stopping recognition');
            try { recognition.stop(); } catch (_) {}
          };

          recognition.onend = () => {
            clearTimeout(stopTimeout);
            vrLog('Recognition ended');
            if (recordEl && recordEl.setProperties) recordEl.setProperties({ text: 'Record voice' });
          };

          recognition.onerror = (event: any) => {
            vrLog(`Recognition error: ${event?.error ?? String(event)}`);
            if (statusEl && statusEl.setProperties) statusEl.setProperties({ text: 'Error during recording: ' + event.error });
            if (recordEl && recordEl.setProperties) recordEl.setProperties({ text: 'Record voice' });
          };
        };

        try {
          recordEl.addEventListener?.('click', handleClick);
        } catch (_) {
          // ignore
        }
        recordEl.__hasInitClick_record = true;
      }


      // Wire up the generate button to call the API and dispatch a load-model event
      if (generateEl && !generateEl.__hasInitClick) {
        const handleClick = async () => {
          try {
            // Read prompt preferring inputProperties
            const prompt = (promptEl && promptEl.inputProperties && typeof promptEl.inputProperties.value === 'string')
              ? promptEl.inputProperties.value
              : (promptEl && typeof promptEl.value === 'string' ? promptEl.value : '');

            if (!prompt) {
              if (statusEl && statusEl.setProperties) statusEl.setProperties({ text: 'Please enter a prompt.' });
              if (statusEl && !statusEl.setProperties) statusEl.textContent = 'Please enter a prompt.';
              return;
            }

            // Show sending state
            if (generateEl && generateEl.setProperties) generateEl.setProperties({ enabled: false });
            if (statusEl && statusEl.setProperties) statusEl.setProperties({ text: 'Sending request...' });
            if (statusEl && !statusEl.setProperties) statusEl.textContent = 'Sending request...';

            // Determine API URL
            const VITE_API_ENDPOINT = ((import.meta as any).env)?.VITE_API_ENDPOINT ?? '';
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
              console.warn(msg);
              return;
            }

            const data = await res.json().catch(async () => await res.text());
            const bodyText = typeof data === 'string' ? data : JSON.stringify(data);

            // If glb_url returned, dispatch event for app to load it
            if (data && (data as any).glb_url) {
              const glbUrl = (data as any).glb_url as string;
              // Dispatch a global event that index.ts listens for to load the model
              window.dispatchEvent(new CustomEvent('load-model', { detail: { url: glbUrl } }));
              const successMsg = `Generate success, loading GLB`;
              if (statusEl && statusEl.setProperties) statusEl.setProperties({ text: successMsg });
              if (statusEl && !statusEl.setProperties) statusEl.textContent = successMsg;
              console.log(successMsg);
            } else {
              const successMsg = `Generate success: ${bodyText}`;
              if (statusEl && statusEl.setProperties) statusEl.setProperties({ text: successMsg });
              if (statusEl && !statusEl.setProperties) statusEl.textContent = successMsg;
              console.log(successMsg);
            }
          } catch (err: any) {
            const msg = `Generate error: ${err?.message ?? String(err)}`;
            if (statusEl && statusEl.setProperties) statusEl.setProperties({ text: msg });
            if (statusEl && !statusEl.setProperties) statusEl.textContent = msg;
            console.error(msg);
          } finally {
            if (generateEl && generateEl.setProperties) generateEl.setProperties({ enabled: true });
          }
        };

        try {
          generateEl.addEventListener?.('click', handleClick);
        } catch (_) {
          // ignore
        }
        generateEl.__hasInitClick = true;
      }

    });
  }
}
