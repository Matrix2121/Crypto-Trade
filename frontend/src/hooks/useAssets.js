import { useEffect } from "react";
import { useContext } from "react";
import { AppContext } from "../context/AppContext";

const useAssets = () => {
  const { user, resetDone, setAssets, lastOperation } = useContext(AppContext);

  useEffect(() => {
    if (!user) return;
    fetch(`http://localhost:8080/api/assets/${user.id}`)
      .then((res) => {
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
