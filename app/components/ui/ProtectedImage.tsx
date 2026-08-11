'use client';

import React from 'react';

interface ProtectedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  onPreview?: () => void;
}

export default function ProtectedImage({
  src,
  alt = 'Image',
  className = '',
  onPreview,
  ...props
}: ProtectedImageProps) {
  if (!src) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if (onPreview) {
          e.stopPropagation();
          onPreview();
        }
      }}
      className={`select-none ${onPreview ? 'cursor-pointer' : ''} ${className}`}
      {...props}
    />
  );
}
