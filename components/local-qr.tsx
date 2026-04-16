"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function LocalQr({
  value,
  size = 220,
  className,
  alt
}: {
  value: string;
  size?: number;
  className?: string;
  alt: string;
}) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    let active = true;

    QRCode.toDataURL(value, {
      width: size,
      margin: 1
    })
      .then((url) => {
        if (active) {
          setDataUrl(url);
        }
      })
      .catch(() => {
        if (active) {
          setDataUrl("");
        }
      });

    return () => {
      active = false;
    };
  }, [size, value]);

  if (!dataUrl) {
    return (
      <div
        className={className}
        aria-label={alt}
        style={{ display: "grid", placeItems: "center" }}
      >
        QR
      </div>
    );
  }

  return <img className={className} src={dataUrl} alt={alt} width={size} height={size} />;
}
