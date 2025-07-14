import React, { useContext } from "react";
import { AppContext } from "../../context/AppContext";
import useTransactions from "../../hooks/useTransactions";
import "./TransactionsModal.css";

const TransactionsModal = ({ onClose }) => {
  const { transactions } = useContext(AppContext);
  useTransactions();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Your Transactions</h2>
        {transactions.length === 0 ? (
          <p>You haven't made any transactions yet.</p>
        ) : (
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>Crypto</th>
                <th>Type</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx, index) => (
                <tr key={`${tx.cryptoCode}-${index}`}>
                  <td>{tx.cryptoCode}</td>
                  <td>{tx.isPurchase ? "Buy" : "Sell"}</td>
                  <td>{tx.cryptoAmount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button onClick={onClose} className="close-button">
          Close
        </button>
      </div>
    </div>
  );
};

export default TransactionsModal;
