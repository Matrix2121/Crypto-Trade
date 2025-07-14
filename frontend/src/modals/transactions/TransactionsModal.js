import { useState, useContext } from "react";
import { AppContext } from "../../context/AppContext";
import useTransactions from "../../hooks/useTransactions";
import useTransactionDetails from "../../hooks/useTransactionDetails";
import { getCryptoIconPath } from "../../utils/getCryptoIconPath";
import "./TransactionsModal.css";

const TransactionsModal = ({ onClose }) => {
  const { transactions } = useContext(AppContext);

  const [selectedId, setSelectedId] = useState(null);
  const selected = useTransactionDetails(selectedId);

  useTransactions();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content wide" onClick={(e) => e.stopPropagation()}>
        <h2>Transaction History</h2>

        {transactions.length === 0 ? (
          <p>No transactions yet.</p>
        ) : (
          <ul className="transaction-list">
            {[...transactions].reverse().map((tx) => (
              <li key={tx.id} onClick={() => setSelectedId(tx.id)}>
                <img
                  src={getCryptoIconPath(tx.cryptoCode)}
                  alt={tx.cryptoCode}
                  width={20}
                  height={20}
                  style={{ marginRight: 8 }}
                />
                {tx.cryptoCode} — {tx.isPurchase ? "Buy" : "Sell"} —{" "}
                {new Date(tx.tradeTimestamp).toLocaleString()}
              </li>
            ))}
          </ul>
        )}

        {selected && (
          <div className="transaction-details">
            <img
              src={getCryptoIconPath(selected.cryptoCode)}
              alt={selected.cryptoCode}
              width={32}
              height={32}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src =
                  "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/icon/generic.png";
              }}
            />
            <h3>{selected.cryptoCode}</h3>
            <p>Amount: {selected.cryptoAmount}</p>
            <p>Unit Price: {Number(selected.unitPrice).toFixed(5)}$</p>
            <p>Total: {Number(selected.localCurrencyAmount).toFixed(2)}$</p>
            <p>Type: {selected.isPurchase ? "Buy" : "Sell"}</p>
            <p>Date: {new Date(selected.tradeTimestamp).toLocaleString()}</p>
          </div>
        )}

        <button className="close-button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
};

export default TransactionsModal;
