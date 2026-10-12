import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  ArrowLeft,
  Sprout,
  Leaf,
  Bug,
  TrendingUp,
  AlertCircle,
  IndianRupee,
  BarChart3
} from "lucide-react";

import "./History.css";

const API_BASE_URL = "https://agrivoice-e14c.onrender.com";

function History() {
  const navigate = useNavigate();

  const [diseaseHistory, setDiseaseHistory] = useState([]);
  const [cropHistory, setCropHistory] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError("");

      const userId = localStorage.getItem("user_id");

      if (!userId) {
        setError("Please login again.");
        setLoading(false);
        return;
      }

      // ================================
      // DISEASE HISTORY
      // ================================

      const diseaseResponse = await fetch(
        `${API_BASE_URL}/disease/history/${userId}`
      );

      const diseaseData = await diseaseResponse.json();

      if (!diseaseResponse.ok) {
        throw new Error(
          diseaseData.detail || "Failed to load disease history"
        );
      }

      // ================================
      // CROP HISTORY
      // ================================

      const cropResponse = await fetch(
        `${API_BASE_URL}/crop/history/${userId}`
      );

      const cropData = await cropResponse.json();

      if (!cropResponse.ok) {
        throw new Error(
          cropData.detail || "Failed to load crop history"
        );
      }

      setDiseaseHistory(diseaseData.history || []);
      setCropHistory(cropData.history || []);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return "";

    return new Date(date).toLocaleString();
  };

  const formatCropName = (crop) => {
    if (!crop) return "";

    return crop
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
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

        <button
          className="history-back-btn"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>

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

            <h1>My History</h1>

            <p>
              View your previous disease predictions
              and crop recommendations.
            </p>

          </div>

        </div>


        {/* Loading */}

        {loading && (
          <div className="history-message">
            Loading your history...
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
                    Disease Prediction History
                  </h2>

                  <p>
                    Your previous plant disease detections
                  </p>

                </div>

              </div>


              {diseaseHistory.length === 0 ? (

                <div className="empty-history">
                  No disease predictions yet.
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
                          src={item.image_url}
                          alt="Plant"
                        />
                      )}


                      <div className="history-card-content">

                        <h3>
                          {item.prediction}
                        </h3>


                        {/* Confidence */}

                        <div className="confidence">

                          Confidence:

                          <strong>
                            {item.confidence}%
                          </strong>

                        </div>


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
                    Crop Recommendation History
                  </h2>

                  <p>
                    Your previous AI crop recommendations
                  </p>

                </div>

              </div>


              {cropHistory.length === 0 ? (

                <div className="empty-history">
                  No crop recommendations yet.
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
                          BEST OVERALL CROP
                        </p>

                        <h3>
                          {formatCropName(
                            item.best_overall_crop
                          )}
                        </h3>


                        {/* ================================
                            AI RECOMMENDATIONS
                        ================================= */}

                        <div className="recommendation-history">

                          <h4>
                            AI Recommended Crops
                          </h4>

                          {item.recommendations?.map(
                            (recommendation, index) => (

                              <div
                                className="recommendation-history-row"
                                key={index}
                              >

                                <span>
                                  {formatCropName(
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
                                Market Analysis
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
                                      Crop
                                    </span>

                                    <strong>
                                      {formatCropName(
                                        market.crop
                                      )}
                                    </strong>

                                  </div>


                                  <div className="market-history-row">

                                    <span>
                                      ML Confidence
                                    </span>

                                    <strong>
                                      {market.ml_confidence}%
                                    </strong>

                                  </div>


                                  <div className="market-history-row">

                                    <span>
                                      Market Price
                                    </span>

                                    <strong>
                                      ₹{market.average_modal_price}
                                    </strong>

                                  </div>


                                  <div className="market-history-row">

                                    <span>
                                      Markets Available
                                    </span>

                                    <strong>
                                      {market.markets_available}
                                    </strong>

                                  </div>


                                  <div className="market-history-row">

                                    <span>
                                      Price Score
                                    </span>

                                    <strong>
                                      {market.price_score}
                                    </strong>

                                  </div>


                                  <div className="market-history-row profit-row">

                                    <span>
                                      Estimated Profit
                                    </span>

                                    <strong>
                                      ₹{market.estimated_profit}
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