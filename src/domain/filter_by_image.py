import os

import cv2
import numpy as np
import pandas as pd
from sklearn.preprocessing import normalize

from collections import defaultdict, Counter

from concurrent.futures import ThreadPoolExecutor, as_completed

import faiss
from qdrant_client import models

from ..config import IM_SIZE, VECTOR_DIM, MAX_WORKERS
from ..client import client, app


class FilterByImage:
    """Manage face-based filtering on an image dataset using InsightFace and Qdrant"""
    def __init__(self, folder_name: str, images_path: str, im_size = IM_SIZE, vec_dim = VECTOR_DIM, max_workers= MAX_WORKERS):
        """Initialize the manager, load images, extract embeddings, cluster them, and create a vector store"""

        self.folder_name = folder_name
        self.col_name = f"faces_{self.folder_name}"
        self.images_path = FilterByImage._check_path(images_path) 

        self.client = client
        self.max_workers = max_workers
        self.vec_dim = vec_dim
        
        self.app = app
        self.app.prepare(ctx_id=0, det_size= im_size) 
        

        self._df = pd.DataFrame(columns=["image", "embeddings"])
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
        if type(new_df) == pd.core.frame.DataFrame:
            self._df = new_df


    def _upload_ref_count(self):
        """Compute a reference value used to decide when reclustering is required"""
        return self._df.shape[0]* (not self._df.empty)+10*(self._df.empty)
    
    
    @staticmethod
    def _check_path(path: str):
        """
        Validate that the path exists and is a director
        Args:
            path (str): Path to check

        Returns:
            str: Validated directory path
        """
        if not os.path.exists(path):
            raise FileNotFoundError(f"Path not found: '{path}'")

        if not os.path.isdir(path):
            raise NotADirectoryError(f"Path is not a directory: '{path}'")

        return path

        
    @staticmethod
    def _get_images_path(im_path: str):
        """
        Collect all image file paths inside a directory recursively
        Args:
            im_path (str): Directory containing images

        Returns:
            list[str]: List of image file paths
        """
        paths = []
        for dir, _, files_name in os.walk(im_path):
            paths.extend([dir+"\\"+file for file in files_name])
        return paths
    

    @staticmethod
    def _fast_imread(path: str):
        """
        Fast image loading using binary buffer decoding
        Args:
            path (str): Path to the image

        Returns:
            np.ndarray: Loaded image as a numpy array
        """
        with open(path, "rb") as f:
            arr = np.frombuffer(f.read(), dtype=np.uint8)
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)

    @staticmethod
    def _add_padding(image: np.ndarray, padding_percent: float = 0.4):
        """
        Add zero-padding around an image
        Args:
            image (np.ndarray): Input image
            padding_percent (float, optional): Fraction of image size to pad. Defaults to 0.4

        Returns:
            np.ndarray: Padded image
        """
        h, w = image.shape[:2]
        pad_h = int(h * padding_percent)
        pad_w = int(w * padding_percent)
        
        padded = cv2.copyMakeBorder(
            image, 
            pad_h, pad_h, pad_w, pad_w,
            cv2.BORDER_CONSTANT,
            value=[0, 0, 0]  
        )
        return padded


    def _process_image(self, path: str):
        """
        Read an image, detect faces, and return embeddings
        Args:
            path (str): Path to the image

        Returns:
            list[tuple]: List of tuples (image_path, embedding)
        """
        img = FilterByImage._fast_imread(path)
       
        im_padded = FilterByImage._add_padding(img, padding_percent=0.4)
        faces = self.app.get(im_padded)
        
        results = []
        for face in faces:
            results.append((path, face.embedding))
        return results
      

    def _init_dataframe(self):
        """Initialize the internal dataframe by processing all images in the folder"""
        paths = FilterByImage._get_images_path(self.images_path)
        data = defaultdict(list)
        with ThreadPoolExecutor(max_workers= self.max_workers) as executor:
            futures = [executor.submit(self._process_image, path) for path in paths]
            for future in as_completed(futures):
                for path, embedding in future.result():
                    data["image"].append(path)
                    data["embeddings"].append(embedding)

        self.dataframe = pd.DataFrame(data)


    def _init_vector_store(self):
        """Create or reset the Qdrant collection and upload vectors"""
        df = self.dataframe
        
        self.client.delete_collection(collection_name=self.col_name)
        
        self.client.create_collection(
        collection_name=self.col_name,
        vectors_config= models.VectorParams(size = self.vec_dim, distance = models.Distance.COSINE, on_disk=True))
        
        if not df.empty:
            points = [models.PointStruct(id= row[0], vector= row[1]["embeddings"], payload= {"image": row[1]["image"], "person_id": row[1]["person_id"]}) for row in df.iterrows()]

            self.client.upsert(
                collection_name= self.col_name,
                points = points
            )

    def _create_clusters(self):
        """Cluster embeddings using cosine similarity and union-find"""
        df = self.dataframe

        if not df.empty:

            df = df.loc[:, ["image", "embeddings"]].reset_index(drop = True)

            X = np.vstack(df["embeddings"].to_numpy())
            X_norm = normalize(X).astype('float32')

            n_samples, dim = X_norm.shape

            index = faiss.IndexFlatIP(dim)  
            index.add(X_norm)

            similarity_threshold = 0.6
            k_neighbors = 50

            D, I = index.search(X_norm, k_neighbors)

            edges = []
            for i in range(n_samples):
                for j, sim in zip(I[i], D[i]):
                    if i != j and sim >= similarity_threshold:
                        edges.append((i, j))

            parent = list(range(n_samples))

            def find(x):
                if parent[x] != x:
                    parent[x] = find(parent[x])
                return parent[x]

            def union(x, y):
                px, py = find(x), find(y)
                if px != py:
                    parent[px] = py


            for i, j in edges:
                union(i, j)


            cluster_map = {}
            labels = np.zeros(n_samples, dtype=int)
            current_cluster = 0

            for i in range(n_samples):
                root = find(i)
                if root not in cluster_map:
                    cluster_map[root] = current_cluster
                    current_cluster += 1
                labels[i] = cluster_map[root]


            df["person_id"] = labels
            
            df = df.drop_duplicates(subset=["image", "person_id"])
            self.dataframe = df

        else:
            self.dataframe = pd.DataFrame(columns=["image", "embeddings", "person_id"])

    @staticmethod
    def _check_image_path(path: str):
        """
        Validate that a given path points to a supported image file

        Args:
            path (str): Path to the image

        Returns:
            str: Validated file path
        """
        if not os.path.isfile(path):
            raise FileNotFoundError(f"Path is not a file: {path}")

        if os.path.splitext(path)[1].lower() not in [".jpg", ".jpeg", ".png"]:
            raise ValueError(f"Unsupported file extension: {path}")

        return path
    
    
    def prediction(self, image_path: str):
        """
        Query the vector store using the embedding of a face from an input image

        Args:
            image_path (str): Path to the query image

        Returns:
            QueryResult: Qdrant query result containing nearest points
        """

        ipt_img = cv2.imread(FilterByImage._check_image_path(image_path))
        if ipt_img is None:
            return None
        
        ipt_faces = self.app.get(FilterByImage._add_padding(ipt_img))

        img_embed = ipt_faces[0].embedding

        res = self.client.query_points(
            collection_name= self.col_name,
            query = img_embed,
            limit = 50
            )
        return res 
    
    def filter_df(self, image_path: str, df = None):
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

        threshold = 0.6
        D = [point for point in res.points if point.score >threshold]
        
        if D and isinstance(df, pd.core.frame.DataFrame):
            class_lst = [cla.payload["person_id"] for cla in D]

            pred = max(Counter(class_lst).items(), key = lambda x: x[1])[0]
            df_filter = df[df["person_id"] == pred]
            
            return df_filter.drop_duplicates(subset=["image", "person_id"])
        else:
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
            if self._check_image_path(path):
                res = self.filter_df(path)["image"].drop_duplicates().tolist()
                output.extend(res)

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
            if self._check_image_path(path):
                filter_images = self.filter_df(path, df)["image"].drop_duplicates().tolist()
                df = df[df["image"].isin(filter_images)]

        if isinstance(df, pd.core.frame.DataFrame):
            return df["image"].drop_duplicates().tolist()
        else:
            return []
        

    def _check_clustering(self, p: float = 0.5):
        """
        Determine if reclustering should be triggered based on accumulated updates

        Args:
            p (float, optional): Fraction threshold of actions to reference count. Defaults to 0.5

        Returns:
            bool: True if reclustering should be triggered
        """
        if (self.count_actions > p* self.reference_count) and self.reference_count>=10:
            return True
        else:
            return False

    def _reset_clusters(self):
        """Recompute clusters and reinitialize the vector store"""
        self._create_clusters()
        self._init_vector_store()
        self.count_actions = 0
        self.reference_count = self._upload_ref_count()


    def add_image(self, path):
        """
        Add a single image to the dataset, assign identity, and update the vector store

        Args:
            path (str): Path to the image to add
        """
        if self._check_image_path(path):

            df = self.dataframe
            load_img = self._fast_imread(path)
            faces = self.app.get(load_img)
            self.count_actions+=len(faces)
            
            if self._check_clustering():
                for face in faces:
                    df.loc[df.shape[0]] = [path, face.embedding, 0] 
                    
                self.dataframe = df
                print("RESET CLUSTERING...")
                self._reset_clusters()
                
            else:
                for face in faces:
                    res = self.client.query_points(collection_name= self.col_name, query = face.embedding, limit = 50)
                    threshold = 0.6
                    D = [point for point in res.points if point.score >threshold]
                    if D:
                        class_lst = [cla.payload["person_id"] for cla in D]
                        pred = max(Counter(class_lst).items(), key = lambda x: x[1])[0]
                    else:
                        if df.empty:
                            pred = 0
                        else:
                            pred = max(df["person_id"])+1
        
                    new_row = pd.DataFrame({
                        'image': [path],
                        'embeddings': [face.embedding],  
                        'person_id': [pred]
                    })
                    df = pd.concat([df, new_row], ignore_index=True)
                    self.client.upsert(collection_name= self.col_name, points=[models.PointStruct(id= max(df.index)+1, vector= face.embedding, payload= {"image": path, "person_id": pred})])
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
            if self._check_image_path(path):
                del_index = df[df["image"] == path].index.tolist()
                if del_index:
                    df = df.drop(index= del_index)
                    self.client.delete(collection_name= self.col_name, points_selector= del_index)
                    print(f"The following image has been removed from the folder '{self.folder_name}' : "+ ", ".join(paths))
                    del_images.append(path)
                    
        
        self.reference_count = self._upload_ref_count()
        if isinstance(df, pd.core.frame.DataFrame):
            self.dataframe = df  
        else:
            self.dataframe = pd.DataFrame(columns=["image", "embeddings", "person_id"])
        return f"The following image has been removed from the folder '{self.folder_name}' : "+ ", ".join(del_images)