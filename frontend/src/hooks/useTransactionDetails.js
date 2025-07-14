import { useEffect, useState } from "react";

const useTransactionDetails = (id) => {
  const [transaction, setTransaction] = useState(null);

  useEffect(() => {
    if (!id) return;

    fetch(`http://localhost:8080/api/transactions/single/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Fetch failed");
        return res.json();
      })
      .then((data) => setTransaction(data))
      .catch(console.error);
  }, [id]);

  return transaction;
};

export default useTransactionDetails;
