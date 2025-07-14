import { useEffect } from "react";
import { useContext } from "react";
import { AppContext } from "../context/AppContext";

const useBalance = () => {
  const { user, resetDone, lastOperation, setBalance } = useContext(AppContext);

  useEffect(() => {
    if (!user) return;
    fetch(`http://localhost:8080/api/balance/${user.id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Fetch failed");
        return res.json();
      })
      .then((data) => setBalance(data))
      .catch(console.error);
  }, [user, resetDone, lastOperation]);
};

export default useBalance;
