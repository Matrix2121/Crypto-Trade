import { getCryptoIconPath } from "../../utils/getCryptoIconPath";
import { useNavigate } from "react-router-dom";
import "./CryptoCards.css";

const CryptoCards = ({ prices }) => {
  const navigate = useNavigate();

  if (!prices || prices.length === 0) return <p>No data available.</p>;

  return (
    <div className="crypto-cards-container">
      {prices.map((tick) => (
        <div
          className="crypto-card"
          key={tick.symbol}
          onClick={() => navigate(`/market/${tick.symbol.replace('/', '-')}`)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") navigate(`/market/${tick.symbol}`);
          }}
        >
          <div className="card-left">
            <img
              src={getCryptoIconPath(tick.symbol)}
              alt={tick.symbol}
              width={32}
              height={32}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/icon/generic.png`;
              }}
            />

            <div>
              <h4>{tick.symbol}</h4>
              <p>Bid: {tick.bid}</p>
              <p>Ask: {tick.ask}</p>
              <p style={{ fontSize: "0.75rem", color: "var(--color-text-dim)" }}>
                Last Change: {new Date(tick.timestamp).toLocaleString("en-GB")}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CryptoCards;
