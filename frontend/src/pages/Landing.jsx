import Navbar from "../components/layout/Navbar";
import HeroSection from "../components/landing/HeroSection";
import StatsSection from "../components/landing/StatsSection";
import TryDemoSection from "../components/landing/TryDemoSection";
import HowItWorksSection from "../components/landing/HowItWorksSection";
import FeaturesSection from "../components/landing/FeaturesSection";
import LeafComparisonSection from "../components/landing/LeafComparisonSection";
import ImpactSection from "../components/landing/ImpactSection";
import TechStackSection from "../components/landing/TechStackSection";
import FinalCTASection from "../components/landing/FinalCTASection";
import Footer from "../components/layout/Footer";
import "./Landing.css";

export default function Landing() {
  return (
    <div className="landing-page-root">
      {/* 1. Sticky Navigation */}
      <Navbar />

      <main id="main-content">
        {/* 2. Hero Section */}
        <HeroSection />

        {/* 3. Statistics Strip */}
        <StatsSection />

        {/* 4. Interactive "Try It Now" Demo */}
        <TryDemoSection />

        {/* 5. How It Works */}
        <HowItWorksSection />

        {/* 6. Feature Cards */}
        <FeaturesSection />

        {/* 7. Healthy vs. Diseased Foliage */}
        <LeafComparisonSection />

        {/* 8. Impact and Sustainability */}
        <ImpactSection />

        {/* 9. Technology Stack */}
        <TechStackSection />

        {/* 10. Final Call to Action */}
        <FinalCTASection />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}