# utils_gcs.py
# Provides helper functions for interacting with Google Cloud Storage (GCS).

import os
from google.cloud import storage

def upload_to_gcs(bucket_name: str, source_file_name: str, destination_blob_name: str) -> str:
    """
    Uploads a file to the specified GCS bucket and makes it public.

    Args:
        bucket_name (str): The name of the GCS bucket.
        source_file_name (str): The local path of the file to upload.
        destination_blob_name (str): The desired name of the file in the GCS bucket.

    Returns:
        str: The public URL of the uploaded file.
    """
    # Initialize the GCS client.
    storage_client = storage.Client()
    
    # Get the bucket object.
    bucket = storage_client.bucket(bucket_name)
    
    # Create a blob object for the destination file.
    blob = bucket.blob(destination_blob_name)

    # Upload the local file to the GCS blob.
    blob.upload_from_filename(source_file_name)

    # Make the blob publicly accessible.
    blob.make_public()

    print(f"File {source_file_name} uploaded to {destination_blob_name}.")
    
    # Return the public URL of the uploaded file.
    return blob.public_url