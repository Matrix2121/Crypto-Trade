import { GoogleLogin } from "@react-oauth/google";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";
import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppContext } from "../../context/AppContext";
import { completeGoogleLogin, persistUserSession } from "../../utils/completeGoogleLogin";
import { isNativeApp } from "../../utils/isNativeApp";
import "./LandingPage.css";

const LandingPage = () => {
  const navigate = useNavigate();
  const { setUser } = useContext(AppContext);
  const [nativeSigningIn, setNativeSigningIn] = useState(false);
  const native = isNativeApp();

  const finishLogin = async (idToken) => {
    const data = await completeGoogleLogin(idToken);
    persistUserSession(data, setUser);
    navigate("/market");
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      await finishLogin(credentialResponse.credential);
    } catch (error) {
      console.error("Login failed:", error);
      alert("Login failed");
    }
  };

  const handleNativeGoogleSignIn = async () => {
    setNativeSigningIn(true);
    try {
      const result = await GoogleAuth.signIn();
      const idToken = result?.authentication?.idToken;
      if (!idToken) {
        throw new Error("Google sign-in did not return an ID token");
      }
      await finishLogin(idToken);
    } catch (error) {
      console.error("Native Google login failed:", error);
      alert(error?.message || "Login failed");
    } finally {
      setNativeSigningIn(false);
    }
  };

  const handleGoogleError = (error) => {
    console.error("Google Login Error:", error);
  };

  return (
    <main className="landing">
      <section className="landing-hero">
        <div className="landing-hero-content">
          <p className="landing-kicker">Crypto Trading Simulator</p>
          <h1 className="landing-title">Trade smarter without risking real funds.</h1>
          <p className="landing-subtitle">
            Track your portfolio, simulate buys and sells, and explore market movement.
          </p>

          <div className="landing-cta-row">
            <div className="login-container">
              {native ? (
                <button
                  type="button"
                  className="landing-google-btn"
                  onClick={handleNativeGoogleSignIn}
                  disabled={nativeSigningIn}
                >
                  {nativeSigningIn ? "Signing in…" : "Sign in with Google"}
                </button>
              ) : (
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  useOneTap
                />
              )}
            </div>
          </div>
        </div>

        <div className="landing-hero-card" aria-hidden="true">
          <div className="landing-metric">
            <span className="landing-metric-label">Balance</span>
            <span className="landing-metric-value">$10,000.00</span>
          </div>
          <div className="landing-divider" />
          <div className="landing-metric">
            <span className="landing-metric-label">Strategy</span>
            <span className="landing-metric-value">Simulated</span>
          </div>
          <div className="landing-divider" />
          <div className="landing-tags">
            <span className="landing-tag buy">Buy</span>
            <span className="landing-tag sell">Sell</span>
            <span className="landing-tag neutral">Track</span>
          </div>
        </div>
      </section>
    </main>
  );
};

export default LandingPage;
