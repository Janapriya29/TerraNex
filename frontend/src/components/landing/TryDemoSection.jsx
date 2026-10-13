import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Sprout,
  Leaf,
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  UploadCloud,
  X,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  AlertOctagon,
  RefreshCw
} from "lucide-react";
import { recommendCrop, predictDisease } from "../../api";
import { useLanguage } from "../../context/LanguageContext";
import "./TryDemoSection.css";

const SAMPLE_RICE_INPUT = {
  N: "90",
  P: "42",
  K: "43",
  temperature: "20.8",
  humidity: "82.0",
  ph: "6.5",
  rainfall: "202.9"
};

function formatConfidence(val) {
  if (val == null || val === undefined || isNaN(val)) return "N/A";
  const num = Number(val);
  if (num > 0 && num <= 1) {
    return (num * 100).toFixed(1) + "%";
  }
  return num.toFixed(1) + "%";
}

function formatModalPrice(val) {
  if (val == null || val === undefined || isNaN(val)) return "N/A";
  return `₹${Number(val).toLocaleString("en-IN", { maximumFractionDigits: 2 })}/q`;
}

export default function TryDemoSection() {
  const {
    t,
    formatCropDisplayName,
    formatDiseaseDisplayName,
    formatSpeciesDisplayName,
    formatStatusDisplayName
  } = useLanguage();
  const [activeTab, setActiveTab] = useState("crop"); // 'crop' | 'disease'

  // --- Crop Recommendation State ---
  const [cropInputs, setCropInputs] = useState(SAMPLE_RICE_INPUT);
  const [cropLoading, setCropLoading] = useState(false);
  const [cropResult, setCropResult] = useState(null);
  const [cropError, setCropError] = useState("");

  // --- Disease Detection State ---
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [diseaseLoading, setDiseaseLoading] = useState(false);
  const [diseaseResult, setDiseaseResult] = useState(null);
  const [diseaseError, setDiseaseError] = useState("");
  const fileInputRef = useRef(null);

  // Handle Crop input changes
  const handleCropChange = (e) => {
    const { name, value } = e.target;
    setCropInputs((prev) => ({ ...prev, [name]: value }));
    setCropError("");
  };

  const handleQuickFill = () => {
    setCropInputs(SAMPLE_RICE_INPUT);
    setCropError("");
    setCropResult(null);
  };

  const handleCropSubmit = async (e) => {
    e.preventDefault();
    setCropError("");
    setCropResult(null);

    // Validate inputs
    const numN = parseFloat(cropInputs.N);
    const numP = parseFloat(cropInputs.P);
    const numK = parseFloat(cropInputs.K);
    const numTemp = parseFloat(cropInputs.temperature);
    const numHumidity = parseFloat(cropInputs.humidity);
    const numPh = parseFloat(cropInputs.ph);
    const numRainfall = parseFloat(cropInputs.rainfall);

    if (
      isNaN(numN) || isNaN(numP) || isNaN(numK) ||
      isNaN(numTemp) || isNaN(numHumidity) || isNaN(numPh) || isNaN(numRainfall)
    ) {
      setCropError(t("demo.fillAllFields", "Please provide valid numbers for all 7 soil and climate fields."));
      return;
    }

    if (
      numN < 0 || numP < 0 || numK < 0 ||
      numHumidity < 0 || numHumidity > 100 ||
      numPh < 0 || numPh > 14 ||
      numRainfall < 0
    ) {
      setCropError("Please provide valid positive agronomic inputs (Humidity 0-100%, pH 0-14).");
      return;
    }

    setCropLoading(true);
    try {
      const payload = {
        N: numN,
        P: numP,
        K: numK,
        temperature: numTemp,
        humidity: numHumidity,
        ph: numPh,
        rainfall: numRainfall
      };
      const data = await recommendCrop("guest", payload);
      setCropResult(data);
    } catch (err) {
      setCropError(err.message || t("demo.offlineError", "Prediction service is temporarily unavailable."));
    } finally {
      setCropLoading(false);
    }
  };

  // Handle Disease File Selection
  const handleFileChange = (file) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setDiseaseError("Please select a valid image file (JPG, PNG, or WEBP).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setDiseaseError("Image size exceeds 10MB limit.");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setDiseaseError("");
    setDiseaseResult(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setDiseaseResult(null);
    setDiseaseError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDiseaseSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setDiseaseError("Please select or drop a leaf image to screen.");
      return;
    }

    setDiseaseLoading(true);
    setDiseaseError("");
    setDiseaseResult(null);

    try {
      const data = await predictDisease("guest", selectedFile, false);
      setDiseaseResult(data);
    } catch (err) {
      setDiseaseError(err.message || t("demo.offlineError", "Foliar screening service is temporarily offline."));
    } finally {
      setDiseaseLoading(false);
    }
  };

  return (
    <section className="demo-section" id="demo" aria-label="Interactive Demo">
      <div className="demo-container">
        {/* Section Header */}
        <div className="demo-header">
          <div className="demo-badge">
            <Sparkles size={16} aria-hidden="true" />
            <span>{t("demo.badge", "Hands-On Experience")}</span>
          </div>
          <h2 className="demo-title">{t("demo.title", "Interactive AI Demo")}</h2>
          <p className="demo-subtitle">
            {t(
              "demo.subtitle",
              "Test the real TerraNex machine learning models directly in your browser. All inferences run live against our verified intelligence backend."
            )}
          </p>

          {/* Tab Selector */}
          <div className="demo-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "crop"}
              className={`demo-tab-btn ${activeTab === "crop" ? "active" : ""}`}
              onClick={() => setActiveTab("crop")}
            >
              <Sprout size={18} aria-hidden="true" />
              <span>{t("demo.tabCrop", "Crop Recommendation")}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "disease"}
              className={`demo-tab-btn ${activeTab === "disease" ? "active" : ""}`}
              onClick={() => setActiveTab("disease")}
            >
              <Leaf size={18} aria-hidden="true" />
              <span>{t("demo.tabDisease", "Plant Disease Detection")}</span>
            </button>
          </div>
        </div>

        {/* Demo Content Cards */}
        <div className="demo-card-wrapper">
          {/* TAB 1: CROP RECOMMENDATION */}
          {activeTab === "crop" && (
            <div className="demo-panel crop-panel">
              <div className="panel-info-bar">
                <div>
                  <h3 className="panel-heading">{t("demo.cropHeading", "Agronomic Soil & Climate Assessment")}</h3>
                  <p className="panel-subtext">{t("demo.cropDesc", "Enter soil test values and climate parameters to predict the most viable crop.")}</p>
                </div>
                <button
                  type="button"
                  className="quick-fill-btn"
                  onClick={handleQuickFill}
                  title="Fill with standard rice agronomic values"
                >
                  <RefreshCw size={14} aria-hidden="true" />
                  <span>{t("demo.quickFill", "Load Sample Data (Rice)")}</span>
                </button>
              </div>

              <form onSubmit={handleCropSubmit} className="crop-form">
                <div className="crop-fields-grid">
                  <div className="input-group">
                    <label htmlFor="crop-n">{t("demo.cropN", "Nitrogen (N)")}</label>
                    <input
                      id="crop-n"
                      name="N"
                      type="number"
                      step="any"
                      placeholder="e.g. 90"
                      value={cropInputs.N}
                      onChange={handleCropChange}
                      required
                    />
                    <span className="field-hint">0 - 140 kg/ha</span>
                  </div>

                  <div className="input-group">
                    <label htmlFor="crop-p">{t("demo.cropP", "Phosphorus (P)")}</label>
                    <input
                      id="crop-p"
                      name="P"
                      type="number"
                      step="any"
                      placeholder="e.g. 42"
                      value={cropInputs.P}
                      onChange={handleCropChange}
                      required
                    />
                    <span className="field-hint">5 - 145 kg/ha</span>
                  </div>

                  <div className="input-group">
                    <label htmlFor="crop-k">{t("demo.cropK", "Potassium (K)")}</label>
                    <input
                      id="crop-k"
                      name="K"
                      type="number"
                      step="any"
                      placeholder="e.g. 43"
                      value={cropInputs.K}
                      onChange={handleCropChange}
                      required
                    />
                    <span className="field-hint">5 - 205 kg/ha</span>
                  </div>

                  <div className="input-group">
                    <label htmlFor="crop-temp">{t("demo.cropTemp", "Temperature (°C)")}</label>
                    <input
                      id="crop-temp"
                      name="temperature"
                      type="number"
                      step="any"
                      placeholder="e.g. 20.8"
                      value={cropInputs.temperature}
                      onChange={handleCropChange}
                      required
                    />
                    <span className="field-hint">8°C - 50°C</span>
                  </div>

                  <div className="input-group">
                    <label htmlFor="crop-humidity">{t("demo.cropHumidity", "Humidity (%)")}</label>
                    <input
                      id="crop-humidity"
                      name="humidity"
                      type="number"
                      step="any"
                      placeholder="e.g. 82.0"
                      value={cropInputs.humidity}
                      onChange={handleCropChange}
                      required
                    />
                    <span className="field-hint">10% - 100%</span>
                  </div>

                  <div className="input-group">
                    <label htmlFor="crop-ph">{t("demo.cropPh", "Soil pH")}</label>
                    <input
                      id="crop-ph"
                      name="ph"
                      type="number"
                      step="any"
                      placeholder="e.g. 6.5"
                      value={cropInputs.ph}
                      onChange={handleCropChange}
                      required
                    />
                    <span className="field-hint">3.5 - 10.0</span>
                  </div>

                  <div className="input-group input-group-wide">
                    <label htmlFor="crop-rainfall">{t("demo.cropRainfall", "Rainfall (mm)")}</label>
                    <input
                      id="crop-rainfall"
                      name="rainfall"
                      type="number"
                      step="any"
                      placeholder="e.g. 202.9"
                      value={cropInputs.rainfall}
                      onChange={handleCropChange}
                      required
                    />
                    <span className="field-hint">20 - 300 mm annual</span>
                  </div>
                </div>

                {cropError && (
                  <div className="demo-error-banner" role="alert">
                    <AlertTriangle size={18} aria-hidden="true" />
                    <span>{cropError}</span>
                  </div>
                )}

                <div className="form-action-row">
                  <button
                    type="submit"
                    className="btn btn-primary submit-demo-btn"
                    disabled={cropLoading}
                  >
                    {cropLoading ? (
                      <>
                        <Loader2 size={18} className="spinner" aria-hidden="true" />
                        <span>{t("demo.analyzing", "Analyzing with AI...")}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} aria-hidden="true" />
                        <span>{t("demo.submitCrop", "Analyze Agronomics")}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Crop Output Result */}
              {cropResult && (
                <div className="demo-result-card" aria-live="polite">
                  <div className="result-header">
                    <div className="result-badge">
                      <CheckCircle2 size={18} className="text-success" aria-hidden="true" />
                      <span>{t("demo.cropComplete", "Agronomic Analysis Complete")}</span>
                    </div>
                    <Link to="/crop-recommendation" className="result-link">
                      <span>{t("demo.openFullModule", "Open in Full Module")}</span>
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  </div>

                  <div className="result-main-grid">
                    <div className="result-crop-box">
                      <span className="result-label">{t("demo.bestCropLabel", "Top Recommended Crop")}</span>
                      <h4 className="result-crop-name">{formatCropDisplayName(cropResult.best_overall_crop)}</h4>
                      {cropResult.recommendations && cropResult.recommendations.length > 0 && (
                        <div className="confidence-pill">
                          <span>{t("demo.confidenceLabel", "ML Confidence")}:</span>
                          <strong>
                            {formatConfidence(cropResult.recommendations[0].confidence)}
                          </strong>
                        </div>
                      )}
                    </div>

                    {cropResult.market_analysis && cropResult.market_analysis.length > 0 && (
                      <div className="result-market-box">
                        <div className="market-box-header">
                          <TrendingUp size={16} aria-hidden="true" />
                          <span>{t("demo.marketLinkage", "APMC Market Linkage")}</span>
                        </div>
                        {(() => {
                          const topMarket = cropResult.market_analysis.find(
                            (m) => m.crop.toLowerCase() === (cropResult.best_overall_crop || "").toLowerCase()
                          ) || cropResult.market_analysis[0];

                          return (
                            <div className="market-details">
                              <div className="market-row">
                                <span className="market-row-label">{t("demo.commodity", "Commodity")}:</span>
                                <strong>{formatCropDisplayName(topMarket.commodity || topMarket.crop)}</strong>
                              </div>
                              <div className="market-row">
                                <span className="market-row-label">{t("demo.modalPrice", "Modal Price")}:</span>
                                <strong>
                                  {formatModalPrice(topMarket.average_modal_price ?? topMarket.modal_price)}
                                </strong>
                              </div>
                              <div className="market-row">
                                <span className="market-row-label">{t("demo.marketScoreLabel", "Market Viability")}:</span>
                                <strong className="text-success">
                                  {topMarket.combined_score != null
                                    ? (Number(topMarket.combined_score) / 10).toFixed(1) + " / 10"
                                    : "High"}
                                </strong>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PLANT DISEASE DETECTION */}
          {activeTab === "disease" && (
            <div className="demo-panel disease-panel">
              <div className="panel-info-bar">
                <div>
                  <h3 className="panel-heading">{t("demo.diseaseHeading", "Foliar Plant Pathology Screening")}</h3>
                  <p className="panel-subtext">{t("demo.diseaseDesc", "Upload an image of a plant leaf (Tomato, Potato, or Bell Pepper) to screen for common pathogens.")}</p>
                </div>
              </div>

              <form onSubmit={handleDiseaseSubmit} className="disease-form">
                {/* Drag and Drop Area */}
                {!previewUrl ? (
                  <div
                    className={`dropzone ${isDragging ? "dragging" : ""}`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    aria-label="Upload leaf image"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden-file-input"
                      onChange={(e) => handleFileChange(e.target.files[0])}
                    />
                    <UploadCloud size={44} className="dropzone-icon" aria-hidden="true" />
                    <p className="dropzone-prompt">{t("demo.dropzonePrompt", "Drag and drop a leaf image here, or browse files")}</p>
                    <span className="dropzone-hint">{t("demo.dropzoneSub", "Supports JPG, PNG, WEBP up to 10 MB")}</span>
                  </div>
                ) : (
                  <div className="preview-container">
                    <div className="preview-image-wrap">
                      <img src={previewUrl} alt="Leaf preview" className="preview-img" />
                      <button
                        type="button"
                        className="preview-remove-btn"
                        onClick={removeSelectedFile}
                        aria-label="Remove image"
                        title={t("demo.removeImage", "Remove")}
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="preview-details">
                      <span className="file-name">{selectedFile?.name}</span>
                      <span className="file-size">({(selectedFile?.size / (1024 * 1024)).toFixed(2)} MB)</span>
                      <button
                        type="button"
                        className="change-file-btn"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {t("demo.replaceImage", "Replace image")}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden-file-input"
                        onChange={(e) => handleFileChange(e.target.files[0])}
                      />
                    </div>
                  </div>
                )}

                {diseaseError && (
                  <div className="demo-error-banner" role="alert">
                    <AlertTriangle size={18} aria-hidden="true" />
                    <span>{diseaseError}</span>
                  </div>
                )}

                <div className="form-action-row">
                  <button
                    type="submit"
                    className="btn btn-primary submit-demo-btn"
                    disabled={diseaseLoading || !selectedFile}
                  >
                    {diseaseLoading ? (
                      <>
                        <Loader2 size={18} className="spinner" aria-hidden="true" />
                        <span>{t("demo.screening", "Analyzing leaf foliage...")}</span>
                      </>
                    ) : (
                      <>
                        <Leaf size={18} aria-hidden="true" />
                        <span>{t("demo.submitDisease", "Screen for Disease")}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Disease Output Result with Strict Safety Contract */}
              {diseaseResult && (
                <div className="demo-result-card" aria-live="polite">
                  <div className="result-header">
                    <div className="result-badge">
                      {diseaseResult.status === "accepted" ? (
                        <CheckCircle2 size={18} className="text-success" aria-hidden="true" />
                      ) : (
                        <ShieldCheck size={18} className="text-warning" aria-hidden="true" />
                      )}
                      <span>
                        Status: <strong>{formatStatusDisplayName(diseaseResult.status)}</strong>
                      </span>
                    </div>
                    <Link to="/disease-detection" className="result-link">
                      <span>{t("demo.openFullModule", "Open in Full Module")}</span>
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  </div>

                  {/* Safety Alert Boxes for specific statuses */}
                  {diseaseResult.is_potato_screening && (
                    <div className="safety-alert potato-alert">
                      <AlertTriangle size={20} className="alert-icon" />
                      <div>
                        <strong>{t("demo.safetyNotice", "Safety Screening Notice")}:</strong>
                        <p>{t("demo.potatoNotice", "Potato Screening Mode: Late Blight foliar guidance is strictly suppressed. Verify tuber symptoms with certified extension agents.")}</p>
                      </div>
                    </div>
                  )}

                  {diseaseResult.status === "rejected_unsupported_species" && (
                    <div className="safety-alert rejected-alert">
                      <AlertOctagon size={20} className="alert-icon" />
                      <div>
                        <strong>Unsupported Plant Species:</strong>
                        <p>The foliar gatekeeper determined this leaf does not match supported crops (Tomato, Potato, Bell Pepper). Chemical treatments are strictly suppressed.</p>
                      </div>
                    </div>
                  )}

                  {diseaseResult.status === "abstained_uncertain_species" && (
                    <div className="safety-alert potato-alert">
                      <AlertTriangle size={20} className="alert-icon" />
                      <div>
                        <strong>Botanical Identification Statistically Uncertain:</strong>
                        <p>{diseaseResult.reliability_note || "Species confidence or top-two probability margin failed statistical thresholds. Chemical guidance suppressed."}</p>
                      </div>
                    </div>
                  )}

                  {diseaseResult.status === "cross_stage_discrepancy" && (
                    <div className="safety-alert rejected-alert">
                      <AlertOctagon size={20} className="alert-icon" />
                      <div>
                        <strong>Cross-Stage Botanical Discrepancy:</strong>
                        <p>{diseaseResult.reliability_note || "The species gatekeeper and pathology model disagreed on plant genus. Chemical treatments are strictly suppressed."}</p>
                      </div>
                    </div>
                  )}

                  {diseaseResult.status === "model_unavailable" && (
                    <div className="safety-alert potato-alert">
                      <AlertTriangle size={20} className="alert-icon" />
                      <div>
                        <strong>Species Gatekeeper Unavailable:</strong>
                        <p>{diseaseResult.safety_warning || "Stage 1 species gatekeeper is unavailable; crop species was not verified. Chemical recommendations are suppressed."}</p>
                      </div>
                    </div>
                  )}

                  <div className="result-main-grid">
                    <div className="result-crop-box">
                      <span className="result-label">{t("demo.diagnosisLabel", "Diagnosis Result")}</span>
                      <h4 className="result-crop-name">{formatDiseaseDisplayName(diseaseResult.prediction) || "Screening inconclusive"}</h4>
                      <div className="confidence-pill">
                        <span>{t("demo.confidenceLabel", "ML Confidence")}:</span>
                        <strong>
                          {formatConfidence(diseaseResult.confidence)}
                        </strong>
                      </div>
                    </div>

                    <div className="result-market-box">
                      <div className="market-box-header">
                        <Leaf size={16} aria-hidden="true" />
                        <span>{t("demo.gatekeeperHeader", "Foliar Species Gatekeeper")}</span>
                      </div>
                      <div className="market-details">
                        <div className="market-row">
                          <span className="market-row-label">{t("demo.speciesLabel", "Identified Species")}:</span>
                          <strong>{formatSpeciesDisplayName(diseaseResult.plant_species || "Undetermined")}</strong>
                        </div>
                        <div className="market-row">
                          <span className="market-row-label">{t("demo.speciesConfidence", "Species Confidence")}:</span>
                          <strong>
                            {formatConfidence(diseaseResult.species_confidence)}
                          </strong>
                        </div>
                        <div className="market-row">
                          <span className="market-row-label">{t("demo.treatmentSafe", "Treatment Safe")}:</span>
                          <strong>{diseaseResult.treatment_available ? t("demo.treatmentVerified", "Yes (Verified)") : t("demo.treatmentSuppressed", "Suppressed")}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
