import { useMemo, useState, useContext } from "react";
import { AppContext } from "../../context/AppContext";
import useTransactions from "../../hooks/useTransactions";
import { formatBalance, formatBalanceUsd } from "../../utils/formatBalance";
import { getCryptoIconPath, handleCryptoIconError } from "../../utils/getCryptoIconPath";
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
          onError={handleCryptoIconError}
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
  const [filterAsset, setFilterAsset] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  useTransactions();

  const assetOptions = useMemo(() => {
    const codes = [...new Set(transactions.map((t) => t.cryptoCode))].sort();
    return codes;
  }, [transactions]);

  const filtered = useMemo(() => {
    return [...transactions].reverse().filter((tx) => {
      if (filterAsset && tx.cryptoCode !== filterAsset) return false;
      if (filterType === "buy" && !tx.isPurchase) return false;
      if (filterType === "sell" && tx.isPurchase) return false;
      const ts = new Date(tx.tradeTimestamp).getTime();
      if (filterFrom && ts < new Date(filterFrom).getTime()) return false;
      if (filterTo && ts > new Date(filterTo).getTime() + 86400000) return false;
      return true;
    });
  }, [transactions, filterAsset, filterType, filterFrom, filterTo]);

  const selected = transactions.find((tx) => tx.id === selectedId) ?? null;

  const handleSelect = (id) => {
    setSelectedId((current) => (current === id ? null : id));
  };

  return (
    <div className="transactions-page">
      <h2>Transaction History</h2>

      <div className="transactions-filters">
        <label>
          Asset
          <select value={filterAsset} onChange={(e) => setFilterAsset(e.target.value)}>
            <option value="">All</option>
            {assetOptions.map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
        </label>
        <label>
          Type
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">All</option>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
        </label>
        <label>
          From
          <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
        </label>
      </div>

      <div className="transactions-container">
        <div className="transactions-list-section">
          {filtered.length === 0 ? (
            <p className="transactions-empty">No transactions match filters.</p>
          ) : (
            <ul className="transaction-list">
              {filtered.map((tx) => {
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
