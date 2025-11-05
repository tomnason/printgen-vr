# utils_gcs.py
import logging
from google.cloud import storage

logger = logging.getLogger("api.gcs")

def upload_to_gcs(bucket_name: str, source_file_name: str, destination_blob_name: str) -> str:
    logger.info(f"Uploading '{source_file_name}' to GCS bucket '{bucket_name}' as '{destination_blob_name}'")
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(destination_blob_name)

        blob.upload_from_filename(source_file_name)

        # --- THIS LINE IS REMOVED ---
        # blob.make_public()
        # The bucket is already public, so this is not needed and causes an error.

        logger.info(f"Upload successful. Public URL: {blob.public_url}")
        return blob.public_url
    except Exception as e:
        logger.error(f"Failed to upload {source_file_name} to GCS: {e}", exc_info=True)
        raise