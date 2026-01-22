from fastapi import APIRouter, Depends
from typing import List
from ..domain.folder_manager  import FolderManager as fm, get_folder_manager
from ..models.add_images import MultiImages


router = APIRouter(prefix="/filter_faces")


@router.post("/create_folder")
def create_folder(folder_name: str, folder_path: str, manager: fm = Depends(get_folder_manager)):
    folder = manager.create_folder(folder_name=folder_name, images_path=folder_path)
    return {"create_folder": bool(folder)}


@router.post("/delete_folder")
def delete_folder(folder_name: str, manager: fm = Depends(get_folder_manager)):
    folder = manager.delete_folder(folder_name=folder_name)
    return {"delete_folder": bool(folder)}


@router.post("/add_images")
def add_images(multi_img: MultiImages, manager:fm = Depends(get_folder_manager)):
    folder = manager.get_folder(multi_img.folder_name)
    if folder is None:
        return {"add_images": f"False - Folder '{multi_img.folder_name}' not found"}
    try:
        folder.add_images(*multi_img.images)
    except Exception as e:
        return {"add_images": f"False - {e}"}
    return {"add_images": "True"}


@router.post("/remove_images")
def remove_images(multi_img: MultiImages, manager:fm = Depends(get_folder_manager)):
    folder = manager.get_folder(multi_img.folder_name)
    if folder is None:
        return {"remove_images": f"False - Folder '{multi_img.folder_name}' not found"}
    try:
        res = folder.remove_images(*multi_img.images)
    except Exception as e:
        return {"remove_images": f"False - {e}"}
    return {"remove_images": f"True - {res}"}


@router.post("/filter_union")
def filter_union(multi_img: MultiImages, manager: fm = Depends(get_folder_manager)):
    folder = manager.get_folder(multi_img.folder_name)
    if folder is None:
        return {"error": f"Folder '{multi_img.folder_name}' not found."}
    
    try:
        result = folder.filter_union(*multi_img.images)
    except Exception as e:
        return {"error": f"Filter union failed: {e}"}
    
    return {"filter_union": result}


@router.post("/filter_intersection")
def filter_intersection(multi_img: MultiImages, manager: fm = Depends(get_folder_manager)):
    folder = manager.get_folder(multi_img.folder_name)
    if folder is None:
        return {"filtered_images": f"False - Folder '{multi_img.folder_name}' not found"}
    try:
        filtered_images = folder.filter_intersection(*multi_img.images)
    except Exception as e:
        return {"filtered_images": f"False - {e}"}
    return {"filtered_images": filtered_images}




# Pour DEBUG
# @router.post("/get_df")
# def get_df(folder_name: str, manager:fm = Depends(get_folder_manager)):
#     folder = manager.get_folder(folder_name)

#     return {"folder": folder.dataframe["image"].tolist()}



    





