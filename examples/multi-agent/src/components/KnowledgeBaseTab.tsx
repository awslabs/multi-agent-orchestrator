import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  files: string[];
}

const KnowledgeBaseTab: React.FC = () => {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [newKnowledgeBaseName, setNewKnowledgeBaseName] = useState('');
  const [newKnowledgeBaseDescription, setNewKnowledgeBaseDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState<string | null>(null);

  useEffect(() => {
    fetchKnowledgeBases();
  }, []);

  const fetchKnowledgeBases = async () => {
    try {
      const response = await axios.get('http://localhost:8000/knowledge-bases');
      setKnowledgeBases(response.data);
    } catch (error) {
      console.error('Error fetching knowledge bases:', error);
    }
  };

  const handleAddKnowledgeBase = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newKnowledgeBaseName.trim()) {
      try {
        await axios.post('http://localhost:8000/knowledge-bases', {
          name: newKnowledgeBaseName.trim(),
          description: newKnowledgeBaseDescription.trim(),
        });
        setNewKnowledgeBaseName('');
        setNewKnowledgeBaseDescription('');
        fetchKnowledgeBases();
      } catch (error) {
        console.error('Error adding knowledge base:', error);
      }
    }
  };

  const handleDeleteKnowledgeBase = async (id: string) => {
    try {
      await axios.delete(`http://localhost:8000/knowledge-bases/${id}`);
      fetchKnowledgeBases();
    } catch (error) {
      console.error('Error deleting knowledge base:', error);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleFileUpload = async () => {
    if (selectedFile && selectedKnowledgeBase) {
      const formData = new FormData();
      formData.append('file', selectedFile);
      try {
        await axios.post(`http://localhost:8000/knowledge-bases/${selectedKnowledgeBase}/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        setSelectedFile(null);
        fetchKnowledgeBases();
      } catch (error) {
        console.error('Error uploading file:', error);
      }
    }
  };

  return (
    <div className="knowledge-base-tab">
      <h2>Knowledge Bases</h2>
      <div className="knowledge-base-list">
        {knowledgeBases.map(kb => (
          <div key={kb.id} className="knowledge-base-item">
            <div>
              <h3>{kb.name}</h3>
              <p>{kb.description}</p>
              <ul>
                {kb.files.map((file, index) => (
                  <li key={index}>{file}</li>
                ))}
              </ul>
            </div>
            <button onClick={() => handleDeleteKnowledgeBase(kb.id)} className="delete-button">
              Delete
            </button>
          </div>
        ))}
      </div>
      <form onSubmit={handleAddKnowledgeBase} className="add-knowledge-base-form">
        <input
          type="text"
          value={newKnowledgeBaseName}
          onChange={(e) => setNewKnowledgeBaseName(e.target.value)}
          placeholder="Knowledge Base Name"
          required
        />
        <textarea
          value={newKnowledgeBaseDescription}
          onChange={(e) => setNewKnowledgeBaseDescription(e.target.value)}
          placeholder="Description"
        />
        <button type="submit">Add Knowledge Base</button>
      </form>
      <div className="file-upload-section">
        <select
          value={selectedKnowledgeBase || ''}
          onChange={(e) => setSelectedKnowledgeBase(e.target.value)}
        >
          <option value="">Select a Knowledge Base</option>
          {knowledgeBases.map(kb => (
            <option key={kb.id} value={kb.id}>{kb.name}</option>
          ))}
        </select>
        <input type="file" onChange={handleFileChange} />
        <button onClick={handleFileUpload} disabled={!selectedFile || !selectedKnowledgeBase}>
          Upload File
        </button>
      </div>
    </div>
  );
};

export default KnowledgeBaseTab;