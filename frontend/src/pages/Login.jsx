import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sprout,
  Mail,
  Lock,
  LogIn
} from "lucide-react";

import { loginUser } from "../services/api";
import { useLanguage } from "../context/LanguageContext";
import LanguageSelector from "../components/common/LanguageSelector";
import "./Auth.css";

function Login() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  // =====================================
  // LOGIN
  // =====================================

  const handleLogin = async (event) => {
    event.preventDefault();

    setMessage("");
    setMessageType("");

    const normalizedEmail = email.trim().toLowerCase();

    // Check empty fields
    if (!normalizedEmail || !password) {
      setMessage(t("auth.loginRequiredFields", "Please enter your email and password."));
      setMessageType("error");
      return;
    }

    try {
      setLoading(true);

      // Call backend login API
      const data = await loginUser(
        normalizedEmail,
        password
      );

      // =====================================
      // SAVE USER SESSION
      // =====================================

      localStorage.setItem("user_id", data.user_id);
      localStorage.setItem("user_name", data.name);
      localStorage.setItem("user_email", data.email);

      setMessage(t("auth.loginSuccess", "Login successful!"));
      setMessageType("success");

      // Go to dashboard
      navigate("/dashboard", {
        replace: true
      });

    } catch (error) {
      setMessage(
        error.message ||
        t("auth.loginErrorDefault", "Login failed. Please check your credentials.")
      );
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">

      <div className="auth-container">

        {/* =================================
            BRAND
        ================================= */}

        <div className="auth-brand">

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "50px" }}>
            <Link
              to="/"
              className="auth-logo"
              style={{ marginBottom: 0 }}
            >
              <Sprout size={32} />
              <span>TerraNex</span>
            </Link>

            <LanguageSelector />
          </div>

          <h1>
            {t("auth.loginTitle", "Welcome Back!")}
          </h1>

          <p>
            {t("auth.loginSubtitle", "Login to continue your smart farming journey.")}
          </p>

        </div>


        {/* =================================
            LOGIN CARD
        ================================= */}

        <div className="auth-card">

          <h2>
            {t("auth.loginCardTitle", "Login")}
          </h2>

          <p className="auth-subtitle">
            {t("auth.loginCardSubtitle", "Enter your details to access your account.")}
          </p>


          {/* =================================
              LOGIN FORM
          ================================= */}

          <form
            onSubmit={handleLogin}
            autoComplete="on"
          >

            {/* =================================
                EMAIL
            ================================= */}

            <div className="input-group">

              <label htmlFor="login-email">
                {t("auth.emailLabel", "Email Address")}
              </label>

              <div className="input-wrapper">

                <Mail size={19} />

                <input
                  type="email"
                  name="email"
                  id="login-email"
                  placeholder={t("auth.emailPlaceholder", "Enter your email")}
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  autoComplete="username"
                  required
                />

              </div>

            </div>


            {/* =================================
                PASSWORD
            ================================= */}

            <div className="input-group">

              <label htmlFor="login-password">
                {t("auth.passwordLabel", "Password")}
              </label>

              <div className="input-wrapper">

                <Lock size={19} />

                <input
                  type="password"
                  name="password"
                  id="login-password"
                  placeholder={t("auth.passwordPlaceholder", "Enter your password")}
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  autoComplete="current-password"
                  required
                />

              </div>

            </div>


            {/* =================================
                MESSAGE
            ================================= */}

            {message && (
              <p
                className={`auth-message ${messageType}`.trim()}
                role="status"
                aria-live="polite"
              >
                {message}
              </p>
            )}


            {/* =================================
                LOGIN BUTTON
            ================================= */}

            <button
              type="submit"
              className="auth-btn"
              disabled={loading}
            >

              <LogIn size={19} />

              {loading
                ? t("auth.loggingIn", "Logging in...")
                : t("auth.loginBtn", "Login")}

            </button>

          </form>


          {/* =================================
              CREATE ACCOUNT
          ================================= */}

          <p className="auth-switch">

            {t("auth.noAccount", "Don't have an account?")}{" "}

            <Link to="/register">
              {t("auth.registerHere", "Register here")}
            </Link>

          </p>

        </div>

      </div>

    </div>
  );
}

export default Login;