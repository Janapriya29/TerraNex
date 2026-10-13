import { FileText, Cpu, CheckCircle2, ArrowRight } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import "./HowItWorksSection.css";

export default function HowItWorksSection() {
  const { t } = useLanguage();

  const steps = [
    {
      num: "01",
      icon: FileText,
      title: t("howItWorks.step1Title", "Input Farm Data"),
      desc: t(
        "howItWorks.step1Desc",
        "Provide soil nutrient metrics (N-P-K), pH, and climate data, or capture a clear photo of plant foliage."
      ),
      tag: "Soil & Photo Input"
    },
    {
      num: "02",
      icon: Cpu,
      title: t("howItWorks.step2Title", "AI Diagnostic Analysis"),
      desc: t(
        "howItWorks.step2Desc",
        "Our Random Forest classifier and two-stage CNN gatekeeper screen inputs against verified agronomic patterns."
      ),
      tag: "Dual AI Engines"
    },
    {
      num: "03",
      icon: CheckCircle2,
      title: t("howItWorks.step3Title", "Review & Act"),
      desc: t(
        "howItWorks.step3Desc",
        "Access clear crop viability rankings with APMC price metrics, or disease management advice with strict safety guidelines."
      ),
      tag: "Calibrated Actions"
    }
  ];

  return (
    <section className="how-it-works-section" id="how-it-works" aria-label="How TerraNex Works">
      <div className="how-container">
        {/* Section Header */}
        <div className="how-header">
          <div className="how-badge">
            <span>{t("howItWorks.badge", "Step-by-Step Workflow")}</span>
          </div>
          <h2 className="how-title">{t("howItWorks.title", "How TerraNex Works")}</h2>
          <p className="how-subtitle">
            {t(
              "howItWorks.subtitle",
              "A transparent 3-step decision flow connecting farm data to reliable agricultural recommendations."
            )}
          </p>
        </div>

        {/* Steps Flow Grid */}
        <div className="steps-wrapper">
          <div className="steps-grid">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.num} className="step-card">
                  <div className="step-card-header">
                    <span className="step-number">{step.num}</span>
                    <span className="step-tag">{step.tag}</span>
                  </div>

                  <div className="step-icon-wrap">
                    <Icon size={28} aria-hidden="true" />
                  </div>

                  <h3 className="step-card-title">{step.title}</h3>
                  <p className="step-card-desc">{step.desc}</p>

                  {index < steps.length - 1 && (
                    <div className="step-arrow" aria-hidden="true">
                      <ArrowRight size={20} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
