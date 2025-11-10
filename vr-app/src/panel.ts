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
      // This welcome panel logic does not need to change.
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

    // This is the main logic block for the user input panel.
    this.queries.userInputPanel.subscribe("qualify", (entity) => {
      const document = PanelDocument.data.document[entity.index] as UIKitDocument;
      if (!document) return;
      
      const promptEl = document.getElementById('prompt') as any;
      const generateEl = document.getElementById('generate') as any;
      const statusEl = document.getElementById('status') as any;
      const recordEl = document.getElementById('record') as any;

      // --- Helpers ---
      let accessToken: string | null = null;
      let tokenExpiry = 0; // epoch ms

      const setStatus = (text: string) => {
        try {
          if (statusEl && statusEl.setProperties) statusEl.setProperties({ text });
          else if (statusEl) (statusEl as any).textContent = text;
        } catch (_) {}
      };

      const readPrompt = (): string => {
        return (promptEl?.inputProperties?.value ?? promptEl?.value ?? '') as string;
      };

      async function getAuthToken(): Promise<string> {
        // Return cached token if valid for at least 60s
        const now = Date.now();
        if (accessToken && now < tokenExpiry - 60000) return accessToken;

        const authApiUrl = ((import.meta as any).env)?.VITE_AUTH_API_URL ?? '';
        const response = await fetch(`${authApiUrl}/get-token`);
        if (!response.ok) throw new Error('Could not get auth token.');
        const data = await response.json();
        accessToken = data.access_token;
        // Assume expires_in is seconds from now; convert to ms epoch
        tokenExpiry = Date.now() + ((data.expires_in ?? 0) * 1000);
        return accessToken!;
      }

      if (recordEl && !recordEl.__hasInitClick_record) {
        let mediaRecorder: MediaRecorder | null = null;
        let audioChunks: Blob[] = [];

        const transcribeAudio = async (audioBlob: Blob) => {
          vrLog('Transcribing audio blob via Google Cloud Speech API...');
          setStatus('Transcribing...');
          try {
            const token = await getAuthToken();
            const base64Audio = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                try {
                  resolve((reader.result as string).split(',')[1]);
                } catch (e) { reject(e); }
              };
              reader.onerror = reject;
              reader.readAsDataURL(audioBlob);
            });

            const speechApiUrl = 'https://speech.googleapis.com/v1/speech:recognize';
            const response = await fetch(speechApiUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                config: { encoding: 'WEBM_OPUS', sampleRateHertz: 48000, languageCode: 'en-US' },
                audio: { content: base64Audio },
              }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data?.error?.message || 'Speech API request failed.');

            if (data.results?.length) {
              const transcript = data.results[0].alternatives[0].transcript;
              vrLog(`Final Transcript: ${transcript}`);
              if (promptEl?.setProperties) promptEl.setProperties({ value: transcript });
              setStatus('Ready.');
            } else {
              vrLog('No transcript returned from Speech API.');
              setStatus('Could not understand audio.');
            }
          } catch (err: any) {
            vrLog(`Transcription failed: ${err?.message ?? String(err)}`);
            setStatus(`Transcription Error: ${err?.message ?? String(err)}`);
          }
        };

        const handleClick = async () => {
          vrLog('Record button clicked — using MediaRecorder');
          if (!navigator.mediaDevices?.getUserMedia) {
            vrLog('MediaRecorder API not supported.');
            setStatus('Audio recording not supported.');
            return;
          }

          try {
            audioChunks = [];
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
            mediaRecorder.ondataavailable = (event) => audioChunks.push(event.data);
            mediaRecorder.onstop = () => {
              const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
              transcribeAudio(audioBlob);
              try { stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
            };

            mediaRecorder.start();
            if (recordEl?.setProperties) recordEl.setProperties({ text: 'Recording...' });
            setStatus('Listening...');

            // Stop after 5s
            setTimeout(() => {
              if (mediaRecorder?.state === 'recording') {
                mediaRecorder.stop();
                if (recordEl?.setProperties) recordEl.setProperties({ text: 'Record voice' });
              }
            }, 5000);
          } catch (err: any) {
            vrLog(`Error starting recording: ${err?.message ?? String(err)}`);
            setStatus(`Mic Error: ${err?.message ?? String(err)}`);
          }
        };

        try { recordEl.addEventListener?.('click', handleClick); } catch (_) {}
        recordEl.__hasInitClick_record = true;
      }

      if (generateEl && !generateEl.__hasInitClick) {
        const handleClick = async () => {
          try {
            const prompt = (promptEl?.inputProperties?.value ?? promptEl?.value ?? '') as string;
            if (!prompt) {
              if (statusEl?.setProperties) statusEl.setProperties({ text: 'Please enter a prompt.' });
              return;
            }

            if (generateEl?.setProperties) generateEl.setProperties({ enabled: false });
            if (statusEl?.setProperties) statusEl.setProperties({ text: 'Generating your model...' });

            const token = await getAuthToken();
            
            const generateApiUrl = ((import.meta as any).env)?.VITE_API_ENDPOINT ?? '';
            if (!generateApiUrl) throw new Error("VITE_API_ENDPOINT is not set.");
            const apiUrl = `${generateApiUrl.replace(/\/$/, '')}/generate`;

            const res = await fetch(apiUrl, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ prompt, quality: 'high' }), // You can change quality here
            });

            if (!res.ok) {
              const text = await res.text();
              throw new Error(`Generate failed: ${res.status} ${res.statusText} - ${text}`);
            }

            const data = await res.json();
            if (data?.glb_url) {
              window.dispatchEvent(new CustomEvent('load-model', { detail: { url: data.glb_url } }));
              if (statusEl?.setProperties) statusEl.setProperties({ text: 'Generate success, loading GLB...' });
            } else {
              if (statusEl?.setProperties) statusEl.setProperties({ text: `Generate success: ${JSON.stringify(data)}` });
            }
          } catch (err: any) {
            const msg = `Generate error: ${err?.message ?? String(err)}`;
            if (statusEl?.setProperties) statusEl.setProperties({ text: msg });
            vrLog(msg);
          } finally {
            if (generateEl?.setProperties) generateEl.setProperties({ enabled: true });
          }
        };

        try { generateEl.addEventListener?.('click', handleClick); } catch (_) {}
        generateEl.__hasInitClick = true;
      }
    });
  }
}