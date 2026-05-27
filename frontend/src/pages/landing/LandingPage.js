import { GoogleLogin } from '@react-oauth/google';
import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AppContext } from "../../context/AppContext";
import "./LandingPage.css";

const LandingPage = () => {
  const navigate = useNavigate();
  const { setUser } = useContext(AppContext);

  const handleLogin = () => {
    console.log("Initiating OAuth2");
    setUser({
      id: 1,
      username: "DemoUser",
      provider: "mock-oauth2",
    });
    navigate("/market");
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    console.log("1. Google handed React this Token:", credentialResponse.credential);

    try {
      // 2. We send this token to your Spring Boot backend to verify
      // (This fetch will fail until we build the Spring Boot side, but the logic is ready!)
      /*
      const response = await fetch('http://localhost:8080/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential }),
      });
      const data = await response.json();
      
      // 3. Spring Boot replies with your custom JWT and user data
      localStorage.setItem('jwt', data.internalJwt);
      */

      // Mocking the successful login for now so you can test the UI
      setUser({ username: "GoogleUser" });
      navigate('/market');

    } catch (error) {
      console.error("Login failed:", error);
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
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              useOneTap
            />
            <button className="landing-login" onClick={handleLogin} type="button">
              Login with Provider
            </button>
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

