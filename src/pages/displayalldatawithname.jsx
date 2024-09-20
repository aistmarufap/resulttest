import React, { useState } from 'react';
import { pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set the workerSrc for pdfjs-dist
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const ForAllResult = () => {
  const [pdfFile, setPdfFile] = useState(null); // Store uploaded file
  const [loading, setLoading] = useState(false); // Loading state for the loader
  const [results, setResults] = useState([]); // Store extracted results

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
        const results = [];
        for (let i = 0; i < numPages; i += batchSize) {
          const pageBatch = Array.from({ length: Math.min(batchSize, numPages - i) }, (v, j) => extractPageText(i + j + 1));
          const pageTexts = await Promise.all(pageBatch); // Process a batch of pages
          results.push(...pageTexts);
        }
        return results;
      };

      try {
        const fullTextArray = await batchedPromises(MAX_CONCURRENT_PAGES, numPages);
        const extractedResults = fullTextArray.map((text, index) => extractInstituteAndRollData(text, index + 1));
        setResults(extractedResults); // Set the extracted results

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

  // Extract institution details and roll data from a page of text
  const extractInstituteAndRollData = (text, pageNumber) => {
    // Regular expression to extract institution code, name, and district
    const institutePattern = /(\d{5})\s*-\s*([^,]+),\s*([a-zA-Z\s]+)/; // Match: Code - Name, District
    const instituteMatch = institutePattern.exec(text);

    // Regular expression to extract roll information
    const rollPattern = /(\d{6})\s*\{\s*([^}]*)\s*\}/g;
    const numericPattern = /(\d{6})\s*\(\s*([\d.]+)\s*\)/g;

    const rollData = {};
    let match;

    // Extracting roll numbers and subjects
    while ((match = rollPattern.exec(text)) !== null) {
      const rollNumber = match[1];
      const info = match[2].trim();
      const subjects = [];

      const subjectPattern = /(\d{5})\s*\(([^)]+)\)/g;
      let subjectMatch;

      while ((subjectMatch = subjectPattern.exec(info)) !== null) {
        const code = subjectMatch[1];
        const status = subjectMatch[2].trim();
        subjects.push({ code, status });
      }

      rollData[rollNumber] = subjects.length > 0 ? subjects : null;
    }

    // Extracting roll numbers and GPA
    while ((match = numericPattern.exec(text)) !== null) {
      const rollNumber = match[1];
      const value = match[2];
      rollData[rollNumber] = rollData[rollNumber] || []; // Ensure it exists
      rollData[rollNumber].push({ gpa: parseFloat(value) });
    }

    // Transforming rollData object into an array
    const transformedRollData = Object.keys(rollData).map(roll => {
      const subjects = rollData[roll];
      const gpaEntry = subjects && subjects.find(subject => subject.gpa !== undefined);
      const gpa = gpaEntry ? gpaEntry.gpa : null;

      return {
        roll,
        referred_subjects: subjects && subjects.length > 0 && !gpaEntry ? subjects : null, // Set to null if no subjects found
        gpa
      };
    });

    return {
        institutionCode: instituteMatch ? instituteMatch[1].trim() : 'Unknown Code',
        institutionName: instituteMatch ? instituteMatch[2].trim() : 'Unknown Institution',
        district: instituteMatch ? instituteMatch[3].trim() : 'Unknown District',
        rollData: transformedRollData,
        page: pageNumber
    };
  };

  return (
    <div>
      <h2>Upload PDF and View Extracted Information</h2>
      <input type="file" accept="application/pdf" onChange={onFileChange} />

      {/* Display the loader while text is being extracted */}
      {loading && <div>Loading PDF text...</div>}

      {/* Display extracted results for each page */}
      {results.length > 0 && (
  <div>
    {results
      .filter(
        ({ institutionCode, institutionName, district, rollData }) =>
          institutionCode !== 'Unknown Code' ||
          institutionName !== 'Unknown Institution' ||
          district !== 'Unknown District' ||
          rollData.length > 0
      )
      .map(({ institutionCode, institutionName, district, rollData }, index) => (
        <div key={index}>
          {/* Display the sequential page number based on the filtered results */}
          <h3>{`Page ${index + 1}`}</h3>
          <div>{`Code: ${institutionCode}, Institution: ${institutionName}, District: ${district}`}</div>
          {rollData.length > 0 ? (
            <ul>
              {rollData.map(({ roll, referred_subjects, gpa }) => (
                <li key={roll}>
                  <strong>Roll: {roll}</strong>
                  {referred_subjects && referred_subjects.length > 0 && (
                    <div>
                      <strong>Subjects:</strong>
                      <ul>
                        {referred_subjects.map(({ code, status }, subIndex) => (
                          <li key={subIndex}>
                            Code: {code}, Status: {status}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {gpa !== null && <div>GPA: {gpa}</div>}
                </li>
              ))}
            </ul>
          ) : (
            <div>No roll data found for this page.</div>
          )}
        </div>
      ))}
  </div>
)}


    </div>
  );
};

export default ForAllResult;
