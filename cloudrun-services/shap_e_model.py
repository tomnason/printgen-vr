# shap_e_model.py
import torch
import trimesh
import logging
import time
import numpy as np
from trimesh.visual.material import PBRMaterial
from shap_e.diffusion.sample import sample_latents
from shap_e.diffusion.gaussian_diffusion import diffusion_from_config
from shap_e.models.download import load_model, load_config
from shap_e.util.notebooks import decode_latent_mesh

logger = logging.getLogger("api.model")

def load_shap_e_model_and_diffusion(device):
    """
    Loads the Shap-E model and transmitter configuration onto the specified device.
    This should be called once on application startup.
    """
    logger.info("Loading Shap-E models (transmitter, text300M, diffusion)...")
    start_time = time.perf_counter()
    xm = load_model('transmitter', device=device)
    model = load_model('text300M', device=device)
    diffusion = diffusion_from_config(load_config('diffusion'))
    duration = time.perf_counter() - start_time
    logger.info(f"Model loading complete in {duration:.2f} seconds.")
    return {"xm": xm, "model": model, "diffusion": diffusion}

def generate_3d_model(prompt: str, file_path: str, models: dict, device: torch.device, quality: str = "normal"):
    """
    Generates a 3D model, normalizes its orientation, assigns a default material,
    and saves it as a .glb file.
    """
    logger.info(f"Starting 3D model generation for prompt: '{prompt}'")
    
    # --- 1. Set Generation Parameters ---
    batch_size = 1
    
    if quality == "fast":
        karras_steps = 16
        guidance_scale = 15.0
    elif quality == "high":
        karras_steps = 128
        guidance_scale = 20.0
    elif quality == "ultra":
        karras_steps = 256
        guidance_scale = 20.0
    else: # Default to "normal"
        quality = "normal"
        karras_steps = 64
        guidance_scale = 15.0

    logger.info(f"Using quality='{quality}' with {karras_steps} inference steps and guidance scale of {guidance_scale}.")

    xm = models["xm"]
    model = models["model"]
    diffusion = models["diffusion"]

    # --- 2. Run the Shap-E Model ---
    latents_start_time = time.perf_counter()
    latents = sample_latents(
        batch_size=batch_size,
        model=model,
        diffusion=diffusion,
        guidance_scale=guidance_scale,
        model_kwargs=dict(texts=[prompt] * batch_size),
        progress=True,
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

    # --- 3. Decode Mesh and Create Trimesh Object ---
    decode_start_time = time.perf_counter()
    raw_mesh = decode_latent_mesh(xm, latents[0])
    mesh = trimesh.Trimesh(vertices=raw_mesh.verts.cpu().numpy(), faces=raw_mesh.faces.cpu().numpy())

    # --- 4. Normalize the Model's Orientation ---
    logger.info("Normalizing model orientation...")
    
    # a. Split the mesh into connected components (in case of multiple floating parts)
    components = mesh.split(only_watertight=False)
    # b. Find the largest component (the main object)
    largest_component = max(components, key=lambda x: x.area)
    mesh = largest_component
    
    # c. Center the main object at the origin
    mesh.apply_translation(-mesh.center_mass)

    # d. Apply the stable orientation transform
    try:
        transform = trimesh.transformations.rotation_matrix_from_vectors(
            mesh.principal_inertia_vectors[2], [0, 0, 1]
        )
        mesh.apply_transform(transform)
        logger.info("Successfully normalized model orientation.")
    except Exception as e:
        logger.warning(f"Could not automatically orient the mesh: {e}. Using original orientation.")

    # e. Move the bottom of the bounding box to the origin
    min_bounds = mesh.bounds[0]
    mesh.apply_translation(-min_bounds)
    
    # --- 5. Assign a Default Matte Blue Material ---
    logger.info("Assigning default material.")
    blue_material = PBRMaterial(
        name='matte_blue',
        baseColorFactor=[0.1, 0.4, 0.8, 1.0], # RGBA for blue
        metallicFactor=0.1,
        roughnessFactor=0.9
    )
    mesh.visual.material = blue_material

    # --- 6. Export the Final GLB File ---
    scene = trimesh.Scene(mesh)
    scene.export(file_path, file_type='glb')
    
    total_processing_duration = time.perf_counter() - decode_start_time
    logger.info(f"Mesh decoding, normalization, and saving finished in {total_processing_duration:.2f} seconds.")