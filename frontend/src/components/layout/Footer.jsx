import { Link } from "react-router-dom";
import { Sprout, ExternalLink, ShieldCheck } from "lucide-react";
import GithubIcon from "../common/GithubIcon";
import { useLanguage } from "../../context/LanguageContext";
import "./Footer.css";

export default function Footer() {
  const { t } = useLanguage();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="footer-container">
        {/* Top Grid */}
        <div className="footer-grid">
          {/* Brand Info */}
          <div className="footer-brand-col">
            <Link to="/" className="footer-brand">
              <div className="footer-logo-icon">
                <Sprout size={24} aria-hidden="true" />
              </div>
              <span className="footer-brand-name">
                Terra<span className="brand-accent">Nex</span>
              </span>
            </Link>
            <p className="footer-tagline">
              {t("footer.tagline", "AI-Powered Agriculture Decision Platform")}
            </p>
            <p className="footer-description">
              {t(
                "footer.desc",
                "Empowering Indian farmers and agricultural researchers with calibrated machine learning for crop suitability, foliar disease diagnostics, and APMC market intelligence."
              )}
            </p>
            <div className="footer-social-links">
              <a
                href="https://github.com/Janapriya29/TerraNex"
                target="_blank"
                rel="noopener noreferrer"
                className="social-link"
                aria-label="GitHub Repository"
              >
                <GithubIcon size={18} aria-hidden="true" />
                <span>Janapriya29/TerraNex</span>
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="footer-col">
            <h4 className="footer-heading">{t("footer.quickLinks", "Quick Links")}</h4>
            <ul className="footer-nav-list">
              <li><a href="#features">{t("nav.features", "Features")}</a></li>
              <li><a href="#how-it-works">{t("nav.howItWorks", "How It Works")}</a></li>
              <li><a href="#demo">{t("nav.demo", "Interactive Demo")}</a></li>
              <li><a href="#technology">{t("nav.technology", "Technology")}</a></li>
              <li><a href="#leaf-compare">{t("leafCompare.title", "Leaf Diagnostics")}</a></li>
              <li><a href="#impact">{t("impact.title", "Sustainability Impact")}</a></li>
            </ul>
          </div>

          {/* Modules */}
          <div className="footer-col">
            <h4 className="footer-heading">{t("footer.modules", "Modules")}</h4>
            <ul className="footer-nav-list">
              <li>
                <Link to="/crop-recommendation">{t("crop.title", "Crop Recommendation")}</Link>
              </li>
              <li>
                <Link to="/disease-detection">{t("disease.title", "Plant Disease Detection")}</Link>
              </li>
              <li>
                <Link to="/market-analysis">{t("market.title", "APMC Market Analysis")}</Link>
              </li>
              <li>
                <Link to="/history">{t("history.title", "Prediction History")}</Link>
              </li>
              <li>
                <Link to="/dashboard">{t("dashboard.title", "Farmer Dashboard")}</Link>
              </li>
            </ul>
          </div>

          {/* Legal / Ethics */}
          <div className="footer-col">
            <h4 className="footer-heading">{t("footer.legal", "Project Information")}</h4>
            <div className="safety-badge-card">
              <div className="safety-badge-header">
                <ShieldCheck size={20} className="safety-icon" aria-hidden="true" />
                <span>{t("footer.safetyContract", "Calibrated Safety Contract")}</span>
              </div>
              <p className="safety-badge-text">
                {t(
                  "footer.safetyContractText",
                  "Strict multi-threshold verification (tau_sp = 0.60, tau_oth = 0.20, delta = 0.10) enforces foliar species validity before pathogen inference."
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Disclaimer Bar */}
        <div className="footer-disclaimer-card">
          <p className="disclaimer-text">
            <strong>{t("footer.noticePrefix", "Agronomic Notice: ")}</strong>
            {t(
              "footer.disclaimer",
              "AI recommendations provide decision support and indicative diagnostics. Consult certified agricultural extension specialists for critical farm interventions."
            )}
          </p>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom">
          <p className="copyright-text">
            © {currentYear} TerraNex. {t("footer.builtWith", "Built with passion for sustainable precision agriculture.")}
          </p>
          <div className="footer-bottom-links">
            <a href="https://github.com/Janapriya29/TerraNex/blob/main/README.md" target="_blank" rel="noopener noreferrer">
              {t("footer.documentation", "Documentation")}
            </a>
            <span className="dot-sep">•</span>
            <a href="https://github.com/Janapriya29/TerraNex" target="_blank" rel="noopener noreferrer">
              {t("footer.openSource", "Open Source")}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
