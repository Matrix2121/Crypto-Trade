import { useState, useContext } from "react";
import { AppContext } from "../../context/AppContext";
import useTransactions from "../../hooks/useTransactions";
import useTransactionDetails from "../../hooks/useTransactionDetails";
import { getCryptoIconPath } from "../../utils/getCryptoIconPath";
import "./Transactions.css";

const Transactions = () => {
  const { transactions } = useContext(AppContext);
  const [selectedId, setSelectedId] = useState(null);
  const selected = useTransactionDetails(selectedId);

  // Fetch transactions on mount
  useTransactions();

  return (
    <div className="transactions-page">
      <h2>Transaction History</h2>

      <div className="transactions-container">
        <div className="transactions-list-section">
          {transactions.length === 0 ? (
            <p>No transactions yet.</p>
          ) : (
            <ul className="transaction-list">
              {[...transactions].reverse().map((tx) => (
                <li 
                  key={tx.id} 
                  onClick={() => setSelectedId(tx.id)}
                  className={selectedId === tx.id ? "active-tx" : ""}
                >
                  <img
                    src={getCryptoIconPath(tx.cryptoCode)}
                    alt={tx.cryptoCode}
                    width={24}
                    height={24}
                    style={{ marginRight: 12 }}
                  />
                  <span>
                    <strong>{tx.cryptoCode}</strong> — {tx.isPurchase ? "Buy" : "Sell"} —{" "}
                    {new Date(tx.tradeTimestamp).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Details Panel */}
        {selected && (
          <div className="transaction-details">
            <img
              src={getCryptoIconPath(selected.cryptoCode)}
              alt={selected.cryptoCode}
              width={48}
              height={48}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src =
                  "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/icon/generic.png";
              }}
            />
            <h3>{selected.cryptoCode}</h3>
            <hr />
            <p><strong>Amount:</strong> {selected.cryptoAmount}</p>
            <p><strong>Unit Price:</strong> {Number(selected.unitPrice).toFixed(5)}$</p>
            <p><strong>Total:</strong> {Number(selected.localCurrencyAmount).toFixed(2)}$</p>
            <p><strong>Type:</strong> <span className={selected.isPurchase ? "tx-buy" : "tx-sell"}>{selected.isPurchase ? "Buy" : "Sell"}</span></p>
            <p><strong>Date:</strong> {new Date(selected.tradeTimestamp).toLocaleString()}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Transactions;