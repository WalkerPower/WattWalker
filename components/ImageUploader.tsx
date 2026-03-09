import React, { useRef, useState } from 'react';

interface ImageUploaderProps {
  onImageSelected: (file: File) => void;
  selectedImage: string | null;
  disabled: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelected, selectedImage, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  
  // Ref for standard file upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Ref for camera capture
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        onImageSelected(file);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onImageSelected(e.target.files[0]);
    }
  };

  const triggerUpload = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const triggerCamera = () => {
    if (!disabled && cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  return (
    <div className="w-full">
      {/* Hidden Standard File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
      />
      
      {/* Hidden Camera Input (Mobile) */}
      <input
        type="file"
        ref={cameraInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
        capture="environment"
      />
      
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-6 sm:p-8 flex flex-col items-center justify-center text-center transition-all h-80
          ${isDragging ? 'border-[#00a8f9] bg-blue-50' : 'border-slate-300 hover:border-slate-400'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${selectedImage ? 'bg-slate-100' : 'bg-white'}
        `}
      >
        {selectedImage ? (
          <div className="relative w-full h-full flex items-center justify-center cursor-pointer" onClick={triggerUpload}>
            <img 
              src={selectedImage} 
              alt="Uploaded Preview" 
              className="max-h-full max-w-full object-contain rounded shadow-sm" 
            />
            <div className="absolute inset-0 bg-slate-900/10 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded">
               <p className="text-white font-medium bg-slate-900/70 px-4 py-2 rounded-full backdrop-blur-sm shadow-sm">Change Image</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 w-full max-w-sm">
            
            <div className="space-y-2">
                 <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-[#00a8f9] mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-800">Add Your Bill</h3>
                <p className="text-sm text-slate-500">Drag & Drop file here</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
                 <button
                    onClick={triggerCamera}
                    type="button"
                    className="flex flex-col items-center justify-center gap-2 py-4 px-2 bg-[#00a8f9] hover:bg-[#0096e0] text-white rounded-lg transition-colors shadow-sm active:scale-95"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                    </svg>
                    <span className="text-xs font-bold">Use Camera</span>
                 </button>

                 <button
                    onClick={triggerUpload}
                    type="button"
                    className="flex flex-col items-center justify-center gap-2 py-4 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors border border-slate-200 shadow-sm active:scale-95"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <span className="text-xs font-bold">Upload File</span>
                 </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageUploader;