import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sprout, User, Mail, Lock, UserPlus } from "lucide-react";
import { registerUser } from "../services/api";
import { useLanguage } from "../context/LanguageContext";
import LanguageSelector from "../components/common/LanguageSelector";
import "./Auth.css";

function Register() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const handleRegister = async (event) => {
    event.preventDefault();

    if (loading) return;

    setMessage("");
    setMessageType("");

    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!trimmedName || !normalizedEmail || !password) {
      setMessage(t("auth.registerRequiredFields", "Please fill in all fields."));
      setMessageType("error");
      return;
    }

    try {
      setLoading(true);

      const data = await registerUser(
        trimmedName,
        normalizedEmail,
        password
      );

      setMessage(data.message || t("auth.registerSuccess", "Account created successfully!"));
      setMessageType("success");

      setTimeout(() => {
        navigate("/login");
      }, 1000);
    } catch (error) {
      setMessage(
        error.message ||
        t("auth.registerErrorDefault", "Unable to create your account. Please try again.")
      );
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-brand">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "50px" }}>
            <Link to="/" className="auth-logo" style={{ marginBottom: 0 }}>
              <Sprout size={32} />
              <span>TerraNex</span>
            </Link>

            <LanguageSelector />
          </div>

          <h1>{t("auth.registerTitle", "Join TerraNex")}</h1>

          <p>
            {t("auth.registerSubtitle", "Create your account and start making smarter farming decisions.")}
          </p>
        </div>

        <div className="auth-card">
          <h2>{t("auth.registerCardTitle", "Create Account")}</h2>

          <p className="auth-subtitle">
            {t("auth.registerCardSubtitle", "Enter your details to get started.")}
          </p>

          <form onSubmit={handleRegister}>
            <div className="input-group">
              <label htmlFor="register-name">{t("auth.nameLabel", "Full Name")}</label>

              <div className="input-wrapper">
                <User size={19} />

                <input
                  id="register-name"
                  type="text"
                  placeholder={t("auth.namePlaceholder", "Enter your name")}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="register-email">{t("auth.emailLabel", "Email Address")}</label>

              <div className="input-wrapper">
                <Mail size={19} />

                <input
                  id="register-email"
                  type="email"
                  placeholder={t("auth.emailPlaceholder", "Enter your email")}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="register-password">{t("auth.passwordLabel", "Password")}</label>

              <div className="input-wrapper">
                <Lock size={19} />

                <input
                  id="register-password"
                  type="password"
                  placeholder={t("auth.registerPasswordPlaceholder", "Create a password")}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {message && (
              <p
                className={`auth-message ${messageType}`.trim()}
                role="status"
                aria-live="polite"
              >
                {message}
              </p>
            )}

            {loading && (
              <p role="status" aria-live="polite">
                {t("auth.registerWaitingMessage", "Your account is being created. The server may take a little longer to respond if it has been inactive. Please wait...")}
              </p>
            )}

            <button
              type="submit"
              className="auth-btn"
              disabled={loading}
            >
              <UserPlus size={19} />

              {loading ? t("auth.creatingAccount", "Creating Account...") : t("auth.registerBtn", "Create Account")}
            </button>
          </form>

          <p className="auth-switch">
            {t("auth.hasAccount", "Already have an account?")}{" "}
            <Link to="/login">
              {t("auth.loginLink", "Login")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
