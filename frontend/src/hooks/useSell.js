import { useContext } from "react";
import { AppContext } from "../context/AppContext";

const useSell = () => {
  const { user, setLastOperation } = useContext(AppContext);
  
  const sell = async (cryptoCode, cryptoAmount) => {
    if (!user) return;
    try {
      const res = await fetch(
        `http://localhost:8080/api/trade/sell/${user.id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ cryptoCode, cryptoAmount }),
        }
      );
      if (!res.ok) throw new Error("Trade failed");
      const data = await res.json();
      setLastOperation(data);
      return data;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };
  return sell;
};

export default useSell;
