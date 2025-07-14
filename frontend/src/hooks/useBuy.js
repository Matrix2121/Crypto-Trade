import { useContext } from "react";
import { AppContext } from "../context/AppContext";

const useBuy = () => {
  const { user, setLastOperation } = useContext(AppContext);

  const buy = async (cryptoCode, cryptoAmount) => {
    if (!user) return;
    try {
      const res = await fetch(`http://localhost:8080/api/trade/buy/${user.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cryptoCode, cryptoAmount }),
      });
      if (!res.ok) throw new Error("Trade failed");
      const data = await res.json();
      setLastOperation(data);
      return data;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  return buy;
};

export default useBuy;
