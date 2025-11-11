from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
# --- Use the top-level 'google.auth' library ---
import google.auth
import google.auth.transport.requests
import logging
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SCOPES = ['https://www.googleapis.com/auth/cloud-platform']

@app.get("/get-token")
async def get_token():
    """
    Generates a short-lived, general-purpose OAuth 2.0 access token.
    This token can be used to call any GCP service that the underlying
    service account has permissions for.
    """
    try:
        credentials, project = google.auth.default(scopes=['https://www.googleapis.com/auth/cloud-platform'])
        auth_req = google.auth.transport.requests.Request()
        credentials.refresh(auth_req)
        logger.info("Successfully generated a general-purpose access token.")
        return {"access_token": credentials.token, "expires_in": credentials.expiry.isoformat()}
    except Exception as e:
        logger.error(f"Failed to generate access token: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Could not generate access token: {e}")

@app.get("/")
def read_root():
    return {"status": "ok"}