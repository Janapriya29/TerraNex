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

  const handleRegister = async (event) => {
    event.preventDefault();

    setMessage("");

    if (!name || !email || !password) {
      setMessage("Please fill in all fields.");
      return;
    }

    try {
      setLoading(true);

      const data = await registerUser(name, email, password);

      setMessage(data.message || "Account created successfully!");

      setTimeout(() => {
        navigate("/login");
      }, 1000);

    } catch (error) {
      setMessage(error.message);
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
              <label>Full Name</label>

              <div className="input-wrapper">
                <User size={19} />

                <input
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
            </div>

            <div className="input-group">
              <label>Email Address</label>

              <div className="input-wrapper">
                <Mail size={19} />

                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </div>

            <div className="input-group">
              <label>Password</label>

              <div className="input-wrapper">
                <Lock size={19} />

                <input
                  type="password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            </div>

            {message && (
              <p className="auth-message">
                {message}
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