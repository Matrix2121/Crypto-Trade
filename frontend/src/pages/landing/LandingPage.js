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
      const response = await fetch(`${process.env.REACT_APP_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential }),
      });

      if (!response.ok) {
        throw new Error(`Auth failed with status ${response.status}`);
      }

      const data = await response.json();

      localStorage.setItem('jwt', data.jwt);
      localStorage.setItem('username', data.username);
      setUser({ username: data.username, balance: data.balance });

      navigate('/market');

    } catch (error) {
      console.error("Login failed:", error);
      alert("Login failed");
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

