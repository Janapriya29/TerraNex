import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sprout,
  Upload,
  ScanLine,
  ArrowLeft,
  Image as ImageIcon,
  CheckCircle,
  AlertCircle,
  Stethoscope,
  ShieldCheck
} from "lucide-react";

import { predictDisease } from "../services/api";
import "./DiseaseDetection.css";

const diseaseInfo = {
  "Potato - Late blight": {
    about:
      "Late blight is a fungal-like disease that affects potato leaves and tubers. It can spread quickly under cool and humid conditions.",

    treatment: [
      "Remove and safely dispose of heavily infected leaves and plants.",
      "Use an appropriate fungicide recommended for late blight control.",
      "Avoid overhead irrigation and keep the foliage as dry as possible."
    ],

    prevention: [
      "Use disease-free planting material.",
      "Provide good spacing and air circulation between plants.",
      "Monitor the crop regularly, especially during cool and wet weather."
    ]
  },

  "Potato - Early blight": {
    about:
      "Early blight is a fungal disease that commonly produces dark spots and yellowing on potato leaves.",

    treatment: [
      "Remove severely affected leaves.",
      "Use a suitable fungicide according to local agricultural recommendations.",
      "Maintain proper irrigation and avoid prolonged leaf wetness."
    ],

    prevention: [
      "Practice crop rotation.",
      "Remove infected plant debris after harvest.",
      "Maintain good plant nutrition and field sanitation."
    ]
  },

  "Tomato - Late blight": {
    about:
      "Late blight is a rapidly spreading disease that can affect tomato leaves, stems and fruits, especially in cool and humid conditions.",

    treatment: [
      "Remove severely infected plant material.",
      "Use a suitable fungicide recommended for tomato late blight.",
      "Improve air circulation and avoid unnecessary leaf wetness."
    ],

    prevention: [
      "Use healthy planting material.",
      "Avoid overhead watering.",
      "Inspect plants regularly during cool and wet periods."
    ]
  },

  "Tomato - Early blight": {
    about:
      "Early blight is a fungal disease that causes dark lesions on tomato leaves and can reduce plant productivity.",

    treatment: [
      "Remove heavily infected leaves.",
      "Apply an appropriate fungicide when recommended.",
      "Avoid watering the leaves directly."
    ],

    prevention: [
      "Practice crop rotation.",
      "Remove infected plant debris.",
      "Maintain adequate spacing between plants."
    ]
  }
};

const defaultDiseaseInfo = {
  about:
    "The AI has detected a possible plant disease. The symptoms should be monitored carefully and confirmed with a local agricultural expert when necessary.",

  treatment: [
    "Remove severely affected plant parts where appropriate.",
    "Maintain good field hygiene and avoid spreading infected material.",
    "Consult a local agricultural expert before applying any chemical treatment."
  ],

  prevention: [
    "Regularly inspect plants for new symptoms.",
    "Maintain proper spacing and air circulation.",
    "Use healthy planting material and maintain good field sanitation."
  ]
};

