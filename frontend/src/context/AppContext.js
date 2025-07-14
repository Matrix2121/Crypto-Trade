import { createContext, useState } from "react";

export const AppContext = createContext();

const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(null);
  const [assets, setAssets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [reset, setReset] = useState(0);
  const [resetDone, setResetDone] = useState(0);
  const [lastOperation, setLastOperation] = useState(0);

  const doReset = () => setReset((prev) => prev + 1);
  const doResetDone = () => setResetDone((prev) => prev + 1);
  const newOperation = () => setLastOperation((prev) => prev + 1);

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        balance,
        setBalance,
        assets,
        setAssets,
        transactions,
        setTransactions,
        reset,
        doReset,
        resetDone,
        doResetDone,
        lastOperation,
        setLastOperation,
        newOperation
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export default AppProvider;
