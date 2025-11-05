# Dockerfile
# Defines the container image for the Cloud Run GPU service.

# --- STAGE 1: Model Cache Builder ---
# This stage's only job is to download the model files.
FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04 as cache_builder

# Install Python, pip, and git.
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    git \
    && rm -rf /var/lib/apt/lists/*
RUN python3.11 -m pip install --upgrade pip

# Install the necessary libraries to trigger the download.
RUN python3.11 -m pip install --no-cache-dir \
    torch --extra-index-url https://download.pytorch.org/whl/cu121 \
    PyYAML
RUN python3.11 -m pip install --no-cache-dir git+https://github.com/openai/shap-e.git

# This is the command that actually triggers the download of all models.
# The models will be saved to the default cache location inside /root/.cache
RUN python3.11 -c "from shap_e.models.download import load_model, load_config; load_model('transmitter', device='cpu'); load_model('text300M', device='cpu'); load_config('diffusion')"


# --- STAGE 2: Final Application ---
# This is our main application build.
FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04

# Set environment variables.
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install Python, pip, and git.
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    git \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip.
RUN python3.11 -m pip install --upgrade pip

# --- KEY CORRECTION (ROBUST METHOD) ---
# Copy the entire root cache directory from the builder stage.
# This is robust and does not depend on knowing the exact subdirectory structure.
COPY --from=cache_builder /root/.cache /root/.cache

# Set the working directory.
WORKDIR /app

# Copy the requirements file.
COPY requirements.txt .

# Install all Python dependencies. Pip will find the models already in the cache
# and will not download them again.
RUN python3.11 -m pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application source code.
COPY . .

# Expose the port.
EXPOSE 8080

# Command to run the application.
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]