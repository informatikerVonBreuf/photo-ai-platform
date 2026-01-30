import os
import cv2
import numpy as np
import pandas as pd
import onnxruntime as ort
import threading
from collections import defaultdict, Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from sklearn.cluster import AgglomerativeClustering
from sklearn.preprocessing import normalize
from qdrant_client import models

from ..config import MAX_IMG_SIZE, VECTOR_DIM, MAX_WORKERS, YUNET_MODEL_PATH, FACENET_MODEL_PATH
from ..client import client

class FilterByImage:
    """Manage face-based filtering on an image dataset using InsightFace and Qdrant"""
    
    def __init__(self, folder_name: str, images_path: str, det_model= YUNET_MODEL_PATH, rec_model = FACENET_MODEL_PATH, 
                 max_side=MAX_IMG_SIZE, vec_dim=VECTOR_DIM, max_workers=MAX_WORKERS):
        
        self.folder_name = folder_name
        self.col_name = f"faces_{self.folder_name}"
        self.images_path = self._check_path(images_path) 
        
        self.client = client # Qdrant
        self.max_side = max_side
        self.vec_dim = vec_dim
        self.max_workers = max_workers
        self.det_model = det_model
        self.rec_model = rec_model
        self._thread_local = threading.local()

        self.ort_session = ort.InferenceSession(rec_model, providers=['CPUExecutionProvider'])
        self.input_name = self.ort_session.get_inputs()[0].name
        


        self._df = pd.DataFrame(columns=["image", "embeddings", "person_id"])
        
        self._init_dataframe()
        self._create_clusters()
        self._init_vector_store()

        self.count_actions = 0 
        self.reference_count = self._upload_ref_count()


    @property
    def dataframe(self):
        return self._df.copy()
    
    @dataframe.setter
    def dataframe(self, new_df):
        if isinstance(new_df, pd.DataFrame):
            self._df = new_df


    def _get_embedding(self, face_img):
        face_img = cv2.resize(face_img, (160, 160))
        face_img = cv2.cvtColor(face_img, cv2.COLOR_BGR2RGB)
        face_img = (face_img.astype(np.float32) - 127.5) / 128.0
        input_blob = np.expand_dims(face_img, axis=0)
        embedding = self.ort_session.run(None, {self.input_name: input_blob})[0].flatten()
        return normalize(embedding.reshape(1, -1))[0]

    def _process_image(self, path: str):
        """
        Read an image, detect faces, and return embeddings
        Args:
            path (str): Path to the image

        Returns:
            list[tuple]: List of tuples (image_path, embedding)
        """
        
        img = self._fast_imread(path)
        if img is None: 
            return []
        img_padded = self._add_padding(img, 0.3)
        h, w = img_padded.shape[:2]
        scale = self.max_side / max(h, w)
        img_final = cv2.resize(img_padded, (int(w * scale), int(h * scale)))
        detector = self._get_detector(img_final.shape[1], img_final.shape[0])
        _, faces = detector.detect(img_final)
        results = []
        if faces is not None:
            for face in faces:
                landmarks = face[4:14].reshape((5, 2))
                aligned_img = self._align_face(img_final, landmarks)
                x, y, bw, bh = map(int, face[:4])
                face_crop = aligned_img[max(0, y):y+bh, max(0, x):x+bw]
                if face_crop.size > 0:
                    results.append((path, self._get_embedding(face_crop)))
        return results


    def prediction(self, image_path: str):
        """
        Query the vector store using the embedding of a face from an input image

        Args:
            image_path (str): Path to the query image

        Returns:
            QueryResult: Qdrant query result containing nearest points
        """
        self._check_image_path(image_path)
        faces_found = self._process_image(image_path)
        if not faces_found: 
            return None

        img_embed = faces_found[0][1]
        
        return self.client.query_points(
            collection_name=self.col_name,
            query=img_embed.tolist(), 
            limit=50
        )

    def filter_df(self, image_path: str, df=None):
        """
        Filter the dataframe based on the closest matching face from a query image

        Args:
            image_path (str): Path to the query image
            df (pd.DataFrame, optional): DataFrame to filter. Defaults to internal dataframe

        Returns:
            pd.DataFrame or list: Filtered dataframe or empty list if no matches
        """
        if df is None: 
            df = self.dataframe
        res = self.prediction(image_path)
        
        if res is None:
            return []
        
        try:
            hits = res.points if hasattr(res, 'points') else res
        except:
            return []

        threshold = 0.6
        matches = [hit for hit in hits if hit.score > threshold]
        
        if matches and isinstance(df, pd.DataFrame):
            class_lst = [m.payload["person_id"] for m in matches]
            pred = max(Counter(class_lst).items(), key=lambda x: x[1])[0]
            return df[df["person_id"] == pred].drop_duplicates(subset=["image", "person_id"])
        
        return []

    def filter_union(self, *paths):
        """
        Return the union of all filtered results for multiple query images
        Args:
            *paths (str): Paths to query images

        Returns:
            set: Set of image paths matching any of the query images
        """
        output = []
        for path in paths:
            res = self.filter_df(path)
            if isinstance(res, pd.DataFrame):
                output.extend(res["image"].tolist())
        return set(output)

    def filter_intersection(self, *paths):
        """
        Return the intersection of filtered results for multiple query images
        Args:
            *paths (str): Paths to query images

        Returns:
            list: List of image paths matching all query images
        """
        df = self.dataframe
        for path in paths:
            filtered = self.filter_df(path, df)
            if isinstance(filtered, pd.DataFrame):
                df = df[df["image"].isin(filtered["image"].tolist())]
            else: return []
        return df["image"].unique().tolist()

    
    def add_image(self, path):
        """
        Add a single image to the dataset, assign identity, and update the vector store

        Args:
            path (str): Path to the image to add
        """
        if self._check_image_path(path):
            df = self.dataframe
            faces = self._process_image(path)
            self.count_actions += len(faces)
            
            if self._check_clustering():
                for _, emb in faces:
                    df.loc[len(df)] = [path, emb, 0] 
                self.dataframe = df
                self._reset_clusters()
            else:
                for _, emb in faces:
                    res = self.client.query_points(collection_name=self.col_name, query=emb.tolist(), limit=10)
                    threshold = 0.6
                    
                    matches = [hit for hit in res.points if hit.score > threshold]
                    
                    if matches:
                        class_lst = [m.payload["person_id"] for m in matches]
                        pred = max(Counter(class_lst).items(), key=lambda x: x[1])[0]
                    else:
                        pred = 0 if df.empty else df["person_id"].max() + 1
                    
                    new_row = pd.DataFrame({'image': [path], 'embeddings': [emb], 'person_id': [pred]})
                    df = pd.concat([df, new_row], ignore_index=True)
                    self.client.upsert(
                        collection_name=self.col_name, 
                        points=[models.PointStruct(id=len(df)+10000, vector=emb.tolist(), payload={"image": path, "person_id": int(pred)})]
                    )
                self.dataframe = df

    def add_images(self, *paths):
        """
        Add multiple images to the dataset
        Args:
            *paths (str): Paths to images to add

        Returns:
            str: Summary of added images
        """
        add_img = []
        for path in paths:
            if self._check_image_path(path):
                self.add_image(path)
                add_img.append(path)
        print(f"The following images have been added to the folder '{self.folder_name}' : "+ ", ".join(add_img))
        return f"The following images have been added to the folder '{self.folder_name}' : "+ ", ".join(add_img)



    def remove_images(self, *paths):
        """
        Remove specified images from the dataset and vector store

        Args:
            *paths (str): Paths to images to remove

        Returns:
            str: Summary of removed images
        """
        df = self.dataframe
        del_images = []
        for path in paths:
            indices = df[df["image"] == path].index.tolist()
            if indices:
                df = df.drop(index=indices)
                self.client.delete(collection_name=self.col_name, points_selector=models.PointIdsList(points=indices))
                del_images.append(path)
        self.dataframe = df
        self.reference_count = self._upload_ref_count()
        return f"Supprimé : {', '.join(del_images)}"

  

    def _create_clusters(self):
        """Agglomeration grouping to maximize stability"""

        df = self.dataframe
        if df.empty: 
            self.dataframe = pd.DataFrame(columns=["image", "embeddings", "person_id"])
        X = np.vstack(df["embeddings"].to_numpy()).astype('float32')
        model = AgglomerativeClustering(n_clusters=None, metric='cosine', linkage='average', distance_threshold=0.45)
        df["person_id"] = model.fit_predict(X)
        self.dataframe = df.drop_duplicates(subset=["image", "person_id"])


    def _init_vector_store(self):
        """Create or reset the Qdrant collection and upload vectors"""

        if self.client.collection_exists(self.col_name):
            self.client.delete_collection(self.col_name)
        self.client.create_collection(
            collection_name=self.col_name,
            vectors_config=models.VectorParams(size=self.vec_dim, distance=models.Distance.COSINE, on_disk=True)
        )

        df = self.dataframe
        if not df.empty:
            points = [
                models.PointStruct(
                    id=idx, vector=row["embeddings"].tolist(), 
                    payload={"image": row["image"], "person_id": int(row["person_id"])}
                ) for idx, row in df.iterrows()
            ]
            self.client.upsert(self.col_name, points=points)

    def _upload_ref_count(self):
        """Compute a reference value used to decide when reclustering is required"""
        df = self.dataframe
        return df.shape[0] if not df.empty else 10


    def _check_clustering(self, p=0.5):
        """
        Determine if reclustering should be triggered based on accumulated updates

        Args:
            p (float, optional): Fraction threshold of actions to reference count. Defaults to 0.5

        Returns:
            bool: True if reclustering should be triggered
        """
        return (self.count_actions > p * self.reference_count) and self.reference_count >= 10


    def _reset_clusters(self):
        """Recompute clusters and reinitialize the vector store"""
        self._create_clusters()
        self._init_vector_store()
        self.count_actions = 0
        self.reference_count = self._upload_ref_count()

   
    def _get_detector(self, w, h):
        """Manages the YuNet detector instance in a thread-isolated manner"""
        if not hasattr(self._thread_local, "detector"):
            self._thread_local.detector = cv2.FaceDetectorYN.create(self.det_model, "", (w, h))
        self._thread_local.detector.setInputSize((w, h))
        return self._thread_local.detector


    def _align_face(self, img, landmarks):
        """Align both eyes on the horizontal axis"""
        eye_l, eye_r = landmarks[0], landmarks[1]
        angle = np.degrees(np.arctan2(eye_r[1] - eye_l[1], eye_r[0] - eye_l[0]))
        eye_center = (float((eye_l[0] + eye_r[0]) / 2), float((eye_l[1] + eye_r[1]) / 2))
        M = cv2.getRotationMatrix2D(eye_center, angle, scale=1.0)
        return cv2.warpAffine(img, M, (img.shape[1], img.shape[0]), flags=cv2.INTER_CUBIC)


    @staticmethod
    def _fast_imread(path):
        """
        Fast image loading using binary buffer decoding
        Args:
            path (str): Path to the image

        Returns:
            np.ndarray: Loaded image as a numpy array
        """
        with open(path, "rb") as f:
            return cv2.imdecode(np.frombuffer(f.read(), np.uint8), cv2.IMREAD_COLOR)

    @staticmethod
    def _add_padding(image, padding_percent):
        """
        Add zero-padding around an image
        Args:
            image (np.ndarray): Input image
            padding_percent (float, optional): Fraction of image size to pad. Defaults to 0.4

        Returns:
            np.ndarray: Padded image
        """
        h, w = image.shape[:2]
        ph, pw = int(h * padding_percent), int(w * padding_percent)
        return cv2.copyMakeBorder(image, ph, ph, pw, pw, cv2.BORDER_CONSTANT, value=[0,0,0])

    def _init_dataframe(self):
        """Initialize the internal dataframe by processing all images in the folder"""
        paths = self._get_images_path(self.images_path)
        data = defaultdict(list)
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = [executor.submit(self._process_image, p) for p in paths]
            for f in as_completed(futures):
                for p, emb in f.result():
                    data["image"].append(p)
                    data["embeddings"].append(emb)
        self.dataframe = pd.DataFrame(data)

    @staticmethod
    def _check_path(p):
        """
        Validate that the path is a director
        Args:
            path (str): Path to check

        Returns:
            str: Validated directory path
        """
        if not os.path.isdir(p): 
            raise NotADirectoryError(p)
        return p

    @staticmethod
    def _get_images_path(im_path):
        """
        Collect all image file paths inside a directory recursively
        Args:
            im_path (str): Directory containing images

        Returns:
            list[str]: List of image file paths
        """
        paths = []
        for r, _, fs in os.walk(im_path):
            paths.extend([os.path.join(r, f) for f in fs if f.lower().endswith(('.jpg', '.jpeg', '.png'))])
        return paths

    @staticmethod
    def _check_image_path(p):
        """
        Validate that a given path points to a supported image file

        Args:
            path (str): Path to the image

        Returns:
            str: Validated file path
        """
        if not os.path.isfile(p): 
            raise FileNotFoundError(p)
        return p