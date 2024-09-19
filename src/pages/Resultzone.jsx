import React, { useEffect, useState } from 'react';
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
  const [studentName, setStudentName] = useState('');
  const [students, setStudents] = useState([]);
  const [semester, setSemester] = useState('');
  const [regulation, setRegulation] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/students.json');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        setStudents(data);
      } catch (error) {
        console.error('Error fetching student data:', error);
      }
    };
    fetchData();
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setResult('');
      setRollInfo('');
      setSemester('');
      setRegulation('');
    } else {
      alert('Please upload a valid PDF file.');
    }
  };

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

      // Extract semester and regulation
      const semesterMatch = /(\d+)(?:th|st|nd|rd)\s*Semester/i.exec(pageText);
      const regulationMatch = /(\d{4})\s*Regulation/i.exec(pageText);

      if (semesterMatch) {
        setSemester(semesterMatch[1]);
      }

      if (regulationMatch) {
        setRegulation(regulationMatch[1]);
      }
    }

    setPdfText(text);
    return foundPage;
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

  const onLoadSuccess = async (pdf) => {
    const pageNumber = await extractTextFromPDF(pdf);

    if (pageNumber) {
      setTargetPage(pageNumber);
      setResult(`Text found on page ${pageNumber}.`);
    } else {
      setResult('Text not found in the document.');
    }
  };

  const getStudentName = (rollNumber) => {
    const student = students.find(student => student.roll === rollNumber);
    return student ? student.name : 'No student found';
  };

  const handleRollNumberSearch = () => {
    const rollData = extractRollInfo(pdfText);
    const info = rollData[rollNumber] ? rollData[rollNumber].join(', ') : 'Roll number not found.';
    setRollInfo(info);
    setStudentName(getStudentName(rollNumber));
  };

  const transformData = (data) => {
    const items = data.split(', ').map((item, index) => {
      let newItem = item.replace("(T)", "(Theory)");
      newItem = newItem.replace("(P)", "(Practical)");
      newItem = newItem.replace("(T,P)", "(Theory, Practical)");
      return `${index + 1}. ${newItem}`;
    });

    return items;
  };

  const transformedData = transformData(rollInfo);

  return (
    <div>
      <h2>Upload PDF and Search for Text</h2>
      <form onSubmit={(e) => e.preventDefault()}>
        <input type="file" accept="application/pdf" onChange={handleFileChange} />
        <button type="button" onClick={() => setTargetPage(null)}>Clear Page</button>
      </form>
      <div>
        <h3>Search Roll Number</h3>
        <input
          type="text"
          value={rollNumber}
          onChange={(e) => setRollNumber(e.target.value)}
          placeholder="Enter roll number"
        />
        <button type="button" onClick={handleRollNumberSearch}>Search</button>
        {
          rollInfo && (
            <div>
              <h1>{studentName} -- {rollNumber}</h1>
              <div>
                {transformedData.map((item, index) => (
                  <p key={index}>{item}</p>
                ))}
              </div>
            </div>
          )
        }
      </div>
     
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
      {semester && <p><strong>Semester:</strong> {semester}</p>}
      {regulation && <p><strong>Regulation:</strong> {regulation}</p>}
    </div>
  );
};

export default Resultzone;
