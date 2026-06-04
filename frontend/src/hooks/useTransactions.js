import { useEffect } from "react";
import { useContext } from "react";
import { AppContext } from "../context/AppContext";

const useTransactions = () => {
  const { user, resetDone, setTransactions } = useContext(AppContext);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("jwt");
    if (!token) return;

    fetch(`${process.env.REACT_APP_API_URL}/api/transactions/all/${user.id}`, {
      headers: {
        Authorization: "Bearer " + token,
      },
    })
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
