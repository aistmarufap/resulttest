import React, { useCallback, useEffect, useState } from 'react';
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
  const [rollData, setRollData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [subjectList, setSubjectList] = useState([]); // State to hold subjects.json data
  const [resultsArray, setResultsArray] = useState([]); // New state for results array

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

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setResult('');
      setRollData([]);
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

  const extractRollInfo = useCallback((text) => {
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
    return Object.keys(rollData).map(roll => {
      const subjects = rollData[roll];
      const gpaEntry = subjects && subjects.find(subject => subject.gpa !== undefined);
      const gpa = gpaEntry ? gpaEntry.gpa : null;

      return {
        roll,
        referred_subjects: subjects && subjects.length > 0 && !gpaEntry ? subjects : null, // Set to null if no subjects found
        gpa
      };
    });
  }, []);

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

  // Helper function to get subject name by code and filter by semester
  const getSubjectNameAndSemester = (code) => {
    const subject = subjectList.find(subject => subject.code === code);
    
    if (subject && parseInt(subject.semester) <= parseInt(semester)) { // Match subject based on page semester
      return `${subject.name} (${subject.semester})`; // Display subject name and semester
    }
    return 'Unknown Subject';
  };

  // Effect to generate results array when rollData changes
  useEffect(() => {
    const generatedArray = rollData.map((data) => {
      return {
        roll: data.roll,
        referredSubjects: data.referred_subjects ? 
          data.referred_subjects.map(subject => {
            const subjectDetails = subjectList.find(sub => sub.code === subject.code);
            return {
              code: subject.code,
              status: subject.status,
              name: subjectDetails ? subjectDetails.name : 'Unknown Subject',
              semester: subjectDetails ? subjectDetails.semester : 'Unknown Semester' // Add semester here
            };
          }) : [],
        gpa: data.gpa !== null ? data.gpa : 'N/A',
      };
    });
    

    setResultsArray(generatedArray); // Set the results array state
  }, [rollData, semester, subjectList]); // Depend on rollData, semester, and subjectList
console.log(resultsArray);

  return (
    <div>
      <h2>Upload PDF and View Result</h2>
      <form onSubmit={(e) => e.preventDefault()}>
        <input type="file" accept="application/pdf" onChange={handleFileChange} />
      </form>
      {semester && <p><strong>Semester:</strong> {semester}</p>}
      {regulation && <p><strong>Regulation:</strong> {regulation}</p>}
      {rollData.length > 0 && (
        <table border='1' cellPadding='5' cellSpacing='0'>
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
            {rollData.map((data, index) => (
              <tr key={data.roll}>
                <td>{index + 1}</td>
                <td>{data.roll}</td>
                <td>
                  {data.referred_subjects ? (
                    data.referred_subjects.length > 0 ? (
                      data.referred_subjects.map((subject, index) => (
                        <div key={index}>
                          {subject.code} ({subject.status})
                        </div>
                      ))
                    ) : (
                      'No subjects'
                    )
                  ) : (
                    'No subjects'
                  )}
                </td>
                <td>
                  {data.referred_subjects ? (
                    data.referred_subjects.length > 0 ? (
                      data.referred_subjects.map((subject, index) => (
                        <div key={index}>
                          {getSubjectNameAndSemester(subject.code)} {/* Display subject name and semester */}
                        </div>
                      ))
                    ) : (
                      'No subjects'
                    )
                  ) : (
                    'No subjects'
                  )}
                </td>
                <td>{data.gpa !== null ? data.gpa : 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

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
    </div>
  );
};

export default Result;
