from insightface.app import FaceAnalysis
from qdrant_client import QdrantClient

from .config import QDRANT_URL, INSIGHTFACE_MODEL_PATH

client = QdrantClient(url= QDRANT_URL)

app = FaceAnalysis(name= INSIGHTFACE_MODEL_PATH, providers=['CPUExecutionProvider'])