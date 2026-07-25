import React, { useState } from 'react';

interface UsdtIconProps {
  size?: number;
  className?: string;
}

/**
 * Reusable official USDT (Tether) currency icon.
 * Features automatic fallback to vector SVG if image CDN is unreachable.
 */
export const UsdtIcon: React.FC<UsdtIconProps> = ({ size = 16, className = '' }) => {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`inline-block shrink-0 ${className}`}
      >
        <circle cx="12" cy="12" r="12" fill="#26A17B" />
        <path
          d="M12.923 10.457v-1.74h3.693V6.5H7.384v2.217h3.693v1.74c-3.15.143-5.538.835-5.538 1.666 0 .83 2.388 1.522 5.538 1.665v3.712h1.846v-3.712c3.15-.143 5.538-.835 5.538-1.665 0-.831-2.388-1.523-5.538-1.666zm-5.008 1.666c0-.41.976-.78 2.654-.925v1.85c-1.678-.146-2.654-.515-2.654-.925zm7.362.925v-1.85c1.678.145 2.654.515 2.654.925 0 .41-.976.78-2.654.925z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }

  return (
    <img
      src="https://assets.coingecko.com/coins/images/325/large/Tether.png"
      alt="USDT"
      width={size}
      height={size}
      onError={() => setImgError(true)}
      className={`inline-block rounded-full object-contain shrink-0 ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
};
