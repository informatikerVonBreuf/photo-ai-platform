from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

QDRANT_URL = "http://localhost:6333"

MAX_IMG_SIZE = 1024
VECTOR_DIM = 128
MAX_WORKERS = 8

MODEL_PATH = BASE_DIR / "models" 
YUNET_MODEL_PATH = MODEL_PATH / "face_detection_yunet_2023mar.onnx"
FACENET_MODEL_PATH = MODEL_PATH / "faceNet.onnx"
