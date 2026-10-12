import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Sprout,
  Leaf,
  ScanLine,
  TrendingUp,
  History,
  LogOut,
  User,
  ArrowRight
} from "lucide-react";

import "./Dashboard.css";

const API_BASE_URL = "https://agrivoice-e14c.onrender.com";

function Dashboard() {
  const navigate = useNavigate();

  const [recentActivity, setRecentActivity] = useState([]);

  const userName = localStorage.getItem("user_name") || "Farmer";

  useEffect(() => {
    const userId = localStorage.getItem("user_id");

    if (!userId) return;

    async function fetchRecentActivity() {
      try {
        const [cropResponse, diseaseResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/crop/history/${userId}`),
          fetch(`${API_BASE_URL}/disease/history/${userId}`)
        ]);

        const cropData = await cropResponse.json();
        const diseaseData = await diseaseResponse.json();

        if (!cropResponse.ok) {
          throw new Error(
            cropData.detail || "Failed to fetch crop history"
          );
        }

        if (!diseaseResponse.ok) {
          throw new Error(
            diseaseData.detail || "Failed to fetch disease history"
          );
        }

        const activities = [];

        // Latest Crop Recommendation
        if (
          cropData.history &&
          cropData.history.length > 0
        ) {
          const latestCrop = cropData.history[0];

          activities.push({
            type: "crop",
            title: "Crop Recommendation",
            description: `Best crop: ${latestCrop.best_overall_crop}`,
            date: latestCrop.created_at
          });
        }

        // Latest Disease Detection
        if (
          diseaseData.history &&
          diseaseData.history.length > 0
        ) {
          const latestDisease = diseaseData.history[0];

          activities.push({
            type: "disease",
            title: "Disease Detection",
            description: `${latestDisease.prediction} detected`,
            date: latestDisease.created_at
          });
        }

        // Sort newest activity first
        activities.sort(
          (a, b) =>
            new Date(b.date) - new Date(a.date)
        );

        // Show only latest 3 activities
        setRecentActivity(
          activities.slice(0, 3)
        );

      } catch (error) {
        console.error(
          "Failed to fetch recent activity:",
          error
        );
      }
    }

    fetchRecentActivity();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user_id");
    localStorage.removeItem("user_name");
    localStorage.removeItem("user_email");

    navigate("/");
  };

  return (
    <div className="dashboard-page">

      {/* Navbar */}
      <nav className="dashboard-navbar">

        <div className="dashboard-logo">
          <Sprout size={30} />
          <span>TerraNex</span>
        </div>

        <div className="dashboard-user">

          <div className="user-info">
            <User size={20} />
            <span>{userName}</span>
          </div>

          <button
            className="logout-btn"
            onClick={handleLogout}
          >
            <LogOut size={18} />
            Logout
          </button>

        </div>

      </nav>

      {/* Main Content */}
      <main className="dashboard-content">

        {/* Welcome Section */}
        <section className="welcome-section">

          <div>

            <p className="welcome-small">
              SMART FARMING DASHBOARD
            </p>

            <h1>
              Welcome back, <span>{userName}</span> 👋
            </h1>

            <p>
              Use AI-powered tools to make better decisions
              for your crops and farming activities.
            </p>

          </div>

          <div className="welcome-icon">
            <Sprout size={65} />
          </div>

        </section>

        {/* Dashboard Heading */}
        <h2 className="dashboard-heading">
          What would you like to do?
        </h2>

        {/* Dashboard Cards */}
        <section className="dashboard-grid">

          {/* Crop Recommendation */}
          <div className="dashboard-card">

            <div className="dashboard-card-icon crop-icon">
              <Leaf size={32} />
            </div>

            <h3>Crop Recommendation</h3>

            <p>
              Find the most suitable crops based on soil
              nutrients, weather and environmental conditions.
            </p>

            <button
              onClick={() =>
                navigate("/crop-recommendation")
              }
              className="dashboard-action-btn"
            >
              Get Recommendation
              <ArrowRight size={18} />
            </button>

          </div>

          {/* Disease Detection */}
          <div className="dashboard-card">

            <div className="dashboard-card-icon disease-icon">
              <ScanLine size={32} />
            </div>

            <h3>Disease Detection</h3>

            <p>
              Upload a crop or plant leaf image and let AI
              identify possible diseases.
            </p>

            <button
              onClick={() =>
                navigate("/disease-detection")
              }
              className="dashboard-action-btn"
            >
              Detect Disease
              <ArrowRight size={18} />
            </button>

          </div>

          {/* Market Analysis */}
          <div className="dashboard-card">

            <div className="dashboard-card-icon market-icon">
              <TrendingUp size={32} />
            </div>

            <h3>Market Analysis</h3>

            <p>
              Analyze crop recommendations with market
              prices and estimated profit opportunities.
            </p>

            <button
              onClick={() =>
                navigate("/market-analysis")
              }
              className="dashboard-action-btn"
            >
              Analyze Market
              <ArrowRight size={18} />
            </button>

          </div>

          {/* History */}
          <div className="dashboard-card">

            <div className="dashboard-card-icon history-icon">
              <History size={32} />
            </div>

            <h3>My History</h3>

            <p>
              View your previous disease predictions and
              crop recommendations.
            </p>

            <button
              onClick={() =>
                navigate("/history")
              }
              className="dashboard-action-btn"
            >
              View History
              <ArrowRight size={18} />
            </button>

          </div>

        </section>

        {/* Recent Activity */}
        <section className="recent-activity">

          <div className="recent-activity-header">

            <div>

              <p className="welcome-small">
                YOUR ACTIVITY
              </p>

              <h2>Recent Activity</h2>

            </div>

            <button
              className="view-history-btn"
              onClick={() =>
                navigate("/history")
              }
            >
              View All
              <ArrowRight size={17} />
            </button>

          </div>

          {/* No Activity */}
          {recentActivity.length === 0 ? (

            <div className="activity-empty">

              <History size={28} />

              <div>

                <h3>No recent activity</h3>

                <p>
                  Your crop recommendations and disease
                  detection history will appear here.
                </p>

              </div>

            </div>

          ) : (

            /* Activity List */
            <div className="activity-list">

              {recentActivity.map(
                (activity, index) => (

                  <div
                    className="activity-item"
                    key={index}
                    onClick={() =>
                      navigate(
                        activity.type === "crop"
                          ? "/crop-recommendation"
                          : "/disease-detection"
                      )
                    }
                  >

                    <div className="activity-icon">

                      {activity.type === "crop" ? (
                        <Leaf size={22} />
                      ) : (
                        <ScanLine size={22} />
                      )}

                    </div>

                    <div className="activity-details">

                      <h3>
                        {activity.title}
                      </h3>

                      <p>
                        {activity.description}
                      </p>

                      {activity.date && (
                        <span className="activity-date">
                          {new Date(
                            activity.date
                          ).toLocaleString()}
                        </span>
                      )}

                    </div>

                  </div>

                )
              )}

            </div>

          )}

        </section>

      </main>

    </div>
  );
}

export default Dashboard;