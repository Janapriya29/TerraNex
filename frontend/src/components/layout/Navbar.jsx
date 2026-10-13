import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Sprout, Sun, Moon, Globe, Menu, X, User, ArrowRight, LayoutDashboard } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import "./Navbar.css";

export default function Navbar() {
  const { isDark, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const langPickerRef = useRef(null);

  // Check auth reactively
  const [currentUser, setCurrentUser] = useState(() => {
    if (typeof window === "undefined") return { id: null, name: null };
    const id = localStorage.getItem("user_id");
    const name = localStorage.getItem("user_name");
    const isValid = Boolean(id && id !== "undefined" && id !== "null" && /^[0-9a-fA-F]{24}$/.test(id.trim()));
    return { id: isValid ? id : null, name };
  });

  useEffect(() => {
    const syncAuth = () => {
      if (typeof window === "undefined") return;
      const id = localStorage.getItem("user_id");
      const name = localStorage.getItem("user_name");
      const isValid = Boolean(id && id !== "undefined" && id !== "null" && /^[0-9a-fA-F]{24}$/.test(id.trim()));
      setCurrentUser({ id: isValid ? id : null, name });
    };

    syncAuth();
    window.addEventListener("storage", syncAuth);
    return () => window.removeEventListener("storage", syncAuth);
  }, []);

  const userId = currentUser.id;
  const userName = currentUser.name;

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close menus on Escape key and click outside
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
        setLangDropdownOpen(false);
      }
    };

    const handleClickOutside = (e) => {
      if (langPickerRef.current && !langPickerRef.current.contains(e.target)) {
        setLangDropdownOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const languages = [
    { code: "en", label: "English", short: "EN" },
    { code: "ta", label: "தமிழ்", short: "தம" },
    { code: "hi", label: "हिंदी", short: "हि" }
  ];

  return (
    <header className={`site-header ${isScrolled ? "scrolled" : ""}`}>
      <div className="header-container">
        {/* Brand Logo */}
        <Link to="/" className="brand-logo" onClick={closeMobileMenu}>
          <div className="logo-icon-wrapper">
            <Sprout className="logo-icon" size={26} aria-hidden="true" />
          </div>
          <span className="brand-name">
            Terra<span className="brand-accent">Nex</span>
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="desktop-nav" aria-label="Main Navigation">
          <a href="#features" className="nav-link">
            {t("nav.features", "Features")}
          </a>
          <a href="#how-it-works" className="nav-link">
            {t("nav.howItWorks", "How It Works")}
          </a>
          <a href="#demo" className="nav-link">
            {t("nav.demo", "Interactive Demo")}
          </a>
          <a href="#technology" className="nav-link">
            {t("nav.technology", "Technology")}
          </a>
        </nav>

        {/* Action Controls (Lang, Theme, Auth) */}
        <div className="header-actions">
          {/* Language Selector */}
          <div className="lang-picker-wrapper" ref={langPickerRef}>
            <button
              type="button"
              className="lang-picker-btn"
              onClick={() => setLangDropdownOpen(!langDropdownOpen)}
              aria-label="Change language"
              aria-expanded={langDropdownOpen}
            >
              <Globe size={18} aria-hidden="true" />
              <span className="lang-label">
                {languages.find((l) => l.code === language)?.short || "EN"}
              </span>
            </button>

            {langDropdownOpen && (
              <div className="lang-dropdown" role="menu">
                {languages.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    className={`lang-option ${language === item.code ? "active" : ""}`}
                    onClick={() => {
                      setLanguage(item.code);
                      setLangDropdownOpen(false);
                    }}
                    role="menuitem"
                  >
                    <span>{item.label}</span>
                    {language === item.code && <span className="lang-check">•</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={isDark ? t("nav.themeLight", "Switch to light mode") : t("nav.themeDark", "Switch to dark mode")}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? (
              <Sun size={20} className="theme-icon sun" aria-hidden="true" />
            ) : (
              <Moon size={20} className="theme-icon moon" aria-hidden="true" />
            )}
          </button>

          {/* Auth Controls */}
          {userId ? (
            <div className="user-nav-group">
              <Link to="/dashboard" className="btn btn-dashboard">
                <LayoutDashboard size={18} aria-hidden="true" />
                <span>{t("nav.dashboard", "Dashboard")}</span>
              </Link>
              <div className="user-badge" title={userName || "Farmer Profile"}>
                <User size={16} aria-hidden="true" />
                <span className="user-badge-name">{userName ? userName.split(" ")[0] : "Account"}</span>
              </div>
            </div>
          ) : (
            <div className="guest-nav-group">
              <Link to="/login" className="btn btn-ghost">
                {t("nav.login", "Login")}
              </Link>
              <Link to="/register" className="btn btn-primary btn-signup">
                <span>{t("nav.signup", "Sign Up")}</span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          )}

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? t("nav.menuClose", "Close menu") : t("nav.menuOpen", "Open menu")}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="mobile-drawer" role="dialog" aria-modal="true">
          <div className="mobile-nav-links">
            <a href="#features" className="mobile-nav-link" onClick={closeMobileMenu}>
              {t("nav.features", "Features")}
            </a>
            <a href="#how-it-works" className="mobile-nav-link" onClick={closeMobileMenu}>
              {t("nav.howItWorks", "How It Works")}
            </a>
            <a href="#demo" className="mobile-nav-link" onClick={closeMobileMenu}>
              {t("nav.demo", "Interactive Demo")}
            </a>
            <a href="#technology" className="mobile-nav-link" onClick={closeMobileMenu}>
              {t("nav.technology", "Technology")}
            </a>
          </div>

          <div className="mobile-drawer-divider" />

          {/* Mobile Language Switcher */}
          <div className="mobile-lang-row">
            <span className="mobile-section-label">{t("common.language", "Language")}:</span>
            <div className="mobile-lang-buttons">
              {languages.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  className={`mobile-lang-pill ${language === item.code ? "active" : ""}`}
                  onClick={() => {
                    setLanguage(item.code);
                    closeMobileMenu();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile Auth Actions */}
          <div className="mobile-auth-actions">
            {userId ? (
              <Link to="/dashboard" className="btn btn-dashboard btn-block" onClick={closeMobileMenu}>
                <LayoutDashboard size={18} aria-hidden="true" />
                <span>{t("nav.dashboard", "Dashboard")}</span>
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-secondary btn-block" onClick={closeMobileMenu}>
                  {t("nav.login", "Login")}
                </Link>
                <Link to="/register" className="btn btn-primary btn-block" onClick={closeMobileMenu}>
                  <span>{t("nav.signup", "Sign Up")}</span>
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
