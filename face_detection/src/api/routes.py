from fastapi import APIRouter, Depends
from ..domain.folder_manager  import FolderManager as fm, get_folder_manager
from ..models.add_images import MultiImages


router = APIRouter(prefix="/filter_faces")


@router.post("/create_folder")
def create_folder(folder_name: str, folder_path: str, manager: fm = Depends(get_folder_manager)):
    res = manager.create_folder(folder_name= folder_name, images_path = folder_path)
    if res:
        return {"create_folder": "True"}
    return {"create_folder": "False"}


@router.post("/delete_folder")
def delete_folder(folder_name: str, manager: fm = Depends(get_folder_manager)):
    res = manager.delete_folder(folder_name= folder_name)
    if res:
        return {"delete_folder": "True"}
    return {"delete_folder": "False"}


@router.post("/add_images")
def add_images(multi_img: MultiImages, manager:fm = Depends(get_folder_manager)):
    folder = manager.get_folder(multi_img.folder_name)
    try:
        folder.add_images(*multi_img.images)
    except Exception as e:
        return {"add_images": "False"} # Return e ?
    return {"add_images": "True"}


@router.post("/remove_images")
def remove_images(multi_img: MultiImages, manager:fm = Depends(get_folder_manager)):
    folder = manager.get_folder(multi_img.folder_name)
    try:
        res = folder.remove_images(*multi_img.images)
    except Exception as e:
        return {"remove_images": f"False - {e} - {multi_img.images}"} 
    return {"remove_images": f"True - {res}"}


@router.post("/filter_union")
def filter_union(multi_img: MultiImages, manager: fm = Depends(get_folder_manager)):
    folder = manager.get_folder(multi_img.folder_name)
    try:
        filter_folder = folder.filter_union(*multi_img.images)
    except Exception as e:
        return {"Filter folder": "False"}
    return {"Filter folder": filter_folder}


@router.post("/filter_intersection")
def filter_intersection(multi_img: MultiImages, manager: fm = Depends(get_folder_manager)):
    folder = manager.get_folder(multi_img.folder_name)
    try:
        filter_folder = folder.filter_intersection(*multi_img.images)
    except Exception as e:
        return {"Filter folder": "False"}
    return {"Filter folder": filter_folder}




# Pour DEBUG
@router.post("/get_df")
def get_df(folder_name: str, manager:fm = Depends(get_folder_manager)):
    folder = manager.get_folder(folder_name)

    return {"folder": folder.dataframe["image"].tolist()}



    





