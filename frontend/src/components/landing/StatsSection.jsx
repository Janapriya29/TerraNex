import { useEffect, useRef, useState } from "react";
import { Sprout, ShieldCheck, TrendingUp, Layers } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import "./StatsSection.css";

export default function StatsSection() {
  const { t } = useLanguage();
  const sectionRef = useRef(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  // Animated counters
  const [cropsCount, setCropsCount] = useState(0);
  const [marketCount, setMarketCount] = useState(0);
  const [modulesCount, setModulesCount] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);

          // Counter animation logic
          const duration = 1200;
          const startTime = performance.now();

          const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const ease = 1 - Math.pow(1 - progress, 3);

            setCropsCount(Math.floor(ease * 22));
            setMarketCount(Math.floor(ease * 17));
            setModulesCount(Math.floor(ease * 3));

            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              setCropsCount(22);
              setMarketCount(17);
              setModulesCount(3);
            }
          };

          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.25 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [hasAnimated]);

  const stats = [
    {
      id: "crops",
      icon: Sprout,
      value: hasAnimated ? cropsCount : 22,
      suffix: "",
      title: t("stats.cropsTitle", "Supported Crops"),
      desc: t("stats.cropsDesc", "Trained across 22 major Indian commercial and food crop varieties")
    },
    {
      id: "pipeline",
      icon: ShieldCheck,
      value: "2-Stage",
      suffix: "",
      title: t("stats.gatekeeperTitle", "2-Stage AI Pipeline"),
      desc: t("stats.gatekeeperDesc", "Foliar species gatekeeper prevents cross-species disease false alarms")
    },
    {
      id: "market",
      icon: TrendingUp,
      value: hasAnimated ? marketCount : 17,
      suffix: "",
      title: t("stats.marketTitle", "APMC Commodities"),
      desc: t("stats.marketDesc", "Integrated modal prices, cost estimates, and real-time viability scoring")
    },
    {
      id: "modules",
      icon: Layers,
      value: hasAnimated ? modulesCount : 3,
      suffix: "",
      title: t("stats.modulesTitle", "Core AI Modules"),
      desc: t("stats.modulesDesc", "Agronomic suitability, plant pathology screening, and market insights")
    }
  ];

  return (
    <section className="stats-section" ref={sectionRef} aria-label="Platform Statistics">
      <div className="stats-container">
        <div className="stats-grid">
          {stats.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.id} className="stat-card">
                <div className="stat-icon-wrapper">
                  <Icon size={24} aria-hidden="true" />
                </div>
                <div className="stat-value-group">
                  <span className="stat-number">
                    {item.value}
                    {item.suffix}
                  </span>
                  <h3 className="stat-heading">{item.title}</h3>
                </div>
                <p className="stat-desc">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
