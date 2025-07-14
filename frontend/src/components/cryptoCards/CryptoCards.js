import { getCryptoIconPath } from "../../utils/getCryptoIconPath";
import useBuy from "../../hooks/useBuy";
import useSell from "../../hooks/useSell";
import "./CryptoCards.css";

const CryptoCards = ({ prices }) => {
  const buy = useBuy();
  const sell = useSell();

  if (!prices || prices.length === 0) return <p>No data available.</p>;

  const handleBuy = (symbol) => {
    const amount = parseFloat(prompt(`Buy how much ${symbol}?`));
    if (!amount || isNaN(amount)) return;
    try {
      buy(symbol, amount);
      alert("Buy successful!");
    } catch {
      alert("Buy failed.");
    }
  };

  const handleSell = (symbol) => {
    const amount = parseFloat(prompt(`Sell how much ${symbol}?`));
    if (!amount || isNaN(amount)) return;
    try {
      sell(symbol, amount);
      alert("Sell successful!");
    } catch {
      alert("Sell failed.");
    }
  };

  return (
    <div className="crypto-cards-container">
      {prices.map((tick) => (
        <div className="crypto-card" key={tick.symbol}>
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
              <p style={{ fontSize: "0.75rem", color: "#888" }}>
                Last Change: {new Date(tick.timestamp).toLocaleString("en-GB")}
              </p>
            </div>
          </div>
          <div className="card-right">
            <button
              className="buy-button"
              onClick={() => handleBuy(tick.symbol)}
            >
              Buy
            </button>
            <button
              className="sell-button"
              onClick={() => handleSell(tick.symbol)}
            >
              Sell
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CryptoCards;
