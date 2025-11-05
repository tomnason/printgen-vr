# shap_e_model.py
# Handles the loading and inference of the OpenAI Shap-E model.

import torch
import os
from shap_e.diffusion.sample import sample_latents
from shap_e.diffusion.gaussian_diffusion import diffusion_from_config
from shap_e.models.download import load_model, load_config
from shap_e.util.notebooks import decode_latent_mesh

def load_shap_e_model(device):
    """
    Loads the Shap-E model and transmitter configuration onto the specified device.
    
    Args:
        device (torch.device): The device (CPU or CUDA) to load the model on.

    Returns:
        tuple: A tuple containing the loaded model and diffusion configuration.
    """
    xm = load_model('transmitter', device=device)
    model = load_model('text300M', device=device)
    diffusion = diffusion_from_config(load_config('diffusion'))
    return xm, model, diffusion

def generate_3d_model(prompt: str, file_path: str):
    """
    Generates a 3D model (.glb) from a text prompt using Shap-E.

    Args:
        prompt (str): The text description for the 3D model.
        file_path (str): The local path to save the generated .glb file.
    """
    # Check for GPU availability and set the device accordingly.
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")

    # Load the Shap-E models.
    xm, model, diffusion = load_shap_e_model(device)

    batch_size = 1
    guidance_scale = 15.0

    # Define the generation options.
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
        karras_steps=64,
        sigma_min=1e-3,
        sigma_max=160,
        s_churn=0,
    )

    # Decode the latent representation into a mesh and save to a .glb file.
    for i, latent in enumerate(latents):
        with open(file_path, 'wb') as f:
            decode_latent_mesh(xm, latent).write_glb(f)