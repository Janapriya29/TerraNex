import { Cpu, Server, Database, Code2, Layers, Binary, Box, Zap } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import "./TechStackSection.css";

export default function TechStackSection() {
  const { t } = useLanguage();

  const technologies = [
    {
      name: "React 18",
      category: "Frontend UI",
      role: "Component Architecture & State",
      icon: Code2,
      status: "Active"
    },
    {
      name: "Vite",
      category: "Build Tooling",
      role: "High-Performance Bundling & HMR",
      icon: Zap,
      status: "Active"
    },
    {
      name: "FastAPI",
      category: "API Framework",
      role: "Async Python REST Microservices",
      icon: Server,
      status: "Active"
    },
    {
      name: "Python 3",
      category: "Core Language",
      role: "Scientific Computing & Backend Logic",
      icon: Binary,
      status: "Active"
    },
    {
      name: "TensorFlow / Keras",
      category: "Deep Learning",
      role: "2-Stage Foliar CNN Gatekeeper",
      icon: Layers,
      status: "Active"
    },
    {
      name: "Scikit-Learn",
      category: "Machine Learning",
      role: "Random Forest 22-Crop Classification",
      icon: Cpu,
      status: "Active"
    },
    {
      name: "MongoDB",
      category: "Database",
      role: "Encrypted User Profiles & Diagnostic Logs",
      icon: Database,
      status: "Active"
    },
    {
      name: "Docker Containerization",
      category: "Infrastructure",
      role: "Containerized Microservice Deployment",
      icon: Box,
      status: "Coming Soon",
      isRoadmap: true
    }
  ];

  return (
    <section className="tech-stack-section" id="technology" aria-label="Technology Stack">
      <div className="tech-container">
        {/* Header */}
        <div className="tech-header">
          <div className="tech-badge">
            <Cpu size={16} aria-hidden="true" />
            <span>{t("tech.badge", "Engineering Architecture")}</span>
          </div>
          <h2 className="tech-title">
            {t("tech.title", "Robust Nature-Tech Stack")}
          </h2>
          <p className="tech-subtitle">
            {t(
              "tech.subtitle",
              "Engineered with modern, performant, and reproducible technologies across the ML pipeline and web service."
            )}
          </p>
        </div>

        {/* Tech Grid */}
        <div className="tech-grid">
          {technologies.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.name}
                className={`tech-card ${item.isRoadmap ? "roadmap-card" : ""}`}
              >
                <div className="tech-card-header">
                  <div className="tech-icon-wrap">
                    <Icon size={22} aria-hidden="true" />
                  </div>
                  {item.isRoadmap ? (
                    <span className="roadmap-badge">
                      {t("tech.dockerStatus", "Planned / In Roadmap")}
                    </span>
                  ) : (
                    <span className="active-badge">Production</span>
                  )}
                </div>

                <div className="tech-card-body">
                  <h3 className="tech-name">{item.name}</h3>
                  <span className="tech-cat">{item.category}</span>
                  <p className="tech-role">{item.role}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
