import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sprout,
  Upload,
  ScanLine,
  ArrowLeft,
  Image as ImageIcon,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Stethoscope,
  ShieldCheck
} from "lucide-react";

import { predictDisease } from "../services/api";
import { useLanguage } from "../context/LanguageContext";
import LanguageSelector from "../components/common/LanguageSelector";
import "./DiseaseDetection.css";

const diseaseInfo = {
  "Potato - Late blight": {
    about:
      "Late blight is a destructive disease caused by Phytophthora infestans that affects potato foliage and tubers under cool, humid conditions.",
    treatment: [
      "Remove and safely destroy heavily infected leaves and plants.",
      "Avoid overhead irrigation and keep foliage as dry as possible.",
      "Consult a certified local extension officer before applying any targeted fungicide."
    ],
    prevention: [
      "Use certified disease-free seed tubers.",
      "Ensure proper plant spacing and hill aeration.",
      "Scout fields weekly during cool, overcast, and rainy periods."
    ]
  },

  "Potato - Early blight": {
    about:
      "Early blight is caused by Alternaria solani, producing brown to black target-board concentric lesions primarily on older potato foliage.",
    treatment: [
      "Prune and dispose of severely infected lower leaves.",
      "Maintain consistent soil moisture and avoid water stress.",
      "Seek agronomist guidance for appropriate preventative protective sprays."
    ],
    prevention: [
      "Practice 3-year crop rotation away from solanaceous crops.",
      "Incorporate or remove crop debris following harvest.",
      "Maintain balanced nitrogen and potassium fertilization."
    ]
  },

  "Tomato - Late blight": {
    about:
      "Late blight is a rapidly spreading water-mold pathogen that damages tomato leaves, stems, and fruit during cool, wet weather.",
    treatment: [
      "Promptly prune and bag infected plant material; do not compost.",
      "Apply approved protective copper or targeted fungicides upon early confirmed detection.",
      "Water at ground level and maximize ventilation in greenhouses."
    ],
    prevention: [
      "Plant resistant tomato varieties where adapted.",
      "Maintain wide plant spacing and stake/trellis vines.",
      "Scout leaves twice weekly during foggy or rainy weather."
    ]
  },

  "Tomato - Early blight": {
    about:
      "Early blight is a fungal pathogen causing dark, concentric target-like spots with chlorotic yellow halos on older tomato leaves.",
    treatment: [
      "Remove heavily spotted lower leaves up to the first fruit cluster.",
      "Apply an appropriate protective fungicide if conditions favor spread.",
      "Avoid overhead watering and apply mulch to prevent soil splash."
    ],
    prevention: [
      "Practice crop rotation with non-solanaceous crops.",
      "Sanitize pruning shears between plants.",
      "Keep foliage dry and staked above ground level."
    ]
  },

  "Tomato - Bacterial spot": {
    about:
      "Bacterial spot is caused by Xanthomonas species, producing small, angular water-soaked dark spots on leaves and scabby fruit lesions in warm, humid weather.",
    treatment: [
      "Apply copper-based bactericides early in the disease cycle according to local extension advice.",
      "Avoid overhead irrigation and working in the field when foliage is wet.",
      "Remove severely diseased plants to reduce inoculum pressure."
    ],
    prevention: [
      "Use certified pathogen-free seed and clean transplants.",
      "Rotate crops on a 2 to 3 year cycle away from peppers and tomatoes.",
      "Disinfect stakes, trays, and tools regularly."
    ]
  },

  "Pepper bell - Bacterial spot": {
    about:
      "Bacterial spot in bell peppers produces dark, water-soaked foliar lesions and corky fruit spots, leading to premature defoliation and sunscald.",
    treatment: [
      "Apply approved copper-mancozeb sprays upon initial confirmed detection.",
      "Prune and safely dispose of infected foliage.",
      "Use drip irrigation to prevent moisture splash onto upper leaves."
    ],
    prevention: [
      "Choose bacterial spot-resistant bell pepper hybrids.",
      "Avoid overhead watering and minimize foliar contact.",
      "Enforce a 2 to 3 year rotation away from nightshade crops."
    ]
  },

  "Tomato - healthy": {
    about:
      "The tomato plant shows healthy, vigorous foliage with no apparent symptoms of infectious fungal or bacterial disease.",
    treatment: [
      "No chemical disease treatment needed. Maintain optimal irrigation and balanced fertilization.",
      "Support vigorous plant growth with adequate sunlight and airflow.",
      "Keep soil moisture consistent to prevent physiological disorders such as blossom end rot."
    ],
    prevention: [
      "Inspect leaves weekly for early signs of pests or lesions.",
      "Mulch around the base to prevent soil splash onto leaves.",
      "Maintain proper plant spacing and trellis support."
    ]
  },

  "Pepper bell - healthy": {
    about:
      "The bell pepper plant foliage appears healthy and robust, with no visible foliar lesions, bacterial spots, or chlorosis.",
    treatment: [
      "No disease treatment required. Continue regular watering and nutrient management.",
      "Ensure steady calcium and potassium supply for robust pepper fruit development.",
      "Provide adequate sunlight and protect against temperature extremes."
    ],
    prevention: [
      "Monitor plants regularly for insect vectors such as aphids and thrips.",
      "Maintain proper spacing and drip irrigation.",
      "Keep field borders clear of solanaceous weeds."
    ]
  }
};

