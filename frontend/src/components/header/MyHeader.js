import { useContext, useState } from "react";
import { AppContext } from "../../context/AppContext";
import useUser from "../../hooks/useUser";
import useBalance from "../../hooks/useBalance";
import useReset from "../../hooks/useReset";
import PortfolioModal from "../../modals/portfolio/PortfolioModal";
import TransactionsModal from "../../modals/transactions/TransactionsModal";
import "./MyHeader.css";

function MyHeader() {
  const { user, balance, doReset } = useContext(AppContext);
  const [showPortfolio, setShowPortfolio] = useState(false);
  const [showTxModal, setShowTxModal] = useState(false);

  useUser();
  useBalance();
  useReset();

  return (
    <>
      <header className="header">
        <div className="header-left">
          <span className="username">Hello, {user?.username}</span>
          <button onClick={() => setShowPortfolio(true)}>Assets</button>
          <button onClick={() => setShowTxModal(true)}>Transactions</button>
          <button onClick={doReset}>Reset</button>
        </div>
        <div className="header-right">
          <span className="balance">
            Balance:{" "}
            {balance ? Number(balance.balance).toFixed(2) : "Loading..."}$
          </span>
        </div>
      </header>

      {showPortfolio && (
        <PortfolioModal onClose={() => setShowPortfolio(false)} />
      )}
      {showTxModal && (
        <TransactionsModal
          userId={user.id}
          onClose={() => setShowTxModal(false)}
        />
      )}
    </>
  );
}

export default MyHeader;
