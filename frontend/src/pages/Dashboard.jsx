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
  ArrowRight,
  Sun,
  Moon
} from "lucide-react";

import { getCropHistory, getDiseaseHistory } from "../api";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import LanguageSelector from "../components/common/LanguageSelector";
import "./Dashboard.css";

function Dashboard() {
  const navigate = useNavigate();
  const { t, formatCropDisplayName, formatDiseaseDisplayName } = useLanguage();
  const { isDark, toggleTheme } = useTheme();

  const [recentActivity, setRecentActivity] = useState([]);

  const userName = localStorage.getItem("user_name") || t("common.farmer", "Farmer");

  useEffect(() => {
    const userId = localStorage.getItem("user_id");

    if (!userId) return;

    async function fetchRecentActivity() {
      try {
        const [cropData, diseaseData] = await Promise.all([
          getCropHistory(userId),
          getDiseaseHistory(userId)
        ]);

        const activities = [];

        // Latest Crop Recommendation
        if (
          cropData.history &&
          cropData.history.length > 0
        ) {
          const latestCrop = cropData.history[0];

          activities.push({
            type: "crop",
            rawCrop: latestCrop.best_overall_crop,
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
            rawDisease: latestDisease.prediction,
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
        if (
          error.message?.toLowerCase().includes("user not found") ||
          error.message?.toLowerCase().includes("invalid user id")
        ) {
          try {
            localStorage.removeItem("user_id");
            localStorage.removeItem("user_name");
            localStorage.removeItem("user_email");
          } catch {
            // Ignore
          }
          navigate("/login");
        }
      }
    }

    fetchRecentActivity();
  }, [navigate]);

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

        <div className="dashboard-logo" onClick={() => navigate("/dashboard")}>
          <Sprout size={30} />
          <span>TerraNex</span>
        </div>

        <div className="dashboard-user">

          <LanguageSelector />

          <button
            type="button"
            className="logout-btn"
            style={{ padding: "8px 12px" }}
            onClick={toggleTheme}
            aria-label="Toggle Theme"
            title={isDark ? t("nav.themeLight", "Switch to light mode") : t("nav.themeDark", "Switch to dark mode")}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className="user-info">
            <User size={20} />
            <span>{userName}</span>
          </div>

          <button
            className="logout-btn"
            onClick={handleLogout}
          >
            <LogOut size={18} />
            {t("dashboard.logout", "Logout")}
          </button>

        </div>

      </nav>

      {/* Main Content */}
      <main className="dashboard-content">

        {/* Welcome Section */}
        <section className="welcome-section">

          <div>

            <p className="welcome-small">
              {t("dashboard.welcomeBadge", "SMART FARMING DASHBOARD")}
            </p>

            <h1>
              {t("dashboard.welcomeTitle", "Welcome back")}, <span>{userName}</span> 👋
            </h1>

            <p>
              {t("dashboard.welcomeDesc", "Use AI-powered tools to make better decisions for your crops and farming activities.")}
            </p>

          </div>

          <div className="welcome-icon">
            <Sprout size={65} />
          </div>

        </section>

        {/* Dashboard Heading */}
        <h2 className="dashboard-heading">
          {t("dashboard.sectionHeading", "What would you like to do?")}
        </h2>

        {/* Dashboard Cards */}
        <section className="dashboard-grid">

          {/* Crop Recommendation */}
          <div className="dashboard-card">

            <div className="dashboard-card-icon crop-icon">
              <Leaf size={32} />
            </div>

            <h3>{t("dashboard.cropCardTitle", "Crop Recommendation")}</h3>

            <p>
              {t("dashboard.cropCardDesc", "Find the most suitable crops based on soil nutrients, weather and environmental conditions.")}
            </p>

            <button
              onClick={() =>
                navigate("/crop-recommendation")
              }
              className="dashboard-action-btn"
            >
              {t("dashboard.cropCardBtn", "Get Recommendation")}
              <ArrowRight size={18} />
            </button>

          </div>

          {/* Disease Detection */}
          <div className="dashboard-card">

            <div className="dashboard-card-icon disease-icon">
              <ScanLine size={32} />
            </div>

            <h3>{t("dashboard.diseaseCardTitle", "Disease Detection")}</h3>

            <p>
              {t("dashboard.diseaseCardDesc", "Upload a crop or plant leaf image and let AI identify possible diseases.")}
            </p>

            <button
              onClick={() =>
                navigate("/disease-detection")
              }
              className="dashboard-action-btn"
            >
              {t("dashboard.diseaseCardBtn", "Detect Disease")}
              <ArrowRight size={18} />
            </button>

          </div>

          {/* Market Analysis */}
          <div className="dashboard-card">

            <div className="dashboard-card-icon market-icon">
              <TrendingUp size={32} />
            </div>

            <h3>{t("dashboard.marketCardTitle", "Market Analysis")}</h3>

            <p>
              {t("dashboard.marketCardDesc", "View market prices, cost estimates and profitability for recommended crops.")}
            </p>

            <button
              onClick={() =>
                navigate("/market-analysis")
              }
              className="dashboard-action-btn"
            >
              {t("dashboard.marketCardBtn", "View Market Analysis")}
              <ArrowRight size={18} />
            </button>

          </div>

          {/* History */}
          <div className="dashboard-card">

            <div className="dashboard-card-icon history-icon">
              <History size={32} />
            </div>

            <h3>{t("dashboard.historyCardTitle", "History & Records")}</h3>

            <p>
              {t("dashboard.historyCardDesc", "Review your previous crop recommendations and disease detection results.")}
            </p>

            <button
              onClick={() =>
                navigate("/history")
              }
              className="dashboard-action-btn"
            >
              {t("dashboard.historyCardBtn", "View History")}
              <ArrowRight size={18} />
            </button>

          </div>

        </section>

        {/* Recent Activity */}
        <section className="recent-activity">

          <div className="recent-activity-header">

            <div>

              <p className="welcome-small">
                {t("dashboard.welcomeBadge", "YOUR ACTIVITY")}
              </p>

              <h2>{t("dashboard.recentActivityTitle", "Recent Activity")}</h2>

            </div>

            <button
              className="view-history-btn"
              onClick={() =>
                navigate("/history")
              }
            >
              {t("dashboard.viewAllBtn", "View All")}
              <ArrowRight size={17} />
            </button>

          </div>

          {/* No Activity */}
          {recentActivity.length === 0 ? (

            <div className="activity-empty">

              <History size={28} />

              <div>

                <h3>{t("dashboard.emptyActivityTitle", "No activity yet")}</h3>

                <p>
                  {t("dashboard.emptyActivityDesc", "Start by getting a crop recommendation or scanning a plant leaf for disease.")}
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
                        {activity.type === "crop"
                          ? t("dashboard.activityCropTitle", "Crop Recommendation")
                          : t("dashboard.activityDiseaseTitle", "Disease Detection")}
                      </h3>

                      <p>
                        {activity.type === "crop"
                          ? `${t("dashboard.activityCropBest", "Best crop")}: ${formatCropDisplayName(activity.rawCrop)}`
                          : `${formatDiseaseDisplayName(activity.rawDisease)} ${t("dashboard.activityDiseaseDetected", "detected")}`}
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