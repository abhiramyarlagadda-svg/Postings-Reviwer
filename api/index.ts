import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import * as pdfParseModule from 'pdf-parse';
const pdfParse = (pdfParseModule as any).default || pdfParseModule;
import * as xlsx from 'xlsx';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const demoUserId = 'demo-user-id-5555-4444';
let db = {
  users: [
    { id: demoUserId, name: 'Demo User', email: 'demo@example.com', password: 'demo', token: 'demo-token-123' }
  ],
  candidates: [
    {
      id: uuidv4(), userId: demoUserId, name: 'Sarah Jenkins', email: 'sarah@example.com',
      technology: 'React', country: 'United States',
      resumeText: 'Senior Frontend Engineer with 6 years of experience building scalable web applications. Expert in React, TypeScript, Node.js, and GraphQL. Built multiple enterprise dashboards and led a team of 4 engineers at previous company. Passionate about performance optimization and clean architecture.',
      createdAt: new Date().toISOString()
    },
    {
      id: uuidv4(), userId: demoUserId, name: 'Michael Chen', email: 'michael.c@example.com',
      technology: 'Python', country: 'Canada',
      resumeText: 'Backend Developer focusing on scalable microservices. 4 years of Python experience, specialized in Django and FastAPI. Strong background in database design (PostgreSQL, MongoDB) and cloud deployment (AWS, Docker).',
      createdAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: uuidv4(), userId: demoUserId, name: 'Alex Rodriguez', email: 'alex.ml@example.com',
      technology: 'Python', country: 'United States',
      resumeText: 'Machine Learning Engineer and Data Scientist. 5 years of experience with PyTorch, TensorFlow, and scikit-learn. Developed recommendation models and NLP pipelines. Proficient in Python, SQL, and data visualization tools.',
      createdAt: new Date(Date.now() - 2 * 86400000).toISOString()
    },
    {
      id: uuidv4(), userId: demoUserId, name: 'Priya Patel', email: 'priya.devops@example.com',
      technology: 'Go', country: 'United Kingdom',
      resumeText: 'DevOps Engineer with 7 years of background in cloud infrastructure. AWS Certified Solutions Architect. Expert in Kubernetes, Docker, Terraform, and CI/CD pipelines (GitHub Actions, Jenkins). Fluent in bash and Go for scripting.',
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString()
    },
    {
      id: uuidv4(), userId: demoUserId, name: 'David Kim', email: 'david.java@example.com',
      technology: 'Java', country: 'Australia',
      resumeText: 'Senior Enterprise Java Developer. 10+ years shaping backend systems for FinTech. Deeply experienced in Spring Boot, Hibernate, Kafka, and microservices architecture. Strong emphasis on test-driven development (TDD) and clean code.',
      createdAt: new Date(Date.now() - 4 * 86400000).toISOString()
    },
    {
      id: uuidv4(), userId: demoUserId, name: 'Emily Watson', email: 'emily.fullstack@example.com',
      technology: 'Node.js', country: 'United States',
      resumeText: 'Fullstack Software Engineer. 3 years working across the JavaScript stack. Proven ability to build features end-to-end using React, Node.js (Express), and MongoDB. Comfortable with RESTful APIs, state management (Redux), and Tailwind CSS.',
      createdAt: new Date(Date.now() - 5 * 86400000).toISOString()
    }
  ],
  jobs: [
    { id: uuidv4(), userId: demoUserId, title: 'Lead Design Engineer', company: 'TechStream Solutions', location: 'San Francisco, CA', description: 'Looking for a Senior Frontend Engineer with 5+ years of experience. Must have deep knowledge of React, Node.js, and modern CSS architectures. TypeScript experience is highly desirable.', source: 'Galaxy API Integration', createdAt: new Date().toISOString() },
    { id: uuidv4(), userId: demoUserId, title: 'Senior Fullstack Architect', company: 'Vortex Media', location: 'Remote', description: 'Seeking an architect to redesign our core platform. Required skills: React, TypeScript, Node.js, GraphQL. You will be responsible for technical decisions and mentoring junior devs.', source: 'Excel Upload', createdAt: new Date(Date.now() - 100000).toISOString() },
    { id: uuidv4(), userId: demoUserId, title: 'Backend Python Engineer', company: 'DataDyne', location: 'Toronto, ON', description: 'Join our data team to build robust APIs using FastAPI and Python. Experience with AWS and containerization is required. 3+ years experience.', source: 'Manual Entry', createdAt: new Date(Date.now() - 200000).toISOString() },
    { id: uuidv4(), userId: demoUserId, title: 'Machine Learning Engineer', company: 'AI Innovations', location: 'Seattle, WA', description: 'We are looking for an ML Engineer to build scalable NLP models. Required: Python, TensorFlow or PyTorch, and 4+ years of industry experience. Big data experience (Spark) is a plus.', source: 'Galaxy API Integration', createdAt: new Date(Date.now() - 300000).toISOString() },
    { id: uuidv4(), userId: demoUserId, title: 'Senior Site Reliability / DevOps Engineer', company: 'CloudWorks', location: 'Remote', description: 'Critical role ensuring uptime of our global services. Must have hands-on experience with production Kubernetes clusters, Terraform, AWS, and strong Go or Python scripting skills.', source: 'Excel Upload', createdAt: new Date(Date.now() - 400000).toISOString() },
    { id: uuidv4(), userId: demoUserId, title: 'Principal Java Architect', company: 'Fintech Core', location: 'London, UK (Hybrid)', description: 'Seeking a seasoned Java Architect to lead our transaction processing systems. Must be an expert in Java, Spring Boot, event-driven architectures (Kafka), and highly concurrent systems.', source: 'Galaxy API Integration', createdAt: new Date(Date.now() - 500000).toISOString() },
    { id: uuidv4(), userId: demoUserId, title: 'Junior/Mid Full-Stack Node Developer', company: 'StartupX', location: 'Austin, TX', description: 'Fast-paced startup environment. Need a dev who can jump between React frontend and Node/Express backend. MongoDB experience required. 2+ years experience preferred.', source: 'Manual Entry', createdAt: new Date(Date.now() - 600000).toISOString() },
    { id: uuidv4(), userId: demoUserId, title: 'React Native Mobile Developer', company: 'AppSynergy', location: 'Remote', description: 'Help us build our cross-platform mobile app. Need strong React Native skills, state management, and an eye for UI/UX detail. Swift/Kotlin bridges experience is nice to have.', source: 'Galaxy API Integration', createdAt: new Date(Date.now() - 700000).toISOString() },
    { id: uuidv4(), userId: demoUserId, title: 'Vue.js Frontend Engineer', company: 'Design First', location: 'New York, NY', description: 'We are migrating from legacy to Vue 3. Need a Vue developer with strong CSS/Tailwind skills to build beautiful, responsive web applications.', source: 'Excel Upload', createdAt: new Date(Date.now() - 800000).toISOString() },
    { id: uuidv4(), userId: demoUserId, title: 'Data Engineer', company: 'BigData Corp', location: 'San Francisco, CA', description: 'Building data pipelines using Python, SQL, and Airflow. Cloud data warehouse experience (Snowflake/Redshift) required.', source: 'Galaxy API Integration', createdAt: new Date(Date.now() - 900000).toISOString() }
  ],
  applications: [] as any[]
};

