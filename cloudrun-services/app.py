# app.py
import os
import uuid
import torch
import logging
import logging.config
import time
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware


# --- Local Imports ---
from shap_e_model import generate_3d_model, load_shap_e_model_and_diffusion
from converters import convert_glb_to_stl
from utils_gcs import upload_to_gcs

# --- Logging Configuration ---
# A dictionary-based configuration for Python's logging module.
# This provides a consistent format with timestamps for all log messages.
LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
    },
    "handlers": {
        "default": {
            "formatter": "default",
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stderr",
        },
    },
    "loggers": {
        "api": {"handlers": ["default"], "level": "INFO", "propagate": False},
        "uvicorn": {"handlers": ["default"], "level": "INFO", "propagate": False},
        "uvicorn.error": {"handlers": ["default"], "level": "WARNING", "propagate": False},
        "uvicorn.access": {"handlers": ["default"], "level": "WARNING", "propagate": False},
    },
}

# Apply the logging configuration.
logging.config.dictConfig(LOGGING_CONFIG)
# Get a logger for this module.
logger = logging.getLogger("api")

# --- Global Variables ---
MODELS = {}
DEVICE = None

app = FastAPI()

# --- NEW: Add the CORS Middleware to your app ---
# This tells browsers that it's okay for web pages from any origin
# to make requests to this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allows all origins
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods (GET, POST, etc.)
    allow_headers=["*"], # Allows all headers
)

@app.on_event("startup")
async def startup_event():
    """Load the Shap-E model into memory when the application starts."""
    global MODELS, DEVICE
    DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    logger.info(f"--- Application starting up on device: {DEVICE} ---")
    MODELS = load_shap_e_model_and_diffusion(DEVICE)
    logger.info("--- Shap-E models loaded successfully ---")

GCS_BUCKET_NAME = os.environ.get("GCS_BUCKET_NAME")

os.makedirs("temp", exist_ok=True)

class PromptRequest(BaseModel):
    prompt: str
    quality: str = "normal"

class GenerationResponse(BaseModel):
    glb_url: str
    stl_url: str

@app.post("/generate", response_model=GenerationResponse)
async def generate(request: PromptRequest):
    request_start_time = time.perf_counter()
    request_id = str(uuid.uuid4())
    logger.info(f"Request ID: {request_id} | Starting generation for prompt: '{request.prompt}'")

    if not GCS_BUCKET_NAME:
        raise HTTPException(status_code=500, detail="GCS_BUCKET_NAME environment variable not set.")
    if not MODELS:
        raise HTTPException(status_code=503, detail="Models are not loaded yet. Please wait.")

    local_glb_path = f"temp/{request_id}.glb"
    local_stl_path = f"temp/{request_id}.stl"

    try:
        # --- Step 1: 3D Model Generation (GPU Intensive) ---
        step_1_start = time.perf_counter()
        generate_3d_model(
            prompt=request.prompt,
            file_path=local_glb_path,
            models=MODELS,
            device=DEVICE,
            quality=request.quality
        )
        step_1_duration = time.perf_counter() - step_1_start
        logger.info(f"Request ID: {request_id} | Step 1/3: 3D model generation finished in {step_1_duration:.2f} seconds.")

        # --- Step 2: 3D Conversion (CPU Intensive) ---
        step_2_start = time.perf_counter()
        convert_glb_to_stl(local_glb_path, local_stl_path)
        step_2_duration = time.perf_counter() - step_2_start
        logger.info(f"Request ID: {request_id} | Step 2/3: GLB to STL conversion finished in {step_2_duration:.2f} seconds.")

        # --- Step 3: Cloud Storage Upload (Network I/O) ---
        step_3_start = time.perf_counter()
        gcs_glb_path = f"models/{request_id}.glb"
        gcs_stl_path = f"models/{request_id}.stl"
        glb_url = upload_to_gcs(GCS_BUCKET_NAME, local_glb_path, gcs_glb_path)
        stl_url = upload_to_gcs(GCS_BUCKET_NAME, local_stl_path, gcs_stl_path)
        step_3_duration = time.perf_counter() - step_3_start
        logger.info(f"Request ID: {request_id} | Step 3/3: GCS upload finished in {step_3_duration:.2f} seconds.")

        total_duration = time.perf_counter() - request_start_time
        logger.info(f"Request ID: {request_id} | Successfully completed all steps in {total_duration:.2f} seconds.")
        
        return {"glb_url": glb_url, "stl_url": stl_url}

    except Exception as e:
        logger.error(f"Request ID: {request_id} | An error occurred during the process: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # --- Cleanup ---
        if os.path.exists(local_glb_path):
            os.remove(local_glb_path)
        if os.path.exists(local_stl_path):
            os.remove(local_stl_path)
        logger.info(f"Request ID: {request_id} | Cleaned up temporary files.")

@app.get("/")
def read_root():
    return {"status": "ok", "device": str(DEVICE)}