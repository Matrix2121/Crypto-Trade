import { useContext, useEffect } from "react";
import { AppContext } from "../context/AppContext";

const useReset = () => {
  const { user, reset, doResetDone, clearReset } = useContext(AppContext);

  useEffect(() => {
    if (!user || reset === 0) return;

    const token = localStorage.getItem("jwt");
    if (!token) return;

    fetch(`${process.env.REACT_APP_API_URL}/api/user/reset/${user.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
        if (!res.ok) throw new Error("Reset failed");
        return res.json();
      })
      .then(() => {
        doResetDone();
      })
      .catch((err) => {
        console.error(err);
        clearReset();
      });
    // Only re-run when the reset trigger counter changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, reset]);
};

export default useReset;
