import React, { useCallback, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { Camera, Upload, X } from 'lucide-react';

export interface PhotoCaptureProps {
  onCapture: (file: File) => void | Promise<void>;
  onClose: () => void;
}

const PhotoCapture: React.FC<PhotoCaptureProps> = ({ onCapture, onClose }) => {
  const webcamRef = useRef<Webcam>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      fetch(imageSrc)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], 'profile-photo.jpg', { type: 'image/jpeg' });
          onCapture(file);
          setIsCameraActive(false);
        });
    }
  }, [webcamRef, onCapture]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onCapture(file);
    }
  };

  if (!isCameraActive) {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setIsCameraActive(true)}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <Camera className="h-5 w-5 mr-2" />
          Tomar foto
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <Upload className="h-5 w-5 mr-2" />
          Subir foto
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-lg max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Tomar foto de perfil</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="relative">
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            className="w-full rounded-lg"
            videoConstraints={{
              facingMode: { ideal: 'user' }
            }}
          />
        </div>
        
        <div className="mt-4 flex justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={capture}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
          >
            Capturar
          </button>
        </div>
      </div>
    </div>
  );
};

export default PhotoCapture;