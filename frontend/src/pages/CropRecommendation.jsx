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
import "./CropRecommendation.css";

function CropRecommendation() {
  const navigate = useNavigate();

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
      setError("Please fill in all the farm condition fields.");
      return;
    }

    const userId = localStorage.getItem("user_id");

    if (!userId) {
      setError("Please login again.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setResult(null);

      const cropData = {
        N: Number(formData.N),
        P: Number(formData.P),
        K: Number(formData.K),
        temperature: Number(formData.temperature),
        humidity: Number(formData.humidity),
        ph: Number(formData.ph),
        rainfall: Number(formData.rainfall)
      };

      const data = await recommendCrop(userId, cropData);

      setResult(data);

    } catch (error) {
      setError(error.message);
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

        <button
          className="back-btn"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>

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

            <h1>Crop Recommendation</h1>

            <p>
              Enter your soil and environmental conditions
              to find suitable crops using AI.
            </p>

          </div>

        </div>


        <div className="crop-container">

          {/* ================================
              FORM
          ================================= */}

          <div className="crop-form-card">

            <h2>Farm Conditions</h2>

            <p className="form-description">
              Enter the values from your soil and
              environmental analysis.
            </p>


            <div className="form-grid">

              {/* Nitrogen */}

              <div className="crop-input">

                <label>Nitrogen (N)</label>

                <input
                  type="number"
                  name="N"
                  placeholder="Example: 90"
                  value={formData.N}
                  onChange={handleChange}
                />

              </div>


              {/* Phosphorus */}

              <div className="crop-input">

                <label>Phosphorus (P)</label>

                <input
                  type="number"
                  name="P"
                  placeholder="Example: 42"
                  value={formData.P}
                  onChange={handleChange}
                />

              </div>


              {/* Potassium */}

              <div className="crop-input">

                <label>Potassium (K)</label>

                <input
                  type="number"
                  name="K"
                  placeholder="Example: 43"
                  value={formData.K}
                  onChange={handleChange}
                />

              </div>


              {/* Temperature */}

              <div className="crop-input">

                <label>Temperature (°C)</label>

                <input
                  type="number"
                  step="0.01"
                  name="temperature"
                  placeholder="Example: 20.87"
                  value={formData.temperature}
                  onChange={handleChange}
                />

              </div>


              {/* Humidity */}

              <div className="crop-input">

                <label>Humidity (%)</label>

                <input
                  type="number"
                  step="0.01"
                  name="humidity"
                  placeholder="Example: 82"
                  value={formData.humidity}
                  onChange={handleChange}
                />

              </div>


              {/* pH */}

              <div className="crop-input">

                <label>Soil pH</label>

                <input
                  type="number"
                  step="0.01"
                  name="ph"
                  placeholder="Example: 6.5"
                  value={formData.ph}
                  onChange={handleChange}
                />

              </div>


              {/* Rainfall */}

              <div className="crop-input full-width">

                <label>Rainfall (mm)</label>

                <input
                  type="number"
                  step="0.01"
                  name="rainfall"
                  placeholder="Example: 202.93"
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
                ? "Analyzing..."
                : "Get Crop Recommendation"}

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
                  AI CROP RECOMMENDATION
                </p>


                {/* Best Crop */}

                <h2>
                  Best Crop:{" "}
                  {formatCropName(
                    result.best_overall_crop
                  )}
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
                          {formatCropName(item.crop)}
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
                        Market Analysis
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
                              {formatCropName(item.crop)}
                            </strong>

                            <p>
                              Market Price
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
                              Estimated Cost
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
                              Estimated Profit
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
                    View Full Market Analysis
                  </button>

                )}


                {/* History message */}

                <p className="result-description">
                  This recommendation and market analysis
                  have been saved to your TerraNex history.
                </p>

              </div>

            ) : (

              <div className="result-placeholder">

                <Sprout size={55} />

                <h2>AI Recommendation</h2>

                <p>
                  Enter your farm conditions and click
                  <strong>
                    {" "}Get Crop Recommendation{" "}
                  </strong>
                  to see suitable crops.
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