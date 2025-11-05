# converters.py
import trimesh
import logging
import time

logger = logging.getLogger("api.converter")

def convert_glb_to_stl(glb_path: str, stl_path: str):
    logger.info(f"Starting conversion from {glb_path} to {stl_path}")
    start_time = time.perf_counter()
    try:
        mesh = trimesh.load(glb_path)
        mesh.export(stl_path)
        duration = time.perf_counter() - start_time
        logger.info(f"Successfully converted to STL in {duration:.2f} seconds.")
        return True
    except Exception as e:
        logger.error(f"Error during GLB to STL conversion: {e}", exc_info=True)
        return False