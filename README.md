# Build the Docker Container
`docker build -t shap-e-api-local .`

This command executes the instructions in your `Dockerfile`, downloading the base image, installing dependencies, and copying your code into the image. This may take some time, especially the first time you run it, as it needs to download the CUDA base image and the PyTorch libraries.

# Run the Docker Container

*   Maps port `8080` of the container to port `8080` on your local machine.
*   Enables GPU access for the container with `--gpus all`.
*   Sets the `GCS_BUCKET_NAME` environment variable.
*   Mounts your local `gcloud` config directory into the container so the application can find and use your authentication credentials.

Execute this command in your terminal:

```bash
docker run --rm -p 8080:8080 --gpus all --env-file .env -v ~/.config/gcloud:/root/.config/gcloud shap-e-api-local