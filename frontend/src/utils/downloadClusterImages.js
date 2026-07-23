import JSZip from "jszip";

function sanitizeName(value) {
  return String(value || "cluster")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

export async function downloadClusterImages(cluster) {
  if (!cluster || !Array.isArray(cluster.photos) || cluster.photos.length === 0) {
    throw new Error("Aucune image à télécharger pour ce cluster.");
  }

  const zip = new JSZip();
  const folderName = sanitizeName(cluster.theme || cluster.id || "cluster");
  const folder = zip.folder(folderName);

  await Promise.all(
    cluster.photos.map(async (photo, index) => {
      const response = await fetch(photo.url);
      if (!response.ok) {
        throw new Error("Impossible de télécharger une image du cluster.");
      }
      const blob = await response.blob();
      const extension = blob.type?.split("/")[1] || "jpg";
      const fileName = sanitizeName(photo.id || photo.caption || `photo-${index + 1}`);
      folder.file(`${fileName}.${extension}`, blob);
    })
  );

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${folderName}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
