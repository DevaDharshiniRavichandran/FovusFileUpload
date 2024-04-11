
import React, { useState } from 'react';
import { uploadToS3 } from '../api/uploadToS3';
import { callLambda } from '../api/callLambda';
import '../Components/FileUploadForm.css';


const FileUploadForm = () => {
  const [inputText, setInputText] = useState('');
  const [inputFile, setInputFile] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Upload file to S3
    const fileName = `${inputFile.name}`;

    var bucketname = 'my-fovusfile-bucket';
    await uploadToS3(inputFile, fileName);
    await callLambda(bucketname, fileName, inputText);
   };

  return (
    <form onSubmit={handleSubmit} className="form-container">
      <div className="form-group">
        <label className="form-group-label">
          Text input:
          <input 
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            className="text-input"
          />
        </label>
      </div>
      <div className="form-group">
        <label className="form-group-label">
          File input:
          <input
            type="file" 
            onChange={e => setInputFile(e.target.files[0])}
            className="file-input"
          />
        </label>
      </div>
      <button type="submit" className="submit-button">Submit</button>
    </form>
  );
  
};

export default FileUploadForm;