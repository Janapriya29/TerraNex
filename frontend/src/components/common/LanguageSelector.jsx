import { useState, useEffect, useRef } from "react";
import { Globe } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import "./LanguageSelector.css";

export default function LanguageSelector({ className = "" }) {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const languages = [
    { code: "en", label: "English", short: "EN" },
    { code: "ta", label: "தமிழ்", short: "தம" },
    { code: "hi", label: "हिंदी", short: "हि" }
  ];

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const currentLang = languages.find((l) => l.code === language) || languages[0];

  return (
    <div className={`lang-selector-root ${className}`.trim()} ref={containerRef}>
      <button
        type="button"
        className="lang-selector-btn"
        onClick={() => setOpen(!open)}
        aria-label="Change language"
        aria-expanded={open}
        title="Select Language / மொழியை மாற்றுக / भाषा चुनें"
      >
        <Globe size={18} aria-hidden="true" />
        <span className="lang-code-text">{currentLang.short}</span>
      </button>

      {open && (
        <div className="lang-selector-menu" role="menu">
          {languages.map((item) => (
            <button
              key={item.code}
              type="button"
              className={`lang-selector-item ${language === item.code ? "active" : ""}`}
              onClick={() => {
                setLanguage(item.code);
                setOpen(false);
              }}
              role="menuitem"
            >
              <span className="lang-item-label">{item.label}</span>
              {language === item.code && <span className="lang-active-dot">•</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
