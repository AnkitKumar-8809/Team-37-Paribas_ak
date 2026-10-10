const API_BASE =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

export async function getRejections() {
  const response = await fetch(
    `${API_BASE}/resolutions`
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message ||
        "Failed to fetch rejected records"
    );
  }

  return result.data;
}