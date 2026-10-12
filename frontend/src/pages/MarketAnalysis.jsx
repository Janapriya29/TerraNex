import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  ArrowLeft,
  Sprout,
  TrendingUp,
  IndianRupee,
  BarChart3,
  Wallet,
  AlertCircle,
  CheckCircle
} from "lucide-react";

import "./MarketAnalysis.css";

const API_BASE_URL = "https://agrivoice-e14c.onrender.com";

function MarketAnalysis() {
  const navigate = useNavigate();

  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadMarketAnalysis();
  }, []);

  const loadMarketAnalysis = async () => {
    try {
      setLoading(true);
      setError("");

      const userId = localStorage.getItem("user_id");

      console.log("Market Analysis User ID:", userId);

      if (!userId) {
        setError("Please login again.");
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/crop/history/${userId}`
      );

      console.log("Market API status:", response.status);

      const data = await response.json();

      console.log("Market API data:", data);

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to load market analysis."
        );
      }

      if (!data.history || data.history.length === 0) {
        setError(
          "No crop recommendation available. Please get a crop recommendation first."
        );
        return;
      }

      // Latest recommendation
      const latest = data.history[0];

      // Make sure market analysis exists
      if (
        !latest.market_analysis ||
        latest.market_analysis.length === 0
      ) {
        setError(
          "No market analysis data available for the latest recommendation."
        );
        return;
      }

      setMarketData(latest);

    } catch (err) {
      console.error("Market Analysis Error:", err);
      setError(err.message || "Failed to load market analysis.");
    } finally {
      setLoading(false);
    }
  };

  const formatCropName = (crop) => {
    if (!crop) return "";

    return crop
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  const formatMoney = (value) => {
    if (value === undefined || value === null) {
      return "₹0";
    }

    return `₹${Number(value).toLocaleString("en-IN")}`;
  };

  return (
    <div className="market-page">

      {/* NAVBAR */}
      <nav className="market-navbar">

        <div
          className="market-logo"
          onClick={() => navigate("/dashboard")}
        >
          <Sprout size={28} />
          <span>TerraNex</span>
        </div>

        <button
          className="market-back-btn"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>

      </nav>


      {/* MAIN CONTENT */}
      <main className="market-content">

        <div className="market-heading">

          <div className="market-heading-icon">
            <TrendingUp size={32} />
          </div>

          <div>
            <h1>Market Analysis</h1>

            <p>
              Analyze market prices, estimated costs and
              potential profit for your recommended crops.
            </p>
          </div>

        </div>


        {/* LOADING */}
        {loading && (
          <div className="market-message">
            Loading market analysis...
          </div>
        )}


        {/* ERROR */}
        {!loading && error && (
          <div className="market-error">

            <AlertCircle size={22} />

            <span>{error}</span>

          </div>
        )}


        {/* RESULTS */}
        {!loading && !error && marketData && (
          <>

            {/* BEST CROP */}
            <section className="best-crop-card">

              <div className="best-crop-icon">
                <CheckCircle size={42} />
              </div>

              <div>

                <p>BEST OVERALL CROP</p>

                <h2>
                  {formatCropName(
                    marketData.best_overall_crop
                  )}
                </h2>

                <span>
                  Selected using AI recommendation and
                  market analysis.
                </span>

              </div>

            </section>


            {/* AI RECOMMENDATIONS */}
            <section className="market-section">

              <div className="section-header">

                <Sprout size={25} />

                <div>
                  <h2>AI Recommended Crops</h2>

                  <p>
                    Crops identified as suitable for your
                    farm conditions.
                  </p>
                </div>

              </div>


              <div className="recommendation-grid">

                {marketData.recommendations?.map(
                  (item, index) => (

                    <div
                      className="recommendation-card"
                      key={index}
                    >

                      <div>

                        <h3>
                          {formatCropName(item.crop)}
                        </h3>

                        <p>AI Confidence</p>

                      </div>

                      <strong>
                        {item.confidence}%
                      </strong>

                    </div>

                  )
                )}

              </div>

            </section>


            {/* MARKET DETAILS */}
            <section className="market-section">

              <div className="section-header">

                <BarChart3 size={25} />

                <div>

                  <h2>Market Details</h2>

                  <p>
                    Latest available market information
                    for recommended crops.
                  </p>

                </div>

              </div>


              <div className="market-table">

                <div className="market-table-header">

                  <span>Crop</span>
                  <span>ML Confidence</span>
                  <span>Market Price</span>
                  <span>Markets</span>
                  <span>Price Score</span>
                  <span>Profit</span>

                </div>


                {marketData.market_analysis.map(
                  (item, index) => (

                    <div
                      className="market-table-row"
                      key={index}
                    >

                      <strong>
                        {formatCropName(item.crop)}
                      </strong>

                      <span>
                        {item.ml_confidence}%
                      </span>

                      <span>
                        {formatMoney(
                          item.average_modal_price
                        )}
                      </span>

                      <span>
                        {item.markets_available}
                      </span>

                      <span>
                        {item.price_score}
                      </span>

                      <span className="profit-value">
                        {formatMoney(
                          item.estimated_profit
                        )}
                      </span>

                    </div>

                  )
                )}

              </div>

            </section>


            {/* FINANCIAL SUMMARY */}
            <section className="financial-section">

              {marketData.market_analysis.map(
                (item, index) => (

                  <div
                    className="financial-card"
                    key={`price-${index}`}
                  >

                    <div className="financial-icon">
                      <IndianRupee size={24} />
                    </div>

                    <div>

                      <p>
                        {formatCropName(item.crop)}
                        {" — Market Price"}
                      </p>

                      <h3>
                        {formatMoney(
                          item.average_modal_price
                        )}
                      </h3>

                    </div>

                  </div>

                )
              )}


              {marketData.market_analysis.map(
                (item, index) => (

                  <div
                    className="financial-card"
                    key={`cost-${index}`}
                  >

                    <div className="financial-icon">
                      <Wallet size={24} />
                    </div>

                    <div>

                      <p>
                        {formatCropName(item.crop)}
                        {" — Estimated Cost"}
                      </p>

                      <h3>
                        {formatMoney(
                          item.estimated_cost
                        )}
                      </h3>

                    </div>

                  </div>

                )
              )}


              {marketData.market_analysis.map(
                (item, index) => (

                  <div
                    className="financial-card profit-card"
                    key={`profit-${index}`}
                  >

                    <div className="financial-icon">
                      <TrendingUp size={24} />
                    </div>

                    <div>

                      <p>
                        {formatCropName(item.crop)}
                        {" — Estimated Profit"}
                      </p>

                      <h3>
                        {formatMoney(
                          item.estimated_profit
                        )}
                      </h3>

                    </div>

                  </div>

                )
              )}

            </section>

          </>
        )}

      </main>

    </div>
  );
}

export default MarketAnalysis;