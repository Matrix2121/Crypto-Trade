import { useEffect, useState } from "react";

const useTransactionDetails = (id) => {
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) {
      setTransaction(null);
      setLoading(false);
      setError(null);
      return;
    }

    const token = localStorage.getItem("jwt");
    if (!token) {
      setError("Not authenticated");
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`${process.env.REACT_APP_API_URL}/api/transactions/single/${id}`, {
      headers: {
        Authorization: "Bearer " + token,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Fetch failed");
        return res.json();
      })
      .then((data) => setTransaction(data))
      .catch((err) => {
        console.error(err);
        setError("Failed to load transaction details");
        setTransaction(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  return { transaction, loading, error };
};

export default useTransactionDetails;
