# Dockerfile
# Defines the container image for the Cloud Run GPU service.

# Use an official NVIDIA CUDA runtime image as a parent image.
# This image includes the necessary NVIDIA drivers and CUDA toolkit.
# Using a Python 3.11-slim base image for a smaller footprint.
FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04

# Set environment variables to prevent interactive prompts during package installation.
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install Python 3.11, pip, and other necessary system dependencies.
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set python3.11 as the default python command.
RUN ln -s /usr/bin/python3.11 /usr/bin/python

# Set the working directory in the container.
WORKDIR /app

# Copy the requirements file to the working directory.
COPY requirements.txt .

# Install Python dependencies from the requirements file.
# Using --no-cache-dir reduces the image size.
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application source code to the working directory.
COPY . .

# Expose the port that the FastAPI application will run on.
EXPOSE 8080

# Command to run the application using uvicorn.
# The host 0.0.0.0 makes the server accessible from outside the container.
# The port is set to 8080, which is the default for Cloud Run.
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]