db.applications = [
  { id: uuidv4(), userId: demoUserId, candidateId: db.candidates[0].id, jobId: db.jobs[0].id, status: 'AUTO-MATCHED', createdAt: new Date().toISOString() },
  { id: uuidv4(), userId: demoUserId, candidateId: db.candidates[1].id, jobId: db.jobs[1].id, status: 'UNDER REVIEW', createdAt: new Date(Date.now() - 86400000).toISOString() }
];

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const user = db.users.find((u: any) => u.token === token);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  req.user = user;
  next();
};

app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  if (db.users.find((u: any) => u.email === email)) {
    return res.status(400).json({ error: 'User already exists' });
  }
  const user = { id: uuidv4(), name, email, password, token: uuidv4() };
  db.users.push(user);
  res.json({ user: { id: user.id, name: user.name, email: user.email }, token: user.token });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.users.find((u: any) => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ user: { id: user.id, name: user.name, email: user.email }, token: user.token });
});

app.get('/api/candidates', authenticate, (req: any, res) => {
  res.json(db.candidates.filter((c: any) => c.userId === req.user.id));
});

app.post('/api/candidates', authenticate, upload.single('resume'), async (req: any, res) => {
  try {
    const { name, email, technology, country } = req.body;
    let resumeText = '';
    if (req.file) {
      if (req.file.mimetype === 'application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf')) {
        try {
          const parsed = await pdfParse(req.file.buffer);
          resumeText = parsed.text;
        } catch (e: any) {
          resumeText = req.file.buffer.toString('utf-8');
        }
      } else {
        resumeText = req.file.buffer.toString('utf-8');
      }
    }
    if (!resumeText || resumeText.trim().length === 0) {
      resumeText = `Candidate ${name} - ${technology} - ${country}. No valid text found.`;
    }
    const candidate = { id: uuidv4(), userId: req.user.id, name, email, technology, country, resumeText, createdAt: new Date().toISOString() };
    db.candidates.push(candidate);
    res.json(candidate);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to process candidate: ' + error.message });
  }
});

