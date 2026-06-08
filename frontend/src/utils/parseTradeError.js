export function formatTradeErrorMessage(message) {
  if (!message || typeof message !== "string") return "Trade failed";

  if (message.startsWith("Insufficient funds")) {
    return "Insufficient USD balance to complete this purchase";
  }

  if (message.startsWith("Insufficient crypto")) {
    return "Insufficient crypto balance to complete this sale";
  }

  return message;
}

export async function readTradeErrorMessage(res) {
  try {
    const data = await res.json();
    return formatTradeErrorMessage(data?.message);
  } catch {
    return "Trade failed";
  }
}
