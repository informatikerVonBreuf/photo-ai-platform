from qdrant_client import QdrantClient

from .config import QDRANT_URL

client = QdrantClient(url= QDRANT_URL)
