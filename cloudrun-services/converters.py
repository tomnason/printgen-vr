# converters.py
# Handles the conversion of 3D model files (GLB to STL).

import trimesh

def convert_glb_to_stl(glb_path: str, stl_path: str):
    """
    Converts a .glb file to a .stl file.

    Args:
        glb_path (str): The path to the input .glb file.
        stl_path (str): The path to save the output .stl file.
    
    Returns:
        bool: True if conversion was successful, False otherwise.
    """
    try:
        # Load the .glb file using trimesh.
        mesh = trimesh.load(glb_path)
        
        # Export the loaded mesh to a .stl file.
        mesh.export(stl_path)
        
        print(f"Successfully converted {glb_path} to {stl_path}")
        return True
    except Exception as e:
        print(f"Error during GLB to STL conversion: {e}")
        return False