function DiseaseDetection() {
  const navigate = useNavigate();

  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleFileChange = (event) => {
    const file = event.target.files[0];

    if (!file) return;

    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));

    setResult(null);
    setError("");
  };

  const handleDiseaseDetection = async () => {
    if (!selectedFile) {
      setError("Please select a plant image first.");
      return;
    }

    const userId = localStorage.getItem("user_id");

    if (!userId) {
      setError("Please login again.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setResult(null);

      const data = await predictDisease(
        userId,
        selectedFile
      );

      setResult(data);

    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const currentDiseaseInfo =
    result && diseaseInfo[result.prediction]
      ? diseaseInfo[result.prediction]
      : defaultDiseaseInfo;

  return (
    <div className="disease-page">

      {/* Navbar */}
      <nav className="tool-navbar">

        <div
          className="tool-logo"
          onClick={() => navigate("/dashboard")}
        >
          <Sprout size={28} />
          <span>TerraNex</span>
        </div>

        <button
          className="back-btn"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>

      </nav>


      <main className="disease-content">

        {/* Page Heading */}
        <div className="page-heading">

          <div className="heading-icon">
            <ScanLine size={32} />
          </div>

          <div>

            <h1>Plant Disease Detection</h1>

            <p>
              Upload a clear image of a plant leaf and let our AI
              identify possible diseases.
            </p>

          </div>

        </div>


        <div className="disease-container">

          {/* Upload Section */}
          <div className="upload-section">

            <h2>Upload Plant Image</h2>

            <p>
              Choose a clear image of the affected plant or leaf.
            </p>


            <label className="upload-box">

              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
              />


              {preview ? (

                <img
                  src={preview}
                  alt="Selected plant"
                  className="image-preview"
                />

              ) : (

                <div className="upload-placeholder">

                  <ImageIcon size={50} />

                  <h3>Select an Image</h3>

                  <p>JPG, JPEG or PNG image</p>

                  <div className="upload-button">

                    <Upload size={18} />

                    Choose Image

                  </div>

                </div>

              )}

            </label>


            {selectedFile && (

              <p className="selected-file">
                Selected: {selectedFile.name}
              </p>

            )}


            <button
              className="detect-btn"
              onClick={handleDiseaseDetection}
              disabled={!selectedFile || loading}
            >

              <ScanLine size={20} />

              {loading
                ? "Analyzing Image..."
                : "Detect Disease"}

            </button>


            {error && (

              <p className="disease-error">

                <AlertCircle size={18} />

                {error}

              </p>

            )}

          </div>


          {/* Result Section */}
          <div className="result-section">

            {result ? (

              <div className="disease-result">

                <CheckCircle
                  size={55}
                  className="result-success-icon"
                />

                <p className="result-label">
                  AI DETECTION RESULT
                </p>

                <h2>
                  {result.prediction}
                </h2>


                <div className="confidence-box">

                  <span>Confidence</span>

                  <strong>
                    {result.confidence}%
                  </strong>

                </div>


                <p className="result-description">
                  This prediction has been saved to your
                  TerraNex history.
                </p>


                {/* About Disease */}
                <div className="disease-info-box">

                  <div className="info-title">

                    <Stethoscope size={22} />

                    <h3>About the Disease</h3>

                  </div>

                  <p>
                    {currentDiseaseInfo.about}
                  </p>

                </div>


                {/* Treatment */}
                <div className="disease-info-box">

                  <div className="info-title">

                    <Stethoscope size={22} />

                    <h3>Recommended Treatment</h3>

                  </div>

                  <ul>

                    {currentDiseaseInfo.treatment.map(
                      (item, index) => (

                        <li key={index}>
                          {item}
                        </li>

                      )
                    )}

                  </ul>

                </div>


                {/* Prevention */}
                <div className="disease-info-box">

                  <div className="info-title">

                    <ShieldCheck size={22} />

                    <h3>Prevention</h3>

                  </div>

                  <ul>

                    {currentDiseaseInfo.prevention.map(
                      (item, index) => (

                        <li key={index}>
                          {item}
                        </li>

                      )
                    )}

                  </ul>

                </div>


                <div className="treatment-warning">

                  <AlertCircle size={18} />

                  <span>
                    Treatment recommendations are general
                    guidance. For severe infections, consult
                    a qualified agricultural expert before
                    using pesticides or fungicides.
                  </span>

                </div>

              </div>

            ) : (

              <div className="result-placeholder">

                <Sprout size={55} />

                <h2>AI Analysis Result</h2>

                <p>

                  Upload an image and click

                  <strong>
                    {" "}Detect Disease{" "}
                  </strong>

                  to see the AI prediction.

                </p>

              </div>

            )}

          </div>

        </div>

      </main>

    </div>
  );
}

export default DiseaseDetection;