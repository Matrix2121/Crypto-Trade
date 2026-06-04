import { useEffect } from "react";
import { useContext } from "react";
import { AppContext } from "../context/AppContext";

const useBalance = () => {
  const { user, resetDone, lastOperation, setBalance } = useContext(AppContext);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("jwt");
    if (!token) return;

    fetch(`${process.env.REACT_APP_API_URL}/api/balance/${user.id}`, {
      headers: {
        Authorization: "Bearer " + token,
      },
    })
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem("jwt");
          localStorage.removeItem("username");
          window.location.href = "/";
          throw new Error("Unauthorized");
        }
        if (!res.ok) throw new Error("Fetch failed");
        return res.json();
      })
      .then((data) => setBalance(data))
      .catch(console.error);
  }, [user, resetDone, lastOperation]);
};

export default useBalance;
