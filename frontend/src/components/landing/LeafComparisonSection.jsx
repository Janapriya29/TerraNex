import { CheckCircle2, AlertTriangle, ShieldCheck, Activity } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import "./LeafComparisonSection.css";

export default function LeafComparisonSection() {
  const { t } = useLanguage();

  return (
    <section className="leaf-compare-section" id="leaf-compare" aria-label="Foliar Diagnostics Comparison">
      <div className="compare-container">
        {/* Section Header */}
        <div className="compare-header">
          <div className="compare-badge">
            <Activity size={16} aria-hidden="true" />
            <span>{t("leafCompare.badge", "Early Visual Diagnostics")}</span>
          </div>
          <h2 className="compare-title">
            {t("leafCompare.title", "Healthy vs. Diseased Foliage")}
          </h2>
          <p className="compare-subtitle">
            {t(
              "leafCompare.subtitle",
              "Catching plant stress early prevents crop loss. Compare typical healthy foliage with infected leaf patterns."
            )}
          </p>
        </div>

        {/* Side-by-Side Comparison Cards */}
        <div className="compare-grid">
          {/* Card 1: Healthy Foliage */}
          <div className="compare-card healthy-card">
            <div className="compare-card-badge normal-tag">
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>{t("leafCompare.healthyTag", "Normal Foliage")}</span>
            </div>

            <div className="leaf-visual-graphic healthy-graphic" aria-hidden="true">
              <div className="graphic-leaf-shape">
                <span className="graphic-icon">🌿</span>
              </div>
              <div className="graphic-status-tag">{t("leafCompare.statusUncompromised", "Status: Uncompromised")}</div>
            </div>

            <div className="compare-body">
              <h3 className="compare-card-title">
                {t("leafCompare.healthyTitle", "Healthy Bell Pepper Leaf")}
              </h3>
              <p className="compare-card-desc">
                {t(
                  "leafCompare.healthyDesc",
                  "Vigorous green pigmentation, smooth lamina, uniform venation, and absent chlorosis or necrosis."
                )}
              </p>

              <div className="diagnostic-checklist">
                <div className="check-item positive">
                  <CheckCircle2 size={16} aria-hidden="true" />
                  <span>{t("leafCompare.healthyPoint1", "Uniform chlorophyll saturation")}</span>
                </div>
                <div className="check-item positive">
                  <CheckCircle2 size={16} aria-hidden="true" />
                  <span>{t("leafCompare.healthyPoint2", "Intact lamina & leaf margins")}</span>
                </div>
                <div className="check-item positive">
                  <CheckCircle2 size={16} aria-hidden="true" />
                  <span>{t("leafCompare.healthyPoint3", "Zero pathogenic fungal sporulation")}</span>
                </div>
              </div>
            </div>

            <div className="compare-footer healthy-footer">
              <ShieldCheck size={16} aria-hidden="true" />
              <span>{t("leafCompare.healthyAssessment", "Diagnostic Assessment: Vigor Confirmed")}</span>
            </div>
          </div>

          {/* Card 2: Diseased Foliage */}
          <div className="compare-card diseased-card">
            <div className="compare-card-badge warning-tag">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>{t("leafCompare.diseasedTag", "Pathogen Detected")}</span>
            </div>

            <div className="leaf-visual-graphic diseased-graphic" aria-hidden="true">
              <div className="graphic-leaf-shape">
                <span className="graphic-icon">🍂</span>
              </div>
              <div className="graphic-status-tag danger">{t("leafCompare.pathogenDetected", "Pathogen: Xanthomonas")}</div>
            </div>

            <div className="compare-body">
              <h3 className="compare-card-title">
                {t("leafCompare.diseasedTitle", "Bacterial Spot Infection")}
              </h3>
              <p className="compare-card-desc">
                {t(
                  "leafCompare.diseasedDesc",
                  "Dark water-soaked angular lesions with yellow halos, leading to defoliation and fruit sunscald if unaddressed."
                )}
              </p>

              <div className="diagnostic-checklist">
                <div className="check-item alert">
                  <AlertTriangle size={16} aria-hidden="true" />
                  <span>{t("leafCompare.diseasedPoint1", "Necrotic tissue with chlorotic halos")}</span>
                </div>
                <div className="check-item alert">
                  <AlertTriangle size={16} aria-hidden="true" />
                  <span>{t("leafCompare.diseasedPoint2", "High defoliation & yield risk")}</span>
                </div>
                <div className="check-item alert">
                  <AlertTriangle size={16} aria-hidden="true" />
                  <span>{t("leafCompare.diseasedPoint3", "Stage 1 Species Gatekeeper: Bell Pepper (96.2%)")}</span>
                </div>
              </div>
            </div>

            <div className="compare-footer diseased-footer">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>{t("leafCompare.diseasedAdvice", "Screening Advice: Sanitize tools, avoid overhead spray")}</span>
            </div>
          </div>
        </div>

        {/* Section Disclaimer */}
        <p className="compare-disclaimer">
          {t(
            "leafCompare.disclaimer",
            "Illustrative diagnostic comparison. Always verify field anomalies using TerraNex leaf screening."
          )}
        </p>
      </div>
    </section>
  );
}
