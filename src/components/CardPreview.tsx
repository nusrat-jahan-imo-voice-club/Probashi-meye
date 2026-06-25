import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
// @ts-ignore
import defaultAvatar from '../assets/images/default_avatar_1782370919940.jpg';

interface CardPreviewProps {
  cardRef: React.RefObject<HTMLDivElement | null>;
  name: string;
  subtitle: string;
  qrValue: string;
  avatarUrl: string;
  showLogo: boolean;
}

const WHATSAPP_LOGO_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="%2325D366"/><path fill="white" d="M12.012 3.82c-4.52 0-8.2 3.68-8.2 8.2 0 1.54.43 3.03 1.25 4.33l-.84 3.07 3.14-.82c1.26.69 2.68 1.05 4.14 1.05 4.52 0 8.2-3.68 8.2-8.2 0-2.18-.85-4.23-2.4-5.78s-3.6-2.4-5.78-2.4zm4.8 11.23c-.2.56-1.16 1.07-1.6 1.11-.4.04-.92.21-2.73-.51-2.31-.92-3.8-3.26-3.91-3.41-.11-.15-.95-1.26-.95-2.4s.59-1.69.8-1.92c.2-.23.45-.29.6-.29s.3.01.43.02c.14.01.32-.05.5.38.19.45.64 1.56.7 1.68s.09.25.01.42c-.08.17-.18.27-.3.41-.12.14-.26.3-.37.4-.12.11-.25.23-.11.47.14.24.63 1.03 1.35 1.67.92.82 1.7 1.07 1.94 1.19s.38.09.52-.06c.14-.15.59-.69.75-.92.16-.23.32-.19.54-.11s1.39.65 1.63.77c.24.12.4.18.46.28.06.1.06.57-.14 1.13z"/></svg>`;

export default function CardPreview({
  cardRef,
  name,
  subtitle,
  qrValue,
  avatarUrl,
  showLogo,
}: CardPreviewProps) {
  // Use custom uploaded image, selected preset, or fallback to our beautifully generated default avatar
  const displayAvatar = avatarUrl === 'default' ? defaultAvatar : avatarUrl;

  return (
    <div className="flex flex-col items-center justify-center p-4 min-h-[550px]">
      {/* Outer wrapper to match the exact proportions of the screenshot */}
      <div className="w-full max-w-[380px] flex flex-col items-center">
        {/* Card Component */}
        <div
          ref={cardRef}
          id="whatsapp-qr-card"
          className="relative w-full bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-[#e9ebeb] pt-14 pb-10 px-8 flex flex-col items-center select-none"
        >
          {/* Avatar Profile Picture positioned centered and overlapping top border */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="w-[100px] h-[100px] rounded-full p-[2px] bg-white shadow-[0_4px_14px_rgba(0,0,0,0.05)] border border-[#e9ebeb]/50">
              <img
                src={displayAvatar}
                alt="Profile Avatar"
                referrerPolicy="no-referrer"
                className="w-full h-full rounded-full object-cover"
                onError={(e) => {
                  // Fallback to default generated avatar if Unsplash or user upload fails
                  const target = e.target as HTMLImageElement;
                  target.src = defaultAvatar;
                }}
              />
            </div>
          </div>

          {/* Name Display */}
          <h2 className="text-[26px] font-bold text-[#111b21] tracking-tight leading-tight text-center break-all max-w-full px-2">
            {name || 'N'}
          </h2>

          {/* Subtitle Display */}
          <p className="text-[14px] text-[#667781] mt-1 text-center font-normal">
            {subtitle || 'WhatsApp contact'}
          </p>

          {/* QR Code Container */}
          <div className="mt-8 p-3 bg-white rounded-lg flex items-center justify-center">
            <QRCodeSVG
              value={qrValue}
              size={220}
              level="H"
              fgColor="#000000"
              bgColor="#FFFFFF"
              includeMargin={false}
              imageSettings={
                showLogo
                  ? {
                      src: WHATSAPP_LOGO_SVG,
                      height: 52,
                      width: 52,
                      excavate: true,
                    }
                  : undefined
              }
            />
          </div>
        </div>

        {/* Info Text below the Card (Exact replica of the text in the user's screenshot) */}
        <p className="text-[14px] text-[#667781] leading-[1.4] text-center mt-6 max-w-[330px] px-2 font-normal">
          Your QR code is private. If you share it with someone, they can scan it with their WhatsApp camera to add you as a contact.
        </p>
      </div>
    </div>
  );
}
