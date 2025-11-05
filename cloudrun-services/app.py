# app.py
# Main FastAPI application to handle 3D model generation requests.

import os
import uuid
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from shap_e_model import generate_3d_model
from converters import convert_glb_to_stl
from utils_gcs import upload_to_gcs

# Initialize the FastAPI app.
app = FastAPI()

# Retrieve the GCS bucket name from environment variables.
# This is a best practice for configuration.
GCS_BUCKET_NAME = os.environ.get("GCS_BUCKET_NAME")

# Create a temporary directory for local file storage if it doesn't exist.
os.makedirs("temp", exist_ok=True)

class PromptRequest(BaseModel):
    """Defines the structure of the request body for the /generate endpoint."""
    prompt: str

class GenerationResponse(BaseModel):
    """Defines the structure of the response body for the /generate endpoint."""
    glb_url: str
    stl_url: str

@app.post("/generate", response_model=GenerationResponse)
async def generate(request: PromptRequest):
    """
    API endpoint to generate a 3D model from a text prompt.
    It generates a .glb file, converts it to .stl, uploads both to GCS,
    and returns their public URLs.
    """
    if not GCS_BUCKET_NAME:
        raise HTTPException(status_code=500, detail="GCS_BUCKET_NAME environment variable not set.")

    try:
        # Generate a unique ID for this request to avoid filename conflicts.
        request_id = str(uuid.uuid4())
        
        # Define local and GCS paths for the generated files.
        local_glb_path = f"temp/{request_id}.glb"
        local_stl_path = f"temp/{request_id}.stl"
        gcs_glb_path = f"models/{request_id}.glb"
        gcs_stl_path = f"models/{request_id}.stl"

        # Step 1: Generate the 3D model (.glb) from the prompt.
        print(f"Generating 3D model for prompt: '{request.prompt}'")
        generate_3d_model(request.prompt, local_glb_path)

        # Step 2: Convert the .glb file to .stl format.
        print("Converting GLB to STL...")
        convert_glb_to_stl(local_glb_path, local_stl_path)

        # Step 3: Upload both files to Google Cloud Storage.
        print("Uploading files to GCS...")
        glb_url = upload_to_gcs(GCS_BUCKET_NAME, local_glb_path, gcs_glb_path)
        stl_url = upload_to_gcs(GCS_BUCKET_NAME, local_stl_path, gcs_stl_path)

        return {"glb_url": glb_url, "stl_url": stl_url}

    except Exception as e:
        # Handle any exceptions that occur during the process.
        print(f"An error occurred: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up local temporary files.
        if os.path.exists(local_glb_path):
            os.remove(local_glb_path)
        if os.path.exists(local_stl_path):
            os.remove(local_stl_path)

@app.get("/")
def read_root():
    """A simple root endpoint to confirm the service is running."""
    return {"status": "ok"}