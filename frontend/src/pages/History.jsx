import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  ArrowLeft,
  Sprout,
  Leaf,
  Bug,
  TrendingUp,
  AlertCircle,
  BarChart3
} from "lucide-react";

import {
  getCropHistory,
  getDiseaseHistory,
  getFullImageUrl
} from "../api";
import { useLanguage } from "../context/LanguageContext";
import LanguageSelector from "../components/common/LanguageSelector";
import "./History.css";

function History() {
  const navigate = useNavigate();
  const {
    t,
    formatCropDisplayName,
    formatDiseaseDisplayName,
    formatSpeciesDisplayName,
    formatStatusDisplayName
  } = useLanguage();

  const [diseaseHistory, setDiseaseHistory] = useState([]);
  const [cropHistory, setCropHistory] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function fetchHistory() {
      try {
        const userId = localStorage.getItem("user_id");

        if (!userId) {
          if (isMounted) {
            setError(t("common.sessionExpired", "Please login again to continue."));
            setLoading(false);
          }
          return;
        }

        const [diseaseData, cropData] = await Promise.all([
          getDiseaseHistory(userId),
          getCropHistory(userId)
        ]);

        if (isMounted) {
          setDiseaseHistory(diseaseData.history || []);
          setCropHistory(cropData.history || []);
        }
      } catch (err) {
        if (isMounted) {
          const msg = err.message || t("history.loadError", "Failed to load history.");
          if (
            msg.toLowerCase().includes("user not found") ||
            msg.toLowerCase().includes("invalid user id")
          ) {
            try {
              localStorage.removeItem("user_id");
              localStorage.removeItem("user_name");
              localStorage.removeItem("user_email");
            } catch {
              // Ignore
            }
            navigate("/login");
          } else {
            setError(msg);
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchHistory();

    return () => {
      isMounted = false;
    };
  }, [t, navigate]);

  const formatDate = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleString();
  };

  return (
    <div className="history-page">

      {/* ================================
          NAVBAR
      ================================= */}

      <nav className="history-navbar">

        <div
          className="history-logo"
          onClick={() => navigate("/dashboard")}
        >
          <Sprout size={28} />
          <span>TerraNex</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <LanguageSelector />

          <button
            className="history-back-btn"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft size={18} />
            <span>{t("common.backToDashboard", "Back to Dashboard")}</span>
          </button>
        </div>

      </nav>


      {/* ================================
          MAIN CONTENT
      ================================= */}

      <main className="history-content">

        {/* Heading */}

        <div className="history-heading">

          <div className="history-heading-icon">
            <Leaf size={30} />
          </div>

          <div>

            <h1>{t("history.pageTitle", "Activity History")}</h1>

            <p>
              {t("history.pageDesc", "Review your past crop recommendations and plant disease detection results.")}
            </p>

          </div>

        </div>


        {/* Loading */}

        {loading && (
          <div className="history-message">
            {t("history.loadingText", "Loading history...")}
          </div>
        )}


        {/* Error */}

        {error && (
          <div className="history-error">
            <AlertCircle size={20} />
            {error}
          </div>
        )}


        {/* ================================
            HISTORY CONTENT
        ================================= */}

        {!loading && !error && (
          <>

            {/* ================================
                DISEASE HISTORY
            ================================= */}

            <section className="history-section">

              <div className="section-title">

                <Bug size={24} />

                <div>

                  <h2>
                    {t("history.diseaseSectionTitle", "Disease Detection History")}
                  </h2>

                  <p>
                    {t("history.diseaseSectionDesc", "Past plant disease scans and diagnostic records.")}
                  </p>

                </div>

              </div>


              {diseaseHistory.length === 0 ? (

                <div className="empty-history">
                  {t("history.diseaseEmptyTitle", "No disease detection history yet.")}
                </div>

              ) : (

                <div className="history-grid">

                  {diseaseHistory.map((item) => (

                    <div
                      className="history-card disease-card"
                      key={item._id}
                    >

                      {/* Disease Image */}

                      {item.image_url && (
                        <img
                          className="history-image"
                          src={getFullImageUrl(item.image_url)}
                          alt="Plant"
                        />
                      )}


                      <div className="history-card-content">

                        {/* Status Badge */}
                        {(() => {
                          const status = item.status || (
                            (item.is_potato_screening || String(item.prediction || "").toLowerCase().includes("potato"))
                              ? "potato_screening"
                              : (item.is_uncertain || Number(item.confidence) < 70 ? "abstained_uncertain_species" : "accepted")
                          );
                          const treatmentPermitted = Boolean(item.treatment_available === true && status === "accepted");

                          const badgeClassMap = {
                            accepted: "h-badge-accepted",
                            potato_screening: "h-badge-potato",
                            rejected_unsupported_species: "h-badge-rejected",
                            abstained_uncertain_species: "h-badge-abstained",
                            cross_stage_discrepancy: "h-badge-discrepancy",
                            model_unavailable: "h-badge-degraded",
                            legacy_record: "h-badge-legacy"
                          };

                          const badgeCls = badgeClassMap[status] || "h-badge-legacy";
                          const badgeText = formatStatusDisplayName(status);

                          return (
                            <>
                              <div className={`history-status-badge ${badgeCls}`}>
                                {badgeText}
                              </div>

                              <h3>
                                {formatDiseaseDisplayName(item.prediction)}
                              </h3>

                              {item.plant_species && (
                                <div className="history-crop-label">
                                  <span>Crop: </span>
                                  <strong>{formatSpeciesDisplayName(item.plant_species)}</strong>
                                </div>
                              )}

                              {/* Confidence */}
                              <div className="confidence">
                                {t("history.confidenceLabel", "AI Confidence")}: <strong>{item.confidence}%</strong>
                              </div>

                              {/* Treatment Safety Indicator */}
                              <div className="history-safety-tags">
                                {treatmentPermitted ? (
                                  <span className="history-treatment-tag permitted">
                                    {t("history.permittedTreatment", "Permitted Treatment")}
                                  </span>
                                ) : (
                                  <span className="history-treatment-tag suppressed">
                                    {t("history.suppressedTreatment", "Chemical Treatment Suppressed")}
                                  </span>
                                )}

                                {item.symptoms_confirmed && (
                                  <span className="history-symptom-tag">
                                    {t("history.confirmedSymptoms", "Confirmed Foliar Symptoms")}
                                  </span>
                                )}
                              </div>
                            </>
                          );
                        })()}

                        {/* Date */}
                        <p className="history-date">
                          {formatDate(item.created_at)}
                        </p>

                      </div>

                    </div>

                  ))}

                </div>

              )}

            </section>


            {/* ================================
                CROP HISTORY
            ================================= */}

            <section className="history-section">

              <div className="section-title">

                <TrendingUp size={24} />

                <div>

                  <h2>
                    {t("history.cropSectionTitle", "Crop Recommendation History")}
                  </h2>

                  <p>
                    {t("history.cropSectionDesc", "Past soil assessments and recommended crops.")}
                  </p>

                </div>

              </div>


              {cropHistory.length === 0 ? (

                <div className="empty-history">
                  {t("history.cropEmptyTitle", "No crop recommendation history yet.")}
                </div>

              ) : (

                <div className="history-grid">

                  {cropHistory.map((item) => (

                    <div
                      className="history-card crop-history-card"
                      key={item._id}
                    >

                      {/* Crop Icon */}

                      <div className="crop-history-icon">
                        <Sprout size={35} />
                      </div>


                      <div className="history-card-content">

                        {/* Best Crop */}

                        <p className="best-label">
                          {t("history.bestCropLabel", "BEST OVERALL CROP")}
                        </p>

                        <h3>
                          {formatCropDisplayName(
                            item.best_overall_crop
                          )}
                        </h3>


                        {/* ================================
                            AI RECOMMENDATIONS
                        ================================= */}

                        <div className="recommendation-history">

                          <h4>
                            {t("history.recommendationsLabel", "AI Recommendations")}
                          </h4>

                          {item.recommendations?.map(
                            (recommendation, index) => (

                              <div
                                className="recommendation-history-row"
                                key={index}
                              >

                                <span>
                                  {formatCropDisplayName(
                                    recommendation.crop
                                  )}
                                </span>

                                <strong>
                                  {recommendation.confidence}%
                                </strong>

                              </div>

                            )
                          )}

                        </div>


                        {/* ================================
                            MARKET ANALYSIS
                        ================================= */}

                        {item.market_analysis?.length > 0 && (

                          <div className="history-market">

                            <div className="history-market-title">

                              <BarChart3 size={18} />

                              <h4>
                                {t("history.marketSummaryTitle", "Market Analysis Summary")}
                              </h4>

                            </div>


                            {item.market_analysis.map(
                              (market, index) => (

                                <div
                                  className="market-history-card"
                                  key={index}
                                >

                                  <div className="market-history-row">

                                    <span>
                                      {t("market.colCrop", "Crop")}
                                    </span>

                                    <strong>
                                      {formatCropDisplayName(
                                        market.crop
                                      )}
                                    </strong>

                                  </div>


                                  <div className="market-history-row">

                                    <span>
                                      {t("market.colMlConfidence", "ML Confidence")}
                                    </span>

                                    <strong>
                                      {market.ml_confidence}%
                                    </strong>

                                  </div>


                                  <div className="market-history-row">

                                    <span>
                                      {t("history.modalPriceLabel", "Modal Market Price")}
                                    </span>

                                    <strong>
                                      ₹{Number(market.average_modal_price).toLocaleString("en-IN")}
                                    </strong>

                                  </div>


                                  <div className="market-history-row">

                                    <span>
                                      {t("market.colMarkets", "Markets Available")}
                                    </span>

                                    <strong>
                                      {market.markets_available}
                                    </strong>

                                  </div>


                                  <div className="market-history-row">

                                    <span>
                                      {t("market.colPriceScore", "Price Score")}
                                    </span>

                                    <strong>
                                      {market.price_score}
                                    </strong>

                                  </div>


                                  <div className="market-history-row profit-row">

                                    <span>
                                      {t("history.profitLabel", "Potential Profit")}
                                    </span>

                                    <strong>
                                      ₹{Number(market.estimated_profit).toLocaleString("en-IN")}
                                    </strong>

                                  </div>

                                </div>

                              )
                            )}

                          </div>

                        )}


                        {/* ================================
                            DATE
                        ================================= */}

                        <p className="history-date">
                          {formatDate(item.created_at)}
                        </p>

                      </div>

                    </div>

                  ))}

                </div>

              )}

            </section>

          </>
        )}

      </main>

    </div>
  );
}

export default History;