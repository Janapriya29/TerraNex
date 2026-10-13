import { Link } from "react-router-dom";
import { Sprout, ShieldCheck, FileCheck, History, Globe, ArrowRight } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import "./FeaturesSection.css";

export default function FeaturesSection() {
  const { t } = useLanguage();

  const features = [
    {
      id: "crop",
      icon: Sprout,
      title: t("features.f1Title", "AI Crop Recommendation"),
      desc: t(
        "features.f1Desc",
        "Multiclass Random Forest model evaluating 22 crops based on soil nutrients and local weather conditions."
      ),
      link: "/crop-recommendation",
      linkText: t("features.exploreCrop", "Explore Crop Model")
    },
    {
      id: "disease",
      icon: ShieldCheck,
      title: t("features.f2Title", "Two-Stage Disease Detection"),
      desc: t(
        "features.f2Desc",
        "CNN pipeline with Stage 1 foliar species verification to prevent cross-crop false alarms and unnecessary sprays."
      ),
      link: "/disease-detection",
      linkText: t("features.exploreDisease", "Explore Disease Engine")
    },
    {
      id: "treatment",
      icon: FileCheck,
      title: t("features.f3Title", "Targeted Treatment Suggestions"),
      desc: t(
        "features.f3Desc",
        "Actionable agronomic guidance, cultural controls, and preventative steps tailored to verified plant diagnoses."
      ),
      link: "/disease-detection",
      linkText: t("features.viewTreatment", "View Treatment Logic")
    },
    {
      id: "history",
      icon: History,
      title: t("features.f4Title", "Prediction History & Auditing"),
      desc: t(
        "features.f4Desc",
        "Persistent records of all crop and disease analyses to track farm health and seasonal performance over time."
      ),
      link: "/history",
      linkText: t("features.accessHistory", "Access Farmer History")
    },
    {
      id: "multilingual",
      icon: Globe,
      title: t("features.f5Title", "Multilingual Farmer Access"),
      desc: t(
        "features.f5Desc",
        "Interface localized in English, Tamil, and Hindi to ensure accessibility across linguistic farming communities."
      ),
      link: "#demo",
      linkText: t("features.tryLanguage", "Try in Your Language")
    }
  ];

  return (
    <section className="features-section" id="features" aria-label="Platform Features">
      <div className="features-container">
        {/* Section Header */}
        <div className="features-header">
          <div className="features-badge">
            <span>{t("features.badge", "Platform Capabilities")}</span>
          </div>
          <h2 className="features-title">
            {t("features.title", "Comprehensive Agricultural Intelligence")}
          </h2>
          <p className="features-subtitle">
            {t(
              "features.subtitle",
              "Built specifically to solve core agricultural challenges faced by Indian farmers and extension workers."
            )}
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="features-grid">
          {features.map((item) => {
            const Icon = item.icon;
            const isAnchor = item.link.startsWith("#");

            return (
              <div key={item.id} className="feature-card">
                <div className="feature-icon-wrapper">
                  <Icon size={26} aria-hidden="true" />
                </div>
                <h3 className="feature-card-title">{item.title}</h3>
                <p className="feature-card-desc">{item.desc}</p>

                <div className="feature-card-footer">
                  {isAnchor ? (
                    <a href={item.link} className="feature-link">
                      <span>{item.linkText}</span>
                      <ArrowRight size={14} aria-hidden="true" />
                    </a>
                  ) : (
                    <Link to={item.link} className="feature-link">
                      <span>{item.linkText}</span>
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
