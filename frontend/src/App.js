import usePrices from "./hooks/usePrices";
import MyHeader from "./components/header/MyHeader";
import CryptoCards from "./components/cryptoCards/CryptoCards";
import "./App.css";

function App() {
  const prices = usePrices();
  if (!prices || prices.length === 0) return <p>No data available.</p>;

  return (
    <div className="App">
      <MyHeader />
      <CryptoCards prices={Object.values(prices || {})} />
    </div>
  );
}

export default App;
