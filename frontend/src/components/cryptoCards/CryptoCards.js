import { getCryptoIconPath } from "../../utils/getCryptoIconPath";
import "./CryptoCards.css";

const CryptoCards = ({ prices }) => {
  if (!prices || prices.length === 0) return <p>No data available.</p>;

  return (
    <div className="crypto-cards-container">
      {prices.map((tick) => {
        return (
          <div className="crypto-card" key={tick.symbol}>
            <div className="card-left">
              <img
                src={getCryptoIconPath(tick.symbol)}
                alt={tick.symbol}
                width={32}
                height={32}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src =
                    "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/icon/generic.png";
                }}
              />

              <div>
                <h4>{tick.symbol}</h4>
                <p>Bid: {tick.bid}</p>
                <p>Ask: {tick.ask}</p>
                <p style={{ fontSize: "0.75rem", color: "#888" }}>
                  Last Change: {new Date(tick.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
            <div className="card-right">
              <button className="buy-button">Buy</button>
              <button className="sell-button">Sell</button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CryptoCards;
