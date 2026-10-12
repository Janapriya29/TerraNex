import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sprout,
  Mail,
  Lock,
  LogIn
} from "lucide-react";

import { loginUser } from "../services/api";
import "./Auth.css";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // =====================================
  // LOGIN
  // =====================================

  const handleLogin = async (event) => {
    event.preventDefault();

    setMessage("");

    // Check empty fields
    if (!email || !password) {
      setMessage("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      // Call backend login API
      const data = await loginUser(
        email,
        password
      );

      // =====================================
      // SAVE USER SESSION
      // =====================================

      localStorage.setItem(
        "user_id",
        data.user_id
      );

      localStorage.setItem(
        "user_name",
        data.name
      );

      localStorage.setItem(
        "user_email",
        data.email
      );

      setMessage("Login successful!");

      // Go to dashboard
      navigate("/dashboard", {
        replace: true
      });

    } catch (error) {

      setMessage(
        error.message ||
        "Login failed. Please try again."
      );

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

          <Link
            to="/"
            className="auth-logo"
          >
            <Sprout size={32} />

            <span>
              TerraNex
            </span>
          </Link>

          <h1>
            Welcome Back!
          </h1>

          <p>
            Login to continue your smart
            farming journey.
          </p>

        </div>


        {/* =================================
            LOGIN CARD
        ================================= */}

        <div className="auth-card">

          <h2>
            Login
          </h2>

          <p className="auth-subtitle">
            Enter your details to access
            your account.
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

              <label>
                Email Address
              </label>

              <div className="input-wrapper">

                <Mail size={19} />

                <input
                  type="email"
                  name="email"
                  id="email"
                  placeholder="Enter your email"
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

              <label>
                Password
              </label>

              <div className="input-wrapper">

                <Lock size={19} />

                <input
                  type="password"
                  name="password"
                  id="password"
                  placeholder="Enter your password"
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
              <p className="auth-message">
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
                ? "Logging in..."
                : "Login"}

            </button>

          </form>


          {/* =================================
              CREATE ACCOUNT
          ================================= */}

          <p className="auth-switch">

            Don't have an account?{" "}

            <Link to="/register">
              Create Account
            </Link>

          </p>

        </div>

      </div>

    </div>
  );
}

export default Login;