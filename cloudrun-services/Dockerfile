# Dockerfile
# Defines the container image for the Cloud Run GPU service.

# --- STAGE 1: Model Cache Builder ---
# This stage downloads the model files.
FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04 as cache_builder

# Install build dependencies.
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    git \
    && rm -rf /var/lib/apt/lists/*
RUN python3.11 -m pip install --upgrade pip

# Install libraries needed to trigger the model download.
RUN python3.11 -m pip install --no-cache-dir \
    torch --extra-index-url https://download.pytorch.org/whl/cu121 \
    PyYAML
RUN python3.11 -m pip install --no-cache-dir git+https://github.com/openai/shap-e.git

# Trigger the download of all models.
RUN python3.11 -c "from shap_e.models.download import load_model, load_config; load_model('transmitter', device='cpu'); load_model('text300M', device='cpu'); load_config('diffusion')"


# --- STAGE 2: Final Application ---
# This is the final, clean production image.
FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04

# Set environment variables.
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install runtime dependencies.
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    git \
    && rm -rf /var/lib/apt/lists/*
RUN python3.11 -m pip install --upgrade pip

# Copy the pre-downloaded model files from the cache_builder stage.
COPY --from=cache_builder /root/.cache /root/.cache

# Set the working directory.
WORKDIR /app

# --- KEY CHANGE: Copy only the backend-specific files ---
# This ensures a clean, minimal image.
COPY requirements.txt .
RUN python3.11 -m pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend source code.
COPY app.py .
COPY shap_e_model.py .
COPY converters.py .
COPY utils_gcs.py .

# Expose the correct port for Cloud Run.
EXPOSE 8080

# The production command to run the application.
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]