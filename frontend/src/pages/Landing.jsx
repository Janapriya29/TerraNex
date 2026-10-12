import { Link } from "react-router-dom";
import { Sprout, Leaf, ArrowRight, Brain } from "lucide-react";
import "./Landing.css";

function Landing() {
  return (
    <div className="landing-page">

      {/* Navigation */}
      <nav className="navbar">
        <div className="logo">
          <Sprout size={32} />
          <span>TerraNex</span>
        </div>

        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#about">About</a>

          <Link to="/login" className="login-btn">
            Login
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="hero">

        <div className="hero-content">

          <div className="tag">
            <Leaf size={18} />
            AI Powered Agriculture
          </div>

          <h1>
            Smart Farming.
            <span> Better Decisions.</span>
          </h1>

          <p>
            TerraNex helps farmers make smarter agricultural decisions
            using Artificial Intelligence, crop recommendation, disease
            prediction and market analysis.
          </p>

          <div className="hero-buttons">

            <Link to="/register" className="primary-btn">
              Get Started
              <ArrowRight size={20} />
            </Link>

            <a href="#features" className="secondary-btn">
              Explore Features
            </a>

          </div>
        </div>

        {/* Right Side AI Card */}
        <div className="hero-visual">

          <div className="ai-card">

            <div className="ai-icon">
              <Brain size={45} />
            </div>

            <h2>AI Agriculture Assistant</h2>

            <p>
              Get intelligent crop and disease recommendations
              based on your agricultural data.
            </p>

            <div className="status">
              <span className="status-dot"></span>
              AI System Active
            </div>

          </div>

          <div className="floating-card crop-card">
            🌱 Crop Recommendation
          </div>

          <div className="floating-card disease-card">
            🔬 Disease Detection
          </div>

        </div>
      </main>

      {/* Features Section */}
      <section className="features" id="features">

        <h2>Everything You Need for Smarter Farming</h2>

        <div className="feature-grid">

          <div className="feature-card">
            <Sprout size={35} />

            <h3>Crop Recommendation</h3>

            <p>
              Find suitable crops based on soil nutrients and
              environmental conditions.
            </p>
          </div>

          <div className="feature-card">
            <Leaf size={35} />

            <h3>Disease Detection</h3>

            <p>
              Upload a plant image and use Artificial Intelligence
              to identify possible crop diseases.
            </p>
          </div>

          <div className="feature-card">
            <Brain size={35} />

            <h3>Market Analysis</h3>

            <p>
              Compare crop recommendations with market information
              and make better farming decisions.
            </p>
          </div>

        </div>
      </section>

      {/* About Section */}
      <section
        id="about"
        style={{
          padding: "70px 8%",
          textAlign: "center",
          background: "#f7fbf7"
        }}
      >
        <h2>About TerraNex</h2>

        <p
          style={{
            maxWidth: "700px",
            margin: "20px auto",
            lineHeight: "1.7",
            color: "#617468"
          }}
        >
          TerraNex is an AI-powered smart agriculture platform designed
          to help farmers choose suitable crops, detect plant diseases,
          and analyze market opportunities using intelligent technology.
        </p>
      </section>

    </div>
  );
}

export default Landing;