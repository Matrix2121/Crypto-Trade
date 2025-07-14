import { useEffect } from "react";
import { useContext } from "react";
import { AppContext } from "../context/AppContext";

const useTransactions = () => {
  const { user, reset, setTransactions } = useContext(AppContext);

  useEffect(() => {
    if (!user) return;
    fetch(`http://localhost:8080/api/transactions/all/${user.id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Fetch failed");
        return res.json();
      })
      .then((data) => setTransactions(data))
      .catch(console.error);
  }, [user, reset]);
};

export default useTransactions;
