from typing import Dict
from .filter_by_image import FilterByImage

from ..client import client

class FolderManager:
    """Manage multiple FilterByImage instance"""
    
    def __init__(self):
        """Initialize the folder manager with an empty folder dictionary"""
        self._folders: Dict[str, FilterByImage] = {}
        self._client = client
    
    def create_folder(self, folder_name: str, images_path: str):
        """
        Create a new folder with a FilterByImage instance

        Args:
            folder_name (str): Name of the folder to create
            images_path (str): Path to the images for this folder

        Returns:
            bool: True if folder was created, False if it already exists
        """
        if not folder_name in self.list_folders():
            filter_obj = FilterByImage(
                folder_name=folder_name,
                images_path=images_path
            )
            
            self._folders[folder_name] = filter_obj
            return True
        
        return False
    
    
    def get_folder(self, folder_name: str):
        """
        Retrieve a folder object by name
        Args:
            folder_name (str): Name of the folder to retrieve

        Returns:
            FilterByImage or None: The folder object if it exists, otherwise None
        """
        return self._folders.get(folder_name)
    
    def delete_folder(self, folder_name: str):
        """
        Delete a folder and its corresponding Qdrant collection
        Args:
            folder_name (str): Name of the folder to delete

        Returns:
            bool: True if folder existed and was deleted, False otherwise
        """
        if folder_name in self._folders:
            self._client.delete_collection(f"faces_{folder_name}")
            del self._folders[folder_name]
            return True
        return False
    
    def list_folders(self):
        """List all existing folder names"""
        return list(self._folders.keys())

_folder_manager = None

def get_folder_manager():
    """
    Return a singleton FolderManager instance

    Returns:
        FolderManager: Shared folder manager instance
    """
    global _folder_manager
    if _folder_manager is None:
        _folder_manager = FolderManager()
    return _folder_manager