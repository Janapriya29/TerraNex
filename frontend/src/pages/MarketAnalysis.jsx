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

import { getCropHistory } from "../api";
import { useLanguage } from "../context/LanguageContext";
import LanguageSelector from "../components/common/LanguageSelector";
import "./MarketAnalysis.css";

function MarketAnalysis() {
  const navigate = useNavigate();
  const { t, formatCropDisplayName } = useLanguage();

  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function fetchMarketAnalysis() {
      try {
        const userId = localStorage.getItem("user_id");

        if (!userId) {
          if (isMounted) {
            setError(t("common.sessionExpired", "Please login again to continue."));
            setLoading(false);
          }
          return;
        }

        const data = await getCropHistory(userId);

        if (!isMounted) return;

        if (!data.history || data.history.length === 0) {
          setError(
            t("market.noCropHistoryError", "No crop recommendation available. Please get a crop recommendation first.")
          );
          setLoading(false);
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
            t("market.noMarketDataError", "No market analysis data available for the latest recommendation.")
          );
          setLoading(false);
          return;
        }

        setMarketData(latest);

      } catch (err) {
        if (isMounted) {
          console.error("Market Analysis Error:", err);
          const msg = err.message || t("market.loadErrorDefault", "Failed to load market analysis.");
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

    fetchMarketAnalysis();

    return () => {
      isMounted = false;
    };
  }, [t, navigate]);

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

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <LanguageSelector />

          <button
            className="market-back-btn"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft size={18} />
            <span>{t("common.backToDashboard", "Back to Dashboard")}</span>
          </button>
        </div>

      </nav>


      {/* MAIN CONTENT */}
      <main className="market-content">

        <div className="market-heading">

          <div className="market-heading-icon">
            <TrendingUp size={32} />
          </div>

          <div>
            <h1>{t("market.pageTitle", "Market Analysis")}</h1>

            <p>
              {t("market.pageDesc", "Analyze market prices, estimated costs and potential profit for your recommended crops.")}
            </p>
          </div>

        </div>


        {/* LOADING */}
        {loading && (
          <div className="market-message">
            {t("market.loadingText", "Loading market analysis...")}
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

                <p>{t("market.bestOverallCropBadge", "BEST OVERALL CROP")}</p>

                <h2>
                  {formatCropDisplayName(
                    marketData.best_overall_crop
                  )}
                </h2>

                <span>
                  {t("market.bestOverallCropDesc", "Selected using AI recommendation and market analysis.")}
                </span>

              </div>

            </section>


            {/* AI RECOMMENDATIONS */}
            <section className="market-section">

              <div className="section-header">

                <Sprout size={25} />

                <div>
                  <h2>{t("market.aiRecommendedTitle", "AI Recommended Crops")}</h2>

                  <p>
                    {t("market.aiRecommendedDesc", "Crops identified as suitable for your farm conditions.")}
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
                          {formatCropDisplayName(item.crop)}
                        </h3>

                        <p>{t("crop.confidenceLabel", "AI Confidence")}</p>

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

                  <h2>{t("market.marketDetailsTitle", "Market Details")}</h2>

                  <p>
                    {t("market.marketDetailsDesc", "Latest available market information for recommended crops.")}
                  </p>

                </div>

              </div>


              <div className="market-table">

                <div className="market-table-header">

                  <span>{t("market.colCrop", "Crop")}</span>
                  <span>{t("market.colMlConfidence", "ML Confidence")}</span>
                  <span>{t("market.colMarketPrice", "Market Price")}</span>
                  <span>{t("market.colMarkets", "Markets")}</span>
                  <span>{t("market.colPriceScore", "Price Score")}</span>
                  <span>{t("market.colProfit", "Profit")}</span>

                </div>


                {marketData.market_analysis.map(
                  (item, index) => (

                    <div
                      className="market-table-row"
                      key={index}
                    >

                      <strong>
                        {formatCropDisplayName(item.crop)}
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
                        {formatCropDisplayName(item.crop)}
                        {` — ${t("market.marketPriceSuffix", "Market Price")}`}
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
                        {formatCropDisplayName(item.crop)}
                        {` — ${t("market.estimatedCostSuffix", "Estimated Cost")}`}
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
                        {formatCropDisplayName(item.crop)}
                        {` — ${t("market.estimatedProfitSuffix", "Estimated Profit")}`}
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