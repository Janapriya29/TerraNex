import { Link } from "react-router-dom";
import { ArrowRight, Leaf, Sparkles } from "lucide-react";
import GithubIcon from "../common/GithubIcon";
import { useLanguage } from "../../context/LanguageContext";
import "./FinalCTASection.css";

export default function FinalCTASection() {
  const { t } = useLanguage();

  return (
    <section className="final-cta-section" aria-label="Call to Action">
      <div className="cta-container">
        <div className="cta-banner">
          <div className="cta-sparkle-pill">
            <Sparkles size={16} aria-hidden="true" />
            <span>{t("cta.badge", "Precision Agriculture for Every Farm")}</span>
          </div>

          <h2 className="cta-title">
            {t("cta.title", "Ready to Transform Your Farm Decisions?")}
          </h2>

          <p className="cta-subtitle">
            {t(
              "cta.subtitle",
              "Join TerraNex today. Leverage verified machine learning for optimal crop selection and early plant disease screening."
            )}
          </p>

          <div className="cta-buttons-row">
            <Link to="/crop-recommendation" className="btn btn-primary cta-btn-main">
              <span>{t("cta.btnCrop", "Start Crop Recommendation")}</span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>

            <Link to="/disease-detection" className="btn btn-secondary cta-btn-secondary">
              <Leaf size={18} aria-hidden="true" />
              <span>{t("cta.btnDisease", "Start Disease Screening")}</span>
            </Link>
          </div>

          <div className="cta-github-row">
            <a
              href="https://github.com/Janapriya29/TerraNex"
              target="_blank"
              rel="noopener noreferrer"
              className="cta-github-link"
            >
              <GithubIcon size={18} aria-hidden="true" />
              <span>{t("cta.openSource", "Explore Source on GitHub")}</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
