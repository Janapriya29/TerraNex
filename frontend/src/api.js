export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL !== undefined
    ? import.meta.env.VITE_API_BASE_URL
    : "";

// Helper to safely extract error message from response data
function parseErrorMessage(data, defaultError, status) {
  if (!data) return defaultError || `Request failed with status ${status}`;
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail.map((err) => err.msg || JSON.stringify(err)).join(", ");
  }
  if (typeof data.detail === "object" && data.detail !== null) {
    return data.detail.message || JSON.stringify(data.detail);
  }
  if (typeof data.message === "string") return data.message;
  return defaultError || `Request failed with status ${status}`;
}

// Helper to safely parse JSON response or surface clear errors
async function handleResponse(response, defaultError) {
  let data = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON response
  }

  if (!response.ok) {
    const detail = parseErrorMessage(data, defaultError, response.status);

    // Auto-clear invalid session on 401 or user not found
    if (
      response.status === 401 ||
      (response.status === 404 && typeof detail === "string" && detail.toLowerCase().includes("user not found")) ||
      (response.status === 400 && typeof detail === "string" && detail.toLowerCase().includes("invalid user id"))
    ) {
      try {
        localStorage.removeItem("user_id");
        localStorage.removeItem("user_name");
        localStorage.removeItem("user_email");
      } catch {
        // Ignore if localStorage unavailable
      }
    }

    throw new Error(detail);
  }

  return data;
}

// Register User
export async function registerUser(name, email, password) {
  const response = await fetch(`${API_BASE_URL}/users/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      email,
      password,
    }),
  });

  return handleResponse(response, "Registration failed");
}

// Login User
export async function loginUser(email, password) {
  const response = await fetch(`${API_BASE_URL}/users/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  return handleResponse(response, "Login failed");
}

// Plant Disease Prediction
export async function predictDisease(
  userId,
  imageFile,
  confirmedSymptoms = false,
  checklist = null
) {
  const formData = new FormData();

  formData.append("user_id", userId);
  formData.append("file", imageFile);
  if (confirmedSymptoms) {
    formData.append("confirmed_symptoms", "true");
  }
  if (checklist) {
    formData.append("checklist", JSON.stringify(checklist));
  }

  const response = await fetch(`${API_BASE_URL}/disease/predict`, {
    method: "POST",
    body: formData,
  });

  return handleResponse(response, "Disease prediction failed");
}

// Crop Recommendation + Market Analysis
export async function recommendCrop(userId, cropData) {
  const response = await fetch(`${API_BASE_URL}/crop/recommend-with-market`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId,
      ...cropData,
    }),
  });

  return handleResponse(response, "Crop recommendation failed");
}

// Get Crop Recommendation History
export async function getCropHistory(userId) {
  const response = await fetch(`${API_BASE_URL}/crop/history/${userId}`);
  return handleResponse(response, "Failed to load crop history");
}

// Get Disease Prediction History
export async function getDiseaseHistory(userId) {
  const response = await fetch(`${API_BASE_URL}/disease/history/${userId}`);
  return handleResponse(response, "Failed to load disease history");
}

// Resolve Full Image URL for Display
export function getFullImageUrl(imageUrl) {
  if (!imageUrl) return "";

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    try {
      const parsed = new URL(imageUrl);
      if (
        parsed.hostname.includes("onrender.com") &&
        API_BASE_URL &&
        !API_BASE_URL.includes("onrender.com")
      ) {
        return `${API_BASE_URL}${parsed.pathname}`;
      }
    } catch {
      // Keep original url if parsing fails
    }
    return imageUrl;
  }

  const prefix = API_BASE_URL || "";
  return `${prefix}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
}
