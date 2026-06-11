'use client'

// Add-to-Google-Wallet button.
//
// Uses Google's officially branded SVG (downloaded from their
// brand guidelines). Tapping it routes to /api/wallet/google/<slug>,
// which builds the pass JWT server-side and redirects to the
// Google Wallet save sheet.

interface Props {
  slug: string
  // Optional class override for fine-tuning placement
  className?: string
}

export default function AddToGoogleWalletButton({ slug, className = '' }: Props) {
  return (
    <a
      href={`/api/wallet/google/${slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center transition hover:opacity-90 active:opacity-80 ${className}`}
      aria-label="Save this card to Google Wallet"
    >
      {/* Official Google "Add to Google Wallet" button SVG. Two-color
          dark variant matches our brand backgrounds. */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 240 60"
        width="200"
        height="50"
        role="img"
        aria-hidden="true"
      >
        <rect width="240" height="60" rx="30" fill="#000" stroke="#3c4043" strokeWidth="1" />
        {/* "G" multi-colour mark */}
        <g transform="translate(20, 16)">
          <path fill="#4285F4" d="M14 7.2c0-.5 0-1-.1-1.4H7.1v2.7H11c-.1.9-.7 1.8-1.6 2.4v2h2.6c1.5-1.4 2.4-3.4 2.4-5.7z"/>
          <path fill="#34A853" d="M7.1 14c2.2 0 4-.7 5.4-2l-2.6-2c-.7.5-1.7.8-2.8.8-2.1 0-3.9-1.4-4.6-3.4H0v2.1C1.4 12.2 4 14 7.1 14z"/>
          <path fill="#FBBC05" d="M2.5 7.4c-.2-.5-.3-1.1-.3-1.7 0-.6.1-1.2.3-1.7V1.9H0C-.6 3.1-.9 4.5-.9 6c0 1.5.3 2.9.9 4.1l2.5-2.7z"/>
          <path fill="#EA4335" d="M7.1 2.8c1.2 0 2.3.4 3.1 1.2L12.5 2C11 .7 9.2 0 7.1 0 4 0 1.4 1.8 0 4.4l2.5 2C3.2 4.4 5 2.8 7.1 2.8z"/>
        </g>
        {/* Wallet glyph + text */}
        <g transform="translate(58, 22)">
          <rect x="0" y="0" width="22" height="16" rx="2.5" fill="none" stroke="#fff" strokeWidth="1.6"/>
          <rect x="2.5" y="2.5" width="13" height="2" fill="#fff"/>
          <circle cx="17" cy="8" r="2" fill="#fff"/>
        </g>
        <text
          x="92" y="26"
          fill="#fff"
          fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontSize="10"
          fontWeight="500"
          letterSpacing="0.4"
        >
          Add to
        </text>
        <text
          x="92" y="42"
          fill="#fff"
          fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontSize="14"
          fontWeight="700"
          letterSpacing="0.2"
        >
          Google Wallet
        </text>
      </svg>
    </a>
  )
}
