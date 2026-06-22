require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(cors());

app.use(express.static(path.join(__dirname, 'public')));

const personaPath = path.join(__dirname, 'persona.txt');
let systemPersona = "";
try {
    systemPersona = fs.readFileSync(personaPath, 'utf8');
    console.log("✅ persona.txt loaded successfully");
} catch (err) {
    console.error("❌ Warning: persona.txt not found.");
}

const API_CONFIGS = {
    'brebeuf-pro': {
        url: 'https://api.mistral.ai/v1/chat/completions',
        key: process.env.MISTRAL_KEY,
        model: 'mistral-small-latest'
    },
    'brebeuf-mini': {
        url: 'https://api.groq.com/openai/v1/chat/completions',
        key: process.env.GROQ_KEY,
        model: 'llama-3.1-8b-instant'
    }
};

app.post('/api/chat', async (req, res) => {
    const { modelId, messages } = req.body;
    const config = API_CONFIGS[modelId];

    console.log(`\n--- New Request: ${modelId} ---`);

    if (!config || !config.key) {
        console.error(`❌ Error: API Key for ${modelId} is missing in .env`);
        return res.status(401).json({ error: "API Key missing." });
    }

    const now = new Date();
    const dateString = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    const apiMessages = [
        { role: "system", content: `${systemPersona}\n\nCURRENT DATE: Today is ${dateString}.` },
        ...messages
    ];

    try {
        console.log(`📡 Calling AI provider...`);
        const response = await fetch(config.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.key}`
            },
            body: JSON.stringify({
                model: config.model,
                messages: apiMessages,
                stream: true,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error(`❌ AI Provider Error (${response.status}):`, errorData);
            return res.status(response.status).send(errorData);
        }

        console.log(`🟢 Connection successful, starting stream...`);
        res.setHeader('Content-Type', 'text/event-stream');
        
        const reader = response.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
        }
        console.log(`🏁 Stream complete.`);
        res.end();

    } catch (error) {
        console.error("🔥 Server Crash Error:", error);
        res.status(500).json({ error: "Failed to connect to AI provider." });
    }
});

const PORT = 8080;
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📂 Serving static files from: ${path.join(__dirname, 'public')}`);
});