app.get('/api/jobs', authenticate, (req: any, res) => {
  res.json(db.jobs.filter((j: any) => j.userId === req.user.id));
});

app.post('/api/jobs/preview', authenticate, upload.single('file'), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    let documentText = '';
    const originalName = req.file.originalname.toLowerCase();
    if (originalName.endsWith('.pdf')) {
      const parsed = await pdfParse(req.file.buffer);
      documentText = parsed.text;
    } else {
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      documentText = xlsx.utils.sheet_to_csv(sheet);
    }
    if (!documentText.trim()) return res.status(400).json({ error: 'Failed to extract text from the uploaded file.' });

    const prompt = `You are a data extraction AI. Extract the job listings from the following document.
Return a structured JSON array of objects. Each object must have exactly these fields:
- title: string (the job title)
- company: string (the company or entity name, default to "Unknown" if missing)
- location: string (the job location, default to "Remote" if missing)
- description: string (a short summary or the requirements of the job)

Here is the document content:
${documentText.length > 30000 ? documentText.substring(0, 30000) : documentText}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json', temperature: 0.1 }
    });
    const parsedData = JSON.parse(response.text || '[]');
    const previewJobs = Array.isArray(parsedData) ? parsedData.map((j: any) => ({
      title: j.title || 'Unknown Title', company: j.company || 'Unknown Company',
      location: j.location || 'Remote', description: j.description || '',
      source: 'AI Extracted via Upload'
    })) : [];
    res.json({ preview: previewJobs });
  } catch (error: any) {
    const msg = error.message || String(error);
    if (msg.includes('API key not valid') || msg.includes('API_KEY_INVALID')) {
      return res.status(500).json({ error: 'The provided Gemini API key is invalid. Please check your API key.' });
    }
    res.status(500).json({ error: 'Failed to process jobs file: ' + msg });
  }
});

app.post('/api/jobs/bulk', authenticate, (req: any, res) => {
  try {
    const { jobs } = req.body;
    if (!Array.isArray(jobs)) return res.status(400).json({ error: 'Invalid data format' });
    const newJobs = jobs.map((j: any) => ({
      id: uuidv4(), userId: req.user.id, title: j.title || 'Unknown Title',
      company: j.company || 'Unknown Company', location: j.location || 'Remote',
      description: j.description || '', source: j.source || 'Bulk Upload',
      createdAt: new Date().toISOString()
    }));
    db.jobs.push(...newJobs);
    res.json({ message: 'Jobs imported', count: newJobs.length });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to import jobs: ' + error.message });
  }
});

app.post('/api/jobs/galaxy', authenticate, (req: any, res) => {
  const technologies = ['React', 'Node.js', 'Python', 'Java', 'Go', 'Ruby on Rails', 'Vue', 'Angular', 'TypeScript'];
  const companies = ['TechCorp', 'Innovatech', 'Galaxy Systems', 'DataDyne', 'Hooli', 'Pied Piper'];
  const locations = ['San Francisco, CA', 'New York, NY', 'Austin, TX', 'Remote', 'London, UK'];
  const newJobs = Array.from({ length: 5 }).map(() => {
    const title = `${technologies[Math.floor(Math.random() * technologies.length)]} Developer`;
    const company = companies[Math.floor(Math.random() * companies.length)];
    const location = locations[Math.floor(Math.random() * locations.length)];
    return {
      id: uuidv4(), userId: req.user.id, title, company, location,
      description: `We are looking for a skilled ${title} to join ${company} in ${location}. Focus on building scalable applications, managing deployments, and working with modern architectural patterns. Strong background in problem solving and algorithms desired.`,
      source: 'Galaxy API Integration', createdAt: new Date().toISOString()
    };
  });
  db.jobs.push(...newJobs);
  res.json({ message: 'Jobs fetched from Galaxy Integration', count: newJobs.length });
});

app.get('/api/applications', authenticate, (req: any, res) => {
  res.json(db.applications.filter((a: any) => a.userId === req.user.id));
});

app.post('/api/applications', authenticate, (req: any, res) => {
  const { jobId, candidateId } = req.body;
  if (db.applications.find((a: any) => a.jobId === jobId && a.candidateId === candidateId)) {
    return res.status(400).json({ error: 'Already applied' });
  }
  const application = {
    id: uuidv4(), userId: req.user.id, jobId, candidateId,
    status: 'Applied', createdAt: new Date().toISOString()
  };
  db.applications.push(application);
  res.json(application);
});

export default app;
