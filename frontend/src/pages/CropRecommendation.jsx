import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Sprout,
  Leaf,
  ArrowLeft,
  Search,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  IndianRupee,
  Wallet
} from "lucide-react";

import { recommendCrop } from "../services/api";
import { useLanguage } from "../context/LanguageContext";
import LanguageSelector from "../components/common/LanguageSelector";
import "./CropRecommendation.css";

function CropRecommendation() {
  const navigate = useNavigate();
  const { t, formatCropDisplayName } = useLanguage();

  const [formData, setFormData] = useState({
    N: "",
    P: "",
    K: "",
    temperature: "",
    humidity: "",
    ph: "",
    rainfall: ""
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData({
      ...formData,
      [name]: value
    });

    setError("");
  };

  const handleRecommendation = async () => {
    const values = Object.values(formData);

    if (values.some((value) => value === "")) {
      setError(t("crop.validationRequired", "Please fill in all the farm condition fields."));
      return;
    }

    const userId = localStorage.getItem("user_id");

    if (!userId) {
      setError(t("common.sessionExpired", "Please login again to continue."));
      return;
    }

    const numN = Number(formData.N);
    const numP = Number(formData.P);
    const numK = Number(formData.K);
    const numTemp = Number(formData.temperature);
    const numHum = Number(formData.humidity);
    const numPh = Number(formData.ph);
    const numRain = Number(formData.rainfall);

    if (
      isNaN(numN) || isNaN(numP) || isNaN(numK) ||
      isNaN(numTemp) || isNaN(numHum) || isNaN(numPh) || isNaN(numRain)
    ) {
      setError(t("crop.validationRequired", "Please fill in all the farm condition fields with valid numbers."));
      return;
    }

    if (numN < 0 || numP < 0 || numK < 0 || numHum < 0 || numHum > 100 || numPh < 0 || numPh > 14 || numRain < 0) {
      setError(t("crop.validationRanges", "Please provide valid agronomic inputs (Humidity 0-100%, pH 0-14, positive values)."));
      return;
    }

    try {
      setLoading(true);
      setError("");
      setResult(null);

      const cropData = {
        N: numN,
        P: numP,
        K: numK,
        temperature: numTemp,
        humidity: numHum,
        ph: numPh,
        rainfall: numRain
      };

      const data = await recommendCrop(userId, cropData);

      setResult(data);

    } catch (error) {
      const msg = error.message || t("crop.defaultError", "Crop recommendation failed.");
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
        setError(t("common.sessionExpired", "Your session has expired or is invalid. Please login again."));
        setTimeout(() => navigate("/login"), 1500);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (value) => {
    if (value === undefined || value === null) {
      return "₹0";
    }

    return `₹${Number(value).toLocaleString("en-IN")}`;
  };

  return (
    <div className="crop-page">

      {/* ================================
          NAVBAR
      ================================= */}

      <nav className="tool-navbar">

        <div
          className="tool-logo"
          onClick={() => navigate("/dashboard")}
        >
          <Sprout size={28} />
          <span>TerraNex</span>
        </div>

        <div className="nav-actions-group">
          <LanguageSelector />

          <button
            className="header-market-link"
            onClick={() => navigate("/market-analysis")}
            title={t("crop.marketRatesBtn", "APMC Market Rates")}
          >
            <TrendingUp size={16} />
            <span>{t("crop.marketRatesBtn", "APMC Market Rates")}</span>
          </button>

          <button
            className="back-btn"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft size={18} />
            <span>{t("common.backToDashboard", "Back to Dashboard")}</span>
          </button>
        </div>

      </nav>


      {/* ================================
          MAIN
      ================================= */}

      <main className="crop-content">

        {/* Page Heading */}

        <div className="page-heading">

          <div className="heading-icon">
            <Leaf size={32} />
          </div>

          <div>

            <h1>{t("crop.pageTitle", "AI Crop Recommendation")}</h1>

            <p>
              {t("crop.pageDesc", "Enter your soil and climate data to get the best crop recommendations powered by Machine Learning.")}
            </p>

          </div>

        </div>


        <div className="crop-container">

          {/* ================================
              FORM
          ================================= */}

          <div className="crop-form-card">

            <h2>{t("crop.soilSectionTitle", "Farm & Climate Parameters")}</h2>

            <p className="form-description">
              {t("demo.cropDesc", "Enter soil test values and climate parameters to predict the most viable crop.")}
            </p>


            <div className="form-grid">

              {/* Nitrogen */}

              <div className="crop-input">

                <label>{t("crop.nLabel", "Nitrogen (N)")}</label>

                <input
                  type="number"
                  name="N"
                  placeholder={t("crop.nPlaceholder", "Example: 90")}
                  value={formData.N}
                  onChange={handleChange}
                />

              </div>


              {/* Phosphorus */}

              <div className="crop-input">

                <label>{t("crop.pLabel", "Phosphorus (P)")}</label>

                <input
                  type="number"
                  name="P"
                  placeholder={t("crop.pPlaceholder", "Example: 42")}
                  value={formData.P}
                  onChange={handleChange}
                />

              </div>


              {/* Potassium */}

              <div className="crop-input">

                <label>{t("crop.kLabel", "Potassium (K)")}</label>

                <input
                  type="number"
                  name="K"
                  placeholder={t("crop.kPlaceholder", "Example: 43")}
                  value={formData.K}
                  onChange={handleChange}
                />

              </div>


              {/* Temperature */}

              <div className="crop-input">

                <label>{t("crop.tempLabel", "Temperature (°C)")}</label>

                <input
                  type="number"
                  step="0.01"
                  name="temperature"
                  placeholder={t("crop.tempPlaceholder", "Example: 20.87")}
                  value={formData.temperature}
                  onChange={handleChange}
                />

              </div>


              {/* Humidity */}

              <div className="crop-input">

                <label>{t("crop.humidityLabel", "Humidity (%)")}</label>

                <input
                  type="number"
                  step="0.01"
                  name="humidity"
                  placeholder={t("crop.humidityPlaceholder", "Example: 82")}
                  value={formData.humidity}
                  onChange={handleChange}
                />

              </div>


              {/* pH */}

              <div className="crop-input">

                <label>{t("crop.phLabel", "Soil pH")}</label>

                <input
                  type="number"
                  step="0.01"
                  name="ph"
                  placeholder={t("crop.phPlaceholder", "Example: 6.5")}
                  value={formData.ph}
                  onChange={handleChange}
                />

              </div>


              {/* Rainfall */}

              <div className="crop-input full-width">

                <label>{t("crop.rainfallLabel", "Rainfall (mm)")}</label>

                <input
                  type="number"
                  step="0.01"
                  name="rainfall"
                  placeholder={t("crop.rainfallPlaceholder", "Example: 202.93")}
                  value={formData.rainfall}
                  onChange={handleChange}
                />

              </div>

            </div>


            {/* Button */}

            <button
              className="recommend-btn"
              onClick={handleRecommendation}
              disabled={loading}
            >

              <Search size={20} />

              {loading
                ? t("crop.analyzingBtn", "Analyzing...")
                : t("crop.recommendBtn", "Get Crop Recommendation")}

            </button>


            {/* Error */}

            {error && (

              <p className="crop-error">

                <AlertCircle size={18} />

                {error}

              </p>

            )}

          </div>


          {/* ================================
              RESULT
          ================================= */}

          <div className="crop-result-card">

            {result ? (

              <div className="crop-result">

                <CheckCircle
                  size={55}
                  className="result-success-icon"
                />


                <p className="result-label">
                  {t("crop.resultBadge", "AI CROP RECOMMENDATION")}
                </p>


                {/* Best Crop */}

                <h2>
                  {t("crop.bestCropTitle", "Best Crop")}:{" "}
                  {formatCropDisplayName(result.best_overall_crop)}
                </h2>


                {/* ================================
                    RECOMMENDATIONS
                ================================= */}

                <div className="recommendation-list">

                  {result.recommendations?.map(
                    (item, index) => (

                      <div
                        className="recommendation-item"
                        key={index}
                      >

                        <span>
                          {formatCropDisplayName(item.crop)}
                        </span>

                        <strong>
                          {item.confidence}%
                        </strong>

                      </div>

                    )
                  )}

                </div>


                {/* ================================
                    MARKET ANALYSIS
                ================================= */}

                {result.market_analysis?.length > 0 && (

                  <div className="market-box">

                    <div className="market-box-title">

                      <TrendingUp size={20} />

                      <h3>
                        {t("crop.marketAnalysisTitle", "Market Analysis")}
                      </h3>

                    </div>


                    {result.market_analysis.map(
                      (item, index) => (

                        <div
                          className="market-item"
                          key={index}
                        >

                          <div>

                            <strong>
                              {formatCropDisplayName(item.crop)}
                            </strong>

                            <p>
                              {t("crop.marketPriceLabel", "Market Price")}
                            </p>

                          </div>

                          <strong>
                            {formatMoney(
                              item.average_modal_price
                            )}
                          </strong>

                        </div>

                      )
                    )}


                    {/* Financial Details */}

                    {result.market_analysis.map(
                      (item, index) => (

                        <div
                          className="market-financial-details"
                          key={`financial-${index}`}
                        >

                          <div>

                            <span>
                              <Wallet size={15} />
                              {t("crop.estimatedCostLabel", "Estimated Cost")}
                            </span>

                            <strong>
                              {formatMoney(
                                item.estimated_cost
                              )}
                            </strong>

                          </div>


                          <div>

                            <span>
                              <IndianRupee size={15} />
                              {t("crop.estimatedProfitLabel", "Estimated Profit")}
                            </span>

                            <strong>
                              {formatMoney(
                                item.estimated_profit
                              )}
                            </strong>

                          </div>

                        </div>

                      )
                    )}

                  </div>

                )}


                {/* ================================
                    VIEW MARKET ANALYSIS
                ================================= */}

                {result.market_analysis?.length > 0 && (

                  <button
                    className="view-market-btn"
                    onClick={() =>
                      navigate("/market-analysis")
                    }
                  >
                    <TrendingUp size={18} />
                    {t("crop.viewMarketBtn", "View Full Market Analysis")}
                  </button>

                )}


                {/* History message */}

                <p className="result-description">
                  {t("crop.historySavedNote", "This recommendation and market analysis have been saved to your TerraNex history.")}
                </p>

              </div>

            ) : (

              <div className="result-placeholder">

                <Sprout size={55} />

                <h2>{t("crop.placeholderTitle", "AI Recommendation")}</h2>

                <p>
                  {t("crop.placeholderDesc", "Enter your farm conditions and click Get Crop Recommendation to see suitable crops.")}
                </p>

              </div>

            )}

          </div>

        </div>

      </main>

    </div>
  );
}

export default CropRecommendation;