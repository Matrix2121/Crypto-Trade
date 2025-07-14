import { useContext, useEffect } from "react";
import { AppContext } from "../context/AppContext";

const useReset = () => {
  const { user, reset, setReset } = useContext(AppContext);

  useEffect(() => {
    if (!user) return;
    fetch(`http://localhost:8080/api/user/reset/${user.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Reset failed");
        return res.json();
      })
      .catch(console.error);
  }, [reset]);
};

export default useReset;
