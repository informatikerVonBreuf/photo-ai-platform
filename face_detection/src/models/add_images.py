from pydantic import BaseModel
from typing import List

class MultiImages(BaseModel):
    folder_name: str
    images: List[str]