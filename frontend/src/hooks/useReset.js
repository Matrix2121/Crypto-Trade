import { useContext, useEffect } from "react";
import { AppContext } from "../context/AppContext";

const useReset = () => {
  const { user, reset, doResetDone } = useContext(AppContext);

  useEffect(() => {
    if (!user) return;
    fetch(`${process.env.REACT_APP_API_URL}/api/user/reset/${user.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Reset failed");
        return res.json();
      })
      .then(() => {
        doResetDone();
      })
      .catch(console.error);
  }, [reset]);
};

export default useReset;
