
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sprout, User, Mail, Lock, UserPlus } from "lucide-react";
import { registerUser } from "../services/api";
import "./Auth.css";

function Register() {
  const navigate = useNavigate();

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

    if (!name.trim() || !email.trim() || !password) {
      setMessage("Please fill in all fields.");
      setMessageType("error");
      return;
    }

    try {
      setLoading(true);

      const data = await registerUser(
        name.trim(),
        email.trim(),
        password
      );

      setMessage(data.message || "Account created successfully!");
      setMessageType("success");

      setTimeout(() => {
        navigate("/login");
      }, 1000);
    } catch (error) {
      setMessage(
        error.message ||
          "Unable to create your account. Please try again."
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
          <Link to="/" className="auth-logo">
            <Sprout size={32} />
            <span>TerraNex</span>
          </Link>

          <h1>Join TerraNex</h1>

          <p>
            Create your account and start making smarter farming decisions.
          </p>
        </div>

        <div className="auth-card">
          <h2>Create Account</h2>

          <p className="auth-subtitle">
            Enter your details to get started.
          </p>

          <form onSubmit={handleRegister}>
            <div className="input-group">
              <label htmlFor="register-name">Full Name</label>

              <div className="input-wrapper">
                <User size={19} />

                <input
                  id="register-name"
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="register-email">Email Address</label>

              <div className="input-wrapper">
                <Mail size={19} />

                <input
                  id="register-email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="register-password">Password</label>

              <div className="input-wrapper">
                <Lock size={19} />

                <input
                  id="register-password"
                  type="password"
                  placeholder="Create a password"
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
                className="auth-message"
                role="status"
                aria-live="polite"
              >
                {message}
              </p>
            )}

            {loading && (
              <p role="status" aria-live="polite">
                Your account is being created. The server may take a
                little longer to respond if it has been inactive.
                Please wait...
              </p>
            )}

            <button
              type="submit"
              className="auth-btn"
              disabled={loading}
            >
              <UserPlus size={19} />

              {loading ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account?{" "}
            <Link to="/login">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
