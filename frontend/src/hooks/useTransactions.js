import { useEffect } from "react";
import { useContext } from "react";
import { AppContext } from "../context/AppContext";

const useTransactions = () => {
  const { user, resetDone, setTransactions } = useContext(AppContext);

  useEffect(() => {
    if (!user) return;
    fetch(`http://localhost:8080/api/transactions/all/${user.id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Fetch failed");
        return res.json();
      })
      .then((data) => setTransactions(data))
      .catch((err) => {
        console.error("Error loading assets:", err);
        setTransactions([]);
      });
  }, [user, resetDone]);
};

export default useTransactions;
