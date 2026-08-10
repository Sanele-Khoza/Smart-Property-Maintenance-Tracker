import React from 'react';

const ImageLightbox = ({ src, onClose }) => {
  if (!src) return null;
  return (
    <div className="modal" onClick={onClose}>
      <span className="modal-close">×</span>
      <img src={src} alt="Full size" />
    </div>
  );
};

export default ImageLightbox;
