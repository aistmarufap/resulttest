import React, { useEffect, useState } from 'react';
import axios from 'axios';

const ResultTry = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [institutionCode, setInstitutionCode] = useState('');

  const fetchData = async (code) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`/alldata.json`); // Adjust the path if necessary
      const filteredData = response.data.filter(institution => institution.institutionCode === code);
      if (filteredData.length === 0) {
        throw new Error('Institution not found');
      }
      setData(filteredData);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (institutionCode) {
      fetchData(institutionCode);
    }
  };

  return (
    <div>
      <h1>Institution Results</h1>
      <input
        type="text"
        value={institutionCode}
        onChange={(e) => setInstitutionCode(e.target.value)}
        placeholder="Enter Institution Code"
      />
      <button onClick={handleSearch}>Search</button>

      {loading && <div>Loading...</div>}
      {error && <div>Error: {error.message}</div>}
      {data && data.map((institution) => {
        const semesters = Array.from(new Set(institution.rollData.flatMap(student => student.referredSubjects?.map(subject => subject.semester)))).sort((a, b) => parseInt(a) - parseInt(b));

        return (
          <div key={institution.institutionCode}>
            <h2>{institution.institutionName} ({institution.district})</h2>
            <style>
              {`
                table {
                  width: 100%;
                  border-collapse: collapse;
                  margin-bottom: 20px;
                }
                th, td {
                  border: 1px solid #ddd;
                  padding: 8px;
                  text-align: center;
                }
                th {
                  background-color: #f2f2f2;
                }
              `}
            </style>
            <table>
              <thead>
                <tr>
                  <th>S.No.</th>
                  <th>Roll</th>

                  {semesters.filter(semester => semester !== undefined).map(semester => (
                    <th key={semester}>{semester} Subjects</th>

                  ))}
                  <th>GPA</th>
                </tr>
              </thead>
              <tbody>
                {institution.rollData.map((student, index) => (
                  <tr key={student.roll}>
                    <td>{index+1}</td>
                    <td>{student.roll}</td>

                    {semesters.filter(semester => semester !== undefined).map(semester => {
                      const subjectsForSemester = student.referredSubjects?.filter(subject => subject.semester === semester)
                        .map(subject => `${subject.name} {${subject.code}(${subject.status})}`)
                        .join(', ') || '-';

                      return (
                        <td key={semester}>
                          {subjectsForSemester}
                        </td>
                      );
                    })}
                    <td>{student.gpa !== null ? parseFloat(student.gpa).toFixed(2) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
};

export default ResultTry;
