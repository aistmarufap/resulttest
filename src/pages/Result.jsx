import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set the workerSrc for pdfjs-dist
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const Resultzone = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [targetPage, setTargetPage] = useState(null);
  const [pdfText, setPdfText] = useState('');
  const [result, setResult] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [rollInfo, setRollInfo] = useState('');

  // Handle file selection
  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
    setResult('');
    setRollInfo('');
  };

  // Extract text and roll numbers from PDF pages
  const extractTextFromPDF = async (pdf) => {
    let foundPage = null;
    let text = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(' ');

      text += pageText; // Aggregate text from all pages

      if (/Ashulia Private Institute of Science and Technology/i.test(pageText)) {
        foundPage = i;
      }
    }

    setPdfText(text);
    return foundPage;
  };

  // Extract roll numbers and their associated information from text
  const extractRollInfo = (text) => {
    const rollPattern = /(\d{6})\s*[\{\(]\s*([^}\)]*)\s*[\}\)]/g;
    const rollData = {};
    let match;

    while ((match = rollPattern.exec(text)) !== null) {
      const rollNumber = match[1];
      const info = match[2].trim();
      if (!rollData[rollNumber]) {
        rollData[rollNumber] = [];
      }
      rollData[rollNumber].push(info);
    }

    return rollData;
  };

  // Handle successful PDF load
  const onLoadSuccess = async (pdf) => {
    const pageNumber = await extractTextFromPDF(pdf);

    if (pageNumber) {
      setTargetPage(pageNumber);
      setResult(`Text found on page ${pageNumber}.`);
    } else {
      setResult('Text not found in the document.');
    }
  };

  // Search for roll number information
  const handleRollNumberSearch = () => {
    const rollData = extractRollInfo(pdfText);
    const info = rollData[rollNumber] ? rollData[rollNumber].join(', ') : 'Roll number not found.';
    setRollInfo(info);
  };

  return (
    <div>
      <h2>Upload PDF and Search for Text</h2>
      <form onSubmit={(e) => e.preventDefault()}>
        <input type="file" accept="application/pdf" onChange={handleFileChange} />
        <button type="button" onClick={() => setTargetPage(null)}>Clear Page</button>
      </form>

      {selectedFile && (
        <Document
          file={selectedFile}
          onLoadSuccess={onLoadSuccess}
          onLoadError={(error) => {
            console.error('Error while loading document:', error);
            setResult('Failed to load PDF file.');
          }}
        >
          {targetPage && <Page pageNumber={targetPage} />}
        </Document>
      )}

      {result && <p>{result}</p>}

      <div>
        <h3>Search Roll Number</h3>
        <input
          type="text"
          value={rollNumber}
          onChange={(e) => setRollNumber(e.target.value)}
          placeholder="Enter roll number"
        />
        <button type="button" onClick={handleRollNumberSearch}>Search</button>
        {rollInfo && <p>{rollNumber} {`{ ${rollInfo} }`}</p>}
      </div>
    </div>
  );
};

export default Resultzone;
