import { useEffect } from "react";
import { useContext } from "react";
import { AppContext } from "../context/AppContext";

const useAssets = () => {
  const { user, resetDone, setAssets, lastOperation } = useContext(AppContext);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("jwt");
    if (!token) return;

    fetch(`${process.env.REACT_APP_API_URL}/api/assets/${user.id}`, {
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
      .then((data) => setAssets(data))
      .catch((err) => {
        console.error("Error loading assets:", err);
        setAssets([]);
      });
  }, [user, resetDone, lastOperation]);
};

export default useAssets;
