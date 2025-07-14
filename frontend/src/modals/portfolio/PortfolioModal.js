import React, { useContext } from "react";
import { AppContext } from "../../context/AppContext";
import useAssets from "../../hooks/useAssets";
import { getCryptoIconPath } from "../../utils/getCryptoIconPath";
import "./PortfolioModal.css";

const PortfolioModal = ({ onClose }) => {
  const { assets } = useContext(AppContext);
  useAssets();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Your Portfolio</h2>
        {assets.length === 0 ? (
          <p>You don't own any assets yet.</p>
        ) : (
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>Crypto</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={`${asset.cryptoCode}-${asset.cryptoAmount}`}>
                  <td
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <img
                      src={getCryptoIconPath(asset.cryptoCode)}
                      alt={asset.cryptoCode}
                      width={24}
                      height={24}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src =
                          "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/icon/generic.png";
                      }}
                    />
                    {asset.cryptoCode}
                  </td>
                  <td>{asset.cryptoAmount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button onClick={onClose} className="close-button">
          Close
        </button>
      </div>
    </div>
  );
};

export default PortfolioModal;
