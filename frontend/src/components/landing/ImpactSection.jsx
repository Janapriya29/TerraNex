import { Droplets, ShieldAlert, HeartHandshake, Sparkles } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import "./ImpactSection.css";

export default function ImpactSection() {
  const { t } = useLanguage();

  const impactCards = [
    {
      id: "selection",
      icon: Droplets,
      title: t("impact.card1Title", "Informed Crop Selection"),
      desc: t(
        "impact.card1Desc",
        "Matching crops to actual soil nutrient reserves and rainfall patterns reduces seed failure and optimizes fertilizer utilization."
      ),
      metric: "Resource Efficiency",
      metricSub: "Targeted N-P-K matching"
    },
    {
      id: "pathogen",
      icon: ShieldAlert,
      title: t("impact.card2Title", "Early Pathogen Intervention"),
      desc: t(
        "impact.card2Desc",
        "Identifying foliar pathogens at initial lesion onset allows cultural sanitation before entire fields require emergency spraying."
      ),
      metric: "Proactive Protection",
      metricSub: "Early foliar screening"
    },
    {
      id: "chemical",
      icon: HeartHandshake,
      title: t("impact.card3Title", "Prudent Chemical Stewardship"),
      desc: t(
        "impact.card3Desc",
        "Preventing cross-species false alarms and unconfirmed fungicide applications protects soil biodiversity and reduces input expenses."
      ),
      metric: "Bio-Conservation",
      metricSub: "Calibrated gatekeeper suppression"
    }
  ];

  return (
    <section className="impact-section" id="impact" aria-label="Sustainability Impact">
      <div className="impact-container">
        {/* Header */}
        <div className="impact-header">
          <div className="impact-badge">
            <Sparkles size={16} aria-hidden="true" />
            <span>{t("impact.badge", "Sustainable Farming")}</span>
          </div>
          <h2 className="impact-title">
            {t("impact.title", "Real-World Agronomic Impact")}
          </h2>
          <p className="impact-subtitle">
            {t(
              "impact.subtitle",
              "Science-backed decision support designed to promote long-term soil health, crop health, and resource efficiency."
            )}
          </p>
        </div>

        {/* 3 Impact Cards Grid */}
        <div className="impact-grid">
          {impactCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.id} className="impact-card">
                <div className="impact-card-top">
                  <div className="impact-icon-wrap">
                    <Icon size={26} aria-hidden="true" />
                  </div>
                  <div className="impact-metric-pill">
                    <span className="metric-primary">{card.metric}</span>
                    <span className="metric-secondary">{card.metricSub}</span>
                  </div>
                </div>

                <h3 className="impact-card-title">{card.title}</h3>
                <p className="impact-card-desc">{card.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Qualification notice */}
        <p className="impact-qualification">
          * {t(
            "impact.qualification",
            "Outcomes depend on local agro-climatic conditions, farming practices, and field management."
          )}
        </p>
      </div>
    </section>
  );
}
