import { useContext, useEffect } from "react";
import { AppContext } from "../context/AppContext";

const useUser = () => {
  const { setUser } = useContext(AppContext);

  useEffect(() => {
    fetch("http://localhost:8080/api/user/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: "Matrix2121" }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Login failed");
        return res.json();
      })
      .then((data) => setUser(data))
      .catch(console.error);
  }, []);
};

export default useUser;
