import { useContext } from "react";
import { AppContext } from "../context/AppContext";
import { readTradeErrorMessage } from "../utils/parseTradeError";

const useSell = () => {
  const { user, setLastOperation } = useContext(AppContext);
  
  const sell = async (cryptoCode, tradePayload) => {
    if (!user) return;
    const token = localStorage.getItem("jwt");
    if (!token) throw new Error("Missing auth token");
    try {
      const res = await fetch(
        `${process.env.REACT_APP_API_URL}/api/trade/sell/${user.id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify({ cryptoCode, ...tradePayload }),
        }
      );
      if (!res.ok) throw new Error(await readTradeErrorMessage(res));
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
