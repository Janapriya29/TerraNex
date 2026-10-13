/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useMemo } from "react";
import en from "../i18n/en.json";
import ta from "../i18n/ta.json";
import hi from "../i18n/hi.json";

const translations = { en, ta, hi };
const LANG_STORAGE_KEY = "terranex_lang";

const LanguageContext = createContext({
  language: "en",
  setLanguage: () => {},
  t: (key) => key,
  formatCropDisplayName: (crop) => crop,
  formatDiseaseDisplayName: (disease) => disease,
  formatSpeciesDisplayName: (species) => species,
  formatStatusDisplayName: (status) => status
});

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      if (saved && translations[saved]) {
        return saved;
      }
    } catch {
      // Fallback
    }
    return "en";
  });

  const setLanguage = (lang) => {
    if (translations[lang]) {
      setLanguageState(lang);
      try {
        localStorage.setItem(LANG_STORAGE_KEY, lang);
      } catch {
        // Ignore localStorage restrictions
      }
    }
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = useMemo(() => {
    return (keyPath, fallback = "") => {
      const keys = keyPath.split(".");
      
      // 1. Try current language
      let current = translations[language];
      for (const k of keys) {
        if (current && typeof current === "object" && k in current) {
          current = current[k];
        } else {
          current = undefined;
          break;
        }
      }
      if (typeof current === "string" || Array.isArray(current)) {
        return current;
      }

      // 2. Fall back to English
      let fallbackVal = translations.en;
      for (const k of keys) {
        if (fallbackVal && typeof fallbackVal === "object" && k in fallbackVal) {
          fallbackVal = fallbackVal[k];
        } else {
          fallbackVal = undefined;
          break;
        }
      }
      if (typeof fallbackVal === "string" || Array.isArray(fallbackVal)) {
        return fallbackVal;
      }

      return fallback || keyPath;
    };
  }, [language]);

  // Safe display formatting helpers for dynamic text
  const formatCropDisplayName = useMemo(() => {
    return (cropName) => {
      if (!cropName) return "";
      const clean = String(cropName).trim();
      const key = clean.toLowerCase().replace(/[\s-]+/g, "_");
      const noUnderscore = clean.toLowerCase().replace(/[\s-_]+/g, "");
      
      const translated = t(`crops.${key}`, "") || t(`crops.${noUnderscore}`, "");
      if (translated && typeof translated === "string") {
        return translated;
      }
      return clean
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
    };
  }, [t]);

  const formatDiseaseDisplayName = useMemo(() => {
    return (diseaseName) => {
      if (!diseaseName) return "";
      const clean = String(diseaseName).trim();
      const translated = t(`diseases.${clean}`, "");
      if (translated && typeof translated === "string") {
        return translated;
      }
      return clean;
    };
  }, [t]);

  const formatSpeciesDisplayName = useMemo(() => {
    return (speciesName) => {
      if (!speciesName) return "";
      const clean = String(speciesName).trim();
      const translated = t(`species.${clean}`, "");
      if (translated && typeof translated === "string") {
        return translated;
      }
      return clean;
    };
  }, [t]);

  const formatStatusDisplayName = useMemo(() => {
    return (statusCode) => {
      if (!statusCode) return "";
      const clean = String(statusCode).trim();
      const translated = t(`statuses.${clean}`, "");
      if (translated && typeof translated === "string") {
        return translated;
      }
      return clean.replace(/_/g, " ");
    };
  }, [t]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t,
    formatCropDisplayName,
    formatDiseaseDisplayName,
    formatSpeciesDisplayName,
    formatStatusDisplayName
  }), [
    language,
    t,
    formatCropDisplayName,
    formatDiseaseDisplayName,
    formatSpeciesDisplayName,
    formatStatusDisplayName
  ]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
