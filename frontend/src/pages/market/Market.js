import usePrices from "../../hooks/usePrices";
import CryptoCards from "../../components/cryptoCards/CryptoCards";
import "./Market.css";

const Market = () => {
  const prices = usePrices();

  if (!prices || prices.length === 0) {
    return (
      <div className="market-page">
        <p className="market-loading">Loading market data...</p>
      </div>
    );
  }

  return (
    <div className="market-page">
      <CryptoCards prices={Object.values(prices || {})} />
    </div>
  );
};

export default Market;
