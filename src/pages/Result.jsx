import React, { useCallback, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set the workerSrc for pdfjs-dist
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const Result = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [targetPage, setTargetPage] = useState(null);
  const [pdfText, setPdfText] = useState('');
  const [semester, setSemester] = useState('');
  const [regulation, setRegulation] = useState('');
  const [rollData, setRollData] = useState({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setResult('');
      setRollData({});
      setSemester('');
      setRegulation('');
      setTargetPage(null);
    } else {
      alert('Please upload a valid PDF file.');
    }
  };

  const extractTextFromPage = async (pdf, pageNumber) => {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    return textContent.items.map((item) => item.str).join(' ');
  };

  const extractRollInfo = (text) => {
    const rollPattern = /(\d{6})\s*\{\s*([^}]*)\s*\}/g;
    const numericPattern = /(\d{6})\s*\(\s*([\d.]+)\s*\)/g;
    
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

    while ((match = numericPattern.exec(text)) !== null) {
      const rollNumber = match[1];
      const value = match[2];
      if (!rollData[rollNumber]) {
        rollData[rollNumber] = [];
      }
      rollData[rollNumber].push(value);
    }

    return rollData;
  };

  const extractDetails = async (pdf) => {
    let foundPage = null;
    let text = '';

    try {
      for (let i = 1; i <= pdf.numPages; i++) {
        const pageText = await extractTextFromPage(pdf, i);
        if (/Ashulia Private Institute of Science and Technology/i.test(pageText)) {
          foundPage = i;
          text = pageText;

          // Extract semester and regulation
          const semesterMatch = /(\d+)(?:th|st|nd|rd)\s*Semester/i.exec(pageText);
          const regulationMatch = /(\d{4})\s*Regulation/i.exec(pageText);

          if (semesterMatch) {
            setSemester(semesterMatch[1]);
          }

          if (regulationMatch) {
            setRegulation(regulationMatch[1]);
          }

          // Extract roll numbers and associated data
          const rollDataFromPage = extractRollInfo(pageText);
          setRollData(rollDataFromPage);

          break; // Stop after finding the relevant page
        }
      }

      if (foundPage) {
        setTargetPage(foundPage);
        setPdfText(text);
      } else {
        setResult('The page with "Ashulia Private Institute of Science and Technology" was not found.');
      }
    } catch (error) {
      console.error('Error while extracting text:', error);
      setResult('Failed to extract text from PDF.');
    }
  };

  const onLoadSuccess = async (pdf) => {
    setLoading(true);
    await extractDetails(pdf);
    setLoading(false);
  };

  return (
    <div>
      <h2>Upload PDF and View Result</h2>
      <form onSubmit={(e) => e.preventDefault()}>
        <input type="file" accept="application/pdf" onChange={handleFileChange} />
      </form>
      {semester && <p><strong>Semester:</strong> {semester}</p>}
      {regulation && <p><strong>Regulation:</strong> {regulation}</p>}
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
      {loading && <p>Loading...</p>}
      {result && <p>{result}</p>}
      {Object.keys(rollData).length > 0 && (
        <div>
          <h3>Extracted Roll Numbers:</h3>
          <table>
            <thead>
              <tr>
                <th>Roll Number</th>
                <th>Details</th>
                <th>Numeric Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(rollData).map(([rollNumber, details]) => (
                <tr key={rollNumber}>
                  <td>{rollNumber}</td>
                  <td>{details.filter(item => isNaN(item)).join(', ')}</td>
                  <td>{details.filter(item => !isNaN(item)).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Result;
