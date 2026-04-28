import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function* streamMatchJobs(resumeText: string, jobs: any[]) {
  if (jobs.length === 0) return;
  
  const prompt = `
You are an expert AI technical recruiter.
I will provide you with a candidate's resume and a list of job postings.
Analyze the resume and match it against the jobs.
For each job, calculate:
- Skill Match Score (0-100)
- Experience Match (0-100)
- Location Relevance (0-100)

Overall Match Score is the average of these three.
Based on the Overall Match Score, generate a Suitability flag:
- "Highly Suitable" (Score >= 80)
- "Moderately Suitable" (Score < 80 and >= 50)
- "Not Suitable" (Score < 50)

Also generate a brief reasoning (1-2 sentences) explaining why.
Only return the TOP 10 most relevant jobs, sorted highest match first.

### Candidate Resume:
${resumeText.slice(0, 15000)} // Truncate just in case

### Job Postings:
${JSON.stringify(jobs.map(j => ({ id: j.id, title: j.title, company: j.company, location: j.location, description: j.description })), null, 2)}
`;

  try {
    const responseStream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              jobId: { type: Type.STRING },
              skillMatchScore: { type: Type.NUMBER },
              experienceMatchScore: { type: Type.NUMBER },
              locationRelevanceScore: { type: Type.NUMBER },
              overallMatchScore: { type: Type.NUMBER },
              suitability: { type: Type.STRING },
              reason: { type: Type.STRING }
            },
            required: ["jobId", "skillMatchScore", "experienceMatchScore", "locationRelevanceScore", "overallMatchScore", "suitability", "reason"]
          }
        }
      }
    });

    let buffer = "";
    for await (const chunk of responseStream) {
      if (chunk.text) {
        buffer += chunk.text;
        
        const parsedItems = [];
        let depth = 0;
        let inString = false;
        let escape = false;
        let startIndex = -1;
        
        for (let i = 0; i < buffer.length; i++) {
          const char = buffer[i];
          
          if (escape) {
            escape = false;
            continue;
          }
          if (char === '\\') {
            escape = true;
            continue;
          }
          if (char === '"') {
            inString = !inString;
            continue;
          }
          
          if (!inString) {
            if (char === '{') {
              // we only care about top-level objects inside the array
              if (depth === 1) { // assuming the outer brackets are [ and ]
                startIndex = i;
              } else if (depth === 0) {
                 // in case the model returns just objects without outer array brackets initially
                 startIndex = i;
              }
              depth++;
            } else if (char === '}') {
              depth--;
              if ((depth === 1 || depth === 0) && startIndex !== -1) {
                try {
                   const objStr = buffer.substring(startIndex, i + 1);
                   parsedItems.push(JSON.parse(objStr));
                } catch(e) { }
                startIndex = -1;
              }
            } else if (char === '[') {
               depth++; // outer array
            } else if (char === ']') {
               depth--; // close outer array
            }
          }
        }
        
        if (parsedItems.length > 0) {
           yield parsedItems;
        }
      }
    }
  } catch (error: any) {
    console.error("Error matching jobs:", error);
    const msg = error.message || String(error);
    if (msg.includes('API key not valid') || msg.includes('API_KEY_INVALID')) {
      throw new Error("The provided Gemini API key is invalid.");
    }
    throw new Error("Failed to match jobs using AI: " + msg);
  }
}

export async function matchJobs(resumeText: string, jobs: any[]) {
  const stream = streamMatchJobs(resumeText, jobs);
  let finalResults = [];
  for await (const partial of stream) {
    finalResults = partial;
  }
  return finalResults;
}
