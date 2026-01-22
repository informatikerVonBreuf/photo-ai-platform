from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

QDRANT_URL = "http://localhost:6333"

IM_SIZE = (640, 640)
VECTOR_DIM = 512
MAX_WORKERS = 8

INSIGHTFACE_MODEL_PATH = Path(r"..\models\antelopev2")