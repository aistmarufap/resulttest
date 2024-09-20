import React, { useState } from 'react';
import { pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set the workerSrc for pdfjs-dist
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const ForAllResult = () => {
  const [pdfFile, setPdfFile] = useState(null); // Store uploaded file
  const [textContent, setTextContent] = useState(''); // Store extracted text
  const [loading, setLoading] = useState(false); // Loading state for the loader
  const [semester, setSemester] = useState(''); // Store semester info
  const [regulation, setRegulation] = useState(''); // Store regulation info

  const MAX_CONCURRENT_PAGES = 10; // Limit number of parallel page extractions

  const pdfFileRef = React.useRef(null); // Ref to store PDF file instance

  // Handle file upload
  const onFileChange = async (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setLoading(true); // Start the loader when a file is uploaded
      await loadPdfAndExtractText(file); // Load the PDF and extract text
    } else {
      alert('Please upload a valid PDF file.');
    }
  };

  // Function to load the PDF and extract text from it
  const loadPdfAndExtractText = async (file) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    
    reader.onload = async (event) => {
      const pdfData = event.target.result;
      
      // Load the PDF document
      const pdf = await pdfjs.getDocument({ data: pdfData }).promise;
      pdfFileRef.current = pdf;

      const numPages = pdf.numPages;

      // Extract text from each page in parallel with batching
      const extractPageText = async (pageNumber) => {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        return textContent.items.map((item) => item.str).join(' ');
      };

      const batchedPromises = async (batchSize, numPages) => {
        let fullText = [];
        for (let i = 0; i < numPages; i += batchSize) {
          const pageBatch = Array.from({ length: Math.min(batchSize, numPages - i) }, (v, j) => extractPageText(i + j + 1));
          const pageTexts = await Promise.all(pageBatch); // Process a batch of pages
          fullText = [...fullText, ...pageTexts]; // Collect the text from each batch
        }
        return fullText;
      };

      try {
        const fullTextArray = await batchedPromises(MAX_CONCURRENT_PAGES, numPages);
        const fullText = fullTextArray.join('\n\n');
        setTextContent(fullText); // Set the extracted text to state

        // Extract semester and regulation from text
        const semesterMatch = /(\d+)(?:th|st|nd|rd)\s*Semester/i.exec(fullText);
        const regulationMatch = /(\d{4})\s*Regulation/i.exec(fullText);

        if (semesterMatch) {
          setSemester(semesterMatch[1]); // Set the semester number
        }

        if (regulationMatch) {
          setRegulation(regulationMatch[1]); // Set the regulation year
        }

      } catch (error) {
        console.error('Error extracting text:', error);
      } finally {
        setLoading(false); // Stop the loader after text extraction is done
      }
    };

    reader.onerror = (error) => {
      console.error('Error reading PDF file:', error);
      setLoading(false);
    };
  };

  return (
    <div>
      <h2>Upload PDF and View Extracted Information</h2>
      <input type="file" accept="application/pdf" onChange={onFileChange} />

      {/* Display the loader while text is being extracted */}
      {loading && <div>Loading PDF text...</div>}

      {/* Display extracted semester and regulation */}
      {semester && <h2>Semester: {semester} Semester</h2>}
      {regulation && <h2>Regulation: {regulation}</h2>}

      {/* Display extracted text */}
      {textContent && (
        <div>
          <h3>Extracted Text:</h3>
          <textarea
            rows={20}
            cols={80}
            value={textContent}
            readOnly
          />
        </div>
      )}
    </div>
  );
};

export default ForAllResult;
