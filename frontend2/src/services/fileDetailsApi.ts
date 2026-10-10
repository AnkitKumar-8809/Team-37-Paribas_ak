const API_BASE =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

export async function getFiles() {
  const response = await fetch(`${API_BASE}/files`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message || "Failed to fetch files"
    );
  }

  return result.data;
}

export async function getFileDetails(id: string) {
  const response = await fetch(
    `${API_BASE}/files/${id}`
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message || "Failed to fetch file details"
    );
  }

  return result.data;
}