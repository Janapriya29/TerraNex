import { Navigate, Route, Routes } from "react-router-dom";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import CropRecommendation from "./pages/CropRecommendation";
import DiseaseDetection from "./pages/DiseaseDetection";
import MarketAnalysis from "./pages/MarketAnalysis";
import History from "./pages/History";


// =====================================
// CHECK LOGIN
// =====================================

function isLoggedIn() {
  const uid = localStorage.getItem("user_id");
  if (!uid || uid === "undefined" || uid === "null" || uid.trim() === "") {
    return false;
  }
  return /^[0-9a-fA-F]{24}$/.test(uid.trim());
}


// =====================================
// PROTECTED ROUTE
// =====================================

function ProtectedRoute({ children }) {
  if (!isLoggedIn()) {
    try {
      localStorage.removeItem("user_id");
      localStorage.removeItem("user_name");
      localStorage.removeItem("user_email");
    } catch {
      // Ignore
    }
    return <Navigate to="/login" replace />;
  }

  return children;
}


// =====================================
// PUBLIC ROUTE
// =====================================

function PublicRoute({ children }) {
  if (isLoggedIn()) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}


// =====================================
// APP
// =====================================

function App() {

  return (
    <Routes>

      {/* =================================
          LANDING PAGE
      ================================= */}

      <Route
        path="/"
        element={<Landing />}
      />


      {/* =================================
          LOGIN
      ================================= */}

      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />


      {/* =================================
          REGISTER
      ================================= */}

      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />


      {/* =================================
          DASHBOARD
      ================================= */}

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />


      {/* =================================
          CROP RECOMMENDATION
      ================================= */}

      <Route
        path="/crop-recommendation"
        element={
          <ProtectedRoute>
            <CropRecommendation />
          </ProtectedRoute>
        }
      />


      {/* =================================
          DISEASE DETECTION
      ================================= */}

      <Route
        path="/disease-detection"
        element={
          <ProtectedRoute>
            <DiseaseDetection />
          </ProtectedRoute>
        }
      />


      {/* =================================
          MARKET ANALYSIS
      ================================= */}

      <Route
        path="/market-analysis"
        element={
          <ProtectedRoute>
            <MarketAnalysis />
          </ProtectedRoute>
        }
      />


      {/* =================================
          HISTORY
      ================================= */}

      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <History />
          </ProtectedRoute>
        }
      />


      {/* =================================
          UNKNOWN PAGE
      ================================= */}

      <Route
        path="*"
        element={
          <Navigate to="/" replace />
        }
      />

    </Routes>
  );
}

export default App;