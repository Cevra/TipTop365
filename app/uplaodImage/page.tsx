//uploadImage
"use client";
import React, { ChangeEvent, useState } from "react";
import { storage } from "@/firebaseConfig";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  UploadTaskSnapshot,
} from "firebase/storage";


const ImageUpload: React.FC = () => {
    const [image, setImage] = useState<File | null>(null);
    const [imageUrl, setImageUrl] = useState('');

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (image) {
      const storageRef = ref(storage, `images/${image.name}`);
      const uploadTask = uploadBytesResumable(storageRef, image);
      uploadTask.on(
        "state_changed",
        (snapshot: UploadTaskSnapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`Upload is ${progress}% done`);
        },
        (error) => {
          console.log(error.message);
        },
        async () => {
          console.log("Upload Completed");
          const url=await getDownloadURL(uploadTask.snapshot.ref);
          setImageUrl(url);
        }
      );
    }
  };

  return (
    <div className=" w-full flex flex-row items-center font-bold py-0 px-1 rounded-full">
      <input type="file" onChange={handleChange} className=" w-2/3  font-bold py-0 px-1 rounded-full" />
<div 
    className=" w-1/3 text-white font-bold py-0 px-1 rounded-full"
>

      <button onClick={handleUpload}
       className="submit-button  bg-primary hover:bg-secondary h-12 text-white font-bold  rounded-full"
       >Upload</button>
       </div>
    </div>
  );
};
export default ImageUpload;