const defaultDiseaseInfo = {
  about:
    "The AI system has analyzed the foliar image. Consult a certified agronomist for in-person diagnosis before taking any treatment action.",
  treatment: [
    "Do not apply unverified chemical treatments.",
    "Maintain good field sanitation and avoid spreading potentially infected material.",
    "Consult a local agricultural extension specialist for certified diagnosis."
  ],
  prevention: [
    "Regularly inspect plants for emerging symptoms.",
    "Maintain adequate plant spacing and air circulation.",
    "Use certified clean planting material and proper sanitation."
  ]
};

const STATUS_CONFIG = {
  accepted: {
    titleKey: "statuses.accepted",
    defaultTitle: "SCREENING CANDIDATE (VERIFIED)",
    badgeKey: "statuses.accepted",
    defaultBadgeText: "Botanical Gatekeeper Verified",
    badgeClass: "badge-accepted",
    icon: CheckCircle
  },
  potato_screening: {
    titleKey: "statuses.potato_screening",
    defaultTitle: "POTATO SCREENING (FUNGICIDE SUPPRESSED)",
    badgeKey: "statuses.potato_screening",
    defaultBadgeText: "Potato Screening Mode",
    badgeClass: "badge-potato",
    icon: AlertTriangle
  },
  rejected_unsupported_species: {
    titleKey: "statuses.rejected_unsupported_species",
    defaultTitle: "UNSUPPORTED PLANT SPECIES (REJECTED)",
    badgeKey: "statuses.rejected_unsupported_species",
    defaultBadgeText: "Species Gatekeeper Rejection",
    badgeClass: "badge-rejected",
    icon: AlertCircle
  },
  abstained_uncertain_species: {
    titleKey: "statuses.abstained_uncertain_species",
    defaultTitle: "UNCERTAIN PLANT SPECIES (ABSTAINED)",
    badgeKey: "statuses.abstained_uncertain_species",
    defaultBadgeText: "Botanical Identification Abstained",
    badgeClass: "badge-abstained",
    icon: AlertCircle
  },
  cross_stage_discrepancy: {
    titleKey: "statuses.cross_stage_discrepancy",
    defaultTitle: "BOTANICAL CONTRADICTION (ABORTED)",
    badgeKey: "statuses.cross_stage_discrepancy",
    defaultBadgeText: "Cross-Stage Discrepancy",
    badgeClass: "badge-discrepancy",
    icon: AlertCircle
  },
  model_unavailable: {
    titleKey: "statuses.model_unavailable",
    defaultTitle: "SERVICE DEGRADED (FALLBACK)",
    badgeKey: "statuses.model_unavailable",
    defaultBadgeText: "Gatekeeper Unavailable",
    badgeClass: "badge-degraded",
    icon: AlertCircle
  }
};

function DiseaseDetection() {
  const navigate = useNavigate();
  const { t, formatDiseaseDisplayName, formatSpeciesDisplayName } = useLanguage();

  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  // Symptom checklist states for potato foliar screening
  const [observedLesions, setObservedLesions] = useState(false);
  const [observedRings, setObservedRings] = useState(false);
  const [observedMold, setObservedMold] = useState(false);

  const handleFileChange = (event) => {
    const file = event.target.files[0];

    if (!file) return;

    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));

    // Stale result clearing: previous results must not remain visible
    setResult(null);
    setError("");
    setObservedLesions(false);
    setObservedRings(false);
    setObservedMold(false);
  };

  const handleDiseaseDetection = async (confirmedSymptoms = false) => {
    if (!selectedFile) {
      setError(t("disease.selectImageError", "Please select a plant image first."));
      return;
    }

    const userId = localStorage.getItem("user_id");

    if (!userId) {
      setError(t("common.sessionExpired", "Please login again to continue."));
      return;
    }

    try {
      setLoading(true);
      setError("");

      const checklistPayload = confirmedSymptoms
        ? {
            observed_lesions: observedLesions,
            observed_concentric_rings: observedRings,
            observed_whitish_mold: observedMold
          }
        : null;

      const data = await predictDisease(
        userId,
        selectedFile,
        confirmedSymptoms,
        checklistPayload
      );

      setResult(data);

    } catch (error) {
      const msg = error.message || t("disease.defaultError", "Disease screening failed.");
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

  // Status mapping
  const resolvedStatus = result?.status || "accepted";
  const statusMeta = STATUS_CONFIG[resolvedStatus] || STATUS_CONFIG.accepted;
  const StatusIcon = statusMeta.icon;

  // Localized disease content lookup
  const fallbackInfo = (result?.prediction && diseaseInfo[result.prediction]) || defaultDiseaseInfo;
  const localizedAbout = result?.prediction
    ? t(`diseaseDetails.${result.prediction}.about`, fallbackInfo.about)
    : fallbackInfo.about;
  const localizedTreatment = result?.prediction
    ? t(`diseaseDetails.${result.prediction}.treatment`, fallbackInfo.treatment)
    : fallbackInfo.treatment;
  const localizedPrevention = result?.prediction
    ? t(`diseaseDetails.${result.prediction}.prevention`, fallbackInfo.prevention)
    : fallbackInfo.prevention;

  const currentDiseaseInfo = {
    about: localizedAbout,
    treatment: Array.isArray(localizedTreatment) ? localizedTreatment : fallbackInfo.treatment,
    prevention: Array.isArray(localizedPrevention) ? localizedPrevention : fallbackInfo.prevention
  };

  // Strict Chemical Treatment Permission Rule
  const isTreatmentPermitted = Boolean(
    result &&
    result.treatment_available === true &&
    resolvedStatus === "accepted" &&
    !result.is_potato_screening &&
    result.plant_species !== "Potato" &&
    !result.prediction.toLowerCase().includes("healthy")
  );

  return (
    <div className="disease-page">

      {/* Navbar */}
      <nav className="disease-navbar">
        <div
          className="disease-logo"
          onClick={() => navigate("/dashboard")}
        >
          <Sprout size={28} />
          <span>TerraNex</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <LanguageSelector />

          <button
            className="back-btn"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft size={18} />
            <span>{t("common.backToDashboard", "Back to Dashboard")}</span>
          </button>
        </div>
      </nav>

      <main className="disease-content">

        {/* Page Heading */}
        <div className="page-heading">
          <div className="heading-icon">
            <ScanLine size={32} />
          </div>

          <div>
            <h1>{t("disease.pageTitle", "Plant Disease Detection")}</h1>
            <p>
              {t("disease.pageDesc", "Two-stage AI screening: MobileNetV2 botanical gatekeeper verifies crop species before pathology diagnosis.")}
            </p>

            <div className="disease-scope-badge">
              <Sprout size={16} />
              <span>{t("disease.scopeBadge", "Supported: Tomato, Potato, Bell Pepper (Calibrated Gatekeeper Active)")}</span>
            </div>
          </div>
        </div>

        <div className="disease-container">

          {/* Upload Section */}
          <div className="upload-section">
            <h2>{t("disease.uploadSectionTitle", "Upload Plant Image")}</h2>
            <p>{t("disease.uploadSectionDesc", "Choose a clear image of the affected plant or leaf.")}</p>

            <label className="upload-box">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
              />

              {preview ? (
                <img
                  src={preview}
                  alt="Selected plant"
                  className="image-preview"
                />
              ) : (
                <div className="upload-placeholder">
                  <ImageIcon size={50} />
                  <h3>{t("disease.selectImagePrompt", "Select an Image")}</h3>
                  <p>{t("disease.supportedFormats", "JPG, JPEG or PNG image")}</p>
                  <div className="upload-button">
                    <Upload size={18} />
                    {t("demo.dropzonePrompt", "Choose Image")}
                  </div>
                </div>
              )}
            </label>

            {selectedFile && (
              <div className="selected-file-row">
                <span className="selected-file">
                  {selectedFile.name}
                </span>
                <button
                  type="button"
                  className="change-image-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedFile(null);
                    setPreview(null);
                    setResult(null);
                    setError("");
                  }}
                >
                  {t("disease.removeImageBtn", "Remove Image")}
                </button>
              </div>
            )}

            <button
              className="detect-btn"
              onClick={() => handleDiseaseDetection(false)}
              disabled={!selectedFile || loading}
            >
              <ScanLine size={20} />
              {loading ? t("disease.analyzingBtn", "Analyzing Image...") : t("disease.detectBtn", "Detect Disease")}
            </button>

            {error && (
              <p className="disease-error">
                <AlertCircle size={18} />
                {error}
              </p>
            )}
          </div>

          {/* Result Section */}
          <div className="result-section">
            {result ? (
              <div className="disease-result">

                {/* Gatekeeper Status Badge */}
                <div className={`status-badge ${statusMeta.badgeClass}`}>
                  <StatusIcon size={16} />
                  <span>{t(statusMeta.badgeKey, statusMeta.defaultBadgeText)}</span>
                </div>

                <p className="result-label">
                  {t(statusMeta.titleKey, statusMeta.defaultTitle)}
                </p>

                <h2>
                  {formatDiseaseDisplayName(result.prediction)}
                </h2>

                {/* Botanical Species & Confidence Metrics */}
                <div className="metrics-row">
                  <div className="metric-chip">
                    <span className="metric-title">{t("disease.speciesLabel", "Identified Species")}</span>
                    <strong className="metric-val">
                      {formatSpeciesDisplayName(result.plant_species || "Unknown")}
                    </strong>
                  </div>

                  <div className="metric-chip">
                    <span className="metric-title">{t("disease.confidenceLabel", "Confidence")}</span>
                    <strong className="metric-val">
                      {result.confidence}%
                    </strong>
                  </div>

                  {result.confidence_margin !== undefined && result.confidence_margin !== null && (
                    <div className="metric-chip">
                      <span className="metric-title">Margin</span>
                      <strong className="metric-val">
                        {result.confidence_margin}%
                      </strong>
                    </div>
                  )}
                </div>

                {/* Status-Specific Advisory Banners */}
                {resolvedStatus === "potato_screening" && (
                  <div className="potato-safety-banner">
                    <AlertTriangle size={22} />
                    <div>
                      <strong>Diagnostic Safety Notice: Stage 2 Lacks Healthy Potato Category</strong>
                      <p>
                        The pathology model screens only for Early Blight and Late Blight on potato foliage.
                        Because the underlying model does not possess a healthy potato class, <strong>healthy potato leaves are frequently misdiagnosed as blight</strong>.
                      </p>
                      <p className="potato-mandatory-rule">
                        <strong>Mandatory Agronomic Rule:</strong> If this leaf has no dark concentric rings or water-soaked necrotic lesions, the plant is likely healthy. <strong>DO NOT apply fungicide treatments to lesion-free leaves.</strong>
                      </p>
                    </div>
                  </div>
                )}

                {resolvedStatus === "rejected_unsupported_species" && (
                  <div className="status-safety-card rejected-card">
                    <AlertCircle size={22} />
                    <div>
                      <strong>Unsupported Foliar Species Detected</strong>
                      <p>
                        The Stage 1 species gatekeeper detected that this leaf does not belong to a supported crop (Tomato, Potato, Bell Pepper).
                        Disease screening was halted to prevent inappropriate chemical treatments.
                      </p>
                      <div className="safe-next-action">
                        <strong>Safe Next Action:</strong> Consult an agricultural extension specialist or crop advisor specialized in your crop.
                      </div>
                    </div>
                  </div>
                )}

                {resolvedStatus === "abstained_uncertain_species" && (
                  <div className="status-safety-card abstained-card">
                    <AlertCircle size={22} />
                    <div>
                      <strong>Botanical Identification Statistically Uncertain</strong>
                      <p>
                        {result.reliability_note ||
                          "Species confidence or top-two probability margin failed statistical thresholds. Symptoms or lighting may be ambiguous."}
                      </p>
                      <div className="safe-next-action">
                        <strong>Safe Next Action:</strong> Take a clear, centered, well-lit photo of a single leaf against a plain background, or consult a local agronomist.
                      </div>
                    </div>
                  </div>
                )}

                {resolvedStatus === "cross_stage_discrepancy" && (
                  <div className="status-safety-card discrepancy-card">
                    <AlertCircle size={22} />
                    <div>
                      <strong>Cross-Stage Botanical Discrepancy Detected</strong>
                      <p>
                        {result.reliability_note ||
                          `The species gatekeeper identified plant genus '${result.plant_species}', but the pathology model diagnosed a condition for a different crop genus.`}
                      </p>
                      <div className="safe-next-action">
                        <strong>Safe Next Action:</strong> Do not apply any chemical treatments. Re-photograph the plant or request expert manual diagnosis.
                      </div>
                    </div>
                  </div>
                )}

                {resolvedStatus === "model_unavailable" && (
                  <div className="status-safety-card degraded-card">
                    <AlertCircle size={22} />
                    <div>
                      <strong>Species Gatekeeper Unavailable (Single-Stage Degraded Mode)</strong>
                      <p>
                        {result.safety_warning ||
                          "The Stage 1 species gatekeeper is unavailable; crop species was not verified. Chemical recommendations are suppressed."}
                      </p>
                      <div className="safe-next-action">
                        <strong>Safe Next Action:</strong> Verify crop species manually before taking any diagnostic or agronomic action.
                      </div>
                    </div>
                  </div>
                )}

                {resolvedStatus === "accepted" && (
                  result.prediction.toLowerCase().includes("healthy") ? (
                    <div className="healthy-banner">
                      <ShieldCheck size={20} />
                      <div>
                        <strong>Healthy Leaf Tissue Detected</strong>
                        <p>
                          No significant foliar blight or bacterial spot symptoms detected on this {formatSpeciesDisplayName(result.plant_species || "plant")}. Maintain regular crop nutrition and scouting.
                        </p>
                      </div>
                    </div>
                  ) : (result.is_uncertain || result.confidence < 70) ? (
                    <div className="uncertainty-banner">
                      <AlertCircle size={20} />
                      <div>
                        <strong>Moderate/Uncertain Confidence ({result.confidence}%)</strong>
                        <p>
                          {result.reliability_note ||
                            "Foliar symptoms may be early-stage or ambiguous. Visual agronomist confirmation required before taking action."}
                        </p>
                      </div>
                    </div>
                  ) : null
                )}

                {/* Potato Symptom Checklist UI */}
                {(resolvedStatus === "potato_screening" || result.is_potato_screening) && (
                  <div className="symptom-checklist-box">
                    <div className="checklist-header">
                      <Stethoscope size={20} />
                      <h4>{t("disease.checklistTitle", "Field Visual Symptom Checklist")}</h4>
                      <span className="checklist-badge">Field Observations</span>
                    </div>

                    <p className="checklist-disclaimer">
                      {t("disease.checklistDesc", "Late Blight screening requires manual symptom verification before treatment can be advised.")}
                    </p>

                    <div className="checklist-items">
                      <label className="checklist-item">
                        <input
                          type="checkbox"
                          checked={observedLesions}
                          onChange={(e) => setObservedLesions(e.target.checked)}
                        />
                        <span>{t("disease.checklistLesions", "Observed dark water-soaked lesions on leaves")}</span>
                      </label>

                      <label className="checklist-item">
                        <input
                          type="checkbox"
                          checked={observedRings}
                          onChange={(e) => setObservedRings(e.target.checked)}
                        />
                        <span>{t("disease.checklistRings", "Observed concentric rings / target spots")}</span>
                      </label>

                      <label className="checklist-item">
                        <input
                          type="checkbox"
                          checked={observedMold}
                          onChange={(e) => setObservedMold(e.target.checked)}
                        />
                        <span>{t("disease.checklistMold", "Observed whitish mold under moist conditions")}</span>
                      </label>
                    </div>

                    {result.symptoms_confirmed ? (
                      <div className="symptoms-confirmed-status">
                        <CheckCircle size={18} />
                        <span>Visual symptoms reported by grower. Automated fungicide guidance remains strictly suppressed.</span>
                      </div>
                    ) : (
                      <div className="checklist-action">
                        <button
                          type="button"
                          className="confirm-symptoms-btn"
                          disabled={(!observedLesions && !observedRings && !observedMold) || loading}
                          onClick={() => handleDiseaseDetection(true)}
                        >
                          {loading ? "Recording..." : t("disease.confirmAndScreenBtn", "Confirm & Screen")}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* About Disease Box */}
                {resolvedStatus === "accepted" || resolvedStatus === "potato_screening" ? (
                  <div className="disease-info-box">
                    <div className="info-title">
                      <Stethoscope size={22} />
                      <h3>{t("disease.aboutTitle", "About the Disease")}</h3>
                    </div>
                    <p>{currentDiseaseInfo.about}</p>
                  </div>
                ) : null}

                {/* Treatment Box: STRICTLY CONDITIONED on isTreatmentPermitted */}
                {isTreatmentPermitted ? (
                  <div className="disease-info-box">
                    <div className="info-title">
                      <Stethoscope size={22} />
                      <h3>{t("disease.treatmentTitle", "Actionable Treatment Guidance")}</h3>
                    </div>

                    <div className="treatment-precondition">
                      <strong>Pre-treatment Checklist:</strong> Confirm that the plant species is {formatSpeciesDisplayName(result.plant_species || "Tomato/Bell Pepper")} and that observed symptoms match field conditions before applying any fungicide or bactericide.
                    </div>

                    <ul>
                      {currentDiseaseInfo.treatment.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="disease-info-box treatment-suppressed-box">
                    <div className="info-title">
                      <ShieldCheck size={22} />
                      <h3>{t("disease.suppressedTitle", "Chemical Treatment Guidance Suppressed")}</h3>
                    </div>

                    <p className="suppression-explanation">
                      {t("disease.suppressedDesc", "Chemical guidance is withheld to avoid improper fungicide application. Consult certified agricultural specialists.")}
                    </p>

                    <div className="suppression-next-action">
                      <strong>Safe Next Action:</strong>{" "}
                      {resolvedStatus === "potato_screening"
                        ? "Inspect leaves for physical water-soaked lesions or concentric rings. If lesions are observed, bring a sample to a certified agricultural extension officer for diagnostic verification before purchasing chemical fungicides."
                        : "Consult a local agricultural extension officer or agronomist for certified in-person diagnostic confirmation."}
                    </div>
                  </div>
                )}

                {/* Prevention Box */}
                {(resolvedStatus === "accepted" || resolvedStatus === "potato_screening") && (
                  <div className="disease-info-box">
                    <div className="info-title">
                      <ShieldCheck size={22} />
                      <h3>{t("disease.preventionTitle", "Preventative Agricultural Practices")}</h3>
                    </div>

                    <ul>
                      {currentDiseaseInfo.prevention.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Regulatory / Advisory Warning */}
                <div className="treatment-warning">
                  <AlertCircle size={18} />
                  <span>
                    {result.disclaimer ||
                      "Automated AI screening is strictly advisory. Never apply chemical fungicides or pesticides without in-person confirmation from a certified agricultural extension officer or agronomist."}
                  </span>
                </div>

              </div>
            ) : (
              <div className="result-placeholder">
                <Sprout size={55} />
                <h2>{t("disease.placeholderTitle", "AI Diagnostic Ready")}</h2>
                <p>
                  {t("disease.placeholderDesc", "Upload a leaf image and click Detect Disease to start botanical verification.")}
                </p>
              </div>
            )}
          </div>

        </div>

      </main>

    </div>
  );
}

export default DiseaseDetection;
