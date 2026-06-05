import { useState, useContext } from "react";
import { AppContext } from "../../context/AppContext";
import useTransactions from "../../hooks/useTransactions";
import { formatBalance, formatBalanceUsd } from "../../utils/formatBalance";
import { getCryptoIconPath } from "../../utils/getCryptoIconPath";
import "./Transactions.css";

function TransactionDetailRow({ label, value, valueClassName }) {
  return (
    <div className="transaction-detail-row">
      <span className="transaction-detail-label">{label}</span>
      <span className={`transaction-detail-value${valueClassName ? ` ${valueClassName}` : ""}`}>
        {value}
      </span>
    </div>
  );
}

function TransactionDetailsPanel({ transaction, onClose }) {
  const isBuy = transaction.isPurchase;

  return (
    <div className="transaction-details">
      <div className="transaction-details-header">
        <h3>Transaction Details</h3>
        <button
          type="button"
          className="transaction-details-close"
          onClick={onClose}
          aria-label="Close details"
        >
          ×
        </button>
      </div>

      <div className="transaction-details-hero">
        <img
          src={getCryptoIconPath(transaction.cryptoCode)}
          alt={transaction.cryptoCode}
          width={48}
          height={48}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src =
              "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/icon/generic.png";
          }}
        />
        <div className="transaction-details-hero-text">
          <strong>{transaction.cryptoCode}</strong>
          <span className={`transaction-type-badge ${isBuy ? "tx-buy" : "tx-sell"}`}>
            {isBuy ? "Buy" : "Sell"}
          </span>
        </div>
      </div>

      <div className="transaction-details-body">
        <TransactionDetailRow label="Transaction ID" value={`#${transaction.id}`} />
        <TransactionDetailRow
          label="Crypto Amount"
          value={`${formatBalance(transaction.cryptoAmount)} ${transaction.cryptoCode}`}
        />
        <TransactionDetailRow
          label="Unit Price"
          value={formatBalanceUsd(transaction.unitPrice)}
        />
        <TransactionDetailRow
          label="Total Value"
          value={formatBalanceUsd(transaction.localCurrencyAmount)}
        />
        <TransactionDetailRow
          label="Type"
          value={isBuy ? "Purchase" : "Sale"}
          valueClassName={isBuy ? "tx-buy" : "tx-sell"}
        />
        <TransactionDetailRow
          label="Date"
          value={new Date(transaction.tradeTimestamp).toLocaleString()}
        />
      </div>
    </div>
  );
}

const Transactions = () => {
  const { transactions } = useContext(AppContext);
  const [selectedId, setSelectedId] = useState(null);

  useTransactions();

  const selected = transactions.find((tx) => tx.id === selectedId) ?? null;

  const handleSelect = (id) => {
    setSelectedId((current) => (current === id ? null : id));
  };

  return (
    <div className="transactions-page">
      <h2>Transaction History</h2>

      <div className="transactions-container">
        <div className="transactions-list-section">
          {transactions.length === 0 ? (
            <p className="transactions-empty">No transactions yet.</p>
          ) : (
            <ul className="transaction-list">
              {[...transactions].reverse().map((tx) => {
                const isBuy = tx.isPurchase;
                return (
                  <li
                    key={tx.id}
                    onClick={() => handleSelect(tx.id)}
                    className={selectedId === tx.id ? "active-tx" : ""}
                  >
                    <img
                      src={getCryptoIconPath(tx.cryptoCode)}
                      alt={tx.cryptoCode}
                      width={24}
                      height={24}
                      className="transaction-list-icon"
                    />
                    <div className="transaction-list-main">
                      <span className="transaction-list-title">
                        <strong>{tx.cryptoCode}</strong>
                        <span className={`transaction-type-badge ${isBuy ? "tx-buy" : "tx-sell"}`}>
                          {isBuy ? "Buy" : "Sell"}
                        </span>
                      </span>
                      <span className="transaction-list-date">
                        {new Date(tx.tradeTimestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="transaction-list-summary">
                      <span>{formatBalance(tx.cryptoAmount)} {tx.cryptoCode}</span>
                      <span>{formatBalanceUsd(tx.localCurrencyAmount)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selected ? (
          <TransactionDetailsPanel
            transaction={selected}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <div className="transaction-details transaction-details-placeholder">
            <p>Select a transaction to view all details.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Transactions;
