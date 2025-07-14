import { useEffect, useContext } from "react";
import { AppContext } from "../context/AppContext";

const useUser = () => {
  const { setUser } = useContext(AppContext);

  useEffect(() => {
    fetch(`http://localhost:8080/api/user/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "Matrix2121",
      }),
    })
      .then((response) => {
        if (!response.ok) throw new Error("Failed to post");
        return response.json();
      })
      .then((data) => {
        setUser(data);
      })
      .catch(console.error);
  }, []);
};

export default useUser;
