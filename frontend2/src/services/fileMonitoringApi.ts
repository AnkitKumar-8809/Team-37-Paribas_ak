const API_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export async function fetchProcessingFiles() {
  const response = await fetch(`${API_BASE}/files`);

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message || "Failed to fetch processing files"
    );
  }

  return result.data;
}

export async function uploadProcessingFile(file: File) {
  const formData = new FormData();

  formData.append("file", file);

  const response = await fetch(`${API_BASE}/files/upload`, {
    method: "POST",
    body: formData,
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message || `Failed to upload ${file.name}`
    );
  }

  return result.data;
}