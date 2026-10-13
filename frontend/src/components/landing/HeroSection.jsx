import { Link } from "react-router-dom";
import { ArrowRight, Leaf, Sparkles, ShieldCheck, TrendingUp, CheckCircle2 } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import "./HeroSection.css";

export default function HeroSection() {
  const { t } = useLanguage();

  return (
    <section className="hero-section" aria-label="Introduction">
      <div className="hero-container">
        {/* Left Column: Copy & Actions */}
        <div className="hero-copy">
          <div className="hero-badge">
            <Sparkles size={16} className="hero-badge-icon" aria-hidden="true" />
            <span>{t("hero.badge", "AI-Powered Agriculture Intelligence")}</span>
          </div>

          <h1 className="hero-title">
            {t("hero.headlinePrefix", "Grow smarter.")}{" "}
            <span className="highlight-text">{t("hero.headlineHighlight", "Detect earlier.")}</span>{" "}
            {t("hero.headlineSuffix", "Harvest more.")}
          </h1>

          <p className="hero-subtitle">
            {t(
              "hero.subhead",
              "Make informed farming decisions with AI-powered crop recommendations and plant disease detection—all in one place."
            )}
          </p>

          <div className="hero-cta-group">
            <Link to="/crop-recommendation" className="btn btn-primary hero-btn-main">
              <span>{t("hero.primaryCta", "Get Crop Recommendation")}</span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>

            <Link to="/disease-detection" className="btn btn-secondary hero-btn-secondary">
              <Leaf size={18} aria-hidden="true" />
              <span>{t("hero.secondaryCta", "Scan a Leaf")}</span>
            </Link>
          </div>

          {/* Trust indicators */}
          <div className="hero-trust-bar">
            <div className="trust-item">
              <CheckCircle2 size={16} className="trust-icon" aria-hidden="true" />
              <span>{t("hero.trustCrops", "22 Crop Classes")}</span>
            </div>
            <div className="trust-item">
              <ShieldCheck size={16} className="trust-icon" aria-hidden="true" />
              <span>{t("hero.trustGatekeeper", "2-Stage Foliar Safety Gatekeeper")}</span>
            </div>
            <div className="trust-item">
              <TrendingUp size={16} className="trust-icon" aria-hidden="true" />
              <span>{t("hero.trustMarket", "APMC Market Insights")}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Visual Showcase */}
        <div className="hero-visual-wrapper" aria-hidden="true">
          <div className="hero-visual-card">
            <div className="card-top-bar">
              <div className="pulse-indicator">
                <span className="pulse-dot"></span>
                <span className="pulse-text">{t("hero.engineOnline", "AI Diagnostic Engine Online")}</span>
              </div>
              <span className="badge-live">{t("hero.realTime", "Real-Time")}</span>
            </div>

            <div className="metric-preview-row">
              <div className="preview-stat-chip">
                <span className="stat-label">{t("hero.npkCalibration", "Soil N-P-K Calibration")}</span>
                <strong className="stat-val">90 : 42 : 43</strong>
              </div>
              <div className="preview-stat-chip">
                <span className="stat-label">{t("hero.modelConfidence", "Model Confidence")}</span>
                <strong className="stat-val text-success">98.4%</strong>
              </div>
            </div>

            <div className="preview-diagnosis-box">
              <div className="diagnosis-icon-wrap">
                <Leaf size={24} />
              </div>
              <div className="diagnosis-info">
                <span className="diagnosis-heading">{t("hero.optimalRecommendation", "Optimal Recommendation")}</span>
                <span className="diagnosis-crop">{t("hero.sampleCropName", "Rice (Oryza sativa)")}</span>
                <span className="diagnosis-detail">{t("hero.sampleCropDetail", "High humidity & water retention suitability")}</span>
              </div>
            </div>

            <div className="preview-safety-footer">
              <ShieldCheck size={16} className="text-primary" />
              <span>{t("hero.gatekeeperFooter", "Stage 1 Species Gatekeeper calibrated (tau_sp = 0.60)")}</span>
            </div>
          </div>

          {/* Floating Accents */}
          <div className="floating-badge badge-top-left float-anim-1">
            <span className="floating-emoji">🌱</span>
            <div>
              <div className="floating-title">{t("hero.floatingBadge1Title", "Foliar Screening")}</div>
              <div className="floating-sub">{t("hero.floatingBadge1Sub", "Zero False-Alarms")}</div>
            </div>
          </div>

          <div className="floating-badge badge-bottom-right float-anim-2">
            <span className="floating-emoji">📊</span>
            <div>
              <div className="floating-title">{t("hero.floatingBadge2Title", "APMC Market Scoring")}</div>
              <div className="floating-sub">{t("hero.floatingBadge2Sub", "Viability Score 8.6/10")}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
