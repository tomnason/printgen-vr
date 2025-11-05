# shap_e_model.py
import torch
import trimesh
import logging
import time
from shap_e.diffusion.sample import sample_latents
from shap_e.diffusion.gaussian_diffusion import diffusion_from_config
from shap_e.models.download import load_model, load_config
from shap_e.util.notebooks import decode_latent_mesh

# Get a logger for this module (it will inherit the config from app.py)
logger = logging.getLogger("api.model")

def load_shap_e_model_and_diffusion(device):
    logger.info("Loading Shap-E models (transmitter, text300M, diffusion)...")
    start_time = time.perf_counter()
    xm = load_model('transmitter', device=device)
    model = load_model('text300M', device=device)
    diffusion = diffusion_from_config(load_config('diffusion'))
    duration = time.perf_counter() - start_time
    logger.info(f"Model loading complete in {duration:.2f} seconds.")
    return {"xm": xm, "model": model, "diffusion": diffusion}

def generate_3d_model(prompt: str, file_path: str, models: dict, device: torch.device, quality: str = "normal"):
    logger.info(f"Starting 3D model generation for prompt: '{prompt}'")
    
    batch_size = 1
    guidance_scale = 15.0

    if quality == "fast":
        karras_steps = 16
    else:
        karras_steps = 64
    
    logger.info(f"Using quality='{quality}' with {karras_steps} inference steps.")

    xm = models["xm"]
    model = models["model"]
    diffusion = models["diffusion"]

    # --- GPU-intensive step ---
    logger.info("Starting latent sampling on GPU...")
    latents_start_time = time.perf_counter()
    latents = sample_latents(
        batch_size=batch_size,
        model=model,
        diffusion=diffusion,
        guidance_scale=guidance_scale,
        model_kwargs=dict(texts=[prompt] * batch_size),
        progress=True, # This will still show the tqdm progress bar
        clip_denoised=True,
        use_fp16=True,
        use_karras=True,
        karras_steps=karras_steps,
        sigma_min=1e-3,
        sigma_max=160,
        s_churn=0,
    )
    latents_duration = time.perf_counter() - latents_start_time
    logger.info(f"Latent sampling finished in {latents_duration:.2f} seconds.")

    # --- CPU-intensive step ---
    logger.info("Decoding latent mesh on CPU...")
    decode_start_time = time.perf_counter()
    raw_mesh = decode_latent_mesh(xm, latents[0])
    scene = trimesh.Trimesh(vertices=raw_mesh.verts.cpu().numpy(), faces=raw_mesh.faces.cpu().numpy())
    scene.export(file_path)
    decode_duration = time.perf_counter() - decode_start_time
    logger.info(f"Mesh decoding and saving finished in {decode_duration:.2f} seconds.")