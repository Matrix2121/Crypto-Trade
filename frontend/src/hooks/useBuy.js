import { useContext, useEffect } from "react";
import { AppContext } from "../context/AppContext";

const useBuy = (cryptoCode, cryptoAmount) => {
  const { user, setLastOperation } = useContext(AppContext);

  useEffect(() => {
    if (!user) return;
    fetch(`http://localhost:8080/api/trade/buy${user.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cryptoCode: cryptoCode,
        cryptoAmount: cryptoAmount,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Trade failed");
        return res.json();
      })
      .then((data) => setLastOperation(data))
      .catch(console.error);
  }, []);
};

export default useBuy;
