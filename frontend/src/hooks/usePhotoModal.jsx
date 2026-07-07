import { useCallback, useState } from "react";

export default function usePhotoModal() {
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const openPhotoModal = useCallback((photo) => {
    setSelectedPhoto(photo);
  }, []);

  const closePhotoModal = useCallback(() => {
    setSelectedPhoto(null);
  }, []);

  return {
    selectedPhoto,
    isPhotoModalOpen: Boolean(selectedPhoto),
    openPhotoModal,
    closePhotoModal,
  };
}
