import React, { useState, useEffect } from 'react';
import { pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set the workerSrc for pdfjs-dist
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const ForAllResult = () => {
  const [pdfFile, setPdfFile] = useState(null); // Store uploaded file
  const [loading, setLoading] = useState(false); // Loading state for the loader
  const [results, setResults] = useState([]); // Store extracted results
  const [subjectList, setSubjectList] = useState([]); // Store subject data
  const [semester, setSemester] = useState('5'); // Example semester value
  const [resultsArray, setResultsArray] = useState([]); // Store final table data

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

  // Fetch subjects.json on component mount
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await fetch('/subjects.json');
        const data = await response.json();
        setSubjectList(data);
      } catch (error) {
        console.error('Failed to fetch subjects:', error);
      }
    };

    fetchSubjects();
  }, []);

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

  // Helper function to get subject name by code and filter by semester
  const getSubjectNameAndSemester = (code) => {
    const subject = subjectList.find(subject => subject.code === code);
    
    if (subject && parseInt(subject.semester) <= parseInt(semester)) { // Match subject based on page semester
      return `${subject.name} (${subject.semester})`; // Display subject name and semester
    }
    return 'Unknown Subject';
  };

  // Extract institution details and roll data from a page of text
  const extractInstituteAndRollData = (text, pageNumber) => {
    const institutePattern = /(\d{5})\s*-\s*([^,]+),\s*([a-zA-Z\s]+)/; // Match: Code - Name, District
    const instituteMatch = institutePattern.exec(text);

    const rollPattern = /(\d{6})\s*\{\s*([^}]*)\s*\}/g;
    const numericPattern = /(\d{6})\s*\(\s*([\d.]+)\s*\)/g;

    const rollData = {};
    let match;

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

    while ((match = numericPattern.exec(text)) !== null) {
      const rollNumber = match[1];
      const value = match[2];
      rollData[rollNumber] = rollData[rollNumber] || [];
      rollData[rollNumber].push({ gpa: parseFloat(value) });
    }

    const transformedRollData = Object.keys(rollData).map(roll => {
      const subjects = rollData[roll];
      const gpaEntry = subjects && subjects.find(subject => subject.gpa !== undefined);
      const gpa = gpaEntry ? gpaEntry.gpa : null;

      return {
        roll,
        referred_subjects: subjects && subjects.length > 0 && !gpaEntry ? subjects : null, 
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

  // Effect to generate results array when rollData changes
  useEffect(() => {
    const generatedArray = results.map(institute => ({
      ...institute,
      rollData: institute.rollData.map(data => ({
        roll: data.roll,
        referred_subjects: data.referred_subjects
          ? data.referred_subjects.map(subject => {
              const subjectDetails = subjectList.find(sub => sub.code === subject.code);
              return {
                code: subject.code,
                status: subject.status,
                name: subjectDetails ? subjectDetails.name : 'Unknown Subject',
                semester: subjectDetails ? subjectDetails.semester : 'Unknown Semester'
              };
            })
          : [],
        gpa: data.gpa !== null ? data.gpa : 'N/A'
      }))
    }));

    setResultsArray(generatedArray); // Set the results array state
  }, [results, semester, subjectList]);

// Helper function to download JSON file
const exportToJsonFile = (jsonData) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(jsonData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "extracted_results.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  
  
// Prepare the organized JSON data structure
const generateOrganizedJson = () => {
    return results.map(({ institutionCode, institutionName, district, rollData }) => ({
      institutionCode,
      institutionName,
      district,
      rollData: rollData.map(({ roll, referred_subjects, gpa }) => ({
        roll,
        referredSubjects: referred_subjects 
          ? referred_subjects.map(({ code, status }) => {
              const subjectDetails = subjectList.find(sub => sub.code === code);
              return {
                code,
                status,
                name: subjectDetails ? subjectDetails.name : 'Unknown Subject',
                semester: subjectDetails ? subjectDetails.semester : 'Unknown Semester'
              };
            })
          : null,
        gpa
      })),
    }));
  };
  



  return (
    <div>

<h2>Upload PDF and View Extracted Information</h2>
      <input type="file" accept="application/pdf" onChange={onFileChange} />

      {/* Display the loader while text is being extracted */}
      {loading && <div>Loading PDF text...</div>}
      <h2>Extracted Results by Institution</h2>
      <button onClick={() => exportToJsonFile(generateOrganizedJson())}>
  Export to JSON
</button>

      {/* Display extracted results for each institution */}
      {resultsArray.length > 0 && (
        <div>
          {resultsArray.map(({ institutionCode, institutionName, district, rollData }, instituteIndex) => (
            <div key={instituteIndex}>
              {/* Display Institution details */}
              <h3>{`Institution: ${institutionName} (Code: ${institutionCode}, District: ${district})`}</h3>

              {/* Table for each institution */}
              <table border="1" cellPadding="5" cellSpacing="0">
                <thead>
                  <tr>
                    <th>SL</th>
                    <th>Roll Number</th>
                    <th>Referred Subjects</th>
                    <th>Subject Name</th>
                    <th>GPA</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Loop through rollData for each institute */}
                  {rollData.length > 0 ? (
                    rollData.map((data, index) => (
                      <tr key={data.roll}>
                        <td>{index + 1}</td>
                        <td>{data.roll}</td>

                        {/* Referred Subjects */}
                        <td>
                          {data.referred_subjects && data.referred_subjects.length > 0 ? (
                            data.referred_subjects.map((subject, subIndex) => (
                              <div key={subIndex}>
                                {subject.code} ({subject.status})
                              </div>
                            ))
                          ) : (
                            'No subjects'
                          )}
                        </td>

                        {/* Subject Names */}
                        <td>
                          {data.referred_subjects && data.referred_subjects.length > 0 ? (
                            data.referred_subjects.map((subject, subIndex) => (
                              <div key={subIndex}>
                                {getSubjectNameAndSemester(subject.code)}
                              </div>
                            ))
                          ) : (
                            'No subjects'
                          )}
                        </td>

                        {/* GPA */}
                        <td>{data.gpa}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5">No roll data available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Loader while processing */}
      {loading && <p>Processing PDF, please wait...</p>}
    </div>
  );
};

export default ForAllResult;
